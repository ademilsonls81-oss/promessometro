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

function normalizeCategory(cat) {
  if (!cat) return 'Outros';
  const map = { saude:'Saude', saude:'Saude', educacao:'Educacao', educaçao:'Educacao', seguranca:'Seguranca', segurança:'Seguranca', economia:'Economia', infraestrutura:'Infraestrutura', meio_ambiente:'Meio_Ambiente', meio ambiente:'Meio_Ambiente', trabalho:'Trabalho', habitacao:'Habitacao', habitação:'Habitacao', transporte:'Transporte' };
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

async function fetchText(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) return '';
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('pdf')) {
      const buf = await r.arrayBuffer();
      // Fallback: try pdf-parse if available, otherwise return as text attempt
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const pd = await pdfParse(Buffer.from(buf));
        return pd.text || '';
      } catch {
        // pdf-parse not available, convert buffer to string
        return Buffer.from(buf).toString('utf-8').substring(0, 80000);
      }
    }
    return extractTextFromHTML(await r.text());
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

async function extractWithGroq(text, politicianName, role) {
  if (!GROQ_KEY || GROQ_KEY.startsWith('YOUR_')) return [];
  const maxChars = 90000;
  const chunk = text.substring(0, maxChars);

  const prompt = `Extraia TODAS as promessas de campanha, propostas e compromissos do plano de governo de ${politicianName} (${role || 'politico'}).

Texto do plano de governo:
${chunk}

REGRAS:
1. Extraia CADA promessa individualmente
2. Promessas vagas tambem contam (ex: "vou melhorar a educacao")
3. "construir 10 hospitais e 50 escolas" = DUAS promessas
4. Nao invente promessas — extraia apenas do texto fornecido
5. Extraia o maximo possivel

Responda JSON:
{"promessas":[{"titulo":"promessa","descricao":"detalhes","categoria":"Categoria"}]}`;

  try {
    const r = await fetch(`${AI_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 8192
      })
    });
    if (!r.ok) return [];
    const d = await r.json();
    if (d.error) return [];
    let text = (d.choices?.[0]?.message?.content || '[]').trim();
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : (parsed.promessas || parsed.promises || []);
    return arr.filter(p => p.titulo && p.titulo.length > 3);
  } catch { return []; }
}

async function discoverFromSerper(politicianName, roleLabel) {
  if (!SERPER_KEY) return [];
  const queries = [
    `"${politicianName}" promessas OR propostas "${roleLabel}"`,
    `"${politicianName}" entrevista OR sabatina promessas "${roleLabel}"`,
    `"${politicianName}" debate eleitoral propostas "${roleLabel}"`,
    `"${politicianName}" programa de governo "${roleLabel}"`
  ];
  const results = await Promise.all(queries.map(q => searchSerper(q)));
  const articles = results.flat();
  const uniqueUrls = new Set();
  const unique = articles.filter(a => { if (uniqueUrls.has(a.url)) return false; uniqueUrls.add(a.url); return true; });
  const htmlTexts = await Promise.all(unique.slice(0, 5).map(async a => {
    const text = await fetchText(a.url);
    return text ? { titulo: a.titulo, text } : null;
  }));
  return htmlTexts.filter(Boolean);
}

function isMajoritario(role) {
  const r = (role || '').toLowerCase();
  return r === 'governador' || r === 'presidente' || r === 'prefeito' || r === 'senador';
}

export default async function handler(req, res) {
  const cronSecret = req.headers['x-cron-secret'];
  const expected = process.env.CRON_SECRET || 'promessometro-dev';
  if (cronSecret !== expected) {
    // Allow running via POST without secret in development
    if (process.env.NODE_ENV !== 'production' && req.method === 'POST') {
      // OK
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Pega proximo job pendente
  const { data: jobs } = await db()
    .from('discovery_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (!jobs || jobs.length === 0) {
    return res.json({ processed: 0, message: 'Nenhum job pendente' });
  }

  const job = jobs[0];
  console.log(`Processing discovery job ${job.id} for ${job.politician_name}`);

  // Marca como processing
  await db().from('discovery_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', job.id);

  try {
    let totalExtraidas = 0;
    let allPromises = [];

    if (isMajoritario(job.role)) {
      // ETAPA 1: Buscar PDF do plano de governo
      console.log('Searching for PDF...');
      const pdfQuery = `"${job.politician_name}" "plano de governo" filetype:pdf`;
      const pdfResults = await searchSerper(pdfQuery);
      const pdfUrl = pdfResults.find(r => r.url.toLowerCase().endsWith('.pdf') || r.descricao.toLowerCase().includes('pdf'))?.url || '';

      let pdfText = '';
      if (pdfUrl) {
        console.log('PDF found:', pdfUrl);
        await db().from('discovery_jobs').update({ pdf_url: pdfUrl }).eq('id', job.id);
        pdfText = await fetchText(pdfUrl);
        if (pdfText && pdfText.length > 100) {
          console.log(`PDF text extracted: ${pdfText.length} chars`);
          await db().from('discovery_jobs').update({ pdf_text: pdfText.substring(0, 50000) }).eq('id', job.id);
          const pdfPromises = await extractWithGroq(pdfText, job.politician_name, job.role);
          console.log(`Extracted ${pdfPromises.length} promises from PDF`);
          allPromises.push(...pdfPromises.map(p => ({ ...p, fonte: 'pdf_tse' })));
          totalExtraidas += pdfPromises.length;
        }
      }

      // Se nao achou PDF ou extraiu 0, registra
      if (!pdfText || pdfText.length < 100) {
        await db().from('discovery_jobs').update({ erro: 'PDF nao localizado ou vazio, usando fallback Serper' }).eq('id', job.id);
      }
    }

    // ETAPA 2: Complementar com Serper (para todos os cargos)
    const roleLabel = ['governador', 'presidente', 'prefeito', 'senador'].includes((job.role || '').toLowerCase())
      ? (job.role === 'presidente' ? 'presidente' : (job.role || 'governo'))
      : (job.role || 'politico');

    if (SERPER_KEY) {
      const serperArticles = await discoverFromSerper(job.politician_name, roleLabel);
      if (serperArticles.length > 0) {
        const combinedText = serperArticles.map(a => `=== ${a.titulo} ===\n${a.text.substring(0, 5000)}`).join('\n\n');
        const serperPromises = await extractWithGroq(combinedText, job.politician_name, job.role);
        console.log(`Extracted ${serperPromises.length} promises from Serper articles`);
        allPromises.push(...serperPromises.map(p => ({ ...p, fonte: 'serper' })));
        totalExtraidas += serperPromises.length;
      }
    }

    await db().from('discovery_jobs').update({ total_extraidas: totalExtraidas }).eq('id', job.id);

    // Dedup contra promessas existentes
    const { data: existingProms } = await db()
      .from('promises')
      .select('id, promise_title')
      .eq('politician_id', job.politician_id);
    const existingTitles = (existingProms || []).map(p => p.promise_title.toLowerCase());

    let inserted = 0;
    for (const p of allPromises) {
      const words = p.titulo.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const isDup = existingTitles.some(e => {
        const eWords = e.split(/\s+/).filter(w => w.length > 3);
        const inter = words.filter(w => eWords.includes(w));
        return inter.length >= Math.min(3, words.length * 0.4);
      });
      if (isDup) continue;

      const { error } = await db().from('promises').insert({
        politician_id: job.politician_id,
        politician_name: job.politician_name,
        promise_title: p.titulo.trim(),
        category: normalizeCategory(p.categoria),
        status: 'pendente',
        fulfillment_score: 50,
        party: job.party
      });
      if (!error) {
        inserted++;
        existingTitles.push(p.titulo.toLowerCase());
      }
    }

    await db().from('discovery_jobs').update({
      total_inseridas: inserted,
      status: 'completed',
      completed_at: new Date().toISOString()
    }).eq('id', job.id);

    console.log(`Job ${job.id} completed: ${inserted} promises inserted`);

    return res.json({
      processed: 1,
      job_id: job.id,
      politician: job.politician_name,
      extraidas: totalExtraidas,
      inseridas: inserted
    });

  } catch (err) {
    console.error('Discovery job error:', err);
    await db().from('discovery_jobs').update({
      status: 'error',
      erro: err.message || String(err),
      completed_at: new Date().toISOString()
    }).eq('id', job.id);
    return res.status(500).json({ error: err.message });
  }
}
