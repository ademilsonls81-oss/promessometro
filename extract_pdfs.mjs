import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE = join(__dirname, 'storage');
const OUT = join(__dirname, 'promessas', '_planos-governo');
const TMP = join(__dirname, 'tmp', 'harness');

const UF_MAP = {
  AC:'Acre',AL:'Alagoas',AM:'Amazonas',AP:'Amapá',BA:'Bahia',
  CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',
  MA:'Maranhão',MG:'Minas Gerais',MS:'Mato Grosso do Sul',MT:'Mato Grosso',
  PA:'Pará',PB:'Paraíba',PE:'Pernambuco',PI:'Piauí',PR:'Paraná',
  RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RO:'Rondônia',RR:'Roraima',
  RS:'Rio Grande do Sul',SC:'Santa Catarina',SE:'Sergipe',SP:'São Paulo',TO:'Tocantins'
};

// Politicians already in DB (from export manifest)
const EXISTING = [
  'PAULO DANTAS','GLADSON DE LIMA CAMELI','Fátima Bezerra','Tarcísio de Freitas',
  'Wanderlei Barbosa','IBANEIS ROCHA BARROS JÚNIOR','Antonio Denarium',
  'Jerônimo Rodrigues','CARLOS ORLEANS BRANDÃO JÚNIOR','RAFAEL TAJRA FONTELES',
  'Cláudio Castro','JOSÉ RENATO CASAGRANDE','CLÉCIO LUÍS VILHENA VIEIRA',
  'CARLOS MASSA RATINHO JUNIOR','ELMANO DE FREITAS DA COSTA',
  'PAULO SURUAGY DO AMARAL DANTAS','JOÃO AZEVEDO LINS FILHO',
  'RAQUEL TEIXEIRA LYRA LUCENA','Fábio Mitidieri','HELDER ZAHLUTH BARBALHO',
  'EDUARDO CORREA RIEDEL','Eduardo Leite','Jorginho Mello',
  'RONALDO RAMOS CAIADO','MARCOS JOSÉ ROCHA DOS SANTOS','Romeu Zema',
  'WILSON MIRANDA LIMA','WANDERLEI BARBOSA CASTRO','Fábio Cruz Mitidieri'
];

function extractName(filename) {
  // Example: AC_gladson_cameli.pdf, SP_tarcsio.pdf, MG_zema.pdf
  const base = filename.replace(/\.pdf$/i, '');
  const parts = base.split('_');
  const uf = parts[0].toUpperCase();
  const namePart = parts.slice(1).join(' ');
  return { uf, namePart, state: UF_MAP[uf] || uf };
}

function toSlug(text) {
  return text.toLowerCase()
    .replace(/[áàâãä]/g,'a').replace(/[éèêë]/g,'e')
    .replace(/[íìîï]/g,'i').replace(/[óòôõö]/g,'o')
    .replace(/[úùûü]/g,'u').replace(/[ç]/g,'c').replace(/[ñ]/g,'n')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').substring(0,80);
}

function makePlaceholderFile(politicianName, uf, stateName, rawText, pages) {
  const slug = toSlug(politicianName);
  const fpath = join(OUT, `${slug}.md`);
  if (existsSync(fpath)) return null;

  const chars = rawText.length;
  const preview = rawText.substring(0, 2000).trim();

  const content = `---
titulo: "Plano de Governo — ${stateName} (${uf})"
politico: "${politicianName}"
estado: "${stateName}"
uf: "${uf}"
data_extracao: "${new Date().toISOString().substring(0,10)}"
paginas: ${pages}
caracteres: ${chars}
status: "⚪ não processado"
fonte: "storage/${uf.toLowerCase()}_${slug}.pdf"
---

# Plano de Governo — ${stateName} (${uf})

## 📌 Dados

| Campo | Valor |
|-------|-------|
| **Estado** | ${stateName} |
| **UF** | ${uf} |
| **Político** | ${politicianName} |
| **Páginas** | ${pages} |
| **Caracteres** | ${chars} |
| **Status** | ⚪ não processado por IA |

---

## 📄 Texto Extraído (preview)

> Este arquivo contém o texto bruto extraído do PDF do plano de governo.
> **Necessita processamento por IA** para extração estruturada de promessas individuais.
> Use \`node processar_planos.mjs --uf ${uf}\` para processar.

\`\`\`
${preview}
\`\`\`

---

## 📊 Resumo por Categoria (pendente)

| Categoria | Qtd Promessas |
|-----------|--------------|
| Todas | ⏳ aguardando processamento IA |

> **Nota:** Para processar este PDF com extração de promessas, configure GROQ_API_KEY no .env
> e execute: \`node processar_planos.mjs\`
`;

  writeFileSync(fpath, content, 'utf-8');
  return fpath;
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  const files = readdirSync(STORAGE).filter(f => f.endsWith('.pdf') && !f.startsWith('.'));
  console.log(`Total PDFs: ${files.length}\n`);

  let processed = 0, skipped = 0, errors = [];

  for (const file of files) {
    const { uf, namePart, state } = extractName(file);
    // Derive politician name from filename
    const polName = namePart.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    const fpath = join(STORAGE, file);
    const buf = readFileSync(fpath);

    try {
      const data = await pdf(buf);
      const result = makePlaceholderFile(polName, uf, state, data.text, data.numpages);
      if (result) {
        console.log(`  OK: ${file} → ${result.split('/').slice(-2).join('/')} (${data.numpages}p, ${data.text.length}c)`);
        processed++;
      } else {
        console.log(`  SKIP: ${file} → já existe`);
        skipped++;
      }
    } catch (err) {
      console.error(`  ERRO: ${file} → ${err.message}`);
      errors.push(file);
    }
  }

  console.log(`\nProcessados: ${processed} | Ignorados: ${skipped} | Erros: ${errors.length}`);
  console.log(`Output: ${OUT}`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
