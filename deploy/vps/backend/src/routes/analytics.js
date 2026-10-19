const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/analyticsController');
const { apiLimiter } = require('../middleware/rateLimiter');
const { auth, isAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/analytics/dashboard:
 *   get:
 *     summary: Get dashboard statistics and analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeFrame
 *         schema:
 *           type: string
 *           enum: [7, 30, 90, 365]
 *           default: 30
 *         description: Time frame in days for analytics data
 *     responses:
 *       200:
 *         description: Dashboard analytics data
 */
router.get('/dashboard', auth, isAdmin, apiLimiter, getDashboardStats);

module.exports = router; 