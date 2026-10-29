const { pool } = require('../config/database');

const logAudit = async (req, action, entity, entityId, details) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_email, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5)',
      [(req.user && req.user.email) || (req.body && req.body.email) || 'public', action, entity, String(entityId || ''), JSON.stringify(details || {})]
    );
  } catch (e) { /* never break requests on audit failure */ }
};

const auditAction = (action, entity) => (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      logAudit(req, action, entity, req.params.id || '', { method: req.method, path: req.originalUrl });
    }
  });
  next();
};

module.exports = { logAudit, auditAction };
