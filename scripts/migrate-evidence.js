// Script para verificar tabelas existentes
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkTables() {
  console.log('🔍 Verificando tabelas existentes...\n');
  
  const tables = ['promises', 'politicians', 'promise_evidences', 'trusted_sources', 'evidence_disputes'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('count')
      .limit(1);
    
    if (error && error.message.includes('does not exist')) {
      console.log(`❌ ${table}: NÃO EXISTE`);
    } else if (error) {
      console.log(`⚠️  ${table}: Erro - ${error.message}`);
    } else {
      console.log(`✅ ${table}: existe`);
    }
  }
}

checkTables();