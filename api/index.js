import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { runAudit } from './lib/metodologiaAudit.js';
import { runQualidadeAudit } from './lib/qualidadeAudit.js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.ADMIN_SECRET_KEY;

function signJwt(email) {
  return jwt.sign({ email, exp: Math.floor(Date.now() / 1000) + 86400 }, JWT_SECRET);
}

function verifyJwt(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const allowedEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (allowedEmails.length > 0 && !allowedEmails.includes(payload.email.toLowerCase())) return null;
    return payload;
  } catch { return null; }
}

function requireAdmin(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  return verifyJwt(token);
}

async function exchangeGithubCode(code) {
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ client_id: process.env.GITHUB_ID, client_secret: process.env.GITHUB_SECRET, code })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return null;
    const userRes = await fetch('https://api.github.com/user', { headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-Agent': 'Promessometro/1.0' } });
    const user = await userRes.json();
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-Agent': 'Promessometro/1.0' } });
    const emails = await emailsRes.json();
    const primary = (emails || []).find(e => e.primary && e.verified);
    const email = primary?.email || user.email;
    if (!email) return null;
    const allowedEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) return null;
    return { email, name: user.name || user.login };
  } catch { return null; }
}
const SUPABASE_ANON_KEY = process.env.VITE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

const WIKIPEDIA_API = 'https://pt.wikipedia.org/w/api.php';

function db() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function dbAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
}

function toSlug(name) {
  if (!name) return '';
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function normStatus(s) {
  const m = { 'cumprida': 'cumprida', 'parcial': 'parcial', 'parcialmente_cumprida': 'parcial', 'em_andamento': 'parcial', 'nao_iniciada': 'pendente', 'nao_classificada': 'pendente', 'pendente': 'pendente', 'descumprida': 'quebrada', 'quebrada': 'quebrada', 'nao_cumprida': 'quebrada', 'fulfilled': 'cumprida', 'broken': 'quebrada' };
  return m[s] || 'pendente';
}

const WIKI_UA = 'Promessometro/1.0 (contato@promessometro.com.br)';

async function fetchWikipediaPhoto(name) {
  try {
    const searchUrl = `${WIKIPEDIA_API}?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&origin=*&srlimit=5`;
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': WIKI_UA } });
    const searchData = await searchRes.json();
    const results = searchData?.query?.search || [];
    for (const result of results) {
      const title = result.title;
      const imgUrl = `${WIKIPEDIA_API}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&piprop=original&format=json&origin=*&redirects=1`;
      const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': WIKI_UA } });
      const imgData = await imgRes.json();
      const pages = imgData?.query?.pages;
      if (pages) {
        const page = Object.values(pages)[0];
        if (page && page.original?.source) return page.original.source;
      }
    }
  } catch (err) {
    console.error('[WikipediaPhoto] Error:', err);
  }
  return null;
}

async function ensurePolitician(name) {
  const { data: existing } = await db().from('politicians').select('id, name, photo_url').ilike('name', name.trim()).maybeSingle();
  if (existing) {
    if (!existing.photo_url) {
      const photoUrl = await fetchWikipediaPhoto(existing.name);
      if (photoUrl) {
        await db().from('politicians').update({ photo_url: photoUrl }).eq('id', existing.id);
        existing.photo_url = photoUrl;
      }
    }
    return existing;
  }
  const slug = toSlug(name);
  const photoUrl = await fetchWikipediaPhoto(name);
  const { data: newPol } = await db().from('politicians').insert({
    name: name.trim(), slug, role: 'politico', state: 'BR',
    photo_url: photoUrl || null
  }).select().single();
  return newPol;
}

export default async function handler(req, res) {
  const path = req.url ? new URL(req.url, 'http://localhost').pathname : '/';
  const method = req.method;
  res.setHeader('Content-Type', 'application/json');

  try {
    if (path === '/api/health') {
      return res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (path === '/api/politicians/ranking' && method === 'GET') {
      const [polRes, evalRes, promRes] = await Promise.all([
        db().from('politicians').select('id, name, role, state, party, slug, photo_url, grade, final_score, c1_score, c2_score, c3_score'),
        db().from('promise_explanations').select('promise_id, status, fulfillment_score').eq('is_latest', true),
        db().from('promises').select('id, politician_id, politician_name, status')
      ]);
      if (polRes.error) return res.status(500).json({ error: polRes.error.message });

      const evalMap = {}; (evalRes.data || []).forEach(e => evalMap[e.promise_id] = e);
      const promByPol = {};
      (promRes.data || []).forEach(p => {
        const id = p.politician_id || p.politician_name;
        if (!promByPol[id]) promByPol[id] = [];
        promByPol[id].push(p);
      });

      const ranking = (polRes.data || []).map(pol => {
        const list = promByPol[pol.id] || promByPol[pol.name] || [];
        let f = 0, pa = 0, b = 0, pe = 0, totalScore = 0, evalCount = 0;
        list.forEach(p => {
          const ev = evalMap[p.id];
          const s = ev ? normStatus(ev.status) : normStatus(p.status);
          const sc = ev ? (ev.fulfillment_score || 0) : 0;
          if (s === 'cumprida') { f++; totalScore += 100; evalCount++; }
          else if (s === 'parcial') { pa++; totalScore += sc || 50; evalCount++; }
          else if (s === 'quebrada') { b++; evalCount++; }
          else { pe++; if (ev) { totalScore += sc || 20; evalCount++; } }
        });
        const pct = evalCount > 0 ? Math.round((f + pa * 0.5) / evalCount * 100) : 0;
        return {
          ...pol,
          stats: { fulfilled: f, partial: pa, broken: b, pending: pe, total: list.length },
          percentage: pct, promise_count: list.length,
          grade: pol.grade || null, final_score: pol.final_score || null,
          c1_score: pol.c1_score, c2_score: pol.c2_score, c3_score: pol.c3_score
        };
      }).filter(p => p.promise_count > 0).sort((a, b) => b.percentage - a.percentage);

      return res.json({ ranking: ranking.slice(0, 50), total: ranking.length });
    }

    if (path === '/api/promises' && method === 'GET') {
      const [promisesRes, polRes] = await Promise.all([
        db().from('promises').select('*, politicians(photo_url)').order('created_at', { ascending: false }).limit(50),
        db().from('politicians').select('name, photo_url')
      ]);
      if (promisesRes.error) return res.status(500).json({ error: promisesRes.error.message });
      const polPhotoMap = {};
      (polRes.data || []).forEach(p => { polPhotoMap[p.name] = p.photo_url; });
      return res.json({
        promises: (promisesRes.data || []).map(p => {
          const { politicians, ...promise } = p;
          return {
            ...promise,
            politician_photo_url: politicians?.photo_url || polPhotoMap[p.politician_name] || null,
            slug: toSlug(p.politician_name)
          };
        }),
        total: promisesRes.data?.length || 0
      });
    }

    if (path.startsWith('/api/evaluate/') && method === 'GET') {
      const id = path.replace('/api/evaluate/', '');
      if (!id) return res.status(400).json({ error: 'promiseId obrigatorio' });
      const { data: ev, error } = await db().from('promise_explanations').select('*').eq('promise_id', id).eq('is_latest', true).maybeSingle();
      if (ev) return res.json({ promise_id: id, status: normStatus(ev.status), score: ev.fulfillment_score, confidence: Math.round((ev.confianca || 0) * 100), justification: ev.justificativa || '', sources: ev.evidencias_usadas || [], evaluated_at: ev.gerado_em, has_evaluation: true });
      const { data: p } = await db().from('promises').select('id, status, fulfillment_score, ai_evaluation, evidences_used').eq('id', id).single();
      if (!p) return res.status(404).json({ error: 'Promessa nao encontrada' });
      return res.json({ promise_id: id, status: normStatus(p.status), score: p.fulfillment_score || 50, confidence: 0, justification: p.ai_evaluation || 'Aguardando avaliacao', sources: p.evidences_used || [], evaluated_at: null, has_evaluation: false });
    }

    if (path === '/api/batch-evaluate' && (method === 'POST' || method === 'GET')) {
      const scoreRanges = {
        cumprida: [80, 100], parcial: [40, 79], pendente: [0, 39], quebrada: [0, 0]
      };
      const { data: promises } = await dbAdmin().from('promises').select('id, status, fulfillment_score, politician_name, promise_title').limit(100);
      let seeded = 0;
      for (const p of promises || []) {
        const { data: exists } = await db().from('promise_explanations').select('id').eq('promise_id', p.id).eq('is_latest', true).maybeSingle();
        if (exists) continue;
        const norm = normStatus(p.status);
        const [min, max] = scoreRanges[norm] || [0, 39];
        const score = p.fulfillment_score ? Math.max(min, Math.min(max, p.fulfillment_score)) : Math.round((min + max) / 2);
        await dbAdmin().from('promise_explanations').update({ is_latest: false }).eq('promise_id', p.id);
        // FIX B13: usar 'seed_initial_v1' (não batch-heranca) — será substituído pela IA no próximo ciclo
        await dbAdmin().from('promise_explanations').insert({
          promise_id: p.id, status: norm, fulfillment_score: score,
          criterio_aplicado: 'seed_initial_v1',
          justificativa: `Avaliação inicial para ${p.politician_name || 'político'}: promessa com status ${norm} aguarda verificação pela IA no próximo ciclo de reavaliação.`,
          evidencias_usadas: [],
          o_que_falta: 'Verificação detalhada por IA na próxima execução do ciclo diário.',
          o_que_foi_feito: `Promessa registrada com status inicial ${norm}. Aguarda pesquisa de evidências.`,
          confianca: 0.3, modelo_ia: 'seed-v2', is_latest: true, gerado_em: new Date().toISOString()
        });
        seeded++;
        await new Promise(r => setTimeout(r, 50));
      }
      return res.json({ seeded, total: promises?.length || 0, message: 'Promessas seedadas. Execute /api/upgrade-evaluations para reavaliação por IA.' });
    }

    // Reavalia promessas com herança automática via IA real
    if (path === '/api/upgrade-evaluations' && (method === 'POST' || method === 'GET')) {
      const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
      const SERPER_KEY = process.env.SERPER_API_KEY || '';
      const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
      const SOCIAL_DOMAINS = ['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com'];
      function isSocial(url) { if (!url) return false; try { const h = new URL(url).hostname.replace('www.',''); return SOCIAL_DOMAINS.some(s => h === s || h.endsWith('.'+s)); } catch { return false; } }

      // Busca avaliações com herança automática
      const { data: oldEvals } = await db().from('promise_explanations')
        .select('id, promise_id, criterio_aplicado')
        .in('criterio_aplicado', ['batch-heranca', 'autonomous_seed', 'seed_initial_v1', 'evidence_based_fallback'])
        .eq('is_latest', true)
        .limit(20);

      if (!oldEvals?.length) return res.json({ upgraded: 0, message: 'Nenhuma avaliação de herança encontrada' });

      let upgraded = 0, errors = 0;
      for (const ev of oldEvals) {
        try {
          const { data: promise } = await db().from('promises').select('*').eq('id', ev.promise_id).single();
          if (!promise) continue;

          // Buscar evidências via Serper
          let evidences = [];
          if (SERPER_KEY) {
            const r = await fetch('https://google.serper.dev/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
              body: JSON.stringify({ q: `${promise.politician_name} ${promise.promise_title?.substring(0,50)}`, gl: 'br', hl: 'pt-br', num: 5 })
            });
            if (r.ok) {
              const d = await r.json();
              evidences = (d.organic || []).filter(r => !isSocial(r.link)).map(r => ({ descricao: r.snippet||'', fonte: r.source||'', url: r.link||'' }));
            }
          }

          if (!GROQ_KEY) { errors++; continue; }
          const evText = evidences.length > 0 ? evidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url})`).join('\n') : 'Nenhuma evidência.';
          const prompt = `Avalie a promessa: "${promise.promise_title}" de ${promise.politician_name}. Evidências: ${evText}. Responda JSON: {"status":"cumprida|parcial|pendente|quebrada","fulfillment_score":0-100,"justificativa":"explicação detalhada mínimo 50 palavras","o_que_foi_feito":"o que foi realizado mínimo 20 palavras","o_que_falta":"o que ainda falta mínimo 20 palavras"}`;
          const gr = await fetch(`${AI_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.1, max_tokens: 1024 })
          });
          if (!gr.ok) { errors++; await new Promise(r => setTimeout(r, 2000)); continue; }
          const gd = await gr.json();
          const parsed = JSON.parse(gd.choices[0].message.content);
          const mappedStatus = normStatus(parsed.status);
          const clampRanges = { cumprida: [80,100], parcial: [40,79], pendente: [0,39], quebrada: [0,0] };
          const [mn, mx] = clampRanges[mappedStatus] || [0,39];
          const score = Math.max(mn, Math.min(mx, Math.round(parsed.fulfillment_score || mn)));

          await dbAdmin().from('promise_explanations').update({ is_latest: false }).eq('promise_id', ev.promise_id);
          await dbAdmin().from('promise_explanations').insert({
            promise_id: ev.promise_id, status: mappedStatus, fulfillment_score: score,
            criterio_aplicado: 'ai_reavaliation_v2',
            justificativa: parsed.justificativa || '',
            evidencias_usadas: evidences.slice(0, 5),
            o_que_foi_feito: parsed.o_que_foi_feito || '',
            o_que_falta: parsed.o_que_falta || '',
            confianca: evidences.length >= 2 ? 0.80 : 0.60,
            modelo_ia: 'llama-3.3-70b-versatile', is_latest: true, gerado_em: new Date().toISOString()
          });
          await dbAdmin().from('promises').update({ status: mappedStatus, fulfillment_score: score, last_verified_at: new Date().toISOString() }).eq('id', ev.promise_id);
          upgraded++;
          await new Promise(r => setTimeout(r, 2500)); // respeitar rate limit
        } catch (e) { console.error('[upgrade-evaluations]', e.message); errors++; }
      }
      return res.json({ upgraded, errors, total: oldEvals.length, remaining: oldEvals.length - upgraded - errors });
    }

    // Seeda indicadores para um político via Serper+Groq
    if (path === '/api/seed-indicators' && method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Não autorizado' });
      let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
      const { politician_id, politician_name, state, role } = JSON.parse(body || '{}');
      if (!politician_id) return res.status(400).json({ error: 'politician_id obrigatório' });

      const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
      const SERPER_KEY = process.env.SERPER_API_KEY || '';
      const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';

      // Verifica mandate ativo
      let { data: mandate } = await db().from('mandates').select('id').eq('politician_id', politician_id).eq('is_active', true).maybeSingle();
      if (!mandate) {
        const { data: newMandate } = await dbAdmin().from('mandates').insert({
          politician_id, position: role || 'Cargo Público', start_date: '2023-01-01',
          end_date: '2026-12-31', is_active: true
        }).select().single();
        mandate = newMandate;
      }

      // Busca dados reais via Serper
      const regiao = state || 'Brasil';
      const nome = politician_name || '';
      let contexto = `Região: ${regiao}, Político: ${nome}`;
      if (SERPER_KEY) {
        try {
          const r = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
            body: JSON.stringify({ q: `${nome} ${regiao} indicadores segurança criminalidade finanças públicas 2024`, gl: 'br', hl: 'pt-br', num: 5 })
          });
          if (r.ok) {
            const d = await r.json();
            contexto += '\n' + (d.organic || []).map(r => r.snippet).filter(Boolean).slice(0,3).join(' | ');
          }
        } catch (_) { }
      }

      if (!GROQ_KEY) return res.status(400).json({ error: 'GROQ_API_KEY não configurado' });
      const prompt = `Você é analista de dados públicos brasileiros. Com base nas informações disponíveis para ${nome} (${regiao}), gere indicadores realistas para avaliação metodológica.

Contexto: ${contexto}

Gere 9 indicadores distribuídos em 3 categorias. Responda SOMENTE JSON:
{
  "indicadores": [
    {"name": "taxa_homicidios", "category": "seguranca", "score": 0-100, "valor": "XX por 100k hab", "fonte": "fonte dos dados", "ano": 2023},
    {"name": "policiamento", "category": "seguranca", "score": 0-100, "valor": "descrição", "fonte": "fonte", "ano": 2023},
    {"name": "investimento_seguranca", "category": "seguranca", "score": 0-100, "valor": "% do orçamento", "fonte": "fonte", "ano": 2023},
    {"name": "receita_corrente", "category": "financas", "score": 0-100, "valor": "R$ bi", "fonte": "fonte", "ano": 2023},
    {"name": "divida_publica", "category": "financas", "score": 0-100, "valor": "% da receita", "fonte": "fonte", "ano": 2023},
    {"name": "investimento", "category": "financas", "score": 0-100, "valor": "R$ bi", "fonte": "fonte", "ano": 2023},
    {"name": "investimento_publico", "category": "funcionalismo", "score": 0-100, "valor": "% do PIB", "fonte": "fonte", "ano": 2023},
    {"name": "servidores", "category": "funcionalismo", "score": 0-100, "valor": "mil servidores", "fonte": "fonte", "ano": 2023},
    {"name": "gasto_folha", "category": "funcionalismo", "score": 0-100, "valor": "% da receita", "fonte": "fonte", "ano": 2023}
  ]
}

SCORE: 0=péssimo, 50=mediano para o Brasil, 100=referência nacional. Use dados reais se conhecer, ou estimativas fundamentadas.`;

      const gr = await fetch(`${AI_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 2048 })
      });
      if (!gr.ok) return res.status(500).json({ error: `Groq error: ${gr.status}` });
      const gd = await gr.json();
      const parsed = JSON.parse(gd.choices[0].message.content);
      const indicadores = parsed.indicadores || [];

      // Deleta indicadores antigos e insere novos
      await dbAdmin().from('indicators').delete().eq('politician_id', politician_id);
      let inserted = 0;
      const errors = [];
      const CAT_MAP = { seguranca: 'seguranca', segurança: 'seguranca', financas: 'financas', finanças: 'financas', funcionalismo: 'funcionalismo' };
      function parseNum(v) {
        if (v == null) return null;
        const s = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.').trim();
        const m = s.match(/-?\d+\.?\d*/);
        return m ? parseFloat(m[0]) : null;
      }
      for (const ind of indicadores) {
        const rawCat = (ind.category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const name = ind.name || 'indicador_' + inserted;
        const score = typeof ind.score === 'number' ? Math.min(100, Math.max(0, Math.round(ind.score))) : 50;
        const { error } = await dbAdmin().from('indicators').insert({
          politician_id, mandate_id: mandate?.id || null,
          name, category: CAT_MAP[rawCat] || rawCat,
          score, weight: 50,
          result_value: parseNum(ind.valor), source_url: ind.fonte, result_year: ind.ano || 2023,
          description: `Gerado via IA para ${nome} (${regiao})`
        });
        if (error) { errors.push(error.message || error); console.error('[seed-indicators] insert error:', error); }
        else inserted++;
      }

      return res.json({ inserted, total: indicadores.length, errors, mandate_id: mandate?.id });
    }

    // Busca e importa promessas de político via Serper+Groq
    if (path === '/api/find-promises' && method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Não autorizado' });
      let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
      const { politician_id, politician_name, role, state, dry_run } = JSON.parse(body || '{}');
      if (!politician_id || !politician_name) return res.status(400).json({ error: 'politician_id e politician_name são obrigatórios' });

      const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
      const SERPER_KEY = process.env.SERPER_API_KEY || '';
      const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';

      if (!SERPER_KEY) return res.status(400).json({ error: 'SERPER_API_KEY não configurado' });
      if (!GROQ_KEY) return res.status(400).json({ error: 'GROQ_API_KEY não configurado' });

      const queries = [
        `"${politician_name}" promessas campanha plano governo 2022 OR 2024`,
        `"${politician_name}" propostas eleicao compromissos`,
        `"${politician_name}" ${state || ''} metas projetos realizações`
      ];

      let allSnippets = [];
      for (const q of queries) {
        try {
          const r = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
            body: JSON.stringify({ q, gl: 'br', hl: 'pt-br', num: 8 })
          });
          if (r.ok) {
            const d = await r.json();
            allSnippets.push(...(d.organic || []).map(r => ({ titulo: r.title||'', descricao: r.snippet||'', url: r.link||'' })));
          }
        } catch (_) { }
        await new Promise(r => setTimeout(r, 500));
      }

      if (!allSnippets.length) return res.json({ discovered: 0, promises: [], message: 'Nenhum artigo encontrado' });

      const snippetSection = allSnippets.slice(0,15).map(a => `TITULO: ${a.titulo}\nSNIPPET: ${a.descricao}\nURL: ${a.url}`).join('\n---\n');
      const prompt = `Extraia TODAS as promessas concretas e específicas de ${politician_name} (${role||'político'}, ${state||'Brasil'}).

${snippetSection}

Resposta SOMENTE JSON:
{"promessas": [{"titulo": "promessa específica com detalhes", "categoria": "Saude|Educacao|Seguranca|Economia|Infraestrutura|Meio_Ambiente|Trabalho|Habitacao|Transporte|Outros", "descricao": "descrição detalhada"}]}`;

      const gr = await fetch(`${AI_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.1, max_tokens: 4096 })
      });
      if (!gr.ok) return res.status(500).json({ error: `Groq error: ${gr.status}` });
      const gd = await gr.json();
      const parsed = JSON.parse(gd.choices[0].message.content);
      const promessas = parsed.promessas || parsed.promises || [];

      if (dry_run) return res.json({ discovered: promessas.length, promises: promessas, dry_run: true });

      // Busca promessas existentes para dedup
      const { data: existing } = await db().from('promises').select('promise_title').eq('politician_id', politician_id);
      const existingTitles = new Set((existing || []).map(p => p.promise_title.toLowerCase()));

      const catMap = { 'saude': 'Saúde', 'saúde': 'Saúde', 'educacao': 'Educação', 'educação': 'Educação', 'seguranca': 'Segurança', 'segurança': 'Segurança', 'economia': 'Economia', 'infraestrutura': 'Infraestrutura', 'meio_ambiente': 'Meio Ambiente', 'trabalho': 'Trabalho', 'habitacao': 'Habitação', 'habitação': 'Habitação', 'transporte': 'Transporte' };
      function normCat(c) { if (!c) return 'Outros'; const k = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,''); return catMap[k] || 'Outros'; }

      let inserted = 0, dupes = 0;
      for (const p of promessas) {
        if (!p.titulo || p.titulo.length < 10) continue;
        const titleLower = p.titulo.toLowerCase();
        const isDupe = [...existingTitles].some(t => {
          const words = titleLower.split(' ').filter(w => w.length > 4);
          const matches = words.filter(w => t.includes(w));
          return matches.length >= Math.min(3, words.length * 0.5);
        });
        if (isDupe) { dupes++; continue; }
        const { error } = await dbAdmin().from('promises').insert({
          politician_id, politician_name,
          promise_title: p.titulo.trim(),
          category: normCat(p.categoria),
          status: 'pendente', fulfillment_score: 20
        });
        if (!error) { inserted++; existingTitles.add(titleLower); }
      }

      return res.json({ discovered: promessas.length, inserted, duplicates: dupes, total_snippets: allSnippets.length });
    }

    if (path === '/api/stats' && method === 'GET') {
      const [{ count: polCount }, { count: promCount }] = await Promise.all([
        db().from('politicians').select('*', { count: 'exact', head: true }),
        db().from('promises').select('*', { count: 'exact', head: true })
      ]);
      return res.json({ total_politicians: polCount || 0, total_promises: promCount || 0 });
    }

    if (path.startsWith('/api/politician/') && method === 'GET') {
      const cleanPath = path.split('?')[0];
      const slug = cleanPath.replace('/api/politician/', '');
      
      const { data: pol, error: polErr } = await db().from('politicians').select('*').eq('slug', slug).single();
      if (polErr || !pol) return res.status(404).json({ error: 'Politico nao encontrado' });

      const { data: promises } = await db().from('promises').select('*').eq('politician_id', pol.id).order('created_at', { ascending: false });

      const { data: evaluations } = promises?.length
        ? await db().from('promise_explanations').select('*').in('promise_id', promises.map(p => p.id)).eq('is_latest', true)
        : { data: [] };

      const evalMap = {}; (evaluations || []).forEach(e => evalMap[e.promise_id] = e);
      let f = 0, pa = 0, b = 0, pe = 0;
      const promisesWith = (promises || []).map(p => {
        const ev = evalMap[p.id];
        const s = ev ? normStatus(ev.status) : normStatus(p.status);
        if (s === 'cumprida') f++; else if (s === 'parcial') pa++; else if (s === 'quebrada') b++; else pe++;
        return { ...p, evaluation: ev || null };
      });
      const total = promisesWith.length;
      const pct = total > 0 ? Math.round(((f + pa * 0.5) / total) * 100) : 0;

      // Fetch mandate + layers
      const { data: mandate } = await db().from('mandates').select('*').eq('politician_id', pol.id).eq('is_active', true).maybeSingle();
      const { data: indicators } = mandate?.id
        ? await db().from('indicators').select('*').eq('mandate_id', mandate.id)
        : await db().from('indicators').select('*').eq('politician_id', pol.id);
      const { data: legalFacts } = mandate?.id ? await db().from('legal_facts').select('*').eq('politician_id', pol.id) : { data: [] };

      // Calculate C1
      const c1 = total > 0 ? parseFloat(((f * 1.0 + pa * 0.5) / total * 100).toFixed(1)) : 0;

      // Calculate C2
      let c2 = 0;
      const catWeights = { seguranca: 0.30, financas: 0.40, funcionalismo: 0.30 };
      const catScores = { seguranca: [], financas: [], funcionalismo: [] };
      (indicators || []).forEach(ind => {
        if (ind.score != null && catScores[ind.category]) catScores[ind.category].push(ind.score);
      });
      let c2WeightSum = 0, c2ScoreSum = 0;
      for (const [cat, scores] of Object.entries(catScores)) {
        if (scores.length > 0) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          const w = catWeights[cat] || 0;
          c2ScoreSum += avg * w;
          c2WeightSum += w;
        }
      }
      c2 = c2WeightSum > 0 ? parseFloat((c2ScoreSum / c2WeightSum).toFixed(1)) : null;

      // Calculate C3
      let c3 = null;
      if (legalFacts && legalFacts.length > 0) {
        c3 = 100;
        const penaltyMap = { 'condemnation': 50, 'investigation': 20, 'alert': 10, 'irregularity': 5 };
        (legalFacts || []).forEach(fact => {
          if (fact.is_active !== false) {
            const pts = penaltyMap[fact.fact_type] || 0;
            if (pts > 0) c3 -= pts;
          }
        });
        c3 = Math.max(0, c3);
      }

      // Calculate final score
      const w1 = 0.40, w2 = 0.35, w3 = 0.25;
      let pesoTotal = w1;
      let scorePonderado = c1 * w1;
      if (c2 != null) { scorePonderado += c2 * w2; pesoTotal += w2; }
      if (c3 != null) { scorePonderado += c3 * w3; pesoTotal += w3; }
      let finalScore = pesoTotal > 0 ? parseFloat((scorePonderado / pesoTotal).toFixed(1)) : 0;
      let grade;
      if (c3 != null && c3 < 20) { finalScore = Math.min(finalScore, 59); }
      if (finalScore >= 80) grade = 'A';
      else if (finalScore >= 60) grade = 'B';
      else if (finalScore >= 40) grade = 'C';
      else if (finalScore >= 20) grade = 'D';
      else grade = 'F';

      // Save to politicians table
      await dbAdmin().from('politicians').update({
        c1_score: c1, c2_score: c2, c3_score: c3,
        final_score: parseFloat(finalScore.toFixed(1)), grade,
        methodology_version: '1.0',
        last_evaluated_at: new Date().toISOString()
      }).eq('id', pol.id);

      return res.json({
        politician: pol,
        methodology: { c1_score: c1, c2_score: c2, c3_score: c3, final_score: parseFloat(finalScore.toFixed(1)), grade, version: '1.0' },
        stats: { fulfilled: f, partial: pa, broken: b, pending: pe, total },
        percentage: pct,
        mandates: mandate ? [mandate] : [],
        indicators: indicators || [],
        legal_facts: legalFacts || [],
        promises: promisesWith
      });
    }

    if (path === '/api/metodologia' && method === 'GET') {
      const { data, error } = await db().from('methodology').select('*').eq('is_current', true).single();
      if (error && !data) {
        // Fallback: return last version if none is current
        const { data: last } = await db().from('methodology').select('*').order('published_at', { ascending: false }).limit(1).single();
        if (!last) return res.json({ version: '1.0', content: null });
        return res.json(last);
      }
      return res.json(data);
    }

    if (path === '/api/promises/submit' && method === 'POST') {
      let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
      const d = JSON.parse(body);
      if (!d.politician_name || !d.promise_title) return res.status(400).json({ error: 'Nome e titulo obrigatorios' });

      let politicianId = null;
      try {
        const pol = await ensurePolitician(d.politician_name.trim());
        if (pol) politicianId = pol.id;
      } catch (err) {
        console.error('[Submit] ensurePolitician error:', err);
      }

      const { data, error } = await dbAdmin().from('promises').insert({
        politician_name: d.politician_name.trim(), promise_title: d.promise_title.trim(),
        category: d.category || 'Outros',
        source_link: d.source_link || null, status: 'pendente', fulfillment_score: 50,
        politician_id: politicianId
      }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ data });
    }

    if (path.startsWith('/api/promises/') && method === 'GET') {
      const cleanPath = path.split('?')[0];
      const id = cleanPath.replace('/api/promises/', '');
      if (!id) return res.status(400).json({ error: 'id obrigatorio' });
      const [promiseRes, polRes] = await Promise.all([
        db().from('promises').select('*, politicians(photo_url)').eq('id', id).maybeSingle(),
        db().from('politicians').select('name, photo_url')
      ]);
      if (promiseRes.error || !promiseRes.data) return res.status(404).json({ error: 'Promessa nao encontrada' });
      const polMap = {}; (polRes.data || []).forEach(p => polMap[p.name] = p.photo_url);
      const { politicians, ...promise } = promiseRes.data;
      const { data: evaluation } = await db().from('promise_explanations').select('*').eq('promise_id', id).eq('is_latest', true).maybeSingle();
      return res.json({ ...promise, politician_photo_url: politicians?.photo_url || polMap[promise.politician_name] || null, evaluation: evaluation || null });
    }

    if (path === '/api/photos/backfill' && (method === 'POST' || method === 'GET')) {
      const { data: politicians } = await db().from('politicians').select('id, name, photo_url').is('photo_url', null).limit(50);
      let updated = 0;
      for (const pol of politicians || []) {
        const photoUrl = await fetchWikipediaPhoto(pol.name);
        if (photoUrl) {
          await dbAdmin().from('politicians').update({ photo_url: photoUrl }).eq('id', pol.id);
          updated++;
        }
        await new Promise(r => setTimeout(r, 300));
      }
      return res.json({ updated, total: politicians?.length || 0 });
    }

    const categoryMap = {
      'saude': 'Saúde', 'saúde': 'Saúde',
      'educacao': 'Educação', 'educação': 'Educação',
      'seguranca': 'Segurança', 'segurança': 'Segurança',
      'economia': 'Economia',
      'infraestrutura': 'Infraestrutura',
      'meio_ambiente': 'Meio Ambiente',
      'trabalho': 'Trabalho',
      'habitacao': 'Habitação', 'habitação': 'Habitação',
      'transporte': 'Transporte'
    };
    function normalizeCategory(cat) {
      if (!cat) return 'Outros';
      const key = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '').replace(/_/g, '');
      return categoryMap[key] || 'Outros';
    }

    if (path === '/api/import-promises' && method === 'POST') {
      let raw = ''; req.on('data', c => raw += c); await new Promise(r => req.on('end', r));
      const body = JSON.parse(raw);
      if (!body.politician_id || !body.promises || !Array.isArray(body.promises)) {
        return res.status(400).json({ error: 'Requer politician_id e promises array' });
      }
      let inserted = 0; const errors = [];
      for (const p of body.promises) {
        const { error } = await dbAdmin().from('promises').insert({
          politician_id: body.politician_id,
          politician_name: body.politician_name || '',
          promise_title: p.titulo.trim(),
          category: normalizeCategory(p.categoria),
          status: 'pendente',
          fulfillment_score: 50,
          party: body.party || null
        });
        if (error) errors.push(error.message); else inserted++;
      }
      return res.json({ inserted, total: body.promises.length, errors: errors.length ? errors : undefined });
    }

    if (path.startsWith('/api/discover-promises') && (method === 'POST' || method === 'GET')) {
      const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
      const SERPER_KEY = process.env.SERPER_API_KEY || '';
      const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';

      const queryIdx = path.indexOf('?');
      const qs = queryIdx >= 0 ? new URLSearchParams(path.slice(queryIdx)) : new URLSearchParams();
      const targetName = qs.get('politician') ? decodeURIComponent(qs.get('politician')) : null;
      const limit = parseInt(qs.get('limit')) || 15;
      const skipInsert = qs.get('dryrun') === 'true';

      let polList;
      if (targetName) {
        const { data } = await db().from('politicians').select('id, name, role, state, party').ilike('name', `%${targetName}%`);
        polList = data || [];
      } else {
        const { data } = await db().from('politicians').select('id, name, role, state, party');
        polList = data || [];
      }

      if (polList.length === 0) return res.json({ error: 'Nenhum politico encontrado', discovered: 0 });

      const { data: existingProms } = await db().from('promises').select('id, politician_id, promise_title, politician_name');
      const existingByPol = {};
      (existingProms || []).forEach(p => {
        const key = p.politician_id || p.politician_name;
        if (!existingByPol[key]) existingByPol[key] = [];
        existingByPol[key].push(p.promise_title.toLowerCase());
      });

      function extractArticleText(html) {
        return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ').trim();
      }

      async function fetchArticle(url) {
        try {
          const r = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(8000)
          });
          if (!r.ok) return '';
          return extractArticleText(await r.text());
        } catch { return ''; }
      }

      async function searchSerper(query) {
        if (!SERPER_KEY) return [];
        try {
          const r = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
            body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br', num: 10 })
          });
          if (!r.ok) return [];
          const d = await r.json();
          return (d.organic || []).map(r => ({ titulo: r.title || '', descricao: r.snippet || '', url: r.link || '' }));
        } catch { return []; }
      }

      async function extractPromisesViaAI(politician, snippets, fullTexts) {
        if (!GROQ_KEY || GROQ_KEY.startsWith('YOUR_')) return [];
        const snippetSection = snippets.map(a =>
          `TITULO: ${a.titulo}\nSNIPPET: ${a.descricao}\nURL: ${a.url}`
        ).join('\n---\n');
        const fullTextSection = fullTexts.map(a =>
          `=== CONTEUDO COMPLETO: ${a.titulo} ===\n${a.fullText.substring(0, 3000)}\n=== FIM ===`
        ).join('\n\n');

        const prompt = `Você é analista politico especializado em extrair promessas de campanha de politicos brasileiros.

TAREFA: Extraia TODAS as promessas de campanha ESPECIFICAS feitas por ${politician.name} (${politician.role || 'politico'} - ${politician.party || ''} - ${politician.state || 'BR'}).

REGRAS:
1. Extraia APENAS promessas EXPLICITAMENTE atribuidas a ${politician.name}
2. Seja ESPECIFICO: inclua numeros, locais, prazos, valores
3. Separe promessas distintas mesmo que do mesmo tema
4. Ex: "construir 10 hospitais e 50 UPAs" = DUAS promessas

SNIPPETS:
${snippetSection}

${fullTextSection ? 'CONTEUDO COMPLETO:\n' + fullTextSection : ''}

Responda SOMENTE JSON array:
[{"titulo":"promessa especifica","descricao":"descricao detalhada","categoria":"Categoria"}]`;

        try {
          const r = await fetch(`${AI_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: 'json_object' },
              temperature: 0.1, max_tokens: 4096
            })
          });
          if (!r.ok) { console.error('GROQ API error', r.status, await r.text().catch(()=>'')); return []; }
          const d = await r.json();
          if (d.error) { console.error('GROQ response error', d.error); return []; }
          let text = (d.choices?.[0]?.message?.content || '[]').replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : (parsed.promessas || parsed.promises || []);
          return arr.filter(p => p.titulo && p.titulo.length > 10);
        } catch (e) { console.error('GROQ extraction error', e); return []; }
      }

      function isDuplicate(politicianId, politicianName, title, existingMap) {
        const key = politicianId || politicianName;
        const existing = existingMap[key] || [];
        const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        return existing.some(e => {
          const eWords = e.split(/\s+/).filter(w => w.length > 3);
          const intersection = words.filter(w => eWords.includes(w));
          return intersection.length >= Math.min(3, words.length * 0.4);
        });
      }

      let totalDiscovered = 0;
      const results = [];

      for (const pol of polList) {
        const queries = [
          `"plano de governo" "${pol.name}" promessas OR propostas site:g1.globo.com OR site:oglobo.globo.com`,
          `"promessas de campanha" "${pol.name}" "${pol.role || ''}"`,
          `"${pol.name}" propostas "${pol.role || 'governo'}" eleicoes`,
          `"${pol.name}" "plano de governo" OR promessas OR propostas`
        ];

        // Run Serper searches in parallel
        const resultsArrays = await Promise.all(queries.map(q => searchSerper(q)));
        let allArticles = resultsArrays.flat();

        const uniqueUrls = new Set();
        allArticles = allArticles.filter(a => {
          if (uniqueUrls.has(a.url)) return false;
          uniqueUrls.add(a.url);
          return true;
        });

        if (allArticles.length === 0) {
          results.push({ politician: pol.name, discovered: 0, error: 'Nenhum artigo encontrado' });
          continue;
        }

        const extracted = await extractPromisesViaAI(pol, allArticles, []);

        let inserted = 0;
        for (const p of extracted) {
          if (!skipInsert) {
            const { error } = await dbAdmin().from('promises').insert({
              politician_id: pol.id,
              politician_name: pol.name,
              promise_title: p.titulo.trim(),
              category: normalizeCategory(p.categoria),
              status: 'pendente',
              fulfillment_score: 50,
              party: pol.party
            });
            if (!error) { inserted++; totalDiscovered++; }
          } else {
            inserted++;
            totalDiscovered++;
          }
        }

        results.push({
          politician: pol.name,
          discovered: inserted,
          total_articles: allArticles.length
        });
      }

      return res.json({
        discovered: totalDiscovered,
        dry_run: skipInsert,
        details: results
      });
    }

    if (path === '/api/seed-indicators' && method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Não autorizado' });
      let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
      const { politician_id, politician_name, state, role } = JSON.parse(body || '{}');

      const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
      if (!politician_id || !GROQ_KEY) return res.status(400).json({ error: 'Parâmetros ou Chave IA ausentes' });

      // Definir as 3 categorias base da camada 2 (Metodologia)
      const categories = ['seguranca', 'financas', 'funcionalismo'];
      let inserted = 0, failed = 0;
      const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';

      for (const cat of categories) {
        try {
          const prompt = `Atue como um analista isento avaliando os resultados objetivos de mandato de ${politician_name} (${role || ''} - ${state || ''}) na área de ${cat}. Estime um score de 0 a 100 baseado em fatos públicos notórios. Responda estritamente em JSON: {"category":"${cat}","subcategory":"Indicador Geral","score": NUM, "description": "curta justificativa explicativa"}`;
          const gr = await fetch(`${AI_URL}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` }, body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.1, max_tokens: 500 }) });
          if (!gr.ok) { failed++; continue; }
          const gd = await gr.json();
          const parsed = JSON.parse(gd.choices[0].message.content);
          
          await dbAdmin().from('indicators').insert({
            politician_id, category: cat, subcategory: parsed.subcategory || 'Avaliação G',
            score: Math.max(0, Math.min(100, parseInt(parsed.score) || 50)),
            description: parsed.description || 'Avaliação via Serper/Groq',
            source_url: '', validation_method: 'autonomous_seed_ai'
          });
          inserted++;
        } catch (e) { failed++; }
      }
      return res.json({ success: true, seeded: inserted, failed });
    }

    if (path === '/api/audit-metodologia') {
      const autoFix = req.method === 'POST';
      const report = await runAudit({ autoFix });
      return res.json(report);
    }

    // Status do sistema para admin
    if (path === '/api/admin/system-status' && method === 'GET') {
      const admin = requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Não autorizado' });

      const [polRes, promRes, evalRes, cronRes, herancaRes] = await Promise.all([
        db().from('politicians').select('*', { count: 'exact', head: true }),
        db().from('promises').select('*', { count: 'exact', head: true }),
        db().from('promise_explanations').select('*', { count: 'exact', head: true }).eq('is_latest', true),
        db().from('cron_executions').select('execution_id, status, started_at, completed_at, promises_evaluated, promises_failed').order('started_at', { ascending: false }).limit(5),
        db().from('promise_explanations').select('*', { count: 'exact', head: true }).in('criterio_aplicado', ['batch-heranca', 'autonomous_seed', 'seed_initial_v1', 'evidence_based_fallback']).eq('is_latest', true)
      ]);

      const { data: withoutEval } = await db().from('promises').select('id').is('last_verified_at', null).limit(1);
      const { count: neverEvaluated } = await db().from('promises').select('*', { count: 'exact', head: true }).is('last_verified_at', null);

      const lastCron = (cronRes.data || [])[0];
      const hoursAgo = lastCron ? Math.round((Date.now() - new Date(lastCron.started_at).getTime()) / 3600000) : null;

      return res.json({
        politicians: polRes.count || 0,
        promises: promRes.count || 0,
        evaluated: evalRes.count || 0,
        never_evaluated: neverEvaluated || 0,
        heranca_automatica: herancaRes.count || 0,
        coverage: promRes.count > 0 ? Math.round((evalRes.count / promRes.count) * 100) : 0,
        last_cron: lastCron ? { ...lastCron, hours_ago: hoursAgo } : null,
        cron_history: cronRes.data || []
      });
    }

    // Disparar pipeline manualmente via admin — executa inline (sem sub-request HTTP)
    if (path === '/api/admin/run-pipeline' && method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Não autorizado' });
      let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
      const { target } = JSON.parse(body || '{}');

      const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
      const SERPER_KEY = process.env.SERPER_API_KEY || '';
      const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
      const SOCIAL_DOMAINS = ['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com'];
      function isSocPipe(url) { if (!url) return false; try { const h = new URL(url).hostname.replace('www.',''); return SOCIAL_DOMAINS.some(s => h === s || h.endsWith('.'+s)); } catch { return false; } }
      function extractH(url) { if (!url) return ''; try { return new URL(url).hostname.replace('www.',''); } catch { return ''; } }

      const executionId = `admin_pipeline_${Date.now()}`;
      const startTime = new Date();
      let evaluated = 0, failed = 0, upgraded = 0;

      try {
        try { await dbAdmin().from('cron_executions').insert({ execution_id: executionId, trigger: 'admin_manual', status: 'started', started_at: startTime.toISOString() }); } catch(e){}

        if (target === 'upgrade') {
          // Modo upgrade: converte heranças em avaliações reais via IA
          const { data: oldEvals } = await dbAdmin().from('promise_explanations')
            .select('id, promise_id, criterio_aplicado').in('criterio_aplicado', ['batch-heranca', 'autonomous_seed', 'seed_initial_v1', 'evidence_based_fallback']).eq('is_latest', true).limit(15);

          for (const ev of oldEvals || []) {
            try {
              const { data: promise } = await db().from('promises').select('*').eq('id', ev.promise_id).single();
              if (!promise) continue;
              let evidences = [];
              if (SERPER_KEY) {
                const r = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY }, body: JSON.stringify({ q: `${promise.politician_name} ${(promise.promise_title||'').substring(0,50)}`, gl: 'br', hl: 'pt-br', num: 5 }) });
                if (r.ok) { const d = await r.json(); evidences = (d.organic||[]).filter(r => !isSocPipe(r.link)).map(r => ({ descricao: r.snippet||'', fonte: r.source||extractH(r.link)||'', url: r.link||'' })); }
              }
              if (!GROQ_KEY) continue;
              const evText = evidences.length > 0 ? evidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url})`).join('\n') : 'Nenhuma evidência.';
              const prompt = `Avalie a promessa: "${promise.promise_title}" de ${promise.politician_name}. Evidências: ${evText}. Responda JSON: {"status":"cumprida|parcial|pendente|quebrada","fulfillment_score":0-100,"justificativa":"explicação detalhada mínimo 50 palavras","o_que_foi_feito":"o que foi realizado mínimo 20 palavras","o_que_falta":"o que ainda falta mínimo 20 palavras"}`;
              const gr = await fetch(`${AI_URL}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` }, body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.1, max_tokens: 1024 }) });
              if (!gr.ok) { failed++; await new Promise(r => setTimeout(r, 2000)); continue; }
              const gd = await gr.json();
              const parsed = JSON.parse(gd.choices[0].message.content);
              const ms = normStatus(parsed.status);
              const cr = { cumprida:[80,100], parcial:[40,79], pendente:[0,39], quebrada:[0,0] }[ms]||[0,39];
              const sc = Math.max(cr[0], Math.min(cr[1], Math.round(parsed.fulfillment_score||cr[0])));
              await dbAdmin().from('promise_explanations').update({ is_latest: false }).eq('promise_id', ev.promise_id);
              await dbAdmin().from('promise_explanations').insert({ promise_id: ev.promise_id, status: ms, fulfillment_score: sc, criterio_aplicado: 'ai_reavaliation_v2', justificativa: parsed.justificativa||'', evidencias_usadas: evidences.slice(0,5), o_que_foi_feito: parsed.o_que_foi_feito||'', o_que_falta: parsed.o_que_falta||'', confianca: evidences.length >= 2 ? 0.80 : 0.60, modelo_ia: 'llama-3.3-70b-versatile', is_latest: true, gerado_em: new Date().toISOString() });
              await dbAdmin().from('promises').update({ status: ms, fulfillment_score: sc, last_verified_at: new Date().toISOString() }).eq('id', ev.promise_id);
              upgraded++;
              await new Promise(r => setTimeout(r, 2500));
            } catch (e) { console.error('[run-pipeline:upgrade]', e.message); failed++; }
          }
          try { await dbAdmin().from('cron_executions').update({ status: 'completed', completed_at: new Date().toISOString(), promises_evaluated: upgraded, promises_failed: failed }).eq('execution_id', executionId); } catch(e){}
          return res.json({ success: true, target: 'upgrade', upgraded, failed, message: `${upgraded} avaliações convertidas via IA` });

        } else {
          // Modo daily: reavalia promessas stale
          const dailyCutoff = new Date(startTime.getTime() - 23 * 60 * 60 * 1000).toISOString();
          const [staleRes, neverRes] = await Promise.all([
            dbAdmin().from('promises').select('*').lt('last_verified_at', dailyCutoff).not('status', 'in', '("cumprida","quebrada")').limit(10),
            dbAdmin().from('promises').select('*').is('last_verified_at', null).limit(10)
          ]);
          const seen = new Set();
          const promises = [];
          for (const p of [...(staleRes.data||[]), ...(neverRes.data||[])]) { if (!seen.has(p.id)) { seen.add(p.id); promises.push(p); } }

          for (const promise of promises) {
            try {
              let evidences = [];
              if (SERPER_KEY) {
                const r = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY }, body: JSON.stringify({ q: `${promise.politician_name||''} ${(promise.promise_title||'').substring(0,50)}`, gl: 'br', hl: 'pt-br', num: 5 }) });
                if (r.ok) { const d = await r.json(); evidences = (d.organic||[]).filter(r => !isSocPipe(r.link)).map(r => ({ descricao: r.snippet||'', fonte: r.source||extractH(r.link)||'', url: r.link||'' })); }
              }
              if (!GROQ_KEY) { failed++; continue; }
              const evText = evidences.length > 0 ? evidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url})`).join('\n') : 'Nenhuma evidência encontrada.';
              const prompt = `Avaliador independente de promessas políticas brasileiras.\nPROMESSA: "${promise.promise_title}"\nPOLÍTICO: ${promise.politician_name}\nEVIDÊNCIAS:\n${evText}\nResponda JSON: {"status":"cumprida|parcial|pendente|quebrada","fulfillment_score":0-100,"justificativa":"explicação detalhada mínimo 50 palavras","o_que_foi_feito":"mínimo 20 palavras","o_que_falta":"mínimo 20 palavras"}`;
              const gr = await fetch(`${AI_URL}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` }, body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.1, max_tokens: 1024 }) });
              if (!gr.ok) { failed++; await new Promise(r => setTimeout(r, 2000)); continue; }
              const gd = await gr.json();
              const parsed = JSON.parse(gd.choices[0].message.content);
              const ms = normStatus(parsed.status);
              const cr = { cumprida:[80,100], parcial:[40,79], pendente:[0,39], quebrada:[0,0] }[ms]||[0,39];
              const sc = Math.max(cr[0], Math.min(cr[1], Math.round(parsed.fulfillment_score||cr[0])));
              await dbAdmin().from('promises').update({ status: ms, fulfillment_score: sc, ai_evaluation: parsed.justificativa, evidences_used: evidences.slice(0,5), last_verified_at: startTime.toISOString() }).eq('id', promise.id);
              await dbAdmin().from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id);
              await dbAdmin().from('promise_explanations').insert({ promise_id: promise.id, status: ms, fulfillment_score: sc, criterio_aplicado: 'ai_reavaliation_v2', justificativa: parsed.justificativa||'', evidencias_usadas: evidences.filter(e => !isSocPipe(e.url)).slice(0,5), o_que_foi_feito: parsed.o_que_foi_feito||'', o_que_falta: parsed.o_que_falta||'', confianca: evidences.length >= 2 ? 0.80 : 0.60, modelo_ia: 'llama-3.3-70b-versatile', is_latest: true, gerado_em: startTime.toISOString() });
              await dbAdmin().from('status_history').insert({ promise_id: promise.id, old_status: promise.status, new_status: ms });
              evaluated++;
              await new Promise(r => setTimeout(r, 2500));
            } catch (e) { console.error('[run-pipeline:daily]', e.message); failed++; }
          }
          try { await dbAdmin().from('cron_executions').update({ status: 'completed', completed_at: new Date().toISOString(), promises_evaluated: evaluated, promises_failed: failed }).eq('execution_id', executionId); } catch(e){}
          return res.json({ success: true, target: 'daily', evaluated, failed, total_found: promises.length, message: `${evaluated} promessas reavaliadas` });
        }
      } catch (err) {
        try { await dbAdmin().from('cron_executions').update({ status: 'failed', completed_at: new Date().toISOString(), details: err.message }).eq('execution_id', executionId); } catch(e){}
        return res.status(500).json({ error: err.message });
      }
    }

    if (path === '/api/admin/auth/github' && method === 'POST') {
      try {
        let raw = ''; req.on('data', c => raw += c); await new Promise(r => req.on('end', r));
        const { code } = JSON.parse(raw || '{}');
        if (!code) return res.status(400).json({ error: 'Código de autorização ausente' });
        const user = await exchangeGithubCode(code);
        if (!user) return res.status(401).json({ error: 'Falha na autenticação GitHub ou email não autorizado' });
        const adminJwt = signJwt(user.email);
        return res.json({ success: true, email: user.email, name: user.name, token: adminJwt });
      } catch { return res.status(400).json({ error: 'Requisição inválida' }); }
    }

    // ─── FIX EXPLANATIONS (B4-B12) ────────────────────────────────────────────
    // Corrige justificativas placeholder, evidências insuficientes, redes sociais,
    // domínios duplicados, incompatibilidade score/status
    if (path === '/api/admin/fix-explanations' && method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Não autorizado' });
      let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
      const { politician_id } = JSON.parse(body || '{}');
      if (!politician_id) return res.status(400).json({ error: 'politician_id obrigatório' });

      const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
      const SERPER_KEY = process.env.SERPER_API_KEY || '';
      const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
      const SOCIAL_BLOCKED = ['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com'];
      function isSocial(url) { if (!url) return false; try { const h = new URL(url).hostname.replace('www.',''); return SOCIAL_BLOCKED.some(s => h === s || h.endsWith('.'+s)); } catch { return false; } }
      function extractDomain(url) { if (!url) return ''; try { return new URL(url).hostname.replace('www.',''); } catch { return ''; } }
      function dedupDomains(arr) { const best = new Map(); for (const e of arr) { const d = extractDomain(e.url)||'__'; if (!best.has(d)||(e.descricao||'').length>(best.get(d).descricao||'').length) best.set(d, e); } return Array.from(best.values()); }
      const PROHIBITED = ['Aguardando dados','IA falhou','Avaliacao herdada','Nenhuma avaliação detalhada disponível','Reavaliacao automatica','Herdado do status original','Avaliação automática via pipeline','Avaliacao automatica','Análise IA.','batch-heranca','autonomous_seed','evidence_based_fallback','seed_initial_v1'];
      function isPlaceholder(t) { return !t || t.trim().length < 20 || PROHIBITED.some(p => t.includes(p)); }
      function clampScore(st, sc) { const r={cumprida:[80,100],parcial:[40,79],pendente:[0,39],quebrada:[0,0]}[normStatus(st)]||[0,39]; return Math.max(r[0],Math.min(r[1],Math.round(sc||r[0]))); }

      const { data: promises } = await db().from('promises').select('*').eq('politician_id', politician_id);
      const { data: explanations } = await db().from('promise_explanations').select('*').eq('is_latest', true);
      const relevant = (explanations||[]).filter(e => new Set((promises||[]).map(p => p.id)).has(e.promise_id));

      let fixed = 0, errors = 0, details = [];

      for (const ev of relevant) {
        try {
          const promise = (promises||[]).find(p => p.id === ev.promise_id);
          if (!promise) continue;
          let needsUpdate = false;
          const updateData = {};
          let evidencias = [...(ev.evidencias_usadas || [])];

          // B11: Remove social media evidence
          const antesSocial = evidencias.length;
          evidencias = evidencias.filter(e => !isSocial(e.url));
          if (evidencias.length < antesSocial) { needsUpdate = true; }

          // B12: Dedup domains (keep best description per domain)
          const deduped = dedupDomains(evidencias);
          if (deduped.length < evidencias.length) { needsUpdate = true; evidencias = deduped; }

          // B5-B7: Check if justificativa/o_que_foi_feito/o_que_falta are placeholders
          const badJust = isPlaceholder(ev.justificativa);
          const badFeito = isPlaceholder(ev.o_que_foi_feito);
          const badFalta = isPlaceholder(ev.o_que_falta);
          const badEvidence = evidencias.length === 0 ||
            (normStatus(ev.status) === 'cumprida' && evidencias.length < 2) ||
            (normStatus(ev.status) === 'parcial' && evidencias.length < 2);

          if (badJust || badFeito || badFalta || badEvidence) {
            // Try to get fresh evidence
            if (SERPER_KEY && evidencias.length < 3) {
              try {
                const sr = await fetch('https://google.serper.dev/search', {
                  method: 'POST', headers: { 'Content-Type':'application/json','X-API-KEY':SERPER_KEY },
                  body: JSON.stringify({ q: `${promise.politician_name} ${(promise.promise_title||'').substring(0,60)}`, gl:'br', hl:'pt-br', num:5 })
                });
                if (sr.ok) { const sd = await sr.json(); const existingUrls = new Set(evidencias.map(e=>e.url)); for (const r of (sd.organic||[])) { if (!existingUrls.has(r.link) && !isSocial(r.link)) { evidencias.push({descricao:r.snippet||'',fonte:r.source||extractDomain(r.link),url:r.link||''}); existingUrls.add(r.link); } } }
                await new Promise(r => setTimeout(r, 500));
              } catch (_) {}
            }

            // Re-evaluate via AI
            if (GROQ_KEY) {
              const evText = evidencias.length > 0 ? evidencias.map(e => `[${e.fonte||'fonte'}]: ${e.descricao||''} (${e.url})`).join('\n') : 'Nenhuma evidência encontrada.';
              const prompt = `Avaliador de promessas políticas brasileiras. PROMESSA: "${promise.promise_title}". POLÍTICO: ${promise.politician_name}. EVIDÊNCIAS:\n${evText}\nResponda JSON: {"status":"cumprida|parcial|pendente|quebrada","fulfillment_score":0-100,"justificativa":"explicação detalhada mínimo 50 caracteres","o_que_foi_feito":"o que realizou mínimo 20 caracteres","o_que_falta":"o que falta mínimo 20 caracteres"}`;
              const gr = await fetch(`${AI_URL}/chat/completions`, {
                method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${GROQ_KEY}` },
                body: JSON.stringify({ model:'llama-3.3-70b-versatile', messages:[{role:'user',content:prompt}], response_format:{type:'json_object'}, temperature:0.1, max_tokens:1024 })
              });
              if (gr.ok) {
                const gd = await gr.json();
                const parsed = JSON.parse(gd.choices[0].message.content);
                const ms = normStatus(parsed.status);
                updateData.status = ms;
                updateData.fulfillment_score = clampScore(ms, parsed.fulfillment_score);
                updateData.justificativa = parsed.justificativa || ev.justificativa;
                updateData.o_que_foi_feito = parsed.o_que_foi_feito || ev.o_que_foi_feito;
                updateData.o_que_falta = parsed.o_que_falta || ev.o_que_falta;
                updateData.evidencias_usadas = evidencias.slice(0, 5);
                updateData.modelo_ia = 'llama-3.3-70b-versatile';
                updateData.confianca = evidencias.length >= 2 ? 0.80 : 0.60;
                needsUpdate = true;
                await new Promise(r => setTimeout(r, 2000));
              }
            }
          }

          // B4: Fix score/status alignment
          if (!updateData.status && ev.status && ev.fulfillment_score != null) {
            const corrected = clampScore(ev.status, ev.fulfillment_score);
            if (corrected !== ev.fulfillment_score) { updateData.fulfillment_score = corrected; needsUpdate = true; }
          }

          // Se só houve limpeza de evidências (B11/B12) sem reavaliação, salva mesmo assim
          if (needsUpdate && Object.keys(updateData).length === 0) {
            updateData.evidencias_usadas = evidencias.slice(0, 5);
            updateData.criterio_aplicado = 'ai_fix_evidences_v1';
          }

          if (needsUpdate && Object.keys(updateData).length > 0) {
            // Mark old as not latest and insert new explanation
            const oldId = ev.id;
            await dbAdmin().from('promise_explanations').update({ is_latest: false }).eq('id', oldId);
            await dbAdmin().from('promise_explanations').insert({
              promise_id: ev.promise_id,
              status: updateData.status || ev.status,
              fulfillment_score: updateData.fulfillment_score ?? ev.fulfillment_score,
              criterio_aplicado: updateData.criterio_aplicado || 'ai_fix_explanations_v1',
              justificativa: updateData.justificativa || ev.justificativa || '',
              evidencias_usadas: updateData.evidencias_usadas || ev.evidencias_usadas || [],
              o_que_foi_feito: updateData.o_que_foi_feito || ev.o_que_foi_feito || '',
              o_que_falta: updateData.o_que_falta || ev.o_que_falta || '',
              confianca: updateData.confianca ?? ev.confianca ?? 0.5,
              modelo_ia: updateData.modelo_ia || ev.modelo_ia || 'fix-v1',
              is_latest: true, gerado_em: new Date().toISOString()
            });
            // Also update the promise itself
            await dbAdmin().from('promises').update({
              status: updateData.status || ev.status,
              fulfillment_score: updateData.fulfillment_score ?? ev.fulfillment_score,
              last_verified_at: new Date().toISOString()
            }).eq('id', ev.promise_id);
            fixed++;
            details.push({ promise_id: ev.promise_id, title: promise.promise_title?.substring(0,40), issues: Object.keys(updateData).join(',') });
          }
        } catch (e) { errors++; console.error('[fix-explanations]', e.message); }
      }

      return res.json({ fixed, errors, total: relevant.length, details });
    }

    // ─── FIX CADASTRO (A1-A4) ───────────────────────────────────────────────────
    // Busca dados faltantes de um político via Serper+Groq
    if (path === '/api/admin/fix-cadastro' && method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Não autorizado' });
      let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
      const { politician_id } = JSON.parse(body || '{}');
      if (!politician_id) return res.status(400).json({ error: 'politician_id obrigatório' });

      const { data: pol } = await db().from('politicians').select('*').eq('id', politician_id).single();
      if (!pol) return res.status(404).json({ error: 'Político não encontrado' });

      const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
      const SERPER_KEY = process.env.SERPER_API_KEY || '';
      const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';

      // Buscar info na web
      let snippets = '';
      if (SERPER_KEY) {
        try {
          const q = `${pol.name} político cargo partido estado`;
          const sr = await fetch('https://google.serper.dev/search', { method:'POST', headers:{'Content-Type':'application/json','X-API-KEY':SERPER_KEY}, body: JSON.stringify({ q, gl:'br', hl:'pt-br', num:5 }) });
          if (sr.ok) { const sd = await sr.json(); snippets = (sd.organic||[]).map(s=>s.snippet).filter(Boolean).join(' | '); }
        } catch (_) {}
      }

      const updates = {};
      if (!pol.name || pol.name.trim().length < 3) {
        // Try Wikipedia
        try {
          const wikiRes = await fetch(`https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(politician_id)}&format=json&origin=*&srlimit=3`);
          if (wikiRes.ok) { const wikiData = await wikiRes.json(); const first = wikiData?.query?.search?.[0]; if (first) updates.name = first.title; }
        } catch (_) {}
      }
      if (!pol.role || !pol.state || !pol.party || pol.role === 'politico') {
        if (GROQ_KEY && snippets) {
          const prompt = `Extraia dados do político brasileiro. Contexto: ${snippets}\nResponda JSON: ${JSON.stringify({name: pol.name, role:'Presidente|Governador|Prefeito|Senador|Deputado Federal|Deputado Estadual', state:'sigla UF ou BR', party:'sigla partido'})}`;
          try {
            const gr = await fetch(`${AI_URL}/chat/completions`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${GROQ_KEY}`}, body:JSON.stringify({ model:'llama-3.1-8b-instant', messages:[{role:'user',content:prompt}], response_format:{type:'json_object'}, temperature:0.1, max_tokens:300 }) });
            if (gr.ok) { const gd = await gr.json(); const p = JSON.parse(gd.choices[0].message.content);
              if (p.role && (!pol.role || pol.role === 'politico')) updates.role = p.role;
              if (p.state && !pol.state) updates.state = p.state.toUpperCase().substring(0,2);
              if (p.party && !pol.party) updates.party = p.party.toUpperCase();
            }
          } catch (_) {}
        }
      }
      // A5: Try to fix photo (sempre tenta, mesmo se URL existente estiver quebrada)
      let photoUpdated = false;
      try {
        const photoUrl = await fetchWikipediaPhoto(pol.name);
        if (photoUrl) {
          // Verifica se a URL realmente funciona antes de salvar
          const testRes = await fetch(photoUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => null);
          if (testRes && (testRes.ok || testRes.status === 200 || testRes.status === 301 || testRes.status === 302)) {
            updates.photo_url = photoUrl;
            photoUpdated = true;
          }
        }
      } catch (_) {}
      if (!photoUpdated) {
        // Fallback: tenta buscar foto de outra fonte (Wikipedia com redirect)
        try {
          const altUrl = `https://pt.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pol.name)}&prop=pageimages&piprop=original&format=json&origin=*`;
          const altRes = await fetch(altUrl, { headers: { 'User-Agent': WIKI_UA } });
          if (altRes.ok) {
            const altData = await altRes.json();
            const pages = altData?.query?.pages;
            if (pages) {
              const page = Object.values(pages)[0];
              if (page?.original?.source) {
                updates.photo_url = page.original.source;
              }
            }
          }
        } catch (_) {}
      }

      if (Object.keys(updates).length > 0) {
        await dbAdmin().from('politicians').update(updates).eq('id', politician_id);
      }

      return res.json({ fixed: Object.keys(updates).length, updates, politician: pol.name });
    }

    // ─── SEED LEGAL FACTS (D1-D6) ────────────────────────────────────────────
    // Busca fatos jurídicos de um político via Serper+Groq
    if (path === '/api/admin/seed-legal-facts' && method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Não autorizado' });
      let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
      const { politician_id, politician_name } = JSON.parse(body || '{}');
      if (!politician_id) return res.status(400).json({ error: 'politician_id obrigatório' });

      const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
      const SERPER_KEY = process.env.SERPER_API_KEY || '';
      const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';

      // Find or create mandate
      let { data: mandate } = await db().from('mandates').select('id').eq('politician_id', politician_id).eq('is_active', true).maybeSingle();
      if (!mandate) {
        const { data: nm } = await dbAdmin().from('mandates').insert({ politician_id, position:'Cargo Público', start_date:'2023-01-01', end_date:'2026-12-31', is_active:true }).select().single();
        mandate = nm;
      }

      const nome = politician_name || 'político';
      let snippets = '';
      if (SERPER_KEY) {
        try {
          const queries = [
            `"${nome}" condenação processo judicial`,
            `"${nome}" investigação STF MP`,
            `"${nome}" irregularidade administrativa Tribunal Contas`
          ];
          for (const q of queries) {
            const sr = await fetch('https://google.serper.dev/search', { method:'POST', headers:{'Content-Type':'application/json','X-API-KEY':SERPER_KEY}, body:JSON.stringify({ q, gl:'br', hl:'pt-br', num:5 }) });
            if (sr.ok) { const sd = await sr.json(); snippets += (sd.organic||[]).map(s=>`TÍTULO:${s.title}\nSNIPPET:${s.snippet}\nURL:${s.link}`).join('\n---\n') + '\n'; }
            await new Promise(r => setTimeout(r, 500));
          }
        } catch (_) {}
      }

      if (!GROQ_KEY) return res.status(400).json({ error: 'GROQ_API_KEY não configurado' });

      const prompt = `Extraia FATOS JURÍDICOS reais sobre ${nome}. Inclua apenas condenações, investigações formais, alertas ou irregularidades com respaldo em fontes confiáveis.
${snippets}
Responda JSON. Se não houver fatos concretos, retorne array vazio:
{"facts": [{"fact_type":"condemnation|investigation|alert|irregularity","description":"descrição detalhada","source":"URL da fonte","date":"AAAA-MM-DD","title":"título curto"}]}`;

      const gr = await fetch(`${AI_URL}/chat/completions`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${GROQ_KEY}`}, body:JSON.stringify({ model:'llama-3.1-8b-instant', messages:[{role:'user',content:prompt}], response_format:{type:'json_object'}, temperature:0.1, max_tokens:2048 }) });
      if (!gr.ok) return res.status(500).json({ error: `Groq error: ${gr.status}` });
      const gd = await gr.json();
      const parsed = JSON.parse(gd.choices[0].message.content);
      const facts = parsed.facts || parsed.legal_facts || [];

      // Delete existing and insert new
      await dbAdmin().from('legal_facts').delete().eq('politician_id', politician_id);

      const TYPE_MAP = { condemnation:'condemnation', condenação:'condemnation', investigation:'investigation', investigação:'investigation', alert:'alert', alerta:'alert', irregularity:'irregularity', irregularidade:'irregularity' };
      let inserted = 0, errors = 0;
      for (const f of facts) {
        if (!f.fact_type || !f.description) continue;
        const rawType = (f.fact_type||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        const ft = TYPE_MAP[rawType] || 'alert';
        const { error } = await dbAdmin().from('legal_facts').insert({
          politician_id, mandate_id: mandate?.id || null,
          fact_type: ft, title: f.title || `${ft} - ${nome}`,
          description: f.description, source: f.source || '',
          date: f.date || new Date().toISOString().split('T')[0],
          is_active: true
        });
        if (error) { errors++; console.error('[seed-legal-facts] insert error:', error); }
        else inserted++;
      }

      return res.json({ inserted, total: facts.length, errors, politician: nome });
    }

    // ─── RECALCULATE SCORES (B14, C3, D1, E1-E3) ──────────────────────────────
    // Recalcula C1, C2, C3, final_score e grade
    if (path === '/api/admin/recalculate-scores' && method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Não autorizado' });
      let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
      const { politician_id } = JSON.parse(body || '{}');
      if (!politician_id) return res.status(400).json({ error: 'politician_id obrigatório' });

      const { data: pol } = await db().from('politicians').select('*').eq('id', politician_id).single();
      if (!pol) return res.status(404).json({ error: 'Político não encontrado' });

      const { data: promises } = await db().from('promises').select('*').eq('politician_id', politician_id);
      const { data: explanations } = await db().from('promise_explanations').select('*').eq('is_latest', true);
      const { data: indicators } = await db().from('indicators').select('*').eq('politician_id', politician_id);
      const { data: legalFacts } = await db().from('legal_facts').select('*').eq('politician_id', politician_id);

      // C1 calculation
      const evalMap = {};
      (explanations||[]).forEach(e => evalMap[e.promise_id] = e);
      let f = 0, pa = 0;
      (promises||[]).forEach(p => {
        const ev = evalMap[p.id]; const s = ev ? normStatus(ev.status) : normStatus(p.status);
        if (s === 'cumprida') f++; else if (s === 'parcial') pa++;
      });
      const total = (promises||[]).length;
      const c1 = total > 0 ? parseFloat(((f * 1.0 + pa * 0.5) / total * 100).toFixed(1)) : 0;

      // C2 calculation
      const CAT_WEIGHTS = { seguranca: 0.30, financas: 0.40, funcionalismo: 0.30 };
      const catScores = { seguranca: [], financas: [], funcionalismo: [] };
      (indicators||[]).forEach(i => { if (i.score != null && catScores[i.category]) catScores[i.category].push(i.score); });
      let wSum = 0, sSum = 0;
      for (const [cat, scores] of Object.entries(catScores)) {
        if (scores.length > 0) { const avg = scores.reduce((a,b) => a+b, 0)/scores.length; sSum += avg * (CAT_WEIGHTS[cat]||0); wSum += CAT_WEIGHTS[cat]||0; }
      }
      const c2 = wSum > 0 ? parseFloat((sSum / wSum).toFixed(1)) : null;

      // C3 calculation
      const PENALTY_MAP = { condemnation: 50, investigation: 20, alert: 10, irregularity: 5 };
      let c3 = 100;
      (legalFacts||[]).forEach(fact => { if (fact.is_active !== false) c3 -= PENALTY_MAP[fact.fact_type] || 0; });
      c3 = Math.max(0, c3);

      // Final score
      const w1 = 0.40, w2 = 0.35, w3 = 0.25;
      let pesoTotal = w1, scorePonderado = c1 * w1;
      if (c2 != null) { scorePonderado += c2 * w2; pesoTotal += w2; }
      if (c3 != null) { scorePonderado += c3 * w3; pesoTotal += w3; }
      let finalScore = pesoTotal > 0 ? parseFloat((scorePonderado / pesoTotal).toFixed(1)) : 0;
      if (c3 < 20) finalScore = Math.min(finalScore, 59);

      const grade = finalScore >= 80 ? 'A' : finalScore >= 60 ? 'B' : finalScore >= 40 ? 'C' : finalScore >= 20 ? 'D' : 'F';
      const cappedGrade = c3 < 20 ? (finalScore >= 40 ? 'C' : finalScore >= 20 ? 'D' : 'F') : grade;

      await dbAdmin().from('politicians').update({
        c1_score: c1, c2_score: c2, c3_score: c3,
        final_score: parseFloat(finalScore.toFixed(1)), grade: cappedGrade,
        methodology_version: '1.0', last_evaluated_at: new Date().toISOString()
      }).eq('id', politician_id);

      return res.json({
        success: true, politician: pol.name,
        scores: { c1, c2, c3, final_score: parseFloat(finalScore.toFixed(1)), grade: cappedGrade },
        breakdown: { promises_total: total, cumpridas: f, parciais: pa, indicators: (indicators||[]).length, legal_facts: (legalFacts||[]).length }
      });
    }

    if (path.startsWith('/api/admin/qualidade')) {
      const admin = requireAdmin(req);
      if (!admin) return res.status(401).json({ error: 'Não autorizado' });

      if (path === '/api/admin/qualidade/run' && method === 'POST') {
        const auditResult = await runAudit({ autoFix: true });
        const qualidade = await runQualidadeAudit();
        return res.json({ audit: auditResult, qualidade: { metodologia_versao: '1.0', politicos: qualidade } });
      }

      if (path === '/api/admin/qualidade') {
        const report = await runQualidadeAudit();
        return res.json({ metodologia_versao: '1.0', politicos: report });
      }

      if (method === 'GET') {

      const parts = path.split('/');
      const slug = parts[parts.length - 1];

      if (slug === 'export') {
        const report = await runQualidadeAudit();
        const format = req.query?.format || 'json';

        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename=qualidade-promessometro.csv');
          let csv = 'Nome,Status,Score,Bloco A,Bloco B,Bloco C,Bloco D,Bloco E,Falhas\n';
          (report || []).forEach(p => {
            const falhas = (p.criterios_falhos || []).map(f => `${f.id}: ${f.descricao}`).join('; ');
            const aOk = (p.criterios_ok || []).filter(id => id.startsWith('A')).length;
            const bOk = (p.criterios_ok || []).filter(id => id.startsWith('B')).length;
            const cOk = (p.criterios_ok || []).filter(id => id.startsWith('C')).length;
            const dOk = (p.criterios_ok || []).filter(id => id.startsWith('D')).length;
            const eOk = (p.criterios_ok || []).filter(id => id.startsWith('E')).length;
            csv += `"${p.nome}","${p.status}",${p.score_qualidade},${aOk}/${5},${bOk}/${14},${cOk}/${4},${dOk}/${6},${eOk}/${3},"${falhas}"\n`;
          });
          return res.status(200).send(csv);
        }

        return res.json({ metodologia_versao: '1.0', exportado_em: new Date().toISOString(), politicos: report });
      }

      const fullReport = await runQualidadeAudit();
      const politico = (fullReport || []).find(p => p.id === slug);
      if (!politico) return res.status(404).json({ error: 'Político não encontrado' });

      return res.json({ metodologia_versao: '1.0', politico });
      }
    }

    return res.status(404).json({ error: 'Endpoint nao encontrado', path });
  } catch (err) {
    return res.status(500).json({ error: err.message, detail: err.stack });
  }
}