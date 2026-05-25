import { supabase } from "../lib/supabase.js";

interface Violation {
  type: string;
  pattern: string;
  severity: "low" | "medium" | "high" | "critical";
}

const BLOCKED_TERMS: Array<{pattern: RegExp; replacement: string; severity: "low" | "medium" | "high" | "critical"; type: string}> = [
  { pattern: /\b(fraude|fraudou|fraudador|fraudar)\b/gi, replacement: "sem evidência de cumprimento", severity: "high", type: "acusacao_crime" },
  { pattern: /\b(mentiu|mentira|mentir|enganou|enganar)\b/gi, replacement: "promessa não cumprida no prazo", severity: "high", type: "acusacao_moral" },
  { pattern: /\b(corrupto|corrupção|corrupta|corromper)\b/gi, replacement: "responde a investigação em andamento", severity: "high", type: "acusacao_crime" },
  { pattern: /\b(ladrão|ladrao|latrocínio)\b/gi, replacement: "investigado", severity: "critical", type: "ofensa_pessoal" },
  { pattern: /\b(roubo|roubou)\b/gi, replacement: "apuração em curso", severity: "critical", type: "acusacao_crime" },
  { pattern: /\b(trambique|trampez|malfeito)\b/gi, replacement: "irregularidade identificada", severity: "high", type: "acusacao_moral" },
  { pattern: /\b(bandido|criminoso|criminosa)\b/gi, replacement: "investigado", severity: "critical", type: "ofensa_pessoal" },
  { pattern: /\b(escroto|imbecil|idiota|burro|otário|otario)\b/gi, replacement: "[termo removido]", severity: "critical", type: "ofensa_pessoal" },
  { pattern: /\b(fascista|nazista|nazismo|fascismo)\b/gi, replacement: "[termo ideológico removido]", severity: "high", type: "ataque_ideologico" },
  { pattern: /\b(comunista|comunismo|comunista)\b/gi, replacement: "[termo ideológico removido]", severity: "high", type: "ataque_ideologico" },
  { pattern: /\b(bolsominion|petralha|esquerdopata|direitista radical)\b/gi, replacement: "[termo político removido]", severity: "high", type: "ataque_ideologico" },
  { pattern: /\b(incompetente|incompetência|inoperante)\b/gi, replacement: "desempenho insuficiente", severity: "medium", type: "avaliacao_subjetiva" },
  { pattern: /\b(despreparado|preparado)\b/gi, replacement: "sem dados suficientes", severity: "medium", type: "avaliacao_subjetiva" },
  { pattern: /\b(traidor|traidora|traição)\b/gi, replacement: "posição divergente registrada", severity: "high", type: "acusacao_moral" },
];

const IRONY_PATTERNS: Array<{pattern: RegExp; severity: "low" | "medium" | "high" | "critical"; type: string}> = [
  { pattern: /\bclaro que\b/gi, severity: "medium", type: "ironia" },
  { pattern: /\bclaríssimo\b/gi, severity: "medium", type: "ironia" },
  { pattern: /\bcomo sempre\b/gi, severity: "medium", type: "ironia" },
  { pattern: /\bobviamente\b/gi, severity: "low", type: "ironia" },
  { pattern: /\bpasmem\b/gi, severity: "medium", type: "ironia" },
  { pattern: /\bveja só\b/gi, severity: "medium", type: "ironia" },
  { pattern: /\bsó não\b/gi, severity: "medium", type: "ironia" },
  { pattern: /\bnaturalmente\b/gi, severity: "low", type: "ironia" },
  { pattern: /\binfelizmente\b/gi, severity: "medium", type: "expressao_carregada" },
  { pattern: /\bfelizmente\b/gi, severity: "medium", type: "expressao_carregada" },
  { pattern: /\baí sim\b/gi, severity: "low", type: "ironia" },
  { pattern: /\bsacanagem\b/gi, severity: "high", type: "ofensa" },
  { pattern: /\babominação\b/gi, severity: "medium", type: "expressao_carregada" },
];

const PARTISAN_PATTERNS: Array<{pattern: RegExp; type: string; severity: "low" | "medium" | "high" | "critical"}> = [
  { pattern: /todo(s)?\s+(esquerdista|direitista)/gi, type: "generalizacao_partidaria", severity: "high" },
  { pattern: /esquerda\s+(é|está|sempre)/gi, type: "generalizacao_partidaria", severity: "high" },
  { pattern: /direita\s+(é|está|sempre)/gi, type: "generalizacao_partidaria", severity: "high" },
  { pattern: /petista|ptista/gi, type: "ataque_partidario", severity: "high" },
  { pattern: /bolsoronista|bolsominion/gi, type: "ataque_partidario", severity: "high" },
  { pattern: /partid(o|ário)\s+(do|da)\s+.*?(roubou|é|foi)/gi, type: "generalizacao_partidaria", severity: "high" },
  { pattern: /governo\s+(de\s+)?esquerda/gi, type: "ataque_ideologico", severity: "high" },
  { pattern: /governo\s+(de\s+)?direita/gi, type: "ataque_ideologico", severity: "high" },
];

const CRIME_CLAIMS: Array<{pattern: RegExp; severity: "low" | "medium" | "high" | "critical"; type: string}> = [
  { pattern: /\bcometeu\s+(crime|estelionato|peculato|corrupção passiva)\b/gi, severity: "critical", type: "acusacao_crime" },
  { pattern: /\bpraticou\s+(crime|irregularidade)\b/gi, severity: "high", type: "acusacao_crime" },
  { pattern: /\bcondenado\s+(por|por\s+crim)\b/gi, severity: "high", type: "acusacao_crime" },
  { pattern: /\bsentenciado\b/gi, severity: "high", type: "acusacao_crime" },
  { pattern: /\btrapaceou\b/gi, severity: "high", type: "acusacao_moral" },
  { pattern: /\besqueitou\s+(do|pra)\b/gi, severity: "medium", type: "acusacao_moral" },
];

interface BiasCheckResult {
  aprovado: boolean;
  violacoes: Violation[];
  sanitizado: string;
  corrigido: string[];
}

export function checkBias(text: string): BiasCheckResult {
  if (!text) {
    return { aprovado: true, violacoes: [], sanitizado: text, corrigido: [] };
  }

  const violacoes: Violation[] = [];
  const corrigido: string[] = [];
  let sanitizado = text;

  for (const item of BLOCKED_TERMS) {
    if (item.pattern.test(sanitizado)) {
      violacoes.push({
        type: item.type,
        pattern: item.pattern.source,
        severity: item.severity
      });
      sanitizado = sanitizado.replace(item.pattern, item.replacement);
      corrigido.push(`${item.pattern.source} → ${item.replacement}`);
    }
  }

  for (const item of IRONY_PATTERNS) {
    if (item.pattern.test(sanitizado)) {
      violacoes.push({
        type: item.type,
        pattern: item.pattern.source,
        severity: item.severity
      });
    }
  }

  for (const item of PARTISAN_PATTERNS) {
    if (item.pattern.test(sanitizado)) {
      violacoes.push({
        type: item.type,
        pattern: item.pattern.source,
        severity: "high"
      });
    }
  }

  for (const item of CRIME_CLAIMS) {
    if (item.pattern.test(sanitizado)) {
      violacoes.push({
        type: item.type,
        pattern: item.pattern.source,
        severity: item.severity
      });
    }
  }

  const criticalOrHigh = violacoes.filter(v => v.severity === "critical" || v.severity === "high");
  
  return {
    aprovado: criticalOrHigh.length === 0,
    violacoes,
    sanitizado,
    corrigido
  };
}

export function sanitizeText(text: string): string {
  if (!text) return text;

  let sanitizado = text;

  for (const item of BLOCKED_TERMS) {
    sanitizado = sanitizado.replace(item.pattern, item.replacement);
  }

  for (const item of IRONY_PATTERNS) {
    if (item.type === "ironia") {
      sanitizado = sanitizado.replace(item.pattern, "");
    }
  }

  sanitizado = sanitizado.replace(/\s+/g, " ").trim();
  sanitizado = sanitizado.charAt(0).toUpperCase() + sanitizado.slice(1);

  return sanitizado;
}

export function validateText(text: string): { valido: boolean; motivos: string[] } {
  const result = checkBias(text);
  const motivos = result.violacoes.map(v => `${v.type}: ${v.pattern} (${v.severity})`);
  return { valido: result.aprovado, motivos };
}

export async function logBiasViolation(
  promiseId: string,
  campo: string,
  textoOriginal: string,
  textoSanitizado: string,
  violacoes: Violation[]
): Promise<void> {
  try {
    await supabase.from("bias_violation_log").insert({
      promise_id: promiseId,
      campo,
      texto_original: textoOriginal,
      texto_sanitizado: textoSanitizado,
      violacoes: violacoes,
      gravidade: violacoes.some(v => v.severity === "critical") ? "critical" :
                  violacoes.some(v => v.severity === "high") ? "high" : "medium"
    });
    console.log(`[BiasGuard] Violation logged for promise ${promiseId}, campo ${campo}`);
  } catch (err) {
    console.error("[BiasGuard] Failed to log violation:", err);
  }
}

export async function checkAndSanitizeResult(result: any, promiseId: string): Promise<any> {
  const fieldsToCheck = [
    "justificativa",
    "criterio_aplicado",
    "o_que_foi_feito",
    "o_que_falta",
    "status"
  ];

  const sanitized = { ...result };

  for (const field of fieldsToCheck) {
    if (sanitized[field] && typeof sanitized[field] === "string") {
      const original = sanitized[field];
      const biasResult = checkBias(original);

      if (biasResult.violacoes.length > 0) {
        sanitized[field] = biasResult.sanitizado;
        await logBiasViolation(promiseId, field, original, biasResult.sanitizado, biasResult.violacoes);
        console.log(`[BiasGuard] Sanitized field ${field} for promise ${promiseId}`);
      }
    }
  }

  return sanitized;
}

export function getProtectionReport(violacoes: Violation[]): {
  isonomia: boolean;
  linguagem_neutra: boolean;
  sem_ataques: boolean;
  presuncao_inocencia: boolean;
  sem_ironia: boolean;
  sem_editorializacao: boolean;
} {
  return {
    isonomia: !violacoes.some(v => v.type === "ataque_partidario" || v.type === "generalizacao_partidaria"),
    linguagem_neutra: !violacoes.some(v => v.type === "expressao_carregada"),
    sem_ataques: !violacoes.some(v => v.type === "ofensa_pessoal" || v.type === "ataque_ideologico"),
    presuncao_inocencia: !violacoes.some(v => v.type === "acusacao_crime"),
    sem_ironia: !violacoes.some(v => v.type === "ironia"),
    sem_editorializacao: !violacoes.some(v => v.type === "avaliacao_subjetiva")
  };
}

export default {
  checkBias,
  sanitizeText,
  validateText,
  checkAndSanitizeResult,
  logBiasViolation,
  getProtectionReport
};