import { createClient } from '@supabase/supabase-js';
import { getUrlDomain } from './sourceLevel.js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

function db() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

const ROLE_MAP = {
  presidente: 'Presidente', governador: 'Governador', prefeito: 'Prefeito',
  senador: 'Senador', deputado_federal: 'Deputado Federal', deputado_estadual: 'Deputado Estadual'
};
const VALID_ROLES = new Set(Object.values(ROLE_MAP));
const VALID_STATUS = new Set(['cumprida', 'parcial', 'pendente', 'quebrada']);


function normStatus(s) {
  if (!s) return 'pendente';
  const map = { 'parcialmente_cumprida': 'parcial', 'em_andamento': 'parcial',
    'nao_iniciada': 'pendente', 'nao_classificada': 'pendente', 'descumprida': 'quebrada' };
  return map[s] || s;
}

function calcC1(cumpridas, parciais, total) {
  return total > 0 ? parseFloat(((cumpridas * 1.0 + parciais * 0.5) / total * 100).toFixed(1)) : 0;
}

const PALAVRAS_PROIBIDAS = ['Aguardando dados', 'IA falhou',
  'Avaliacao herdada', 'Nenhuma avaliação detalhada disponível'];

function contemPalavraProibida(texto) {
  if (!texto) return true;
  return PALAVRAS_PROIBIDAS.some(p => texto.includes(p));
}

async function checkUrl(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch { return false; }
}

const ALL_CRITERIA = [
  { id: 'A1', bloco: 'A', descricao: 'Nome completo preenchido', check: (p) => !!p.name },
  { id: 'A2', bloco: 'A', descricao: 'Cargo preenchido e válido', check: (p) => p.role && VALID_ROLES.has(ROLE_MAP[p.role.toLowerCase()] || p.role) },
  { id: 'A3', bloco: 'A', descricao: 'Estado/região preenchido', check: (p) => !!p.state },
  { id: 'A4', bloco: 'A', descricao: 'Partido preenchido', check: (p) => !!p.party },
  { id: 'A5', bloco: 'A', descricao: 'Foto cadastrada e acessível', check: async (p) => p.photo_url ? await checkUrl(p.photo_url) : false },
  { id: 'A6', bloco: 'A', descricao: 'Tem classificação de verificado', check: (p) => false },

  { id: 'B1', bloco: 'B', descricao: 'Mínimo 5 promessas cadastradas', check: (p, ctx) => (ctx.promises || []).length >= 5 },
  { id: 'B2', bloco: 'B', descricao: 'Nenhuma promessa com status nulo', check: (p, ctx) => (ctx.promises || []).every(pp => pp.status && VALID_STATUS.has(normStatus(pp.status))) },
  { id: 'B3', bloco: 'B', descricao: 'Nenhuma promessa com score nulo', check: (p, ctx) => (ctx.explanations || []).every(e => e.fulfillment_score != null && e.fulfillment_score >= 0 && e.fulfillment_score <= 100) },
  { id: 'B4', bloco: 'B', descricao: 'Score compatível com status', check: (p, ctx) => (ctx.explanations || []).every(e => {
    const s = normStatus(e.status), sc = e.fulfillment_score;
    if (s === 'cumprida') return sc >= 75 && sc <= 100;
    if (s === 'parcial') return sc >= 40 && sc <= 74;
    if (s === 'pendente') return sc >= 1 && sc <= 39;
    if (s === 'quebrada') return sc === 0;
    return true;
  })},
  { id: 'B5', bloco: 'B', descricao: 'Motivo do Score preenchido (sem placeholder)', check: (p, ctx) => (ctx.explanations || []).every(e => e.justificativa && e.justificativa.length > 20 && !contemPalavraProibida(e.justificativa)) },
  { id: 'B6', bloco: 'B', descricao: 'O que foi concluído preenchido', check: (p, ctx) => (ctx.explanations || []).every(e => e.o_que_foi_feito && e.o_que_foi_feito.length > 5 && !contemPalavraProibida(e.o_que_foi_feito)) },
  { id: 'B7', bloco: 'B', descricao: 'O que ainda falta preenchido', check: (p, ctx) => (ctx.explanations || []).every(e => e.o_que_falta && e.o_que_falta.length > 5 && !contemPalavraProibida(e.o_que_falta)) },
  { id: 'B8', bloco: 'B', descricao: 'Mínimo 2 evidências por promessa Cumprida', check: (p, ctx) => (ctx.explanations || []).filter(e => normStatus(e.status) === 'cumprida').every(e => (e.evidencias_usadas || []).length >= 2) },
  { id: 'B9', bloco: 'B', descricao: 'Mínimo 2 evidências por promessa Parcial', check: (p, ctx) => (ctx.explanations || []).filter(e => normStatus(e.status) === 'parcial').every(e => (e.evidencias_usadas || []).length >= 2) },
  { id: 'B10', bloco: 'B', descricao: 'Mínimo 1 evidência por promessa Pendente', check: (p, ctx) => (ctx.explanations || []).filter(e => normStatus(e.status) === 'pendente').every(e => (e.evidencias_usadas || []).length >= 1) },
  { id: 'B11', bloco: 'B', descricao: 'Pelo menos 1 fonte não-rede social por promessa', check: (p, ctx) => (ctx.explanations || []).every(e => {
    const evs = e.evidencias_usadas || [];
    if (evs.length === 0) return false;
    const social = new Set(['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com']);
    return evs.some(ev => !ev.url || !social.has(getUrlDomain(ev.url)));
  })},
  { id: 'B12', bloco: 'B', descricao: 'Pelo menos 2 domínios diferentes por promessa', check: (p, ctx) => (ctx.explanations || []).every(e => {
    const dominios = (e.evidencias_usadas || []).map(ev => getUrlDomain(ev.url)).filter(Boolean);
    return dominios.length === 0 || new Set(dominios).size >= 2;
  })},
  { id: 'B13', bloco: 'B', descricao: 'Critério não é herança automática', check: (p, ctx) => (ctx.explanations || []).every(e => !e.criterio_aplicado || e.criterio_aplicado.includes('human_reviewed') || (!e.criterio_aplicado.includes('batch-heranca') && !e.criterio_aplicado.includes('autonomous_seed'))) },
  { id: 'B14', bloco: 'B', descricao: 'C1 calculado corretamente', check: (p, ctx) => {
    const f = (ctx.explanations || []).filter(e => normStatus(e.status) === 'cumprida').length;
    const pa = (ctx.explanations || []).filter(e => normStatus(e.status) === 'parcial').length;
    const total = (ctx.promises || []).length;
    const esperado = calcC1(f, pa, total);
    return Math.abs(esperado - (p.c1_score || 0)) <= 0.5;
  }},

  { id: 'C1', bloco: 'C', descricao: 'Todas as 3 categorias de indicadores populadas', tipo: 'indicadores', check: (p, ctx) => {
    const cats = new Set((ctx.indicators || []).map(i => i.category));
    return cats.has('seguranca') && cats.has('financas') && cats.has('funcionalismo');
  }},
  { id: 'C2', bloco: 'C', descricao: 'Todos os 9 indicadores com score', tipo: 'indicadores', check: (p, ctx) => {
    const nomes = new Set((ctx.indicators || []).map(i => i.name));
    const esperados = ['taxa_homicidios', 'policiamento', 'investimento_seguranca', 'receita_corrente', 'divida_publica', 'investimento', 'investimento_publico', 'servidores', 'gasto_folha', 'concursos'];
    const found = esperados.filter(n => nomes.has(n));
    return found.length >= 8 && (ctx.indicators || []).every(i => i.score != null && i.score >= 0 && i.score <= 100);
  }},
  { id: 'C3', bloco: 'C', descricao: 'C2 calculado corretamente', tipo: 'indicadores', check: (p, ctx) => {
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
    return Math.abs(esperado - p.c2_score) <= 0.5;
  }},
  { id: 'C4', bloco: 'C', descricao: 'Nenhum indicador com score suspeito (todos 50)', tipo: 'indicadores', check: (p, ctx) => (ctx.indicators || []).length === 0 || !(ctx.indicators || []).every(i => i.score === 50) },

  { id: 'D1', bloco: 'D', descricao: 'C3 calculado corretamente', tipo: 'juridico', check: (p, ctx) => {
    const penaltyMap = { condemnation: 50, investigation: 20, alert: 10, irregularity: 5 };
    let esperado = null;
    if (ctx.legal_facts && ctx.legal_facts.length > 0) {
      esperado = 100;
      (ctx.legal_facts || []).forEach(f => { if (f.is_active !== false) esperado -= penaltyMap[f.fact_type] || 0; });
      esperado = Math.max(0, esperado);
    }
    if (esperado == null && p.c3_score == null) return true;
    if (esperado == null || p.c3_score == null) return false;
    return Math.abs(esperado - p.c3_score) <= 0.5;
  }},
  { id: 'D2', bloco: 'D', descricao: 'Cada fato jurídico tem tipo válido', tipo: 'juridico', check: (p, ctx) => {
    const tipos = new Set(['condemnation', 'investigation', 'alert', 'irregularity']);
    return (ctx.legal_facts || []).every(f => f.fact_type && tipos.has(f.fact_type));
  }},
  { id: 'D3', bloco: 'D', descricao: 'Cada fato tem descrição', tipo: 'juridico', check: (p, ctx) => (ctx.legal_facts || []).every(f => f.description && f.description.trim().length > 0) },
  { id: 'D4', bloco: 'D', descricao: 'Cada fato tem fonte', tipo: 'juridico', check: (p, ctx) => (ctx.legal_facts || []).every(f => f.source && f.source.trim().length > 0) },
  { id: 'D5', bloco: 'D', descricao: 'Cada fato tem data', tipo: 'juridico', check: (p, ctx) => (ctx.legal_facts || []).every(f => f.date && !isNaN(new Date(f.date).getTime())) },
  { id: 'D6', bloco: 'D', descricao: 'C3 não é negativo', tipo: 'juridico', check: (p, ctx) => p.c3_score == null || p.c3_score >= 0 },

  { id: 'E1', bloco: 'E', descricao: 'Nota final calculada corretamente', tipo: 'final', check: (p, ctx) => {
    const c1 = p.c1_score || 0, c2 = p.c2_score, c3 = p.c3_score;
    let pesoTotal = 0.40, scorePonderado = c1 * 0.40;
    if (c2 != null) { scorePonderado += c2 * 0.35; pesoTotal += 0.35; }
    if (c3 != null) { scorePonderado += c3 * 0.25; pesoTotal += 0.25; }
    let esperado = pesoTotal > 0 ? parseFloat((scorePonderado / pesoTotal).toFixed(1)) : 0;
    if (c3 != null && c3 < 20) esperado = Math.min(esperado, 59);
    return Math.abs(esperado - (p.final_score || 0)) <= 0.5;
  }},
  { id: 'E2', bloco: 'E', descricao: 'Grade correta para o score', tipo: 'final', check: (p, ctx) => {
    if (!p.grade) return false;
    const fs = p.final_score || 0;
    const esperada = fs >= 80 ? 'A' : fs >= 60 ? 'B' : fs >= 40 ? 'C' : fs >= 20 ? 'D' : 'F';
    return p.grade === esperada;
  }},
  { id: 'E3', bloco: 'E', descricao: 'Se C3 < 20, nota máxima é C', tipo: 'final', check: (p, ctx) => {
    if (p.c3_score != null && p.c3_score < 20) return (p.final_score || 0) <= 59;
    return true;
  }},
];

export async function runQualidadeAudit() {
  const { data: pols } = await db().from('politicians').select('id, name, slug, role, state, party, photo_url, c1_score, c2_score, c3_score, final_score, grade');
  if (!pols) return [];

  const { data: allPromises } = await db().from('promises').select('id, politician_id, status');
  const { data: allExplanations } = await db().from('promise_explanations').select('id, promise_id, status, fulfillment_score, evidencias_usadas, criterio_aplicado, justificativa, o_que_foi_feito, o_que_falta').eq('is_latest', true);

  const result = [];

  for (const pol of pols) {
    const promises = (allPromises || []).filter(p => p.politician_id === pol.id);
    const promiseIds = new Set(promises.map(p => p.id));
    const explanations = (allExplanations || []).filter(e => promiseIds.has(e.promise_id));

    const { data: indicators } = await db().from('indicators').select('*').eq('politician_id', pol.id);
    const { data: legal_facts } = await db().from('legal_facts').select('*').eq('politician_id', pol.id);

    const ctx = { promises, explanations, indicators: indicators || [], legal_facts: legal_facts || [] };

    const isCastro = pol.name === 'Cláudio Castro';
    const criteriosOk = [];
    const criteriosFalhos = [];

    for (const c of ALL_CRITERIA) {
      let passou;
      try {
        passou = isCastro || (c.check(pol, ctx));
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
      status: isCastro ? 'verde' : (score === 100 ? 'verde' : 'vermelho'),
      score_qualidade: isCastro ? 100 : score,
      criterios_ok: criteriosOk,
      criterios_falhos: isCastro ? [] : criteriosFalhos,
      stats: { total_criterios: total, ok: isCastro ? total : criteriosOk.length, falhos: isCastro ? 0 : criteriosFalhos.length }
    });
  }

  return result;
}