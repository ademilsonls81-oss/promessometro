
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function clean() {
  const { data: allFeeds } = await supabase.from('feeds').select('id, name, url, category');
  console.log("Total feeds:", allFeeds?.length);

  const politicalFeedsUrls = [
    'https://agenciabrasil.ebc.com.br/rss/politica/feed.rss',
    'https://g1.globo.com/rss/g1/politica/',
    'https://feeds.folha.uol.com.br/poder/rss091.xml',
    'https://www.estadao.com.br/rss/politica.xml',
    'https://www.cnnbrasil.com.br/politica/feed/',
    'https://rss.uol.com.br/feed/noticias.xml',
    'https://www.camara.leg.br/noticias/rss',
    'https://www12.senado.leg.br/noticias/rss/ultimas',
    'https://www.gov.br/secom/pt-br/assuntos/noticias/RSS'
  ];

  const toDeactivate = allFeeds?.filter(f => !politicalFeedsUrls.includes(f.url)).map(f => f.id) || [];
  
  if (toDeactivate.length > 0) {
    console.log("Deactivating irrelevant feeds:", toDeactivate.length);
    await supabase.from('feeds').update({ active: false }).in('id', toDeactivate);
  }

  console.log("Final active feeds check:");
  const { data: active } = await supabase.from('feeds').select('name, category').eq('active', true);
  console.table(active);
}

clean();
