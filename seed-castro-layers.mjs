import { createClient } from '@supabase/supabase-js';

const c = createClient(
  'https://liqutcjzzrqstivvfele.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
);

const rest = (method, path, body) =>
  fetch(`https://liqutcjzzrqstivvfele.supabase.co/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0',
      'Prefer': 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });

const polId = '76dd3b48-3578-42f6-8c0c-f2b16057bc3d';  // Castro
const mandId = '497da669-5f05-4d19-88b3-a8cdc66e3ea4'; // his mandate

// ====== C2: INDICADORES OBJETIVOS ======
const indicators = [
  // Seguranca (peso 30%)
  {
    politician_id: polId, mandate_id: mandId,
    name: 'taxa_homicidios', category: 'seguranca', weight: 100,
    description: 'Homicídios dolosos no Estado do RJ. Queda de 17.5% jan-jul 2024 vs jan-jul 2023. 2.930 homicídios em 2024 (ISP). Melhor série histórica desde 2003.',
    historical_average: 3500, historical_period: '2020-2024',
    result_value: 2930, result_year: 2024, score: 70,
    source_url: 'https://www.ispdados.rj.gov.br/SN/SN2024.html'
  },
  {
    politician_id: polId, mandate_id: mandId,
    name: 'policiamento', category: 'seguranca', weight: 100,
    description: 'Atividade policial: 46 mil prisões em 2024, 15 mil armas apreendidas (732 fuzis), Bases Segurança Presente expandidas de 20 para 54. Salários policiais entre os 3 melhores do país.',
    historical_average: 40, historical_period: '2022-2024',
    result_value: 46, result_year: 2024, score: 75,
    source_url: 'https://www.tupi.fm/rio/claudio-castro-destaca-investimentos-e-defende-integracao-no-combate-a-violencia-no-rio/'
  },
  {
    politician_id: polId, mandate_id: mandId,
    name: 'investimento_seguranca', category: 'seguranca', weight: 100,
    description: 'Investimentos recordes na segurança, mas rotatividade no comando: 6 secretários desde 2021. Compra de 2.000 viaturas semiblindadas e modernização de armamentos.',
    historical_average: 50, historical_period: '2022-2024',
    result_value: 60, result_year: 2024, score: 50,
    source_url: 'https://g1.globo.com/rj/rio-de-janeiro/noticia/2024/09/04/castro-justifica-saida-de-secretario-de-policia-por-aumento-gigante-da-violencia-mas-ha-meses-usa-dados-para-celebrar-a-seguranca-do-rj.ghtml'
  },
  // Financas (peso 40%)
  {
    politician_id: polId, mandate_id: mandId,
    name: 'receita_corrente', category: 'financas', weight: 100,
    description: 'Receita líquida de R$ 104,6 bilhões em 2024 (LOA). Aumento nominal de 2.7% sobre 2023. Aumento insuficiente para cobrir inflação.',
    historical_average: 98000, historical_period: '2022-2024',
    result_value: 104600, result_year: 2024, score: 55,
    source_url: 'https://portal.fazenda.rj.gov.br/noticias/contas-de-2024-da-gestao-claudio-castro-recebem-parecer-favoravel-do-tribunal-de-contas-do-estado-pelo-quarto-ano-consecutivo/'
  },
  {
    politician_id: polId, mandate_id: mandId,
    name: 'divida_publica', category: 'financas', weight: 100,
    description: 'Estado ainda sob Regime de Recuperação Fiscal (RRF). Déficit previsto de R$ 8,5 bi em 2024, reduzido para R$ 2,4 bi (queda de 72%). Parecer favorável do TCE pelo 4º ano consecutivo.',
    historical_average: 75, historical_period: '2022-2024',
    result_value: 2400, result_year: 2024, score: 50,
    source_url: 'https://g1.globo.com/rj/rio-de-janeiro/noticia/2024/01/10/claudio-castro-sanciona-orcamento-de-2024-do-rj-com-previsao-de-deficit-de-r-85-bilhoes.ghtml'
  },
  {
    politician_id: polId, mandate_id: mandId,
    name: 'investimento_publico', category: 'financas', weight: 100,
    description: 'Saúde: 15.21% da RLIT (mínimo 12%) ✅. Educação: 26.93% (mínimo 25%) ✅. Déficit reduzido 72%. Reserva financeira formada.',
    historical_average: 55, historical_period: '2022-2024',
    result_value: 15.21, result_year: 2024, score: 65,
    source_url: 'https://portal.fazenda.rj.gov.br/noticias/contas-de-2024-da-gestao-claudio-castro-recebem-parecer-favoravel-do-tribunal-de-contas-do-estado-pelo-quarto-ano-consecutivo/'
  },
  // Funcionalismo (peso 30%)
  {
    politician_id: polId, mandate_id: mandId,
    name: 'servidores', category: 'funcionalismo', weight: 100,
    description: 'Mais de 28 mil contratações temporárias via Ceperj/UERJ (investigadas pelo MP Eleitoral). Acordo de recomposição salarial descumprido (2ª parcela não paga).',
    historical_average: 50, historical_period: '2022-2024',
    result_value: 28000, result_year: 2024, score: 35,
    source_url: 'https://g1.globo.com/rj/rio-de-janeiro/noticia/2025/01/30/tre-julga-pedido-de-cassacao-de-castro-por-falta-de-comprovacao-de-cerca-de-r-10-milhoes-de-fundos-publicos-gastos-em-campanha.ghtml'
  },
  {
    politician_id: polId, mandate_id: mandId,
    name: 'gasto_folha', category: 'funcionalismo', weight: 100,
    description: 'Despesa com pessoal dentro do limite de 60% da RCL (LRF). Corte de gastos monitorado por comissão permanente. Salários em dia.',
    historical_average: 55, historical_period: '2022-2024',
    result_value: 58, result_year: 2024, score: 55,
    source_url: 'https://www.rj.gov.br/planejamento/governo-do-estado-sanciona-orcamento-2024-e-as-diretrizes-para-os-proximos-quatro-anos'
  },
  {
    politician_id: polId, mandate_id: mandId,
    name: 'concursos', category: 'funcionalismo', weight: 100,
    description: 'Predomínio de contratações temporárias via processo seletivo simplificado (Lei 9.255) em vez de concursos públicos tradicionais. Vinculado a investigações de desvio de finalidade.',
    historical_average: 50, historical_period: '2022-2024',
    result_value: 0, result_year: 2024, score: 30,
    source_url: 'https://www.mpf.mp.br/o-mpf/unidades/procuradoria-geral-da-republica-pgr/noticias/mp-eleitoral-reforca-pedido-de-cassacao-do-governador-do-rio-de-janeiro-em-julgamento-no-tse'
  }
];

// ====== C3: FATOS JURÍDICOS ======
const legalFacts = [
  {
    politician_id: polId, mandate_id: mandId,
    fact_type: 'investigation', penalty_points: 20,
    description: 'Indiciado pela Polícia Federal por corrupção passiva e peculato (Operações Catarata e Sétimo Mandamento). Inquérito no STJ investiga desvios em contratos de assistência social (2017-2020).',
    authority: 'Polícia Federal / Superior Tribunal de Justiça (STJ)',
    date: '2023-04-01',
    source_url: 'https://www.tnonline.com.br/noticias/politica/pf-pediu-afastamento-de-claudio-castro-em-investigacao-sobre-corrupcao-e-peculato-899713'
  },
  {
    politician_id: polId, mandate_id: mandId,
    fact_type: 'investigation', penalty_points: 20,
    description: 'Ações de Investigação Judicial Eleitoral (AIJE) por abuso de poder político e econômico. Contratação irregular de 28 mil temporários via Ceperj/UERJ com fins eleitoreiros. MP Eleitoral pede cassação.',
    authority: 'Ministério Público Eleitoral / Tribunal Regional Eleitoral (TRE-RJ) / Tribunal Superior Eleitoral (TSE)',
    date: '2022-09-01',
    source_url: 'https://g1.globo.com/rj/rio-de-janeiro/noticia/2025/01/30/tre-julga-pedido-de-cassacao-de-castro-por-falta-de-comprovacao-de-cerca-de-r-10-milhoes-de-fundos-publicos-gastos-em-campanha.ghtml'
  },
  {
    politician_id: polId, mandate_id: mandId,
    fact_type: 'alert', penalty_points: 10,
    description: 'Denúncia protocolada no TCE-RJ pela deputada Martha Rocha por descumprimento do acordo de recomposição salarial dos servidores. 2ª parcela (13.05%) não paga desde fevereiro de 2023.',
    authority: 'Tribunal de Contas do Estado do Rio de Janeiro (TCE-RJ)',
    date: '2023-07-05',
    source_url: 'https://seperj.org.br/claudio-castro-sera-julgado-hoje-dia-5-pelo-tce-por-calote-na-recomposicao-dos-servidores/'
  },
  {
    politician_id: polId, mandate_id: mandId,
    fact_type: 'irregularity', penalty_points: 5,
    description: 'Contas de campanha 2022 aprovadas com ressalvas pelo TRE-RJ. Determinação de devolução de R$ 223,9 mil por inconsistências em gastos com serviços advocatícios e material impresso.',
    authority: 'Tribunal Regional Eleitoral do Rio de Janeiro (TRE-RJ)',
    date: '2022-11-01',
    source_url: 'https://g1.globo.com/rj/rio-de-janeiro/noticia/2025/01/30/tre-julga-pedido-de-cassacao-de-castro-por-falta-de-comprovacao-de-cerca-de-r-10-milhoes-de-fundos-publicos-gastos-em-campanha.ghtml'
  }
];

// Insert all
console.log('=== Inserting C2 Indicators ===');
let ok = 0, fail = 0;
for (const ind of indicators) {
  const r = await rest('POST', 'indicators', ind);
  if (r.status === 201) { ok++; process.stdout.write('.'); }
  else {
    fail++;
    const t = await r.text();
    console.error(`\n✗ ${ind.name}: ${t.substring(0, 120)}`);
  }
}
console.log(`\nC2: ${ok} OK, ${fail} failed`);

console.log('\n=== Inserting C3 Legal Facts ===');
ok = 0; fail = 0;
for (const fact of legalFacts) {
  const r = await rest('POST', 'legal_facts', fact);
  if (r.status === 201) { ok++; process.stdout.write('.'); }
  else {
    fail++;
    const t = await r.text();
    console.error(`\n✗ ${fact.fact_type}: ${t.substring(0, 120)}`);
  }
}
console.log(`\nC3: ${ok} OK, ${fail} failed`);

// Verify & re-fetch Castro to see updated scores
console.log('\n=== Re-fetching Castro ===');
const r = await fetch('https://promessometro-brasil.vercel.app/api/politician/claudio-castro');
const data = await r.json();
const m = data.methodology;
console.log(`C1=${m.c1_score} C2=${m.c2_score} C3=${m.c3_score} Final=${m.final_score} Grade=${m.grade}`);
console.log(`Mandates: ${data.mandates.length} Indicators: ${data.indicators.length} LegalFacts: ${data.legal_facts.length} Promises: ${data.promises.length}`);
console.log(`\nIndicators by category:`);
for (const ind of data.indicators) console.log(`  ${ind.category}: ${ind.name} = ${ind.score}`);
console.log(`\nLegal facts:`);
for (const f of data.legal_facts) console.log(`  ${f.fact_type} (-${f.penalty_points}): ${f.authority}`);
