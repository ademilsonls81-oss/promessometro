import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sources = [
  { name: 'Portal da Transparência', url_pattern: 'portaldatransparencia.gov.br', type: 'government', credibility_score: 100 },
  { name: 'Diário Oficial da União', url_pattern: 'in.gov.br', type: 'official', credibility_score: 100 },
  { name: 'Diário Oficial do Estado', url_pattern: 'sp.gov.br', type: 'official', credibility_score: 100 },
  { name: 'G1 Globo', url_pattern: 'g1.globo.com', type: 'journalism', credibility_score: 90 },
  { name: 'Folha de S.Paul', url_pattern: 'folha.uol.com.br', type: 'journalism', credibility_score: 90 },
  { name: 'Estadão', url_pattern: 'estadao.com.br', type: 'journalism', credibility_score: 90 },
  { name: 'UOL', url_pattern: 'uol.com.br', type: 'journalism', credibility_score: 85 },
  { name: 'CNN Brasil', url_pattern: 'cnnbrasil.com.br', type: 'journalism', credibility_score: 85 },
  { name: 'Terra', url_pattern: 'terra.com.br', type: 'journalism', credibility_score: 80 },
  { name: 'Valor Econômico', url_pattern: 'valor.globo.com', type: 'journalism', credibility_score: 90 },
  { name: 'Metrópolis', url_pattern: 'metropoles.com', type: 'journalism', credibility_score: 80 },
  { name: 'Poder360', url_pattern: 'poder360.com.br', type: 'journalism', credibility_score: 85 },
  { name: 'Agência Brasil', url_pattern: 'agenciabrasil.ebc.com.br', type: 'journalism', credibility_score: 85 },
  { name: 'Senado Federal', url_pattern: 'senado.leg.br', type: 'government', credibility_score: 95 },
  { name: 'Câmara dos Deputados', url_pattern: 'camara.leg.br', type: 'government', credibility_score: 95 },
  { name: 'Governo Federal', url_pattern: 'gov.br', type: 'government', credibility_score: 95 },
  { name: 'TCU', url_pattern: 'tcu.gov.br', type: 'government', credibility_score: 95 },
  { name: 'Prestação de Contas TCU', url_pattern: 'contas.gov.br', type: 'government', credibility_score: 100 },
  { name: 'Fact-Checking Agência Lupa', url_pattern: 'agencialupa.com', type: 'fact_check', credibility_score: 95 },
  { name: 'Fact-Checking Aos Fatos', url_pattern: 'aosfatos.org', type: 'fact_check', credibility_score: 95 },
  { name: 'Fact-Checking Poder360', url_pattern: 'poder360.com.br/fato', type: 'fact_check', credibility_score: 90 }
];

async function insertSources() {
  console.log('📥 Inserindo fontes confiáveis...\n');
  
  let inserted = 0;
  
  for (const source of sources) {
    const { error } = await supabase
      .from('trusted_sources')
      .upsert(
        { ...source, is_active: true },
        { onConflict: 'url_pattern' }
      );
    
    if (error && !error.message.includes('duplicate')) {
      console.log(`❌ ${source.name}: ${error.message}`);
    } else {
      inserted++;
      console.log(`✅ ${source.name}`);
    }
  }
  
  console.log(`\n✅ Concluído! ${inserted} fontes inseridas/atualizadas.`);
  
  // Verify
  const { data } = await supabase
    .from('trusted_sources')
    .select('name, type, credibility_score')
    .order('credibility_score', { ascending: false });
  
  console.log('\n📊 Total de fontes no banco:', data?.length || 0);
}

insertSources();