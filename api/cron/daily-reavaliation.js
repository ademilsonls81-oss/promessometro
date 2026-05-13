import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function requireCronSecret(req, res) {
  if (process.env.NODE_ENV !== 'production') return true;
  const secret = req.headers['x-cron-secret'] || req.query?.secret;
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

async function evaluateWithAI(promise) {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

  const evidenceController = new AbortController();
  const timeout = setTimeout(() => evidenceController.abort(), 15000);

  let evidences = [];
  if (TAVILY_API_KEY && TAVILY_API_KEY !== 'YOUR_TAVILY_API_KEY') {
    try {
      const tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': TAVILY_API_KEY },
        body: JSON.stringify({
          query: `${promise.politician_name || ''} ${promise.promise_title || ''} ${promise.promise_description || ''}`,
          max_results: 5,
          include_answer: true
        }),
        signal: evidenceController.signal
      });
      if (tavilyRes.ok) {
        const tavilyData = await tavilyRes.json();
        evidences = (tavilyData.results || []).map(r => ({
          descricao: r.content || '',
          fonte: r.source || '',
          url: r.url || '',
          data: r.published_date || null
        }));
      }
    } catch (_) { /* Tavily failed, continue without evidence */ }
  }
  clearTimeout(timeout);

  const evidenceText = evidences.length > 0
    ? evidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url || 'sem URL'}, ${e.data || 'sem data'})`).join('\n')
    : 'Nenhuma evidência encontrada.';

  const prompt = `Você é um avaliador independente de promessas políticas brasileiras.

PROMESSA: ${promise.promise_title || ''}
${promise.promise_description ? `DESCRIÇÃO: ${promise.promise_description}` : ''}
POLÍTICO: ${promise.politician_name || ''}

EVIDÊNCIAS ENCONTRADAS:
${evidenceText}

CRITÉRIOS:
| Status | Score | Quando usar |
| cumprida | 80-100 | Ação concluída com prova verificável |
| parcialmente_cumprida | 40-79 | Progresso parcial demonstrado |
| em_andamento | 20-39 | Processo iniciado sem entrega final |
| nao_iniciada | 0-19 | Nenhuma ação verificável |
| descumprida | 0 | Ação contrária |

REGRAS:
- Com 0 evidências: score máximo 30, status deve ser "nao_iniciada" ou "em_andamento"
- Score > 70 SÓ é permitido com evidência verificável com URL real
- Responda SOMENTE com JSON válido (sem markdown):
{"status":"status","fulfillment_score":0-100,"justificativa":"explicação","evidencias_usadas":[]}`;

  try {
    const groqRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1024
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq error ${groqRes.status}: ${errText}`);
    }

    const data = await groqRes.json();
    let text = (data.choices?.[0]?.message?.content || '{}')
      .replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};

    return {
      status: parsed.status || 'nao_classificada',
      fulfillment_score: parsed.fulfillment_score || 50,
      justification: parsed.justificativa || '',
      evidences_used: parsed.evidencias_usadas || [],
      needs_human_review: false,
      inconsistency: ''
    };
  } catch (err) {
    throw new Error(`AI evaluation failed: ${err.message}`);
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireCronSecret(req, res)) return;

  console.log('[Cron] Daily reavaliation started');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: promises } = await supabase
    .from('promises')
    .select('id, promise_title, promise_description, politician_name, category, status, fulfillment_score')
    .in('status', ['em_andamento', 'parcialmente_cumprida', 'nao_classificada', 'nao_iniciada'])
    .gt('updated_at', thirtyDaysAgo)
    .limit(50);

  if (!promises || promises.length === 0) {
    console.log('[Cron] No promises to reavaliate');
    return res.status(200).json({ status: 'ok', promises_evaluated: 0, promises_failed: 0, timestamp: new Date().toISOString() });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') {
    console.error('[Cron] GROQ_API_KEY not configured');
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  let evaluated = 0;
  let failed = 0;

  for (const promise of promises) {
    try {
      const result = await evaluateWithAI(promise);

      const { error: updateError } = await supabase
        .from('promises')
        .update({
          status: result.status,
          fulfillment_score: result.fulfillment_score,
          ai_evaluation: result.justification,
          evidences_used: result.evidences_used,
          needs_human_review: result.needs_human_review,
          updated_at: new Date().toISOString()
        })
        .eq('id', promise.id);

      if (updateError) {
        console.error(`[Cron] Failed to update promise ${promise.id}:`, updateError.message);
        failed++;
      } else {
        evaluated++;
        console.log(`[Cron] Evaluated: ${promise.promise_title} → ${result.status} (${result.fulfillment_score})`);
      }
    } catch (e) {
      console.error(`[Cron] Failed to evaluate promise ${promise.id}:`, e.message);
      failed++;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[Cron] Complete: ${evaluated} evaluated, ${failed} failed`);
  return res.status(200).json({
    status: 'ok',
    promises_evaluated: evaluated,
    promises_failed: failed,
    timestamp: new Date().toISOString()
  });
}