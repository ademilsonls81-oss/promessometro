const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis';

async function query(endpoint) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  return res.json();
}

async function main() {
  console.log('=== POLITICIANS ===');
  const p = await query('politicians?select=id,name&order=created_at.desc&limit=20');
  console.log(JSON.stringify(p, null, 2));

  console.log('\n=== PROMISES ===');
  const promises = await query('promises?select=id,politician_name,promise_title&order=created_at.desc&limit=20');
  console.log(JSON.stringify(promises, null, 2));
}

main().catch(console.error);