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

  if (path.startsWith('/api/politicians/ranking') && method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const { data: promises, error: promError } = await supabase
      .from('promises')
      .select('politician_id, politician_name, status, fulfillment_score');

    if (promError) return res.status(500).json({ error: promError.message });

    const statsMap = {};
    (promises || []).forEach(p => {
      const id = p.politician_id || p.politician_name;
      if (!statsMap[id]) {
        statsMap[id] = { fulfilled: 0, partial: 0, broken: 0, pending: 0, total: 0, name: p.politician_name };
      }
      statsMap[id].total++;
      if (p.status === 'cumprida') statsMap[id].fulfilled++;
      else if (p.status === 'parcialmente_cumprida' || p.status === 'parcial') statsMap[id].partial++;
      else if (p.status === 'descumprida') statsMap[id].broken++;
      else statsMap[id].pending++;
    });

    let query = supabase.from('politicians').select('id, name, role, state, party, slug, photo_url, is_active');
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data: politicians, error: polError } = await query;

    if (polError) return res.status(500).json({ error: polError.message });

    const ranking = (politicians || []).map(pol => {
      const stats = statsMap[pol.id] || statsMap[pol.name] || { fulfilled: 0, partial: 0, broken: 0, pending: 0, total: 0 };
      return {
        ...pol,
        stats,
        percentage: stats.total > 0 ? Math.round((stats.fulfilled + stats.partial * 0.5) / stats.total * 100) : 0,
        promise_count: stats.total
      };
    }).filter(p => p.promise_count > 0);

    ranking.sort((a, b) => b.percentage - a.percentage);

    return res.status(200).json({ ranking: ranking.slice(0, 50), total: ranking.length });
  }

  if (path === '/api/stats' && method === 'GET') {
    const { count: politiciansCount } = await supabase.from('politicians').select('*', { count: 'exact', head: true });
    const { count: activePoliticiansCount } = await supabase.from('politicians').select('*', { count: 'exact', head: true }).eq('is_active', true);
    const { count: promisesCount } = await supabase.from('promises').select('*', { count: 'exact', head: true });

    return res.status(200).json({
      total_politicians: politiciansCount || 0,
      active_politicians: activePoliticiansCount || 0,
      total_promises: promisesCount || 0
    });
  }

  if (path.startsWith('/api/politician/') && method === 'GET') {
    const slug = path.replace('/api/politician/', '');
    
    const { data: politician, error: polError } = await supabase
      .from('politicians')
      .select('*')
      .eq('slug', slug)
      .single();

    if (polError || !politician) {
      return res.status(404).json({ error: 'Político não encontrado' });
    }
    
    const { data: promises, error: promError } = await supabase
      .from('promises')
      .select('*')
      .eq('politician_id', politician.id)
      .order('created_at', { ascending: false });

    if (promError) return res.status(500).json({ error: promError.message });

    // Buscar evidências separadamente se houver promessas
    let promisesWithEvidences = promises || [];
    if (promises && promises.length > 0) {
      const promiseIds = promises.map(p => p.id);
      const { data: evidences } = await supabase
        .from('promise_evidences')
        .select('*')
        .in('promise_id', promiseIds);
      
      if (evidences) {
        promisesWithEvidences = promises.map(p => ({
          ...p,
          promise_evidences: evidences.filter(e => e.promise_id === p.id)
        }));
      }
    }
    
    const stats = { fulfilled: 0, partial: 0, broken: 0, pending: 0, total: promises?.length || 0 };
    (promises || []).forEach(p => {
      if (p.status === 'cumprida') stats.fulfilled++;
      else if (p.status === 'parcialmente_cumprida' || p.status === 'parcial') stats.partial++;
      else if (p.status === 'descumprida') stats.broken++;
      else stats.pending++;
    });
    
    const percentage = stats.total > 0 ? Math.round((stats.fulfilled / stats.total) * 100) : 0;
    
    return res.status(200).json({ 
      politician,
      stats, 
      percentage,
      promises: promisesWithEvidences
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

  if (path === '/api/seed-evaluations' && method === 'POST') {
    const supabaseService = createClient(
      process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
    );

    const statusMap = {
      'cumprida': { score: 90, justification: 'Promessa cumprida - ações concretas implementadas', confianca: 85 },
      'parcial': { score: 60, justification: 'Promessa parcialmente cumprida - progresso demonstrado mas incomplete', confianca: 70 },
      'pendente': { score: 30, justification: 'Promessa ainda em andamento ou não iniciada', confianca: 50 },
      'quebrada': { score: 0, justification: 'Promessa não cumprida', confianca: 80 }
    };

    const { data: promises } = await supabaseService
      .from('promises')
      .select('id, promise_title, politician_name, status');

    let seeded = 0;
    for (const p of promises || []) {
      const mapping = statusMap[p.status] || statusMap['pendente'];
      const exists = await supabaseService
        .from('promise_explanations')
        .select('id')
        .eq('promise_id', p.id)
        .eq('is_latest', true)
        .single();

      if (!exists.data) {
        await supabaseService.from('promise_explanations').insert({
          promise_id: p.id,
          status: p.status,
          fulfillment_score: mapping.score,
          criterio_aplicado: 'seed_2026',
          justificativa: mapping.justification,
          evidencias_usadas: [],
          o_que_falta: p.status === 'cumprida' ? 'Completo' : 'Avaliação detalhada pendente',
          o_que_foi_feito: mapping.justification,
          confianca: mapping.confianca,
          modelo_ia: 'seed-v1',
          is_latest: true,
          gerado_em: new Date().toISOString()
        });
        seeded++;
      }
    }

    return res.status(200).json({ success: true, seeded, total: promises?.length || 0 });
  }

  if (path === '/api/force-reavaliation' && method === 'POST') {
    const supabaseService = createClient(
      process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
    );

    const POLITICIANS = ['Lula', 'Nunes', 'Paes', 'Zema'];
    const results = [];

    for (const name of POLITICIANS) {
      const { data: promises } = await supabaseService
        .from('promises')
        .select('id, promise_title, politician_name, category')
        .ilike('politician_name', `%${name}%`)
        .limit(5);

      if (!promises || promises.length === 0) continue;

      for (const promise of promises) {
        const { data: evidences } = await supabaseService
          .from('promise_evidences')
          .select('titulo, descricao, url, fonte')
          .eq('promise_id', promise.id)
          .limit(8);

        if (!evidences || evidences.length === 0) {
          results.push({ promise: promise.promise_title, status: 'no_evidences' });
          continue;
        }

        const evText = evidences.map(e => `[${e.fonte}]: ${e.descricao || e.titulo} (${e.url || 'sem link'})`).join('\n');

        const prompt = `Avaliador de promessas políticas brasileiras. PROMESSA: ${promise.promise_title}. POLÍTICO: ${promise.politician_name}. EVIDÊNCIAS: ${evText}. CRITÉRIOS: cumprida (80-100), parcialmente_cumprida (40-79), em_andamento (20-39), nao_iniciada (0-19), descumprida (0). Responda JSON: {"status":"status","fulfillment_score":0-100,"justificativa":"explicação"}`;

        try {
          const groqKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
          const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';

          const r = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.1, max_tokens: 512 })
          });

          if (!r.ok) throw new Error(`Groq ${r.status}`);

          const d = await r.json();
          const p = JSON.parse((d.choices?.[0]?.message?.content || '{}').match(/\{[\s\S]*\}/)?.[0] || '{}');

          const statusMap = { 'cumprida': 'cumprida', 'parcialmente_cumprida': 'parcial', 'em_andamento': 'parcial', 'nao_iniciada': 'pendente', 'descumprida': 'quebrada' };
          const newStatus = statusMap[p.status] || 'pendente';

          await supabaseService.from('promises').update({
            status: newStatus,
            fulfillment_score: p.fulfillment_score || 50,
            ai_evaluation: p.justificativa || '',
            last_verified_at: new Date().toISOString()
          }).eq('id', promise.id);

          results.push({ promise: promise.promise_title, status: newStatus, score: p.fulfillment_score });
        } catch (err) {
          results.push({ promise: promise.promise_title, status: 'error', error: err.message });
        }

        await new Promise(r => setTimeout(r, 300));
      }
    }

    return res.status(200).json({ success: true, results });
  }

  return res.status(404).json({ error: 'Endpoint não encontrado', path });
}