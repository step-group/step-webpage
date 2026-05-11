const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── DATASETS under an experiment ─────────────────────────────────────────────

// GET /api/experiments/:expId/datasets
router.get('/experiments/:expId/datasets', requireAuth, async (req, res) => {
  try {
    const datasets = await pool.query(
      `SELECT d.*, u.name AS created_by_name,
              COUNT(p.id) AS point_count
       FROM datasets d
       LEFT JOIN users u ON u.id = d.created_by
       LEFT JOIN dataset_points p ON p.dataset_id = d.id
       WHERE d.experiment_id = $1
       GROUP BY d.id, u.name
       ORDER BY d.created_at ASC`,
      [req.params.expId]
    );
    res.json(datasets.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener datasets' });
  }
});

// POST /api/experiments/:expId/datasets
router.post('/experiments/:expId/datasets', requireAuth, async (req, res) => {
  const { title, equipment = '', calibration_notes = '', compounds = [] } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es requerido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO datasets (experiment_id, title, equipment, calibration_notes, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.expId, title, equipment, calibration_notes, req.user.id]
    );
    const dataset = result.rows[0];

    for (const c of compounds) {
      if (!c.name || !c.compound_index) continue;
      await client.query(
        `INSERT INTO dataset_compounds (dataset_id, compound_index, name, cas_number, purity, purity_unit, supplier)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [dataset.id, c.compound_index, c.name, c.cas_number || '', c.purity || null, c.purity_unit || 'mol%', c.supplier || '']
      );
    }

    await client.query('COMMIT');
    res.status(201).json(dataset);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al crear dataset' });
  } finally {
    client.release();
  }
});

// ── SINGLE DATASET ────────────────────────────────────────────────────────────

// GET /api/datasets/:id
router.get('/datasets/:id', requireAuth, async (req, res) => {
  try {
    const ds = await pool.query(
      `SELECT d.*, u.name AS created_by_name
       FROM datasets d
       LEFT JOIN users u ON u.id = d.created_by
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!ds.rows[0]) return res.status(404).json({ error: 'Dataset no encontrado' });

    const compounds = await pool.query(
      'SELECT * FROM dataset_compounds WHERE dataset_id = $1 ORDER BY compound_index',
      [req.params.id]
    );
    const points = await pool.query(
      'SELECT * FROM dataset_points WHERE dataset_id = $1 ORDER BY ordering, id',
      [req.params.id]
    );

    res.json({ ...ds.rows[0], compounds: compounds.rows, points: points.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener dataset' });
  }
});

// PATCH /api/datasets/:id — actualizar metadatos
router.patch('/datasets/:id', requireAuth, async (req, res) => {
  const allowed = ['title', 'equipment', 'calibration_notes'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => req.body[f]);

  try {
    const result = await pool.query(
      `UPDATE datasets SET ${sets} WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Dataset no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar dataset' });
  }
});

// DELETE /api/datasets/:id
router.delete('/datasets/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM datasets WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar dataset' });
  }
});

// ── POINTS ────────────────────────────────────────────────────────────────────

// POST /api/datasets/:id/points
router.post('/datasets/:id/points', requireAuth, async (req, res) => {
  const {
    temperature_k, pressure_kpa = 101.325, mole_fraction_1,
    density_kg_m3, u_density, u_temperature, u_pressure,
    phase = 'liquid', notes = '', ordering = 0,
  } = req.body;

  if (temperature_k == null || density_kg_m3 == null) {
    return res.status(400).json({ error: 'Temperatura y densidad son requeridas' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO dataset_points
         (dataset_id, temperature_k, pressure_kpa, mole_fraction_1,
          density_kg_m3, u_density, u_temperature, u_pressure, phase, notes, ordering)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.params.id, temperature_k, pressure_kpa,
       mole_fraction_1 != null ? mole_fraction_1 : null,
       density_kg_m3,
       u_density || null, u_temperature || null, u_pressure || null,
       phase, notes, ordering]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar punto' });
  }
});

// PATCH /api/datasets/:id/points/:pointId
router.patch('/datasets/:id/points/:pointId', requireAuth, async (req, res) => {
  const allowed = ['temperature_k','pressure_kpa','mole_fraction_1','density_kg_m3',
                   'u_density','u_temperature','u_pressure','phase','notes','ordering'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

  const sets = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const values = fields.map(f => req.body[f] === '' ? null : req.body[f]);

  try {
    const result = await pool.query(
      `UPDATE dataset_points SET ${sets} WHERE id = $1 AND dataset_id = $2 RETURNING *`,
      [req.params.pointId, req.params.id, ...values]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Punto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar punto' });
  }
});

// DELETE /api/datasets/:id/points/:pointId
router.delete('/datasets/:id/points/:pointId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM dataset_points WHERE id = $1 AND dataset_id = $2',
      [req.params.pointId, req.params.id]
    );
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar punto' });
  }
});

module.exports = router;
