const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/pending-count — número de solicitudes pendientes
router.get('/pending-count', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'pending'");
    res.json({ count: Number(result.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener conteo' });
  }
});

// GET /api/admin/users — listar todos los usuarios
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, status, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// PATCH /api/admin/users/:id/status — aprobar o rechazar usuario
router.patch('/users/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido. Usa "approved" o "rejected"' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, email, name, role, status',
      [status, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// PATCH /api/admin/users/:id/role — cambiar rol
router.patch('/users/:id/role', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido. Usa "admin" o "member"' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role, status',
      [role, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});

// GET /api/admin/users/:id/activity — experiments, datasets, publications for a user
router.get('/users/:id/activity', requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  try {
    const [userRes, expsRes, datasetsRes, pubsRes] = await Promise.all([
      pool.query('SELECT id, name, email, role, status, created_at FROM users WHERE id = $1', [userId]),
      pool.query(`
        SELECT e.id, e.title, e.status, e.date, e.state, e.created_at, e.updated_at,
          COUNT(DISTINCT d.id)::int                                     AS dataset_count,
          COUNT(DISTINCT s.id)::int                                     AS steps_total,
          COUNT(DISTINCT s.id) FILTER (WHERE s.finished = true)::int   AS steps_done
        FROM experiments e
        LEFT JOIN datasets d ON d.experiment_id = e.id
        LEFT JOIN experiment_steps s ON s.experiment_id = e.id
        WHERE e.created_by = $1
        GROUP BY e.id
        ORDER BY e.updated_at DESC
      `, [userId]),
      pool.query(`
        SELECT d.id, d.title, d.equipment, d.created_at,
          e.id AS experiment_id, e.title AS experiment_title,
          COUNT(dp.id)::int AS point_count
        FROM datasets d
        JOIN experiments e ON e.id = d.experiment_id
        LEFT JOIN dataset_points dp ON dp.dataset_id = d.id
        WHERE d.created_by = $1
        GROUP BY d.id, e.id, e.title
        ORDER BY d.created_at DESC
      `, [userId]),
      pool.query(`
        SELECT id, title, status, created_at FROM publications WHERE created_by = $1 ORDER BY created_at DESC
      `, [userId]),
    ]);
    if (!userRes.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({
      user:         userRes.rows[0],
      experiments:  expsRes.rows,
      datasets:     datasetsRes.rows,
      publications: pubsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener actividad' });
  }
});

module.exports = router;
