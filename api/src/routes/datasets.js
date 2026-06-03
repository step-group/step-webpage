const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── DATASETS under an experiment ─────────────────────────────────────────────

// GET /api/experiments/:expId/datasets
router.get('/experiments/:expId/datasets', requireAuth, async (req, res) => {
  try {
    const datasets = await pool.query(
      `SELECT d.*, u.name AS created_by_name,
              COUNT(r.id) AS row_count
       FROM datasets d
       LEFT JOIN users u ON u.id = d.created_by
       LEFT JOIN dataset_rows r ON r.dataset_id = d.id
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
      if (!c.compound_index) continue;

      let name = c.name, cas = c.cas_number || '', supplier = c.supplier || '', grade = c.grade || '';

      if (c.resource_id) {
        const rRes = await client.query(
          'SELECT name, cas_number, supplier, grado FROM resources WHERE id = $1',
          [c.resource_id]
        );
        if (rRes.rows[0]) {
          const r = rRes.rows[0];
          name     = r.name;
          cas      = r.cas_number || '';
          supplier = r.supplier   || '';
          grade    = r.grado      || '';
        }
      }

      if (!name) continue;

      await client.query(
        `INSERT INTO dataset_compounds
           (dataset_id, compound_index, name, cas_number, purity, purity_unit, supplier, resource_id, grade)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [dataset.id, c.compound_index, name, cas, c.purity || null, c.purity_unit || 'mol%', supplier, c.resource_id || null, grade]
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
    const columns = await pool.query(
      'SELECT * FROM dataset_columns WHERE dataset_id = $1 ORDER BY ordering, id',
      [req.params.id]
    );
    const rows = await pool.query(
      'SELECT * FROM dataset_rows WHERE dataset_id = $1 ORDER BY ordering, id',
      [req.params.id]
    );

    res.json({ ...ds.rows[0], compounds: compounds.rows, columns: columns.rows, rows: rows.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener dataset' });
  }
});

// POST /api/datasets/:id/compounds
router.post('/datasets/:id/compounds', requireAuth, async (req, res) => {
  const { compounds = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM dataset_compounds WHERE dataset_id = $1', [req.params.id]);

    for (const c of compounds) {
      if (!c.compound_index) continue;
      let name = c.name || '', cas = c.cas_number || '', supplier = c.supplier || '', grade = c.grade || '';

      if (c.resource_id) {
        const rRes = await client.query(
          'SELECT name, cas_number, supplier, grado FROM resources WHERE id = $1',
          [c.resource_id]
        );
        if (rRes.rows[0]) {
          const r = rRes.rows[0];
          name = r.name; cas = r.cas_number || ''; supplier = r.supplier || ''; grade = r.grado || '';
        }
      }

      if (!name) continue;
      await client.query(
        `INSERT INTO dataset_compounds
           (dataset_id, compound_index, name, cas_number, purity, purity_unit, supplier, resource_id, grade)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [req.params.id, c.compound_index, name, cas, c.purity || null, c.purity_unit || 'mol%', supplier, c.resource_id || null, grade]
      );
    }

    await client.query('COMMIT');
    const updated = await pool.query(
      'SELECT * FROM dataset_compounds WHERE dataset_id = $1 ORDER BY compound_index',
      [req.params.id]
    );
    res.json(updated.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al configurar compuestos' });
  } finally {
    client.release();
  }
});

// PATCH /api/datasets/:id
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

// ── COLUMNS ───────────────────────────────────────────────────────────────────

// PATCH /api/datasets/:id/columns
router.patch('/datasets/:id/columns', requireAuth, async (req, res) => {
  const { columns = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM dataset_columns WHERE dataset_id = $1', [req.params.id]);
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      if (!c.name?.trim()) continue;
      await client.query(
        'INSERT INTO dataset_columns (dataset_id, name, unit, ordering) VALUES ($1, $2, $3, $4)',
        [req.params.id, c.name.trim(), c.unit || '', i]
      );
    }
    await client.query('COMMIT');
    const updated = await pool.query(
      'SELECT * FROM dataset_columns WHERE dataset_id = $1 ORDER BY ordering',
      [req.params.id]
    );
    res.json(updated.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar columnas' });
  } finally {
    client.release();
  }
});

// ── ROWS ──────────────────────────────────────────────────────────────────────

// POST /api/datasets/:id/rows
router.post('/datasets/:id/rows', requireAuth, async (req, res) => {
  const { data = {}, ordering = 0 } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO dataset_rows (dataset_id, data, ordering) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, JSON.stringify(data), ordering]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar fila' });
  }
});

// DELETE /api/datasets/:id/rows/:rowId
router.delete('/datasets/:id/rows/:rowId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM dataset_rows WHERE id = $1 AND dataset_id = $2',
      [req.params.rowId, req.params.id]
    );
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar fila' });
  }
});

// ── EXCEL EXPORT ──────────────────────────────────────────────────────────────

// GET /api/datasets/:id/export
router.get('/datasets/:id/export', requireAuth, async (req, res) => {
  try {
    const dsRes = await pool.query('SELECT title FROM datasets WHERE id = $1', [req.params.id]);
    if (!dsRes.rows[0]) return res.status(404).json({ error: 'Dataset no encontrado' });

    const colsRes = await pool.query(
      'SELECT name, unit FROM dataset_columns WHERE dataset_id = $1 ORDER BY ordering, id',
      [req.params.id]
    );
    if (!colsRes.rows.length) return res.status(400).json({ error: 'El dataset no tiene columnas definidas' });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Datos');

    const headers = colsRes.rows.map(c => c.unit ? `${c.name} (${c.unit})` : c.name);

    ws.columns = headers.map((h, i) => ({
      header: h,
      key: String(i),
      width: Math.max(14, h.length + 2),
    }));

    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    });

    const safeName = dsRes.rows[0].title.replace(/[^a-z0-9\-_\s]/gi, '_').trim() || `dataset-${req.params.id}`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar Excel' });
  }
});

// ── EXCEL IMPORT ──────────────────────────────────────────────────────────────

// POST /api/datasets/:id/import
router.post('/datasets/:id/import', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  try {
    const colsRes = await pool.query(
      'SELECT name, unit FROM dataset_columns WHERE dataset_id = $1 ORDER BY ordering, id',
      [req.params.id]
    );
    if (!colsRes.rows.length) return res.status(400).json({ error: 'El dataset no tiene columnas definidas' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'El archivo no contiene hojas' });

    // Map column index → column name from header row
    const headerMap = {};
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell, colIdx) => {
      const text = String(cell.value ?? '').trim();
      const match = colsRes.rows.find(c => {
        const full = c.unit ? `${c.name} (${c.unit})` : c.name;
        return text === full || text === c.name;
      });
      if (match) headerMap[colIdx] = match.name;
    });

    if (!Object.keys(headerMap).length) {
      return res.status(400).json({ error: 'Ninguna columna del archivo coincide con las columnas del dataset' });
    }

    // Collect data rows
    const dataRows = [];
    ws.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return;
      const data = {};
      row.eachCell((cell, colIdx) => {
        const colName = headerMap[colIdx];
        if (!colName) return;
        let val = cell.value;
        if (val === null || val === undefined || val === '') return;
        if (typeof val === 'object' && 'result' in val) val = val.result;
        if (typeof val === 'object' && val instanceof Date) val = val.toISOString();
        data[colName] = val;
      });
      if (Object.keys(data).length > 0) dataRows.push(data);
    });

    if (!dataRows.length) return res.status(400).json({ error: 'No se encontraron datos en el archivo' });

    const countRes = await pool.query(
      'SELECT COUNT(*) FROM dataset_rows WHERE dataset_id = $1',
      [req.params.id]
    );
    let offset = Number(countRes.rows[0].count);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const data of dataRows) {
        await client.query(
          'INSERT INTO dataset_rows (dataset_id, data, ordering) VALUES ($1, $2, $3)',
          [req.params.id, JSON.stringify(data), offset++]
        );
      }
      await client.query('COMMIT');
      res.json({ imported: dataRows.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar datos' });
  }
});

module.exports = router;
