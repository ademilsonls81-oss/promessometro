import { createClient } from '@supabase/supabase-js';

const c = createClient(
  'https://liqutcjzzrqstivvfele.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
);

const rest = (method, path, body) =>
  fetch(`https://liqutcjzzrqstivvfele.supabase.co/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0',
      'Prefer': 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });

// Link Castro's promises to his mandate
const castroId = '76dd3b48-3578-42f6-8c0c-f2b16057bc3d';
const mandateId = '497da669-5f05-4d19-88b3-a8cdc66e3ea4';

// Get Castro's promises
let resp = await rest('GET', `promises?politician_id=eq.${castroId}&select=id,promise_title,status,fulfillment_score`);
const promises = await resp.json();
console.log(`Castro: ${promises.length} promises`);

// Link all to mandate
let linked = 0;
for (const p of promises) {
  resp = await rest('PATCH', `promises?id=eq.${p.id}`, { mandate_id: mandateId });
  if (resp.status === 204 || resp.status === 200) linked++;
}
console.log(`Linked ${linked}/${promises.length} to mandate`);

// Show all now
resp = await rest('GET', `promises?politician_id=eq.${castroId}&select=id,promise_title,status,fulfillment_score,mandate_id`);
const updated = await resp.json();
console.log('\nUpdated promises:');
updated.forEach(p => console.log(`  ${p.status.padEnd(15)} score=${String(p.fulfillment_score).padEnd(3)} ${p.promise_title.substring(0, 60)}`));

// Calculate C1 for Castro
const total = updated.length;
const cumpridas = updated.filter(p => p.status === 'cumprida').length;
const parciais = updated.filter(p => p.status === 'parcial').length;
const pendentes = updated.filter(p => p.status === 'pendente').length;
const quebradas = updated.filter(p => p.status === 'quebrada').length;
const c1 = total > 0 ? ((cumpridas * 1.0 + parciais * 0.5) / total) * 100 : 0;

console.log(`\nC1 Calculation:`);
console.log(`  Total: ${total}`);
console.log(`  Cumpridas: ${cumpridas}`);
console.log(`  Parciais: ${parciais}`);
console.log(`  Pendentes: ${pendentes}`);
console.log(`  Quebradas: ${quebradas}`);
console.log(`  C1 = (${cumpridas}×1.0 + ${parciais}×0.5) / ${total} × 100 = ${c1.toFixed(1)}`);
