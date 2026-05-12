require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addMissingColumns() {
  console.log('Adding missing columns to promise_explanations...');
  
  const columns = [
    { name: 'is_latest', type: 'BOOLEAN DEFAULT FALSE' },
    { name: 'revisado_em', type: 'TIMESTAMPTZ' },
    { name: 'revisado_por', type: 'UUID' }
  ];

  for (const col of columns) {
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE promise_explanations ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
      });
      
      if (error) {
        console.log(`Column ${col.name}: ${error.message}`);
      } else {
        console.log(`Column ${col.name}: Added successfully`);
      }
    } catch (e) {
      console.log(`Column ${col.name}: ${e.message}`);
    }
  }

  console.log('\nDone!');
}

addMissingColumns();