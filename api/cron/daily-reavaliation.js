import { createClient } from '@supabase/supabase-js';
import { prioritizeSources, getUrlDomain } from '../lib/sourceLevel.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// Redes sociais bloqueadas como fonte de evidência
const SOCIAL_DOMAINS = ['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com'];

function isSocialMedia(url) {
  const domain = getUrlDomain(url);
  if (!domain) return false;
  return SOCIAL_DOMAINS.some(s => domain === s || domain.endsWith('.' + s));
}

function filterSocialMedia(evidences) {
  return (evidences || []).filter(ev => !isSocialMedia(ev.url));
}

const STATUS_CONFIG = {
  cumprida:             { min: 80, max: 100, base: 90 },
  parcialmente_cumprida: { min: 40, max: 79, base: 55 },
  em_andamento:         { min: 40, max: 79, base: 50 },
  nao_iniciada:         { min: 0,  max: 39, base: 20 },
  descumprida:          { min: 0,  max: 0,  base: 0  },
  nao_classificada:     { min: 0,  max: 39, base: 20 },
  pendente:             { min: 0,  max: 39, base: 20 },
  parcial:              { min: 40, max: 79, base: 55 },
  quebrada:             { min: 0,  max: 0,  base: 0  },
};

function extractHostname(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url.split('/')[2]?.replace('www.', '') || '';
  }
}

function mapStatusToFrontend(aiStatus) {
  const map = {
    'cumprida': 'cumprida', 'parcialmente_cumprida': 'parcial',
    'em_andamento': 'parcial', 'nao_iniciada': 'pendente',
    'nao_classificada': 'pendente', 'pendente': 'pendente',
    'descumprida': 'quebrada', 'parcial': 'parcial', 'quebrada': 'quebrada'
  };
  return map[aiStatus] || 'pendente';
}

function clampScore(status, score) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  return Math.max(cfg.min, Math.min(cfg.max, Math.round(score)));
}

function requireCronSecret(req, res) {
  const raw = JSON.stringify(req.headers || {});
  const headers = raw.toLowerCase();
  const isCron = headers.includes('vercel-cron') || headers.includes('vercel/internal');
  if (isCron) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  const secret = req.headers['x-cron-secret'] || req.query?.secret;
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return false;
  }
  return true;
}

async function sendSlackAlert(message, data) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `*${message}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\`` } }] })
    });
  } catch (e) {
    console.error('[Cron] Slack alert failed:', e.message);
  }
}

function parseSerperDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date().toISOString();
  const lower = dateStr.toLowerCase();
  if (lower.includes('ago') || lower.includes('days') || lower.includes('months') || lower.includes('year') || lower.includes('hours')) {
    return new Date().toISOString();
  }
  const ptMonths = { 'jan': 'Jan', 'fev': 'Feb', 'mar': 'Mar', 'abr': 'Apr', 'mai': 'May', 'jun': 'Jun', 'jul': 'Jul', 'ago': 'Aug', 'set': 'Sep', 'out': 'Oct', 'nov': 'Nov', 'dez': 'Dec' };
  const monthMatch = dateStr.match(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i);
  if (monthMatch) {
    const en = ptMonths[monthMatch[1].toLowerCase()];
    if (en) {
      const replaced = dateStr.replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi, en);
      const parsed = new Date(replaced);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

async function evaluateWithAI(promise) {
  const apiKeyRaw = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
  const apiKey = apiKeyRaw.replace(/^YOUR_.*_KEY$/, '');
  const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
  const SERPER_API_KEY = process.env.SERPER_API_KEY;
  const originalStatus = promise.status || 'pendente';
  const originalScore = promise.fulfillment_score ?? 20;

  // Coleta de evidências
  const evidences = [];
  if (promise.source_link) {
    evidences.push({ descricao: `Fonte original da promessa`, fonte: extractHostname(promise.source_link), url: promise.source_link });
  }

  if (SERPER_API_KEY) {
    try {
      const queries = [
        `"${promise.politician_name}" "${promise.promise_title?.substring(0, 50)}"`,
        `${promise.politician_name} ${promise.promise_title?.substring(0, 40)} resultado`
      ];
      for (const query of queries) {
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_API_KEY },
          body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br', num: 5 })
        });
        if (res.ok) {
          const d = await res.json();
          const results = (d.organic || [])
            .filter(r => !isSocialMedia(r.link || ''))  // FIX B11: filtrar redes sociais
            .map(r => ({
              descricao: r.snippet || '',
              fonte: r.source || extractHostname(r.link) || '',
              url: r.link || '',
              data: parseSerperDate(r.date)
            }));
          evidences.push(...results);
        }
      }
    } catch (_) { }
  }

  // Dedup de domínios
  const seenDomains = new Set();
  const dedupedEvidences = evidences.filter(ev => {
    if (!ev.url) return false;
    if (isSocialMedia(ev.url)) return false; // FIX B11: garantir sem redes sociais
    const domain = getUrlDomain(ev.url);
    if (!domain || seenDomains.has(domain)) return false;
    seenDomains.add(domain);
    return true;
  });

  if (dedupedEvidences.length === 0) {
    dedupedEvidences.push({
      fonte: "Ausência de Evidências",
      descricao: "Nenhuma evidência ou notícia encontrada na web após varredura automática.",
      url: "#"
    });
  }

  const evText = dedupedEvidences.length > 0
    ? dedupedEvidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url})`).join('\n')
    : 'Nenhuma evidência encontrada.';

  // FIX B5+B6: prompt expandido para retornar `o_que_foi_feito` e `o_que_falta` reais
  const prompt = `Você é um avaliador independente de promessas políticas brasileiras. Analise com rigor.

PROMESSA: "${promise.promise_title}"
POLÍTICO: ${promise.politician_name}

EVIDÊNCIAS ENCONTRADAS:
${evText}

Com base nas evidências acima, avalie a promessa e responda SOMENTE com este JSON:
{
  "status": "cumprida|parcial|pendente|quebrada",
  "fulfillment_score": número entre 0 e 100,
  "justificativa": "Explicação detalhada de mínimo 50 palavras citando as fontes encontradas e o que foi ou não foi feito",
  "o_que_foi_feito": "Descreva concretamente o que já foi realizado ou entregue até agora (mínimo 30 palavras)",
  "o_que_falta": "Descreva o que ainda precisa ser feito para cumprir completamente a promessa (mínimo 20 palavras)",
  "complexity": número de 1 a 3,
  "impact": número de 1 a 3
}

REGRAS DE AVALIAÇÃO:
- cumprida (80-100): evidência verificável de conclusão
- parcial (40-79): progresso concreto mas incompleto
- pendente (0-39): pouco ou nenhum progresso demonstrado
- quebrada (0): ação contrária à promessa ou prazo expirado sem entrega
- Sem evidência com URL real: máximo score 25, status pendente

COMPLEXIDADE (1-3):
1 = Simples: declaração genérica, sem métrica ou prazo
2 = Médio: meta definida com indicador mensurável
3 = Complexo: meta com métricas, prazos e impacto estruturante

IMPACTO (1-3):
1 = Baixo: localizado, afeta grupo restrito
2 = Médio: abrangente, afeta setor ou região
3 = Alto: estruturante, afeta toda a população`;

  try {
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');
    const groqRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1024  // expandido para caber os novos campos
      })
    });
    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);
    const data = await groqRes.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    const mappedStatus = mapStatusToFrontend(parsed.status);
    const score = clampScore(mappedStatus, parsed.fulfillment_score);

    return {
      status: mappedStatus,
      fulfillment_score: score,
      justification: parsed.justificativa || '',
      o_que_foi_feito: parsed.o_que_foi_feito || '',
      o_que_falta: parsed.o_que_falta || '',
      evidences: dedupedEvidences,
      complexity: Math.max(1, Math.min(3, Math.round(parsed.complexity || 1))),
      impact: Math.max(1, Math.min(3, Math.round(parsed.impact || 1)))
    };
  } catch (err) {
    // Fallback: não usar placeholder de herança
    const clampedScore = clampScore(originalStatus, originalScore);
    const mappedFallback = mapStatusToFrontend(originalStatus);
    return {
      status: mappedFallback,
      fulfillment_score: clampedScore,
      justification: `Avaliação baseada no status registrado (${originalStatus}). Sem acesso à IA neste momento: ${err.message}. Reavaliação será feita na próxima execução.`,
      o_que_foi_feito: 'Aguardando reavaliação pela IA na próxima execução do ciclo.',
      o_que_falta: 'Reavaliação completa via IA na próxima execução.',
      evidences: dedupedEvidences,
      complexity: 1,
      impact: 1
    };
  }
}

// Recalcula e salva C1/C2/C3/grade/legacy para um político após reavaliação
async function recalcPoliticianScores(polId) {
  try {
    const { data: pol } = await db().from('politicians').select('*').eq('id', polId).single();
    if (!pol) return;

    const { data: promises } = await db().from('promises').select('id, status, complexity_score, impact_score').eq('politician_id', polId);
    const { data: explanations } = promises?.length
      ? await db().from('promise_explanations').select('promise_id, status, fulfillment_score').in('promise_id', promises.map(p => p.id)).eq('is_latest', true)
      : { data: [] };

    const evalMap = {};
    (explanations || []).forEach(e => evalMap[e.promise_id] = e);

    let f = 0, pa = 0;
    let legacyScore = 0;
    const total = (promises || []).length;
    (promises || []).forEach(p => {
      const ev = evalMap[p.id];
      const s = ev ? (mapStatusToFrontend(ev.status)) : mapStatusToFrontend(p.status);
      if (s === 'cumprida') f++;
      else if (s === 'parcial') pa++;

      const c = p.complexity_score || 1;
      const i = p.impact_score || 1;
      const multiplier = Math.pow(2, c + i);
      if (s === 'cumprida') legacyScore += 1.0 * multiplier;
      else if (s === 'parcial') legacyScore += 0.5 * multiplier;
    });

    const c1 = total > 0 ? parseFloat(((f * 1.0 + pa * 0.5) / total * 100).toFixed(1)) : 0;

    const { data: indicators } = await db().from('indicators').select('*').eq('politician_id', polId);
    const { data: legalFacts } = await db().from('legal_facts').select('*').eq('politician_id', polId);

    const catWeights = { seguranca: 0.30, financas: 0.40, funcionalismo: 0.30 };
    const catScores = { seguranca: [], financas: [], funcionalismo: [] };
    (indicators || []).forEach(ind => { if (ind.score != null && catScores[ind.category]) catScores[ind.category].push(ind.score); });
    let c2WeightSum = 0, c2ScoreSum = 0;
    for (const [cat, scores] of Object.entries(catScores)) {
      if (scores.length > 0) { const avg = scores.reduce((a, b) => a + b, 0) / scores.length; c2ScoreSum += avg * (catWeights[cat] || 0); c2WeightSum += catWeights[cat] || 0; }
    }
    const c2 = c2WeightSum > 0 ? parseFloat((c2ScoreSum / c2WeightSum).toFixed(1)) : null;

    // C3: sem legal_facts = 100 (sem penalidades)
    let c3 = 100;
    const penaltyMap = { 'condemnation': 50, 'investigation': 20, 'alert': 10, 'irregularity': 5 };
    (legalFacts || []).forEach(fact => { if (fact.is_active !== false) c3 -= penaltyMap[fact.fact_type] || 0; });
    c3 = Math.max(0, c3);

    // Fórmula unificada
    const w1 = 0.40, w2 = 0.35, w3 = 0.25;
    let pesoTotal = w1, scorePonderado = c1 * w1;
    if (c2 != null) { scorePonderado += c2 * w2; pesoTotal += w2; }
    scorePonderado += c3 * w3; pesoTotal += w3;
    let finalScore = parseFloat((scorePonderado / pesoTotal).toFixed(1));
    if (c3 < 20) finalScore = Math.min(finalScore, 59);
    const grade = finalScore >= 80 ? 'A' : finalScore >= 60 ? 'B' : finalScore >= 40 ? 'C' : finalScore >= 20 ? 'D' : 'F';

    await db().from('politicians').update({
      c1_score: c1, c2_score: c2, c3_score: c3,
      final_score: finalScore, grade,
      legacy_score: legacyScore,
      methodology_version: '1.1',
      last_evaluated_at: new Date().toISOString()
    }).eq('id', polId);
  } catch (e) {
    console.error(`[Cron] recalcPoliticianScores failed for ${polId}:`, e.message);
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res)) return;

  const executionId = `reval_${Date.now()}`;
  const startTime = new Date();

  try {
    await db().from('cron_executions').insert({
      execution_id: executionId, trigger: 'vercel_cron',
      status: 'started', started_at: startTime.toISOString()
    });
  } catch (e) { console.error('[Cron] Start log failed:', e.message); }

  let evaluated = 0;
  let failed = 0;
  const polIdsUpdated = new Set();

  try {
    const dailyCutoff = new Date(startTime.getTime() - 23 * 60 * 60 * 1000).toISOString();
    const weeklyCutoff = new Date(startTime.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Busca promessas stale (>23h), nunca verificadas, e cumpridas/quebradas (semanal)
    const [staleRes, neverRes, weeklyRes] = await Promise.all([
      db().from('promises').select('*').lt('last_verified_at', dailyCutoff).not('status', 'in', '("cumprida","quebrada")').limit(8),
      db().from('promises').select('*').is('last_verified_at', null).limit(10),
      db().from('promises').select('*').lt('last_verified_at', weeklyCutoff).in('status', ['cumprida', 'quebrada']).limit(5)
    ]);

    const seen = new Set();
    const promises = [];
    for (const p of [...(staleRes.data || []), ...(neverRes.data || []), ...(weeklyRes.data || [])]) {
      if (!seen.has(p.id)) { seen.add(p.id); promises.push(p); }
    }

    if (!promises.length) {
      await db().from('cron_executions').update({ status: 'completed', completed_at: new Date().toISOString(), details: 'No promises found' }).eq('execution_id', executionId);
      return res.status(200).json({ status: 'ok', evaluated: 0, message: 'No stale promises found' });
    }

    console.log(`[Cron] Processing ${promises.length} promises`);

    for (const promise of promises) {
      try {
        const result = await evaluateWithAI(promise);
        const previousStatus = promise.status;

        const { error: upErr } = await db().from('promises').update({
          status: result.status,
          fulfillment_score: result.fulfillment_score,
          ai_evaluation: result.justification,
          evidences_used: filterSocialMedia(result.evidences).slice(0, 5),
          complexity_score: result.complexity,
          impact_score: result.impact,
          last_verified_at: new Date().toISOString()
        }).eq('id', promise.id);

        if (!upErr) {
          evaluated++;
          if (promise.politician_id) polIdsUpdated.add(promise.politician_id);

          // status_history
          try {
            await db().from('status_history').insert({
              promise_id: promise.id,
              old_status: previousStatus,
              new_status: result.status
            });
          } catch (shErr) { console.error(`[Cron] status_history:`, shErr.message); }

          // promise_explanations — FIX B5/B6/B11/B13
          try {
            await db().from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id);
            await db().from('promise_explanations').insert({
              promise_id: promise.id,
              status: result.status,
              fulfillment_score: result.fulfillment_score,
              criterio_aplicado: 'ai_reavaliation_v2',   // FIX B13: não usa herança
              justificativa: result.justification,         // FIX B5: campo real
              evidencias_usadas: prioritizeSources(        // FIX B11: já filtrado
                filterSocialMedia(result.evidences).map(e => ({
                  descricao: e.descricao, fonte: e.fonte, url: e.url, data: e.data
                }))
              ),
              o_que_falta: result.o_que_falta || 'Monitoramento contínuo',  // FIX B6
              o_que_foi_feito: result.o_que_foi_feito || result.justification, // FIX B6
              confianca: result.evidences.length >= 2 ? 0.80 : 0.60,
              modelo_ia: 'llama-3.1-8b-instant',
              is_latest: true,
              gerado_em: new Date().toISOString()
            });
          } catch (peErr) { console.error(`[Cron] promise_explanations:`, peErr.message); }

          // audit_log
          try {
            await db().from('audit_logs').insert({
              action: 'promise_reavaluated',
              entity_type: 'promises',
              entity_id: promise.id,
              details: JSON.stringify({
                promise_id: promise.id,
                old_status: previousStatus, new_status: result.status,
                score: result.fulfillment_score, execution_id: executionId
              })
            });
          } catch (alErr) { console.error(`[Cron] audit_logs:`, alErr.message); }
        } else {
          console.error(`[Cron] Update failed for ${promise.id}:`, upErr.message);
          failed++;
        }
      } catch (e) {
        console.error(`[Cron] Fail ${promise.id}:`, e.message);
        failed++;
      }
      await new Promise(r => setTimeout(r, 300));
    }

    // Recalcular scores dos políticos afetados
    for (const polId of polIdsUpdated) {
      await recalcPoliticianScores(polId);
      await new Promise(r => setTimeout(r, 100));
    }

    await db().from('cron_executions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      promises_evaluated: evaluated,
      promises_failed: failed
    }).eq('execution_id', executionId);

    try {
      await db().from('daily_monitor_log').insert({
        monitor_name: 'daily_reavaliation',
        promises_processed: evaluated,
        errors: failed > 0 ? JSON.stringify({ failed }) : null,
        started_at: startTime.toISOString(),
        completed_at: new Date().toISOString()
      });
    } catch (_) { }

    // Alerta Slack se zero promessas avaliadas
    if (evaluated === 0 && promises.length > 0) {
      await sendSlackAlert('⚠️ Cron sem avaliações', { total: promises.length, evaluated, failed });
    }

    // Processa discovery jobs (1 por execucao) — pendentes ou processing incompletos
    let discoveryProcessed = 0;
    try {
      const { data: pendingJobs } = await db()
        .from('discovery_jobs')
        .select('*')
        .or(`status.eq.pending,status.eq.processing`)
        .order('created_at', { ascending: true })
        .limit(10);
      const incomplete = (pendingJobs || []).find(j =>
        j.status === 'pending' ||
        (j.status === 'processing' && (
          j.total_pages === null || j.total_pages === 0 ||
          (j.current_page || 0) < (j.total_pages || 0)
        ))
      );
      if (incomplete) {
        const { default: discoveryProcessor } = await import('./discovery-processor.js');
        await discoveryProcessor({ _specificJobId: incomplete.id }, {
          json: () => {}, status: () => ({ json: () => {} })
        });
        discoveryProcessed = 1;
      }
    } catch (e) {
      console.error('[Cron] discovery job error:', e.message);
    }

    return res.status(200).json({
      status: 'ok', evaluated, failed,
      politicians_updated: polIdsUpdated.size,
      discovery_processed: discoveryProcessed
    });

  } catch (err) {
    console.error(`[Cron] FATAL: ${err.message}`);
    await db().from('cron_executions').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      details: err.message
    }).eq('execution_id', executionId);
    return res.status(500).json({ error: err.message });
  }
}