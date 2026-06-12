import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://liqutcjzzrqstivvfele.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0';

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

async function fetchAll(table, select = '*') {
  let all = [];
  let rangeStart = 0;
  const rangeSize = 1000;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${rangeSize}&offset=${rangeStart}`,
      { headers }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} for ${table}: ${text}`);
    }
    const data = await res.json();
    if (!data.length) break;
    all = all.concat(data);
    if (data.length < rangeSize) break;
    rangeStart += rangeSize;
  }
  return all;
}

const STATUS_MAP = {
  'cumprida': 'cumprida', 'parcialmente_cumprida': 'parcial',
  'parcial': 'parcial', 'em_andamento': 'em_andamento',
  'nao_iniciada': 'nao_iniciada', 'descumprida': 'quebrada',
  'nao_classificada': 'nao_classificada', 'fulfilled': 'cumprida',
  'partial': 'parcial', 'broken': 'quebrada', 'pending': 'pendente'
};
const EMOJI_MAP = {
  'cumprida': '🟢', 'parcial': '🔵', 'em_andamento': '🔵',
  'pendente': '🟡', 'nao_iniciada': '⚪', 'nao_classificada': '⚪', 'quebrada': '🔴'
};

function normStatus(s) {
  if (!s) return 'nao_classificada';
  const lower = s.toLowerCase().trim();
  return STATUS_MAP[lower] || lower;
}

function toSlug(text) {
  return text.toLowerCase()
    .replace(/[áàâãä]/g,'a').replace(/[éèêë]/g,'e')
    .replace(/[íìîï]/g,'i').replace(/[óòôõö]/g,'o')
    .replace(/[úùûü]/g,'u').replace(/[ç]/g,'c').replace(/[ñ]/g,'n')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').substring(0,80);
}

function fmtDate(d) {
  if (!d) return '';
  try { return d.substring(0,10); } catch(e) { return ''; }
}

const TEMPLATE_PATH = join(__dirname, 'templates', 'promessa.md');
const PROMESSAS_DIR = join(__dirname, 'promessas');

async function main() {
  console.log('=== PROMESSÔMETRO EXPORT ===\n');
  const tpl = readFileSync(TEMPLATE_PATH, 'utf-8');

  // 1. Fetch all
  console.log('Buscando políticos...');
  const politicians = await fetchAll('politicians');
  const polMap = {};
  for (const p of politicians) polMap[p.id] = p;
  console.log(`  ${politicians.length} políticos`);

  console.log('Buscando promessas...');
  const promises = await fetchAll('promises');
  console.log(`  ${promises.length} promessas\n`);

  // Group by politician
  const byPol = {};
  for (const p of promises) {
    const name = p.politician_name || 'Desconhecido';
    if (!byPol[name]) byPol[name] = [];
    byPol[name].push(p);
  }

  console.log('Por político:');
  for (const [n, l] of Object.entries(byPol).sort((a,b) => b[1].length - a[1].length))
    console.log(`  ${n}: ${l.length}`);

  // 2. Create files
  console.log('\nCriando arquivos...');
  let created = 0, dup = 0, err = 0;
  const createdFiles = [];

  for (const [polName, list] of Object.entries(byPol)) {
    const folderName = toSlug(polName);
    const fpath = join(PROMESSAS_DIR, folderName);
    if (!existsSync(fpath)) mkdirSync(fpath, { recursive: true });

    for (const prom of list) {
      const pol = polMap[prom.politician_id] || {};
      const status = normStatus(prom.status);
      const emoji = EMOJI_MAP[status] || '⚪';
      const score = prom.fulfillment_score ?? prom.classificacao_ia?.score ?? null;
      const slug = toSlug(prom.promise_title || 'sem-titulo');
      const fp = join(fpath, `${slug}.md`);

      if (existsSync(fp)) { dup++; continue; }

      const cat = prom.category || prom.classificacao_ia?.categoria || 'Não categorizada';
      const desc = prom.ai_evaluation || prom.evidence || prom.promise_title || '';
      const src = prom.source_link || prom.source_doc_url || prom.classificacao_ia?.fontes?.[0] || '';
      const veiculo = prom.evidences_used?.[0]?.fonte || '';
      const dataPub = fmtDate(prom.data_promessa);
      const dataCriacao = fmtDate(prom.created_at);
      const dataVerif = fmtDate(prom.last_verified_at || prom.updated_at);
      const iaStatus = prom.classificacao_ia?.status || status;
      const iaScore = prom.classificacao_ia?.score ?? '';
      const iaModelo = prom.classificacao_ia?.modelo || '';
      const evidencesList = (prom.evidences_used || []).map((e,i) =>
        `${i+1}. [${e.descricao||'Fonte'}](${e.url||'#'}) — ${e.fonte||''}`
      ).join('\n') || 'Nenhuma evidência registrada.';

      let file = tpl
        .replace(/\{\{titulo\}\}/g, prom.promise_title || 'Sem título')
        .replace(/\{\{politico\}\}/g, polName)
        .replace(/\{\{partido\}\}/g, pol.party || prom.party || '')
        .replace(/\{\{cargo\}\}/g, pol.role || '')
        .replace(/\{\{estado\}\}/g, pol.state || '')
        .replace(/\{\{url ou referencia\}\}/g, src)
        .replace(/\{\{ex: Saúde, Educação, Infraestrutura, Segurança, Economia\}\}/g, cat)
        .replace(/\{\{categoria\}\}/g, cat)

        // Status
        .replace('🟡 pendente', `${emoji} ${status}`)

        // Dates
        .replace(/\{\{YYYY-MM-DD\}\}/g, fmtDate(prom.data_promessa || prom.created_at || ''))

        // Body frontmatter fields
        .replace(/\{\{descricao\}\}/g, desc)
        .replace(/\{\{url\}\}/g, src)
        .replace(/\{\{veiculo\}\}/g, veiculo)
        .replace(/\{\{data_publicacao\}\}/g, dataPub)
        .replace(/\{\{criterio_verificacao\}\}/g, '')

        // Additional: IA info
        .replace(/\{\{STATUS_IA\}\}/g, iaStatus)
        .replace(/\{\{SCORE_IA\}\}/g, String(iaScore))
        .replace(/\{\{MODELO_IA\}\}/g, iaModelo)
        .replace(/\{\{EVIDENCES_USED\}\}/g, evidencesList)

        // Score
        .replace(/\{\{SCORE\}\}/g, score !== null ? String(score) : 'N/A')
        .replace(/\{\{FULFILLMENT_SCORE\}\}/g, score !== null ? String(score) : 'N/A')
        .replace(/\{\{POLITICO_ID\}\}/g, prom.politician_id || '')
        .replace(/\{\{PROMISE_ID\}\}/g, prom.id || '');

      // Replace any remaining YYYY-MM-DD
      const today = new Date().toISOString().substring(0,10);
      file = file.replace(/\{\{YYYY-MM-DD\}\}/g, today);

      try {
        writeFileSync(fp, file, 'utf-8');
        created++;
        createdFiles.push({
          path: `promessas/${folderName}/${slug}.md`,
          politician: polName,
          title: prom.promise_title,
          status, score
        });
      } catch(e) {
        console.error(`  ERRO ao escrever ${fp}: ${e.message}`);
        err++;
      }
    }
  }

  // Save manifest
  const outDir = join(__dirname, 'tmp', 'harness');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'promises_export.json'), JSON.stringify(promises, null, 2), 'utf-8');
  writeFileSync(join(outDir, 'politicians_export.json'), JSON.stringify(politicians, null, 2), 'utf-8');
  writeFileSync(join(outDir, 'export_manifest.json'), JSON.stringify(createdFiles, null, 2), 'utf-8');

  console.log(`\n  Criados: ${created} | Duplicados: ${dup} | Erros: ${err}`);
  console.log('Export JSON salvo em tmp/harness/');
  console.log('\n=== CONCLUÍDO ===');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
