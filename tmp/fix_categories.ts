
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runFix() {
  console.log("Updating categories...");
  
  const { error: err1 } = await supabase
    .from('promises')
    .update({ category: 'Transporte' })
    .eq('category', 'Mobilidade');
  if (err1) console.error("Error updating Mobilidade:", err1);

  const { error: err2 } = await supabase
    .from('promises')
    .update({ category: 'Outros' })
    .eq('category', 'Gestão');
  if (err2) console.error("Error updating Gestão:", err2);

  console.log("Verifying categories...");
  const { data, error } = await supabase
    .from('promises')
    .select('category');

  if (error) {
    console.error(error);
  } else {
    const uniqueCats = [...new Set(data?.map(i => i.category))].sort();
    console.log("Category list:", uniqueCats);
  }
}

runFix();
