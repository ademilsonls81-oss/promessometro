import { createClient } from '@supabase/supabase-js';
import { runAudit } from './lib/metodologiaAudit.js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
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
  const path = req.url;
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

      // Fetch mandate + layers
      const { data: mandate } = await db().from('mandates').select('*').eq('politician_id', pol.id).eq('is_active', true).maybeSingle();
      const { data: indicators } = mandate?.id ? await db().from('indicators').select('*').eq('mandate_id', mandate.id) : { data: [] };
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
      c2 = c2WeightSum > 0 ? parseFloat((c2ScoreSum / c2WeightSum).toFixed(1)) : 0;

      // Calculate C3
      let c3 = 100;
      const penaltyMap = { 'condemnation': 50, 'investigation': 20, 'alert': 10, 'irregularity': 5 };
      (legalFacts || []).forEach(fact => {
        if (fact.is_active !== false) {
          const pts = penaltyMap[fact.fact_type] || 0;
          if (pts > 0) c3 -= pts;
        }
      });
      c3 = Math.max(0, c3);

      // Calculate final score
      const w1 = 0.40, w2 = 0.35, w3 = 0.25;
      let finalScore = (c1 * w1) + (c2 * w2) + (c3 * w3);
      let grade;
      if (c3 < 20) { finalScore = Math.min(finalScore, 59); }
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

    if (path === '/api/audit-metodologia') {
      const fix = req.method === 'POST';
      const report = await runAudit({ fix });
      return res.json(report);
    }

    return res.status(404).json({ error: 'Endpoint nao encontrado', path });
  } catch (err) {
    return res.status(500).json({ error: err.message, detail: err.stack });
  }
}