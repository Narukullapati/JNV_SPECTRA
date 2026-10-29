const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { protect, isAdmin } = require('../middleware/auth');
const { AppError } = require('../utils/AppError');

router.get('/', protect, isAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
    res.json({ status: 'success', data: rows });
  } catch (err) { next(new AppError('Failed to load audit logs', 500)); }
});

module.exports = router;
