
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateDB() {
  console.log("Starting DB Updates via Script...");

  // Update Tarcisio
  await supabase
    .from('politicians')
    .update({ role: 'governador', state: 'SP', city: null, slug: 'tarcisio-gomes-de-freitas' })
    .ilike('name', '%Tarc%sio%Gomes%');

  // Update Ricardo Nunes
  await supabase
    .from('politicians')
    .update({ role: 'prefeito', state: 'SP', city: 'São Paulo', slug: 'ricardo-luis-bernardo-nunes' })
    .ilike('name', '%Ricardo%Nunes%');

  // Update Lula
  await supabase
    .from('politicians')
    .update({ role: 'presidente', state: 'BR', slug: 'luiz-inacio-lula-da-silva' })
    .ilike('name', '%Luiz%In%cio%Lula%');

  console.log("Verification...");
  const { data } = await supabase
    .from('politicians')
    .select('name, role, state, city, slug');
  console.table(data);
}

updateDB();
