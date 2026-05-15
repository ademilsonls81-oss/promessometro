import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_S_URL || 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis';
const supabase = createClient(supabaseUrl, supabaseKey);

function toSlug(name) {
  if (!name) return '';
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function extractPositionFromSource(source) {
  if (!source) return null;
  const sourceLower = source.toLowerCase();
  if (sourceLower.includes('presidente')) return 'Presidente';
  if (sourceLower.includes('governador')) return 'Governador';
  if (sourceLower.includes('senador')) return 'Senador';
  if (sourceLower.includes('deputado federal')) return 'Deputado Federal';
  if (sourceLower.includes('deputado estadual')) return 'Deputado Estadual';
  if (sourceLower.includes('vereador')) return 'Vereador';
  if (sourceLower.includes('prefeito')) return 'Prefeito';
  if (sourceLower.includes('tse')) return 'Candidato';
  return null;
}

export default async function handler(req, res) {
  const path = req.url;
  const method = req.method;

  res.setHeader('Content-Type', 'application/json');

  if (path === '/api/health') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

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
      if (p.status === 'cumprida') statsMap[name].fulfilled++;
      else if (p.status === 'parcialmente_cumprida') statsMap[name].partial++;
      else if (p.status === 'descumprida') statsMap[name].broken++;
      else statsMap[name].pending++;
    });

    const ranking = Object.entries(statsMap).map(([name, stats]) => ({
      name,
      slug: toSlug(name),
      stats,
      percentage: stats.total > 0 ? Math.round((stats.fulfilled + stats.partial * 0.5) / stats.total * 100) : 50,
      promise_count: stats.total
    }));

    ranking.sort((a, b) => b.percentage - a.percentage);

    return res.status(200).json({ ranking: ranking.slice(0, 50), total: ranking.length });
  }

  if (path.startsWith('/api/politician/') && method === 'GET') {
    const slug = path.replace('/api/politician/', '');
    const nameQuery = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    const { data: promises, error } = await supabase
      .from('promises')
      .select('*')
      .ilike('politician_name', `%${nameQuery}%`);

    if (error) return res.status(500).json({ error: error.message });
    
    const name = promises?.[0]?.politician_name || slug;
    
    const { data: politicians } = await supabase
      .from('politicians')
      .select('name, party, state, position')
      .ilike('name', `%${name}%`)
      .limit(1);
    
    const politicianData = politicians?.[0] || {};
    
    const stats = { fulfilled: 0, partial: 0, broken: 0, pending: 0, total: promises?.length || 0 };
    (promises || []).forEach(p => {
      if (p.status === 'cumprida') stats.fulfilled++;
      else if (p.status === 'parcialmente_cumprida') stats.partial++;
      else if (p.status === 'descumprida') stats.broken++;
      else stats.pending++;
    });
    
    const percentage = stats.total > 0 ? Math.round((stats.fulfilled / stats.total) * 100) : 0;
    
    return res.status(200).json({ 
      name, 
      slug, 
      party: politicianData.party || null,
      state: politicianData.state || null,
      position: politicianData.position || null,
      stats, 
      percentage,
      promise_count: stats.total,
      promises: promises || []
    });
  }

  if (path === '/api/promises' && method === 'GET') {
    const { data: promises, error } = await supabase
      .from('promises')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    const promisesWithSlug = (promises || []).map(p => ({
      ...p,
      slug: toSlug(p.politician_name)
    }));
    return res.status(200).json({ promises: promisesWithSlug, total: promises?.length || 0 });
  }

  if (path === '/api/promises/submit' && method === 'POST') {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      await new Promise(resolve => req.on('end', resolve));
      const data = JSON.parse(body);
      const { politician_name, promise_title, promise_description, category, source_link, position, state } = data;

      if (!politician_name || !promise_title) {
        return res.status(400).json({ error: 'Nome do político e título são obrigatórios' });
      }

      const finalPosition = position || extractPositionFromSource(source_link);
      if (!finalPosition) {
        return res.status(400).json({ error: 'Cargo (position) é obrigatório. Envie no campo "position" ou inclua no link (ex: TSE, campanha)' });
      }

      if (state && !/^[A-Z]{2}$/.test(state)) {
        return res.status(400).json({ error: 'Estado deve ter exatamente 2 letras maiúsculas (ex: MG, SP)' });
      }

      const cleanName = politician_name.trim();
      const { data: existingPolitician } = await supabase
        .from('politicians')
        .select('id')
        .ilike('nome', `%${cleanName}%`)
        .limit(1);

      if (!existingPolitician) {
        const { error: politicianError } = await supabase.from('politicians').insert({
          nome: cleanName,
          cargo: finalPosition,
          estado: state || null,
          partido: null
        });
        if (politicianError && politicianError.code !== '23505') {
          console.error('[Promises:Submit] Politician insert error:', politicianError.message);
        }
      }

      const { data: inserted, error } = await supabase.from('promises').insert({
        politician_name: cleanName,
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

  if (path === '/api/politicians' && method === 'POST') {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      await new Promise(resolve => req.on('end', resolve));
      const data = JSON.parse(body);
      const { name, party, position, state, photo_url, source } = data;

      if (!name) {
        return res.status(400).json({ error: 'Nome do político é obrigatório' });
      }

      if (!position) {
        return res.status(400).json({ error: 'Cargo (position) é obrigatório' });
      }

      const extractedPosition = extractPositionFromSource(source);
      const finalPosition = position || extractedPosition;
      if (!finalPosition) {
        return res.status(400).json({ error: 'Cargo (position) é obrigatório' });
      }

      if (state) {
        if (!/^[A-Z]{2}$/.test(state)) {
          return res.status(400).json({ error: 'Estado deve ter exatamente 2 letras maiúsculas (ex: MG, SP)' });
        }
      }

      const generatedSlug = toSlug(name);

      const insertData = {
        nome: name.trim(),
        cargo: finalPosition,
        estado: state || null,
        foto_url: photo_url || null,
        partido: party || null
      };

      const { data: inserted, error } = await supabase
        .from('politicians')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Político já existe' });
        }
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({ success: true, data: inserted });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(404).json({ error: 'Endpoint não encontrado', path });
}