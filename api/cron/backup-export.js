import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res)) return;

  const executionId = `backup_${Date.now()}`;
  const startTime = new Date();
  
  try {
    await supabase.from('cron_executions').insert({
      execution_id: executionId,
      trigger: 'vercel_cron',
      status: 'started',
      started_at: startTime.toISOString()
    });
  } catch (e) { console.error('[Backup] Start log failed:', e.message); }

  try {
    console.log(`[Backup] Backup export started at ${startTime.toISOString()}`);

    await supabase.from('system_stats').upsert({
      key: 'last_backup_run',
      value: startTime.toISOString(),
      details: JSON.stringify({ executionId, status: 'simulated_success' })
    });

    await supabase.from('cron_executions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      details: 'Simulated backup export completed (Placeholder)'
    }).eq('execution_id', executionId);

    await supabase.from('daily_monitor_log').insert({
      monitor_name: 'backup_export',
      promises_processed: 0,
      errors: null,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString()
    });

    return res.status(200).json({ status: 'ok', execution_id: executionId, message: 'Backup placeholder executed' });

  } catch (err) {
    console.error(`[Backup] FATAL: ${err.message}`);
    await supabase.from('cron_executions').update({ status: 'failed', completed_at: new Date().toISOString(), details: err.message }).eq('execution_id', executionId);
    return res.status(500).json({ error: err.message });
  }
}