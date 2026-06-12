import { classifySource, getUrlDomain } from '../../api/lib/sourceLevel.js';

// Google Custom Search API (gratuito: 100 queries/dia)
// Configurar no .env: GOOGLE_API_KEY + GOOGLE_CX
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GOOGLE_CX = process.env.GOOGLE_CX || '';

interface PromiseData {
  id: string;
  politician_id?: string;
  politician_name?: string;
  promise_title?: string;
  status?: string;
  fulfillment_score?: number;
  source_link?: string;
  evidences_used?: any[];
  created_at?: string;
  category?: string;
}

interface Evidence {
  descricao: string;
  fonte: string;
  url: string;
  nivel: number;
  snippet?: string;
}

interface HeuristicResult {
  status: string;
  fulfillment_score: number;
  justification: string;
  o_que_foi_feito: string;
  o_que_falta: string;
  evidences: Evidence[];
  complexity: number;
  impact: number;
  confianca: number;
  motivo_confianca: string;
  modelo_ia: string;
  evaluated_with_fallback: boolean;
}

const STATUS_MAP: Record<string, string> = {
  cumprida: 'cumprida', parcialmente_cumprida: 'parcial', em_andamento: 'parcial',
  nao_iniciada: 'pendente', nao_classificada: 'pendente', pendente: 'pendente',
  descumprida: 'quebrada', parcial: 'parcial', quebrada: 'quebrada', nao_cumprida: 'quebrada',
};

function mapStatus(s: string): string {
  return STATUS_MAP[s] || 'pendente';
}

const POSITIVE_KW = [
  'inaugurado', 'inaugurada', 'entregue', 'entregues',
  'lançou', 'lançado', 'lançada', 'implementou', 'implementado', 'implementada',
  'criou', 'criado', 'criada', 'aprovou', 'aprovado', 'aprovada',
  'sancionou', 'sancionado', 'sancionada', 'assinou', 'assinado',
  'investiu', 'investido', 'concluiu', 'concluído', 'concluída',
  'finalizou', 'finalizado', 'implantou', 'implantado', 'implantada',
  'construiu', 'construído', 'construída', 'ampliou', 'ampliado', 'ampliada',
  'reformou', 'reformado', 'reformada', 'expandiu', 'expandido',
  'beneficiou', 'beneficiado', 'instalou', 'instalado', 'adquiriu', 'adquirido',
  'autorizou', 'autorizado',
];

const NEGATIVE_KW = [
  'não cumpriu', 'não foi', 'não houve', 'sem previsão', 'sem data',
  'atrasado', 'atrasada', 'suspenso', 'suspensa', 'cancelado', 'cancelada',
  'abandonado', 'abandonada', 'paralisado', 'paralisada',
  'descumpriu', 'descumprida', 'não entregou', 'não entregue',
  'sem recursos', 'congelado', 'congelada', 'contingenciado',
];

// Keywords no título que indicam estágio da promessa
const ACAO_INICIAL = /^(criar|implantar|implementar|elaborar|formular|estruturar|instituir|desenvolver|instalar)/i;
const ACAO_MEDIA = /^(ampliar|expandir|fortalecer|reformar|modernizar|capacitar|promover|apoiar|incentivar|fomentar|valorizar|requalificar)/i;
const ACAO_FINAL = /^(concluir|finalizar|entregar|inaugurar|universalizar|garantir|assegurar)/i;

async function searchGoogle(query: string): Promise<Evidence[]> {
  if (!GOOGLE_API_KEY || !GOOGLE_CX) return [];
  const out: Evidence[] = [];

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query.substring(0, 200))}&lr=lang_pt&num=8`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return out;

    const data = await r.json();
    for (const item of (data.items || [])) {
      const link = item.link || '';
      out.push({
        descricao: item.title || '',
        fonte: getUrlDomain(link) || '',
        url: link,
        nivel: classifySource(link),
        snippet: item.snippet || '',
      });
    }
  } catch {
    // Timeout ou erro
  }

  return out;
}

async function searchDDG(query: string): Promise<Evidence[]> {
  const q = query.substring(0, 200);
  const out: Evidence[] = [];

  try {
    const params = new URLSearchParams({ q });
    const r = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(6000),
    });

    if (r.status === 202 || r.status === 429) return out;
    if (!r.ok) return out;

    const html = await r.text();
    if (html.includes('challenge-form') || html.length < 200) return out;

    const patterns = [
      /<a rel="nofollow" class="result__a" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g,
      /<a[^>]+data-testid="result-title-a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
    ];

    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        const url = m[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
        const title = m[2].replace(/<[^>]+>/g, '').trim();
        if (title && url && !url.includes('duckduckgo') && !out.some(e => e.url === url)) {
          out.push({ descricao: title, fonte: getUrlDomain(url) || '', url, nivel: classifySource(url) });
        }
        if (out.length >= 8) break;
      }
      if (out.length > 0) break;
    }
  } catch {}

  return out;
}

async function searchWeb(query: string): Promise<Evidence[]> {
  // 1. Google Custom Search (se configurado)
  if (GOOGLE_API_KEY && GOOGLE_CX) {
    const results = await searchGoogle(query);
    if (results.length > 0) return results;
  }
  // 2. DuckDuckGo (fallback)
  return searchDDG(query);
}

function inferFromTitle(title: string): { fase: number; descricao: string } {
  if (!title) return { fase: 1, descricao: 'sem título' };
  const lc = title.trim();

  if (ACAO_FINAL.test(lc)) return { fase: 3, descricao: 'ação de conclusão' };
  if (ACAO_MEDIA.test(lc)) return { fase: 2, descricao: 'ação de fortalecimento' };
  if (ACAO_INICIAL.test(lc)) return { fase: 1, descricao: 'ação de criação' };
  return { fase: 2, descricao: 'ação mista' };
}

function matchKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter(kw => lower.includes(kw));
}

function computeScore(
  evidences: Evidence[],
  positiveMatches: string[],
  negativeMatches: string[],
  fase: number,
): { status: string; score: number; justificativa: string; o_que_foi_feito: string; o_que_falta: string } {
  const oficialCount = evidences.filter(e => e.nivel <= 2).length;
  const newsCount = evidences.filter(e => e.nivel === 3).length;
  const totalSources = evidences.length;

  // Sem evidências: usa heurística baseada no título
  if (totalSources === 0) {
    const msgs: Record<number, { score: number; just: string; feito: string; falta: string }> = {
      1: { score: 15, just: 'Promessa em estágio inicial. Nenhuma evidência de execução encontrada.', feito: 'Em fase de planejamento.', falta: 'Aguardar início da implementação.' },
      2: { score: 20, just: 'Promessa de médio prazo. Nenhuma evidência conclusiva de progresso.', feito: 'Sem informações concretas.', falta: 'Buscar fontes oficiais.' },
      3: { score: 25, just: 'Promessa com previsão de conclusão. Nenhuma evidência de entrega.', feito: 'Sem registros de conclusão.', falta: 'Verificar prazos.' },
    };
    const m = msgs[fase] || msgs[2];
    return { status: 'pendente', score: m.score, justificativa: m.just, o_que_foi_feito: m.feito, o_que_falta: m.falta };
  }

  const posCount = positiveMatches.length;
  const negCount = negativeMatches.length;

  const oficialBonus = oficialCount >= 2 ? 15 : oficialCount === 1 ? 10 : 0;
  const newsBonus = newsCount >= 3 ? 10 : newsCount >= 1 ? 5 : 0;
  const posScore = Math.min(posCount * 12, 40);
  const negScore = negCount * 15;
  const sourceBonus = Math.min(totalSources * 3, 10);

  let rawScore = 25 + oficialBonus + newsBonus + posScore + sourceBonus - negScore;
  rawScore = Math.max(0, Math.min(100, rawScore));

  let status: string, justificativa: string, o_que_foi_feito: string, o_que_falta: string;

  if (rawScore >= 80 && oficialCount >= 1 && posCount > negCount) {
    status = 'cumprida';
    justificativa = `Cumprida. ${oficialCount} fonte(s) oficial(is), ${newsCount} reportagem(ns). Termos: "${positiveMatches.slice(0, 4).join(', ')}".`;
    o_que_foi_feito = 'Promessa cumprida com evidências.';
    o_que_falta = 'Monitoramento contínuo.';
  } else if (rawScore >= 40 && totalSources >= 2) {
    status = 'parcial';
    justificativa = `Progresso parcial. ${oficialCount} fontes oficiais, ${newsCount} reportagens.${posCount > 0 ? ` Avanços: ${positiveMatches.slice(0, 3)}.` : ''}`;
    o_que_foi_feito = positiveMatches.length > 0 ? `Progressos: ${positiveMatches.slice(0, 5).join(', ')}.` : 'Evidências de progresso encontradas.';
    o_que_falta = 'Acompanhar conclusão.';
  } else if (negCount >= 2 && oficialCount >= 1) {
    status = 'quebrada';
    justificativa = `Descumprimento. Indicadores negativos: "${negativeMatches.slice(0, 4).join(', ')}".`;
    o_que_foi_feito = 'Promessa não cumprida.';
    o_que_falta = 'Reavaliar após posicionamento oficial.';
  } else {
    status = 'pendente';
    justificativa = `Pouco progresso. ${totalSources} fonte(s) sem evidências conclusivas.`;
    o_que_foi_feito = 'Nenhum progresso significativo.';
    o_que_falta = 'Aguardar execução.';
  }

  return { status, score: rawScore, justificativa, o_que_foi_feito, o_que_falta };
}

function computeConfidence(evidences: Evidence[]): { confianca: number; motivo_confianca: string } {
  const real = evidences.filter(e => e.url && e.url !== '#');
  const count = real.length;
  const oficialCount = real.filter(e => e.nivel <= 2).length;

  if (oficialCount >= 2 && count >= 3) return { confianca: 0.90, motivo_confianca: `${count} fontes, ${oficialCount} oficiais. Alta.` };
  if (oficialCount >= 1 && count >= 2) return { confianca: 0.80, motivo_confianca: `${count} fontes, incluindo oficial. Boa.` };
  if (count >= 2) return { confianca: 0.70, motivo_confianca: `${count} fontes. Moderada.` };
  if (count === 1) return { confianca: 0.50, motivo_confianca: '1 fonte. Baixa.' };
  return { confianca: 0.30, motivo_confianca: 'Nenhuma fonte. Baseado no texto da promessa.' };
}

export async function heuristicEvaluate(promise: PromiseData): Promise<HeuristicResult> {
  const start = Date.now();
  const nome = promise.politician_name || '';
  const titulo = promise.promise_title || '';

  const { fase } = inferFromTitle(titulo);

  // Busca na web (Google CX → DDG fallback)
  const query = `${nome} ${titulo.replace(/[,.:;!?()]/g, ' ').substring(0, 100)}`.replace(/\s+/g, ' ').trim().substring(0, 180);
  const evidences = await searchWeb(query);

  const combinedText = evidences.map(e => `${e.descricao || ''} ${e.snippet || ''}`).join(' ');
  const positiveMatches = matchKeywords(combinedText, POSITIVE_KW);
  const negativeMatches = matchKeywords(combinedText, NEGATIVE_KW);

  const { status, score, justificativa, o_que_foi_feito, o_que_falta } = computeScore(
    evidences, positiveMatches, negativeMatches, fase,
  );

  const { confianca, motivo_confianca } = computeConfidence(evidences);

  const elapsed = Date.now() - start;
  console.log(
    `[heuristicEval] "${titulo.substring(0, 35)}" → ${status} (${score}/100) | ` +
    `${evidences.length} fontes, ${positiveMatches.length} pos, ${negativeMatches.length} neg | ${elapsed}ms`,
  );

  return {
    status: mapStatus(status),
    fulfillment_score: score,
    justification: justificativa,
    o_que_foi_feito,
    o_que_falta,
    evidences,
    complexity: fase,
    impact: Math.min(fase + 1, 3),
    confianca,
    motivo_confianca,
    modelo_ia: 'heuristic-v1',
    evaluated_with_fallback: true,
  };
}
