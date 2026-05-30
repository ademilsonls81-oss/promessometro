import { createClient } from '@supabase/supabase-js';
import { groqReevaluate } from '../lib/groqEvaluate.js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = 5;
const BUDGET_MS = 28000;

function db() { return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY); }

function clampStatus(score) {
  if (score >= 80) return 'cumprida';
  if (score >= 40) return 'parcial';
  if (score <= 0) return 'quebrada';
  return 'pendente';
}

export default async function handler(req, res) {
  const start = Date.now();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.query?.secret || req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const results = { processed: 0, failed: 0, errors: [] };
  const client = db();

  try {
    const { data: promises } = await client
      .from('promises')
      .select('id, promise_title, politician_name, category, politician_id, status, fulfillment_score')
      .eq('status', 'pendente')
      .or('classificacao_ia.is.null,classificacao_ia->>modelo.not.ilike.%groq%')
      .limit(BATCH_SIZE);

    if (!promises?.length) {
      return res.json({ processed: 0, failed: 0, remaining: 0, hasMore: false, ms: Date.now() - start });
    }

    for (const promise of promises) {
      try {
        if (Date.now() - start > BUDGET_MS) {
          results.errors.push({ id: promise.id, error: 'Budget time exceeded' });
          break;
        }

        const { data: explanation } = await client
          .from('promise_explanations')
          .select('*')
          .eq('promise_id', promise.id)
          .eq('is_latest', true)
          .single();

        const { data: evidences } = await client
          .from('promise_evidences')
          .select('*')
          .eq('promise_id', promise.id)
          .limit(20);

        const promiseData = {
          promise_title: promise.promise_title || '?',
          politician_name: promise.politician_name || '?'
        };

        const result = await groqReevaluate(promiseData, explanation, evidences);

        if (result.error) {
          results.failed++;
          results.errors.push({ id: promise.id, error: result.error });
          continue;
        }

        const score = result.score ?? 50;
        const status = clampStatus(score);
        const evidenciaJson = result.evidencias_usadas && result.evidencias_usadas.length > 0
          ? result.evidencias_usadas.slice(0, 8)
          : (evidences || []).slice(0, 8).map(e => ({
              titulo: e.title || e.description || '',
              url: e.url || '',
              resumo: e.description || ''
            }));

        await client.from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id).eq('is_latest', true);
        await client.from('promise_explanations').insert({
          promise_id: promise.id,
          status,
          fulfillment_score: score,
          criterio_aplicado: 'cron_process_pending',
          justificativa: result.justificativa || '',
          o_que_foi_feito: result.o_que_foi_feito || '',
          o_que_falta: result.o_que_falta || '',
          evidencias_usadas: evidenciaJson,
          confianca: result.confianca ?? 0.5,
          modelo_ia: result.modelo || 'groq-llama-3.1-8b-instant',
          is_latest: true,
          gerado_em: new Date().toISOString()
        });

        await client.from('promises').update({
          status,
          fulfillment_score: score,
          needs_human_review: true,
          is_automated: true,
          classificacao_ia: { score, status, modelo: result.modelo || 'unknown', classified_at: new Date().toISOString() },
          updated_at: new Date().toISOString()
        }).eq('id', promise.id);

        await client.from('promise_audit_log').insert({
          promise_id: promise.id,
          campo_alterado: 'cron_process_pending',
          valor_novo: JSON.stringify({ status, score, confianca: result.confianca, campos_corrigidos: result.campos_corrigidos }),
          alterado_por: 'cron_process_pending'
        });

        results.processed++;
      } catch (err) {
        results.failed++;
        results.errors.push({ id: promise.id, error: err.message });
      }
    }

    const { count: remaining } = await client
      .from('promises')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .or('classificacao_ia.is.null,classificacao_ia->>modelo.not.ilike.%groq%');

    return res.json({
      ...results,
      remaining: remaining || 0,
      hasMore: (remaining || 0) > 0,
      ms: Date.now() - start
    });
  } catch (err) {
    console.error('[Cron] FATAL:', err.message);
    return res.status(500).json({ error: err.message, ms: Date.now() - start });
  }
}