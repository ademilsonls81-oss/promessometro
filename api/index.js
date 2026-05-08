const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  const path = req.url;
  const method = req.method;

  res.setHeader('Content-Type', 'application/json');

  // Health check
  if (path === '/api/health') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // GET /api/politicians/ranking
  if (path === '/api/politicians/ranking' && method === 'GET') {
    const { data: promises, error } = await supabase
      .from('promises')
      .select('politician_name, status, fulfillment_score');

    if (error) return res.status(500).json({ error: error.message });

    const statsMap = {};
    (promises || []).forEach(p => {
      const name = p.politician_name;
      if (!statsMap[name]) {
        statsMap[name] = { fulfilled: 0, partial: 0, broken: 0, pending: 0, total: 0 };
      }
      statsMap[name].total++;
      if (p.status === 'fulfilled') statsMap[name].fulfilled++;
      else if (p.status === 'partial' || p.status === 'partial_fulfilled') statsMap[name].partial++;
      else if (p.status === 'broken' || p.status === 'not_fulfilled') statsMap[name].broken++;
      else statsMap[name].pending++;
    });

    const ranking = Object.entries(statsMap).map(([name, stats]) => ({
      name,
      role: null, state: null, party: null,
      stats,
      percentage: stats.total > 0 ? Math.round((stats.fulfilled + stats.partial * 0.5) / stats.total * 100) : 50,
      promise_count: stats.total
    }));

    ranking.sort((a, b) => b.percentage - a.percentage);

    return res.status(200).json({
      ranking: ranking.slice(0, 50),
      total: ranking.length,
      stats: { total_promises: promises?.length || 0, total_politicians: ranking.length }
    });
  }

  // GET /api/politicians/:name
  const politicianMatch = path.match(/^\/api\/politicians\/(.+)$/);
  if (politicianMatch && method === 'GET') {
    const name = decodeURIComponent(politicianMatch[1]);
    const { data: promises, error } = await supabase
      .from('promises')
      .select('*')
      .ilike('politician_name', `%${name}%`)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!promises?.length) return res.status(404).json({ error: 'Político não encontrado' });

    const stats = { fulfilled: 0, partial: 0, broken: 0, pending: 0, total: promises.length, percentage: 50 };
    promises.forEach(p => {
      if (p.status === 'fulfilled') stats.fulfilled++;
      else if (p.status === 'partial' || p.status === 'partial_fulfilled') stats.partial++;
      else if (p.status === 'broken' || p.status === 'not_fulfilled') stats.broken++;
      else stats.pending++;
    });
    stats.percentage = stats.total > 0 ? Math.round((stats.fulfilled + stats.partial * 0.5) / stats.total * 100) : 50;

    return res.status(200).json({
      name, position: null, party: null, state: null, photo_url: null,
      stats,
      promises: promises.map(p => ({
        id: p.id, title: p.promise_title, description: p.promise_description,
        category: p.category, status: p.status, evidence: p.evidence,
        source_link: p.source_link, fulfillment_score: p.fulfillment_score,
        created_at: p.created_at, updated_at: p.updated_at
      }))
    });
  }

  // GET /api/promises
  if (path === '/api/promises' && method === 'GET') {
    const { data: promises, error } = await supabase
      .from('promises')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ promises: promises || [], total: promises?.length || 0 });
  }

  // POST /api/promises/submit
  if (path === '/api/promises/submit' && method === 'POST') {
    try {
      let body = '';
      await new Promise((resolve) => {
        req.on('data', chunk => body += chunk);
        req.on('end', resolve);
      });
      const data = JSON.parse(body);
      const { politician_name, promise_title, promise_description, category, source_link } = data;

      if (!politician_name || !promise_title) {
        return res.status(400).json({ error: 'Nome do político e título são obrigatórios' });
      }

      const { data: inserted, error } = await supabase.from('promises').insert({
        politician_name: politician_name.trim(),
        promise_title: promise_title.trim(),
        promise_description: promise_description?.trim() || null,
        category: category || 'Outros',
        source_link: source_link || null,
        status: 'pendente',
        fulfillment_score: 50
      }).select().single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ success: true, data: inserted });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(404).json({ error: 'Endpoint não encontrado', path });
};