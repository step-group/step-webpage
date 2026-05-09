const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── CATEGORIES ────────────────────────────────────────────────────────────────
router.get('/categories', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM resource_categories ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

router.post('/categories', requireAdmin, async (req, res) => {
  const { name, color = '#6c757d' } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const result = await pool.query(
      'INSERT INTO resource_categories (name, color) VALUES ($1, $2) RETURNING *',
      [name, color]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

router.patch('/categories/:id', requireAdmin, async (req, res) => {
  const { name, color } = req.body;
  const fields = [];
  const values = [];
  let idx = 1;
  if (name  !== undefined) { fields.push(`name = $${idx++}`);  values.push(name); }
  if (color !== undefined) { fields.push(`color = $${idx++}`); values.push(color); }
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

  try {
    const result = await pool.query(
      `UPDATE resource_categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      [...values, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

router.delete('/categories/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM resource_categories WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

// ── RESOURCES ─────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { category_id, search, archived, low_stock } = req.query;
  const showArchived = archived === 'true';

  let query = `
    SELECT r.*, rc.name AS category_name, rc.color AS category_color,
           u.name AS created_by_name
    FROM resources r
    LEFT JOIN resource_categories rc ON rc.id = r.category_id
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.state = $1
  `;
  const params = [showArchived ? 'archived' : 'normal'];
  let idx = 2;

  if (category_id) { query += ` AND r.category_id = $${idx++}`; params.push(category_id); }
  if (search)      { query += ` AND r.name ILIKE $${idx++}`;     params.push(`%${search}%`); }
  if (low_stock === 'true') { query += ` AND r.min_quantity IS NOT NULL AND r.quantity <= r.min_quantity`; }

  query += ' ORDER BY rc.name NULLS LAST, r.name';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener recursos' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const {
    name, category_id, quantity = 0, unit = '', location = '',
    cas_number = '', notes = '', min_quantity,
  } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const result = await pool.query(
      `INSERT INTO resources (name, category_id, quantity, unit, location, cas_number, notes, min_quantity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, category_id || null, quantity, unit, location, cas_number, notes, min_quantity || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear recurso' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, rc.name AS category_name, rc.color AS category_color,
              u.name AS created_by_name
       FROM resources r
       LEFT JOIN resource_categories rc ON rc.id = r.category_id
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Recurso no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener recurso' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  const allowed = ['name', 'category_id', 'quantity', 'unit', 'location', 'cas_number', 'notes', 'min_quantity'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => req.body[f] === '' && f === 'category_id' ? null : req.body[f]);

  try {
    const result = await pool.query(
      `UPDATE resources SET ${sets} WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Recurso no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar recurso' });
  }
});

router.patch('/:id/archive', requireAdmin, async (req, res) => {
  const { state } = req.body;
  if (!['normal', 'archived'].includes(state)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  try {
    const result = await pool.query(
      'UPDATE resources SET state = $1 WHERE id = $2 RETURNING *',
      [state, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Recurso no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al archivar recurso' });
  }
});

module.exports = router;
