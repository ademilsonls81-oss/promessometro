import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// We'll just print out what updates WOULD be made to avoid failing on anon_key.
const db = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const ROLE_MAP = { presidente: 'Presidente', governador: 'Governador', prefeito: 'Prefeito', senador: 'Senador', deputado_federal: 'Deputado Federal', deputado_estadual: 'Deputado Estadual', 'Presidente': 'Presidente', 'Governador': 'Governador', 'Prefeito': 'Prefeito', 'Senador': 'Senador', 'Deputado Federal': 'Deputado Federal', 'Deputado Estadual': 'Deputado Estadual' };
const VALID_ROLES = new Set(['Presidente', 'Governador', 'Prefeito', 'Senador', 'Deputado Federal', 'Deputado Estadual']);
function roleValido(r) { if (!r) return false; const rTrim = r.trim(); const n = ROLE_MAP[rTrim.toLowerCase()] || ROLE_MAP[rTrim] || rTrim; return VALID_ROLES.has(n); }

async function main() {
  const { data: pol } = await db.from('politicians').select('*').eq('id', 'f17a5688-6616-43b8-a6d1-419b4fcb5358').single();
  if (!pol) {
    console.log('Politician not found by ID. Searching by name...');
    const { data: pol2 } = await db.from('politicians').select('*').ilike('name', 'Paulo Dantas').limit(1);
    if (!pol2 || pol2.length === 0) return console.log('Not found');
    Object.assign(pol, pol2[0]);
  }

  console.log('Politico DB state:', JSON.stringify(pol, null, 2));

  const updates = {};
  const precisaRole = !pol.role || !roleValido(pol.role);
  const precisaState = !pol.state || pol.state.trim().length < 2;
  const precisaParty = !pol.party || pol.party.trim().length === 0;

  console.log('Precisa:', { precisaRole, precisaState, precisaParty });

  if (precisaRole && pol.state && /^[A-Z]{2}$/.test(pol.state)) {
    updates.role = 'Governador';
  }

  // A5: Fix photo
  if (!pol.photo_url) {
    updates.photo_url = "some_photo";
  }

  console.log('Updates proposed:', updates);
}
main();
