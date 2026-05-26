import { createClient } from '@supabase/supabase-js';
import { evaluateWithAI, filterSocialMedia } from '../lib/evaluatePromise.js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function db() { return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY); }

const PENDENTE_STATUSES = ['pendente', 'nao_iniciada', 'nao_classificada'];
const BATCH = 10;
const TIME_BUDGET_MS = 8000;

export default async function handler(req, res) {
  const start = Date.now();
  const cronExecutionId = `cron_${start}`;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.query?.secret || req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const { count: remaining } = await db()
    .from('promises')
    .select('id', { count: 'exact', head: true })
    .in('status', PENDENTE_STATUSES);

  if (!remaining || remaining === 0)
    return res.json({ processed: 0, failed: 0, remaining: 0, hasMore: false });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: promises } = await db()
    .from('promises')
    .select('id, politician_id, politician_name, promise_title, status, fulfillment_score, source_link')
    .in('status', PENDENTE_STATUSES)
    .or(`last_verified_at.is.null,last_verified_at.lt.${oneHourAgo}`)
    .order('last_verified_at', { ascending: true, nullsFirst: true })
    .limit(BATCH);

  let processed = 0, failed = 0;
  const budgetStart = Date.now();
  const polIds = new Set();
  const promisesData = [];

  for (const promise of promises || []) {
    const pStart = Date.now();
    try {
      const result = await Promise.race([
        evaluateWithAI(promise),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 25000))
      ]);
      const pTime = Date.now() - pStart;
      const { error: upErr } = await db().from('promises').update({
        status: result.status, fulfillment_score: result.fulfillment_score,
        ai_evaluation: result.justification,
        evidences_used: filterSocialMedia(result.evidences).slice(0, 5),
        complexity_score: result.complexity, impact_score: result.impact,
        o_que_foi_feito: (result.o_que_foi_feito || '').substring(0, 2000),
        o_que_falta: (result.o_que_falta || '').substring(0, 2000),
        needs_human_review: result.evaluated_with_fallback || false,
        last_verified_at: new Date().toISOString()
      }).eq('id', promise.id);
      if (!upErr) {
        processed++;
        if (promise.politician_id) polIds.add(promise.politician_id);
        const entry = {
          promise_id: promise.id,
          politician_id: promise.politician_id,
          status_resultado: result.status,
          fulfillment_score: result.fulfillment_score,
          justificativa_ia: result.justification || '',
          fontes: (result.evidences || []).filter(e => e.url && e.url !== '#').map(e => ({ url: e.url, fonte: e.fonte })),
          o_que_foi_feito: result.o_que_foi_feito || '',
          o_que_falta: result.o_que_falta || '',
          modelo_ia: result.evaluated_with_fallback ? 'fallback' : 'llama-3.1-8b-instant',
          duracao_ms: pTime,
          fallback: result.evaluated_with_fallback || false,
          cron_execution_id: cronExecutionId
        };
        const { error: histErr } = await db().from('promise_evaluations_history').insert(entry);
        if (histErr) console.error('[cron] Erro ao inserir promise_evaluations_history:', histErr.message);
        promisesData.push({
          id: promise.id,
          politician: promise.politician_name,
          title: promise.promise_title || '',
          result_status: result.status,
          score: result.fulfillment_score,
          justification: (result.justification || '').substring(0, 2000),
          fontes: entry.fontes,
          o_que_foi_feito: (result.o_que_foi_feito || '').substring(0, 500),
          o_que_falta: (result.o_que_falta || '').substring(0, 500),
          tempo_ms: pTime,
          fallback: result.evaluated_with_fallback || false
        });
      } else failed++;
    } catch {
      promisesData.push({
        id: promise.id,
        politician: promise.politician_name,
        title: promise.promise_title || '',
        result_status: 'erro',
        score: null,
        justification: '',
        fontes: [],
        o_que_foi_feito: '',
        o_que_falta: '',
        tempo_ms: Date.now() - pStart,
        fallback: true
      });
      failed++;
    }
    // Budget check: stop if we've used more than TIME_BUDGET_MS (prevents 10s Vercel Hobby timeout)
    if (Date.now() - budgetStart > TIME_BUDGET_MS) break;
  }

  for (const polId of polIds) {
    try { const { recalcPoliticianScores } = await import('./daily-reavaliation.js'); if (recalcPoliticianScores) await recalcPoliticianScores(polId); } catch {}
  }

  const durationMs = Date.now() - start;
  const remainingAfter = Math.max(0, (remaining || 0) - processed - failed);

  try {
    await db().from('cron_logs').insert({
      processed, failed, remaining: remainingAfter, duration_ms: durationMs,
      cron_execution_id: cronExecutionId,
      promises_data: JSON.stringify(promisesData)
    });
  } catch (e) {
    console.error('[cron] Erro ao salvar log:', e.message);
  }

  res.json({ processed, failed, remaining: remainingAfter, hasMore: remainingAfter > 0 });
}
