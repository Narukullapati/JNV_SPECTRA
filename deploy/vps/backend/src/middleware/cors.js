const cors = require('cors');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://admin.jnvspectra.com']
    : ['http://localhost:3000', 'http://localhost:8080', 'https://grand-granita-2d2d97.netlify.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

const corsMiddleware = cors(corsOptions);

module.exports = corsMiddleware; 