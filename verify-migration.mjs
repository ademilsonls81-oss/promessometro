import { createClient } from '@supabase/supabase-js';

const c = createClient(
  'https://liqutcjzzrqstivvfele.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
);

async function check(sql) {
  const { data } = await c.rpc('exec_sql', { sql });
  return String(data) === '1';
}

// Tables
console.log('=== Tables ===');
const tables = ['mandates', 'indicators', 'legal_facts', 'methodology'];
for (const t of tables) console.log(`  ${await check(`SELECT CAST(count(*)::int AS text) FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'`) ? '✅' : '❌'} ${t}`);

// Columns on promises
console.log('\n=== Columns on promises ===');
for (const c of ['mandate_id', 'is_primary_source', 'verification_sources', 'government_response', 'contestation_sent_at', 'contestation_response', 'fulfillment_percentage', 'verification_notes']) {
  console.log(`  ${await check(`SELECT CAST(count(*)::int AS text) FROM information_schema.columns WHERE table_schema='public' AND table_name='promises' AND column_name='${c}'`) ? '✅' : '❌'} promises.${c}`);
}

// Columns on politicians
console.log('\n=== Columns on politicians ===');
for (const c of ['c1_score', 'c2_score', 'c3_score', 'final_score', 'grade', 'methodology_version', 'last_evaluated_at']) {
  console.log(`  ${await check(`SELECT CAST(count(*)::int AS text) FROM information_schema.columns WHERE table_schema='public' AND table_name='politicians' AND column_name='${c}'`) ? '✅' : '❌'} politicians.${c}`);
}

// Indexes
console.log('\n=== Indexes ===');
const indexes = ['idx_promises_mandate', 'idx_promises_is_primary', 'idx_indicators_politician', 'idx_legal_facts_politician', 'idx_mandates_politician'];
for (const idx of indexes) {
  console.log(`  ${await check(`SELECT CAST(count(*)::int AS text) FROM pg_indexes WHERE schemaname='public' AND indexname='${idx}'`) ? '✅' : '❌'} ${idx}`);
}

// All tables list
const { data: all } = await c.rpc('exec_sql', {
  sql: "SELECT CAST(json_agg(table_name ORDER BY table_name)::text AS text) FROM information_schema.tables WHERE table_schema='public'"
});
console.log('\nAll tables:', all);
