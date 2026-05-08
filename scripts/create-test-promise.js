import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createPromiseAndTest() {
  console.log('🔍 Verificando colunas da tabela promises...\n');
  
  // Insert with correct columns based on what we saw
  const { data: insertData, error: insertError } = await supabase
    .from('promises')
    .insert({
      politician_name: 'Lula',
      promise_title: 'Zerar a fome no Brasil',
      category: 'Saúde',
      status: 'pendente',
      fulfillment_score: 50,
      evidence: 'Nenhuma evidência registrada',
      source_link: 'https://pt.wikipedia.org/wiki/Lula'
    })
    .select()
    .single();
    
  if (insertError) {
    console.log('❌ Erro ao inserir:', insertError.message);
    return;
  }
  
  console.log('✅ Promise criada!');
  console.log('   ID:', insertData.id);
  console.log('   Título:', insertData.promise_title);
  console.log('   Político:', insertData.politician_name);
  
  // Now test the evidence search
  console.log('\n📡 Testando busca de evidências...\n');
  
  const { searchEvidenceForPromise, saveEvidence } = await import('../src/services/evidenceService.js');
  
  const evidences = await searchEvidenceForPromise({
    promiseTitle: insertData.promise_title,
    politicianName: insertData.politician_name,
    category: insertData.category
  });
  
  console.log(`   Encontradas ${evidences.length} evidências potenciais`);
  
  if (evidences.length > 0) {
    console.log('\n💾 Salvando evidências...');
    
    let savedCount = 0;
    for (const evidence of evidences.slice(0, 3)) {
      const savedId = await saveEvidence(insertData.id, evidence);
      if (savedId) {
        savedCount++;
        console.log(`   ✅ Evidência salva: ${evidence.title.substring(0, 40)}...`);
      }
    }
    
    console.log(`\n📊 Total salvo: ${savedCount} evidências`);
    
    // Check results
    const { data: savedEvidences } = await supabase
      .from('promise_evidences')
      .select('*')
      .eq('promise_id', insertData.id);
    
    console.log('\n📋 Evidências no banco:');
    savedEvidences?.forEach((e, i) => {
      console.log(`   ${i+1}. ${e.title.substring(0, 50)}...`);
      console.log(`      Fonte: ${e.source_name} | Tipo: ${e.evidence_type}`);
    });
  }
}

createPromiseAndTest();