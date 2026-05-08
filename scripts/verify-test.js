import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyAndTest() {
  console.log('🔍 Verificando promessa criada...\n');
  
  // Check the promise was created
  const { data: promise } = await supabase
    .from('promises')
    .select('*')
    .eq('id', '4879740e-ae5b-4fa1-80e7-98bfeed13bb1')
    .single();
    
  if (promise) {
    console.log('✅ Promise encontrada:');
    console.log(`   ${promise.politician_name} - ${promise.promise_title}`);
    console.log(`   Status: ${promise.status}\n`);
  }
  
  // Test using a simpler evidence search with RSS parser directly
  console.log('📡 Testando busca de evidências via RSS...\n');
  
  const Parser = await import('rss-parser');
  const parser = new Parser();
  
  const testSources = [
    { name: 'G1 - Política', url: 'https://g1.globo.com/politica/rss/' },
    { name: 'UOL - Política', url: 'https://noticias.uol.com.br/politica/rss.xml' }
  ];
  
  const searchTerms = ['Lula', 'fome', 'promessa', 'governo'];
  
  let allArticles = [];
  
  for (const source of testSources) {
    try {
      const feed = await parser.parseURL(source.url);
      const articles = (feed.items || []).slice(0, 10).map(item => ({
        title: item.title,
        link: item.link,
        content: item.contentSnippet || item.content || '',
        source: source.name
      }));
      allArticles = allArticles.concat(articles);
    } catch (e) {
      console.log(`   Erro ao buscar ${source.name}: ${e.message}`);
    }
  }
  
  console.log(`   Total de artigos encontrados: ${allArticles.length}`);
  
  // Filter by relevance
  const relevantArticles = allArticles.filter(article => {
    const text = (article.title + ' ' + article.content).toLowerCase();
    return searchTerms.some(term => text.includes(term.toLowerCase()));
  });
  
  console.log(`   Artigos relevantes: ${relevantArticles.length}\n`);
  
  if (relevantArticles.length > 0) {
    console.log('📰 Artigos relevantes encontrados:\n');
    relevantArticles.slice(0, 3).forEach((article, i) => {
      console.log(`   ${i+1}. ${article.title}`);
      console.log(`      Fonte: ${article.source}`);
      console.log('');
    });
    
    // Save one as evidence
    console.log('💾 Salvando evidência de teste...\n');
    
    const { error: saveError } = await supabase
      .from('promise_evidences')
      .insert({
        promise_id: '4879740e-ae5b-4fa1-80e7-98bfeed13bb1',
        title: relevantArticles[0].title,
        content: relevantArticles[0].content.substring(0, 500),
        url: relevantArticles[0].link,
        source_name: relevantArticles[0].source,
        source_type: 'journalism',
        source_credibility: 90,
        evidence_type: 'related',
        confidence_score: 70,
        validation_status: 'pending'
      });
      
    if (saveError) {
      console.log('❌ Erro ao salvar:', saveError.message);
    } else {
      console.log('✅ Evidência salva com sucesso!');
    }
  }
  
  // Check all evidences
  console.log('\n📋 Verificando evidências no banco...\n');
  const { data: evidences } = await supabase
    .from('promise_evidences')
    .select('*')
    .eq('promise_id', '4879740e-ae5b-4fa1-80e7-98bfeed13bb1');
    
  console.log(`   Total: ${evidences?.length || 0} evidências`);
  
  if (evidences && evidences.length > 0) {
    evidences.forEach((e, i) => {
      console.log(`\n   ${i+1}. ${e.title.substring(0, 50)}...`);
      console.log(`      Fonte: ${e.source_name} | Tipo: ${e.evidence_type} | Status: ${e.validation_status}`);
    });
  }
}

verifyAndTest();