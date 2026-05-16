import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

function db() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function toSlug(name) {
  if (!name) return '';
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function normStatus(s) {
  const m = { 'cumprida': 'cumprida', 'parcial': 'parcial', 'parcialmente_cumprida': 'parcial', 'em_andamento': 'parcial', 'nao_iniciada': 'pendente', 'nao_classificada': 'pendente', 'pendente': 'pendente', 'descumprida': 'quebrada', 'quebrada': 'quebrada', 'nao_cumprida': 'quebrada', 'fulfilled': 'cumprida', 'broken': 'quebrada' };
  return m[s] || 'pendente';
}

export default async function handler(req, res) {
  const path = req.url;
  const method = req.method;
  res.setHeader('Content-Type', 'application/json');

  try {
    if (path === '/api/health') {
      return res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (path === '/api/politicians/ranking' && method === 'GET') {
      const [polRes, evalRes, promRes] = await Promise.all([
        db().from('politicians').select('id, name, role, state, party, slug, photo_url'),
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
        return { ...pol, stats: { fulfilled: f, partial: pa, broken: b, pending: pe, total: list.length }, percentage: pct, promise_count: list.length };
      }).filter(p => p.promise_count > 0).sort((a, b) => b.percentage - a.percentage);

      return res.json({ ranking: ranking.slice(0, 50), total: ranking.length });
    }

    if (path === '/api/promises' && method === 'GET') {
      const { data, error } = await db().from('promises').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ promises: (data || []).map(p => ({ ...p, slug: toSlug(p.politician_name) })), total: data?.length || 0 });
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
      const { data: promises } = await db().from('promises').select('id, status, fulfillment_score').limit(100);
      let seeded = 0;
      for (const p of promises || []) {
        const { data: exists } = await db().from('promise_explanations').select('id').eq('promise_id', p.id).eq('is_latest', true).maybeSingle();
        if (exists) continue;
        const norm = normStatus(p.status);
        const [min, max] = scoreRanges[norm] || [0, 39];
        const score = p.fulfillment_score ? Math.max(min, Math.min(max, p.fulfillment_score)) : Math.round((min + max) / 2);
        await db().from('promise_explanations').update({ is_latest: false }).eq('promise_id', p.id);
        await db().from('promise_explanations').insert({
          promise_id: p.id, status: norm, fulfillment_score: score,
          criterio_aplicado: 'batch-heranca', justificativa: `Avaliacao herdada do status original (${norm}, score ${score})`, evidencias_usadas: [],
          o_que_falta: 'Avaliacao detalhada pendente', o_que_foi_feito: 'Herdado do status original',
          confianca: 0.5, modelo_ia: 'batch-v1', is_latest: true, gerado_em: new Date().toISOString()
        });
        seeded++;
        await new Promise(r => setTimeout(r, 50));
      }
      return res.json({ seeded, total: promises?.length || 0 });
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

      return res.json({ politician: pol, stats: { fulfilled: f, partial: pa, broken: b, pending: pe, total }, percentage: pct, promises: promisesWith });
    }

    if (path === '/api/promises/submit' && method === 'POST') {
      let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
      const d = JSON.parse(body);
      if (!d.politician_name || !d.promise_title) return res.status(400).json({ error: 'Nome e titulo obrigatorios' });

      let politicianId = null;
      const { data: polData } = await db().from('politicians').select('id').ilike('name', d.politician_name.trim()).maybeSingle();
      if (polData) politicianId = polData.id;

      const { data, error } = await db().from('promises').insert({
        politician_name: d.politician_name.trim(), promise_title: d.promise_title.trim(),
        promise_description: d.promise_description?.trim() || null, category: d.category || 'Outros',
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
      const { data: promise, error } = await db().from('promises').select('*').eq('id', id).maybeSingle();
      if (error || !promise) return res.status(404).json({ error: 'Promessa nao encontrada' });
      const { data: evaluation } = await db().from('promise_explanations').select('*').eq('promise_id', id).eq('is_latest', true).maybeSingle();
      return res.json({ ...promise, evaluation: evaluation || null });
    }

    return res.status(404).json({ error: 'Endpoint nao encontrado', path });
  } catch (err) {
    return res.status(500).json({ error: err.message, detail: err.stack });
  }
}