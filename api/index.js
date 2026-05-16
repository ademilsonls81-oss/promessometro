import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (!supabase) {
    return res.status(500).json({ error: 'supabase not created' });
  }

  return res.status(200).json({ status: 'ok', client_ok: true });
}
