import { createClient } from '@supabase/supabase-js';
import { getUrlDomain } from './sourceLevel.js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

function db() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

const ROLE_MAP = {
  presidente: 'Presidente', governador: 'Governador', prefeito: 'Prefeito',
  senador: 'Senador', deputado_federal: 'Deputado Federal', deputado_estadual: 'Deputado Estadual',
  // Also accept already-mapped values
  'Presidente': 'Presidente', 'Governador': 'Governador', 'Prefeito': 'Prefeito',
  'Senador': 'Senador', 'Deputado Federal': 'Deputado Federal', 'Deputado Estadual': 'Deputado Estadual'
};
const VALID_ROLES = new Set(Object.values(ROLE_MAP));
const VALID_STATUS = new Set(['cumprida', 'parcial', 'pendente', 'quebrada']);

// Redes sociais proibidas como evidência
const SOCIAL_BLOCKED = ['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com'];

// Critérios de herança automática rejeitados
const HERANCA_PATTERNS = ['batch-heranca', 'autonomous_seed', 'evidence_based_fallback'];

function normStatus(s) {
  if (!s) return 'pendente';
  const map = { 'parcialmente_cumprida': 'parcial', 'em_andamento': 'parcial',
    'nao_iniciada': 'pendente', 'nao_classificada': 'pendente', 'descumprida': 'quebrada' };
  return map[s] || s;
}

function calcC1(cumpridas, parciais, total) {
  return total > 0 ? parseFloat(((cumpridas * 1.0 + parciais * 0.5) / total * 100).toFixed(1)) : 0;
}

// =================== FÓRMULA UNIFICADA DE NOTA FINAL ===================
// IMPORTANTE: Esta função deve ser idêntica ao cálculo em api/index.js
function calcFinalScore(c1, c2, c3) {
  const w1 = 0.40, w2 = 0.35, w3 = 0.25;
  let pesoTotal = w1;
  let scorePonderado = c1 * w1;
  if (c2 != null) { scorePonderado += c2 * w2; pesoTotal += w2; }
  if (c3 != null) { scorePonderado += c3 * w3; pesoTotal += w3; }
  let finalScore = pesoTotal > 0 ? parseFloat((scorePonderado / pesoTotal).toFixed(1)) : 0;
  // Regra: se C3 < 20, nota máxima é C (< 60)
  if (c3 != null && c3 < 20) finalScore = Math.min(finalScore, 59);
  return finalScore;
}
// ======================================================================

const PALAVRAS_PROIBIDAS = [
  'Aguardando dados', 'IA falhou', 'Avaliacao herdada',
  'Nenhuma avaliação detalhada disponível', 'Reavaliacao automatica',
  'Herdado do status original', 'Avaliação automática via pipeline',
  'Avaliacao automatica', 'Análise IA.'
];

function contemPalavraProibida(texto) {
  if (!texto) return true;
  if (texto.trim().length < 20) return true;
  return PALAVRAS_PROIBIDAS.some(p => texto.includes(p));
}

async function checkUrl(url) {
  if (!url) return false;
  // Tenta HEAD primeiro; se falhar, tenta GET com range mínimo
  for (const method of ['HEAD', 'GET']) {
    try {
      const opts = { method, signal: AbortSignal.timeout(8000) };
      if (method === 'GET') opts.headers = { Range: 'bytes=0-0' };
      const res = await fetch(url, opts);
      if (res.ok || res.status === 206) return true;
    } catch {}
  }
  return false;
}

function isSocialMedia(url) {
  const domain = getUrlDomain(url);
  if (!domain) return false;
  return SOCIAL_BLOCKED.some(s => domain === s || domain.endsWith('.' + s));
}

function isHerancaAutomatica(criterioAplicado) {
  if (!criterioAplicado) return false;
  return HERANCA_PATTERNS.some(p => criterioAplicado.includes(p));
}

const ALL_CRITERIA = [
  // === BLOCO A: Dados Cadastrais ===
  { id: 'A1', bloco: 'A', descricao: 'Nome completo preenchido',
    check: (p) => !!(p.name && p.name.trim().length > 3) },

  { id: 'A2', bloco: 'A', descricao: 'Cargo preenchido e válido',
    check: (p) => {
      if (!p.role) return false;
      const normalized = ROLE_MAP[p.role.toLowerCase()] || ROLE_MAP[p.role] || p.role;
      return VALID_ROLES.has(normalized);
    }
  },

  { id: 'A3', bloco: 'A', descricao: 'Estado/região preenchido',
    check: (p) => !!(p.state && p.state.trim().length >= 2) },

  { id: 'A4', bloco: 'A', descricao: 'Partido preenchido',
    check: (p) => !!(p.party && p.party.trim().length > 0) },

  { id: 'A5', bloco: 'A', descricao: 'Foto cadastrada e acessível',
    check: async (p) => p.photo_url ? await checkUrl(p.photo_url) : false },

  // FIX A6: Antes hardcoded `false`. Agora: político tem nota final calculada (avaliado pelo sistema)
  { id: 'A6', bloco: 'A', descricao: 'Avaliado pelo sistema (nota calculada)',
    check: (p) => p.final_score != null && p.grade != null },

  // === BLOCO B: Promessas (C1) ===
  { id: 'B1', bloco: 'B', descricao: 'Mínimo 5 promessas cadastradas',
    check: (p, ctx) => (ctx.promises || []).length >= 5 },

  { id: 'B2', bloco: 'B', descricao: 'Nenhuma promessa com status nulo',
    check: (p, ctx) => (ctx.promises || []).every(pp => pp.status && VALID_STATUS.has(normStatus(pp.status))) },

  { id: 'B3', bloco: 'B', descricao: 'Nenhuma promessa com score nulo',
    check: (p, ctx) => (ctx.explanations || []).every(e => e.fulfillment_score != null && e.fulfillment_score >= 0 && e.fulfillment_score <= 100) },

  { id: 'B4', bloco: 'B', descricao: 'Score compatível com status',
    check: (p, ctx) => (ctx.explanations || []).every(e => {
      const s = normStatus(e.status), sc = e.fulfillment_score;
      if (s === 'cumprida') return sc >= 75 && sc <= 100;
      if (s === 'parcial') return sc >= 40 && sc <= 74;
      if (s === 'pendente') return sc >= 0 && sc <= 39;
      if (s === 'quebrada') return sc === 0;
      return true;
    })
  },

  { id: 'B5', bloco: 'B', descricao: 'Justificativa real preenchida (sem placeholder)',
    check: (p, ctx) => (ctx.explanations || []).every(e => e.justificativa && e.justificativa.length > 30 && !contemPalavraProibida(e.justificativa)) },

  { id: 'B6', bloco: 'B', descricao: 'O que foi concluído preenchido e real',
    check: (p, ctx) => (ctx.explanations || []).every(e => e.o_que_foi_feito && e.o_que_foi_feito.length > 10 && !contemPalavraProibida(e.o_que_foi_feito)) },

  { id: 'B7', bloco: 'B', descricao: 'O que ainda falta preenchido',
    check: (p, ctx) => (ctx.explanations || []).every(e => e.o_que_falta && e.o_que_falta.length > 5 && !contemPalavraProibida(e.o_que_falta)) },

  { id: 'B8', bloco: 'B', descricao: 'Mínimo 2 evidências por promessa Cumprida',
    check: (p, ctx) => (ctx.explanations || []).filter(e => normStatus(e.status) === 'cumprida').every(e => (e.evidencias_usadas || []).length >= 2) },

  { id: 'B9', bloco: 'B', descricao: 'Mínimo 2 evidências por promessa Parcial',
    check: (p, ctx) => (ctx.explanations || []).filter(e => normStatus(e.status) === 'parcial').every(e => (e.evidencias_usadas || []).length >= 2) },

  { id: 'B10', bloco: 'B', descricao: 'Mínimo 1 evidência por promessa Pendente',
    check: (p, ctx) => (ctx.explanations || []).filter(e => normStatus(e.status) === 'pendente').every(e => (e.evidencias_usadas || []).length >= 1) },

  // FIX B11: Lógica de verificação de redes sociais usando função centralizada
  { id: 'B11', bloco: 'B', descricao: 'Nenhuma evidência de rede social (Instagram, Facebook, TikTok, Twitter/X)',
    check: (p, ctx) => (ctx.explanations || []).every(e => (e.evidencias_usadas || []).every(ev => !isSocialMedia(ev.url))) },

  { id: 'B12', bloco: 'B', descricao: 'Domínios únicos por promessa',
    check: (p, ctx) => (ctx.explanations || []).every(e => {
      const dominios = (e.evidencias_usadas || []).map(ev => getUrlDomain(ev.url)).filter(Boolean);
      return new Set(dominios).size === dominios.length;
    })
  },

  // FIX B13: Aceitar 'pipeline_auto_evaluation', 'daily_reavaliation_v1', 'ai_reavaliation_v1' — rejeitar apenas herança
  { id: 'B13', bloco: 'B', descricao: 'Avaliação por IA (não herança automática)',
    check: (p, ctx) => (ctx.explanations || []).every(e => !isHerancaAutomatica(e.criterio_aplicado)) },

  { id: 'B14', bloco: 'B', descricao: 'C1 calculado corretamente',
    check: (p, ctx) => {
      if (!p.c1_score && p.c1_score !== 0) return false; // precisa ter sido calculado
      const f = (ctx.explanations || []).filter(e => normStatus(e.status) === 'cumprida').length;
      const pa = (ctx.explanations || []).filter(e => normStatus(e.status) === 'parcial').length;
      const total = (ctx.promises || []).length;
      const esperado = calcC1(f, pa, total);
      return Math.abs(esperado - (p.c1_score || 0)) <= 1.0; // tolerância de 1 ponto
    }
  },

  // === BLOCO C: Indicadores (C2) ===
  { id: 'C1', bloco: 'C', descricao: 'Todas as 3 categorias de indicadores populadas',
    tipo: 'indicadores', check: (p, ctx) => {
      const cats = new Set((ctx.indicators || []).map(i => i.category));
      return cats.has('seguranca') && cats.has('financas') && cats.has('funcionalismo');
    }
  },

  { id: 'C2', bloco: 'C', descricao: 'Mínimo 8 indicadores com score (de 9 esperados)',
    tipo: 'indicadores', check: (p, ctx) => {
      const nomes = new Set((ctx.indicators || []).map(i => i.name));
      const esperados = ['taxa_homicidios', 'policiamento', 'investimento_seguranca', 'receita_corrente', 'divida_publica', 'investimento', 'investimento_publico', 'servidores', 'gasto_folha'];
      const found = esperados.filter(n => nomes.has(n));
      return found.length >= 7 && (ctx.indicators || []).every(i => i.score != null && i.score >= 0 && i.score <= 100);
    }
  },

  { id: 'C3', bloco: 'C', descricao: 'C2 calculado corretamente',
    tipo: 'indicadores', check: (p, ctx) => {
      const catWeights = { seguranca: 0.30, financas: 0.40, funcionalismo: 0.30 };
      const catScores = { seguranca: [], financas: [], funcionalismo: [] };
      (ctx.indicators || []).forEach(i => { if (i.score != null && catScores[i.category]) catScores[i.category].push(i.score); });
      let wSum = 0, sSum = 0;
      for (const [cat, scores] of Object.entries(catScores)) {
        if (scores.length > 0) { const avg = scores.reduce((a, b) => a + b, 0) / scores.length; sSum += avg * (catWeights[cat] || 0); wSum += catWeights[cat] || 0; }
      }
      const esperado = wSum > 0 ? parseFloat((sSum / wSum).toFixed(1)) : null;
      if (esperado == null && p.c2_score == null) return true;
      if (esperado == null || p.c2_score == null) return false;
      return Math.abs(esperado - p.c2_score) <= 1.0; // tolerância de 1 ponto
    }
  },

  { id: 'C4', bloco: 'C', descricao: 'Nenhum indicador suspeito (todos score=50)',
    tipo: 'indicadores', check: (p, ctx) => (ctx.indicators || []).length === 0 || !(ctx.indicators || []).every(i => i.score === 50) },

  // === BLOCO D: Fatos Jurídicos (C3) ===
  // FIX D1: Se não há legal_facts, c3 esperado = 100 (sem penalidades). Antes comparava null == null OK mas agora garante c3_score = 100
  { id: 'D1', bloco: 'D', descricao: 'C3 calculado corretamente',
    tipo: 'juridico', check: (p, ctx) => {
      const penaltyMap = { condemnation: 50, investigation: 20, alert: 10, irregularity: 5 };
      let esperado = 100; // Sem fatos jurídicos = score máximo (sem penalidades)
      if (ctx.legal_facts && ctx.legal_facts.length > 0) {
        (ctx.legal_facts || []).forEach(f => { if (f.is_active !== false) esperado -= penaltyMap[f.fact_type] || 0; });
        esperado = Math.max(0, esperado);
      }
      // Se c3_score ainda não foi calculado (null), falha — precisa ser calculado
      if (p.c3_score == null) return false;
      return Math.abs(esperado - p.c3_score) <= 1.0;
    }
  },

  { id: 'D2', bloco: 'D', descricao: 'Cada fato jurídico tem tipo válido',
    tipo: 'juridico', check: (p, ctx) => {
      const tipos = new Set(['condemnation', 'investigation', 'alert', 'irregularity']);
      return (ctx.legal_facts || []).every(f => f.fact_type && tipos.has(f.fact_type));
    }
  },

  { id: 'D3', bloco: 'D', descricao: 'Cada fato tem descrição',
    tipo: 'juridico', check: (p, ctx) => (ctx.legal_facts || []).every(f => f.description && f.description.trim().length > 0) },

  { id: 'D4', bloco: 'D', descricao: 'Cada fato tem fonte',
    tipo: 'juridico', check: (p, ctx) => (ctx.legal_facts || []).every(f => f.source && f.source.trim().length > 0) },

  { id: 'D5', bloco: 'D', descricao: 'Cada fato tem data',
    tipo: 'juridico', check: (p, ctx) => (ctx.legal_facts || []).every(f => f.date && !isNaN(new Date(f.date).getTime())) },

  { id: 'D6', bloco: 'D', descricao: 'C3 não é negativo',
    tipo: 'juridico', check: (p, ctx) => p.c3_score == null || p.c3_score >= 0 },

  // === BLOCO E: Nota Final ===
  // FIX E1: Fórmula idêntica à de index.js (calcFinalScore)
  { id: 'E1', bloco: 'E', descricao: 'Nota final calculada corretamente',
    tipo: 'final', check: (p, ctx) => {
      if (p.final_score == null) return false;
      const esperado = calcFinalScore(p.c1_score || 0, p.c2_score, p.c3_score);
      return Math.abs(esperado - (p.final_score || 0)) <= 1.0;
    }
  },

  { id: 'E2', bloco: 'E', descricao: 'Grade correta para o score',
    tipo: 'final', check: (p, ctx) => {
      if (!p.grade || p.final_score == null) return false;
      const fs = p.final_score || 0;
      const esperada = fs >= 80 ? 'A' : fs >= 60 ? 'B' : fs >= 40 ? 'C' : fs >= 20 ? 'D' : 'F';
      return p.grade === esperada;
    }
  },

  { id: 'E3', bloco: 'E', descricao: 'Se C3 < 20, nota máxima é C (score ≤ 59)',
    tipo: 'final', check: (p, ctx) => {
      if (p.c3_score != null && p.c3_score < 20) return (p.final_score || 0) <= 59;
      return true;
    }
  },
];

export async function runQualidadeAudit() {
  const { data: pols } = await db().from('politicians').select('id, name, slug, role, state, party, photo_url, c1_score, c2_score, c3_score, final_score, grade, last_evaluated_at');
  if (!pols) return [];

  const { data: allPromises } = await db().from('promises').select('id, politician_id, status');
  const { data: allExplanations } = await db().from('promise_explanations')
    .select('id, promise_id, status, fulfillment_score, evidencias_usadas, criterio_aplicado, justificativa, o_que_foi_feito, o_que_falta')
    .eq('is_latest', true);

  const result = [];

  for (const pol of pols) {
    const promises = (allPromises || []).filter(p => p.politician_id === pol.id);
    const promiseIds = new Set(promises.map(p => p.id));
    const explanations = (allExplanations || []).filter(e => promiseIds.has(e.promise_id));

    const { data: indicators } = await db().from('indicators').select('*').eq('politician_id', pol.id);
    const { data: legal_facts } = await db().from('legal_facts').select('*').eq('politician_id', pol.id);

    const ctx = { promises, explanations, indicators: indicators || [], legal_facts: legal_facts || [] };

    const criteriosOk = [];
    const criteriosFalhos = [];

    for (const c of ALL_CRITERIA) {
      let passou;
      try {
        const r = c.check(pol, ctx);
        passou = r instanceof Promise ? await r : r;
      } catch {
        passou = false;
      }
      if (passou) criteriosOk.push(c.id);
      else criteriosFalhos.push({ id: c.id, descricao: c.descricao });
    }

    const total = ALL_CRITERIA.length;
    const score = Math.round((criteriosOk.length / total) * 100);

    result.push({
      id: pol.slug || pol.id,
      nome: pol.name,
      status: score >= 85 ? 'verde' : score >= 70 ? 'amarelo' : 'vermelho',
      score_qualidade: score,
      criterios_ok: criteriosOk,
      criterios_falhos: criteriosFalhos,
      stats: {
        total_criterios: total,
        ok: criteriosOk.length,
        falhos: criteriosFalhos.length,
        total_promises: promises.length,
        total_explanations: explanations.length,
        total_indicators: (indicators || []).length,
        total_legal_facts: (legal_facts || []).length
      }
    });
  }

  // Ordenar: piores primeiro
  result.sort((a, b) => a.score_qualidade - b.score_qualidade);
  return result;
}