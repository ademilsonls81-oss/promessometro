import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStatus() {
  console.log('🔍 Verificando status das promessas...\n');
  
  const { data: promises, error } = await supabase
    .from('promises')
    .select('politician_name, status, fulfillment_score');

  if (error) {
    console.log('Erro:', error.message);
    return;
  }

  console.log('Total de promessas:', promises?.length || 0);
  
  if (promises && promises.length > 0) {
    const statusCounts = {};
    promises.forEach(p => {
      const status = p.status || 'NULL';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('\nStatus encontrados:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   "${status}": ${count} promessas`);
    });
    
    console.log('\nPrimeiras 5 promessas:');
    promises.slice(0, 5).forEach(p => {
      console.log(`   - ${p.politician_name}: status="${p.status}", score=${p.fulfillment_score}`);
    });
  }
}

checkStatus();