
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function improveCredibility() {
  console.log("Updating IR promise status...");
  
  const { error: err1 } = await supabase
    .from('promises')
    .update({ 
      status: 'parcial',
      fulfillment_score: 60,
      evidence: 'Projeto aprovado na Câmara dos Deputados em dezembro de 2024. Aguarda regulamentação e implementação pelo Fisco para entrar em vigor em 2026.'
    })
    .or('promise_title.ilike.%isenção%imposto%renda%,promise_title.ilike.%IR%5.000%,titulo.ilike.%isenção%IR%');
  
  if (err1) console.error("Error updating IR promise:", err1);

  console.log("Updating politician photos...");
  
  const photos = [
    { slug: 'luiz-inacio-lula-da-silva', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Lula_-_foto_oficial_2023.jpg/240px-Lula_-_foto_oficial_2023.jpg' },
    { slug: 'tarcisio-gomes-de-freitas', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Tarcisio_de_Freitas_%282022%29.jpg/240px-Tarcisio_de_Freitas_%282022%29.jpg' },
    { slug: 'ricardo-luis-bernardo-nunes', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Ricardo_Nunes_2024.jpg/240px-Ricardo_Nunes_2024.jpg' }
  ];

  for (const item of photos) {
    const { error } = await supabase
      .from('politicians')
      .update({ photo_url: item.url })
      .eq('slug', item.slug);
    if (error) console.error(`Error updating photo for ${item.slug}:`, error);
  }

  console.log("Verification...");
  const { data: promises } = await supabase
    .from('promises')
    .select('promise_title, status, fulfillment_score')
    .eq('status', 'parcial');
  console.table(promises);

  const { data: pols } = await supabase
    .from('politicians')
    .select('name, photo_url')
    .in('slug', photos.map(p => p.slug));
  console.table(pols);
}

improveCredibility();
