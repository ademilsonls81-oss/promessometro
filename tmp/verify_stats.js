
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStats() {
    const { count: politiciansCount } = await supabase.from('politicians').select('*', { count: 'exact', head: true });
    const { count: activePoliticiansCount } = await supabase.from('politicians').select('*', { count: 'exact', head: true }).eq('is_active', true);
    const { count: promisesCount } = await supabase.from('promises').select('*', { count: 'exact', head: true });

    console.log({
      total_politicians: politiciansCount || 0,
      active_politicians: activePoliticiansCount || 0,
      total_promises: promisesCount || 0
    });
}

checkStats();
