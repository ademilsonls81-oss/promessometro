import { supabase } from "../lib/supabase.js";
import { checkAndSanitizeResult } from "./contentGuardService.js";
import { logSystemError } from "../middleware/auditLog.js";
import { logAuditAction } from "../middleware/auditLog.js";

export interface PromiseData {
  id: string;
  promise_title: string;
  promise_description: string | null;
  politician_name: string;
  category: string | null;
  status: string;
  fulfillment_score: number | null;
}

export interface Evidence {
  id: string;
  evidence_description: string;
  evidence_link: string | null;
  source_name: string;
  validation_status: string;
  created_at: string;
  published_date: string | null;
}

export interface EvidenceUsed {
  descricao: string;
  fonte: string;
  url: string | null;
  data: string | null;
}

export interface AIResult {
  status: string;
  fulfillment_score: number;
  criterio_aplicado: string;
  justificativa: string;
  evidencias_usadas: EvidenceUsed[];
  o_que_falta: string;
  o_que_foi_feito: string;
  confianca: number;
  motivo_confianca: string;
}

export interface TrustedSource {
  id: string;
  name: string;
  url: string;
  type: string;
}

const AI_MODEL = "llama-3.3-70b-versatile";
const INCONSISTENCY_THRESHOLD = 30;

function getAIClient() {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY not configured");
  return apiKey;
}

export async function getTrustedSources(): Promise<TrustedSource[]> {
  try {
    const { data } = await supabase
      .from("trusted_sources")
      .select("*")
      .eq("is_active", true);
    return data || [];
  } catch {
    return [];
  }
}

export async function validateUrls(urls: string[]): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  for (const url of urls) {
    if (!url) {
      results.set(url, false);
      continue;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow"
      });
      clearTimeout(timeout);
      results.set(url, response.ok);
    } catch {
      results.set(url, false);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return results;
}

export function calculateConfidence(
  evidenceCount: number,
  trustedSourceCount: number,
  conflictingSources: boolean
): { confianca: number; motivo_confianca: string } {
  let confianca: number;
  let motivo_confianca: string;

  if (conflictingSources) {
    confianca = Math.max(0.15, 0.45 - (trustedSourceCount === 0 ? 0.3 : 0));
    motivo_confianca = `Fontes conflitantes detectadas — confiança reduzida automaticamente para ${(confianca * 100).toFixed(0)}%. Revisão humana recomendada.`;
  } else if (trustedSourceCount >= 2 && evidenceCount >= 2) {
    confianca = Math.min(0.95, 0.7 + (trustedSourceCount * 0.1));
    motivo_confianca = `Alta — ${trustedSourceCount} fontes confiáveis confirmam com ${evidenceCount} evidências verificadas.`;
  } else if (trustedSourceCount >= 1 && evidenceCount >= 1) {
    confianca = 0.55 + (trustedSourceCount * 0.1);
    motivo_confianca = `Média — ${trustedSourceCount} fonte confiável e ${evidenceCount} evidência(s) encontrada(s).`;
  } else if (evidenceCount > 0) {
    confianca = Math.min(0.45, 0.3 + (evidenceCount * 0.05));
    motivo_confianca = `Baixa — ${evidenceCount} evidência(s) disponível(is), mas sem fontes confiáveis verificadas. Máximo 45%.`;
  } else {
    confianca = 0.15;
    motivo_confianca = "Sem evidências disponíveis — classificação não confiável.";
  }

  return { confianca: Math.min(1, Math.max(0, confianca)), motivo_confianca };
}

export async function detectInconsistency(
  promiseId: string,
  newResult: AIResult
): Promise<{ hasInconsistency: boolean; severity: string; reason: string }> {
  try {
    const { data: explanations } = await supabase
      .from("promise_explanations")
      .select("status, fulfillment_score, evidencias_usadas, is_latest")
      .eq("promise_id", promiseId)
      .eq("is_latest", true)
      .single();

    if (!explanations) {
      return { hasInconsistency: false, severity: "none", reason: "" };
    }

    const scoreDiff = Math.abs((explanations.fulfillment_score || 0) - newResult.fulfillment_score);
    const statusRegression = isRegression(explanations.status, newResult.status);
    const hasNewEvidence = checkNewEvidence(newResult.evidencias_usadas, explanations.evidencias_usadas);

    if (statusRegression && !hasNewEvidence) {
      return {
        hasInconsistency: true,
        severity: "critical",
        reason: `Regressão de status (${explanations.status} → ${newResult.status}) sem nova evidência`
      };
    }

    if (scoreDiff > INCONSISTENCY_THRESHOLD && !hasNewEvidence) {
      return {
        hasInconsistency: true,
        severity: "high",
        reason: `Mudança de score >${INCONSISTENCY_THRESHOLD} pontos sem nova evidência`
      };
    }

    if (statusRegression) {
      return {
        hasInconsistency: true,
        severity: "high",
        reason: `Regressão de status detectada — revisão humana obrigatória`
      };
    }

    return { hasInconsistency: false, severity: "none", reason: "" };
  } catch {
    return { hasInconsistency: false, severity: "none", reason: "" };
  }
}

function isRegression(oldStatus: string, newStatus: string): boolean {
  const order = ["cumprida", "parcialmente_cumprida", "em_andamento", "nao_iniciada", "descumprida", "nao_classificada"];
  const oldIdx = order.indexOf(oldStatus);
  const newIdx = order.indexOf(newStatus);
  return newIdx > oldIdx && oldIdx >= 0 && newIdx >= 0;
}

function checkNewEvidence(newEv: EvidenceUsed[], oldEv: EvidenceUsed[]): boolean {
  const oldUrls = new Set((oldEv || []).map(e => e.url).filter(Boolean));
  return (newEv || []).some(e => e.url && !oldUrls.has(e.url));
}

function buildAntiHallucinationPrompt(promise: PromiseData, evidences: Evidence[], trustedSources: TrustedSource[]): string {
  const evidenceText = evidences.length > 0
    ? evidences.map(e => `  - [${e.source_name}]: ${e.evidence_description} (url: ${e.evidence_link || "N/A"}, data: ${e.published_date || "N/A"})`).join("\n")
    : "  Nenhuma evidência encontrada.";

  const trustedNames = trustedSources.map(s => s.name).join(", ") || "Nenhuma fonte confiável registrada";

  return `Você é um avaliador independente de promessas políticas brasileiras. Seu papel éclassificar objetivamente o status de cumprimento de cada promessa.

⚠️ REGRAS INVIOLÁVEIS — SE VIOLADAS, SUA RESPOSTA SERÁ DESCARTADA:

1. NUNCA invente URLs, nomes de fontes ou datas. Se não tiver o dado, use null.
2. NUNCA afirme que alguém cometeu crime, foi condenado ou corrupto sem decisão judicial transitada em julgado.
3. NUNCA use ironia, sarcasmo ou linguagem carregada ideologicamente.
4. NUNCA afirme fatos que não possam ser verificados nas fontes fornecidas.
5. Se as fontes contradizem sua conclusão, ajuste sua avaliação — você deve seguir as fontes, não o contrário.
6. Se não houver evidência verificável, classifique como "nao_classificada".

PROMESSA:
- Político: ${promise.politician_name}
- Promessa: ${promise.promise_title}
- Descrição: ${promise.promise_description || "não informado"}
- Categoria: ${promise.category || "não informado"}

EVIDÊNCIAS:
${evidenceText}

FONTES CONFIÁVEIS REGISTRADAS: ${trustedNames}
(Cross-validation: se houver 2+ fontes confiáveis com informação concordante, aumento confiança. Se conflitarem, reduza confiança.)

CRITÉRIOS:
| Status | Score | Quando usar |
|--------|-------|-------------|
| cumprida | 80-100 | Ação concluída com prova verificável |
| parcialmente_cumprida | 40-79 | Progresso parcial demonstrado |
| em_andamento | 20-39 | Processo iniciado sem entrega |
| nao_iniciada | 0-19 | Nenhuma ação verificável |
| descumprida | 0 | Ação contrária OU prazo expirou com declaração do político contra |
| nao_classificada | null | Promessa vaga demais (ex: "vou melhorar X") |

RESPONDA SOMENTE COM JSON válido (sem markdown, sem texto extra):
{
  "status": "cumprida|parcialmente_cumprida|em_andamento|nao_iniciada|descumprida|nao_classificada",
  "fulfillment_score": 0-100,
  "criterio_aplicado": "Nome do critério usado",
  "justificativa": "Explicação clara em linguagem cidadã",
  "evidencias_usadas": [
    {"descricao": "O que a evidência prova", "fonte": "Nome da fonte", "url": "url real ou null", "data": "YYYY-MM-DD ou null"}
  ],
  "o_que_falta": "O que ainda precisa acontecer",
  "o_que_foi_feito": "O que já foi concluído",
  "confianca": 0.0-1.0,
  "motivo_confianca": "Motivo do nível de confiança"
}`;
}

export async function evaluatePromise(
  promise: PromiseData,
  forceEvaluation: boolean = false
): Promise<AIResult & { needsHumanReview: boolean; inconsistency: string; reviewed_by?: string }> {
  const evidenceController = new AbortController();
  const timeout = setTimeout(() => evidenceController.abort(), 15000);

  let evidences: Evidence[] = [];
  try {
    const { data } = await supabase
      .from("promise_evidences")
      .select("*")
      .eq("promise_id", promise.id)
      .in("validation_status", ["approved", "pendente"])
      .order("created_at", { ascending: false })
      .limit(10);
    evidences = data || [];
  } finally {
    clearTimeout(timeout);
  }

  let result: AIResult;
  let rawContent: string = "";
  let modelUsed: string = AI_MODEL;

  const trustedSources = await getTrustedSources();
  const trustedSourceNames = trustedSources.map(s => s.name.toLowerCase());

  if (evidences.length === 0) {
    result = createEmptyResult();
  } else {
    const urlValidation = await validateUrls(evidences.map(e => e.evidence_link).filter(Boolean) as string[]);
    const validEvidences = evidences.filter(e => !e.evidence_link || urlValidation.get(e.evidence_link) !== false);

    let trustedCount = 0;
    let conflictingSources = false;

    for (const ev of validEvidences) {
      const srcName = (ev.source_name || "").toLowerCase();
      if (trustedSourceNames.some(tn => srcName.includes(tn))) {
        trustedCount++;
      }
    }

    const evidenceText = validEvidences
      .map(e => `- [${e.source_name}]: ${e.evidence_description} (url: ${e.evidence_link || "N/A"})`)
      .join("\n");

    const prompt = buildAntiHallucinationPrompt(promise, validEvidences, trustedSources);

    try {
      const apiKey = getAIClient();
      const baseUrl = process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1";

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.15,
          max_tokens: 1200,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      rawContent = data.choices?.[0]?.message?.content || "";

      if (!rawContent) {
        throw new Error("Empty AI response");
      }

      let parsed: Partial<AIResult> = {};
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        const match = rawContent.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Failed to parse AI response");
      }

      if (trustedCount >= 2) {
        const hasConflict = detectConflict(validEvidences, parsed);
        if (hasConflict) conflictingSources = true;
      }

      const confData = calculateConfidence(validEvidences.length, trustedCount, conflictingSources);
      const finalConfianca = parsed.confianca !== undefined
        ? Math.min(parsed.confianca, confData.confianca)
        : confData.confianca;

      const validatedEvidencias = await validateAndFilterEvidence(parsed.evidencias_usadas || []);
      if (validatedEvidencias.reduced) {
        result = {
          ...parsed,
          confianca: Math.max(0.3, finalConfianca - 0.15),
          motivo_confianca: parsed.motivo_confianca || `${confData.motivo_confianca} — URLs inválidas removidas.`,
          evidencias_usadas: validatedEvidencias.evidences
        } as AIResult;
      } else {
        result = {
          ...parsed,
          confianca: finalConfianca,
          motivo_confianca: parsed.motivo_confianca || confData.motivo_confianca,
          evidencias_usadas: parsed.evidencias_usadas || mapEvidences(validEvidences)
        } as AIResult;
      }
    } catch (err: any) {
      console.error(`[AI-Evaluator] AI call failed: ${err.message}`);
      result = createFallbackResult(validEvidences, trustedCount);
    }
  }

  const needsHumanReview = result.confianca < 0.4 || evidences.length === 0;
  const inconsistency = "";

  return {
    ...result,
    needsHumanReview,
    inconsistency,
    reviewed_by: undefined
  };
}

function detectConflict(evidences: Evidence[], parsed: Partial<AIResult>): boolean {
  if (!parsed.evidencias_usadas?.length) return false;
  const usedUrls = new Set(parsed.evidencias_usadas.map(e => e.url).filter(Boolean));
  const evidenceUrls = new Set(evidences.map(e => e.evidence_link).filter(Boolean));
  let matchCount = 0;
  for (const url of usedUrls) {
    if (evidenceUrls.has(url)) matchCount++;
  }
  return usedUrls.size > 0 && matchCount < usedUrls.size * 0.5;
}

async function validateAndFilterEvidence(evidencias: EvidenceUsed[]): Promise<{ evidences: EvidenceUsed[]; reduced: boolean }> {
  const urls = evidencias.map(e => e.url).filter(Boolean) as string[];
  if (urls.length === 0) return { evidences: evidencias, reduced: false };

  const validation = await validateUrls(urls);
  let reduced = false;
  const filtered = evidencias.map(e => {
    if (e.url && validation.get(e.url) === false) {
      reduced = true;
      return { ...e, url: null };
    }
    return e;
  });

  return { evidences: filtered, reduced };
}

function createEmptyResult(): AIResult {
  return {
    status: "nao_classificada",
    fulfillment_score: 0,
    criterio_aplicado: "sem_evidencia",
    justificativa: "Sem evidência verificável para classificar esta promessa.",
    evidencias_usadas: [],
    o_que_falta: "É necessário encontrar notícias ou documentos que comprovem ações relacionadas a esta promessa.",
    o_que_foi_feito: "Nenhuma evidência encontrada até o momento.",
    confianca: 0.1,
    motivo_confianca: "Sem evidências disponíveis — revisão humana obrigatória."
  };
}

function createFallbackResult(evidences: Evidence[], trustedCount: number): AIResult {
  const confData = calculateConfidence(evidences.length, trustedCount, false);
  const statusConfig: Record<string, { status: string; score: number; criterio: string }> = {
    "entregue": { status: "cumprida", score: 85, criterio: "cumprida" },
    "inaugurad": { status: "cumprida", score: 85, criterio: "cumprida" },
    "aprovad": { status: "cumprida", score: 80, criterio: "cumprida" },
    "sancionad": { status: "cumprida", score: 90, criterio: "cumprida" },
    "cancel": { status: "descumprida", score: 0, criterio: "descumprida" },
    "suspend": { status: "descumprida", score: 0, criterio: "descumprida" },
    "recus": { status: "descumprida", score: 0, criterio: "descumprida" },
  };

  const text = (evidences.map(e => e.evidence_description || "").join(" ")).toLowerCase();
  let matched = statusConfig.nao_classificada || { status: "em_andamento", score: 30, criterio: "em_andamento" };

  for (const [key, cfg] of Object.entries(statusConfig)) {
    if (text.includes(key)) { matched = cfg; break; }
  }

  return {
    status: matched.status,
    fulfillment_score: matched.score,
    criterio_aplicado: matched.criterio,
    justificativa: `Classificação via análise factual das evidências (fallback).`,
    evidencias_usadas: mapEvidences(evidences),
    o_que_falta: matched.status !== "cumprida" ? "Mais dados necessários para conclusão." : "Promessa cumprida.",
    o_que_foi_feito: matched.status === "cumprida" ? "Ação concluída conforme evidências." : "Ações em progresso.",
    confianca: Math.min(confData.confianca, 0.65),
    motivo_confianca: `${confData.motivo_confianca} (classificação via fallback)`
  };
}

function mapEvidences(evidences: Evidence[]): EvidenceUsed[] {
  return evidences.slice(0, 5).map(e => ({
    descricao: e.evidence_description || "Evidência",
    fonte: e.source_name || "Unknown",
    url: e.evidence_link || null,
    data: e.published_date || e.created_at?.split("T")[0] || null
  }));
}

export async function saveEvaluation(
  promiseId: string,
  result: AIResult,
  humanReview: boolean,
  reviewedBy?: string
): Promise<{ success: boolean; explanationId?: string; requiresHumanReview: boolean }> {
  try {
    await supabase
      .from("promise_explanations")
      .update({ is_latest: false })
      .eq("promise_id", promiseId)
      .eq("is_latest", true);

    const { data: explanation, error: expError } = await supabase
      .from("promise_explanations")
      .insert({
        promise_id: promiseId,
        status: result.status,
        fulfillment_score: result.fulfillment_score,
        criterio_aplicado: result.criterio_aplicado,
        justificativa: result.justificativa,
        evidencias_usadas: result.evidencias_usadas,
        o_que_falta: result.o_que_falta,
        o_que_foi_feito: result.o_que_foi_feito,
        confianca: result.confianca,
        motivo_confianca: result.motivo_confianca,
        modelo_ia: AI_MODEL,
        is_latest: true,
        gerado_em: new Date().toISOString(),
        revisado_em: humanReview ? new Date().toISOString() : null,
        revisado_por: reviewedBy || null
      })
      .select("id")
      .single();

    if (expError) throw expError;

    if (!humanReview) {
      await supabase
        .from("promises")
        .update({
          status: result.status,
          fulfillment_score: result.fulfillment_score,
          classificacao_ia: {
            justificativa: result.justificativa,
            criterio: result.criterio_aplicado,
            confianca: result.confianca,
            classified_at: new Date().toISOString()
          }
        })
        .eq("id", promiseId);
    }

    return {
      success: true,
      explanationId: explanation.id,
      requiresHumanReview: humanReview
    };
  } catch (err: any) {
    console.error("[AI-Evaluator] Save failed:", err.message);
    await logSystemError("ai_evaluation_save", "ai_evaluator", err.message, err.stack, "high");
    return { success: false, requiresHumanReview: humanReview };
  }
}

export async function getPendingReviews(limit: number = 50): Promise<any[]> {
  try {
    const { data } = await supabase
      .from("promise_explanations")
      .select(`
        id,
        promise_id,
        status,
        fulfillment_score,
        confianca,
        justificativa,
        created_at,
        promises:promises(promise_title, politician_name, category)
      `)
      .eq("is_latest", true)
      .not("revisado_por", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    return data || [];
  } catch (err) {
    return [];
  }
}

export async function approveEvaluation(explanationId: string, reviewerId: string, notes?: string): Promise<boolean> {
  try {
    const { data: explanation } = await supabase
      .from("promise_explanations")
      .select("promise_id")
      .eq("id", explanationId)
      .single();

    if (!explanation) return false;

    await supabase
      .from("promise_explanations")
      .update({ revisado_em: new Date().toISOString(), revisado_por: reviewerId })
      .eq("id", explanationId);

    return true;
  } catch {
    return false;
  }
}

export default {
  evaluatePromise,
  saveEvaluation,
  getPendingReviews,
  approveEvaluation,
  validateUrls,
  calculateConfidence,
  detectInconsistency,
  getTrustedSources
};