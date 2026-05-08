import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verify what schemas exist
async function checkSchema() {
  console.log('🔍 Verificando estrutura do banco...\n');
  
  // Try to query the information schema directly via postgrest
  const { data: tables, error } = await supabase
    .from('pg_tables')
    .select('tablename, schemaname')
    .eq('schemaname', 'public');
  
  if (error) {
    console.log('Erro ao listar tabelas:', error.message);
    return;
  }
  
  console.log('📋 Tabelas em public:');
  (tables || []).forEach(t => console.log(`   - ${t.tablename}`));
  
  // Check for evidence-related tables
  const evidenceTables = (tables || []).filter(t => 
    t.tablename.includes('evidence') || t.tablename.includes('trusted')
  );
  
  if (evidenceTables.length === 0) {
    console.log('\n⚠️ Tabelas de evidências NÃO existem!');
    console.log('\n📝 Execute o SQL manualmente no Supabase SQL Editor.');
  } else {
    console.log('\n✅ Tabelas de evidências encontradas:', evidenceTables.map(t => t.tablename).join(', '));
  }
}

checkSchema();