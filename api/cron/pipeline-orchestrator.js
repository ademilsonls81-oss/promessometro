import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
);

const TAVILY_SOURCES = [
  'g1.globo.com', 'folha.uol.com.br', 'uol.com.br', 'estadao.com.br',
  'metropoles.com', 'cnnbrasil.com.br', 'www12.senado.leg.br', 'www.camara.leg.br',
  'www.planalto.gov.br', 'portaldatransparencia.gov.br', 'agenciabrasil.ebc.com.br',
  'veja.abril.com.br', 'oglobo.globo.com', 'congressoemfoco.uol.com.br', 'noticias.r7.com'
];
const CREDIBLE_DOMAINS = new Set(TAVILY_SOURCES);

function isCredible(url) {
  if (!url) return false;
  const d = url.toLowerCase();
  if (CREDIBLE_DOMAINS.has(d)) return true;
  return d.includes('.gov.br') || d.includes('diariooficial') || d.includes('transparencia') || d.includes('camara.leg.br') || d.includes('senado.leg.br');
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
  return (aiStatus === 'nao_iniciada' || aiStatus === 'nao_classificada') ? 'pendente' : aiStatus;
}

function requireCronSecret(req, res) {
  if (process.env.NODE_ENV !== 'production') return true;
  if (req.headers['x-cron-secret'] || req.query?.secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return false;
  }
  return true;
}

async function searchEv(query, maxResults = 8) {
  const TAVILY = process.env.TAVILY_API_KEY;
  if (TAVILY && TAVILY !== 'YOUR_TAVILY_API_KEY') {
    try {
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': TAVILY },
        body: JSON.stringify({ query, max_results: maxResults, include_answer: true })
      });
      if (r.ok) {
        const d = await r.json();
        return (d.results || []).map(r => {
          const cred = isCredible(r.url);
          return {
            descricao: r.content || r.title || '',
            fonte: r.source || '',
            url: r.url || '',
            data: r.published_date || null,
            credible: cred,
            relevance: Math.round((r.score || 0.5) * 100),
            credibility: cred ? 90 : 50
          };
        });
      }
    } catch (_) { }
    return [];
  }
  const GROQ = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!GROQ) return [];
  try {
    const r = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: `Liste até 5 URLs de fontes jornalísticas brasileiras oficiais sobre: ${query}. JSON: {"links":["url1"]}` }],
        temperature: 0.1, max_tokens: 256
      })
    });
    if (r.ok) {
      const d = await r.json();
      const t = d.choices?.[0]?.message?.content || '{}';
      const m = t.match(/\{[\s\S]*\}/);
      if (m) {
        const p = JSON.parse(m[0]);
        return (p.links || []).map(u => ({
          descricao: `Notícia: ${query}`, fonte: new URL(u).hostname, url: u, data: null, credible: isCredible(u), relevance: 70, credibility: 80
        }));
      }
    }
  } catch (_) { }
  return [];
}

function normalizeUrl(url) {
  try { return new URL(url).toString().split('?')[0].replace(/\/$/, ''); } catch { return url; }
}

async function searchAI(query, promise) {
  const API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  const BASE = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
  const evidences = await searchEv(`${promise.politician_name || ''} ${promise.promise_title || ''} ${promise.category || ''}`);

  const evText = evidences.length > 0
    ? evidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url})`).join('\n')
    : 'Nenhuma evidência encontrada.';

  const prompt = `Você é um avaliador independente de promessas políticas brasileiras.

PROMESSA: ${promise.promise_title || ''}
POLÍTICO: ${promise.politician_name || ''}

EVIDÊNCIAS ENCONTRADAS:
${evText}

CRITÉRIOS:
| Status | Score | Quando usar |
| cumprida | 80-100 | Ação concluída com prova verificável |
| parcialmente_cumprida | 40-79 | Progresso parcial demonstrado |
| em_andamento | 20-39 | Processo iniciado sem entrega final |
| nao_iniciada | 0-19 | Nenhuma ação verificável |
| descumprida | 0 | Ação contrária ou prazo expirado |

REGRAS:
- Sem evidência com URL real: score máximo 30, status "nao_iniciada"
- Score > 70 exige evidência verificável com URL real
- Responda SOMENTE com JSON:
{"status":"status","fulfillment_score":0-100,"justificativa":"explicação clara","evidencias_usadas":[]}`;

  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1, max_tokens: 512
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
      status, score: clampScore(status, score),
      rawScore: score, justification: p.justificativa || '',
      evidences, needsReview: score > 80 || evidences.length === 0
    };
  } catch (err) {
    throw new Error(`AI failed: ${err.message}`);
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res)) return;

  const pipelineId = `pipeline_${Date.now()}`;
  const now = new Date();
  const dailyCutoff = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString();
  const weeklyCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stage = req.query?.stage || 'all';

  console.log(`[Pipeline] ${pipelineId} started at ${now.toISOString()}, stage=${stage}`);

  let step1Discovered = 0, step1Inserted = 0, step1Dupes = 0;
  let step2Updated = 0;
  let step3Evaluated = 0, step3Failed = 0;

  if (stage === 'all' || stage === 'discover') {
    const { data: promises } = await supabase
      .from('promises')
      .select('id, promise_title, politician_name, category, status, evidence_count')
      .not('status', 'eq', 'cumprida').not('status', 'eq', 'descumprida').not('status', 'eq', 'pendente')
      .limit(30);

    if (promises && promises.length > 0) {
      console.log(`[Pipeline:Discover] Processing ${promises.length} promises`);
      for (const promise of promises) {
        try {
          const evidences = await searchEv(`${promise.politician_name || ''} ${promise.promise_title || ''} ${promise.category || ''}`);
          for (const ev of evidences) {
            step1Discovered++;
            const { data: existing } = await supabase.from('promise_evidences')
              .select('id').eq('promise_id', promise.id).ilike('url', `%${normalizeUrl(ev.url).split('/')[2]}%`).limit(1);
            if (existing && existing.length > 0) { step1Dupes++; continue; }
            const sc = Math.round(ev.relevance * 0.4 + ev.credibility * 0.6);
            const { error } = await supabase.from('promise_evidences').insert({
              promise_id: promise.id, politician_name: promise.politician_name, promise_title: promise.promise_title,
              descricao: ev.descricao, fonte: ev.fonte, url: ev.url, data_publicacao: ev.data,
              tipo: ev.credible ? 'oficial' : 'jornal', confiabilidade: sc,
              relevance_score: ev.relevance, credibility_score: ev.credibility,
              discovered_at: now.toISOString(), validated: ev.credible, needs_review: !ev.credible
            });
            if (!error) step1Inserted++;
          }
        } catch (e) { console.error(`[Pipeline:Discover] ✗ ${promise.id}: ${e.message}`); }
        await new Promise(r => setTimeout(r, 300));
      }
    }
    console.log(`[Pipeline:Discover] Done: discovered=${step1Discovered} inserted=${step1Inserted} dupes=${step1Dupes}`);
  }

  if (stage === 'all' || stage === 'count') {
    const { data: promises } = await supabase
      .from('promises')
      .select('id, promise_title')
      .limit(100);

    if (promises) {
      console.log(`[Pipeline:Count] Updating evidence counts for ${promises.length} promises`);
      for (const promise of promises) {
        const { count } = await supabase
          .from('promise_evidences')
          .select('*', { count: 'exact', head: true })
          .eq('promise_id', promise.id)
          .eq('validated', true);
        const { error } = await supabase.from('promises').update({
          evidence_count: count || 0,
          last_verified_at: now.toISOString()
        }).eq('id', promise.id);
        if (!error) step2Updated++;
      }
    }
    console.log(`[Pipeline:Count] Done: updated=${step2Updated}`);
  }

  if (stage === 'all' || stage === 'reavaliate') {
    const { data: staleDaily } = await supabase
      .from('promises')
      .select('id, promise_title, politician_name, category, status, fulfillment_score, last_verified_at, evidence_count')
      .lt('last_verified_at', dailyCutoff)
      .not('status', 'eq', 'cumprida').not('status', 'eq', 'descumprida').not('status', 'eq', 'pendente')
      .limit(20);

    const { data: never } = await supabase
      .from('promises')
      .select('id, promise_title, politician_name, category, status, fulfillment_score, last_verified_at, evidence_count')
      .is('last_verified_at', null)
      .limit(20);

    const { data: staleWeekly } = await supabase
      .from('promises')
      .select('id, promise_title, politician_name, category, status, fulfillment_score, last_verified_at, evidence_count')
      .lt('last_verified_at', weeklyCutoff)
      .in('status', ['cumprida', 'descumprida'])
      .limit(10);

    const seen = new Set();
    const toReavaliate = [];
    for (const p of [...(staleDaily || []), ...(never || []), ...(staleWeekly || [])]) {
      if (!seen.has(p.id)) { seen.add(p.id); toReavaliate.push(p); }
    }

    if (toReavaliate.length > 0) {
      console.log(`[Pipeline:Reavaliate] Processing ${toReavaliate.length} promises`);
      const GROQ = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
      if (!GROQ || GROQ === 'YOUR_GROQ_API_KEY') {
        return res.status(500).json({ status: 'error', error: 'GROQ_API_KEY not configured' });
      }

      for (const promise of toReavaliate) {
        try {
          const result = await searchAI(`${promise.politician_name || ''} ${promise.promise_title || ''}`, promise);
          const frontendStatus = mapToFrontend(result.status);

          const { error: upErr } = await supabase.from('promises').update({
            status: frontendStatus, fulfillment_score: result.score,
            ai_evaluation: result.justification, evidences_used: result.evidences,
            needs_human_review: result.needsReview, last_verified_at: now.toISOString()
          }).eq('id', promise.id);

          if (upErr) { step3Failed++; continue; }

          await supabase.from('status_history').insert({
            promise_id: promise.id, previous_status: promise.status, new_status: frontendStatus,
            previous_score: promise.fulfillment_score, new_score: result.score,
            changed_by: 'pipeline_reavaliation', change_reason: result.justification || 'Pipeline automático',
            evaluation_type: 'ai_auto'
          }).catch(() => { });

          await supabase.from('promise_explanations').insert({
            promise_id: promise.id, status: frontendStatus, fulfillment_score: result.score,
            criterio_aplicado: 'pipeline_auto_evaluation', justificativa: result.justification || 'Avaliação automática via pipeline',
            evidencias_usadas: result.evidences, o_que_falta: result.needsReview ? 'Revisão humana necessária' : 'Completo',
            o_que_foi_feito: result.justification || 'Análise IA.', confianca: result.needsReview ? 50 : 85,
            modelo_ia: 'pipeline-v1-groq', is_latest: true, gerado_em: now.toISOString()
          }).catch(() => { });

          await supabase.from('audit_logs').insert({
            action: 'pipeline_reavaliation', table_name: 'promises', record_id: promise.id,
            old_value: { status: promise.status, score: promise.fulfillment_score },
            new_value: { status: frontendStatus, score: result.score },
            performed_by: 'pipeline', details: {
              promise_title: promise.promise_title, politician: promise.politician_name,
              evidences_count: result.evidences?.length || 0, needs_human_review: result.needsReview
            }
          }).catch(() => { });

          step3Evaluated++;
          console.log(`[Pipeline:Reavaliate] ✓ ${promise.promise_title}: ${promise.status}→${frontendStatus} (${result.score})`);
        } catch (e) {
          console.error(`[Pipeline:Reavaliate] ✗ ${promise.id}: ${e.message}`);
          step3Failed++;
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }
    console.log(`[Pipeline:Reavaliate] Done: evaluated=${step3Evaluated} failed=${step3Failed}`);
  }

  await supabase.from('system_stats').upsert({
    key: 'last_pipeline_run',
    value: now.toISOString(),
    details: JSON.stringify({ pipelineId, evaluated: step3Evaluated, discovered: step1Discovered, inserted: step1Inserted })
  }).catch(() => { });

  const VERCEL_DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK_URL;
  const hasNewData = step1Inserted > 0 || step3Evaluated > 0;
  if (VERCEL_DEPLOY_HOOK && hasNewData) {
    try {
      await fetch(VERCEL_DEPLOY_HOOK, { method: 'POST' });
      console.log('[Pipeline] Deploy hook triggered');
    } catch (e) {
      console.error('[Pipeline] Deploy hook failed:', e.message);
    }
  }

  return res.status(200).json({
    status: 'ok', pipeline_id: pipelineId, stage,
    deploy_triggered: !!(VERCEL_DEPLOY_HOOK && hasNewData),
    steps: { discover: { discovered: step1Discovered, inserted: step1Inserted, dupes: step1Dupes }, count: { updated: step2Updated }, reavaliate: { evaluated: step3Evaluated, failed: step3Failed } },
    timestamp: now.toISOString()
  });
}