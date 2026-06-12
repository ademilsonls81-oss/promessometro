import dotenv from "dotenv";
dotenv.config({ path: ".env.vercel" });
dotenv.config({ path: ".env.backup" });
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const DELAY_AFTER_BATCH_MS = 60000;
const MAX_TOTAL = 2000;
const DDG_URL = "https://html.duckduckgo.com/html/";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";
const BATCH = 5;

const db = createClient(
  process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let totalCalls = 0;

function nivel(url) {
  if (!url) return 5;
  const u = url.toLowerCase();
  if (u.includes("dou.gov") || u.includes("diariooficial") || u.includes("tse.jus") ||
    u.includes("tce.") || u.includes("tcu") || u.includes("planalto") || u.includes("senado") ||
    u.includes("camara") || u.includes("decreto") || u.includes("portaria") || u.includes("leis"))
    return 1;
  if (u.includes("ibge") || u.includes("ipea") || u.includes("gov.br") || u.includes("dados.gov") ||
    u.includes("transparencia") || u.includes("seade"))
    return 2;
  if (u.includes("g1.globo") || u.includes("folha") || u.includes("estadao") || u.includes("uol") ||
    u.includes("oglobo") || u.includes("cnn") || u.includes("bbc") || u.includes("poder360") ||
    u.includes("metropoles") || u.includes("r7") || u.includes("ebc") || u.includes("agenciabrasil"))
    return 3;
  if (u.includes("youtube") || u.includes("instagram") || u.includes("twitter") || u.includes("x.com"))
    return 4;
  return 5;
}

async function searchDDG(query) {
  try {
    const params = new URLSearchParams({ q: query.substring(0, 200) });
    const r = await axios.post(DDG_URL, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
      timeout: 12000
    });
    const out = [];
    const re = /<a rel="nofollow" class="result__a" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(r.data)) !== null) {
      const url = m[1], title = m[2].replace(/<[^>]+>/g,"").trim();
      if (title && url && !url.includes("duckduckgo")) out.push({ title, url, nivel: nivel(url) });
    }
    return out.slice(0, 8);
  } catch {
    return [];
  }
}

async function callGroq(prompt, tent = 0) {
  try {
    const start = Date.now();
    const r = await axios.post(GROQ_URL, {
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1000
    }, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      timeout: 40000
    });
    totalCalls++;
    const ms = Date.now() - start;
    const raw = r.data.choices?.[0]?.message?.content?.trim();
    const tokens = r.data.usage?.total_tokens || "?";
    console.log(`  [Groq #${totalCalls}] ${ms}ms | ${tokens}tokens`);
    if (raw) console.log(`  Resposta (${raw.length}chars): ${raw.substring(0, 300)}`);
    return raw;
  } catch (e) {
    if (e.response?.status === 429 && tent < 5) {
      console.log(`  ⏳ 429 (tentativa ${tent+1}/5) — esperando 180s`);
      await new Promise(r => setTimeout(r, 180000));
      return callGroq(prompt, tent + 1);
    }
    console.error(`  💥 Erro ${e.response?.status}: ${(e.response?.data?.error?.message||e.message).substring(0,120)}`);
    return null;
  }
}

function makePrompt(items) {
  const politico = items[0].politico;
  let s = `Avalie estas ${items.length} promessas de:\n${politico?.name||"?"} (${politico?.role||"?"} - ${politico?.state||"?"})\n\n`;
  for (let i = 0; i < items.length; i++) {
    s += `--- PROMESSA ${i+1} ---\nTítulo: ${items[i].titulo}\nCategoria: ${items[i].categoria||"Outros"}\n`;
    if (items[i].evidencias.length > 0) {
      s += `Evidências:\n${items[i].evidencias.map(e => `[N${e.nivel}] ${e.title}`).join("\n")}\n`;
    } else {
      s += "Evidências: nenhuma\n";
    }
    s += "\n";
  }
  s += `REGRAS:
- cumprida(80-100): concluída, exige fonte N1-2
- parcial(40-79): em andamento, exige fonte N1-3
- pendente(0-39): sem ação, sem fonte N1-3
- quebrada(0): ação contrária, exige fonte N1-2

Responda JSON array (sem markdown):
[{"indice":1,"score":0,"status":"","motivo":"","confianca":0}, ...]`;
  return s;
}

function parseArray(text) {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function main() {
  console.log(`=== GROQ + DDG (batch ${BATCH}) ===\n`);
  let total = 0;

  while (total < MAX_TOTAL) {
    const { data: pendentes } = await db.from("promises")
      .select("id,promise_title,category,politician_id,politician_name")
      .eq("status","pendente")
      .or("classificacao_ia.is.null,classificacao_ia->>modelo.not.ilike.%groq%")
      .limit(BATCH);

    if (!pendentes?.length) { console.log("\n✅ FIM!"); break; }

    // Busca dados de cada político + DDG
    console.log(`\n📦 ${pendentes.length} promessas`);
    const items = [];
    for (const p of pendentes) {
      let politico = null;
      if (p.politician_id) {
        const { data: pp } = await db.from("politicians").select("name,role,state").eq("id",p.politician_id).maybeSingle();
        politico = pp;
      }
      console.log(`  ${(p.promise_title||"").substring(0,60)}`);
      const q = `${politico?.name||p.politician_name} ${p.promise_title}`.substring(0,150);
      const ev = await searchDDG(q);
      items.push({ id: p.id, titulo: p.promise_title, categoria: p.category, politico, evidencias: ev });
    }

    const prompt = makePrompt(items);
    console.log("  Prompt (~"+Math.round(prompt.length/4)+" tokens):");
    for (const item of items) {
      const val = item.evidencias.filter(e=>e.nivel<=3).length;
      const tot = item.evidencias.length;
      console.log(`    ${(item.titulo||"").substring(0,50)} → ${val}/${tot} fontes confiáveis`);
    }
    const raw = await callGroq(prompt);
    if (!raw) { console.log("  ❌ Falha"); await new Promise(r=>setTimeout(r,DELAY_AFTER_BATCH_MS)); continue; }

    const res = parseArray(raw);
    if (!res) { console.log("  ⚠️ Parse falhou"); await new Promise(r=>setTimeout(r,DELAY_AFTER_BATCH_MS)); continue; }

    console.log(`  ✅ ${res.length} respostas`);
    const summary = { cumprida:0, parcial:0, pendente:0, quebrada:0 };
    for (const r of res) {
      summary[r.status||"pendente"] = (summary[r.status||"pendente"]||0) + 1;
      const idx = (r.indice||1)-1;
      if (idx < 0 || idx >= items.length) continue;
      const item = items[idx];
      const score = r.score??0; const status = r.status||"pendente";
      console.log(`  [${idx+1}] ${status}(${score}) ${(r.motivo||"").substring(0,80)}`);
      await db.from("promise_explanations").update({is_latest:false}).eq("promise_id",item.id).eq("is_latest",true);
      await db.from("promise_explanations").insert({
        promise_id: item.id, status, fulfillment_score: score,
        criterio_aplicado: "avaliacao_groq_ddg",
        justificativa: r.motivo||"",
        evidencias_usadas: item.evidencias.slice(0,8).map(e=>({titulo:e.title,url:e.url,resumo:""})),
        confianca: r.confianca??0,
        modelo_ia: `groq-${MODEL}`, is_latest: true,
        gerado_em: new Date().toISOString()
      });
      await db.from("promises").update({
        status, fulfillment_score: score,
        classificacao_ia: {score,status,modelo:`groq-${MODEL}`,classified_at:new Date().toISOString()},
        updated_at: new Date().toISOString()
      }).eq("id",item.id);
    }
    console.log(`  => ${Object.entries(summary).filter(([k,v])=>v>0).map(([k,v])=>k+":"+v).join(", ")}`);

    total += items.length;
    console.log(`   📊 ${total}/${MAX_TOTAL} Groq:${totalCalls}`);
    await new Promise(r=>setTimeout(r,DELAY_AFTER_BATCH_MS));
  }
  console.log(`\n🏁 ${total} processadas | ${totalCalls} chamadas`);
}
main().catch(e=>{console.error("FATAL:",e);process.exit(1);});
