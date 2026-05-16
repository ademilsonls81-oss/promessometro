import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';

const POLITICIANS = ['Lula', 'Ricardo Nunes', 'Eduardo Paes', 'Romeu Zema'];

function parseSerperDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date().toISOString();
  }
  const lower = dateStr.toLowerCase();
  if (lower.includes('ago') || lower.includes('days') || lower.includes('months') || lower.includes('year') || lower.includes('hours')) {
    return new Date().toISOString();
  }
  const ptMonths = {
    'jan': 'Jan', 'fev': 'Feb', 'mar': 'Mar', 'abr': 'Apr',
    'mai': 'May', 'jun': 'Jun', 'jul': 'Jul', 'ago': 'Aug',
    'set': 'Sep', 'out': 'Oct', 'nov': 'Nov', 'dez': 'Dec'
  };
  const monthMatch = dateStr.match(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i);
  if (monthMatch) {
    const pt = monthMatch[1].toLowerCase();
    const en = ptMonths[pt];
    if (en) {
      const replaced = dateStr.replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi, en);
      const parsed = new Date(replaced);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return new Date().toISOString();
}

function isCredible(url) {
  if (!url) return false;
  const d = url.toLowerCase();
  const credibleDomains = ['g1.globo.com', 'folha.uol.com.br', 'uol.com.br', 'estadao.com.br', 'metropoles.com', 'cnnbrasil.com.br', 'www12.senado.leg.br', 'www.camara.leg.br', 'www.planalto.gov.br', 'portaldatransparencia.gov.br', 'agenciabrasil.ebc.com.br', 'veja.abril.com.br', 'oglobo.globo.com', 'congressoemfoco.uol.com.br', 'noticias.r7.com'];
  if (credibleDomains.some(domain => d.includes(domain))) return true;
  return d.includes('.gov.br') || d.includes('diariooficial') || d.includes('transparencia');
}

async function searchSerper(query) {
  const SERPER_KEY = process.env.SERPER_API_KEY;
  if (!SERPER_KEY) {
    console.log('[Serper] No API key configured');
    return [];
  }
  try {
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
      body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br' })
    });
    if (r.ok) {
      const d = await r.json();
      const results = d.organic || [];
      console.log(`[Serper] ${results.length} results for: ${query}`);
      return results.map(r => ({
        titulo: r.title || '',
        descricao: r.snippet || '',
        fonte: r.source || '',
        url: r.link || '',
        data: parseSerperDate(r.date),
        credible: isCredible(r.link)
      }));
    }
  } catch (err) {
    console.error(`[Serper] ERROR: ${err.message}`);
  }
  return [];
}

function clampScore(status, score) {
  const ranges = {
    cumprida: [80, 100], parcialmente_cumprida: [40, 79],
    em_andamento: [20, 39], nao_iniciada: [0, 19],
    descumprida: [0, 0], nao_classificada: [0, 100], pendente: [0, 19]
  };
  const [min, max] = ranges[status] || [0, 100];
  return Math.max(min, Math.min(max, Math.round(score)));
}

function mapToFrontend(aiStatus) {
  const map = {
    'cumprida': 'cumprida',
    'parcialmente_cumprida': 'parcial',
    'em_andamento': 'parcial',
    'nao_iniciada': 'pendente',
    'nao_classificada': 'pendente',
    'pendente': 'pendente',
    'descumprida': 'quebrada',
    'parcial': 'parcial',
    'quebrada': 'quebrada'
  };
  return map[aiStatus] || 'pendente';
}

async function evaluateWithGroq(promise, evidences) {
  const evText = evidences.length > 0
    ? evidences.map(e => `[${e.fonte}]: ${e.descricao || e.titulo} (${e.url || 'sem link'})`).join('\n')
    : 'Nenhuma evidência encontrada.';

  const prompt = `Você é um avaliador independente de promessas políticas brasileiras.

PROMESSA: ${promise.promise_title || ''}
POLÍTICO: ${promise.politician_name || ''}

EVIDÊNCIAS ENCONTRADAS (USE ESTAS URLs EXATAS PARA AVALIAR):
${evText}

CRITÉRIOS:
| Status | Score | Quando usar |
| cumprida | 80-100 | Ação concluída com prova verificável |
| parcialmente_cumprida | 40-79 | Progresso parcial demonstrado |
| em_andamento | 20-39 | Processo iniciado sem entrega final |
| nao_iniciada | 0-19 | Nenhuma ação verificável |
| descumprida | 0 | Ação contrária ou prazo expirado |

IMPORTANTE: Use APENAS as evidências acima. Cada evidência tem uma URL específica.

REGRAS:
- Sem evidência com URL real: score máximo 30
- Score > 70 exige evidência verificável com URL real
- Responda SOMENTE com JSON:
{"status":"status","fulfillment_score":0-100,"justificativa":"explicação clara","evidencias_usadas":[{"fonte":"nome","url":"url"}]}`;

  const r = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 512
    })
  });

  if (!r.ok) throw new Error(`Groq ${r.status}`);
  const d = await r.json();
  let text = (d.choices?.[0]?.message?.content || '{}').replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  const p = match ? JSON.parse(match[0]) : {};

  let status = p.status || 'nao_classificada';
  let score = p.fulfillment_score ?? 50;
  if (evidences.length === 0 && score > 30) { status = 'nao_iniciada'; score = 30; }

  return {
    status: mapToFrontend(status),
    score: clampScore(status, score),
    rawScore: score,
    justification: p.justificativa || '',
    evidencesUsed: p.evidencias_usadas || []
  };
}

async function run() {
  console.log('=== Force Reavaliation Script ===\n');

  for (const politicianName of POLITICIANS) {
    console.log(`\n=== Processing: ${politicianName} ===\n`);

    const { data: promises } = await supabase
      .from('promises')
      .select('id, promise_title, politician_name, category, status, fulfillment_score')
      .ilike('politician_name', `%${politicianName}%`)
      .limit(5);

    if (!promises || promises.length === 0) {
      console.log(`No promises found for ${politicianName}`);
      continue;
    }

    console.log(`Found ${promises.length} promises for ${politicianName}`);

    for (const promise of promises) {
      console.log(`\n--- Promise: ${promise.promise_title.substring(0, 50)}...`);
      console.log(`Current status: ${promise.status}, score: ${promise.fulfillment_score}`);

      // Search for new evidences
      const evidences = await searchSerper(`${promise.politician_name} ${promise.promise_title} ${promise.category || ''}`);

      if (evidences.length > 0) {
        console.log(`Found ${evidences.length} new evidences`);

        // Insert new evidences
        for (const ev of evidences) {
          await supabase.from('promise_evidences').insert({
            promise_id: promise.id,
            politician_name: promise.politician_name,
            promise_title: promise.promise_title,
            titulo: ev.titulo,
            descricao: ev.descricao,
            fonte: ev.fonte,
            url: ev.url,
            data_publicacao: ev.data,
            tipo: ev.credible ? 'oficial' : 'jornal',
            confiabilidade: ev.credible ? 90 : 50,
            discovered_at: new Date().toISOString(),
            validated: ev.credible,
            needs_review: !ev.credible
          }).catch(() => {});
        }

        // Get all evidences for this promise
        const { data: allEvidences } = await supabase
          .from('promise_evidences')
          .select('titulo, descricao, url, fonte, data_publicacao')
          .eq('promise_id', promise.id)
          .limit(10);

        // Evaluate with Groq
        const result = await evaluateWithGroq(promise, allEvidences || []);

        console.log(`New evaluation: status=${result.status}, score=${result.score}`);
        console.log(`Justification: ${result.justification.substring(0, 100)}...`);

        // Update promise
        await supabase.from('promises').update({
          status: result.status,
          fulfillment_score: result.score,
          ai_evaluation: result.justification,
          last_verified_at: new Date().toISOString()
        }).eq('id', promise.id);

        // Insert into promise_explanations
        await supabase.from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id).catch(() => {});
        await supabase.from('promise_explanations').insert({
          promise_id: promise.id,
          status: result.status,
          fulfillment_score: result.score,
          criterio_aplicado: 'force_reavaliation_script',
          justificativa: result.justification,
          evidencias_usadas: result.evidencesUsed,
          o_que_falta: result.score > 80 ? 'Revisão humana necessária' : 'Completo',
          o_que_foi_feito: result.justification,
          confianca: result.score > 80 ? 50 : 85,
          modelo_ia: 'force-reavaliation-v1',
          is_latest: true,
          gerado_em: new Date().toISOString()
        }).catch(() => {});

        console.log(`✓ Updated successfully`);
      } else {
        console.log('No evidences found, skipping');
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n=== Force Reavaliation Complete ===');
}

run().catch(console.error);