
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function populate() {
  const politicians = [
    { name: 'Jerônimo Rodrigues',    party: 'PT',          state: 'BA', role: 'governador',      slug: 'jeronimo-rodrigues',    election_year: 2022, is_active: true },
    { name: 'Romeu Zema',            party: 'Novo',         state: 'MG', role: 'governador',      slug: 'romeu-zema',            election_year: 2022, is_active: true },
    { name: 'Cláudio Castro',        party: 'PL',           state: 'RJ', role: 'governador',      slug: 'claudio-castro',        election_year: 2022, is_active: true },
    { name: 'Eduardo Leite',         party: 'PSDB',         state: 'RS', role: 'governador',      slug: 'eduardo-leite',         election_year: 2022, is_active: true },
    { name: 'Evandro Leitão',        party: 'PT',           state: 'CE', role: 'prefeito',        city: 'Fortaleza',    slug: 'evandro-leitao',        election_year: 2024, is_active: true },
    { name: 'Eduardo Paes',          party: 'PSD',          state: 'RJ', role: 'prefeito',        city: 'Rio de Janeiro', slug: 'eduardo-paes',         election_year: 2024, is_active: true },
    { name: 'Bruno Reis',            party: 'União Brasil', state: 'BA', role: 'prefeito',        city: 'Salvador',     slug: 'bruno-reis',            election_year: 2024, is_active: true },
    { name: 'Fuad Noman',            party: 'PSD',          state: 'MG', role: 'prefeito',        city: 'Belo Horizonte', slug: 'fuad-noman',           election_year: 2024, is_active: true }
  ];

  console.log("Upserting politicians...");
  const { data: pols, error: polErr } = await supabase
    .from('politicians')
    .upsert(politicians, { onConflict: 'slug' })
    .select('id, name, slug, party');

  if (polErr) {
    console.error("Error upserting politicians:", polErr);
    return;
  }

  const polMap = {};
  pols.forEach(p => polMap[p.slug] = p);

  const promises = [
    // Jerônimo Rodrigues
    { politician_name: 'Jerônimo Rodrigues', politician_id: polMap['jeronimo-rodrigues'].id, party: 'PT', promise_title: 'Distribuição de tablets com internet para todos os estudantes do ensino médio estadual', category: 'Educação', status: 'pendente', data_promessa: '2022-10-01' },
    { politician_name: 'Jerônimo Rodrigues', politician_id: polMap['jeronimo-rodrigues'].id, party: 'PT', promise_title: 'Implementação de câmeras nos fardamentos de policiais e viaturas blindadas', category: 'Segurança', status: 'pendente', data_promessa: '2022-10-01' },
    { politician_name: 'Jerônimo Rodrigues', politician_id: polMap['jeronimo-rodrigues'].id, party: 'PT', promise_title: 'Criação de mutirão para melhoria da qualidade do ensino básico', category: 'Educação', status: 'pendente', data_promessa: '2022-10-01' },

    // Romeu Zema
    { politician_name: 'Romeu Zema', politician_id: polMap['romeue-zema']?.id || polMap['romeu-zema'].id, party: 'Novo', promise_title: 'Privatização de empresas estatais, incluindo a Cemig', category: 'Economia', status: 'pendente', data_promessa: '2022-10-01' },
    { politician_name: 'Romeu Zema', politician_id: polMap['romeu-zema'].id, party: 'Novo', promise_title: 'Retomada das obras de Hospitais Regionais em Minas Gerais', category: 'Saúde', status: 'pendente', data_promessa: '2022-10-01' },
    { politician_name: 'Romeu Zema', politician_id: polMap['romeu-zema'].id, party: 'Novo', promise_title: 'Transformação digital do estado para facilitar abertura de empresas', category: 'Economia', status: 'pendente', data_promessa: '2022-10-01' },

    // Cláudio Castro
    { politician_name: 'Cláudio Castro', politician_id: polMap['claudio-castro'].id, party: 'PL', promise_title: 'Geração de mais de um milhão de postos de trabalho até o fim de 2026', category: 'Trabalho', status: 'pendente', data_promessa: '2022-10-01' },
    { politician_name: 'Cláudio Castro', politician_id: polMap['claudio-castro'].id, party: 'PL', promise_title: 'Investimentos em mobilidade (metrô e BRS) através do programa PactoRJ', category: 'Transporte', status: 'pendente', data_promessa: '2022-10-01' },
    { politician_name: 'Cláudio Castro', politician_id: polMap['claudio-castro'].id, party: 'PL', promise_title: 'Ampliação do programa Segurança Presente em todo o estado', category: 'Segurança', status: 'pendente', data_promessa: '2022-10-01' },

    // Eduardo Leite
    { politician_name: 'Eduardo Leite', politician_id: polMap['eduardo-leite'].id, party: 'PSDB', promise_title: 'Ampliação do programa Devolve ICMS para famílias de baixa renda', category: 'Economia', status: 'pendente', data_promessa: '2022-10-01' },
    { politician_name: 'Eduardo Leite', politician_id: polMap['eduardo-leite'].id, party: 'PSDB', promise_title: 'Continuidade do programa RS Seguro com inteligência de dados', category: 'Segurança', status: 'pendente', data_promessa: '2022-10-01' },
    { politician_name: 'Eduardo Leite', politician_id: polMap['eduardo-leite'].id, party: 'PSDB', promise_title: 'Redução das filas de cirurgias através da ampliação do acesso à saúde', category: 'Saúde', status: 'pendente', data_promessa: '2022-10-01' },

    // Eduardo Paes
    { politician_name: 'Eduardo Paes', politician_id: polMap['eduardo-paes'].id, party: 'PSD', promise_title: 'Criação de um programa unificado de qualificação profissional em tecnologia e inovação', category: 'Trabalho', status: 'pendente', data_promessa: '2024-10-01' },
    { politician_name: 'Eduardo Paes', politician_id: polMap['eduardo-paes'].id, party: 'PSD', promise_title: 'Ampliação do programa Morar Carioca em comunidades das Zonas Norte e Oeste', category: 'Habitação', status: 'pendente', data_promessa: '2024-10-01' },
    { politician_name: 'Eduardo Paes', politician_id: polMap['eduardo-paes'].id, party: 'PSD', promise_title: 'Implementação de choque de civilidade com maior rigor nas leis de trânsito', category: 'Outros', status: 'pendente', data_promessa: '2024-10-01' },

    // Fuad Noman
    { politician_name: 'Fuad Noman', politician_id: polMap['fuad-noman'].id, party: 'PSD', promise_title: 'Monitoramento por GPS de toda a frota de ônibus para garantir viagens', category: 'Transporte', status: 'pendente', data_promessa: '2024-10-01' },
    { politician_name: 'Fuad Noman', politician_id: polMap['fuad-noman'].id, party: 'PSD', promise_title: 'Implementação de jardins de chuva para contenção de inundações em áreas críticas', category: 'Infraestrutura', status: 'pendente', data_promessa: '2024-10-01' },
    { politician_name: 'Fuad Noman', politician_id: polMap['fuad-noman'].id, party: 'PSD', promise_title: 'Renovação da frota de transporte público municipal', category: 'Transporte', status: 'pendente', data_promessa: '2024-10-01' },

    // Bruno Reis
    { politician_name: 'Bruno Reis', politician_id: polMap['bruno-reis'].id, party: 'União Brasil', promise_title: 'Renaturalização da Bacia do Rio Camarajipe e criação de corredores verdes', category: 'Infraestrutura', status: 'pendente', data_promessa: '2024-10-01' },
    { politician_name: 'Bruno Reis', politician_id: polMap['bruno-reis'].id, party: 'União Brasil', promise_title: 'Qualificação de 100 mil pessoas através do programa Novo Treinar Para Empregar', category: 'Trabalho', status: 'pendente', data_promessa: '2024-10-01' },
    { politician_name: 'Bruno Reis', politician_id: polMap['bruno-reis'].id, party: 'União Brasil', promise_title: 'Criação da primeira ótica pública municipal para distribuição de óculos', category: 'Saúde', status: 'pendente', data_promessa: '2024-10-01' },

    // Evandro Leitão
    { politician_name: 'Evandro Leitão', politician_id: polMap['evandro-leitao'].id, party: 'PT', promise_title: 'Implementação do maior programa de habitação da cidade em parceria com o Minha Casa Minha Vida', category: 'Habitação', status: 'pendente', data_promessa: '2024-10-01' },
    { politician_name: 'Evandro Leitão', politician_id: polMap['evandro-leitao'].id, party: 'PT', promise_title: 'Expansão das escolas em tempo integral em toda a rede municipal', category: 'Educação', status: 'pendente', data_promessa: '2024-10-01' },
    { politician_name: 'Evandro Leitão', politician_id: polMap['evandro-leitao'].id, party: 'PT', promise_title: 'Melhorias na infraestrutura e segurança de todos os terminais de transporte público', category: 'Segurança', status: 'pendente', data_promessa: '2024-10-01' }
  ];

  console.log("Inserting promises...");
  const { error: prErr } = await supabase.from('promises').insert(promises);
  if (prErr) {
    console.error("Error inserting promises:", prErr);
  } else {
    console.log("Promises Inserted Successfully!");
  }
}

populate();
