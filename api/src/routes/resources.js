const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── LOCATIONS ─────────────────────────────────────────────────────────────────

function buildTree(rows) {
  const map = {};
  rows.forEach(r => { map[r.id] = { ...r, children: [] }; });
  const roots = [];
  rows.forEach(r => {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].children.push(map[r.id]);
    } else {
      roots.push(map[r.id]);
    }
  });
  return roots;
}

router.get('/locations', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM locations ORDER BY ordering, name'
    );
    res.json(buildTree(result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener ubicaciones' });
  }
});

router.post('/locations', requireAdmin, async (req, res) => {
  const { name, parent_id, ordering = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const result = await pool.query(
      'INSERT INTO locations (name, parent_id, ordering) VALUES ($1, $2, $3) RETURNING *',
      [name, parent_id || null, ordering]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear ubicación' });
  }
});

router.patch('/locations/:id', requireAdmin, async (req, res) => {
  const { name, parent_id, ordering } = req.body;
  const fields = [];
  const values = [];
  let idx = 1;
  if (name      !== undefined) { fields.push(`name = $${idx++}`);      values.push(name); }
  if (parent_id !== undefined) { fields.push(`parent_id = $${idx++}`); values.push(parent_id || null); }
  if (ordering  !== undefined) { fields.push(`ordering = $${idx++}`);  values.push(ordering); }
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

  try {
    const result = await pool.query(
      `UPDATE locations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      [...values, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Ubicación no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar ubicación' });
  }
});

router.delete('/locations/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM locations WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar ubicación' });
  }
});

// ── CATEGORIES ────────────────────────────────────────────────────────────────

router.get('/categories', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resource_categories ORDER BY name');
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

// ── BULK IMPORT ───────────────────────────────────────────────────────────────

router.post('/bulk', requireAuth, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de items' });
  }

  const client = await pool.connect();
  const created = [];
  const errors  = [];

  try {
    await client.query('BEGIN');
    for (let i = 0; i < items.length; i++) {
      const c = items[i];
      if (!c.name?.trim()) { errors.push({ row: i + 1, error: 'Nombre vacío' }); continue; }
      try {
        const { rows } = await client.query(
          `INSERT INTO resources
            (name, quantity, unit, cas_number, supplier, estado_actual, grado,
             inventory_status, location_id, comments, clase_quimica,
             almacenamiento_requerido, disposicion_residuos, estado_fisico,
             modelacion, polaridad, numero, barcode, location, notes,
             hazard_codes, ghs_signal_word, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
           RETURNING id, name`,
          [
            c.name.trim(),
            c.quantity    != null ? Number(c.quantity) : 0,
            c.unit        || '',
            c.cas_number  || '',
            c.supplier    || '',
            c.estado_actual   || '',
            c.grado           || '',
            c.inventory_status || 'available',
            c.location_id  || null,
            c.comments     || '',
            c.clase_quimica || '',
            c.almacenamiento_requerido || '',
            c.disposicion_residuos     || '',
            c.estado_fisico            || '',
            c.modelacion               || '',
            c.polaridad                || '',
            c.numero  || '',
            c.barcode || '',
            c.location || '',
            c.notes   || '',
            c.hazard_codes     || '',
            c.ghs_signal_word  || '',
            req.user.id,
          ]
        );
        created.push(rows[0]);
      } catch (err) {
        errors.push({ row: i + 1, name: c.name, error: err.message });
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ created: created.length, errors });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error en la importación' });
  } finally {
    client.release();
  }
});

// ── RESOURCES ─────────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  const { category_id, search, archived, low_stock, location_id } = req.query;
  const showArchived = archived === 'true';

  let query = `
    SELECT r.*, rc.name AS category_name, rc.color AS category_color,
           u.name AS created_by_name,
           l.name AS location_name, l.parent_id AS location_parent_id
    FROM resources r
    LEFT JOIN resource_categories rc ON rc.id = r.category_id
    LEFT JOIN users u ON u.id = r.created_by
    LEFT JOIN locations l ON l.id = r.location_id
    WHERE r.state = $1
  `;
  const params = [showArchived ? 'archived' : 'normal'];
  let idx = 2;

  if (category_id)  { query += ` AND r.category_id = $${idx++}`;  params.push(category_id); }
  if (location_id)  { query += ` AND r.location_id = $${idx++}`;  params.push(location_id); }
  if (search)       { query += ` AND r.name ILIKE $${idx++}`;      params.push(`%${search}%`); }
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
    barcode = '', supplier = '', estado_actual = '',
    grado = '', numero = '', inventory_status = 'available',
    location_id,
    date_acquired, comments = '',
    almacenamiento_requerido = '', clase_quimica = '',
    disposicion_residuos = '', estado_fisico = '',
    modelacion = '', polaridad = '',
    hazard_codes = '', ghs_signal_word = '',
  } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const result = await pool.query(
      `INSERT INTO resources
        (name, category_id, quantity, unit, location, cas_number, notes, min_quantity,
         barcode, supplier, estado_actual, grado, numero, inventory_status, location_id,
         date_acquired, comments, almacenamiento_requerido, clase_quimica,
         disposicion_residuos, estado_fisico, modelacion, polaridad,
         hazard_codes, ghs_signal_word, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
      [
        name, category_id || null, quantity, unit, location,
        cas_number, notes, min_quantity || null,
        barcode, supplier, estado_actual, grado, numero, inventory_status,
        location_id || null,
        date_acquired || null, comments,
        almacenamiento_requerido, clase_quimica,
        disposicion_residuos, estado_fisico, modelacion, polaridad,
        hazard_codes || '', ghs_signal_word || '',
        req.user.id,
      ]
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
              u.name AS created_by_name,
              l.name AS location_name, l.parent_id AS location_parent_id,
              lp.name AS location_parent_name
       FROM resources r
       LEFT JOIN resource_categories rc ON rc.id = r.category_id
       LEFT JOIN users u ON u.id = r.created_by
       LEFT JOIN locations l ON l.id = r.location_id
       LEFT JOIN locations lp ON lp.id = l.parent_id
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
  const allowed = [
    'name', 'category_id', 'quantity', 'unit', 'location', 'cas_number',
    'notes', 'min_quantity', 'barcode', 'supplier', 'estado_actual',
    'grado', 'numero', 'inventory_status', 'location_id',
    'date_acquired', 'comments', 'almacenamiento_requerido', 'clase_quimica',
    'disposicion_residuos', 'estado_fisico', 'modelacion', 'polaridad',
    'hazard_codes', 'ghs_signal_word',
  ];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

  const nullableFields = new Set(['category_id', 'location_id', 'min_quantity']);
  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f =>
    req.body[f] === '' && nullableFields.has(f) ? null : req.body[f]
  );

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
