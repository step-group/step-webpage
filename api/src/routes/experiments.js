const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── LIST ────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { status, tag, search, archived } = req.query;
  const showArchived = archived === 'true';

  let query = `
    SELECT e.id, e.title, e.status, e.date, e.tags, e.state, e.created_at, e.updated_at,
           u.name AS created_by_name,
           (SELECT COUNT(*) FROM experiment_steps s WHERE s.experiment_id = e.id) AS steps_total,
           (SELECT COUNT(*) FROM experiment_steps s WHERE s.experiment_id = e.id AND s.finished = true) AS steps_done
    FROM experiments e
    LEFT JOIN users u ON u.id = e.created_by
    WHERE e.state = $1
  `;
  const params = [showArchived ? 'archived' : 'normal'];
  let idx = 2;

  if (status) { query += ` AND e.status = $${idx++}`; params.push(status); }
  if (tag)    { query += ` AND $${idx++} = ANY(e.tags)`; params.push(tag); }
  if (search) { query += ` AND e.title ILIKE $${idx++}`; params.push(`%${search}%`); }

  query += ' ORDER BY e.updated_at DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener experimentos' });
  }
});

// ── CREATE ───────────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { title, body = '', status = 'running', date, tags = [], template_id } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es requerido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const expDate = date || new Date().toISOString().slice(0, 10);
    const result = await client.query(
      `INSERT INTO experiments (title, body, status, date, tags, template_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, body, status, expDate, tags, template_id || null, req.user.id]
    );
    const experiment = result.rows[0];

    // Copy steps from template if provided
    if (template_id) {
      const tmplSteps = await client.query(
        'SELECT body, ordering FROM template_steps WHERE template_id = $1 ORDER BY ordering',
        [template_id]
      );
      for (const step of tmplSteps.rows) {
        await client.query(
          'INSERT INTO experiment_steps (experiment_id, body, ordering) VALUES ($1, $2, $3)',
          [experiment.id, step.body, step.ordering]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(experiment);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al crear experimento' });
  } finally {
    client.release();
  }
});

// ── GET ONE ──────────────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const exp = await pool.query(
      `SELECT e.*, u.name AS created_by_name, t.title AS template_title
       FROM experiments e
       LEFT JOIN users u ON u.id = e.created_by
       LEFT JOIN experiment_templates t ON t.id = e.template_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!exp.rows[0]) return res.status(404).json({ error: 'Experimento no encontrado' });

    const steps = await pool.query(
      'SELECT * FROM experiment_steps WHERE experiment_id = $1 ORDER BY ordering, id',
      [req.params.id]
    );
    const comments = await pool.query(
      `SELECT c.*, u.name AS created_by_name
       FROM experiment_comments c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.experiment_id = $1 ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    const links = await pool.query(
      `SELECT r.id, r.name, r.quantity, r.unit, r.location,
              rc.name AS category_name, rc.color AS category_color
       FROM exp_resource_links l
       JOIN resources r ON r.id = l.resource_id
       LEFT JOIN resource_categories rc ON rc.id = r.category_id
       WHERE l.experiment_id = $1`,
      [req.params.id]
    );

    res.json({
      ...exp.rows[0],
      steps: steps.rows,
      comments: comments.rows,
      resource_links: links.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener experimento' });
  }
});

// ── UPDATE ───────────────────────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  const allowed = ['title', 'body', 'status', 'date', 'tags'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin campos válidos para actualizar' });

  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => req.body[f]);

  try {
    const result = await pool.query(
      `UPDATE experiments SET ${sets} WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Experimento no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar experimento' });
  }
});

// ── ARCHIVE (soft delete) ────────────────────────────────────────────────────
router.patch('/:id/archive', requireAdmin, async (req, res) => {
  const { state } = req.body;
  if (!['normal', 'archived'].includes(state)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  try {
    const result = await pool.query(
      'UPDATE experiments SET state = $1 WHERE id = $2 RETURNING *',
      [state, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Experimento no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al archivar experimento' });
  }
});

// ── STEPS ────────────────────────────────────────────────────────────────────
router.post('/:id/steps', requireAuth, async (req, res) => {
  const { body, ordering = 0 } = req.body;
  if (!body) return res.status(400).json({ error: 'El cuerpo del paso es requerido' });
  try {
    const result = await pool.query(
      'INSERT INTO experiment_steps (experiment_id, body, ordering) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, body, ordering]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear paso' });
  }
});

router.patch('/:id/steps/:stepId', requireAuth, async (req, res) => {
  const { body, ordering, finished } = req.body;
  const updates = [];
  const values = [];
  let idx = 1;

  if (body      !== undefined) { updates.push(`body = $${idx++}`);      values.push(body); }
  if (ordering  !== undefined) { updates.push(`ordering = $${idx++}`);  values.push(ordering); }
  if (finished  !== undefined) {
    updates.push(`finished = $${idx++}`); values.push(finished);
    updates.push(`finished_at = $${idx++}`); values.push(finished ? new Date() : null);
  }
  if (!updates.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

  try {
    const result = await pool.query(
      `UPDATE experiment_steps SET ${updates.join(', ')} WHERE id = $${idx} AND experiment_id = $${idx + 1} RETURNING *`,
      [...values, req.params.stepId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Paso no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar paso' });
  }
});

router.delete('/:id/steps/:stepId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM experiment_steps WHERE id = $1 AND experiment_id = $2',
      [req.params.stepId, req.params.id]
    );
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar paso' });
  }
});

// ── COMMENTS ─────────────────────────────────────────────────────────────────
router.post('/:id/comments', requireAuth, async (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'El comentario no puede estar vacío' });
  try {
    const result = await pool.query(
      `INSERT INTO experiment_comments (experiment_id, body, created_by) VALUES ($1, $2, $3)
       RETURNING *, (SELECT name FROM users WHERE id = $3) AS created_by_name`,
      [req.params.id, body, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
});

router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const comment = await pool.query(
      'SELECT created_by FROM experiment_comments WHERE id = $1 AND experiment_id = $2',
      [req.params.commentId, req.params.id]
    );
    if (!comment.rows[0]) return res.status(404).json({ error: 'Comentario no encontrado' });
    if (comment.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sin permiso para eliminar este comentario' });
    }
    await pool.query('DELETE FROM experiment_comments WHERE id = $1', [req.params.commentId]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar comentario' });
  }
});

// ── RESOURCE LINKS ────────────────────────────────────────────────────────────
router.post('/:id/links', requireAuth, async (req, res) => {
  const { resource_id } = req.body;
  if (!resource_id) return res.status(400).json({ error: 'resource_id requerido' });
  try {
    await pool.query(
      'INSERT INTO exp_resource_links (experiment_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, resource_id]
    );
    res.status(201).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al vincular recurso' });
  }
});

router.delete('/:id/links/:resourceId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM exp_resource_links WHERE experiment_id = $1 AND resource_id = $2',
      [req.params.id, req.params.resourceId]
    );
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al desvincular recurso' });
  }
});

module.exports = router;
