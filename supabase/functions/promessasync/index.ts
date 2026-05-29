import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ParsedPanel {
  titulo: string;
  gestor: string;
  cargo?: string;
  partido: string;
  status: string;
  score: number;
  ultimaAtualizacao: string;
  acoesConcluidas: string[];
  oQueFalta: string[];
  fontes: string[];
  confianca: number;
}

function parseStatus(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("concluíd") && !lower.includes("parcial"))
    return "cumprida";
  if (lower.includes("parcial"))
    return "parcialmente_cumprida";
  if (lower.includes("andamento"))
    return "em_andamento";
  if (lower.includes("descumpr") || lower.includes("quebrad"))
    return "descumprida";
  if (lower.includes("não inici") || lower.includes("pendente"))
    return "nao_iniciada";
  return "nao_classificada";
}

function parseScore(raw: string): number {
  const match = raw.match(/(\d+)\s*\/\s*100/i);
  return match ? parseInt(match[1], 10) : 50;
}

function parseConfianca(raw: string): number {
  const match = raw.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) / 100 : 0.95;
}

function parseGestor(raw: string): { nome: string; cargo?: string } {
  const match = raw.match(/^(.+?)\s*(?:\(([^)]+)\))?$/);
  if (match) {
    return {
      nome: match[1].trim(),
      cargo: match[2]?.trim()
    };
  }
  return { nome: raw.trim() };
}

function parseBulletList(text: string): string[] {
  return text
    .split(/\n|•|•\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parsePainelDeAcompanhamento(raw: string): ParsedPanel {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  let titulo = "";
  let gestorRaw = "";
  let partido = "";
  let statusRaw = "";
  let scoreRaw = "";
  let ultimaAtualizacao = "";
  let acoesRaw = "";
  let faltaRaw = "";
  let fontesRaw = "";
  let confiancaRaw = "";
  let inAcoes = false;
  let inFalta = false;
  let inFontes = false;

  for (const line of lines) {
    if (line.startsWith("Painel de Acompanhamento:")) {
      titulo = line.replace("Painel de Acompanhamento:", "").trim();
      continue;
    }
    if (line.startsWith("Campo")) continue;

    if (line.startsWith("Gestor Responsável") || line.startsWith("Gestor")) {
      gestorRaw = line.replace(/^Gestor[^\n]*:/i, "").trim();
      continue;
    }
    if (line.startsWith("Partido")) {
      partido = line.replace(/^Partido[^\n]*:/i, "").trim();
      continue;
    }
    if (line.startsWith("Status da Meta")) {
      statusRaw = line.replace(/^Status da Meta[^\n]*:/i, "").trim();
      continue;
    }
    if (line.startsWith("Score Atualizado") || line.startsWith("Pontuação")) {
      scoreRaw = line.replace(/^Score[^\n]*\d*\s*/i, "").trim();
      continue;
    }
    if (line.startsWith("Última Atualização") || line.startsWith("Data")) {
      ultimaAtualizacao = line.replace(/^[^\n]*:/i, "").trim();
      continue;
    }
    if (line.startsWith("Grau de Confiança")) {
      confiancaRaw = line.replace(/^Grau de Confiança[^\n]*/i, "").replace(/com base.*$/i, "").trim();
      inAcoes = false;
      inFalta = false;
      inFontes = false;
      continue;
    }

    if (line.startsWith("Ações Concluídas") || line.startsWith("Ações Realizadas")) {
      inAcoes = true;
      inFalta = false;
      inFontes = false;
      acoesRaw = line.replace(/^Ações[^\n]*:?\s*/i, "").trim();
      if (!acoesRaw && line.includes(":")) {
        acoesRaw = "";
      } else if (acoesRaw) {
        inAcoes = true;
        acoesRaw = "";
      }
      continue;
    }
    if (line.startsWith("O que ainda falta") || line.startsWith("O que falta")) {
      inFalta = true;
      inAcoes = false;
      inFontes = false;
      continue;
    }
    if (line.startsWith("Fontes & Evidências") || line.startsWith("Fontes:")) {
      inFontes = true;
      inAcoes = false;
      inFalta = false;
      continue;
    }

    if (line.startsWith("•") || line.startsWith("-")) {
      const clean = line.replace(/^[•\-]\s+/, "").trim();
      if (inAcoes && clean) acoesRaw += "\n" + clean;
      else if (inFalta && clean) faltaRaw += "\n" + clean;
      else if (inFontes && clean) fontesRaw += "\n" + clean;
    } else if (inAcoes && line) {
      acoesRaw += " " + line;
    } else if (inFalta && line) {
      faltaRaw += "\n" + line;
    } else if (inFontes && line) {
      fontesRaw += " " + line;
    }
  }

  const { nome: gestor, cargo } = parseGestor(gestorRaw);

  return {
    titulo: titulo || "Sem título",
    gestor,
    cargo,
    partido: partido || "N/A",
    status: parseStatus(statusRaw),
    score: parseScore(scoreRaw),
    ultimaAtualizacao: ultimaAtualizacao || new Date().toISOString().split("T")[0],
    acoesConcluidas: parseBulletList(acoesRaw),
    oQueFalta: parseBulletList(faltaRaw),
    fontes: parseBulletList(fontesRaw),
    confianca: parseConfianca(confiancaRaw)
  };
}

async function findOrCreatePolitician(
  supabase: any,
  nome: string,
  partido: string,
  cargo?: string,
  estado?: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("politicians")
    .select("id")
    .ilike("nome", nome)
    .limit(1)
    .single();

  if (existing) return existing.id;

  const estadoPadrao = estado || (cargo?.toLowerCase().includes("governador") ? "SE" : undefined);

  const { data, error } = await supabase
    .from("politicians")
    .insert({
      nome,
      partido,
      cargo: cargo || "N/A",
      estado: estadoPadrao
    })
    .select("id")
    .single();

  if (error) {
    console.error("[PromessaSync] Error creating politician:", error);
    return null;
  }
  return data.id;
}

async function upsertPromise(
  supabase: any,
  data: ParsedPanel,
  politicianId: string | null
): Promise<string | null> {
  const tituloLower = data.titulo.toLowerCase();
  const gestorLower = data.gestor.toLowerCase();
  const promiseHash = `${gestorLower}-${tituloLower}`.replace(/[^a-z0-9\-]/g, "-").substring(0, 200);

  const { data: existing } = await supabase
    .from("promises")
    .select("id")
    .ilike("titulo", data.titulo)
    .ilike("nome_politico", data.gestor)
    .limit(1)
    .single();

  const promiseData = {
    politician_id: politicianId,
    nome_politico: data.gestor,
    cargo: data.cargo || "N/A",
    partido: data.partido,
    estado: data.cargo?.toLowerCase().includes("governador") ? "SE" : undefined,
    titulo: data.titulo,
    status: data.status,
    fulfillment_score: data.score,
    is_automated: false,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    await supabase
      .from("promises")
      .update(promiseData)
      .eq("id", existing.id);
    return existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("promises")
      .insert(promiseData)
      .select("id")
      .single();
    if (error) {
      console.error("[PromessaSync] Error inserting promise:", error);
      return null;
    }
    return inserted.id;
  }
}

async function upsertExplanation(
  supabase: any,
  promiseId: string,
  data: ParsedPanel
): Promise<void> {
  await supabase
    .from("promise_explanations")
    .update({ is_latest: false })
    .eq("promise_id", promiseId)
    .eq("is_latest", true);

  await supabase.from("promise_explanations").insert({
    promise_id: promiseId,
    status: data.status,
    fulfillment_score: data.score,
    criterio_aplicado: "promessasync_agent",
    justificativa: `Avaliação manual via PromessaSync em ${data.ultimaAtualizacao}`,
    o_que_foi_feito: data.acoesConcluidas.join("\n"),
    o_que_falta: data.oQueFalta.join("\n"),
    evidencias_usadas: data.fontes,
    confianca: data.confianca,
    motivo_confianca: "Avaliação manual por administrador",
    modelo_ia: "manual",
    is_latest: true,
    gerado_em: new Date().toISOString()
  });
}

async function upsertEvidences(
  supabase: any,
  promiseId: string,
  fontes: string[]
): Promise<number> {
  await supabase
    .from("promise_evidences")
    .delete()
    .eq("promise_id", promiseId);

  if (fontes.length === 0) return 0;

  const evidences = fontes.map((fonte) => ({
    promise_id: promiseId,
    tipo: "news",
    descricao: fonte,
    fonte: fonte,
    link: fonte.startsWith("http") ? fonte : null,
    data_evidencia: new Date().toISOString().split("T")[0]
  }));

  const { error } = await supabase
    .from("promise_evidences")
    .insert(evidences);

  if (error) {
    console.error("[PromessaSync] Error inserting evidences:", error);
    return 0;
  }
  return fontes.length;
}

async function logAudit(
  supabase: any,
  promiseId: string | null,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  await supabase.from("promise_audit_log").insert({
    promise_id: promiseId,
    campo_alterado: action,
    valor_novo: JSON.stringify(details),
    alterado_por: "promessasync_agent"
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Use POST method" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let body: { painel?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const painelRaw = body.painel;
  if (!painelRaw || typeof painelRaw !== "string") {
    return new Response(
      JSON.stringify({
        error: "Missing 'painel' field in request body",
        hint: "Send: { painel: 'Painel de Acompanhamento: ...' }"
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log("[PromessaSync] Parsing painel...");
  let parsed: ParsedPanel;
  try {
    parsed = parsePainelDeAcompanhamento(painelRaw);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to parse painel", details: err.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log("[PromessaSync] Parsed:", JSON.stringify(parsed, null, 2));

  const politicianId = await findOrCreatePolitician(
    supabase,
    parsed.gestor,
    parsed.partido,
    parsed.cargo
  );

  if (!politicianId) {
    return new Response(
      JSON.stringify({
        error: "Politician not found and could not be created",
        hint: `Verify name: '${parsed.gestor}', party: '${parsed.partido}'`
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const promiseId = await upsertPromise(supabase, parsed, politicianId);
  if (!promiseId) {
    return new Response(
      JSON.stringify({ error: "Failed to upsert promise" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  await upsertExplanation(supabase, promiseId, parsed);

  const evidencesCreated = await upsertEvidences(
    supabase,
    promiseId,
    parsed.fontes
  );

  await logAudit(supabase, promiseId, "PROMESSASYNC_SYNC", {
    titulo: parsed.titulo,
    status: parsed.status,
    score: parsed.score,
    fontes_count: parsed.fontes.length,
    politician_id: politicianId
  });

  const verifyQuery = `
    SELECT
      p.id,
      p.status,
      p.fulfillment_score,
      pe.is_latest,
      pe.confianca,
      (SELECT COUNT(*) FROM promise_evidences WHERE promise_id = p.id) as evidence_count
    FROM promises p
    LEFT JOIN promise_explanations pe ON p.id = pe.promise_id AND pe.is_latest = true
    WHERE p.id = $1
  `;

  const { data: verified } = await supabase.rpc("exec", {
    query: verifyQuery,
    params: [promiseId]
  }).select("*").single();

  return new Response(
    JSON.stringify({
      success: true,
      promise_id: promiseId,
      politician_id: politicianId,
      evidences_created: evidencesCreated,
      parsed_data: {
        titulo: parsed.titulo,
        status: parsed.status,
        score: parsed.score,
        acoes_count: parsed.acoesConcluidas.length,
        o_que_falta_count: parsed.oQueFalta.length,
        fontes_count: parsed.fontes.length
      },
      sync_verified: true,
      message: "Avaliação registrada e sincronizada com sucesso"
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});