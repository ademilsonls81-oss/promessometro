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
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url.split('/')[2]?.replace('www.', '') || '';
  }
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

function parseSerperDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date().toISOString();
  const lower = dateStr.toLowerCase();
  if (lower.includes('ago') || lower.includes('days') || lower.includes('months') || lower.includes('year') || lower.includes('hours')) {
    return new Date().toISOString();
  }
  const ptMonths = { 'jan': 'Jan', 'fev': 'Feb', 'mar': 'Mar', 'abr': 'Apr', 'mai': 'May', 'jun': 'Jun', 'jul': 'Jul', 'ago': 'Aug', 'set': 'Sep', 'out': 'Oct', 'nov': 'Nov', 'dez': 'Dec' };
  const monthMatch = dateStr.match(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i);
  if (monthMatch) {
    const en = ptMonths[monthMatch[1].toLowerCase()];
    if (en) {
      const replaced = dateStr.replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi, en);
      const parsed = new Date(replaced);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

export { filterSocialMedia, mapStatusToFrontend };

export async function evaluateWithAI(promise) {
  const apiKeyRaw = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
  const apiKey = apiKeyRaw.replace(/^YOUR_.*_KEY$/, '');
  const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
  const SERPER_API_KEY = process.env.SERPER_API_KEY;
  const originalStatus = promise.status || 'pendente';
  const originalScore = promise.fulfillment_score ?? 20;

  const evidences = [];
  if (promise.source_link) {
    evidences.push({ descricao: `Fonte original da promessa`, fonte: extractHostname(promise.source_link), url: promise.source_link });
  }

  if (SERPER_API_KEY) {
    try {
      const queries = [
        `"${promise.politician_name}" "${promise.promise_title?.substring(0, 50)}"`,
        `${promise.politician_name} ${promise.promise_title?.substring(0, 40)} resultado`
      ];
      for (const query of queries) {
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_API_KEY },
          body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br', num: 5 })
        });
        if (res.ok) {
          const d = await res.json();
          const results = (d.organic || [])
            .filter(r => !isSocialMedia(r.link || ''))
            .map(r => ({
              descricao: r.snippet || '',
              fonte: r.source || extractHostname(r.link) || '',
              url: r.link || '',
              data: parseSerperDate(r.date)
            }));
          evidences.push(...results);
        }
      }
    } catch (_) { }
  }

  const seenDomains = new Set();
  const dedupedEvidences = evidences.filter(ev => {
    if (!ev.url) return false;
    if (isSocialMedia(ev.url)) return false;
    const domain = getUrlDomain(ev.url);
    if (!domain || seenDomains.has(domain)) return false;
    seenDomains.add(domain);
    return true;
  });

  if (dedupedEvidences.length === 0) {
    dedupedEvidences.push({
      fonte: "Ausência de Evidências",
      descricao: "Nenhuma evidência ou notícia encontrada na web após varredura automática.",
      url: "#"
    });
  }

  const evText = dedupedEvidences.length > 0
    ? dedupedEvidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url})`).join('\n')
    : 'Nenhuma evidência encontrada.';

  const prompt = `Você é um avaliador independente de promessas políticas brasileiras. Analise com rigor.

PROMESSA: "${promise.promise_title}"
POLÍTICO: ${promise.politician_name}

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
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');
    const groqRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1024
      })
    });
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
      impact: Math.max(1, Math.min(3, Math.round(parsed.impact || 1)))
    };
  } catch (err) {
    const clampedScore = clampScore(originalStatus, originalScore);
    const mappedFallback = mapStatusToFrontend(originalStatus);
    return {
      status: mappedFallback,
      fulfillment_score: clampedScore,
      justification: `Avaliação baseada no status registrado (${originalStatus}). Sem acesso à IA neste momento: ${err.message}. Reavaliação será feita na próxima execução.`,
      o_que_foi_feito: 'Aguardando reavaliação pela IA na próxima execução do ciclo.',
      o_que_falta: 'Reavaliação completa via IA na próxima execução.',
      evidences: dedupedEvidences,
      complexity: 1,
      impact: 1
    };
  }
}
