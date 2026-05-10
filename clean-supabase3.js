const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';

async function query(endpoint, method = 'DELETE') {
  const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    method,
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }
  });
  return res.status;
}

async function deleteData() {
  const testNames = [
    'Candidato Automação Total',
    'Teste de Sistema Final',
    'João Doria',
    'José Luiz Datena',
    'Eduardo Paes'
  ];

  console.log('=== DELETING TEST PROMISES (Service Role) ===');
  for (const name of testNames) {
    const status = await query(`promises?politician_name=eq.${encodeURIComponent(name)}`);
    console.log(`Deleted promises for ${name}: ${status}`);
  }

  const testIds = [
    'b9de96a5-60d8-4340-ab0a-e2dadefac9e5',
    '1026f0bd-622c-451e-bdcb-95bb05975a5b',
    'cb25f3a8-1845-44ea-af84-4c28bf16ae5c',
    'a8dbf5cc-3911-4f14-8705-849fd649107a',
    '94924e50-5586-4019-8d29-ff55d4313365'
  ];

  console.log('\n=== DELETING TEST POLITICIANS (Service Role) ===');
  for (const id of testIds) {
    const status = await query(`politicians?id=eq.${id}`);
    console.log(`Deleted politician ${id}: ${status}`);
  }

  // Verify
  const politicians = await fetch(`${supabaseUrl}/rest/v1/politicians?select=id,name`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
  }).then(r => r.json());
  
  console.log('\n=== REMAINING POLITICIANS ===');
  console.log(JSON.stringify(politicians, null, 2));
}

deleteData().catch(console.error);