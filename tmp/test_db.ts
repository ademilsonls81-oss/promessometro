
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Checking politicians table...");
  const { data: politicians, error: pError } = await supabase
    .from('politicians')
    .select('*');
  
  if (pError) console.error("Politicians Error:", pError);
  else console.log("Politicians Data:", JSON.stringify(politicians, null, 2));

  console.log("\nChecking distinct politician_name from promises table...");
  const { data: promises, error: prError } = await supabase
    .from('promises')
    .select('politician_name');
  
  if (prError) console.error("Promises Error:", prError);
  else {
    const names = [...new Set(promises.map(p => p.politician_name))];
    console.log("Unique Politician Names in Promises:", names);
    
    // For each unique name, let's see how our toSlug function would handle it
    function toSlug(name) {
      if (!name) return '';
      return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    names.forEach(name => {
        console.log(`Name: "${name}" -> Expected Slug: "${toSlug(name)}"`);
        
        // Reconstruct name from slug as done in api/index.js
        const slug = toSlug(name);
        const nameQuery = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        console.log(`  Reconstructed Query: "%${nameQuery}%"`);
    });
  }
}

test();
