const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { setupLogger } = require('../../utils/logger');

const logger = setupLogger();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  try {
    // Read and execute static_content migration
    const staticContentSql = fs.readFileSync(
      path.join(__dirname, '006_create_static_content_table.sql'),
      'utf8',
    );
    
    const { error: staticContentError } = await supabase
      .from('_migrations')
      .insert([{ name: '006_create_static_content_table', sql: staticContentSql }])
      .select();

    if (staticContentError) {
      console.error('Error creating static_content table:', staticContentError);
      return;
    }

    const { error: staticContentExecError } = await supabase.rpc('run_sql', {
      query: staticContentSql,
    });

    if (staticContentExecError) {
      console.error('Error executing static_content migration:', staticContentExecError);
      return;
    }
    console.log('Static content table created successfully');

    // Read and execute slider_slides migration
    const sliderSlidesSql = fs.readFileSync(
      path.join(__dirname, '007_create_slider_slides_table.sql'),
      'utf8',
    );
    
    const { error: sliderSlidesError } = await supabase
      .from('_migrations')
      .insert([{ name: '007_create_slider_slides_table', sql: sliderSlidesSql }])
      .select();

    if (sliderSlidesError) {
      console.error('Error creating slider_slides table:', sliderSlidesError);
      return;
    }

    const { error: sliderSlidesExecError } = await supabase.rpc('run_sql', {
      query: sliderSlidesSql,
    });

    if (sliderSlidesExecError) {
      console.error('Error executing slider_slides migration:', sliderSlidesExecError);
      return;
    }
    console.log('Slider slides table created successfully');

  } catch (error) {
    console.error('Error running migrations:', error);
  }
}

runMigrations(); 