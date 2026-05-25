import { supabase } from "../lib/supabase.js";
import { checkAndSanitizeResult } from "./contentGuardService.js";
import { prioritizeSources } from "../lib/sourceLevel.js";

const CRITERIA = {
  cumprida: {
    status: "cumprida",
    minScore: 80,
    maxScore: 100,
    description: "Ação concluída com evidência verificável (lei sancionada, obra entregue, decreto publicado)",
  },
  parcialmente_cumprida: {
    status: "parcialmente_cumprida",
    minScore: 40,
    maxScore: 79,
    description: "Ação iniciada e com progresso comprovado, mas incompleta ou com escopo reduzido",
  },
  em_andamento: {
    status: "em_andamento",
    minScore: 20,
    maxScore: 39,
    description: "Ação iniciada formalmente (licitação aberta, projeto de lei em tramitação, contrato assinado) sem entrega ainda",
  },
  nao_iniciada: {
    status: "nao_iniciada",
    minScore: 0,
    maxScore: 19,
    description: "Nenhum ato administrativo ou notícia verificável relacionado à promessa",
  },
  descumprida: {
    status: "descumprida",
    minScore: 0,
    maxScore: 0,
    description: "Ação oposta à promessa foi tomada, ou prazo expirou sem cumprimento com declaração contrária",
  },
  nao_classificada: {
    status: "nao_classificada",
    minScore: null,
    maxScore: null,
    description: "Promessa vaga demais para verificar (ex: 'vou melhorar a educação')",
  },
  sem_evidencia: {
    status: "nao_classificada",
    minScore: 0,
    maxScore: 0,
    description: "Sem evidência verificável para classificar - não inventa fontes",
  },
};

interface Evidence {
  id: string;
  evidence_description: string;
  evidence_link: string;
  source_name: string;
  validation_status: string;
  created_at: string;
  published_date: string | null;
}

interface PromiseData {
  id: string;
  promise_title: string;
  promise_description: string | null;
  politician_name: string;
  category: string | null;
  status: string;
  fulfillment_score: number | null;
}

interface EvidenceUsed {
  descricao: string;
  fonte: string;
  url: string | null;
  data: string | null;
}

interface ClassificationResult {
  status: string;
  fulfillment_score: number;
  criterio_aplicado: string;
  justificativa: string;
  evidencias_usadas: EvidenceUsed[];
  o_que_falta: string;
  o_que_foi_feito: string;
  confianca: number;
  motivo_confianca: string;
  tipo_promessa: string;
}

async function getEvidencesForPromise(promiseId: string): Promise<Evidence[]> {
  const { data } = await supabase
    .from("promise_evidences")
    .select("*")
    .eq("promise_id", promiseId)
    .eq("validation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(10);

  return data || [];
}

function buildPrompt(promise: PromiseData, evidences: Evidence[]): string {
  const evidenceText = evidences.length > 0
    ? evidences.map(e => `- ${e.source_name}: ${e.evidence_description} (link: ${e.evidence_link || "sem link disponível"}, data: ${e.published_date || "não informada"})`).join("\n")
    : "Nenhuma evidência encontrada na base de dados.";

  return `
Você é um avaliador independente de promessas políticas brasileiras.

PROMESSA A EVALUAR:
- Politico: ${promise.politician_name}
- Promessa: ${promise.promise_title}
- Descrição: ${promise.promise_description || "não informado"}
- Categoria: ${promise.category || "não informado"}

EVIDÊNCIAS ENCONTRADAS:
${evidenceText}

================================================================================
REGRAS DE PROTEÇÃO — INVIOLÁVEIS — DEVEM SER SEGUIDAS EM TODAS AS AVALIAÇÕES:
================================================================================
- Use linguagem neutra e técnica em todas as avaliações
- NEVER use termos ofensivos, pejorativos ou carregados ideologicamente
- NEVER afirme que um político cometeu crime sem decisão judicial transitada em julgado
- Substitua "fraudou" por "não há evidência de cumprimento"
- Substitua "mentiu" por "a promessa não foi cumprida no prazo"
- Substitua "corrupto" por "responde a investigação em andamento" (apenas se houver fonte oficial)
- NEVER use ironia, sarcasmo ou tom militante
- NEVER tome partido — apresente apenas fatos verificáveis com fonte
- Se não houver fonte, não afirme nada
- Evita termos como: "mentira", "engano", "trambique", "roubo", "ladrão", "corrupto", "fraudador"
- Use "não cumprida" ao invés de "descumprida" quando não houver ação oposta declarada
- Sea não houverlink oficial, use null — NUNCA invente URLs
================================================================================

CRITÉRIOS EXATOS DE CLASSIFICAÇÃO:

| Status | Score | Critério |
|--------|-------|----------|
| cumprida | 80-100 | Ação concluída com evidência verificável (lei sancionada, obra entregue, decreto publicado) |
| parcialmente_cumprida | 40-79 | Ação iniciada e com progresso comprovado, mas incompleta ou com escopo reduzido |
| em_andamento | 20-39 | Ação iniciada formalmente (licitação aberta, projeto de lei em tramitação, contrato assinado) sem entrega ainda |
| nao_iniciada | 0-19 | Nenhum ato administrativo ou notícia verificável relacionado à promessa |
| descumprida | 0 | Ação oposta à promessa foi tomada, ou prazo expirou sem cumprimento com declaração contrária |
| nao_classificada | null | Promessa vaga demais para verificar (ex: "vou melhorar a educação") |

REGRA DE OURO: 
- Se não houver evidência verificável, classifique como "nao_classificada" com score 0.
- Se a URL da evidência não for verificável, use null (NUNCA invente URL).
- confianca: Alta (0.7-1.0) se há 3+ fontes independentes. Média (0.4-0.69) se há 1-2 fontes. Baixa (0-0.39) se só há declaração do político ou dados insuficientes.

Retorne SOMENTE JSON válido com esta estrutura exata:
{
  "status": "cumprida|parcialmente_cumprida|em_andamento|nao_iniciada|descumprida|nao_classificada",
  "fulfillment_score": 0-100,
  "criterio_aplicado": "Nome do critério usado",
  "justificativa": "Texto explicando em linguagem cidadã por que recebeu essa nota",
  "evidencias_usadas": [
    {
      "descricao": "O que essa evidência prova",
      "fonte": "Nome do veículo ou órgão",
      "url": "URL real ou null",
      "data": "YYYY-MM-DD ou null"
    }
  ],
  "o_que_falta": "Texto explicando o que ainda precisa acontecer para cumprir totalmente",
  "o_que_foi_feito": "Texto explicando o que já foi concluído até agora",
  "confianca": 0.0-1.0,
  "motivo_confianca": "Alta — X fontes independentes confirmam. Baixa — apenas declaração do próprio político ou dados insuficientes"
}

responda apenas em JSON, sem markdown ou texto adicional.
`;
}

export async function classifyPromise(promiseId: string): Promise<ClassificationResult | null> {
  try {
    const { data: promise, error } = await supabase
      .from("promises")
      .select("*")
      .eq("id", promiseId)
      .single();

    if (error || !promise) {
      console.error("[Score] Promise not found:", promiseId);
      return null;
    }

    const evidences = await getEvidencesForPromise(promiseId);

    if (evidences.length === 0) {
      return createEmptyResult(promise);
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn("[Score] GROQ_API_KEY not configured, using fallback");
      return createFallbackResult(promise, evidences);
    }

    const prompt = buildPrompt(promise, evidences);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let response;
    try {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 1024,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        console.warn("[Score] Groq timeout após 25s, usando fallback");
      } else {
        console.warn("[Score] Groq fetch error, usando fallback:", err);
      }
      return createFallbackResult(promise, evidences);
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("[Score] Groq error:", response.status);
      return createFallbackResult(promise, evidences);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return createFallbackResult(promise, evidences);
    }

    let result: Partial<ClassificationResult>;
    try {
      result = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        return createFallbackResult(promise, evidences);
      }
    }

    const confianca = result.confianca ?? calculateConfianca(evidences);

    return {
      status: result.status || "nao_classificada",
      fulfillment_score: result.fulfillment_score ?? 0,
      criterio_aplicado: result.criterio_aplicado || "default",
      justificativa: result.justificativa || "Classificação via IA",
      evidencias_usadas: result.evidencias_usadas || mapEvidences(evidences),
      o_que_falta: result.o_que_falta || " sem dados suficientes para determinar",
      o_que_foi_feito: result.o_que_foi_feito || " belum dados suficientes",
      confianca,
      motivo_confianca: result.motivo_confianca || getConfiancaReason(confianca, evidences.length),
      tipo_promessa: determineTipo(promise, evidences),
    };
  } catch (err) {
    console.error("[Score] classifyPromise error:", err);
    return null;
  }
}

function createEmptyResult(promise: PromiseData): ClassificationResult {
  return {
    status: "nao_classificada",
    fulfillment_score: 0,
    criterio_aplicado: "sem_evidencia",
    justificativa: "Sem evidência verificável para classificar esta promessa.",
    evidencias_usadas: [],
    o_que_falta: "É necessário encontrar notícias ou documentos que comprovem ações relacionadas a esta promessa.",
    o_que_foi_feito: "Nenhuma evidência encontrada até o momento.",
    confianca: 1.0,
    motivo_confianca: "Alta — sistema verificou que não há dados disponíveis.classifique como sem evidência.",
    tipo_promessa: "sem_evidencia",
  };
}

function createFallbackResult(promise: PromiseData, evidences: Evidence[]): ClassificationResult {
  const hasPositiveNews = evidences.some(e => 
    (e.evidence_description || "").toLowerCase().includes("entregue") ||
    (e.evidence_description || "").toLowerCase().includes("inaugurad") ||
    (e.evidence_description || "").toLowerCase().includes("aprovad") ||
    (e.evidence_description || "").toLowerCase().includes("sancionad")
  );

  const hasNegativeNews = evidences.some(e =>
    (e.evidence_description || "").toLowerCase().includes("cancel") ||
    (e.evidence_description || "").toLowerCase().includes("suspend") ||
    (e.evidence_description || "").toLowerCase().includes("recus")
  );

  if (hasNegativeNews) {
    return {
      status: "descumprida",
      fulfillment_score: 0,
      criterio_aplicado: "descumprida",
      justificativa: "Evidência indica ação contrária à promessa.",
      evidencias_usadas: mapEvidences(evidences),
      o_que_falta: "A ação tomada foi oposta ao prometido.",
      o_que_foi_feito: " foram identificadas ações em sentido contrário.",
      confianca: 0.8,
      motivo_confianca: "Média — 1-2 fontes indicam descumprimento.",
      tipo_promessa: "contraditoria",
    };
  }

  if (hasPositiveNews) {
    return {
      status: "cumprida",
      fulfillment_score: 85,
      criterio_aplicado: "cumprida",
      justificativa: "Evidência indica cumprimento da promessa.",
      evidencias_usadas: mapEvidences(evidences),
      o_que_falta: " already entregue.",
      o_que_foi_feito: "Promise fulfilled.",
      confianca: 0.75,
      motivo_confianca: "Média — 1-2 fontes confirmam cumprimento.",
      tipo_promessa: "factual",
    };
  }

  return {
    status: "em_andamento",
    fulfillment_score: 30,
    criterio_aplicado: "em_andamento",
    justificativa: "Evidência encontrada mas status de conclusão impreciso.",
    evidencias_usadas: mapEvidences(evidences),
    o_que_falta: "Mais dados necessários para determinar conclusão.",
    o_que_foi_feito: "Exists evidence of action but not completed.",
    confianca: 0.5,
    motivo_confianca: "Baixa — apenas 1 fonte disponível.",
    tipo_promessa: "factual",
  };
}

function mapEvidences(evidences: Evidence[]): EvidenceUsed[] {
  return evidences.slice(0, 5).map(e => ({
    descricao: e.evidence_description || "Evidência",
    fonte: e.source_name || "Unknown",
    url: e.evidence_link || null,
    data: e.published_date || e.created_at?.split("T")[0] || null,
  }));
}

function calculateConfianca(evidences: Evidence[]): number {
  if (evidences.length >= 3) return 0.85;
  if (evidences.length >= 1) return 0.55;
  return 0.25;
}

function getConfiancaReason(confianca: number, evidenceCount: number): string {
  if (confianca >= 0.7) return `Alta — ${evidenceCount} fontes independentes confirmam.`;
  if (confianca >= 0.4) return `Média — ${evidenceCount} fontes disponíveis.`;
  return "Baixa — poucos dados disponíveis ou apenas declaração do próprio político.";
}

function determineTipo(promise: PromiseData, evidences: Evidence[]): string {
  const text = (promise.promise_title + " " + (promise.promise_description || "")).toLowerCase();
  
  if (evidences.length === 0) return "sem_evidencia";
  if (text.includes("não") || text.includes("vou")) return "vaga";
  if (text.includes("contrário") || text.includes("oposto")) return "contraditoria";
  if (text.includes("lei") || text.includes("decreto") || text.includes("projeto")) return "processual";
  
  return "factual";
}

export async function applyScore(
  promiseId: string,
  result: ClassificationResult
): Promise<boolean> {
  try {
    const sanitizedResult = await checkAndSanitizeResult(result, promiseId);

    const { data: oldPromise } = await supabase
      .from("promises")
      .select("status, fulfillment_score")
      .eq("id", promiseId)
      .single();

    const { error } = await supabase
      .from("promises")
      .update({
        status: sanitizedResult.status,
        fulfillment_score: sanitizedResult.fulfillment_score,
        classificacao_ia: {
          justificativa: sanitizedResult.justificativa,
          criterio: sanitizedResult.criterio_aplicado,
          confianca: sanitizedResult.confianca,
          tipo_promessa: sanitizedResult.tipo_promessa,
          classified_at: new Date().toISOString(),
        },
      })
      .eq("id", promiseId);

    if (error) {
      console.error("[Score] applyScore update error:", error);
      return false;
    }

    if (oldPromise && (oldPromise.status !== sanitizedResult.status || oldPromise.fulfillment_score !== sanitizedResult.fulfillment_score)) {
      await logAudit(promiseId, "status", oldPromise.status, sanitizedResult.status, "classificação automática via IA");
      await logAudit(promiseId, "fulfillment_score", String(oldPromise.fulfillment_score), String(sanitizedResult.fulfillment_score), "classificação automática via IA");
    }

    const { error: expError } = await supabase
      .from("promise_explanations")
      .insert({
        promise_id: promiseId,
        status: sanitizedResult.status,
        fulfillment_score: sanitizedResult.fulfillment_score,
        criterio_aplicado: sanitizedResult.criterio_aplicado,
        justificativa: sanitizedResult.justificativa,
        evidencias_usadas: prioritizeSources(sanitizedResult.evidencias_usadas || []),
        o_que_falta: sanitizedResult.o_que_falta,
        o_que_foi_feito: sanitizedResult.o_que_foi_feito,
        confianca: sanitizedResult.confianca,
        motivo_confianca: sanitizedResult.motivo_confianca,
        modelo_ia: "llama-3.1-8b-instant",
      });

    if (expError) {
      console.error("[Score] save explanation error:", expError);
    }

    return true;
  } catch (err) {
    console.error("[Score] applyScore error:", err);
    return false;
  }
}

async function logAudit(
  promiseId: string,
  campo: string,
  anterior: string,
  novo: string,
  motivo: string
): Promise<void> {
  try {
    await supabase.from("promise_audit_log").insert({
      promise_id: promiseId,
      campo_alterado: campo,
      valor_anterior: anterior,
      valor_novo: novo,
      motivo,
      alterado_por: "sistema"
    });
    console.log(`[Audit] Logged change for promise ${promiseId}: ${campo}`);
  } catch (err) {
    console.error("[Audit] Failed to log:", err);
  }
}

export async function getExplanation(promiseId: string): Promise<ClassificationResult | null> {
  try {
    const { data, error } = await supabase
      .from("promise_explanations")
      .select("*")
      .eq("promise_id", promiseId)
      .order("gerado_em", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      status: data.status,
      fulfillment_score: data.fulfillment_score,
      criterio_aplicado: data.criterio_aplicado,
      justificativa: data.justificativa,
      evidencias_usadas: data.evidencias_usadas || [],
      o_que_falta: data.o_que_falta,
      o_que_foi_feito: data.o_que_foi_feito,
      confianca: data.confianca,
      motivo_confianca: data.motivo_confianca,
      tipo_promessa: "",
    };
  } catch (err) {
    console.error("[Score] getExplanation error:", err);
    return null;
  }
}

export async function batchClassify(): Promise<{
  processed: number;
  success: number;
  failed: number;
}> {
  const { data: unclassified, error } = await supabase
    .from("promises")
    .select("id, status")
    .or("status.eq.nao_classificada,status.is.null")
    .limit(50);

  if (error || !unclassified?.length) {
    return { processed: 0, success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (const p of unclassified) {
    const result = await classifyPromise(p.id);
    if (result) {
      const applied = await applyScore(p.id, result);
      if (applied) success++;
      else failed++;
    } else {
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 500));
  }

  return {
    processed: unclassified.length,
    success,
    failed,
  };
}

export function getCriteria() {
  return CRITERIA;
}

export default {
  classifyPromise,
  applyScore,
  getExplanation,
  batchClassify,
  getCriteria,
};