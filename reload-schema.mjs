import { createClient } from '@supabase/supabase-js';

const c = createClient(
  'https://liqutcjzzrqstivvfele.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
);

// Try multiple NOTIFY channel names
const channels = ['pgrst', 'pgrst_reload', 'postgrest', 'supabase_schema_cache'];
for (const ch of channels) {
  // Use single-quoted literal channel names to avoid any quoting issues
  const { data } = await c.rpc('exec_sql', {
    sql: "NOTIFY " + ch + ", 'reload schema'; SELECT 1;"
  });
  console.log(`${ch}: ${JSON.stringify(data)}`);
}

// Check if mandates REST endpoint works now
const r = await fetch('https://liqutcjzzrqstivvfele.supabase.co/rest/v1/mandates?limit=1', {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
  }
});
console.log(`\nREST /mandates status: ${r.status}`);
if (r.status !== 200) {
  const text = await r.text();
  console.log(`Response: ${text.substring(0, 200)}`);

  // Check if it's still the old cache or a different error
  if (r.status === 404) {
    // Schema still not refreshed. Options:
    // 1. Use Supabase Dashboard to create a dummy table via UI (triggers refresh)
    // 2. Wait for auto-refresh (PostgREST v10+ auto-refreshes every N seconds)
    // 3. Use exec_sql RPC as workaround for all operations
    console.log('\nSchema cache still stale. Will use exec_sql RPC workaround.');
  }
} else {
  const json = await r.json();
  console.log(`REST success:`, json);
}
