
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

const feeds = [
  { name: 'Agência Brasil Política', url: 'https://agenciabrasil.ebc.com.br/rss/politica/feed.rss', category: 'Política' },
  { name: 'G1 Política', url: 'https://g1.globo.com/rss/g1/politica/', category: 'Política' },
  { name: 'Folha Poder', url: 'https://feeds.folha.uol.com.br/poder/rss091.xml', category: 'Política' },
  { name: 'Estadão Política', url: 'https://www.estadao.com.br/rss/politica.xml', category: 'Política' },
  { name: 'CNN Brasil Política', url: 'https://www.cnnbrasil.com.br/politica/feed/', category: 'Política' },
  { name: 'UOL Notícias', url: 'https://rss.uol.com.br/feed/noticias.xml', category: 'Política' },
  { name: 'Câmara dos Deputados', url: 'https://www.camara.leg.br/noticias/rss', category: 'Governo' },
  { name: 'Senado Federal', url: 'https://www12.senado.leg.br/noticias/rss/ultimas', category: 'Governo' },
  { name: 'Gov.br Notícias', 'url': 'https://www.gov.br/secom/pt-br/assuntos/noticias/RSS', category: 'Governo' }
];

async function run() {
  console.log("Upserting feeds...");
  const { error } = await supabase.from('feeds').upsert(
    feeds.map(f => ({ ...f, active: true })), 
    { onConflict: 'url' }
  );

  if (error) {
    console.error("Error inserting feeds:", error.message);
  } else {
    console.log("Feeds inserted successfully.");
  }

  const { data: result } = await supabase
    .from('feeds')
    .select('name, url, category')
    .eq('active', true)
    .order('category', { ascending: true });
  
  console.log("CURRENT ACTIVE FEEDS:");
  console.table(result);
}

run();
