require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function testConnection() {
  try {
    // Test user creation
    const testUser = {
      email: 'test3@example.com',
      password: 'test123',
      username: 'testuser3',
      name: 'Test User 3',
      role: 'admin',
    };

    console.log('Creating test user...');
    const { data: createData, error: createError } = await supabase
      .from('users')
      .insert([testUser])
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
    } else {
      console.log('User created successfully:', createData);
    }

    // Test user query
    console.log('\nQuerying users...');
    const { data: queryData, error: queryError } = await supabase
      .from('users')
      .select('*')
      .limit(5);

    if (queryError) {
      console.error('Error querying users:', queryError);
    } else {
      console.log('Users found:', queryData);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testConnection(); 