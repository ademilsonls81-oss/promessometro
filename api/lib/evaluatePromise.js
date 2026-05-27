import { getUrlDomain } from './sourceLevel.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCIAL_DOMAINS = ['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com'];

// Model cascade: best quality first, falls back on rate-limit / error
const MODEL_CASCADE = [
  'llama-3.3-70b-versatile',
  'gemma2-9b-it',
  'llama-3.1-8b-instant',
];

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

// Expanded domain list — national + fact-checkers + transparency portals
const TAVILY_DOMAINS = [
  // National news
  'g1.globo.com', 'folha.uol.com.br', 'estadao.com.br', 'uol.com.br',
  'r7.com', 'correiobraziliense.com.br', 'valoreconomico.com.br',
  // Government / official
  'in.gov.br', 'agenciabrasil.ebc.com.br', 'transparencia.gov.br',
  'portaldatransparencia.gov.br', 'tce.sp.gov.br', 'tce.rj.gov.br',
  'tce.mg.gov.br', 'tce.ba.gov.br', 'tce.pe.gov.br', 'tce.pr.gov.br',
  // Fact-checkers
  'aosfaltos.com.br', 'lupa.uol.com.br', 'piaui.folha.uol.com.br',
  // Regional portals
  'atarde.com.br', 'imirante.com', 'diariodepernambuco.com.br',
  'gauchazh.clicrbs.com.br', 'oestadodesp.com.br',
];

// ─── Utilities ────────────────────────────────────────────────────────────────

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
  };
  return map[aiStatus] || 'pendente';
}

function clampScore(status, score) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  return Math.max(cfg.min, Math.min(cfg.max, Math.round(score)));
}

/**
 * Compute confidence score and its human-readable reason.
 * Returns { confianca: 0.0–1.0, motivo_confianca: string }
 */
function computeConfidence(realEvidences, modelName) {
  const count = realEvidences.length;
  let base = 0;
  if (count >= 3) base = 0.90;
  else if (count === 2) base = 0.80;
  else if (count === 1) base = 0.60;
  else base = 0.30; // no real evidence

  // Slight penalty for smaller models
  if (modelName === 'llama-3.1-8b-instant') base = Math.max(0.25, base - 0.10);
  else if (modelName === 'gemma2-9b-it')     base = Math.max(0.30, base - 0.05);

  const confianca = parseFloat(base.toFixed(2));

  let motivo_confianca;
  if (count === 0)    motivo_confianca = 'Nenhuma fonte verificável encontrada. Resultado baseado apenas no modelo de linguagem.';
  else if (count === 1) motivo_confianca = `1 fonte verificável encontrada. Confiança moderada.`;
  else if (count === 2) motivo_confianca = `2 fontes verificáveis encontradas. Confiança boa.`;
  else                motivo_confianca = `${count} fontes verificáveis encontradas. Confiança alta.`;

  if (modelName !== 'llama-3.3-70b-versatile') {
    motivo_confianca += ` (avaliado com modelo de fallback: ${modelName})`;
  }

  return { confianca, motivo_confianca };
}

// ─── API Setup ────────────────────────────────────────────────────────────────

const AI_URL    = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_KEY  = (process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '').replace(/^YOUR_.*_KEY$/, '');
const SERPER_KEY      = process.env.SERPER_API_KEY;
const TAVILY_KEY      = process.env.TAVILY_API_KEY;
const GOOGLE_CSE_KEY  = process.env.GOOGLE_CSE_KEY;
const GOOGLE_CSE_CX   = process.env.GOOGLE_CSE_CX;

let searchCallCount = 0;

function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

// ─── Search Engines ───────────────────────────────────────────────────────────

async function searchWithSerper(query) {
  if (!SERPER_KEY) return [];
  try {
    const response = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
      body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br', num: 6 }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.organic || []).map(r => ({
      descricao: r.snippet || '',
      fonte: r.source || extractHostname(r.link) || '',
      url: r.link || '',
      data: r.date || null,
    }));
  } catch { return []; }
}

async function searchWithTavily(query) {
  if (!TAVILY_KEY) return [];
  try {
    const response = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query,
        search_depth: 'advanced',
        max_results: 6,
        include_domains: TAVILY_DOMAINS,
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(r => ({
      descricao: r.content || '',
      fonte: extractHostname(r.url) || '',
      url: r.url || '',
      data: r.published_date || null,
    }));
  } catch { return []; }
}

async function searchWithGoogle(query) {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_CX) return [];
  try {
    const response = await fetchWithTimeout(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_KEY}&cx=${GOOGLE_CSE_CX}&q=${encodeURIComponent(query)}&gl=br&hl=pt&num=6`,
    );
    const data = await response.json();
    if (!data.items) return [];
    return data.items.map(r => ({
      descricao: r.snippet || '',
      fonte: r.displayLink || '',
      url: r.link || '',
      data: null,
    }));
  } catch { return []; }
}

async function searchEvidence(query) {
  searchCallCount++;
  const engines = [searchWithTavily, searchWithGoogle, searchWithSerper];
  const startIndex = searchCallCount % engines.length;
  const rotated = [...engines.slice(startIndex), ...engines.slice(0, startIndex)];

  let results = [];
  for (const engine of rotated) {
    results = await engine(query);
    if (results.length > 0) break;
  }

  // If primary rotation returned nothing, try remaining engines
  if (results.length === 0) {
    for (const engine of engines) {
      results = await engine(query);
      if (results.length > 0) break;
    }
  }

  return results;
}

// ─── Query Builder ────────────────────────────────────────────────────────────

/**
 * Build an enriched, context-aware search query.
 * E.g. "Eduardo Braide prefeito MA 2021 hospital inaugurado OR entregue OR cumprido"
 */
function buildSearchQuery(promise, customTitle) {
  const title  = customTitle || promise.promise_title || '';
  const name   = promise.politician_name || '';
  const cargo  = promise.role || promise.cargo || '';
  const state  = promise.state || '';
  const city   = promise.city || promise.cidade || '';
  const year   = promise.created_at
    ? new Date(promise.created_at).getFullYear()
    : '';

  const locationParts = [city, state].filter(Boolean).join(' ');
  const actionTerms   = 'cumprido OR inaugurado OR entregue OR realizado OR "obra concluída"';

  const parts = [
    `"${name}"`,
    cargo,
    locationParts,
    year,
    title.substring(0, 50),
    actionTerms,
  ].filter(Boolean);

  return parts.join(' ');
}

// ─── Batch Keyword Extraction (external use) ─────────────────────────────────

export async function batchExtractKeywords(promises) {
  const map = {};
  if (!GROQ_KEY) {
    promises.forEach(p => { map[p.id] = buildSearchQuery(p); });
    return map;
  }

  for (let i = 0; i < promises.length; i += 5) {
    const batch = promises.slice(i, i + 5);
    const prompt = `Extraia 2 a 3 palavras-chave de cada promessa abaixo para busca no Google. Responda SOMENTE JSON: {"keywords": ["kw1 kw2", "kw3 kw4", ...]}\n\n${
      batch.map((p, idx) => `${idx + 1}. "${p.promise_title}"`).join('\n')
    }`;

    try {
      const gr = await fetchWithTimeout(`${AI_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 200,
        }),
      }, 10000);
      if (!gr.ok) throw new Error(`Groq ${gr.status}`);
      const data = await gr.json();
      const kwList = JSON.parse(data.choices[0].message.content).keywords;
      batch.forEach((p, idx) => {
        map[p.id] = `"${p.politician_name}" ${kwList[idx] || title.substring(0, 40)} ${p.state || ''} cumprido OR inaugurado`;
      });
    } catch {
      batch.forEach(p => { map[p.id] = buildSearchQuery(p); });
    }
  }

  return map;
}

// ─── AI Call with Model Cascade ───────────────────────────────────────────────

/**
 * Call the Groq API trying models in cascade order.
 * Returns { parsed, modelUsed } or throws if all models fail.
 */
async function callAIWithCascade(prompt) {
  for (const model of MODEL_CASCADE) {
    const retryDelays = [600, 1500, 3000];
    let lastStatus = null;

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      let groqRes;
      try {
        groqRes = await fetchWithTimeout(`${AI_URL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 1500,
          }),
        }, 12000);
      } catch (fetchErr) {
        // Network timeout or abort — try next model immediately
        console.error(`[cascade] ${model} fetch error attempt ${attempt}: ${fetchErr.message}`);
        lastStatus = 'fetch_error';
        break;
      }

      if (groqRes.ok) {
        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty response from model');
        const parsed = JSON.parse(content);
        return { parsed, modelUsed: model };
      }

      lastStatus = groqRes.status;

      if (groqRes.status === 429) {
        // Rate limited on this model — wait then retry; if last attempt, fall to next model
        if (attempt < retryDelays.length) {
          const retryAfter = groqRes.headers.get('retry-after');
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : retryDelays[attempt];
          console.warn(`[cascade] ${model} rate-limited (429), attempt ${attempt + 1}/${retryDelays.length} — waiting ${waitMs}ms`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        // Exhausted retries for this model, try next
        console.warn(`[cascade] ${model} rate-limited — moving to next model`);
        break;
      }

      // Non-429 error: skip model immediately
      console.error(`[cascade] ${model} error ${groqRes.status} — moving to next model`);
      break;
    }
  }

  throw new Error('All models in cascade failed (rate-limits or errors)');
}

// ─── Main Evaluation Function ─────────────────────────────────────────────────

export async function evaluateWithAI(promise, preExtractedQuery) {
  const originalStatus = promise.status || 'pendente';
  const originalScore  = promise.fulfillment_score ?? 20;
  const title          = promise.promise_title || '';

  // 1. Source link as first low-priority evidence
  const sourceEvidence = [];
  if (promise.source_link && !isPlaceholder(promise.source_link)) {
    sourceEvidence.push({
      descricao: 'Fonte original da promessa',
      fonte: extractHostname(promise.source_link),
      url: promise.source_link,
      data: null,
    });
  }

  // 2. Build enriched query and search
  const query = preExtractedQuery || buildSearchQuery(promise);
  const searchResults = await searchEvidence(query);

  // 3. Deduplicate + filter social media + filter placeholders
  const seenUrls = new Set();
  const realEvidences = [];

  for (const ev of [...searchResults, ...sourceEvidence]) {
    if (!ev.url || isPlaceholder(ev.url) || isSocialMedia(ev.url)) continue;
    if (seenUrls.has(ev.url)) continue;
    seenUrls.add(ev.url);
    realEvidences.push(ev);
  }

  // === CRITICAL: never pass placeholder to model ===
  // hasRealEvidence drives the JS-level score cap below
  const hasRealEvidence = realEvidences.length > 0;

  // 4. Build evidence text for prompt (only real evidence)
  const evText = hasRealEvidence
    ? realEvidences
        .map(e => `[${e.fonte}]: ${(e.descricao || '').substring(0, 500)} (${e.url})`)
        .join('\n')
        .substring(0, 14000)
    : 'Nenhuma evidência verificável encontrada após busca automática na web.';

  // 5. Context for prompt
  const cargoInfo  = promise.role   || promise.cargo   || 'não informado';
  const estadoInfo = [promise.city || promise.cidade, promise.state].filter(Boolean).join(' — ') || 'não informado';
  const anoInfo    = promise.created_at
    ? new Date(promise.created_at).getFullYear()
    : 'não informado';

  const noEvidenceWarning = !hasRealEvidence
    ? '\n⚠️ IMPORTANTE: Não foram encontradas evidências verificáveis. Neste caso, o score DEVE ser no máximo 25 e o status DEVE ser "pendente". Não invente informações.'
    : '';

  const prompt = `Você é um avaliador independente e rigoroso de promessas políticas brasileiras.

POLÍTICO: ${promise.politician_name || ''}
CARGO: ${cargoInfo}
LOCAL: ${estadoInfo}
ANO DA PROMESSA: ${anoInfo}
PROMESSA AVALIADA: "${title}"

EVIDÊNCIAS ENCONTRADAS NA WEB:
${evText}
${noEvidenceWarning}

Com base NAS EVIDÊNCIAS ACIMA APENAS, avalie a promessa e responda SOMENTE com este JSON (sem comentários):
{
  "status": "cumprida|parcial|pendente|quebrada",
  "fulfillment_score": <número 0–100>,
  "justificativa": "<explicação detalhada, mínimo 60 palavras, citando as fontes encontradas e o que foi ou não foi feito>",
  "o_que_foi_feito": "<descreva concretamente o que já foi realizado ou entregue, mínimo 30 palavras>",
  "o_que_falta": "<descreva o que ainda precisa acontecer para cumprir a promessa, mínimo 20 palavras>",
  "complexity": <1, 2 ou 3>,
  "impact": <1, 2 ou 3>
}

REGRAS DE AVALIAÇÃO (OBRIGATÓRIAS):
- cumprida (80–100): evidência verificável de conclusão com URL real
- parcial (40–79): progresso concreto mas incompleto, com URL real
- pendente (0–39): pouco ou nenhum progresso demonstrado
- quebrada (0): ação contrária à promessa, ou prazo expirado sem entrega
- SEM evidência com URL real → score MÁXIMO 25, status "pendente", não invente fatos
- Não cite fontes que não apareçam acima como evidência

COMPLEXIDADE (1–3):
1 = Declaração genérica, sem métrica ou prazo definido
2 = Meta com indicador mensurável
3 = Meta com métricas, prazos e impacto estruturante

IMPACTO (1–3):
1 = Localizado, afeta grupo restrito
2 = Abrangente, afeta setor ou região
3 = Estruturante, afeta toda a população`;

  // 6. Call AI with model cascade
  let parsed = null;
  let modelUsed = null;
  let usedFallback = false;

  try {
    if (!GROQ_KEY) throw new Error('GROQ_API_KEY not configured');
    const result = await callAIWithCascade(prompt);
    parsed    = result.parsed;
    modelUsed = result.modelUsed;
  } catch (err) {
    console.error(`[evaluateWithAI] All models failed for "${title.substring(0, 40)}": ${err.message}`);
    usedFallback = true;
  }

  // 7. Fallback: return original status/score + all gathered evidence (real only)
  if (usedFallback || !parsed) {
    const clampedScore    = clampScore(originalStatus, originalScore);
    const mappedFallback  = mapStatusToFrontend(originalStatus);
    const { confianca, motivo_confianca } = computeConfidence(realEvidences, 'fallback');

    return {
      status:               mappedFallback,
      fulfillment_score:    clampedScore,
      justification:        'Avaliação automática indisponível no momento. Serviço de IA temporariamente limitado.',
      o_que_foi_feito:      'Aguardando reavaliação pela IA na próxima execução.',
      o_que_falta:          'Reavaliação completa via IA na próxima execução.',
      evidences:            realEvidences,     // real URLs only — never '#'
      complexity:           1,
      impact:               1,
      confianca,
      motivo_confianca,
      modelo_ia:            'fallback',
      evaluated_with_fallback: true,
    };
  }

  // 8. Map + clamp status and score
  const mappedStatus = mapStatusToFrontend(parsed.status);
  let score = clampScore(mappedStatus, parsed.fulfillment_score ?? 20);

  // === JS-LEVEL SCORE CAP: enforce ≤ 25 when no real evidence ===
  if (!hasRealEvidence) {
    score = Math.min(score, 25);
    // Also prevent "cumprida"/"parcial" without evidence
    if (mappedStatus === 'cumprida' || mappedStatus === 'parcial') {
      parsed.status = 'pendente';
    }
  }

  const finalStatus = hasRealEvidence ? mappedStatus : 'pendente';

  // 9. Compute confidence
  const { confianca, motivo_confianca } = computeConfidence(realEvidences, modelUsed);

  // 10. Build complete output — all fields the frontend/DB needs
  return {
    status:               finalStatus,
    fulfillment_score:    score,
    justification:        (parsed.justificativa || '').trim(),
    o_que_foi_feito:      (parsed.o_que_foi_feito || '').trim(),
    o_que_falta:          (parsed.o_que_falta || '').trim(),
    evidences:            realEvidences,     // real URLs only — never '#'
    complexity:           Math.max(1, Math.min(3, Math.round(parsed.complexity || 1))),
    impact:               Math.max(1, Math.min(3, Math.round(parsed.impact || 1))),
    confianca,
    motivo_confianca,
    modelo_ia:            modelUsed,
    search_query_used:    query,             // for debugging / audit
    evaluated_with_fallback: false,
  };
}
