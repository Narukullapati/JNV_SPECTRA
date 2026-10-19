const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const { setupLogger } = require('./logger');

const logger = setupLogger();

async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      logger.info(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
      if (error) {
        throw error;
      }
      logger.info(`Completed migration: ${file}`);
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Error running migrations:', error);
    throw error;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = runMigrations; 