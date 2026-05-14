import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co';
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

let consecutiveZeroCount = 0;

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
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

  const CREDIBLE_SOURCES = ['g1.globo.com', 'folha.uol.com.br', 'uol.com.br', 'estadao.com.br', 
    'metropoles.com', 'cnnbrasil.com.br', 'senado.leg.br', 'camara.leg.br', 
    'planalto.gov.br', 'portaldatransparencia.gov.br', '.gov.br'];

  function isCredible(url) {
    if (!url) return false;
    const u = url.toLowerCase();
    return CREDIBLE_SOURCES.some(s => u.includes(s));
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  let evidences = [];

  if (promise.source_link) {
    evidences.push({
      descricao: `Fonte original da promessa`,
      fonte: new URL(promise.source_link).hostname,
      url: promise.source_link,
      data: null,
      is_original_source: true
    });
  }

  if (TAVILY_API_KEY && TAVILY_API_KEY !== 'YOUR_TAVILY_API_KEY') {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': TAVILY_API_KEY },
        body: JSON.stringify({
          query: `${promise.politician_name || ''} ${promise.promise_title || ''}`,
          max_results: 5,
          include_answer: true
        }),
        signal: ctrl.signal
      });
      if (res.ok) {
        const d = await res.json();
        const newEvs = (d.results || []).map(r => ({
          descricao: r.content || '',
          fonte: r.source || '',
          url: r.url || '',
          data: r.published_date || null,
          is_original_source: false
        }));
        evidences = [...evidences, ...newEvs];
      }
    } catch (_) { }
  }
  clearTimeout(timer);

  const evText = evidences.length > 0
    ? evidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url || 'sem URL'})`).join('\n')
    : 'Nenhuma evidência encontrada.';

  const prompt = `Você é um avaliador independente de promessas políticas brasileiras.

PROMESSA: ${promise.promise_title || ''}
POLÍTICO: ${promise.politician_name || ''}

EVIDÊNCIAS ENCONTRADAS:
${evText}

CRITÉRIOS:
| Status | Score | Quando usar |
| cumprida | 80-100 | Ação concluída com prova verificável |
| parcialmente_cumprida | 40-79 | Progresso parcial demonstrado |
| em_andamento | 20-39 | Processo iniciado sem entrega final |
| nao_iniciada | 0-19 | Nenhuma ação verificável |
| descumprida | 0 | Ação contrária ou prazo expirado |

REGRAS:
-Fontes governamentais (.gov.br, planalto, senado, camara) OU veículos de confiança (G1, Folha, Estadão, UOL) = evidência forte
- Se há fonte_confiável=true na evidência, considere como cumprimento即使quando não há documento oficial
- Se promessa tem source_link (fonte original), use como evidência primária
- Score > 70 exige pelo menos 1 fonte confiável ou source_link da promessa
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

    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}: ${await groqRes.text()}`);

    const data = await groqRes.json();
    let text = (data.choices?.[0]?.message?.content || '{}')
      .replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};

    let status = parsed.status || 'nao_classificada';
    let rawScore = parsed.fulfillment_score ?? 50;

    if (evidences.length === 0 && rawScore > 30) {
      status = 'nao_iniciada';
      rawScore = Math.min(rawScore, 30);
    }

    const clampedScore = clampScore(status, rawScore);

    return {
      status,
      fulfillment_score: clampedScore,
      raw_ai_score: rawScore,
      justification: parsed.justificativa || '',
      evidences,
      needs_human_review: clampedScore > 80 || evidences.length === 0
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

  const now = new Date();
  const dailyCutoff = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString();
  const weeklyCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleDaily, error: e1 } = await supabase
    .from('promises')
    .select('id, promise_title, category, status, fulfillment_score, last_verified_at, politician_name, source_link')
    .lt('last_verified_at', dailyCutoff)
    .not('status', 'eq', 'cumprida')
    .not('status', 'eq', 'descumprida')
    .limit(20);

  const { data: never, error: e2 } = await supabase
    .from('promises')
    .select('id, promise_title, category, status, fulfillment_score, last_verified_at, politician_name, source_link')
    .is('last_verified_at', null)
    .limit(20);

  const { data: staleWeekly, error: e3 } = await supabase
    .from('promises')
    .select('id, promise_title, category, status, fulfillment_score, last_verified_at, politician_name, source_link')
    .lt('last_verified_at', weeklyCutoff)
    .in('status', ['cumprida', 'descumprida'])
    .limit(10);

  if (e1) console.error('[Cron] staleDaily error:', e1.message);
  if (e2) console.error('[Cron] never error:', e2.message);
  if (e3) console.error('[Cron] staleWeekly error:', e3.message);

  const seen = new Set();
  const promises = [];
  for (const p of [...(staleDaily || []), ...(never || []), ...(staleWeekly || [])]) {
    if (!seen.has(p.id)) { seen.add(p.id); promises.push(p); }
  }

  if (promises.length === 0) {
    console.log('[Cron] No stale promises, fetching recent unfulfilled promises...');
    const { data: recent } = await supabase
      .from('promises')
      .select('id, promise_title, category, status, fulfillment_score, last_verified_at, politician_name, source_link')
      .not('status', 'eq', 'cumprida')
      .not('status', 'eq', 'descumprida')
      .order('created_at', { ascending: false })
      .limit(10);
    if (recent) promises.push(...recent);
  }

  if (promises.length === 0) {
    return res.status(200).json({ status: 'ok', promises_evaluated: 0, promises_failed: 0, timestamp: now.toISOString() });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') {
    return res.status(500).json({ status: 'error', error: 'GROQ_API_KEY not configured' });
  }

  let evaluated = 0;
  let failed = 0;

  for (const promise of promises) {
    try {
      const result = await evaluateWithAI(promise);
      const frontendStatus = mapStatusToFrontend(result.status);

      const { error: updateError } = await supabase
        .from('promises')
        .update({
          status: frontendStatus,
          fulfillment_score: result.fulfillment_score,
          ai_evaluation: result.justification,
          evidences_used: result.evidences,
          needs_human_review: result.needs_human_review,
          last_verified_at: now.toISOString()
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
        new_status: frontendStatus,
        previous_score: promise.fulfillment_score,
        new_score: result.fulfillment_score,
        changed_by: 'cron_daily_reavaliation',
        change_reason: result.justification || 'Reavaliação automática diária',
        evaluation_type: 'ai_auto'
      }).catch(() => { });

      await supabase.from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id).catch(() => { });
      await supabase.from('promise_explanations').insert({
        promise_id: promise.id,
        status: frontendStatus,
        fulfillment_score: result.fulfillment_score,
        criterio_aplicado: 'cron_auto_evaluation',
        justificativa: result.justification || 'Reavaliação automática via cron',
        evidencias_usadas: result.evidences,
        o_que_falta: result.needs_human_review ? 'Revisão humana necessária - evidências insuficientes ou score alto' : 'Avaliação completa.',
        o_que_foi_feito: result.justification || 'Análise automática por IA.',
        confianca: result.needs_human_review ? 50 : 85,
        modelo_ia: 'cron-v1-groq',
        is_latest: true,
        gerado_em: now.toISOString()
      }).catch(() => { });

      await supabase.from('audit_logs').insert({
        action: 'cron_reavaliation',
        table_name: 'promises',
        record_id: promise.id,
        old_value: { status: promise.status, score: promise.fulfillment_score },
        new_value: { status: frontendStatus, score: result.fulfillment_score },
        performed_by: 'cron',
        details: {
          promise_title: promise.promise_title,
          politician: promise.politician_name,
          ai_score: result.raw_ai_score,
          evidences_count: result.evidences?.length || 0,
          needs_human_review: result.needs_human_review
        }
      }).catch(() => { });

      evaluated++;
      console.log(`[Cron] ✓ ${promise.promise_title}: ${promise.status}→${frontendStatus} (${result.fulfillment_score})`);
    } catch (e) {
      console.error(`[Cron] ✗ ${promise.id}: ${e.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  const executionId = `cron_${now.getTime()}`;

  if (evaluated === 0 && failed === 0) {
    consecutiveZeroCount++;
    if (consecutiveZeroCount >= 2) {
      const msg = `[Cron] ALERTA: ${consecutiveZeroCount} execuções sem promessas para reavaliar!`;
      console.warn(msg);
      await sendSlackAlert(msg, { consecutiveZeroCount, dailyCutoff, weeklyCutoff });
    }
  } else {
    consecutiveZeroCount = 0;
  }

  await supabase.from('cron_executions').insert({
    execution_id: executionId,
    trigger: 'vercel_cron',
    promises_evaluated: evaluated,
    promises_failed: failed,
    promises_found: promises.length,
    slack_alert_sent: evaluated === 0 && consecutiveZeroCount >= 2
  }).catch(() => { });

  await supabase.from('system_stats').upsert({
    key: 'last_cron_run',
    value: now.toISOString(),
    details: JSON.stringify({ evaluated, failed, execution_id: executionId })
  }).catch(() => { });

  const VERCEL_DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (VERCEL_DEPLOY_HOOK && evaluated > 0) {
    try {
      await fetch(VERCEL_DEPLOY_HOOK, { method: 'POST' });
      console.log('[Cron] Deploy hook triggered');
    } catch (e) {
      console.error('[Cron] Deploy hook failed:', e.message);
    }
  }

  return res.status(200).json({
    status: 'ok',
    execution_id: executionId,
    promises_evaluated: evaluated,
    promises_failed: failed,
    consecutive_zero_count: consecutiveZeroCount,
    deploy_triggered: !!(VERCEL_DEPLOY_HOOK && evaluated > 0),
    timestamp: now.toISOString()
  });
}