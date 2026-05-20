import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
const SERPER_KEY = process.env.SERPER_API_KEY || '';
const AI_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const MAJORITARIOS = ['presidente','governador','prefeito','senador'];
const ELECTION_YEARS = {
  presidente: 2022, governador: 2022, senador: 2022,
  deputado_federal: 2022, deputado_estadual: 2022,
  prefeito: 2024, vereador: 2024
};
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_FALLBACK = 'llama-3.3-70b-versatile';
const BATCH_SIZE = 3;

function normalizeCategory(cat) {
  if (!cat) return 'Outros';
  const map = { saude:'Saude', educacao:'Educacao', educaçao:'Educacao', seguranca:'Seguranca', segurança:'Seguranca', economia:'Economia', infraestrutura:'Infraestrutura', meio_ambiente:'Meio_Ambiente', meioambiente:'Meio_Ambiente', trabalho:'Trabalho', habitacao:'Habitacao', habitação:'Habitacao', transporte:'Transporte' };
  const key = cat.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return map[key] || 'Outros';
}

function extractTextFromHTML(html) {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
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

async function fetchText(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) return '';
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const buf = await r.arrayBuffer();
        const pd = await pdfParse(Buffer.from(buf));
        return pd.text || '';
      } catch (e) {
        console.error('pdf-parse error:', e.message);
        return '';
      }
    }
    return extractTextFromHTML(await r.text());
  } catch { return ''; }
}

async function buscarPDF(nome, ano) {
  if (!SERPER_KEY) return '';
  try {
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
      body: JSON.stringify({
        q: `"${nome}" "plano de governo" ${ano} filetype:pdf OR site:tse.jus.br OR site:divulgacandcontas`,
        gl: 'br', hl: 'pt-br', num: 10
      })
    });
    if (!r.ok) return '';
    const d = await r.json();
    const results = d.organic || [];
    const pdf = results.find(r => r.link?.toLowerCase().endsWith('.pdf'));
    return pdf?.link || results[0]?.link || '';
  } catch { return ''; }
}

async function downloadPDF(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(30000)
    });
    if (!r.ok) return '';
    const buf = await r.arrayBuffer();
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const pd = await pdfParse(Buffer.from(buf));
      return pd.text || '';
    } catch (e) {
      console.error('pdf-parse error:', e.message);
      return '';
    }
  } catch { return ''; }
}

async function extractWithGroq(text, nome, cargo, opts = {}) {
  if (!GROQ_KEY) return [];
  const maxChars = 90000;
  const chunk = text.substring(0, maxChars);

  const prompt = `Extraia TODAS as promessas de campanha, propostas e compromissos de ${nome} (${cargo || 'politico'}).

Texto:
${chunk}

REGRAS:
1. Extraia CADA promessa individualmente
2. "construir 10 hospitais e 50 escolas" = DUAS promessas
3. Nao invente promessas — extraia apenas do texto fornecido
4. Extraia o maximo possivel

Responda JSON:
{"promessas":[{"titulo":"promessa","descricao":"detalhes","categoria":"Categoria"}]}`;

  const model = (opts.attempt || 0) > 0 ? GROQ_FALLBACK : GROQ_MODEL;
  try {
    const r = await fetch(`${AI_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 8192
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!r.ok) return [];
    const d = await r.json();
    if (d.error) return [];
    const text = (d.choices?.[0]?.message?.content || '[]').trim();
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : (parsed.promessas || parsed.promises || []);
    return arr.filter(p => p.titulo && p.titulo.length > 3);
  } catch { return []; }
}

async function buscarArtigos(nome, cargo, ano) {
  if (!SERPER_KEY) return [];
  const queries = [
    `"${nome}" promessa OR proposta OR compromisso ${ano}`,
    `"${nome}" entrevista OR sabatina ${ano}`,
    `"${nome}" debate eleitoral ${ano}`,
    `"${nome}" programa de governo OR plano ${ano}`
  ];
  const results = await Promise.all(queries.map(q => searchSerper(q)));
  const articles = results.flat();
  const uniqueUrls = new Set();
  const unique = articles.filter(a => {
    if (uniqueUrls.has(a.url)) return false;
    uniqueUrls.add(a.url);
    return true;
  });

  const texts = await Promise.all(unique.slice(0, 6).map(async a => {
    const text = await fetchText(a.url);
    return text ? { titulo: a.titulo, text } : null;
  }));
  const validTexts = texts.filter(Boolean);
  if (validTexts.length === 0) return [];

  let all = [];
  for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
    const batch = validTexts.slice(i, i + BATCH_SIZE);
    const combined = batch.map(a => `=== ${a.titulo} ===\n${a.text.substring(0, 8000)}`).join('\n\n');
    const promises = await extractWithGroq(combined, nome, cargo, { attempt: i });
    all.push(...promises);
  }
  return all;
}

function isDuplicate(title, existingTitles) {
  const words = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  return existingTitles.some(e => {
    const eWords = e.split(/\s+/).filter(w => w.length > 3);
    const inter = words.filter(w => eWords.includes(w));
    return inter.length >= Math.min(3, words.length * 0.4);
  });
}

function chunkIntoPages(text, maxChars) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.substring(i, i + maxChars));
    i += maxChars;
  }
  return chunks;
}

async function updateStage(dbClient, jobId, stage, progress) {
  await dbClient.from('discovery_jobs').update({ stage, progress }).eq('id', jobId).catch(() => {});
}

async function processJob(dbClient, job) {
  const isMaj = MAJORITARIOS.includes((job.role || '').toLowerCase());
  const year = ELECTION_YEARS[job.role?.toLowerCase()] || 2022;
  let allPromises = [];

  if (isMaj) {
    await updateStage(dbClient, job.id, 'buscando_pdf', 10);

    let pdfUrl = '';
    try {
      pdfUrl = await buscarPDF(job.politician_name, year);
    } catch (e) { console.error('Erro buscando PDF:', e.message); }

    if (pdfUrl) {
      await dbClient.from('discovery_jobs').update({ pdf_source_url: pdfUrl }).eq('id', job.id).catch(() => {});
      await updateStage(dbClient, job.id, 'baixando_pdf', 20);

      let pdfText = '';
      try {
        pdfText = await downloadPDF(pdfUrl);
      } catch (e) { console.error('Erro baixando PDF:', e.message); }

      if (pdfText && pdfText.length > 200) {
        await updateStage(dbClient, job.id, 'extraindo_pdf', 30);

        const pages = chunkIntoPages(pdfText, 30000);
        const limitedPages = pages.slice(0, 50);

        for (let i = 0; i < limitedPages.length; i++) {
          const progress = 30 + Math.round((i / limitedPages.length) * 35);
          await updateStage(dbClient, job.id, 'analisando_groq', progress);

          try {
            const batch = limitedPages[i];
            const promises = await extractWithGroq(batch, job.politician_name, job.role, { attempt: i });
            allPromises.push(...promises.map(p => ({ ...p, fonte: 'pdf_tse' })));
          } catch (e) {
            console.error('Erro Groq batch', i, e.message);
          }
        }
      }
    }

    if (allPromises.length === 0) {
      await dbClient.from('discovery_jobs').update({
        erro: 'PDF nao localizado ou vazio, usando Serper'
      }).eq('id', job.id).catch(() => {});
    }
  }

  await updateStage(dbClient, job.id, 'buscando_artigos', isMaj ? 70 : 20);

  try {
    const serperPromises = await buscarArtigos(job.politician_name, job.role, year);
    allPromises.push(...serperPromises.map(p => ({ ...p, fonte: 'serper' })));
  } catch (e) {
    console.error('Erro buscando artigos:', e.message);
  }

  await updateStage(dbClient, job.id, 'deduplicando', 85);

  let existingTitles = [];
  try {
    const { data: existing } = await dbClient.from('promises')
      .select('id, promise_title')
      .eq('politician_id', job.politician_id);
    existingTitles = (existing || []).map(p => p.promise_title.toLowerCase());
  } catch (e) {
    console.error('Erro buscando existentes:', e.message);
  }

  const unique = [];
  for (const p of allPromises) {
    if (!isDuplicate(p.titulo, existingTitles)) {
      unique.push(p);
      existingTitles.push(p.titulo.toLowerCase());
    }
  }

  await updateStage(dbClient, job.id, 'inserindo', 95);

  let inserted = 0;
  for (const p of unique) {
    try {
      const { error } = await dbClient.from('promises').insert({
        politician_id: job.politician_id,
        politician_name: job.politician_name,
        promise_title: p.titulo.trim(),
        category: normalizeCategory(p.categoria),
        status: 'pendente',
        fulfillment_score: 50,
        party: job.party
      });
      if (!error) inserted++;
    } catch (e) {
      console.error('Erro inserindo promessa:', e.message);
    }
  }

  await dbClient.from('discovery_jobs').update({
    status: 'completed',
    stage: 'completed',
    progress: 100,
    total_extraidas: allPromises.length,
    total_inseridas: inserted,
    completed_at: new Date().toISOString()
  }).eq('id', job.id).catch(() => {});

  return { processed: 1, job_id: job.id, extraidas: allPromises.length, inseridas: inserted };
}

export default async function handler(req, res) {
  const dbClient = db();

  try {
    // Processa job específico (chamado via start-discovery-job)
    if (req._specificJobId) {
      const { data: job } = await dbClient.from('discovery_jobs').select('*').eq('id', req._specificJobId).single();
      if (!job) return res.json({ processed: 0, error: 'Job nao encontrado' });
      if (job.status === 'completed' || job.status === 'failed') {
        return res.json({ processed: 0, message: 'Job ja finalizado' });
      }
      // Marca como processing antes de comecar
      await dbClient.from('discovery_jobs').update({
        status: 'processing',
        stage: 'pending',
        progress: 0,
        started_at: new Date().toISOString()
      }).eq('id', job.id);
      const result = await processJob(dbClient, job);
      return res.json(result);
    }

    // Cron mode: pega pending + processing travados (> 15min)
    const quinzeMinAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: jobs } = await dbClient
      .from('discovery_jobs')
      .select('*')
      .or(`status.eq.pending,and(status.eq.processing,started_at.lt.${quinzeMinAtras})`)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!jobs || jobs.length === 0) {
      return res.json({ processed: 0, message: 'Nenhum job pendente' });
    }

    const job = jobs[0];
    await dbClient.from('discovery_jobs').update({
      status: 'processing',
      stage: 'pending',
      progress: 0,
      started_at: new Date().toISOString()
    }).eq('id', job.id);

    const result = await processJob(dbClient, job);
    return res.json(result);

  } catch (err) {
    console.error('Discovery job error:', err);
    if (req._specificJobId) {
      await dbClient.from('discovery_jobs').update({
        status: 'failed',
        stage: 'failed',
        erro: err.message || String(err),
        completed_at: new Date().toISOString()
      }).eq('id', req._specificJobId).catch(() => {});
    }
    return res.status(500).json({ error: err.message });
  }
}
