import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_S_URL || 'https://liqutcjzzrqstivvfele.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
);

function requireCronSecret(req, res) {
  if (process.env.NODE_ENV !== 'production') return true;
  const raw = JSON.stringify(req.headers || '').toLowerCase();
  const isCron = raw.includes('vercel-cron') || raw.includes('vercel/internal');
  if (isCron) return true;
  const secret = req.headers['x-cron-secret'] || req.query?.secret;
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return false;
  }
  return true;
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

const TAVILY_SOURCES = [
  'g1.globo.com', 'folha.uol.com.br', 'uol.com.br', 'estadao.com.br',
  'metropoles.com', 'cnnbrasil.com.br', 'www12.senado.leg.br', 'www.camara.leg.br',
  'www.planalto.gov.br', 'portaldatransparencia.gov.br', 'agenciabrasil.ebc.com.br',
  'veja.abril.com.br', 'oglobo.globo.com', 'congressoemfoco.uol.com.br', 'noticias.r7.com'
];

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res)) return;

  const executionId = `disc_${Date.now()}`;
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

  let discovered = 0, inserted = 0, failed = 0;

  try {
    const { data: promises } = await supabase.from('promises').select('id, promise_title, politician_name').limit(10);
    
    for (const promise of promises) {
      try {
        const serperKey = process.env.SERPER_API_KEY;
        if (serperKey) {
          const r = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': serperKey },
            body: JSON.stringify({ q: `${promise.politician_name} ${promise.promise_title}`, gl: 'br', hl: 'pt-br' })
          });
          if (r.ok) {
            const d = await r.json();
            const results = d.organic || [];
            for (const ev of results) {
              discovered++;
              const { error: inErr } = await supabase.from('promise_evidences').insert({
                promise_id: promise.id,
                politician_name: promise.politician_name,
                promise_title: promise.promise_title,
                url: ev.link,
                descricao: ev.snippet,
                fonte: ev.source,
                data_publicacao: parseSerperDate(ev.date)
              });
              if (!inErr) inserted++;
            }
          }
        }
      } catch (e) { failed++; }
    }

    // 2. Log SUCCESS
    await supabase.from('cron_executions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      promises_found: discovered,
      promises_evaluated: inserted,
      promises_failed: failed
    }).eq('execution_id', executionId);

    // 3. Daily Monitor Log
    await supabase.from('daily_monitor_log').insert({
      monitor_name: 'discover_evidences',
      promises_processed: promises.length,
      new_evidences_found: inserted,
      errors: failed > 0 ? JSON.stringify({ failed }) : null,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString()
    });

    return res.status(200).json({ status: 'ok', discovered, inserted, failed });

  } catch (err) {
    console.error(`[Cron] FATAL: ${err.message}`);
    await supabase.from('cron_executions').update({ status: 'failed', completed_at: new Date().toISOString(), details: err.message }).eq('execution_id', executionId);
    return res.status(500).json({ error: err.message });
  }
}