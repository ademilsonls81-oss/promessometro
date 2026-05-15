
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePhotos() {
  const photoUpdates = [
    { slug: 'jeronimo-rodrigues', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Jer%C3%B4nimo_Rodrigues_%282022%29.jpg/240px-Jer%C3%B4nimo_Rodrigues_%282022%29.jpg' },
    { slug: 'romeu-zema', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Romeu_Zema_2019.jpg/240px-Romeu_Zema_2019.jpg' },
    { slug: 'claudio-castro', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Cl%C3%A1udio_Castro_2021.jpg/240px-Cl%C3%A1udio_Castro_2021.jpg' },
    { slug: 'eduardo-leite', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Eduardo_Leite_2023.jpg/240px-Eduardo_Leite_2023.jpg' },
    { slug: 'eduardo-paes', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Eduardo_Paes_2021.jpg/240px-Eduardo_Paes_2021.jpg' },
    { slug: 'evandro-leitao', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Evandro_Leit%C3%A3o_2024.jpg/240px-Evandro_Leit%C3%A3o_2024.jpg' },
    { slug: 'bruno-reis', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Bruno_Reis_2021.jpg/240px-Bruno_Reis_2021.jpg' },
    { slug: 'fuad-noman', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Fuad_Noman_2024.jpg/240px-Fuad_Noman_2024.jpg' }
  ];

  console.log("Updating politician photos...");
  for (const update of photoUpdates) {
    const { error } = await supabase
      .from('politicians')
      .update({ photo_url: update.url })
      .eq('slug', update.slug);
    
    if (error) {
      console.error(`Error updating photo for ${update.slug}:`, error.message);
    } else {
      console.log(`Updated photo for ${update.slug}`);
    }
  }

  console.log("\nVerifying updates...");
  const { data, error } = await supabase
    .from('politicians')
    .select('name, photo_url, slug')
    .not('photo_url', 'is', null)
    .order('name');
  
  if (error) {
    console.error("Verification error:", error.message);
  } else {
    console.table(data);
  }
}

updatePhotos();
