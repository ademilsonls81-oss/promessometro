import { createClient } from '@supabase/supabase-js';
import { evaluateWithAI } from '../lib/evaluatePromise.js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const secret = req.query?.secret || req.headers['x-cron-secret'];
  if (secret !== process.env.ADMIN_SECRET_KEY && secret !== process.env.CRON_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });

  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'Missing ?id= parameter' });

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: promise, error } = await db
    .from('promises')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!promise) return res.status(404).json({ error: 'Promise not found' });

  const result = await evaluateWithAI(promise);

  res.json({
    id: promise.id,
    title: promise.promise_title,
    politician: promise.politician_name,
    score: result.fulfillment_score,
    status: result.status,
    motivo_score: result.justification?.substring(0, 3000),
    o_que_foi_concluido: (result.o_que_foi_feito || '').split('\n').filter(Boolean),
    o_que_falta: (result.o_que_falta || '').split('\n').filter(Boolean),
    evidencias: result.evidences?.filter(e => e.url && e.url !== '#') || [],
    confianca: result.confianca ?? null,
    motivo_confianca: result.motivo_confianca ?? '',
    modelo_ia: result.modelo_ia || 'gemini-2.5-flash',
    fallback: result.evaluated_with_fallback || false,
    duration_ms: null,
  });
}
