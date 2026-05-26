import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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