require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  },
);

async function refreshSchema() {
  try {
    const sql = await fs.readFile(path.join(__dirname, 'refresh_schema.sql'), 'utf8');
    
    // Execute the SQL directly using Supabase's REST API
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        sql: sql,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Failed to refresh schema:', error);
      throw new Error(error);
    }

    logger.info('Successfully refreshed schema cache');
  } catch (error) {
    logger.error('Schema refresh failed:', error);
    process.exit(1);
  }
}

refreshSchema(); 