import { createClient } from '@supabase/supabase-js';
import { prioritizeSources } from '../lib/sourceLevel.js';
import { evaluateWithAI, filterSocialMedia, mapStatusToFrontend } from '../lib/evaluatePromise.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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

// evaluateWithAI importada de ../lib/evaluatePromise.js

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

    const PENDENTE_STATUSES = ['pendente', 'nao_iniciada', 'nao_classificada'];

    // Busca promessas pendentes (nunca avaliadas + stale), stale (>23h), e cumpridas/quebradas (semanal)
    const [pendingNew, pendingStale, staleRes, neverRes, weeklyRes] = await Promise.all([
      db().from('promises').select('*').is('last_verified_at', null).in('status', PENDENTE_STATUSES).limit(10),
      db().from('promises').select('*').lt('last_verified_at', dailyCutoff).in('status', PENDENTE_STATUSES).limit(5),
      db().from('promises').select('*').lt('last_verified_at', dailyCutoff).not('status', 'in', '("cumprida","quebrada")').limit(30),
      db().from('promises').select('*').is('last_verified_at', null).limit(15),
      db().from('promises').select('*').lt('last_verified_at', weeklyCutoff).in('status', ['cumprida', 'quebrada']).limit(5)
    ]);

    const seen = new Set();
    const promises = [];
    // Priority 0: promessas pendentes nunca avaliadas (são as que mais precisam)
    for (const p of (pendingNew.data || [])) {
      if (!seen.has(p.id)) { seen.add(p.id); promises.push(p); }
    }
    // Priority 0.5: promessas pendentes stale (já avaliadas mas ainda pendentes)
    for (const p of (pendingStale.data || [])) {
      if (!seen.has(p.id)) { seen.add(p.id); promises.push(p); }
    }
    // Priority 1: never evaluated (last_verified_at = null)
    for (const p of (neverRes.data || [])) {
      if (!seen.has(p.id)) { seen.add(p.id); promises.push(p); }
    }
    // Priority 2: stale pending promises WITHOUT real evidence (skip already-evaluated)
    for (const p of (staleRes.data || [])) {
      if (seen.has(p.id)) continue;
      const ev = p.evidences_used;
      const hasRealEvidence = ev && Array.isArray(ev) && ev.length > 0 && ev.some(e => e.url && e.url !== '#');
      if (hasRealEvidence) continue;
      if (promises.length >= 20) break;
      seen.add(p.id); promises.push(p);
    }
    // Priority 3: cumprida/quebrada stale (weekly re-check)
    for (const p of (weeklyRes.data || [])) {
      if (!seen.has(p.id)) { seen.add(p.id); promises.push(p); }
    }

    if (!promises.length) {
      await db().from('cron_executions').update({ status: 'completed', completed_at: new Date().toISOString(), details: 'No promises found' }).eq('execution_id', executionId);
      return res.status(200).json({ status: 'ok', evaluated: 0, message: 'No stale promises found' });
    }

    console.log(`[Cron] Processing ${promises.length} promises`);

    for (const promise of promises) {
      try {
        const result = await Promise.race([
          evaluateWithAI(promise),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 25000))
        ]);
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

export { recalcPoliticianScores };