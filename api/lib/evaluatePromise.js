import { getUrlDomain } from './sourceLevel.js';

const SOCIAL_DOMAINS = ['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com'];

function isSocialMedia(url) {
  const domain = getUrlDomain(url);
  if (!domain) return false;
  return SOCIAL_DOMAINS.some(s => domain === s || domain.endsWith('.' + s));
}

function filterSocialMedia(evidences) {
  return (evidences || []).filter(ev => !isSocialMedia(ev.url));
}

const STATUS_CONFIG = {
  cumprida:             { min: 80, max: 100, base: 90 },
  parcialmente_cumprida: { min: 40, max: 79, base: 55 },
  em_andamento:         { min: 40, max: 79, base: 50 },
  nao_iniciada:         { min: 0,  max: 39, base: 20 },
  descumprida:          { min: 0,  max: 0,  base: 0  },
  nao_classificada:     { min: 0,  max: 39, base: 20 },
  pendente:             { min: 0,  max: 39, base: 20 },
  parcial:              { min: 40, max: 79, base: 55 },
  quebrada:             { min: 0,  max: 0,  base: 0  },
};

function extractHostname(url) {
  if (!url) return '';
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url.split('/')[2]?.replace('www.', '') || ''; }
}

function mapStatusToFrontend(aiStatus) {
  const map = {
    'cumprida': 'cumprida', 'parcialmente_cumprida': 'parcial',
    'em_andamento': 'parcial', 'nao_iniciada': 'pendente',
    'nao_classificada': 'pendente', 'pendente': 'pendente',
    'descumprida': 'quebrada', 'parcial': 'parcial', 'quebrada': 'quebrada'
  };
  return map[aiStatus] || 'pendente';
}

function clampScore(status, score) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  return Math.max(cfg.min, Math.min(cfg.max, Math.round(score)));
}

export { filterSocialMedia, mapStatusToFrontend };

const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_KEY = (process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '').replace(/^YOUR_.*_KEY$/, '');
const SERPER_KEY = process.env.SERPER_API_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY;
const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY;
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX;

let searchCallCount = 0;

function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function searchWithSerper(query) {
  if (!SERPER_KEY) return [];
  try {
    const response = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
      body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br', num: 5 })
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.organic || []).map(r => ({
      descricao: r.snippet || '',
      fonte: r.source || extractHostname(r.link) || '',
      url: r.link || ''
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
        max_results: 5,
        include_domains: ['g1.globo.com', 'folha.uol.com.br', 'estadao.com.br', 'in.gov.br']
      })
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(r => ({
      descricao: r.content || '',
      fonte: extractHostname(r.url) || '',
      url: r.url || ''
    }));
  } catch { return []; }
}

async function searchWithGoogle(query) {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_CX) return [];
  try {
    const response = await fetchWithTimeout(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_KEY}&cx=${GOOGLE_CSE_CX}&q=${encodeURIComponent(query)}&gl=br&hl=pt&num=5`
    );
    const data = await response.json();
    if (!data.items) return [];
    return data.items.map(r => ({
      descricao: r.snippet || '',
      fonte: r.displayLink || '',
      url: r.link || ''
    }));
  } catch { return []; }
}

async function searchEvidence(query) {
  searchCallCount++;

  const engines = [
    searchWithTavily,
    searchWithGoogle,
    searchWithSerper,
  ];

  const startIndex = searchCallCount % engines.length;
  const rotated = [...engines.slice(startIndex), ...engines.slice(0, startIndex)];

  let results = [];
  for (const engine of rotated) {
    results = await engine(query);
    if (results.length > 0) break;
  }

  if (results.length === 0) results = await searchWithTavily(query);

  return results;
}

export async function batchExtractKeywords(promises) {
  const map = {};
  if (!GROQ_KEY) {
    promises.forEach(p => { map[p.id] = `${p.politician_name} ${(p.promise_title || '').substring(0, 40)}`; });
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
          max_tokens: 200
        })
      }, 10000);
      if (!gr.ok) throw new Error(`Groq ${gr.status}`);
      const data = await gr.json();
      const kwList = JSON.parse(data.choices[0].message.content).keywords;
      batch.forEach((p, idx) => {
        map[p.id] = `${p.politician_name} ${kwList[idx] || (p.promise_title || '').substring(0, 40)}`;
      });
    } catch {
      batch.forEach(p => {
        map[p.id] = `${p.politician_name} ${(p.promise_title || '').substring(0, 40)}`;
      });
    }
  }

  return map;
}

export async function evaluateWithAI(promise, preExtractedQuery) {
  const originalStatus = promise.status || 'pendente';
  const originalScore = promise.fulfillment_score ?? 20;
  const title = promise.promise_title || '';
  const evidences = [];

  if (promise.source_link) {
    evidences.push({
      descricao: 'Fonte original da promessa',
      fonte: extractHostname(promise.source_link),
      url: promise.source_link
    });
  }

  const query = preExtractedQuery || `${promise.politician_name} ${title.substring(0, 40)}`;
  const searchResults = await searchEvidence(query);
  const filtered = searchResults.filter(r => !isSocialMedia(r.url));

  const seenUrls = new Set();
  const dedupedEvidences = filtered.filter(ev => {
    if (!ev.url || isSocialMedia(ev.url)) return false;
    if (seenUrls.has(ev.url)) return false;
    seenUrls.add(ev.url);
    return true;
  }).concat(evidences);

  if (dedupedEvidences.length === 0) {
    dedupedEvidences.push({
      fonte: 'Ausência de Evidências',
      descricao: 'Nenhuma evidência ou notícia encontrada na web após varredura automática.',
      url: '#'
    });
  }

  const evText = dedupedEvidences.length > 0
    ? dedupedEvidences.map(e => {
        const desc = (e.descricao || '').substring(0, 500);
        return `[${e.fonte}]: ${desc} (${e.url})`;
      }).join('\n').substring(0, 12000)
    : 'Nenhuma evidência encontrada.';

  const prompt = `Você é um avaliador independente de promessas políticas brasileiras. Analise com rigor.

PROMESSA: "${title}"
POLÍTICO: ${promise.politician_name || ''}

EVIDÊNCIAS ENCONTRADAS:
${evText}

Com base nas evidências acima, avalie a promessa e responda SOMENTE com este JSON:
{
  "status": "cumprida|parcial|pendente|quebrada",
  "fulfillment_score": número entre 0 e 100,
  "justificativa": "Explicação detalhada de mínimo 50 palavras citando as fontes encontradas e o que foi ou não foi feito",
  "o_que_foi_feito": "Descreva concretamente o que já foi realizado ou entregue até agora (mínimo 30 palavras)",
  "o_que_falta": "Descreva o que ainda precisa ser feito para cumprir completamente a promessa (mínimo 20 palavras)",
  "complexity": número de 1 a 3,
  "impact": número de 1 a 3
}

REGRAS DE AVALIAÇÃO:
- cumprida (80-100): evidência verificável de conclusão
- parcial (40-79): progresso concreto mas incompleto
- pendente (0-39): pouco ou nenhum progresso demonstrado
- quebrada (0): ação contrária à promessa ou prazo expirado sem entrega
- Sem evidência com URL real: máximo score 25, status pendente

COMPLEXIDADE (1-3):
1 = Simples: declaração genérica, sem métrica ou prazo
2 = Médio: meta definida com indicador mensurável
3 = Complexo: meta com métricas, prazos e impacto estruturante

IMPACTO (1-3):
1 = Baixo: localizado, afeta grupo restrito
2 = Médio: abrangente, afeta setor ou região
3 = Alto: estruturante, afeta toda a população`;

  try {
    if (!GROQ_KEY) throw new Error('GROQ_API_KEY not configured');
    const retryDelays = [500, 1000, 2000, 4000];
    let groqRes = null;
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      groqRes = await fetchWithTimeout(`${AI_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 1024
        })
      }, 8000);
      if (groqRes.ok) break;
      if (groqRes.status === 429 && attempt < retryDelays.length) {
        const delay = retryDelays[attempt];
        const retryAfter = groqRes.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : delay;
        console.error(`[evaluateWithAI] 429 tentativa ${attempt+1}/${retryDelays.length} — aguardando ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw new Error(`Groq ${groqRes.status}`);
    }
    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);
    const data = await groqRes.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    const mappedStatus = mapStatusToFrontend(parsed.status);
    const score = clampScore(mappedStatus, parsed.fulfillment_score);

    return {
      status: mappedStatus,
      fulfillment_score: score,
      justification: parsed.justificativa || '',
      o_que_foi_feito: parsed.o_que_foi_feito || '',
      o_que_falta: parsed.o_que_falta || '',
      evidences: dedupedEvidences,
      complexity: Math.max(1, Math.min(3, Math.round(parsed.complexity || 1))),
      impact: Math.max(1, Math.min(3, Math.round(parsed.impact || 1))),
      evaluated_with_fallback: false
    };
  } catch (err) {
    console.error(`[evaluateWithAI] Fallback para promessa "${(promise.promise_title||'').substring(0,40)}": ${err.message}`);
    const clampedScore = clampScore(originalStatus, originalScore);
    const mappedFallback = mapStatusToFrontend(originalStatus);
    return {
      status: mappedFallback,
      fulfillment_score: clampedScore,
      justification: 'Aguardando reavaliação por IA.',
      o_que_foi_feito: 'Aguardando reavaliação pela IA na próxima execução.',
      o_que_falta: 'Reavaliação completa via IA na próxima execução.',
      evidences: dedupedEvidences,
      complexity: 1,
      impact: 1,
      evaluated_with_fallback: true
    };
  }
}
