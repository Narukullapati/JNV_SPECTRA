const { Pool } = require('pg');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

// Create a connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false } // Allow self-signed certificates
      : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // Increased timeout for connections
  maxUses: 7500, // Maximum number of times a connection can be used before being closed
  keepAlive: true, // Enable TCP keepalive
  keepAliveInitialDelayMillis: 10000, // Initial delay before sending keepalive
});

// Test the connection with retry logic
const connectWithRetry = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      logger.info('Successfully connected to PostgreSQL database');
      client.release();
      return;
    } catch (err) {
      logger.error(`Attempt ${i + 1} failed to connect to the database:`, err);
      if (i === retries - 1) {
        logger.error('Max retries reached. Exiting...');
        process.exit(1);
      }
      logger.info(`Retrying in ${delay/1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Initialize connection
connectWithRetry().catch((err) => {
  logger.error('Error in connection retry:', err);
  process.exit(1);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
}; 