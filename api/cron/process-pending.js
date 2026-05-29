import { createClient } from '@supabase/supabase-js';
import { groqEvaluate } from '../lib/groqEvaluate.js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUDGET_MS = 8500;

function normStatus(s) {
  if (!s) return 'pendente';
  const m = { cumprida: 'cumprida', parcialmente_cumprida: 'parcial', parcial: 'parcial', pendente: 'pendente', nao_iniciada: 'pendente', nao_classificada: 'pendente', quebrada: 'quebrada' };
  return m[s.toLowerCase()] || 'pendente';
}

function clampStatus(score, status) {
  if (score >= 80) return 'cumprida';
  if (score >= 40) return 'parcial';
  if (score <= 0) return 'quebrada';
  return 'pendente';
}

function db() { return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY); }

export default async function handler(req, res) {
  const start = Date.now();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.query?.secret || req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: promises } = await db()
      .from('promises')
      .select('id, promise_title, politician_name, category, politician_id, status')
      .eq('status', 'pendente')
      .or('classificacao_ia.is.null,classificacao_ia->>modelo.not.ilike.%groq%')
      .limit(1);

    if (!promises?.length) return res.json({ processed: 0, failed: 0, remaining: 0, hasMore: false, ms: Date.now() - start });

    const promise = promises[0];
    const result = await groqEvaluate(promise);
    const score = result.score ?? 0;
    const status = clampStatus(score, result.status || 'pendente');
    const evidenciaJson = result.evidencias?.slice(0, 8).map(e => ({ titulo: e.title, url: e.url, resumo: e.snippet || '' })) || [];

    await db().from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id).eq('is_latest', true);
    await db().from('promise_explanations').insert({
      promise_id: promise.id, status, fulfillment_score: score,
      criterio_aplicado: 'process_pending',
      justificativa: result.motivo || '',
      evidencias_usadas: evidenciaJson,
      confianca: result.confianca ?? 0,
      modelo_ia: result.modelo || 'unknown', is_latest: true,
      gerado_em: new Date().toISOString()
    });

    const { error: upErr } = await db().from('promises').update({
      status, fulfillment_score: score,
      classificacao_ia: { score, status, modelo: result.modelo || 'unknown', classified_at: new Date().toISOString() },
      updated_at: new Date().toISOString()
    }).eq('id', promise.id);

    const failed = upErr ? 1 : 0;
    const processed = failed ? 0 : 1;

    const { count: remaining } = await db().from('promises').select('*', { count: 'exact', head: true }).eq('status', 'pendente');
    return res.json({ processed, failed, remaining, hasMore: remaining > 0, ms: Date.now() - start });
  } catch (err) {
    console.error('[Cron] FATAL:', err.message);
    return res.status(500).json({ error: err.message, ms: Date.now() - start });
  }
}
