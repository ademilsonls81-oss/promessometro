const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis';

async function query(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, options);
  const text = await res.text();
  try {
    return JSON.parse(text || '[]');
  } catch {
    return text;
  }
}

async function deleteData() {
  const testPoliticianIds = [
    'b9de96a5-60d8-4340-ab0a-e2dadefac9e5', // Candidato Automação Total
    '1026f0bd-622c-451e-bdcb-95bb05975a5b', // Teste de Sistema Final
    'cb25f3a8-1845-44ea-af84-4c28bf16ae5c', // João Doria
    'a8dbf5cc-3911-4f14-8705-849fd649107a', // José Luiz Datena
    '94924e50-5586-4019-8d29-ff55d4313365'  // Eduardo Paes
  ];

  console.log('=== DELETING TEST POLITICIANS ===');
  for (const id of testPoliticianIds) {
    console.log(`Deleting politician: ${id}`);
    await query(`politicians?id=eq.${id}`, 'DELETE');
  }

  console.log('\n=== VERIFYING REMAINING ===');
  const politicians = await query('politicians?select=id,name');
  console.log(JSON.stringify(politicians, null, 2));

  const promises = await query('promises?select=id,politician_name');
  console.log('\n=== REMAINING PROMISES ===');
  console.log(JSON.stringify(promises, null, 2));
}

deleteData().catch(console.error);