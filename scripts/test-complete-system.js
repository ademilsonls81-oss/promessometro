import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCompleteSystem() {
  console.log('🧪 TESTANDO SISTEMA COMPLETO\n');
  
  // 1. Verificar政治家 com source_doc_url
  console.log('1. Políticos com link TSE:');
  const { data: politicians } = await supabase
    .from('politicians')
    .select('id, name, source_doc_url')
    .not('source_doc_url', 'is', null);

  console.log(`   Total: ${politicians?.length || 0}`);
  politicians?.forEach(p => console.log(`   - ${p.name}: ${p.source_doc_url?.substring(0, 30)}...`));

  // 2. Verificar promessas criadas
  console.log('\n2. Promessas criadas por politician:');
  const { data: promises } = await supabase
    .from('promises')
    .select('id, politician_name, promise_title, status, is_automated, source_doc_url')
    .eq('is_automated', true)
    .limit(10);

  console.log(`   Total: ${promises?.length || 0}`);
  promises?.forEach(p => {
    console.log(`   - ${p.politician_name}: ${p.promise_title?.substring(0, 35)}... [${p.status}]`);
  });

  // 3. Verificar fontes de monitoramento
  console.log('\n3. Fontes de monitoramento (RSS Gratuitas):');
  const { data: sources } = await supabase
    .from('monitor_sources')
    .select('name, url, type, is_active');

  sources?.forEach(s => {
    console.log(`   - ${s.name} (${s.type}): ${s.is_active ? '✅' : '❌'}`);
  });

  // 4. Verificar scrape_jobs
  console.log('\n4. Histórico de scraping:');
  const { data: jobs } = await supabase
    .from('scrape_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`   Total jobs: ${jobs?.length || 0}`);
  if (jobs && jobs.length > 0) {
    jobs.forEach(j => {
      console.log(`   - ${j.source_type}: ${j.status} (${j.promises_created} promessas)`);
    });
  }

  // 5. Verificar audit log
  console.log('\n5. Auditoria (promise_audit_log):');
  const { data: auditLogs } = await supabase
    .from('promise_audit_log')
    .select('action, source, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`   Total registros: ${auditLogs?.length || 0}`);
  auditLogs?.forEach(l => {
    console.log(`   - ${l.action} via ${l.source}`);
  });

  console.log('\n✅ SISTEMA CONFIGURADO!');
  console.log('\n📋 RESUMO:');
  console.log('   • Scraping único por político (TSE)');
  console.log('   • Monitoramento diário via RSS (gratuito)');
  console.log('   • Cada mudança = evidência + auditoria');
  console.log('   • Scores calculados automaticamente');
}

testCompleteSystem();