import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_S_URL || 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const STATUS_CONFIG = {
  cumprida:             { min: 80, max: 100, base: 90 },
  parcialmente_cumprida: { min: 40, max: 79, base: 45 },
  em_andamento:         { min: 20, max: 39, base: 25 },
  nao_iniciada:         { min: 0,  max: 19, base: 5  },
  descumprida:          { min: 0,  max: 0,  base: 0  },
  nao_classificada:      { min: 0,  max: 100, base: 5 },
  pendente:             { min: 0,  max: 19, base: 5  },
};

function mapStatusToFrontend(aiStatus) {
  if (aiStatus === 'nao_iniciada' || aiStatus === 'nao_classificada') return 'pendente';
  return aiStatus;
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

async function evaluateWithAI(promise) {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
  const SERPER_API_KEY = process.env.SERPER_API_KEY;

  const evidences = [];
  if (promise.source_link) {
    evidences.push({ descricao: `Fonte original`, fonte: new URL(promise.source_link).hostname, url: promise.source_link });
  }

  if (SERPER_API_KEY) {
    try {
      const res = await fetch('https://google.serper.dev/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_API_KEY },
        body: JSON.stringify({ q: `${promise.politician_name || ''} ${promise.promise_title || ''}`, gl: 'br', hl: 'pt', num: 5 })
      });
      if (res.ok) {
        const d = await res.json();
        const results = d.news || d.organic || [];
        evidences.push(...results.map(r => ({ descricao: r.snippet || '', fonte: r.source || '', url: r.link || '' })));
      }
    } catch (_) { }
  }

  const evText = evidences.length > 0 ? evidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url})`).join('\n') : 'Nenhuma evidência encontrada.';
  const prompt = `Avaliador de promessas políticas brasileiras. PROMESSA: ${promise.promise_title}. POLÍTICO: ${promise.politician_name}. EVIDÊNCIAS: ${evText}. Responda JSON: {"status":"status","fulfillment_score":0-100,"justificativa":"explicação"}`;

  try {
    const groqRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } })
    });
    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);
    const data = await groqRes.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const score = clampScore(parsed.status, parsed.fulfillment_score);
    return { status: parsed.status, fulfillment_score: score, justification: parsed.justificativa, evidences };
  } catch (err) { throw new Error(`AI failed: ${err.message}`); }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res)) return;

  const executionId = `reval_${Date.now()}`;
  const startTime = new Date();
  
  // 1. Log START
  try {
    await supabase.from('cron_executions').insert({
      execution_id: executionId,
      trigger: 'vercel_cron',
      status: 'started',
      started_at: startTime.toISOString()
    });
  } catch (e) { console.error('[Cron] Start log failed:', e.message); }

  let evaluated = 0;
  let failed = 0;

  try {
    const dailyCutoff = new Date(startTime.getTime() - 23 * 60 * 60 * 1000).toISOString();
    
    const { data: promises } = await supabase
      .from('promises')
      .select('*')
      .lt('last_verified_at', dailyCutoff)
      .not('status', 'eq', 'cumprida')
      .limit(10);

    if (!promises || promises.length === 0) {
      await supabase.from('cron_executions').update({ status: 'completed', completed_at: new Date().toISOString(), details: 'No promises found' }).eq('execution_id', executionId);
      return res.status(200).json({ status: 'ok', evaluated: 0 });
    }

    for (const promise of promises) {
      try {
        const result = await evaluateWithAI(promise);
        const frontendStatus = mapStatusToFrontend(result.status);
        
        const { error: upErr } = await supabase.from('promises').update({
          status: frontendStatus,
          fulfillment_score: result.fulfillment_score,
          ai_evaluation: result.justification,
          evidences_used: result.evidences,
          last_verified_at: new Date().toISOString()
        }).eq('id', promise.id);

        if (!upErr) evaluated++; else failed++;
      } catch (e) {
        console.error(`[Cron] Fail ${promise.id}:`, e.message);
        failed++;
      }
    }

    // 2. Log SUCCESS
    await supabase.from('cron_executions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      promises_evaluated: evaluated,
      promises_failed: failed
    }).eq('execution_id', executionId);

    // 3. Daily Monitor Log
    await supabase.from('daily_monitor_log').insert({
      monitor_name: 'daily_reavaliation',
      promises_processed: evaluated,
      errors: failed > 0 ? JSON.stringify({ failed }) : null,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString()
    });

    return res.status(200).json({ status: 'ok', evaluated, failed });

  } catch (err) {
    console.error(`[Cron] FATAL: ${err.message}`);
    await supabase.from('cron_executions').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      details: err.message
    }).eq('execution_id', executionId);
    return res.status(500).json({ error: err.message });
  }
}