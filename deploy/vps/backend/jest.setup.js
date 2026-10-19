const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.test
const result = dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

if (result.error) {
  throw result.error;
}

// Log loaded environment variables for debugging (excluding sensitive data)
console.log('Environment variables loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  SUPABASE_URL_SET: !!process.env.SUPABASE_URL,
  SUPABASE_KEY_SET: !!process.env.SUPABASE_KEY,
  JWT_SECRET_SET: !!process.env.JWT_SECRET,
}); 