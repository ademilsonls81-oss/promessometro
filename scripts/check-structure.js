import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStructure() {
  console.log('🔍 Verificando estrutura...\n');
  
  // Check promises table columns
  const { data: promises } = await supabase
    .from('promises')
    .select('*')
    .limit(1);
  
  if (promises && promises.length > 0) {
    console.log('Colunas da tabela promises:');
    Object.keys(promises[0]).forEach(col => console.log(`   - ${col}`));
  }
  
  // Check politicians table
  const { data: politicians } = await supabase
    .from('politicians')
    .select('*')
    .limit(3);
  
  console.log('\n📋 Políticos:');
  politicians?.forEach(p => {
    console.log(`   ID: ${p.id}`);
    console.log(`   Nome: ${p.name}`);
    console.log(`   Partido: ${p.party}`);
    console.log(`   Estado: ${p.state}`);
    console.log('');
  });
  
  // Check promises with politician_id
  const { data: promisesWithId } = await supabase
    .from('promises')
    .select('id, politician_name, politician_id, status')
    .limit(5);
    
  console.log('Promessas com politician_id:');
  promisesWithId?.forEach(p => {
    console.log(`   ${p.politician_name} | politician_id: ${p.politician_id || 'NULL'}`);
  });
}

checkStructure();