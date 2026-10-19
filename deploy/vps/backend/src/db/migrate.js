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

async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    
    // Sort migration files by their numeric prefix
    const migrationFiles = files
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[0]);
        const numB = parseInt(b.split('_')[0]);
        return numA - numB;
      });

    for (const file of migrationFiles) {
      logger.info(`Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');

      // Execute the entire SQL file as one statement
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        // Skip if the error is about something already existing
        if (error.code === '42710' || error.code === '42701') {
          logger.warn(`Skipping migration ${file}: ${error.message}`);
          continue;
        }
        logger.error(`Error running migration ${file}:`, error);
        throw error;
      }

      logger.info(`Successfully ran migration: ${file}`);
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations(); 