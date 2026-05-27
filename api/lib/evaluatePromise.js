import { GoogleGenerativeAI } from "@google/generative-ai";
import { getUrlDomain } from './sourceLevel.js';

const SOCIAL_DOMAINS = ['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com'];

const STATUS_CONFIG = {
  cumprida:              { min: 80, max: 100, base: 90 },
  parcialmente_cumprida: { min: 40, max: 79,  base: 55 },
  em_andamento:          { min: 40, max: 79,  base: 50 },
  nao_iniciada:          { min: 0,  max: 39,  base: 20 },
  descumprida:           { min: 0,  max: 0,   base: 0  },
  nao_classificada:      { min: 0,  max: 39,  base: 20 },
  pendente:              { min: 0,  max: 39,  base: 20 },
  parcial:               { min: 40, max: 79,  base: 55 },
  quebrada:              { min: 0,  max: 0,   base: 0  },
};

function isSocialMedia(url) {
  const domain = getUrlDomain(url);
  if (!domain) return false;
  return SOCIAL_DOMAINS.some(s => domain === s || domain.endsWith('.' + s));
}

function isPlaceholder(url) {
  return !url || url === '#' || url.trim() === '';
}

export function filterSocialMedia(evidences) {
  return (evidences || []).filter(ev => !isSocialMedia(ev.url));
}

function extractHostname(url) {
  if (!url) return '';
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url.split('/')[2]?.replace('www.', '') || ''; }
}

export function mapStatusToFrontend(aiStatus) {
  const map = {
    'cumprida': 'cumprida',
    'parcialmente_cumprida': 'parcial',
    'em_andamento': 'parcial',
    'nao_iniciada': 'pendente',
    'nao_classificada': 'pendente',
    'pendente': 'pendente',
    'descumprida': 'quebrada',
    'parcial': 'parcial',
    'quebrada': 'quebrada',
    'nao_cumprida': 'quebrada',
  };
  return map[aiStatus] || 'pendente';
}

function clampScore(status, score) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  return Math.max(cfg.min, Math.min(cfg.max, Math.round(score)));
}

function computeConfidence(realEvidences, modelName) {
  const count = realEvidences.length;
  let base = 0;
  if (count >= 3) base = 0.90;
  else if (count === 2) base = 0.80;
  else if (count === 1) base = 0.60;
  else base = 0.30;

  const confianca = parseFloat(base.toFixed(2));

  let motivo_confianca;
  if (count === 0)    motivo_confianca = 'Nenhuma fonte verificável encontrada. Resultado baseado apenas no modelo de linguagem.';
  else if (count === 1) motivo_confianca = '1 fonte verificável encontrada. Confiança moderada.';
  else if (count === 2) motivo_confianca = '2 fontes verificáveis encontradas. Confiança boa.';
  else                motivo_confianca = `${count} fontes verificáveis encontradas. Confiança alta.`;

  return { confianca, motivo_confianca };
}

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

function buildSearchQuery(promise, customTitle) {
  const title  = customTitle || promise.promise_title || '';
  const name   = promise.politician_name || '';
  const cargo  = promise.role || promise.cargo || '';
  const state  = promise.state || '';
  const city   = promise.city || promise.cidade || '';
  const year   = promise.created_at ? new Date(promise.created_at).getFullYear() : '';
  const locationParts = [city, state].filter(Boolean).join(' ');
  const parts = [`"${name}"`, cargo, locationParts, year, title.substring(0, 50)].filter(Boolean);
  return parts.join(' ');
}

export async function batchExtractKeywords(promises) {
  if (!GEMINI_KEY) {
    const map = {};
    promises.forEach(p => { map[p.id] = buildSearchQuery(p); });
    return map;
  }
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const map = {};
    for (let i = 0; i < promises.length; i += 5) {
      const batch = promises.slice(i, i + 5);
      const prompt = `Extraia 2 a 3 palavras-chave de cada promessa abaixo para busca no Google. Responda SOMENTE JSON: {"keywords": ["kw1 kw2", "kw3 kw4", ...]}\n\n${
        batch.map((p, idx) => `${idx + 1}. "${p.promise_title}"`).join('\n')
      }`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleaned = text.replace(/```(?:json)?\s*|\s*```/g, '').trim();
      const kwList = JSON.parse(cleaned).keywords;
      batch.forEach((p, idx) => {
        map[p.id] = `"${p.politician_name}" ${kwList[idx] || p.promise_title?.substring(0, 40)} ${p.state || ''} cumprido OR inaugurado`;
      });
    }
    return map;
  } catch {
    const map = {};
    promises.forEach(p => { map[p.id] = buildSearchQuery(p); });
    return map;
  }
}

export async function evaluateWithAI(promise, preExtractedQuery) {
  const originalStatus = promise.status || 'pendente';
  const originalScore  = promise.fulfillment_score ?? 20;
  const title          = promise.promise_title || '';

  if (!GEMINI_KEY) {
    console.error('[evaluateWithAI] GEMINI_API_KEY not configured');
    return {
      status: mapStatusToFrontend(originalStatus),
      fulfillment_score: clampScore(originalStatus, originalScore),
      justification: 'API Gemini não configurada.',
      o_que_foi_feito: 'Aguardando configuração da API Gemini.',
      o_que_falta: 'Configurar GEMINI_API_KEY nas variáveis de ambiente.',
      evidences: [],
      complexity: 1, impact: 1,
      confianca: 0, motivo_confianca: 'Serviço de IA não configurado.',
      modelo_ia: 'error',
      evaluated_with_fallback: true,
    };
  }

  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }],
  });

  const cargoInfo  = promise.role   || promise.cargo   || 'não informado';
  const estadoInfo = [promise.city || promise.cidade, promise.state].filter(Boolean).join(' — ') || 'não informado';
  const anoInfo    = promise.created_at ? new Date(promise.created_at).getFullYear() : 'não informado';

  const prompt = `Você é um avaliador independente e rigoroso de promessas políticas brasileiras. Use a ferramenta de busca do Google para pesquisar evidências atualizadas sobre o cumprimento desta promessa.

POLÍTICO: ${promise.politician_name || ''}
CARGO: ${cargoInfo}
LOCAL: ${estadoInfo}
ANO DA PROMESSA: ${anoInfo}
PROMESSA AVALIADA: "${title}"

Pesquise na web em português do Brasil e avalie com base nas evidências encontradas.

Responda SOMENTE com JSON válido (sem markdown, sem comentários):
{
  "score": <0-100>,
  "status": "pendente|parcial|cumprida|nao_cumprida",
  "motivo_score": "<explicação detalhada mínimo 80 palavras citando fontes>",
  "o_que_foi_concluido": ["<item concreto 1>", "<item concreto 2>"],
  "o_que_falta": ["<item pendente 1>", "<item pendente 2>"],
  "confianca": <0-100>,
  "motivo_confianca": "<explicação do nível de confiança>"
}

REGRAS:
- cumprida (80-100): evidência clara de conclusão em fontes confiáveis
- parcial (40-79): progresso concreto mas incompleto
- pendente (0-39): pouco ou nenhum progresso (ou sem evidências)
- nao_cumprida (0): ação contrária à promessa ou prazo expirado sem entrega
- SEM evidência com URL real → score MÁXIMO 25, status "pendente"
- confianca reflete quantas fontes confiáveis corroboram (0=nenhuma, 100=totalmente corroborado)`;

  let parsed = null;
  let usedFallback = false;
  let groundingChunks = [];

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;

    const text = response.text();
    const cleaned = text.replace(/```(?:json)?\s*|\s*```/g, '').trim();
    parsed = JSON.parse(cleaned);

    const gm = response.candidates?.[0]?.groundingMetadata;
    if (gm?.groundingChunks) {
      groundingChunks = gm.groundingChunks
        .filter(c => c.web?.uri && !isPlaceholder(c.web.uri))
        .map(c => ({
          descricao: c.web.title || '',
          fonte: extractHostname(c.web.uri),
          url: c.web.uri,
          data: null,
        }));
    }
  } catch (err) {
    console.error(`[evaluateWithAI] Gemini falhou para "${title.substring(0, 40)}": ${err.message}`);
    usedFallback = true;
  }

  if (usedFallback || !parsed) {
    const clampedScore = clampScore(originalStatus, originalScore);
    const mappedFallback = mapStatusToFrontend(originalStatus);
    const { confianca, motivo_confianca } = computeConfidence(groundingChunks, 'fallback');
    return {
      status: mappedFallback,
      fulfillment_score: clampedScore,
      justification: 'Avaliação automática indisponível no momento. Serviço de IA temporariamente limitado.',
      o_que_foi_feito: 'Aguardando reavaliação pela IA na próxima execução.',
      o_que_falta: 'Reavaliação completa via IA na próxima execução.',
      evidences: groundingChunks,
      complexity: 1, impact: 1,
      confianca, motivo_confianca,
      modelo_ia: 'fallback',
      evaluated_with_fallback: true,
    };
  }

  const camelStatus = parsed.status || 'pendente';
  const mappedStatus = mapStatusToFrontend(camelStatus);

  const hasRealUrl = groundingChunks.length > 0;
  let score = clampScore(mappedStatus, parsed.score ?? 20);
  if (!hasRealUrl) {
    score = Math.min(score, 25);
  }
  const finalStatus = hasRealUrl ? mappedStatus : 'pendente';

  const { confianca, motivo_confianca } = computeConfidence(groundingChunks, 'gemini-2.5-flash');

  return {
    status: finalStatus,
    fulfillment_score: score,
    justification: (parsed.motivo_score || '').trim(),
    o_que_foi_feito: (Array.isArray(parsed.o_que_foi_concluido) ? parsed.o_que_foi_concluido.join('\n') : parsed.o_que_foi_feito || '').trim(),
    o_que_falta: (Array.isArray(parsed.o_que_falta) ? parsed.o_que_falta.join('\n') : parsed.o_que_falta || '').trim(),
    evidences: groundingChunks,
    complexity: parsed.complexity ? Math.max(1, Math.min(3, Math.round(parsed.complexity))) : 1,
    impact: parsed.impact ? Math.max(1, Math.min(3, Math.round(parsed.impact))) : 1,
    confianca, motivo_confianca,
    modelo_ia: 'gemini-2.5-flash',
    evaluated_with_fallback: false,
  };
}
