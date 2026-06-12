import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = 'C:\\Users\\user\\Desktop\\Promessometro';
const PROMESSAS = join(ROOT, 'promessas');
const POLITICOS = join(ROOT, 'politicos');
const CATEGORIAS = join(ROOT, 'categorias');
const ESTADOS = join(ROOT, 'estados');

const UF_NOME = {
  AC:'Acre',AL:'Alagoas',AM:'Amazonas',AP:'Amapá',BA:'Bahia',
  CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',
  MA:'Maranhão',MG:'Minas Gerais',MS:'Mato Grosso do Sul',
  PA:'Pará',PB:'Paraíba',PE:'Pernambuco',PI:'Piauí',PR:'Paraná',
  RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RO:'Rondônia',RR:'Roraima',
  RS:'Rio Grande do Sul',SC:'Santa Catarina',SE:'Sergipe',SP:'São Paulo',TO:'Tocantins'
};

function slug(text) {
  return text.toLowerCase()
    .replace(/[áàâãä]/g,'a').replace(/[éèêë]/g,'e')
    .replace(/[íìîï]/g,'i').replace(/[óòôõö]/g,'o')
    .replace(/[úùûü]/g,'u').replace(/[ç]/g,'c').replace(/[ñ]/g,'n')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').substring(0,80);
}

// Load export data
const data = JSON.parse(readFileSync(join(ROOT, 'tmp', 'harness', 'promises_export.json'), 'utf-8'));
const pols = JSON.parse(readFileSync(join(ROOT, 'tmp', 'harness', 'politicians_export.json'), 'utf-8'));

// Build index: politician_name -> { state, party, role, promises[] }
const polIndex = {};
for (const p of data) {
  const name = p.politician_name || 'Desconhecido';
  const pol = pols.find(x => x.id === p.politician_id);
  if (!polIndex[name]) {
    polIndex[name] = {
      state: pol?.state || '',
      party: pol?.party || p.party || '',
      role: pol?.role || '',
      slug: slug(name),
      promises: []
    };
  }
  const cat = (p.category || p.classificacao_ia?.categoria || 'Não categorizada').trim();
  const promSlug = slug(p.promise_title || 'sem-titulo');
  polIndex[name].promises.push({
    title: p.promise_title,
    slug: promSlug,
    id: p.id,
    status: p.status,
    category: cat
  });
}

// Build category index
const catIndex = {};
for (const [polName, polData] of Object.entries(polIndex)) {
  for (const pr of polData.promises) {
    if (!catIndex[pr.category]) catIndex[pr.category] = [];
    catIndex[pr.category].push({ polName, polSlug: polData.slug, title: pr.title, slug: pr.slug, status: pr.status });
  }
}

// Build state index
const estadoIndex = {};
for (const [polName, polData] of Object.entries(polIndex)) {
  if (!polData.state) continue;
  const estadoNome = UF_NOME[polData.state] || polData.state;
  if (!estadoIndex[estadoNome]) estadoIndex[estadoNome] = { uf: polData.state, politicians: [] };
  estadoIndex[estadoNome].politicians.push({ name: polName, slug: polData.slug, qtd: polData.promises.length });
}

console.log('=== CRIANDO GRAFO OBSIDIAN ===\n');

// Helper: read frontmatter from a markdown file
function readFm(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const fm = {};
    for (const line of m[1].split('\n')) {
      const [k, ...v] = line.split(':');
      if (k && v.length) fm[k.trim()] = v.join(':').trim().replace(/"/g, '');
    }
    return fm;
  } catch { return null; }
}

// ---- 1. Update promise files with [[]] links ----
console.log('1. Atualizando arquivos de promessas com links [[]]...');
let updated = 0, skipped = 0;

// Walk all promessas subdirs
const dirs = readdirSync(PROMESSAS, { withFileTypes: true });
for (const dir of dirs) {
  if (!dir.isDirectory() || dir.name.startsWith('_')) continue;
  const dirPath = join(PROMESSAS, dir.name);
  const files = readdirSync(dirPath).filter(f => f.endsWith('.md'));
  
  // Find politician name from folder
  let polName = null;
  for (const [n, pd] of Object.entries(polIndex)) {
    if (pd.slug === dir.name) { polName = n; break; }
  }
  if (!polName) continue;
  const polData = polIndex[polName];

  for (const file of files) {
    const fpath = join(dirPath, file);
    const fm = readFm(fpath);
    if (!fm) { skipped++; continue; }

    let content = readFileSync(fpath, 'utf-8');
    const promSlug = file.replace(/\.md$/, '');
    
    // Find matching promise data
    const pr = polData.promises.find(p => p.slug === promSlug);
    
    const polLink = `[[politicos/${polName}]]`;
    const catVal = pr?.category || fm.categoria || 'Não categorizada';
    const stateVal = polData.state;
    const estadoNome = UF_NOME[stateVal] || stateVal;
    const catLink = `[[categorias/${catVal}]]`;
    const estadoLink = estadoNome ? `[[estados/${estadoNome}]]` : '';

    // Check if already has links section
    if (content.includes('## 🔗 Links')) { skipped++; continue; }

    // Add links section before Evidências or at end
    const linksSection = [
      '',
      '---',
      '',
      '## 🔗 Links',
      '',
      `- **Político**: ${polLink}`,
      `- **Categoria**: ${catLink}`,
      estadoLink ? `- **Estado**: ${estadoLink}` : '',
      ''
    ].filter(Boolean).join('\n');

    // Insert before "📎 Evidências" if present, otherwise append
    if (content.includes('## 📎 Evidências')) {
      content = content.replace('## 📎 Evidências', `${linksSection}\n## 📎 Evidências`);
    } else {
      content = content.trimEnd() + '\n' + linksSection;
    }

    writeFileSync(fpath, content, 'utf-8');
    updated++;
  }
}
console.log(`  ${updated} atualizados, ${skipped} ignorados\n`);

// ---- Same for seed files in root promessas/ ----
console.log('2. Atualizando seed files raiz...');
const seedFiles = readdirSync(PROMESSAS).filter(f => f.endsWith('.md') && !f.startsWith('.') && f !== 'EXEMPLO-promessa.md');
// Map seeds manually
const seedMap = {
  'lula-zerar-fome': { pol: 'Luiz Inácio Lula da Silva', cat: 'Saúde', estado: '' },
  'lula-6m-empregos': { pol: 'Luiz Inácio Lula da Silva', cat: 'Trabalho', estado: '' },
  'lula-reconhecer-venezuela': { pol: 'Luiz Inácio Lula da Silva', cat: 'Outros', estado: '' },
  'bolsonaro-100-anos-petroleo': { pol: 'Jair Bolsonaro', cat: 'Economia', estado: '' },
  'bolsonaro-armas': { pol: 'Jair Bolsonaro', cat: 'Segurança', estado: '' },
  'bolsonaro-imposto-unico': { pol: 'Jair Bolsonaro', cat: 'Economia', estado: '' },
  'tarcisio-metro-linha2': { pol: 'Tarcísio de Freitas', cat: 'Transporte', estado: 'SP' },
  'zema-mil-escolas': { pol: 'Romeu Zema', cat: 'Educação', estado: 'MG' },
  'claudia-lei-seguranca-rj': { pol: 'Cláudio Castro', cat: 'Segurança', estado: 'RJ' },
};
let seedUpdated = 0;
for (const file of seedFiles) {
  const base = file.replace(/\.md$/, '');
  const info = seedMap[base];
  if (!info) continue;
  const fpath = join(PROMESSAS, file);
  let content = readFileSync(fpath, 'utf-8');
  if (content.includes('## 🔗 Links')) continue;
  const estadoNome = info.estado ? UF_NOME[info.estado] || info.estado : '';
  const links = [
    '', '---', '', '## 🔗 Links', '',
    `- **Político**: [[politicos/${info.pol}]]`,
    `- **Categoria**: [[categorias/${info.cat}]]`,
    estadoNome ? `- **Estado**: [[estados/${estadoNome}]]` : '',
    ''
  ].filter(Boolean).join('\n');
  if (content.includes('## 📎 Evidências')) {
    content = content.replace('## 📎 Evidências', `${links}\n## 📎 Evidências`);
  } else {
    content = content.trimEnd() + '\n' + links;
  }
  writeFileSync(fpath, content, 'utf-8');
  seedUpdated++;
}
console.log(`  ${seedUpdated} seed files atualizados\n`);

// ---- 3. Create politicos/ ----
console.log('3. Criando politicos/...');
if (!existsSync(POLITICOS)) mkdirSync(POLITICOS);
let polCreated = 0;
for (const [name, pd] of Object.entries(polIndex)) {
  const estadoNome = pd.state ? UF_NOME[pd.state] || pd.state : '';
  const estadoLink = estadoNome ? `[[estados/${estadoNome}]]` : '';
  const fpath = join(POLITICOS, `${name}.md`);
  
  const promLines = pd.promises.map(p => {
    const emoji = p.status === 'cumprida' ? '🟢' : p.status === 'parcial' || p.status === 'em_andamento' ? '🔵' : p.status === 'pendente' ? '🟡' : p.status === 'quebrada' ? '🔴' : '⚪';
    return `- ${emoji} [[promessas/${pd.slug}/${p.slug}|${p.title}]]`;
  }).join('\n');

  const content = `---
nome: "${name}"
partido: "${pd.party}"
cargo: "${pd.role}"
estado: "${estadoNome || ''}"
total_promessas: ${pd.promises.length}
---

# ${name}

## 📌 Dados

| Campo | Valor |
|-------|-------|
| **Nome** | ${name} |
| **Partido** | ${pd.party} |
| **Cargo** | ${pd.role} |
| **Estado** | ${estadoLink || '—'} |
| **Total de Promessas** | ${pd.promises.length} |

---

## 📋 Promessas

${promLines}
`;

  writeFileSync(fpath, content, 'utf-8');
  polCreated++;
}
console.log(`  ${polCreated} políticos criados em politicos/\n`);

// ---- 4. Create categorias/ ----
console.log('4. Criando categorias/...');
if (!existsSync(CATEGORIAS)) mkdirSync(CATEGORIAS);
let catCreated = 0;
for (const [cat, promList] of Object.entries(catIndex)) {
  const fpath = join(CATEGORIAS, `${cat}.md`);
  
  const promLines = promList.map(p => {
    const emoji = p.status === 'cumprida' ? '🟢' : p.status === 'parcial' || p.status === 'em_andamento' ? '🔵' : p.status === 'pendente' ? '🟡' : p.status === 'quebrada' ? '🔴' : '⚪';
    return `- ${emoji} [[promessas/${p.polSlug}/${p.slug}|${p.title}]] — [[politicos/${p.polName}]]`;
  }).join('\n');

  const content = `---
categoria: "${cat}"
total_promessas: ${promList.length}
---

# ${cat}

## 📌 Dados

| Campo | Valor |
|-------|-------|
| **Categoria** | ${cat} |
| **Total de Promessas** | ${promList.length} |

---

## 📋 Promessas

${promLines}
`;

  writeFileSync(fpath, content, 'utf-8');
  catCreated++;
}
console.log(`  ${catCreated} categorias criadas em categorias/\n`);

// ---- 5. Create estados/ ----
console.log('5. Criando estados/...');
if (!existsSync(ESTADOS)) mkdirSync(ESTADOS);
let estCreated = 0;
for (const [nome, ed] of Object.entries(estadoIndex)) {
  const fpath = join(ESTADOS, `${nome}.md`);

  const polLines = ed.politicians
    .sort((a,b) => b.qtd - a.qtd)
    .map(p => `- [[politicos/${p.name}]] — ${p.qtd} promessas`)
    .join('\n');

  const content = `---
estado: "${nome}"
uf: "${ed.uf}"
politicos: ${ed.politicians.length}
---

# ${nome} (${ed.uf})

## 📌 Dados

| Campo | Valor |
|-------|-------|
| **Estado** | ${nome} |
| **UF** | ${ed.uf} |
| **Políticos** | ${ed.politicians.length} |

---

## 🏛️ Políticos

${polLines}
`;

  writeFileSync(fpath, content, 'utf-8');
  estCreated++;
}
console.log(`  ${estCreated} estados criados em estados/\n`);

// Summary
let totalPromFiles = 0;
for (const dir of readdirSync(PROMESSAS, { withFileTypes: true })) {
  if (dir.isFile() && dir.name.endsWith('.md')) totalPromFiles++;
  if (dir.isDirectory() && !dir.name.startsWith('_')) {
    totalPromFiles += readdirSync(join(PROMESSAS, dir.name)).filter(f => f.endsWith('.md')).length;
  }
}

console.log('=== RESUMO ===');
console.log(`  Promessas com links [[]]: ${updated + seedUpdated}`);
console.log(`  Arquivos em politicos/: ${polCreated}`);
console.log(`  Arquivos em categorias/: ${catCreated}`);
console.log(`  Arquivos em estados/: ${estCreated}`);
console.log(`  Total arquivos .md em promessas/: ${totalPromFiles}`);
console.log(`\nConexões no grafo Obsidian: ~${updated + seedUpdated + polCreated * (polCreated > 0 ? 1 : 0)} nós com links bidirecionais`);
