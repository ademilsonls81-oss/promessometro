import { createClient } from '@supabase/supabase-js';
import { prioritizeSources, classifySource, getLevelLabel } from '../lib/sourceLevel.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const STATUS_CONFIG = {
  cumprida:             { min: 80, max: 100, base: 90 },
  parcialmente_cumprida: { min: 40, max: 79, base: 45 },
  em_andamento:         { min: 20, max: 39, base: 25 },
  nao_iniciada:         { min: 0,  max: 19, base: 5  },
  descumprida:          { min: 0,  max: 0,  base: 0  },
  nao_classificada:      { min: 0,  max: 100, base: 5 },
  pendente:             { min: 0,  max: 19, base: 5  },
  parcial:              { min: 40, max: 79, base: 45 },
  quebrada:             { min: 0,  max: 0,  base: 0  },
};

function extractHostname(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url.split('/')[2]?.replace('www.', '') || '';
  }
}

function mapStatusToFrontend(aiStatus) {
  const map = {
    'cumprida': 'cumprida', 'parcialmente_cumprida': 'parcial',
    'em_andamento': 'parcial', 'nao_iniciada': 'pendente',
    'nao_classificada': 'pendente', 'pendente': 'pendente',
    'descumprida': 'quebrada', 'parcial': 'parcial', 'quebrada': 'quebrada'
  };
  return map[aiStatus] || 'pendente';
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

function parseSerperDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date().toISOString();
  }
  const lower = dateStr.toLowerCase();
  if (lower.includes('ago') || lower.includes('days') || lower.includes('months') || lower.includes('year') || lower.includes('hours')) {
    return new Date().toISOString();
  }
  const ptMonths = {
    'jan': 'Jan', 'fev': 'Feb', 'mar': 'Mar', 'abr': 'Apr',
    'mai': 'May', 'jun': 'Jun', 'jul': 'Jul', 'ago': 'Aug',
    'set': 'Sep', 'out': 'Oct', 'nov': 'Nov', 'dez': 'Dec'
  };
  const monthMatch = dateStr.match(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i);
  if (monthMatch) {
    const pt = monthMatch[1].toLowerCase();
    const en = ptMonths[pt];
    if (en) {
      const replaced = dateStr.replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi, en);
      const parsed = new Date(replaced);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return new Date().toISOString();
}

async function evaluateWithAI(promise) {
   const apiKeyRaw = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
   const apiKey = apiKeyRaw.replace(/^YOUR_.*_KEY$/, '');
   // Debug: log whether we have a valid key (without exposing the key itself)
   console.log(`[DailyReavaliation] GROQ key check: raw="${apiKeyRaw.substring(0, 10)}...", valid=${!!apiKey}`);
  const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
  const SERPER_API_KEY = process.env.SERPER_API_KEY;
  const originalStatus = promise.status || 'pendente';
  const originalScore = promise.fulfillment_score ?? 50;

  const evidences = [];
  if (promise.source_link) {
    evidences.push({ descricao: `Fonte original`, fonte: extractHostname(promise.source_link), url: promise.source_link });
  }

  if (SERPER_API_KEY) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_API_KEY },
        body: JSON.stringify({ q: `${promise.politician_name || ''} ${promise.promise_title || ''}`, gl: 'br', hl: 'pt-br' })
      });
      if (res.ok) {
        const d = await res.json();
        const results = d.organic || [];
        evidences.push(...results.map(r => ({
          descricao: r.snippet || '',
          fonte: r.source || extractHostname(r.link) || '',
          url: r.link || '',
          data: parseSerperDate(r.date)
        })));
      }
    } catch (_) { }
  }

  const evText = evidences.length > 0 ? evidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url})`).join('\n') : 'Nenhuma evidência encontrada.';
  const prompt = `Avaliador de promessas políticas brasileiras. PROMESSA: ${promise.promise_title}. POLÍTICO: ${promise.politician_name}. EVIDÊNCIAS: ${evText}. Responda JSON: {"status":"status","fulfillment_score":0-100,"justificativa":"explicação"}`;

  try {
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');
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
  } catch (err) {
    const clampedScore = clampScore(originalStatus, originalScore);
    return {
      status: originalStatus,
      fulfillment_score: clampedScore,
      justification: `Avaliacao herdada do status original (${originalStatus}, score ${clampedScore}). IA falhou: ${err.message}`,
      evidences
    };
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res)) return;

  const executionId = `reval_${Date.now()}`;
  const startTime = new Date();
  
  // 1. Log START
  try {
    await db().from('cron_executions').insert({
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
    
    const { data: promises } = await db()
      .from('promises')
      .select('*')
      .lt('last_verified_at', dailyCutoff)
      .not('status', 'eq', 'cumprida')
      .limit(10);

    if (!promises || promises.length === 0) {
      await db().from('cron_executions').update({ status: 'completed', completed_at: new Date().toISOString(), details: 'No promises found' }).eq('execution_id', executionId);
      return res.status(200).json({ status: 'ok', evaluated: 0 });
    }

    for (const promise of promises) {
      try {
        const result = await evaluateWithAI(promise);
        const frontendStatus = mapStatusToFrontend(result.status);
        const previousStatus = promise.status;
        
        const { error: upErr } = await db().from('promises').update({
          status: frontendStatus,
          fulfillment_score: result.fulfillment_score,
          ai_evaluation: result.justification,
          evidences_used: result.evidences,
          last_verified_at: new Date().toISOString()
        }).eq('id', promise.id);

        if (!upErr) {
          evaluated++;
          
          // Insert status_history
          try {
            await db().from('status_history').insert({
              promise_id: promise.id,
              old_status: previousStatus,
              new_status: frontendStatus
            });
          } catch (shErr) { console.error(`[Cron] status_history failed:`, shErr.message); }

          // Insert/replace promise_explanations
          try {
            await db().from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id);
            await db().from('promise_explanations').insert({
              promise_id: promise.id,
              status: frontendStatus,
              fulfillment_score: result.fulfillment_score,
              criterio_aplicado: 'daily_reavaliation_v1',
              justificativa: result.justification,
              evidencias_usadas: prioritizeSources(result.evidences.map(e => ({ descricao: e.descricao, fonte: e.fonte, url: e.url, data: e.data }))),
              o_que_falta: 'Reavaliacao automatica',
              o_que_foi_feito: result.justification,
              confianca: 0.75,
              modelo_ia: 'daily-reavaliation-v1',
              is_latest: true,
              gerado_em: new Date().toISOString()
            });
          } catch (peErr) { console.error(`[Cron] promise_explanations failed:`, peErr.message); }

          // Insert audit_log
          try {
            await db().from('audit_logs').insert({
              action: 'promise_reavaluated',
              entity_type: 'promises',
              entity_id: promise.id,
              details: JSON.stringify({
                promise_id: promise.id,
                old_status: previousStatus,
                new_status: frontendStatus,
                score: result.fulfillment_score,
                execution_id: executionId
              })
            });
          } catch (alErr) { console.error(`[Cron] audit_logs failed:`, alErr.message); }
        } else {
          failed++;
        }
      } catch (e) {
        console.error(`[Cron] Fail ${promise.id}:`, e.message);
        failed++;
      }
    }

    // 2. Log SUCCESS
    await db().from('cron_executions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      promises_evaluated: evaluated,
      promises_failed: failed
    }).eq('execution_id', executionId);

    // 3. Daily Monitor Log
    await db().from('daily_monitor_log').insert({
      monitor_name: 'daily_reavaliation',
      promises_processed: evaluated,
      errors: failed > 0 ? JSON.stringify({ failed }) : null,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString()
    });

    return res.status(200).json({ status: 'ok', evaluated, failed });

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