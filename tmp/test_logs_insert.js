
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { error: e1 } = await supabase.from('cron_executions').insert({
    execution_id: 'test_1',
    trigger: 'test'
  });
  console.log("Test 1 (daily-reavaliation schema):", e1 ? e1.message : "Success");

  const { error: e2 } = await supabase.from('cron_executions').insert({
    cron_name: 'test_2',
    status: 'completed'
  });
  console.log("Test 2 (pipeline-orchestrator schema):", e2 ? e2.message : "Success");
}

testInsert();
