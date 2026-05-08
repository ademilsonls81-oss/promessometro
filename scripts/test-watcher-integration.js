import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testIntegration() {
  console.log('🧪 Testando integração Watcher + EvidenceService\n');
  
  // 1. Inserir político com source_doc_url (como se viesse do TSE)
  console.log('1. Inserindo político com link TSE...');
  
  const { data: politician, error } = await supabase
    .from('politicians')
    .insert({
      name: 'José Luiz Datena',
      party: 'MDB',
      state: 'SP',
      source_doc_url: 'https://divulgacandcontas.tse.jus.br/divulga/#/candidato/2022/2800106/1'
    })
    .select()
    .single();

  if (error) {
    console.log('Erro:', error.message);
    return;
  }
  
  console.log('✅ Político criado:', politician.name);
  console.log('   ID:', politician.id);
  console.log('   source_doc_url:', politician.source_doc_url);
  
  // 2. Verificar watcher_logs
  console.log('\n2. Verificando logs do watcher...');
  
  // Wait a moment for trigger
  await new Promise(r => setTimeout(r, 500));
  
  const { data: logs } = await supabase
    .from('watcher_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n📋 Logs do Watcher:');
  logs?.forEach(l => {
    console.log(`   [${l.status}] ${l.event_type} - ${JSON.stringify(l.record_data).substring(0, 50)}`);
  });

  // 3. Verificar promessas criadas
  console.log('\n3. Verificando promessas criadas...');
  
  const { data: promises } = await supabase
    .from('promises')
    .select('*')
    .eq('politician_id', politician.id);

  console.log(`   Total de promessas para ${politician.name}: ${promises?.length || 0}`);
  
  if (promises && promises.length > 0) {
    promises.forEach(p => {
      console.log(`   - ${p.promise_title.substring(0, 40)}... [${p.status}]`);
    });
  }
  
  // 4. Verificar político específico com source_doc_url
  console.log('\n4. Políticos com source_doc_url:');
  
  const { data: politicians } = await supabase
    .from('politicians')
    .select('id, name, source_doc_url')
    .not('source_doc_url', 'is', null);

  console.log(`   Total: ${politicians?.length || 0}`);
  politicians?.forEach(p => {
    console.log(`   - ${p.name}: ${p.source_doc_url?.substring(0, 40)}...`);
  });
  
  console.log('\n✅ Integração testada!');
}

testIntegration();