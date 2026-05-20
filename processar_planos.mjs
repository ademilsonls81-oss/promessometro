import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import axios from "axios";

// ─── CONFIG ────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE = join(__dirname, "storage");
const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";
const SERPER_KEY = process.env.SERPER_API_KEY || "";
const AI_URL = "https://api.groq.com/openai/v1";
const MODEL = "llama-3.1-8b-instant";
const BATCH_PAGES = 5;
const PAGE_SIZE = 3000;
const RETRY_DELAYS = [5000, 10000, 20000];
const DELAY_BETWEEN_CALLS = 6000;

const db = createClient(
  process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// UF → nome completo (último censo TSE)
const UF_MAP = {
  AC:"Acre",AL:"Alagoas",AM:"Amazonas",AP:"Amapá",BA:"Bahia",
  CE:"Ceará",DF:"Distrito Federal",ES:"Espírito Santo",GO:"Goiás",
  MA:"Maranhão",MG:"Minas Gerais",MS:"Mato Grosso do Sul",MT:"Mato Grosso",
  PA:"Pará",PB:"Paraíba",PE:"Pernambuco",PI:"Piauí",PR:"Paraná",
  RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RO:"Rondônia",RR:"Roraima",
  RS:"Rio Grande do Sul",SC:"Santa Catarina",SE:"Sergipe",SP:"São Paulo",TO:"Tocantins"
};

// ─── HELPERS ───────────────────────────────────────────────────

function slugify(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normParty(sigla) {
  const str = String(sigla || "").replace(/\D/g, "");
  const map = {
    "13":"PT","22":"PL","45":"PSDB","15":"MDB","11":"PP","55":"PSD",
    "12":"PDT","10":"Republicanos","40":"PSB","20":"PSC","70":"Avante",
    "77":"Solidariedade","28":"PRTB","65":"PCdoB","50":"PSOL",
    "30":"Novo","19":"Podemos","36":"PMN","27":"DC","90":"PROS",
    "17":"PSL","51":"Patriota","33":"PMB","18":"Rede","16":"UP",
    "14":"PTB","25":"PRD","44":"União Brasil","23":"Cidadania",
    "35":"PMB","43":"PV","29":"PCO","21":"PCB","31":"PSTU",
    "8":"PST","9":"PTdoB","4":"PP","6":"PTN"
  };
  return map[str] || String(sigla || "Sem partido");
}

function normalizeCategory(cat) {
  if (!cat) return "Outros";
  const map = { saude:"Saude",educacao:"Educacao",seguranca:"Seguranca",economia:"Economia",infraestrutura:"Infraestrutura",meio_ambiente:"Meio_Ambiente",trabalho:"Trabalho",habitacao:"Habitacao",transporte:"Transporte" };
  const key = cat.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return map[key] || "Outros";
}

function isDuplicate(title, existingTitles) {
  const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  return existingTitles.some(e => {
    const eWords = e.split(/\s+/).filter(w => w.length > 3);
    const inter = words.filter(w => eWords.includes(w));
    return inter.length >= Math.min(3, words.length * 0.4);
  });
}

function chunkText(text, maxChars) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxChars)
    chunks.push(text.substring(i, i + maxChars));
  return chunks;
}

// ─── GROQ EXTRACTION ──────────────────────────────────────────

async function extractWithGroq(text, nome) {
  if (!GROQ_KEY) return [];
  let chunk = text.substring(0, 15000);

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const prompt = `Analise o plano de governo de ${nome}.
Extraia uma lista EXAUSTIVA de todas as promessas, compromissos e propostas específicas.

REGRAS:
1. IGNORE sumários/índices — foque em propostas REAIS
2. IGNORE frases genéricas — apenas ação concreta
3. Divida propostas com múltiplas ações
4. Categorias: Saude, Educacao, Seguranca, Economia, Infraestrutura, Meio_Ambiente, Trabalho, Habitacao, Transporte, Outros

Texto:
${chunk}

Retorne JSON: {"promessas":[{"titulo":"...","descricao":"...","categoria":"..."}]}`;

    try {
      const r = await axios.post(`${AI_URL}/chat/completions`, {
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1024
      }, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
        timeout: 25000,
        validateStatus: s => s < 500
      });

      if (r.status === 429) {
        const wait = RETRY_DELAYS[tentativa] || 4000;
        console.log(`  ⏳ 429 — esperando ${wait}ms`);
        await new Promise(rs => setTimeout(rs, wait));
        continue;
      }
      if (r.status === 413) {
        const half = chunk.substring(0, Math.floor(chunk.length / 2));
        if (half.length < 200) return [];
        chunk = half;
        continue;
      }
      if (r.status !== 200) {
        console.error(`  ❌ Groq HTTP ${r.status}`);
        return [];
      }
      const d = r.data;
      const raw = d.choices?.[0]?.message?.content?.trim();
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : (parsed.promessas || parsed.promises || []);
      return arr.filter(p => p.titulo && p.titulo.length > 3);
    } catch (e) {
      if (tentativa < 2) {
        const wait = RETRY_DELAYS[tentativa] || 4000;
        console.log(`  ⏳ erro — retry ${wait}ms: ${e.message?.substring(0,60)}`);
        await new Promise(rs => setTimeout(rs, wait));
        continue;
      }
      return [];
    }
  }
  return [];
}

// ─── TSE API ───────────────────────────────────────────────────

async function fetchGovernadorEleito(uf) {
  try {
    const headers = { "User-Agent": "Mozilla/5.0", "Accept": "application/json" };
    const r1 = await axios.get(
      `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar/2022/${uf}/2040602022/3/candidatos`,
      { headers, timeout: 15000 }
    );
    const el = (r1.data?.candidatos || []).find(c => c.descricaoTotalizacao === "Eleito");
    if (!el) return null;

    const r2 = await axios.get(
      `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2022/${uf}/2040602022/candidato/${el.id}`,
      { headers, timeout: 15000 }
    );
    const det = r2.data || {};
    const partido = normParty(det.partido?.sigla || el.partido || "Sem partido");
    const nomeCompleto = det.nomeCompleto || el.nomeCompleto || el.nomeUrna;

    return { id: el.id, nomeUrna: el.nomeUrna, nomeCompleto, partido, uf };
  } catch (e) {
    console.error(`  [TSE] ${uf}: ${e.message}`);
    return null;
  }
}

// ─── SQL HELPERS ───────────────────────────────────────────────

async function ensurePolitician(info) {
  // Check if exists by slug
  const slug = slugify(info.nomeCompleto);
  const { data: exist } = await db.from("politicians")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle();

  if (exist) {
    console.log(`  🟢 Já existe: ${exist.name} (${exist.id.substring(0,8)}...)`);
    return exist;
  }

  const nova = {
    name: info.nomeCompleto,
    slug,
    role: "governador",
    state: info.uf,
    party: info.partido,
    is_active: true,
    election_year: 2022,
    c1_score: 0,
    c2_score: 0,
    c3_score: 0,
    final_score: 0,
    grade: "F",
    methodology_version: "1.0"
  };

  const { data: created, error } = await db.from("politicians").insert(nova).select().single();
  if (error) {
    console.error(`  ❌ Erro criando político: ${error.message}`);
    return null;
  }
  console.log(`  🆕 Criado: ${created.name} (${created.id.substring(0,8)}...)`);
  return created;
}

// ─── PROCESSAR PDF ─────────────────────────────────────────────

async function processarPDF(filePath, politico, statusFile) {
  const nome = politico.name;
  console.log(`\n📄 Processando: ${nome} (${filePath})`);

  // 1. Ler PDF
  let pdfText = "";
  try {
    const buf = readFileSync(filePath);
    const pdfParse = (await import("pdf-parse")).default;
    const pd = await pdfParse(buf);
    pdfText = pd.text || "";
    if (pdfText.length < 100) {
      console.log("  ⚠️  PDF vazio ou ilegível");
      return 0;
    }
  } catch (e) {
    console.error(`  ❌ Erro lendo PDF: ${e.message}`);
    return 0;
  }

  const pages = chunkText(pdfText, PAGE_SIZE);
  const totalBatches = Math.ceil(pages.length / BATCH_PAGES);
  console.log(`  📃 ${pages.length} páginas → ${totalBatches} batches de ${BATCH_PAGES}`);

  // 2. Buscar promessas existentes para dedup
  const { data: existentes } = await db.from("promises")
    .select("id,promise_title")
    .eq("politician_id", politico.id);
  const existingTitles = (existentes || []).map(p => p.promise_title.toLowerCase().trim());

  let todasPromessas = [];
  let batchOk = 0;

  for (let b = 0; b < totalBatches; b++) {
    const startPage = b * BATCH_PAGES;
    const endPage = Math.min(startPage + BATCH_PAGES, pages.length);
    const merged = pages.slice(startPage, endPage).join("\n\n---\n\n");

    console.log(`  🔄 Batch ${b+1}/${totalBatches} (págs ${startPage+1}-${endPage})...`);
    const resultado = await extractWithGroq(merged, nome);

    if (resultado.length > 0) {
      todasPromessas.push(...resultado.map(p => ({
        ...p,
        fonte: "pdf_tse",
        batch: b + 1
      })));
      batchOk++;
    }
    console.log(`     → ${resultado.length} promessas extraídas`);
    // delay entre batches para evitar rate-limit
    if (b < totalBatches - 1) await new Promise(rs => setTimeout(rs, DELAY_BETWEEN_CALLS));
  }

  console.log(`  📊 Total extraído: ${todasPromessas.length} promessas em ${batchOk}/${totalBatches} batches`);

  // 3. Dedup
  const unicas = [];
  for (const p of todasPromessas) {
    const titulo = (p.titulo || "").trim();
    if (!titulo || titulo.length < 4) continue;
    if (!isDuplicate(titulo, existingTitles)) {
      unicas.push(p);
      existingTitles.push(titulo.toLowerCase());
    }
  }
  console.log(`  🎯 Após dedup: ${unicas.length} novas de ${todasPromessas.length}`);

  // 4. Inserir
  let inserted = 0;
  for (const p of unicas) {
    try {
      const { error } = await db.from("promises").insert({
        politician_id: politico.id,
        politician_name: nome,
        promise_title: (p.titulo || "").trim(),
        category: normalizeCategory(p.categoria),
        status: "pendente",
        fulfillment_score: 50,
        party: politico.party
      });
      if (!error) inserted++;
    } catch {}
  }
  console.log(`  ✅ ${inserted} promessas inseridas!`);

  // 5. Salvar checkpoint
  const status = {
    politico: nome,
    politico_id: politico.id,
    total_paginas: pages.length,
    extraidas: todasPromessas.length,
    inseridas: inserted,
    existentes_antes: (existentes || []).length,
    politico_state: politico.state
  };
  const existing = JSON.parse(readFileSync(statusFile, "utf-8"));
  existing.processados.push(status);
  writeFileSync(statusFile, JSON.stringify(existing, null, 2));

  return inserted;
}

// ─── MAIN ──────────────────────────────────────────────────────

async function main() {
  console.log("=== PROCESSAR PLANOS DE GOVERNO (LOCAL) ===\n");

  // Checar APIs
  if (!GROQ_KEY) { console.error("❌ GROQ_API_KEY não configurada"); process.exit(1); }
  if (!existsSync(STORAGE)) { console.error("❌ Pasta storage/ não existe"); process.exit(1); }

  // Listar PDFs de governadores (excluir arquivos que não são do formato UF_nome.pdf)
  const pdfs = readdirSync(STORAGE)
    .filter(f => f.match(/^[A-Z]{2}_.+\.pdf$/))
    .sort();

  console.log(`📁 ${pdfs.length} PDFs encontrados em storage/\n`);

  // Arquivo de checkpoint
  const statusFile = join(__dirname, "processamento_status.json");
  if (!existsSync(statusFile)) {
    writeFileSync(statusFile, JSON.stringify({ processados: [] }, null, 2));
  }

  for (const pdf of pdfs) {
    const uf = pdf.substring(0, 2);

    // Buscar info do TSE
    const info = await fetchGovernadorEleito(uf);
    if (!info) {
      console.error(`❌ ${uf} — não foi possível obter dados do TSE`);
      continue;
    }

    // Garantir político no banco
    const politico = await ensurePolitician(info);
    if (!politico) continue;

    // Pular se já processado (checkpoint)
    const cp = JSON.parse(readFileSync(statusFile, "utf-8"));
    if (cp.processados.some(p => p.politico_id === politico.id)) {
      console.log(`  ⏭️  Já processado: ${info.nomeUrna}`);
      continue;
    }

    // Processar PDF
    const filePath = join(STORAGE, pdf);
    await processarPDF(filePath, politico, statusFile);

    // Aguardar entre políticos para rate-limit
    console.log(`  ⏳ Aguardando 3s...`);
    await new Promise(rs => setTimeout(rs, 3000));
  }

  // Relatório final
  const final = JSON.parse(readFileSync(statusFile, "utf-8"));
  let totalExtraidas = 0, totalInseridas = 0;
  for (const s of final.processados) {
    totalExtraidas += s.extraidas;
    totalInseridas += s.inseridas;
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 RELATÓRIO FINAL`);
  console.log(`${"=".repeat(50)}`);
  console.log(`Políticos processados: ${final.processados.length}`);
  console.log(`Promessas extraídas:   ${totalExtraidas}`);
  console.log(`Promessas inseridas:   ${totalInseridas}`);
  console.log(`Checkpoint salvo em:   processamento_status.json`);
}

main().catch(e => console.error("FATAL:", e));
