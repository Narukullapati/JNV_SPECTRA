require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

async function setupMigrationFunction() {
  try {
    const setupSql = await fs.readFile(path.join(__dirname, 'setup_migration_function.sql'), 'utf8');
    
    // Execute the setup SQL using the REST API
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        sql: setupSql,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Failed to setup migration function:', error);
      throw new Error(error);
    }

    logger.info('Successfully setup migration function');
  } catch (error) {
    logger.error('Setup failed:', error);
    process.exit(1);
  }
}

setupMigrationFunction(); 