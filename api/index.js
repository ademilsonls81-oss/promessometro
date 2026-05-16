import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co',
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis'
  );
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
      const { data: promises } = await db().from('promises').select('id, status').limit(100);
      let seeded = 0;
      for (const p of promises || []) {
        const { data: exists } = await db().from('promise_explanations').select('id').eq('promise_id', p.id).eq('is_latest', true).maybeSingle();
        if (exists) continue;
        const scoreMap = { cumprida: 85, parcial: 50, pendente: 20, quebrada: 0 };
        await db().from('promise_explanations').update({ is_latest: false }).eq('promise_id', p.id);
        await db().from('promise_explanations').insert({
          promise_id: p.id, status: normStatus(p.status), fulfillment_score: scoreMap[normStatus(p.status)] || 20,
          criterio_aplicado: 'batch-heranca', justificativa: 'Avaliacao herdada do status original', evidencias_usadas: [],
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

    return res.status(404).json({ error: 'Endpoint nao encontrado', path });
  } catch (err) {
    return res.status(500).json({ error: err.message, detail: err.stack });
  }
}