const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.tags, t.created_at, t.updated_at,
              u.name AS created_by_name,
              COUNT(s.id) AS steps_count
       FROM experiment_templates t
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN template_steps s ON s.template_id = t.id
       GROUP BY t.id, u.name
       ORDER BY t.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { title, body = '', tags = [], steps = [] } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es requerido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO experiment_templates (title, body, tags, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, body, tags, req.user.id]
    );
    const template = result.rows[0];

    for (let i = 0; i < steps.length; i++) {
      await client.query(
        'INSERT INTO template_steps (template_id, body, ordering) VALUES ($1, $2, $3)',
        [template.id, steps[i].body, i]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(template);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al crear plantilla' });
  } finally {
    client.release();
  }
});

// ── GET ONE ───────────────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const tmpl = await pool.query(
      `SELECT t.*, u.name AS created_by_name
       FROM experiment_templates t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!tmpl.rows[0]) return res.status(404).json({ error: 'Plantilla no encontrada' });

    const steps = await pool.query(
      'SELECT * FROM template_steps WHERE template_id = $1 ORDER BY ordering, id',
      [req.params.id]
    );
    res.json({ ...tmpl.rows[0], steps: steps.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  const { title, body, tags } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const allowed = [];
    const values = [];
    let idx = 1;
    if (title !== undefined) { allowed.push(`title = $${idx++}`); values.push(title); }
    if (body  !== undefined) { allowed.push(`body = $${idx++}`);  values.push(body); }
    if (tags  !== undefined) { allowed.push(`tags = $${idx++}`);  values.push(tags); }

    let template;
    if (allowed.length) {
      const result = await client.query(
        `UPDATE experiment_templates SET ${allowed.join(', ')} WHERE id = $${idx} RETURNING *`,
        [...values, req.params.id]
      );
      if (!result.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Plantilla no encontrada' }); }
      template = result.rows[0];
    }

    // Replace steps if provided
    if (req.body.steps !== undefined) {
      await client.query('DELETE FROM template_steps WHERE template_id = $1', [req.params.id]);
      for (let i = 0; i < req.body.steps.length; i++) {
        await client.query(
          'INSERT INTO template_steps (template_id, body, ordering) VALUES ($1, $2, $3)',
          [req.params.id, req.body.steps[i].body, i]
        );
      }
    }

    await client.query('COMMIT');
    res.json(template || { id: req.params.id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar plantilla' });
  } finally {
    client.release();
  }
});

// ── DELETE (admin only) ───────────────────────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM experiment_templates WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
});

module.exports = router;
