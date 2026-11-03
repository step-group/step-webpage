const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register — solicitar acceso al lab
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Este email ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, status',
      [email, password_hash, name]
    );

    res.status(201).json({
      message: 'Solicitud enviada. Un administrador debe aprobar tu cuenta.',
      user: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, name, role, status, password_hash FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Tu solicitud fue rechazada' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// PATCH /api/auth/profile — editar nombre y/o contraseña
router.patch('/profile', requireAuth, async (req, res) => {
  const { name, current_password, new_password } = req.body;

  try {
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const updates = [];
    const values  = [];
    let idx = 1;

    if (name?.trim()) {
      updates.push(`name = $${idx++}`);
      values.push(name.trim());
    }

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'Debes ingresar tu contraseña actual' });
      }
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      if (new_password.length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
      }
      const hash = await bcrypt.hash(new_password, 12);
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    if (!updates.length) return res.status(400).json({ error: 'Sin cambios para guardar' });

    const updated = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role`,
      [...values, req.user.id]
    );

    const newToken = jwt.sign(
      { id: updated.rows[0].id, email: updated.rows[0].email, name: updated.rows[0].name, role: updated.rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ user: updated.rows[0], token: newToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// GET /api/auth/activity — experiments, datasets, publications for the logged-in user
router.get('/activity', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const [expsRes, datasetsRes, pubsRes] = await Promise.all([
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
          COUNT(dr.id)::int AS row_count
        FROM datasets d
        JOIN experiments e ON e.id = d.experiment_id
        LEFT JOIN dataset_rows dr ON dr.dataset_id = d.id
        WHERE d.created_by = $1
        GROUP BY d.id, e.id, e.title
        ORDER BY d.created_at DESC
      `, [userId]),
      pool.query(`
        SELECT id, title, status, created_at FROM publications WHERE created_by = $1 ORDER BY created_at DESC
      `, [userId]),
    ]);
    res.json({
      experiments:  expsRes.rows,
      datasets:     datasetsRes.rows,
      publications: pubsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener actividad' });
  }
});

// GET /api/auth/me — usuario actual
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, status, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

module.exports = router;
