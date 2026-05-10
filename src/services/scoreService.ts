import { supabase } from "../lib/supabase.js";

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

interface ClassificationResult {
  status: string;
  fulfillment_score: number;
  justificativa: string;
  criterio_aplicado: string;
  confianca: number;
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
    ? evidences.map(e => `- ${e.source_name}: ${e.evidence_description} (${e.evidence_link || "sem link"})`).join("\n")
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

CRITÉRIOS EXATOS DE CLASSIFICAÇÃO:

| Status | Score | Critério |
|--------|-------|----------|
| cumprida | 80-100 | Ação concluída com evidência verificável (lei sancionada, obra entregue, decreto publicado) |
| parcialmente_cumprida | 40-79 | Ação iniciada e com progresso comprovado, mas incompleta ou com escopo reduzido |
| em_andamento | 20-39 | Ação iniciada formalmente (licitação aberta, projeto de lei em tramitação, contrato assinado) sem entrega ainda |
| nao_iniciada | 0-19 | Nenhum ato administrativo ou notícia verificável relacionado à promessa |
| descumprida | 0 | Ação oposta à promessa foi tomada, ou prazo expirou sem cumprimento com declaração contrária |
| nao_classificada | null | Promessa vaga demais para verificar (ex: "vou melhorar a educação") |

REGRA DE OURO: Se não houver evidência verificável, classifique como "nao_classificada" com score 0.
NUNCA invente fontes ou notícias. Se a evidência for insuficiente, indique explicitamente.

Retorne SOMENTE JSON válido com esta estrutura:
{
  "status": "cumprida|parcialmente_cumprida|em_andamento|nao_iniciada|descumprida|nao_classificada",
  "fulfillment_score": 0-100,
  "justificativa": "Breve explicação em português",
  "criterio_aplicado": "Nome do critério usado",
  "confianca": 0-100,
  "tipo_promessa": "factual|contraditoria|processual|vaga|sem_evidencia"
}

responda apenas em JSON, sem markdown ou texto adicional.
`;
}

function determineTipo(promise: PromiseData, evidences: Evidence[]): string {
  const text = (promise.promise_title + " " + (promise.promise_description || "")).toLowerCase();
  
  if (evidences.length === 0) return "sem_evidencia";
  
  if (text.includes("não") || text.includes("vou")) return "vaga";
  if (text.includes("contrário") || text.includes("oposto")) return "contraditoria";
  if (text.includes("lei") || text.includes("decreto") || text.includes("projeto")) return "processual";
  
  return "factual";
}

function determineStatus(score: number): string {
  if (score >= 80) return "cumprida";
  if (score >= 40) return "parcialmente_cumprida";
  if (score >= 20) return "em_andamento";
  if (score === 0) return "descumprida";
  return "nao_iniciada";
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
      const tipo = determineTipo(promise, []);
      return {
        status: "nao_classificada",
        fulfillment_score: 0,
        justificativa: "Sem evidência verificável para classificar esta promessa.",
        criterio_aplicado: "sem_evidencia",
        confianca: 100,
        tipo_promessa: tipo,
      };
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn("[Score] GROQ_API_KEY not configured, using fallback");
      return fallbackClassification(promise, evidences);
    }

    const prompt = buildPrompt(promise, evidences);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 512,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("[Score] Groq error:", response.status);
      return fallbackClassification(promise, evidences);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return fallbackClassification(promise, evidences);
    }

    let result: Partial<ClassificationResult>;
    try {
      result = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        return fallbackClassification(promise, evidences);
      }
    }

    const tipo = determineTipo(promise, evidences);

    return {
      status: result.status || "nao_classificada",
      fulfillment_score: result.fulfillment_score ?? 0,
      justificativa: result.justificativa || "Classificação via IA",
      criterio_aplicado: result.criterio_aplicado || "default",
      confianca: result.confianca ?? 50,
      tipo_promessa: tipo,
    };
  } catch (err) {
    console.error("[Score] classifyPromise error:", err);
    return null;
  }
}

function fallbackClassification(promise: PromiseData, evidences: Evidence[]): ClassificationResult {
  if (evidences.length === 0) {
    return {
      status: "nao_classificada",
      fulfillment_score: 0,
      justificativa: "Sem evidência verificável para classificar.",
      criterio_aplicado: "sem_evidencia",
      confianca: 100,
      tipo_promessa: "sem_evidencia",
    };
  }

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
      justificativa: "Evidência indica ação contrária à promessa.",
      criterio_aplicado: "descumprida",
      confianca: 80,
      tipo_promessa: "contraditoria",
    };
  }

  if (hasPositiveNews) {
    return {
      status: "cumprida",
      fulfillment_score: 85,
      justificativa: "Evidência indica cumprimento da promessa.",
      criterio_aplicado: "cumprida",
      confianca: 75,
      tipo_promessa: "factual",
    };
  }

  return {
    status: "em_andamento",
    fulfillment_score: 30,
    justificativa: "Evidência encontrada mas status de conclusão impreciso.",
    criterio_aplicado: "em_andamento",
    confianca: 50,
    tipo_promessa: "factual",
  };
}

export async function applyScore(
  promiseId: string,
  result: ClassificationResult
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("promises")
      .update({
        status: result.status,
        fulfillment_score: result.fulfillment_score,
        classificacao_ia: {
          justificativa: result.justificativa,
          criterio: result.criterio_aplicado,
          confianca: result.confianca,
          tipo_promessa: result.tipo_promessa,
          classified_at: new Date().toISOString(),
        },
        tipo_promessa: result.tipo_promessa,
      })
      .eq("id", promiseId);

    if (error) {
      console.error("[Score] applyScore update error:", error);
      return false;
    }

    await supabase.from("promise_evidences").insert({
      promise_id: promiseId,
      evidence_description: result.justificativa,
      evidence_link: null,
      source_name: "IA Classification",
      source_type: "ia_classificacao",
      tipo: "classificacao",
      evidence_type: "analysis",
      validation_status: "approved",
      confidence_score: result.confianca,
    });

    return true;
  } catch (err) {
    console.error("[Score] applyScore error:", err);
    return false;
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
  batchClassify,
  getCriteria,
};