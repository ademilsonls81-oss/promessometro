import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPromisses() {
  console.log('🔍 Verificando promessas no banco...\n');
  
  // List all tables and their data
  const tables = ['promises', 'politicians', 'promise_reports'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(5);
    
    console.log(`📋 ${table}:`);
    if (error) {
      console.log(`   Erro: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`   ${data.length} registros found`);
      data.forEach((row, i) => {
        console.log(`   ${i+1}.`, JSON.stringify(row).substring(0, 100));
      });
    } else {
      console.log('   (vazio)');
    }
    console.log('');
  }
  
  // Try to insert a promise directly to test
  console.log('💡 Tentando inserir promessa de teste...\n');
  
  const { data: insertData, error: insertError } = await supabase
    .from('promises')
    .insert({
      politician_name: 'Lula',
      promise_title: 'Zerar a fome no Brasil',
      promise_description: 'Erradicar a pobreza extrema',
      category: 'Saúde',
      status: 'pendente',
      fulfillment_score: 50
    })
    .select();
    
  if (insertError) {
    console.log('❌ Erro ao inserir:', insertError.message);
    console.log('   Detalhes:', insertError);
  } else {
    console.log('✅ Promise criada com sucesso!');
    console.log('   Data:', insertData);
  }
}

checkPromisses();