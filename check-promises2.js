const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';

async function query(endpoint) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  return res.json();
}

async function main() {
  console.log('=== PROMISES WITH SOURCE ===');
  const promises = await query('promises?select=id,politician_name,promise_title,source_doc_url,source_link');
  console.log(JSON.stringify(promises, null, 2));
}

main().catch(console.error);