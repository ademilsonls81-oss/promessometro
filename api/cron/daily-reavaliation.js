import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_S_URL || 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const CRON_SECRET = process.env.CRON_SECRET || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const AI_MODEL = 'llama-3.3-70b-versatile';

function validateSecret(req) {
  const headerSecret = req.headers['x-cron-secret'];
  const querySecret = new URL(req.url, 'https://base').searchParams.get('secret');
  return headerSecret === CRON_SECRET || querySecret === CRON_SECRET;
}

async function getPromisesForEvaluation() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 23);

  const { data, error } = await supabase
    .from('promises')
    .select('id, politician_name, promise_title, category, status, fulfillment_score, texto_original, politician_id')
    .or(`last_verified_at.lt.${cutoff.toISOString()},last_verified_at.is.null`)
    .limit(20);

  if (error) throw new Error(`Erro ao buscar promessas: ${error.message}`);
  return data || [];
}

async function getEvidences(promiseId) {
  const { data } = await supabase
    .from('promise_evidences')
    .select('*')
    .eq('promise_id', promiseId)
    .in('validation_status', ['pending', 'validated'])
    .order('created_at', { ascending: false })
    .limit(10);
  return data || [];
}

async function evaluateWithGroq(promise, evidences) {
  const evidenceText = evidences.length > 0
    ? evidences.map(e => `  - [${e.source_name}]: ${e.description || e.title} (url: ${e.url || 'N/A'})`).join('\n')
    : '  Nenhuma evidência encontrada.';

  const prompt = `Você é um avaliador imparcial de promessas políticas brasileiras.

REGRAS:
1. Seja neutro e técnico — sem opinião política
2. Baseie-se APENAS nas evidências fornecidas
3. Se não houver evidências, score máximo é 30
4. Nunca invente evidências ou fontes
5. Responda APENAS com JSON válido

PROMESSA:
Político: ${promise.politician_name}
Título: ${promise.promise_title}
Categoria: ${promise.category || 'Geral'}
Texto original: ${promise.texto_original || promise.promise_title}

EVIDÊNCIAS:
${evidenceText}

Responda com este JSON exato:
{
  "status": "cumprida|parcial|pendente|nao_classificada",
  "fulfillment_score": 0-100,
  "criterio_aplicado": "nome do critério",
  "justificativa": "explicação clara em linguagem cidadã",
  "evidencias_usadas": [{"descricao": "...", "fonte": "...", "url": "..."}],
  "o_que_foi_feito": "o que já aconteceu",
  "o_que_falta": "o que ainda falta",
  "confianca": 0.0-1.0,
  "motivo_confianca": "explicação da confiança"
}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000
    })
  });

  if (!response.ok) throw new Error(`Groq error: ${response.status}`);

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const clean = content.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function saveExplanation(promiseId, result) {
  await supabase
    .from('promise_explanations')
    .update({ is_latest: false })
    .eq('promise_id', promiseId)
    .eq('is_latest', true);

  await supabase.from('promise_explanations').insert({
    promise_id: promiseId,
    status: result.status,
    fulfillment_score: result.fulfillment_score,
    criterio_aplicado: result.criterio_aplicado,
    justificativa: result.justificativa,
    evidencias_usadas: result.evidencias_usadas || [],
    o_que_foi_feito: result.o_que_foi_feito,
    o_que_falta: result.o_que_falta,
    confianca: result.confianca,
    motivo_confianca: result.motivo_confianca,
    modelo_ia: AI_MODEL,
    is_latest: true
  });

  await supabase
    .from('promises')
    .update({
      status: result.status,
      fulfillment_score: result.fulfillment_score,
      last_verified_at: new Date().toISOString()
    })
    .eq('id', promiseId);
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (!validateSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const started = Date.now();
  let evaluated = 0;
  let failed = 0;

  try {
    const promises = await getPromisesForEvaluation();

    for (const promise of promises) {
      try {
        const evidences = await getEvidences(promise.id);
        const result = await evaluateWithGroq(promise, evidences);
        await saveExplanation(promise.id, result);
        evaluated++;
      } catch (err) {
        console.error(`Erro ao avaliar promessa ${promise.id}:`, err.message);
        failed++;
      }
    }

    await supabase.from('daily_monitor_log').insert({
      monitor_name: 'daily-reavaliation',
      promises_processed: evaluated,
      new_evidences_found: 0,
      errors: failed > 0 ? `${failed} promessas falharam` : null,
      completed_at: new Date().toISOString()
    });

    return res.status(200).json({
      status: 'ok',
      evaluated,
      failed,
      duration_ms: Date.now() - started,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, timestamp: new Date().toISOString() });
  }
}
