
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const { data, error } = await supabase
    .from('politicians')
    .select('name, role, state, city, slug')
    .in('name', ['Luiz Inácio Lula da Silva', 'Ricardo Luís Bernardo Nunes', 'Tarcísio Gomes de Freitas']);

  if (error) {
    console.error(error);
  } else {
    console.log("FINAL DB VERIFICATION:");
    console.table(data);
  }
}

verify();
