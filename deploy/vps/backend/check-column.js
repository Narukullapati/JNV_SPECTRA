const { supabaseAdmin } = require('./src/config/supabase');

async function checkColumn() {
  try {
    const { data, error } = await supabaseAdmin
      .from('rentals')
      .select('bullet_points')
      .limit(1);

    if (error) {
      console.error('Error checking column:', error);
      return;
    }

    console.log('Column exists:', data !== null);
  } catch (error) {
    console.error('Error:', error);
  }
}

checkColumn(); 