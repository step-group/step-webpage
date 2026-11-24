const jwt = require('jsonwebtoken');
const pool = require('../db');

// Verifies the token, then loads the user's CURRENT role from the database (one primary-key
// lookup). The database is the source of truth, so a promotion, a demotion or a deleted account
// takes effect immediately instead of when the 7-day token expires.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  if (!Number.isInteger(payload.id)) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [payload.id]);
    if (!rows[0]) return res.status(401).json({ error: 'La cuenta ya no existe' });
    req.user = { ...payload, role: rows[0].role };
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Se requieren permisos de administrador' });
    }
    next();
  });
}

// Whitelist for external users (people from outside the lab): they may only reach the paths
// listed in `allowedPrefixes` (matched on whole segments, so '/equipmentx' is not '/equipment').
// Everything else is refused, including routes added in the future.
// The role is read from the database, not the token, so a user demoted to external loses access
// immediately even if they still hold an older token. Requests without a valid token pass through
// so each route's own requireAuth can return the 401 (which also covers deleted accounts).
function restrictExternals(allowedPrefixes) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();

    let payload;
    try {
      payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    } catch {
      return next();
    }

    if (allowedPrefixes.some(p => req.path === p || req.path.startsWith(`${p}/`))) return next();

    try {
      const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [payload.id]);
      if (rows[0]?.role === 'external') {
        return res.status(403).json({ error: 'Acceso restringido: tu cuenta solo puede usar el calendario de equipos' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireAuth, requireAdmin, restrictExternals };
