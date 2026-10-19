require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

// Add direct console output
console.log('Starting migration script...');

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

console.log('Supabase client initialized');

async function runSingleMigration(migrationFileName) {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const filePath = path.join(migrationsDir, migrationFileName);
    
    console.log(`Running migration: ${migrationFileName}`);
    logger.info(`Running migration: ${migrationFileName}`);
    
    // Read the SQL file
    const sql = await fs.readFile(filePath, 'utf8');
    console.log('SQL file read successfully');
    console.log('SQL content:', sql);

    // Execute the SQL
    console.log('Executing SQL against Supabase...');
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error(`Error running migration ${migrationFileName}:`, error);
      logger.error(`Error running migration ${migrationFileName}:`, error);
      throw error;
    }

    console.log(`Successfully ran migration: ${migrationFileName}`);
    logger.info(`Successfully ran migration: ${migrationFileName}`);
  } catch (error) {
    console.error('Migration failed:', error);
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the payment option migration
const migrationFile = '20240419000000_update_payment_option.sql';
console.log(`Preparing to run migration file: ${migrationFile}`);
runSingleMigration(migrationFile)
  .then(() => console.log('Migration process completed'))
  .catch((err) => console.error('Unhandled error:', err)); 