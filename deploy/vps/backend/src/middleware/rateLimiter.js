const rateLimit = require('express-rate-limit');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

// Disable rate limiting in test environment
const isTest = process.env.NODE_ENV === 'test';

const loginLimiter = isTest ? (req, res, next) => next() : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    error: 'Too many login attempts',
    message: 'Please try again after 15 minutes',
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please try again after 15 minutes',
    });
  },
});

const apiLimiter = isTest ? (req, res, next) => next() : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'Please try again after 15 minutes',
  },
  handler: (req, res) => {
    logger.warn(`API rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again after 15 minutes',
    });
  },
});

module.exports = {
  loginLimiter,
  apiLimiter,
}; 