import { createClient } from '@supabase/supabase-js';

const c = createClient(
  'https://liqutcjzzrqstivvfele.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
);

// Use the REST API directly since schema cache is refreshed
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

// 1. Insert methodology v1.0
const methodologyContent = {
  version: "1.0",
  name: "Metodologia de Avaliação de Promessas — Promessômetro Brasil",
  last_updated: "2026-05-17",
  formula: {
    nota_final: "(C1 × 0.40) + (C2 × 0.35) + (C3 × 0.25)",
    grade_scale: [
      { grade: "A", range: "80-100", label: "Excelente" },
      { grade: "B", range: "60-79", label: "Bom" },
      { grade: "C", range: "40-59", label: "Regular" },
      { grade: "D", range: "20-39", label: "Ruim" },
      { grade: "F", range: "0-19", label: "Péssimo" }
    ]
  },
  camada_1: {
    name: "Cumprimento de Promessas",
    weight: 0.40,
    description: "Avalia o percentual de promessas cumpridas e parcialmente cumpridas sobre o total de promessas verificáveis do mandato.",
    calculation: "C1 = (cumpridas × 1.0 + parciais × 0.5) / total × 100",
    status: {
      cumprida: { score: 1.0, label: "Cumprida" },
      parcial: { score: 0.5, label: "Parcialmente Cumprida" },
      pendente: { score: 0, label: "Pendente" },
      quebrada: { score: 0, label: "Descumprida" }
    },
    sources: {
      primary: "Plano de Governo registrado no TSE (fonte legal obrigatória)",
      secondary: "Entrevistas, debates, lives (exigem registro em vídeo/áudio/texto)",
      discard: "Promessas vagas ou não verificáveis — descartadas com justificativa pública"
    }
  },
  camada_2: {
    name: "Indicadores Objetivos",
    weight: 0.35,
    description: "Avalia indicadores objetivos por categoria, definidos antes do início do mandato, com metas públicas e verificáveis.",
    categories: [
      { name: "seguranca", weight: 0.30, indicators: ["taxa_homicidios", "policiamento", "investimento_seguranca"] },
      { name: "financas", weight: 0.40, indicators: ["receita_corrente", "divida_publica", "investimento"] },
      { name: "funcionalismo", weight: 0.30, indicators: ["servidores", "gasto_folha", "concursos"] }
    ],
    calculation: "C2 = Σ(indicador_score × peso) / Σ(pesos)",
    note: "Cada indicador é pontuado de 0 a 100 com base em dados oficiais (IBGE, TCE, Ministério da Fazenda)"
  },
  camada_3: {
    name: "Fatos Jurídicos",
    weight: 0.25,
    description: "Avalia a integridade do político com base em condenações, investigações e ocorrências jurídicas.",
    initial_score: 100,
    rule: "C3 começa em 100 e deduz penalidades. Se C3 < 20, nota máxima possível é C.",
    penalties: [
      { type: "condemnation", points: 50, label: "Condenação Transitada" },
      { type: "investigation", points: 20, label: "Investigação Formal" },
      { type: "alert", points: 10, label: "Alerta" },
      { type: "irregularity", points: 5, label: "Irregularidade Administrativa" }
    ]
  },
  verification: {
    min_sources: 2,
    description: "Toda promessa requer mínimo 2 fontes independentes.",
    source_hierarchy: [
      { level: 1, type: "Documentos oficiais (DOU, diários oficiais, TSE, TCE)" },
      { level: 2, type: "Dados abertos governamentais (IBGE, IPEA)" },
      { level: 3, type: "Reportagens jornalísticas com registro" },
      { level: 4, type: "Declarações públicas do político em vídeo/áudio" },
      { level: 5, type: "Relatos de terceiros (exigem corroboração)" }
    ]
  },
  contestation: {
    deadline_days: 15,
    description: "Prazo de 15 dias para contestação antes da publicação."
  },
  transparency: {
    reproducibility: "Qualquer cidadão pode reproduzir a nota final usando dados publicados no site."
  },
  versioning: {
    rule: "Metodologia congelada por mandato. Nenhuma regra muda durante o período."
  }
};

console.log('Inserting methodology...');
let resp = await rest('POST', 'methodology', {
  version: '1.0',
  content: methodologyContent,
  is_current: true
});
console.log('Methodology status:', resp.status);
if (resp.status === 201) {
  const data = await resp.json();
  console.log('Created:', data[0]?.id);
} else {
  const text = await resp.text();
  console.log('Error:', text.substring(0, 300));
}

// 2. Insert Castro's mandate
console.log('\nInserting Castro mandate...');
resp = await rest('POST', 'mandates', {
  politician_id: '76dd3b48-3578-42f6-8c0c-f2b16057bc3d',
  position: 'governador',
  start_date: '2023-01-01',
  end_date: '2026-12-31',
  is_active: true,
  source_doc_url: 'https://divulgacandcontas.tse.jus.br/divulga/#/candidato/2022/2022/RJ/'
});
console.log('Mandate status:', resp.status);
if (resp.status === 201) {
  const data = await resp.json();
  console.log('Created:', data[0]?.id);
} else {
  const text = await resp.text();
  console.log('Error:', text.substring(0, 300));
}

// Verify
console.log('\n=== Verification ===');
resp = await rest('GET', 'methodology?select=id,version,is_current');
const meth = await resp.json();
console.log('Methodology:', JSON.stringify(meth));

resp = await rest('GET', 'mandates?select=id,position,start_date,end_date,is_active');
const mand = await resp.json();
console.log('Mandates:', JSON.stringify(mand));
