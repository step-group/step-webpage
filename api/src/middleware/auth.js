const jwt = require('jsonwebtoken');
const pool = require('../db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
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
// so each route can return its own 401.
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
