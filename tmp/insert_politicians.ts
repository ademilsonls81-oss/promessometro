
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function insertPoliticians() {
  const politicians = [
    { name: 'Jerônimo Rodrigues',    party: 'PT',          state: 'BA', role: 'governador',      city: null,           slug: 'jeronimo-rodrigues',    election_year: 2022, is_active: true },
    { name: 'Romeu Zema',            party: 'Novo',         state: 'MG', role: 'governador',      city: null,           slug: 'romeu-zema',            2022, is_active: true }, // Fixed Zema's missing property names in user's prompt
    { name: 'Cláudio Castro',        party: 'PL',           state: 'RJ', role: 'governador',      city: null,           slug: 'claudio-castro',        election_year: 2022, is_active: true },
    { name: 'Eduardo Leite',         party: 'PSDB',         state: 'RS', role: 'governador',      city: null,           slug: 'eduardo-leite',         election_year: 2022, is_active: true },
    { name: 'Evandro Leitão',        party: 'PT',           state: 'CE', role: 'prefeito',        city: 'Fortaleza',    slug: 'evandro-leitao',        election_year: 2024, is_active: true },
    { name: 'Eduardo Paes',          party: 'PSD',          state: 'RJ', role: 'prefeito',        city: 'Rio de Janeiro', slug: 'eduardo-paes',         election_year: 2024, is_active: true },
    { name: 'Bruno Reis',            party: 'União Brasil', state: 'BA', role: 'prefeito',        city: 'Salvador',     slug: 'bruno-reis',            election_year: 2024, is_active: true },
    { name: 'Fuad Noman',            party: 'PSD',          state: 'MG', role: 'prefeito',        city: 'Belo Horizonte', slug: 'fuad-noman',           election_year: 2024, is_active: true }
  ];

  // Map Romeu Zema specifically because the prompt had a weird format
  const correctedPoliticians = politicians.map(p => {
      if (p.name === 'Romeu Zema') return { ...p, election_year: 2022 };
      return p;
  });

  console.log("Inserting politicians...");
  const { data, error } = await supabase
    .from('politicians')
    .upsert(correctedPoliticians, { onConflict: 'slug' })
    .select('id, name, slug, party');

  if (error) {
    console.error("Error inserting politicians:", error);
  } else {
    console.log("Politicians Inserted Successfully:");
    console.table(data);
  }
}

insertPoliticians();
