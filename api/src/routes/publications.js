const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { status, search } = req.query;
  let query = `
    SELECT p.id, p.title, p.authors, p.journal, p.year, p.doi, p.status,
           p.created_at, p.updated_at, u.name AS created_by_name,
           COUNT(pd.id) AS dataset_count
    FROM publications p
    LEFT JOIN users u ON u.id = p.created_by
    LEFT JOIN publication_datasets pd ON pd.publication_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (status) { query += ` AND p.status = $${idx++}`; params.push(status); }
  if (search) { query += ` AND (p.title ILIKE $${idx} OR p.authors ILIKE $${idx++})`; params.push(`%${search}%`); }
  query += ' GROUP BY p.id, u.name ORDER BY p.updated_at DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { title, authors = '', journal = '', year, doi = '', abstract = '', status = 'draft' } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es requerido' });
  try {
    const result = await pool.query(
      `INSERT INTO publications (title, authors, journal, year, doi, abstract, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, authors, journal, year || null, doi, abstract, status, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear publicación' });
  }
});

// ── WOS SEARCH ────────────────────────────────────────────────────────────────
const WOS_AUTHORS = [
  'Canales, Roberto',
  'Gajardo-Parra, Nicolas',
  'Cea-Klapp, Esteban',
];

router.get('/wos', requireAuth, async (req, res) => {
  const apiKey = process.env.WOS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'WOS_API_KEY no configurada en el servidor' });

  try {
    const responses = await Promise.all(WOS_AUTHORS.map(author => {
      const q = encodeURIComponent(`AU=${author}`);
      return fetch(
        `https://api.clarivate.com/apis/wos-starter/v1/documents?q=${q}&limit=50&db=WOS`,
        { headers: { 'X-ApiKey': apiKey } }
      ).then(r => {
        if (!r.ok) throw new Error(`WOS ${r.status} para autor "${author}"`);
        return r.json();
      });
    }));

    // Deduplicate by UID
    const seen = new Set();
    const hits = responses.flatMap(r => r.hits || []).filter(h => {
      if (seen.has(h.uid)) return false;
      seen.add(h.uid);
      return true;
    });

    // Check which DOIs already exist
    const dois = hits.map(h => h.identifiers?.doi).filter(Boolean);
    const existingRows = dois.length
      ? (await pool.query('SELECT doi FROM publications WHERE doi = ANY($1)', [dois])).rows
      : [];
    const existingDois = new Set(existingRows.map(r => r.doi));

    res.json(hits.map(h => ({
      uid:              h.uid,
      title:            h.title || '(sin título)',
      authors:          (h.names?.authors || []).map(a => a.displayName).join('; '),
      journal:          h.source?.sourceTitle || '',
      year:             h.source?.publishYear || null,
      doi:              h.identifiers?.doi || '',
      already_imported: existingDois.has(h.identifiers?.doi),
    })).sort((a, b) => (b.year || 0) - (a.year || 0)));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// ── WOS IMPORT ────────────────────────────────────────────────────────────────
router.post('/wos-import', requireAuth, async (req, res) => {
  const { title, authors, journal, year, doi } = req.body;
  if (!title) return res.status(400).json({ error: 'Título requerido' });

  try {
    if (doi) {
      const dup = await pool.query('SELECT id FROM publications WHERE doi = $1', [doi]);
      if (dup.rows[0]) return res.status(409).json({ error: 'Ya existe una publicación con este DOI', id: dup.rows[0].id });
    }
    const result = await pool.query(
      `INSERT INTO publications (title, authors, journal, year, doi, abstract, status, created_by)
       VALUES ($1,$2,$3,$4,$5,'','published',$6) RETURNING *`,
      [title, authors || '', journal || '', year || null, doi || '', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar publicación' });
  }
});

// ── GET ONE ───────────────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const pub = await pool.query(
      `SELECT p.*, u.name AS created_by_name
       FROM publications p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!pub.rows[0]) return res.status(404).json({ error: 'Publicación no encontrada' });

    const datasets = await pool.query(
      `SELECT d.id, d.title, d.equipment, e.id AS experiment_id, e.title AS experiment_title,
              COUNT(dp.id) AS point_count,
              json_agg(json_build_object('compound_index', dc.compound_index, 'name', dc.name, 'cas_number', dc.cas_number)
                ORDER BY dc.compound_index) AS compounds
       FROM publication_datasets pd
       JOIN datasets d ON d.id = pd.dataset_id
       JOIN experiments e ON e.id = d.experiment_id
       LEFT JOIN dataset_points dp ON dp.dataset_id = d.id
       LEFT JOIN dataset_compounds dc ON dc.dataset_id = d.id
       WHERE pd.publication_id = $1
       GROUP BY d.id, e.id
       ORDER BY d.created_at`,
      [req.params.id]
    );

    res.json({ ...pub.rows[0], datasets: datasets.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener publicación' });
  }
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  const allowed = ['title','authors','journal','year','doi','abstract','status'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'Sin campos para actualizar' });

  const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => req.body[f] === '' ? null : req.body[f]);
  try {
    const result = await pool.query(
      `UPDATE publications SET ${sets} WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Publicación no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar publicación' });
  }
});

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM publications WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar publicación' });
  }
});

// ── DATASET LINKS ─────────────────────────────────────────────────────────────
router.post('/:id/datasets', requireAuth, async (req, res) => {
  const { dataset_id } = req.body;
  if (!dataset_id) return res.status(400).json({ error: 'dataset_id requerido' });
  try {
    await pool.query(
      'INSERT INTO publication_datasets (publication_id, dataset_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, dataset_id]
    );
    res.status(201).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al vincular dataset' });
  }
});

router.delete('/:id/datasets/:datasetId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM publication_datasets WHERE publication_id=$1 AND dataset_id=$2',
      [req.params.id, req.params.datasetId]
    );
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al desvincular dataset' });
  }
});

// ── ALL DATASETS (for link picker) ────────────────────────────────────────────
router.get('/:id/available-datasets', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.title, d.equipment, e.title AS experiment_title,
              COUNT(dp.id) AS point_count,
              json_agg(json_build_object('name', dc.name) ORDER BY dc.compound_index) AS compounds
       FROM datasets d
       JOIN experiments e ON e.id = d.experiment_id
       LEFT JOIN dataset_points dp ON dp.dataset_id = d.id
       LEFT JOIN dataset_compounds dc ON dc.dataset_id = d.id
       WHERE d.id NOT IN (
         SELECT dataset_id FROM publication_datasets WHERE publication_id = $1
       )
       GROUP BY d.id, e.title
       ORDER BY e.title, d.title`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener datasets disponibles' });
  }
});

module.exports = router;
