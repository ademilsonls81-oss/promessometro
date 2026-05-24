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

const STOPWORDS = new Set([
  'a','ao','aos','aquele','aqueles','as','até','com','como','da','das','de','dela','delas',
  'dele','deles','depois','do','dos','e','ela','elas','ele','eles','em','entre','era','eram',
  'essa','essas','esse','esses','esta','estas','este','estes','foi','foram','houver','isso',
  'isto','já','la','lhe','lhes','lo','mas','me','mesmo','meu','meus','minha','minhas','muito',
  'na','nas','nem','no','nos','nossa','nossas','nosso','nossos','num','numa','o','os','ou',
  'para','pela','pelas','pelo','pelos','por','qual','quando','que','quem','são','se','sem',
  'seu','seus','sido','só','sob','sobre','suas','tal','te','tem','têm','teu','teus','tive',
  'tiver','toda','todas','todo','todos','tu','tua','tuas','um','uma','umas','uns','vou'
]);

function extractKeywords(title) {
  if (!title) return '';
  const words = title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
  const seen = new Set();
  const unique = words.filter(w => { if (seen.has(w)) return false; seen.add(w); return true; });
  return unique.slice(0, 5).join(' ');
}

const METODOLOGIA_SOURCES = [
  'g1.globo.com', 'oglobo.globo.com', 'folha.uol.com.br', 'uol.com.br',
  'estadao.com.br', 'metropoles.com', 'cnnbrasil.com.br', 'noticias.uol.com.br',
  'correiobraziliense.com.br', 'agenciabrasil.ebc.com.br', 'veja.abril.com.br',
  'noticias.r7.com', 'congressoemfoco.uol.com.br', 'brasildefato.com.br',
  'portaldatransparencia.gov.br', 'www12.senado.leg.br', 'www.camara.leg.br',
  'www.planalto.gov.br'
];

export async function evaluateWithAI(promise) {
  const apiKeyRaw = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
  const apiKey = apiKeyRaw.replace(/^YOUR_.*_KEY$/, '');
  const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
  const SERPER_API_KEY = process.env.SERPER_API_KEY;
  const originalStatus = promise.status || 'pendente';
  const originalScore = promise.fulfillment_score ?? 20;
  const name = promise.politician_name || '';
  const title = promise.promise_title || '';
  const shortTitle = title.substring(0, 60);
  const keywords = extractKeywords(title);

  const evidences = [];
  if (promise.source_link) {
    evidences.push({ descricao: `Fonte original da promessa`, fonte: extractHostname(promise.source_link), url: promise.source_link });
  }

  try {
    const ddgQueries = [
      `${name} ${keywords}`,
    ];

    for (const q of ddgQueries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const params = new URLSearchParams({ q });
        const res = await fetch('https://lite.duckduckgo.com/lite/', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
          body: params.toString()
        });
        clearTimeout(timeout);
        const html = await res.text();
        const resultRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<td[^>]*class="result-snippet">(.*?)<\/td>/gi;
        let m;
        while ((m = resultRegex.exec(html)) !== null) {
          const url = m[1];
          const title = m[2].replace(/<[^>]+>/g, '').trim();
          const snippet = m[3].replace(/<[^>]+>/g, '').trim();
          if (title && url && !isSocialMedia(url)) {
            evidences.push({
              descricao: snippet,
              fonte: extractHostname(url),
              url,
              data: new Date().toISOString()
            });
          }
        }
      } catch (_) { clearTimeout(timeout); }
    }
  } catch (_) { }

  const seenUrls = new Set();
  const dedupedEvidences = evidences.filter(ev => {
    if (!ev.url || isSocialMedia(ev.url)) return false;
    if (seenUrls.has(ev.url)) return false;
    seenUrls.add(ev.url);
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

PROMESSA: "${title}"
POLÍTICO: ${name}

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
      impact: 1
    };
  }
}
