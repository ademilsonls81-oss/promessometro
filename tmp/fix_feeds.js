
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixFeeds() {
  const feedIds = [
    'cf7d31b1-ed39-413f-802c-2c08d6bbbdab',
    '55d30a75-610f-464c-b8ec-6bc93fd9c125',
    'c8f58c4e-5e0f-4035-888f-ef41bada6caf'
  ];

  console.log("Checking feeds...");
  const { data: feeds, error: getError } = await supabase
    .from('rss_feeds')
    .select('id, name, url, category')
    .in('id', feedIds);

  if (getError) {
    console.error("Error fetching feeds:", getError);
    return;
  }

  console.log("FEEDS TO DISABLE:");
  console.table(feeds);

  console.log("Disabling feeds...");
  const { error: updateError } = await supabase
    .from('rss_feeds')
    .update({ active: false })
    .in('id', feedIds);

  if (updateError) {
    console.error("Error disabling feeds:", updateError);
  } else {
    console.log("Feeds disabled successfully.");
  }

  console.log("Resolving system errors...");
  const sources = feedIds.map(id => `feed:${id}`);
  const { error: errUpdateError } = await supabase
    .from('system_errors')
    .update({ resolved: true })
    .in('source', sources);

  if (errUpdateError) {
    console.error("Error resolving errors:", errUpdateError);
  } else {
    console.log("System errors resolved successfully.");
  }
}

fixFeeds();
