import { createClient } from '@supabase/supabase-js';
import { evaluateWithAI, filterSocialMedia } from '../lib/evaluatePromise.js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function db() { return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY); }

const PENDENTE_STATUSES = ['pendente', 'nao_iniciada', 'nao_classificada'];
const BATCH = 5;
const TIME_BUDGET_MS = 15000;

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
      let result;
      try {
        result = await Promise.race([
          evaluateWithAI(promise),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 12000))
        ]);
      } catch (raceErr) {
        const elapsed = Date.now() - pStart;
        console.error(`[cron] Promise.race falhou para "${(promise.promise_title||'').substring(0,40)}" (id=${promise.id}) em ${elapsed}ms: ${raceErr.message}`);
        console.error(`[cron] Stack:`, raceErr.stack);
        throw raceErr;
      }
      const pTime = Date.now() - pStart;

      // Skip promise if AI evaluation fell back (no model succeeded) — leave for next run
      if (result.evaluated_with_fallback) {
        console.warn(`[cron] IA indisponivel para "${(promise.promise_title||'').substring(0,40)}" (id=${promise.id}) — pulando para proxima execucao`);
        promisesData.push({
          id: promise.id,
          politician: promise.politician_name,
          title: promise.promise_title || '',
          result_status: 'skipped',
          score: null,
          justification: 'IA indisponivel (todos os modelos falharam)',
          fontes: [], o_que_foi_feito: '', o_que_falta: '',
          tempo_ms: pTime, fallback: true
        });
        // Don't increment processed or failed — leave the promise for next cron run
        continue;
      }

      // Update columns that exist on the promises table
      const { error: upErr } = await db().from('promises').update({
        status: result.status, fulfillment_score: result.fulfillment_score,
        ai_evaluation: result.justification,
        evidences_used: filterSocialMedia(result.evidences).slice(0, 5),
        complexity_score: result.complexity, impact_score: result.impact,
        last_verified_at: new Date().toISOString()
      }).eq('id', promise.id);

      if (upErr) {
        console.error(`[cron] Update falhou para "${(promise.promise_title||'').substring(0,40)}" (id=${promise.id}): ${upErr.message}`);
        failed++;
        continue;
      }

      processed++;
      if (promise.politician_id) polIds.add(promise.politician_id);

      // Insert history entry (promise_evaluations_history)
      const entry = {
        promise_id: promise.id,
        politician_id: promise.politician_id,
        status_resultado: result.status,
        fulfillment_score: result.fulfillment_score,
        justificativa_ia: result.justification || '',
        fontes: (result.evidences || []).filter(e => e.url && e.url !== '#').map(e => ({ url: e.url, fonte: e.fonte })),
        o_que_foi_feito: result.o_que_foi_feito || '',
        o_que_falta: result.o_que_falta || '',
        modelo_ia: result.modelo_ia || 'unknown',
        duracao_ms: pTime,
        fallback: result.evaluated_with_fallback || false,
        cron_execution_id: cronExecutionId
      };
      const { error: histErr } = await db().from('promise_evaluations_history').insert(entry);
      if (histErr) console.error('[cron] Erro ao inserir promise_evaluations_history:', histErr.message);

      // Upsert current explanation in promise_explanations
      try {
        await db().from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id);
        await db().from('promise_explanations').insert({
          promise_id: promise.id,
          status: result.status,
          fulfillment_score: result.fulfillment_score,
          criterio_aplicado: 'process-pending-cron',
          justificativa: result.justification || '',
          evidencias_usadas: (result.evidences || []).slice(0, 5),
          o_que_foi_feito: (result.o_que_foi_feito || '').substring(0, 2000),
          o_que_falta: (result.o_que_falta || '').substring(0, 2000),
          confianca: (result.evidences || []).filter(e => e.url && e.url !== '#').length >= 2 ? 0.80 : 0.60,
          modelo_ia: result.modelo_ia || 'unknown',
          is_latest: true,
          gerado_em: new Date().toISOString()
        });
      } catch (peErr) {
        console.error('[cron] Erro ao inserir promise_explanations:', peErr.message);
      }

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
    } catch (promiseErr) {
      console.error(`[cron] FALHA GERAL em "${(promise.promise_title||'').substring(0,40)}" (id=${promise.id}): ${promiseErr.message}`);
      if (promiseErr.stack) console.error(`[cron] Stack:\n${promiseErr.stack.split('\n').slice(0,8).join('\n')}`);
      promisesData.push({
        id: promise.id,
        politician: promise.politician_name,
        title: promise.promise_title || '',
        result_status: 'erro',
        score: null,
        justification: promiseErr.message || '',
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
