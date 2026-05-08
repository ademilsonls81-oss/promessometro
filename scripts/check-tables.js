import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkTables() {
  console.log('🔍 Verificando tabelas do Promessômetro...\n');

  const tables = [
    'promises', 
    'politicians', 
    'promise_reports',
    'promise_evidences',
    'trusted_sources', 
    'evidence_disputes',
    'evidence_validation_logs'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count', { count: 'exact', head: true });
      
      if (error && error.message.includes('does not exist')) {
        console.log(`❌ ${table}: NÃO EXISTE`);
      } else if (error) {
        console.log(`⚠️  ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: OK`);
      }
    } catch (e) {
      console.log(`❌ ${table}: ERRO - ${e.message}`);
    }
  }
  
  // Check if evidence table exists by querying information_schema
  console.log('\n📊 Verificando fontes confiáveis...');
  try {
    const { data: sources } = await supabase
      .from('trusted_sources')
      .select('name, type, credibility_score')
      .limit(5);
    
    if (sources && sources.length > 0) {
      console.log('✅ Fontes confiáveis encontradas:');
      sources.forEach(s => console.log(`   - ${s.name} (${s.credibility_score}%) [${s.type}]`));
    } else {
      console.log('⚠️  Tabela de fontes existe mas vazia');
    }
  } catch (e) {
    console.log('   (tabela não existe ainda)');
  }
}

checkTables();