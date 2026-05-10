// =============================================
// Promessômetro - Classificação Inteligente de Promessas
// Serviço de IA para classify promises usando GroQ
// =============================================

import { supabase } from "../lib/supabase.js";

interface ClassificationResult {
  tipo_primario: string;
  tipos_secundarios: string[];
  esfera: string;
  grau_confianca: number;
  justificativa: string;
}

// Prompt base para classify promises
const CLASSIFICATION_PROMPT = `Você é um especialista em análise de promessas políticas brasileiras.

Analise a promessa abaixo e retorne EXATAMENTE este JSON sem markdown:
{"tipo_primario":"objetiva|subjetiva|mensuravel|simbolica|dependente_congresso|dependente_orcamento","tipos_secundarios":[],"esfera":"federal|estadual|municipal","grau_confianca":0-100,"justificativa":"..."}

Regras de classificação:
- OBJETIVA: meta clara e mensurável (ex: "criar 6 milhões de empregos")
- SUBJETIVA: depende de interpretação subjetiva (ex: "melhorar a qualidade de vida")
- MENSURAVEL: tem número ou prazo definido claramente
- SIMBOLICA: gesto político sem impacto prático direto
- DEPENDENTE_CONGRESSO: requer aprovação legislativa
- DEPENDENTE_ORCAMENTO: requer aprovação orçamentária
- FEDERAL: competência do governo federal
- ESTADUAL: competência do governo estadual
- MUNICIPAL: competência do governo municipal

Promessa: "{title}"
Político: {politician}

Retorne apenas JSON válido.`;

// Chamar API GroQ
async function callGroQ(prompt: string): Promise<ClassificationResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn("[Classification] GROQ_API_KEY não configurada");
    return null;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-8e-award-winning-20250516",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 512,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Classification] GroQ error:", error);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    if (content) {
      return JSON.parse(content);
    }

    return null;
  } catch (err) {
    console.error("[Classification] Error:", err);
    return null;
  }
}

// Classificação fallback simples
function simpleClassify(title: string): ClassificationResult {
  const titleLower = title.toLowerCase();

  let tipoPrimario = "subjetiva";
  const tiposSecundarios: string[] = [];

  // OBJETIVA - números específicos
  if (/\d+\s*(milhões?|milhar|empregos|escolas|hospitais)/i.test(title)) {
    tipoPrimario = "objetiva";
  }
  // MENSURAVEL - tiene plazo o número
  else if (/%\d{4}|até\s*\d+|em\s*\d+\s+anos/i.test(title)) {
    tipoPrimario = "mensuravel";
  }
  // SIMBOLICA - gestos
  else if (/bandeira|símbolo|hino|honra|visita/i.test(title)) {
    tipoPrimario = "simbolica";
  }

  // Detecta esfera
  let esfera = "federal";
  if (/estadual|estado|governo do estado/i.test(title)) {
    esfera = "estadual";
  } else if (/municipal|prefeito|prefeitura|cidade/i.test(title)) {
    esfera = "municipal";
  }

  // Congressional dependency
  if (/lei|projeto|congresso|câmara|senado|aprovação parlamentar/i.test(title)) {
    tiposSecundarios.push("dependente_congresso");
  }

  // Budget dependency
  if (/orçamento|recursos|verba|investimento|finance|dotação/i.test(title)) {
    tiposSecundarios.push("dependente_orcamento");
  }

  return {
    tipo_primario: tipoPrimario,
    tipos_secundarios: tiposSecundarios,
    esfera,
    grau_confianca: 60,
    justificativa: `Classificação automática baseada em palavras-chave.`
  };
}

// Função principal de classificação
export async function classifyPromise(promiseId: string): Promise<boolean> {
  console.log(`[Classification] Classifying promise: ${promiseId}`);

  try {
    // Busca promise
    const { data: promise, error } = await supabase
      .from("promises")
      .select("id, promise_title, politician_name")
      .eq("id", promiseId)
      .single();

    if (error || !promise) {
      console.error("[Classification] Promise not found:", promiseId);
      return false;
    }

    const prompt = CLASSIFICATION_PROMPT
      .replace("{title}", promise.promise_title)
      .replace("{politician}", promise.politician_name);

    // Tenta classify via IA GroQ
    let result = await callGroQ(prompt);

    // Fallback para simple classification
    if (!result) {
      console.log("[Classification] Using simple classification");
      result = simpleClassify(promise.promise_title);
    }

    // Atualiza no banco
    const { error: updateError } = await supabase
      .from("promises")
      .update({
        classificacao_ia: result,
        tipo_promessa: result.tipo_primario,
        updated_at: new Date().toISOString()
      })
      .eq("id", promiseId);

    if (updateError) {
      console.error("[Classification] Update error:", updateError);
      return false;
    }

    console.log(`[Classification] Done: ${promiseId}`, result);
    return true;
  } catch (err) {
    console.error("[Classification] Error:", err);
    return false;
  }
}

// Classify todas as promises não classificadas
export async function classifyAllPending(): Promise<number> {
  console.log("[Classification] Classifying all pending promises...");

  const { data: promises, error } = await supabase
    .from("promises")
    .select("id")
    .is("classificacao_ia", null)
    .limit(100);

  if (error || !promises) {
    console.log("[Classification] No promises to classify");
    return 0;
  }

  let count = 0;
  for (const p of promises) {
    await classifyPromise(p.id);
    count++;
    // Rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[Classification] Classified ${count} promises`);
  return count;
}

// Export
export default {
  classifyPromise,
  classifyAllPending
};