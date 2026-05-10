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
  console.log('=== TABLE CHECK ===');
  
  const tables = ['promises', 'politicians', 'scrape_jobs', 'daily_monitor_log', 'monitor_sources', 'promise_audit_log', 'promise_reliability_scores', 'evidence'];
  
  for (const table of tables) {
    try {
      const data = await query(`${table}?select=*&limit=1`);
      console.log(`${table}: ${Array.isArray(data) ? 'EXISTS' : 'ERROR'}`);
    } catch (e) {
      console.log(`${table}: NOT FOUND`);
    }
  }

  console.log('\n=== PROMISES BY POLITICIAN ===');
  const promises = await query('promises?select=politician_name,promise_title,status');
  const byPol = {};
  promises.forEach(p => {
    if (!byPol[p.politician_name]) byPol[p.politician_name] = [];
    byPol[p.politician_name].push({ title: p.promise_title, status: p.status });
  });
  console.log(JSON.stringify(byPol, null, 2));
}

main().catch(console.error);