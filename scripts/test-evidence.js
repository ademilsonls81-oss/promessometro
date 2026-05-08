import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEvidenceSystem() {
  console.log('🧪 TESTANDO SISTEMA DE EVIDÊNCIAS\n');

  // 1. List existing promises
  console.log('1️⃣ Buscando promessas existentes...');
  const { data: promises } = await supabase
    .from('promises')
    .select('id, politician_name, promise_title, status')
    .limit(5);

  if (!promises || promises.length === 0) {
    console.log('❌ Nenhuma promessa encontrada. Vou criar uma para testar.');
    
    // Create a test promise
    const { data: newPromise } = await supabase
      .from('promises')
      .insert({
        politician_name: 'Lula',
        promise_title: 'Zerar a fome no Brasil',
        promise_description: 'Erradicar a pobreza extrema e a fome no país',
        category: 'Saúde',
        status: 'pendente',
        fulfillment_score: 0
      })
      .select()
      .single();
    
    console.log('✅ Promise de teste criada:', newPromise.id);
    return testEvidenceSystemWithPromise(newPromise.id, 'Lula', 'Zerar a fome no Brasil', 'Saúde');
  }

  console.log(`   Encontradas ${promises.length} promessas:\n`);
  promises.forEach((p, i) => {
    console.log(`   ${i+1}. ${p.politician_name} - ${p.promise_title.substring(0, 40)}... [${p.status}]`);
  });

  // Test with the first promise
  const testPromise = promises[0];
  console.log(`\n2️⃣ Testando busca de evidências para: ${testPromise.politician_name}`);
  
  await testEvidenceSystemWithPromise(
    testPromise.id, 
    testPromise.politician_name, 
    testPromise.promise_title,
    null
  );
}

async function testEvidenceSystemWithPromise(promiseId, politician, title, category) {
  console.log(`\n📡 Pesquisando evidências no RSS feeds...\n`);
  
  // Import the evidence service
  const { searchEvidenceForPromise, saveEvidence } = await import('../src/services/evidenceService.js');
  
  const context = {
    promiseTitle: title,
    politicianName: politician,
    category: category || undefined
  };

  try {
    const evidences = await searchEvidenceForPromise(context);
    
    console.log(`   ✅ Encontradas ${evidences.length} evidências potenciais\n`);
    
    if (evidences.length > 0) {
      // Show first 3
      evidences.slice(0, 3).forEach((e, i) => {
        console.log(`   ${i+1}. ${e.title.substring(0, 60)}...`);
        console.log(`      Fonte: ${e.source} | Tipo: ${e.evidenceType} | Confiança: ${e.relevanceScore}%\n`);
      });

      // Save first evidence
      console.log('💾 Salvando primeira evidência...');
      const savedId = await saveEvidence(promiseId, evidences[0]);
      
      if (savedId) {
        console.log(`   ✅ Evidência salva com ID: ${savedId}`);
        
        // Verify it was saved
        const { data: saved } = await supabase
          .from('promise_evidences')
          .select('*')
          .eq('id', savedId)
          .single();
          
        console.log('\n📋 Evidência salva:');
        console.log(`   - Título: ${saved.title}`);
        console.log(`   - Fonte: ${saved.source_name}`);
        console.log(`   - URL: ${saved.source_url}`);
        console.log(`   - Status: ${saved.validation_status}`);
        console.log(`   - Tipo: ${saved.evidence_type || 'não definido'}`);
      }
    } else {
      console.log('   ⚠️ Nenhuma evidência encontrada. Isso é normal se não houver notícias recentes.');
    }

    // Check total evidences for this promise
    const { count } = await supabase
      .from('promise_evidences')
      .select('*', { count: 'exact', head: true })
      .eq('promise_id', promiseId);

    console.log(`\n📊 Total de evidências salvas para esta promessa: ${count || 0}`);

  } catch (err) {
    console.error('❌ Erro durante teste:', err.message);
  }
}

testEvidenceSystem();