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
          query: `${promise.politician_name || ''} ${promise.promise_title || ''}`,
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
POLÍTICO: ${promise.politician_name || ''}

EVIDÊNCIAS ENCONTRADAS:
${evidenceText}

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
- Responda SOMENTE com JSON (sem markdown):
{"status":"status","fulfillment_score":0-100,"justificativa":"explicação clara"}`;

  try {
    const groqRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 512
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq ${groqRes.status}: ${errText}`);
    }

    const data = await groqRes.json();
    let text = (data.choices?.[0]?.message?.content || '{}')
      .replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};

    const score = parsed.fulfillment_score ?? 50;

    if (evidences.length === 0 && score > 30) {
      return {
        status: 'nao_iniciada',
        fulfillment_score: Math.min(score, 30),
        justification: parsed.justificativa || 'Sem evidências disponíveis — atribuído score máximo de 30',
        evidences_used: [],
        needs_human_review: true
      };
    }

    return {
      status: parsed.status || 'nao_classificada',
      fulfillment_score: score,
      justification: parsed.justificativa || '',
      evidences_used: evidences,
      needs_human_review: score > 80 || !evidences.length
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

  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();

  const { data: stale, error: e1 } = await supabase
    .from('promises')
    .select('id, promise_title, category, status, fulfillment_score, last_verified_at, politician_name')
    .lt('last_verified_at', cutoff)
    .limit(25);

  const { data: never, error: e2 } = await supabase
    .from('promises')
    .select('id, promise_title, category, status, fulfillment_score, last_verified_at, politician_name')
    .is('last_verified_at', null)
    .limit(25);

  if (e1) console.error('[Cron] stale error:', e1.message);
  if (e2) console.error('[Cron] never error:', e2.message);

  const seenIds = new Set();
  const promises = [];
  for (const p of [...(stale || []), ...(never || [])]) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      promises.push(p);
    }
  }

  if (promises.length === 0) {
    return res.status(200).json({
      status: 'ok',
      promises_evaluated: 0,
      promises_failed: 0,
      timestamp: new Date().toISOString()
    });
  }

  console.log(`[Cron] Found ${promises.length} promises to evaluate`);

  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') {
    console.error('[Cron] GROQ_API_KEY not configured');
    return res.status(500).json({ status: 'error', error: 'GROQ_API_KEY not configured' });
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
          last_verified_at: new Date().toISOString()
        })
        .eq('id', promise.id);

      if (updateError) {
        console.error(`[Cron] ✗ ${promise.id}: ${updateError.message}`);
        failed++;
        continue;
      }

      await supabase.from('status_history').insert({
        promise_id: promise.id,
        previous_status: promise.status,
        new_status: result.status,
        previous_score: promise.fulfillment_score,
        new_score: result.fulfillment_score,
        changed_by: 'cron_daily_reavaliation',
        change_reason: result.justification || 'Reavaliação automática diária',
        evaluation_type: 'ai_auto'
      }).catch(() => { /* status_history table may not exist */ });

      await supabase.from('audit_logs').insert({
        action: 'cron_reavaliation',
        table_name: 'promises',
        record_id: promise.id,
        old_value: { status: promise.status, score: promise.fulfillment_score },
        new_value: { status: result.status, score: result.fulfillment_score },
        performed_by: 'cron',
        details: { promise_title: promise.promise_title, politician: promise.politician_name }
      }).catch(() => { /* audit_logs table may not exist */ });

      evaluated++;
      console.log(`[Cron] ✓ ${promise.promise_title} → ${result.status} (${result.fulfillment_score})`);
    } catch (e) {
      console.error(`[Cron] ✗ ${promise.id}: ${e.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[Cron] Done: ${evaluated} ok, ${failed} failed`);
  return res.status(200).json({
    status: 'ok',
    promises_evaluated: evaluated,
    promises_failed: failed,
    timestamp: new Date().toISOString()
  });
}