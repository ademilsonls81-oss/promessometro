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

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res)) return;

  const executionId = `backup_${Date.now()}`;
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

  try {
    // Basic backup logic: just recording that we ran for now
    // In a real scenario, this would trigger a PG dump or export to S3/Storage
    
    console.log(`[Backup] Backup export started at ${startTime.toISOString()}`);

    // Update system_stats
    await supabase.from('system_stats').upsert({
      key: 'last_backup_run',
      value: startTime.toISOString(),
      details: JSON.stringify({ executionId, status: 'simulated_success' })
    });

    // 2. Log SUCCESS
    await supabase.from('cron_executions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      details: 'Simulated backup export completed (Placeholder)'
    }).eq('execution_id', executionId);

    // 3. Daily Monitor Log
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
