const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis';

async function query(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, options);
  return res.status;
}

async function deleteData() {
  // First delete promises from test politicians
  const testNames = [
    'Candidato Automação Total',
    'Teste de Sistema Final',
    'João Doria',
    'José Luiz Datena',
    'Eduardo Paes'
  ];

  console.log('=== DELETING TEST PROMISES ===');
  for (const name of testNames) {
    console.log(`Deleting promises for: ${name}`);
    const status = await query(`promises?politician_name=eq.${encodeURIComponent(name)}`, 'DELETE');
    console.log(`Status: ${status}`);
  }

  // Then delete the politicians
  const testIds = [
    'b9de96a5-60d8-4340-ab0a-e2dadefac9e5',
    '1026f0bd-622c-451e-bdcb-95bb05975a5b',
    'cb25f3a8-1845-44ea-af84-4c28bf16ae5c',
    'a8dbf5cc-3911-4f14-8705-849fd649107a',
    '94924e50-5586-4019-8d29-ff55d4313365'
  ];

  console.log('\n=== DELETING TEST POLITICIANS ===');
  for (const id of testIds) {
    console.log(`Deleting politician: ${id}`);
    const status = await query(`politicians?id=eq.${id}`, 'DELETE');
    console.log(`Status: ${status}`);
  }

  // Verify
  const politicians = await fetch(`${supabaseUrl}/rest/v1/politicians?select=id,name`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  }).then(r => r.json());
  
  console.log('\n=== REMAINING POLITICIANS ===');
  console.log(JSON.stringify(politicians, null, 2));
}

deleteData().catch(console.error);