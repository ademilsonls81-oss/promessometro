import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const c = createClient(
  'https://liqutcjzzrqstivvfele.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
);

const raw = readFileSync('sql/migration-2026-05-17-metodologia.sql', 'utf-8');
const blocks = raw.split(';').map(s => s.trim()).filter(s => s.length > 0);

let ok = 0, fail = 0;
for (const block of blocks) {
  const lines = block.split('\n').filter(l => !/^\s*--/.test(l)).join('\n').trim();
  if (!lines || !/[A-Z]/.test(lines)) continue;
  const sql = lines + '; SELECT 1;';
  try {
    const { data, error } = await c.rpc('exec_sql', { sql });
    if (error) { fail++; console.error(`\n✗ ${error.message.substring(0, 100)}`); }
    else { ok++; process.stdout.write('.'); }
  } catch (e) {
    fail++;
    console.error(`\n✗ ${e.message.substring(0, 100)}`);
  }
}
console.log(`\n${ok} OK, ${fail} failed`);

// Verify — use numeric comparison
console.log('\n=== New Tables ===');
for (const t of ['mandates', 'indicators', 'legal_facts', 'methodology']) {
  const { data } = await c.rpc('exec_sql', {
    sql: `SELECT CAST(count(*)::int AS text) FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'`
  });
  const exists = String(data) === '1';
  console.log(`  ${exists ? '✅' : '❌'} ${t} (data=${JSON.stringify(data)})`);
}
