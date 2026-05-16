import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
  );
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const cronSecret = req.headers['x-cron-secret'];
  const expectedSecret = process.env.CRON_SECRET || 'promessometro-dev';
  if (cronSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let sql;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    sql = body.sql;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'sql parameter required' });
  }

  if (sql.toLowerCase().includes('drop ') && sql.toLowerCase().includes('table')) {
    return res.status(403).json({ error: 'DROP TABLE not allowed' });
  }

  if (sql.toLowerCase().includes('truncate ')) {
    return res.status(403).json({ error: 'TRUNCATE not allowed' });
  }

  try {
    const { data, error } = await db().rpc('exec_sql', { sql });

    if (error) {
      return res.status(500).json({ error: error.message, detail: error.details });
    }

    return res.json({ success: true, result: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}