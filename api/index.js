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

const STATUS_MAP = {
  'cumprida': 'cumprida', 'parcialmente_cumprida': 'parcial', 'em_andamento': 'parcial',
  'nao_iniciada': 'pendente', 'nao_classificada': 'pendente', 'pendente': 'pendente',
  'descumprida': 'quebrada', 'parcial': 'parcial', 'quebrada': 'quebrada'
};

const STATUS_SCORE_RANGES = {
  cumprida: [80, 100], parcial: [40, 79], pendente: [0, 39], quebrada: [0, 0]
};

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

    let query = supabase.from('politicians').select('id, name, role, state, party, slug, photo_url, is_active');
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data: politicians, error: polError } = await query;
    if (polError) return res.status(500).json({ error: polError.message });

    const { data: evaluations } = await supabase
      .from('promise_explanations')
      .select('promise_id, status, fulfillment_score, confianca')
      .eq('is_latest', true);

    const { data: promises } = await supabase
      .from('promises')
      .select('id, politician_id, politician_name');

    const evalByPromise = {};
    (evaluations || []).forEach(e => { evalByPromise[e.promise_id] = e; });

    const promiseByPol = {};
    (promises || []).forEach(p => {
      const polId = p.politician_id || p.politician_name;
      if (!promiseByPol[polId]) promiseByPol[polId] = [];
      promiseByPol[polId].push({ ...p, evaluation: evalByPromise[p.id] || null });
    });

    const ranking = (politicians || []).map(pol => {
      const polPromises = promiseByPol[pol.id] || promiseByPol[pol.name] || [];
      const evaluated = polPromises.filter(p => p.evaluation);
      const stats = {
        fulfilled: evaluated.filter(e => e.evaluation.status === 'cumprida').length,
        partial: evaluated.filter(e => e.evaluation.status === 'parcial').length,
        broken: evaluated.filter(e => e.evaluation.status === 'quebrada').length,
        pending: evaluated.filter(e => e.evaluation.status === 'pendente').length,
        total: polPromises.length,
        without_evaluation: polPromises.length - evaluated.length
      };
      const avgScore = evaluated.length > 0
        ? Math.round(evaluated.reduce((sum, e) => sum + (e.evaluation.fulfillment_score || 0), 0) / evaluated.length)
        : 0;
      const avgConfidence = evaluated.length > 0
        ? Math.round(evaluated.reduce((sum, e) => sum + ((e.evaluation.confianca || 0) * 100), 0) / evaluated.length)
        : 0;
      const evalPercentage = evaluated.length > 0
        ? Math.round((evaluated.filter(e => e.evaluation.status === 'cumprida').length
          + evaluated.filter(e => e.evaluation.status === 'parcial').length * 0.5) / evaluated.length * 100)
        : 0;

      return {
        ...pol,
        stats,
        percentage: evalPercentage,
        avg_score: avgScore,
        avg_confidence: avgConfidence,
        promise_count: polPromises.length,
        evaluated_count: evaluated.length
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

    // Buscar evaluations para todas as promessas
    let promisesWithEval = promises || [];
    if (promises && promises.length > 0) {
      const promiseIds = promises.map(p => p.id);

      const [{ data: evaluations }, { data: evidences }] = await Promise.all([
        supabase.from('promise_explanations').select('*').in('promise_id', promiseIds).eq('is_latest', true),
        supabase.from('promise_evidences').select('*').in('promise_id', promiseIds)
      ]);

      const evalMap = {};
      (evaluations || []).forEach(e => { evalMap[e.promise_id] = e; });

      promisesWithEval = promises.map(p => ({
        ...p,
        evaluation: evalMap[p.id] || null,
        promise_evidences: (evidences || []).filter(e => e.promise_id === p.id)
      }));
    }

    // Stats baseados nas evaluations (fonte única da verdade)
    const stats = { fulfilled: 0, partial: 0, broken: 0, pending: 0, total: 0, without_evaluation: 0 };
    let totalScore = 0;
    let evaluatedCount = 0;
    (promisesWithEval || []).forEach(p => {
      stats.total++;
      const evalStatus = p.evaluation?.status || p.status;
      if (!p.evaluation) { stats.without_evaluation++; }
      if (evalStatus === 'cumprida') { stats.fulfilled++; totalScore += p.evaluation?.fulfillment_score || 95; evaluatedCount++; }
      else if (evalStatus === 'parcial') { stats.partial++; totalScore += p.evaluation?.fulfillment_score || 50; evaluatedCount++; }
      else if (evalStatus === 'quebrada') { stats.broken++; totalScore += 0; evaluatedCount++; }
      else { stats.pending++; if (p.evaluation) { totalScore += p.evaluation?.fulfillment_score || 20; evaluatedCount++; } }
    });
    
    const avgScore = evaluatedCount > 0 ? Math.round(totalScore / evaluatedCount) : 0;
    const percentage = stats.total > 0 ? Math.round(((stats.fulfilled + stats.partial * 0.5) / stats.total) * 100) : 0;
    
    return res.status(200).json({ 
      politician,
      stats, 
      percentage,
      avg_score: avgScore,
      promises: promisesWithEval
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

  if (path.startsWith('/api/evaluate/') && method === 'GET') {
    const promiseId = path.replace('/api/evaluate/', '');
    if (!promiseId) return res.status(400).json({ error: 'promiseId é obrigatório' });

    const { data: evaluation, error } = await supabase
      .from('promise_explanations')
      .select('*')
      .eq('promise_id', promiseId)
      .eq('is_latest', true)
      .single();

    if (error || !evaluation) {
      const { data: promise } = await supabase
        .from('promises')
        .select('id, status, fulfillment_score, ai_evaluation, evidences_used')
        .eq('id', promiseId)
        .single();

      if (!promise) return res.status(404).json({ error: 'Promessa não encontrada' });

      return res.status(200).json({
        promise_id: promiseId,
        status: promise.status || 'pendente',
        score: promise.fulfillment_score ?? 50,
        confidence: 0,
        justification: promise.ai_evaluation || 'Aguardando avaliação completa',
        sources: promise.evidences_used || [],
        evaluated_at: null,
        is_fresh: false,
        has_evaluation: false
      });
    }

    return res.status(200).json({
      promise_id: promiseId,
      status: evaluation.status,
      score: evaluation.fulfillment_score,
      confidence: (evaluation.confianca || 0) * 100,
      justification: evaluation.justificativa || '',
      sources: evaluation.evidencias_usadas || [],
      evaluated_at: evaluation.gerado_em,
      is_fresh: true,
      has_evaluation: true,
      criteria: evaluation.criterio_aplicado,
      what_was_done: evaluation.o_que_foi_feito,
      what_is_missing: evaluation.o_que_falta,
      model: evaluation.modelo_ia
    });
  }

  if (path === '/api/batch-evaluate' && method === 'POST') {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      await new Promise(resolve => req.on('end', resolve));
      const { limit = 50 } = JSON.parse(body || '{}');

      const { data: promises } = await supabase
        .from('promises')
        .select('id, promise_title, politician_name, category, status, fulfillment_score')
        .order('last_verified_at', { ascending: nullsFirst: true })
        .limit(limit);

      if (!promises || promises.length === 0) {
        return res.status(200).json({ evaluated: 0, message: 'Nenhuma promessa para avaliar' });
      }

      const results = [];
      for (const p of promises) {
        const { data: evalExists } = await supabase
          .from('promise_explanations')
          .select('id')
          .eq('promise_id', p.id)
          .eq('is_latest', true)
          .single();

        if (evalExists) { results.push({ id: p.id, status: 'already_evaluated' }); continue; }

        const statusMap = {
          'cumprida': { status: 'cumprida', score: 85, confianca: 0.75, justification: 'Status herdado do registro original. Aguardando avaliação por IA.' },
          'parcial': { status: 'parcial', score: 50, confianca: 0.5, justification: 'Status herdado. Avaliação parcial baseada em dados disponíveis.' },
          'pendente': { status: 'pendente', score: 20, confianca: 0.3, justification: 'Promessa registrada. Aguardando evidências para avaliação completa.' },
          'quebrada': { status: 'quebrada', score: 0, confianca: 0.8, justification: 'Status herdado. Promessa registrada como não cumprida.' }
        };

        const eval = statusMap[p.status] || statusMap['pendente'];
        await supabase.from('promise_explanations').update({ is_latest: false }).eq('promise_id', p.id);
        await supabase.from('promise_explanations').insert({
          promise_id: p.id,
          status: eval.status,
          fulfillment_score: eval.score,
          criterio_aplicado: 'batch-heranca',
          justificativa: eval.justification,
          evidencias_usadas: [],
          o_que_falta: 'Avaliação detalhada pendente',
          o_que_foi_feito: 'Avaliação herdada do status original',
          confianca: eval.confianca,
          modelo_ia: 'batch-v1',
          is_latest: true,
          gerado_em: new Date().toISOString()
        });

        results.push({ id: p.id, status: eval.status, score: eval.score });
      }

      return res.status(200).json({ evaluated: results.length, results });
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