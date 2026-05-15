
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateDB() {
  console.log("Starting DB Updates...");

  // Update Tarcisio
  const { error: err1 } = await supabase
    .from('politicians')
    .update({ role: 'governador', state: 'SP', city: null })
    .eq('slug', 'tarcisio-gomes-de-freitas');
  if (err1) console.error("Error updating Tarcisio:", err1);

  // Update Ricardo Nunes
  const { error: err2 } = await supabase
    .from('politicians')
    .update({ role: 'prefeito', state: 'SP', city: 'São Paulo' })
    .eq('slug', 'ricardo-luis-bernardo-nunes');
  if (err2) console.error("Error updating Ricardo Nunes:", err2);

  // Update Lula
  const { error: err3 } = await supabase
    .from('politicians')
    .update({ role: 'presidente', state: 'BR' })
    .eq('slug', 'luiz-inacio-lula-da-silva');
  if (err3) console.error("Error updating Lula:", err3);

  console.log("Verifying results...");
  const { data, error } = await supabase
    .from('politicians')
    .select('name, role, state, city');

  if (error) {
    console.error("Verification Error:", error);
  } else {
    console.log("POLITICIANS TABLE CONTENT:");
    console.table(data);
  }
}

updateDB();
