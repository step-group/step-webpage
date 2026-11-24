const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const RESERVATION_COLUMNS = 'id, equipment_id, user_id, title, notes, starts_at, ends_at, status';

// A member's booking longer than this many hours waits for an admin to approve it.
const MAX_AUTO_HOURS = 48;

// Status a booking gets from its length and who is making it (admins are never held back).
function statusFor(starts, ends, isAdmin) {
  if (isAdmin) return 'confirmed';
  return (ends - starts) / 3600000 > MAX_AUTO_HOURS ? 'pending' : 'confirmed';
}

// Parses starts_at / ends_at from a request body (or a stored row for partial updates).
// Returns { starts, ends } as Dates, or { error } with a Spanish message.
function parseRange({ starts_at, ends_at }) {
  if (!starts_at || !ends_at) return { error: 'Inicio y término son requeridos' };
  const starts = new Date(starts_at);
  const ends = new Date(ends_at);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    return { error: 'Fechas inválidas' };
  }
  if (ends <= starts) return { error: 'El término debe ser posterior al inicio' };
  return { starts, ends };
}

// Back-to-back is allowed: a block conflicts only if it starts before the other ends
// AND ends after the other starts.
async function findConflict(client, equipmentId, starts, ends, ignoreId = null) {
  const { rows } = await client.query(
    `SELECT r.starts_at, r.ends_at, u.name AS user_name
     FROM reservations r
     JOIN users u ON u.id = r.user_id
     WHERE r.equipment_id = $1
       AND r.status IN ('confirmed', 'pending')
       AND r.starts_at < $3 AND r.ends_at > $2
       AND ($4::int IS NULL OR r.id <> $4)
     ORDER BY r.starts_at
     LIMIT 1`,
    [equipmentId, starts, ends, ignoreId]
  );
  return rows[0] || null;
}

function conflictMessage(c) {
  const fmt = (d) => d.toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' });
  return `Ya está reservado por ${c.user_name} (${fmt(c.starts_at)} – ${fmt(c.ends_at)})`;
}

// ── EQUIPMENT: LIST ───────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  // ?archived=true lists archived equipment so an admin can restore it.
  const archived = req.query.archived === 'true';
  if (archived && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Se requieren permisos de administrador' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, location FROM equipment WHERE ${archived ? 'NOT active' : 'active'} ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener equipos' });
  }
});

// ── EQUIPMENT: CREATE ─────────────────────────────────────────────────────────
router.post('/', requireAdmin, async (req, res) => {
  const { name, description = '', location = '' } = req.body;
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO equipment (name, description, location, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id, name, description, location, active`,
      [name.trim(), description, location, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el equipo' });
  }
});

// ── EQUIPMENT: UPDATE / ARCHIVE ───────────────────────────────────────────────
router.patch('/:id', requireAdmin, async (req, res) => {
  const { name, description, location, active } = req.body;
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE equipment SET
         name        = COALESCE($2, name),
         description = COALESCE($3, description),
         location    = COALESCE($4, location),
         active      = COALESCE($5, active)
       WHERE id = $1
       RETURNING id, name, description, location, active`,
      [req.params.id, name?.trim(), description, location, active]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el equipo' });
  }
});

// ── RESERVATIONS: PENDING APPROVAL (admin) ────────────────────────────────────
router.get('/reservations/pending', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.equipment_id, e.name AS equipment_name, r.user_id, u.name AS user_name,
              r.title, r.notes, r.starts_at, r.ends_at
       FROM reservations r
       JOIN equipment e ON e.id = r.equipment_id
       JOIN users u ON u.id = r.user_id
       WHERE r.status = 'pending'
       ORDER BY r.starts_at`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener solicitudes pendientes' });
  }
});

// Approve / reject a pending booking. 404 if unknown, 409 if it is no longer pending.
// The body may carry the starts_at / ends_at the admin was looking at; if the booking's
// times have changed since, the decision is refused (409) so nobody approves dates they never saw.
async function decideReservation(req, res, status) {
  const note = status === 'rejected' && typeof req.body.note === 'string' ? req.body.note.trim() : '';
  const expectStart = req.body.starts_at ? new Date(req.body.starts_at) : null;
  const expectEnd = req.body.ends_at ? new Date(req.body.ends_at) : null;
  if ((expectStart && Number.isNaN(expectStart.getTime())) || (expectEnd && Number.isNaN(expectEnd.getTime()))) {
    return res.status(400).json({ error: 'Fechas inválidas' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE reservations
         SET status = $2, decided_by = $3, decided_at = NOW(), decision_note = $4
       WHERE id = $1 AND status = 'pending'
         AND ($5::timestamptz IS NULL OR starts_at = $5)
         AND ($6::timestamptz IS NULL OR ends_at = $6)
       RETURNING ${RESERVATION_COLUMNS}`,
      [req.params.rid, status, req.user.id, note, expectStart, expectEnd]
    );
    if (rows[0]) return res.json(rows[0]);
    const exists = await pool.query('SELECT 1 FROM reservations WHERE id = $1', [req.params.rid]);
    if (!exists.rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });
    res.status(409).json({ error: 'La solicitud cambió o ya no está pendiente. Revisa la lista.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
}

router.post('/reservations/:rid/approve', requireAdmin, (req, res) => decideReservation(req, res, 'confirmed'));
router.post('/reservations/:rid/reject',  requireAdmin, (req, res) => decideReservation(req, res, 'rejected'));

// ── RESERVATIONS: LIST (overlapping a date range) ─────────────────────────────
router.get('/:id/reservations', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const range = parseRange({ starts_at: from, ends_at: to });
  if (range.error) return res.status(400).json({ error: range.error });
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.equipment_id, r.user_id, u.name AS user_name,
              r.title, r.notes, r.starts_at, r.ends_at, r.status
       FROM reservations r
       JOIN users u ON u.id = r.user_id
       WHERE r.equipment_id = $1 AND r.status IN ('confirmed', 'pending')
         AND r.starts_at < $3 AND r.ends_at > $2
       ORDER BY r.starts_at`,
      [req.params.id, range.starts, range.ends]
    );
    // External users see who booked and when, but not other people's notes.
    const hideOthersNotes = req.user.role === 'external';
    res.json(hideOthersNotes
      ? rows.map(r => (r.user_id === req.user.id ? r : { ...r, notes: '' }))
      : rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

// ── RESERVATIONS: CREATE ──────────────────────────────────────────────────────
router.post('/:id/reservations', requireAuth, async (req, res) => {
  const { title, notes = '' } = req.body;
  if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'El título es requerido' });
  const range = parseRange(req.body);
  if (range.error) return res.status(400).json({ error: range.error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Locking the equipment row serializes concurrent bookings of the same equipment.
    const lock = await client.query('SELECT id FROM equipment WHERE id = $1 AND active FOR UPDATE', [req.params.id]);
    if (!lock.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    const conflict = await findConflict(client, req.params.id, range.starts, range.ends);
    if (conflict) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: conflictMessage(conflict) });
    }
    const { rows } = await client.query(
      `INSERT INTO reservations (equipment_id, user_id, title, notes, starts_at, ends_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${RESERVATION_COLUMNS}`,
      [req.params.id, req.user.id, title.trim(), notes, range.starts, range.ends,
       statusFor(range.starts, range.ends, req.user.role === 'admin')]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Error al crear la reserva' });
  } finally {
    client.release();
  }
});

// ── RESERVATIONS: UPDATE ──────────────────────────────────────────────────────
router.patch('/reservations/:rid', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Row lock: an admin's approve/reject that commits meanwhile must not be overwritten by this edit.
    const cur = await client.query('SELECT * FROM reservations WHERE id = $1 FOR UPDATE', [req.params.rid]);
    const existing = cur.rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Solo quien reservó o un administrador puede editarla' });
    }
    if (existing.status === 'rejected') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La reserva fue rechazada' });
    }

    const title = req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
    if (!title) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El título es requerido' });
    }
    const notes = req.body.notes !== undefined ? req.body.notes : existing.notes;
    const range = parseRange({
      starts_at: req.body.starts_at ?? existing.starts_at,
      ends_at:   req.body.ends_at   ?? existing.ends_at,
    });
    if (range.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: range.error });
    }

    // Lock the equipment row, then check overlap ignoring this booking itself.
    await client.query('SELECT id FROM equipment WHERE id = $1 FOR UPDATE', [existing.equipment_id]);
    const conflict = await findConflict(client, existing.equipment_id, range.starts, range.ends, existing.id);
    if (conflict) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: conflictMessage(conflict) });
    }

    // Status is re-evaluated only when the times change; title/notes edits never touch it.
    const timesChanged = range.starts.getTime() !== existing.starts_at.getTime()
                      || range.ends.getTime() !== existing.ends_at.getTime();
    const status = timesChanged
      ? statusFor(range.starts, range.ends, req.user.role === 'admin')
      : existing.status;

    const { rows } = await client.query(
      `UPDATE reservations SET title = $2, notes = $3, starts_at = $4, ends_at = $5, status = $6
       WHERE id = $1 RETURNING ${RESERVATION_COLUMNS}`,
      [existing.id, title, notes, range.starts, range.ends, status]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la reserva' });
  } finally {
    client.release();
  }
});

// ── RESERVATIONS: DELETE ──────────────────────────────────────────────────────
router.delete('/reservations/:rid', requireAuth, async (req, res) => {
  try {
    const cur = await pool.query('SELECT user_id FROM reservations WHERE id = $1', [req.params.rid]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (cur.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo quien reservó o un administrador puede cancelarla' });
    }
    await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.rid]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cancelar la reserva' });
  }
});

module.exports = router;
