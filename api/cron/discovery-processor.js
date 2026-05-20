import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
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
const PAGE_SIZE = 2000;
const PARALLEL = 3;
const ROUNDS = 3;
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
      signal: AbortSignal.timeout(6000)
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
  if (!GROQ_KEY) {
    console.error('[GROQ] GROQ_KEY vazia — verifique GROQ_API_KEY ou OPENAI_API_KEY');
    return [];
  }
  let chunk = text.substring(0, 20000);
  const model = GROQ_MODEL;

  for (let tentativa = 0; tentativa < 3; tentativa++) {
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

    try {
      const r = await fetch(`${AI_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 1024
        }),
        signal: AbortSignal.timeout(25000)
      });
      if (r.status === 429) {
        console.error(`[GROQ] HTTP 429 (tentativa=${tentativa+1}) — aguardando 4s`);
        await new Promise(rr => setTimeout(rr, 4000));
        continue;
      }
      if (r.status === 413) {
        console.error(`[GROQ] HTTP 413 — chunk ${chunk.length} chars, reduzindo`);
        chunk = chunk.substring(0, Math.floor(chunk.length / 2));
        if (chunk.length < 200) return [];
        continue;
      }
      if (!r.ok) {
        console.error(`[GROQ] HTTP ${r.status}`);
        return [];
      }
      const d = await r.json();
      if (d.error) {
        console.error(`[GROQ] API error: ${d.error?.message || JSON.stringify(d.error)}`);
        return [];
      }
      const raw = (d.choices?.[0]?.message?.content || '').trim();
      if (!raw) { console.error('[GROQ] resposta vazia'); return []; }
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : (parsed.promessas || parsed.promises || []);
      return arr.filter(p => p.titulo && p.titulo.length > 3);
    } catch (e) {
      if (tentativa < 2) {
        console.error(`[GROQ] exception (tentativa ${tentativa+1}): ${e?.message} — retry 4s`);
        await new Promise(rr => setTimeout(rr, 4000));
        continue;
      }
      console.error(`[GROQ] exception final: ${e?.message || e}`);
      return [];
    }
  }
  return [];
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

  if (validTexts.length === 0) {
    console.log(`[SERPER] fetchText falhou, usando snippets (${unique.length} artigos)`);
    const snippetText = unique.map(a => `=== ${a.titulo} ===\n${a.descricao}`).join('\n\n').substring(0, 3000);
    if (snippetText.length > 200) {
      return await extractWithGroq(snippetText, nome, cargo);
    }
    return [];
  }

  let all = [];
  for (let i = 0; i < validTexts.length && i < 9; i += BATCH_SIZE) {
    const batch = validTexts.slice(i, i + BATCH_SIZE);
    const combined = batch.map(a => `=== ${a.titulo} ===\n${a.text.substring(0, 6000)}`).join('\n\n');
    const promises = await extractWithGroq(combined, nome, cargo);
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
  const { error } = await dbClient.from('discovery_jobs').update({ stage, progress }).eq('id', jobId);
  if (error) console.error(`[DB] updateStage(${stage}): ${error.message}`);
}

async function saveCheckpoint(dbClient, jobId, currentPage, totalPages, partialPromises) {
  const { error } = await dbClient.from('discovery_jobs').update({
    current_page: currentPage,
    total_pages: totalPages,
    partial_promises: JSON.stringify(partialPromises),
    total_extraidas: partialPromises.length,
    last_checkpoint_at: new Date().toISOString(),
    progress: totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0,
    stage: currentPage >= totalPages ? 'checkpoint_final' : 'checkpoint_salvo'
  }).eq('id', jobId);
  if (error) console.error(`[DB] checkpoint: ${error.message}`);
}

async function setupPDFJob(dbClient, job) {
  if (job.pdf_text) {
    return { pdfText: job.pdf_text, totalPages: job.total_pages || 0 };
  }

  const isMaj = MAJORITARIOS.includes((job.role || '').toLowerCase());
  if (!isMaj) return { pdfText: '', totalPages: 0 };

  console.log(`[SETUP] Baixando PDF para ${job.politician_name}`);
  await updateStage(dbClient, job.id, 'buscando_pdf', 10);

  let pdfUrl = '';
  try {
    pdfUrl = await buscarPDF(job.politician_name, ELECTION_YEARS[job.role?.toLowerCase()] || 2022);
    console.log(`[SETUP] PDF ${pdfUrl ? 'encontrado' : 'NAO encontrado'}`);
  } catch (e) { console.error('[SETUP] Erro buscando PDF:', e.message); }

  if (!pdfUrl) {
    await dbClient.from('discovery_jobs').update({ erro: 'PDF nao localizado' }).eq('id', job.id);
    return { pdfText: '', totalPages: 0 };
  }

  await dbClient.from('discovery_jobs').update({ pdf_source_url: pdfUrl }).eq('id', job.id);
  await updateStage(dbClient, job.id, 'baixando_pdf', 20);

  let pdfText = '';
  try {
    pdfText = await downloadPDF(pdfUrl);
    console.log(`[SETUP] PDF baixado: ${pdfText.length} chars`);
  } catch (e) { console.error('[SETUP] Erro baixando PDF:', e.message); }

  if (!pdfText || pdfText.length < 200) {
    await dbClient.from('discovery_jobs').update({ erro: 'PDF vazio ou corrompido' }).eq('id', job.id);
    return { pdfText: '', totalPages: 0 };
  }

  const pages = chunkIntoPages(pdfText, PAGE_SIZE);
  const totalPages = pages.length;
  console.log(`[SETUP] PDF dividido em ${totalPages} paginas de ${PAGE_SIZE} chars`);

  const { error: saveErr } = await dbClient.from('discovery_jobs').update({
    pdf_text: pdfText,
    total_pages: totalPages,
    total_extraidas: 0,
    progress: 0,
    stage: 'extraindo_pdf'
  }).eq('id', job.id);
  if (saveErr) console.error(`[DB] save pdf_text: ${saveErr.message}`);

  return { pdfText, totalPages };
}

async function processNextChunk(dbClient, job) {
  const startedAt = Date.now();
  const isMaj = MAJORITARIOS.includes((job.role || '').toLowerCase());

  // Phase 1: setup PDF if needed (first run)
  if (!job.pdf_text) {
    if (isMaj) {
      const setup = await setupPDFJob(dbClient, job);
      if (!setup.pdfText) {
        console.log(`[JOB] Sem PDF para ${job.politician_name}, pulando`);
        return { processed: 0, message: 'Sem PDF disponivel', page: 0, total: 0 };
      }
      job.pdf_text = setup.pdfText;
      job.total_pages = setup.totalPages;
    }
  }

  // If no pdf_text even after setup (proporcional or no PDF found), run Serper primary
  if (!job.pdf_text || job.pdf_text.length < 200) {
    console.log(`[JOB] Sem PDF viavel, usando Serper como fonte primaria`);
    const serperPromises = await buscarArtigos(job.politician_name, job.role,
      ELECTION_YEARS[job.role?.toLowerCase()] || 2022);
    if (serperPromises.length === 0) {
      await dbClient.from('discovery_jobs').update({
        status: 'completed', stage: 'completed', progress: 100,
        total_extraidas: 0, total_inseridas: 0, completed_at: new Date().toISOString(),
        erro: 'Nenhuma promessa encontrada via Serper'
      }).eq('id', job.id);
      return { processed: 0, message: '0 promessas via Serper' };
    }
    const finalizadas = await finalizarInsercoes(dbClient, job, serperPromises.map(p => ({ ...p, fonte: 'serper' })));
    return { processed: 1, message: `${finalizadas} promessas inseridas via Serper`, inseridas: finalizadas };
  }

  const pages = chunkIntoPages(job.pdf_text, PAGE_SIZE);
  const totalPages = job.total_pages || pages.length;
  const fromPage = job.current_page || 0;

  if (fromPage >= totalPages) {
    console.log(`[JOB] Todas as ${totalPages} paginas ja processadas, finalizando`);
    return await finalizarJobComSerper(dbClient, job, totalPages);
  }

  const pagesToProcess = Math.min(PARALLEL * ROUNDS, totalPages - fromPage);
  const roundsNeeded = Math.ceil(pagesToProcess / PARALLEL);

  console.log(`[JOB] Paginas ${fromPage+1}-${fromPage+pagesToProcess} de ${totalPages} (${pagesToProcess} paginas em ${roundsNeeded} rounds)`);
  await updateStage(dbClient, job.id, 'analisando_chunk', Math.round((fromPage / totalPages) * 100));

  // Carregar promessas parciais existentes
  let partialPromises = [];
  try {
    if (job.partial_promises && Array.isArray(job.partial_promises)) {
      partialPromises = job.partial_promises;
    }
  } catch (e) { partialPromises = []; }

  let newPageCount = 0;

  for (let round = 0; round < roundsNeeded; round++) {
    const roundStart = fromPage + newPageCount;
    const roundEnd = Math.min(roundStart + PARALLEL, fromPage + pagesToProcess);

    const groqCalls = [];
    for (let p = roundStart; p < roundEnd; p++) {
      if (pages[p]) {
        groqCalls.push(
          extractWithGroq(pages[p], job.politician_name, job.role)
            .then(r => r.map(pr => ({ ...pr, fonte: 'pdf_tse' })))
        );
      }
    }

    if (groqCalls.length === 0) break;

    console.log(`[ROUND ${round+1}/${roundsNeeded}] Enviando ${groqCalls.length} chamadas Groq em paralelo (paginas ${roundStart+1}-${roundEnd})`);
    const results = await Promise.all(groqCalls);
    const roundPromises = results.flat();
    partialPromises.push(...roundPromises);
    newPageCount += groqCalls.length;

    console.log(`[ROUND ${round+1}] Groq retornou ${roundPromises.length} promessas (acumulado: ${partialPromises.length})`);

    // Salvar checkpoint apos cada round
    const newCurrentPage = fromPage + newPageCount;
    await saveCheckpoint(dbClient, job.id, newCurrentPage, totalPages, partialPromises);
    console.log(`[CHECKPOINT] Pagina ${newCurrentPage}/${totalPages} salva`);
  }

  const finalPage = fromPage + newPageCount;

  if (finalPage >= totalPages) {
    console.log(`[JOB] PDF completo! ${partialPromises.length} promessas extraidas. Finalizando...`);
    return await finalizarJobComSerper(dbClient, job, totalPages);
  }

  console.log(`[JOB] Fim da execucao: pagina ${finalPage}/${totalPages}, ${partialPromises.length} promessas parciais`);
  return {
    processed: 1,
    page: finalPage,
    total: totalPages,
    partial: partialPromises.length,
    message: `Paginas ${finalPage}/${totalPages} processadas (${Math.round(finalPage/totalPages*100)}%)`
  };
}

async function finalizarJobComSerper(dbClient, job, totalPages) {
  const isMaj = MAJORITARIOS.includes((job.role || '').toLowerCase());
  let allPromises = [];

  // Carregar promessas parciais do PDF
  try {
    const { data: current } = await dbClient.from('discovery_jobs').select('partial_promises').eq('id', job.id).single();
    if (current?.partial_promises && Array.isArray(current.partial_promises)) {
      allPromises.push(...current.partial_promises);
    }
  } catch (e) { console.error('[FINAL] Erro carregando parciais:', e.message); }

  console.log(`[FINAL] ${allPromises.length} promessas do PDF`);

  // Serper como complemento (apenas para majoritarios com PDF, ou primario para proporcionais)
  if (isMaj) {
    console.log(`[FINAL] Buscando artigos Serper como complemento`);
    await updateStage(dbClient, job.id, 'buscando_artigos', 85);
    try {
      const serperPromises = await buscarArtigos(job.politician_name, job.role,
        ELECTION_YEARS[job.role?.toLowerCase()] || 2022);
      console.log(`[FINAL] Serper retornou ${serperPromises.length} promessas extras`);
      allPromises.push(...serperPromises.map(p => ({ ...p, fonte: 'serper' })));
    } catch (e) { console.error('[FINAL] Erro Serper:', e.message); }
  }

  // Dedup
  let existingTitles = [];
  try {
    const { data: existing } = await dbClient.from('promises')
      .select('id, promise_title')
      .eq('politician_id', job.politician_id);
    existingTitles = (existing || []).map(p => p.promise_title.toLowerCase().trim());
    console.log(`[FINAL] Promessas existentes no banco: ${existingTitles.length}`);
  } catch (e) { console.error('[FINAL] Erro buscando existentes:', e.message); }

  const unique = [];
  for (const p of allPromises) {
    const titulo = (p.titulo || '').trim();
    if (!titulo || titulo.length < 4) continue;
    if (!isDuplicate(titulo, existingTitles)) {
      unique.push(p);
      existingTitles.push(titulo.toLowerCase());
    }
  }
  console.log(`[FINAL] Apos dedup: ${unique.length} unicas de ${allPromises.length}`);

  // Inserir
  await updateStage(dbClient, job.id, 'inserindo', 95);
  let inserted = 0;
  for (const p of unique) {
    try {
      const { error } = await dbClient.from('promises').insert({
        politician_id: job.politician_id,
        politician_name: job.politician_name,
        promise_title: (p.titulo || '').trim(),
        category: normalizeCategory(p.categoria),
        status: 'pendente',
        fulfillment_score: 50,
        party: job.party
      });
      if (!error) inserted++;
    } catch (e) {
      console.error('[FINAL] Erro inserindo:', e.message);
    }
  }

  console.log(`[FINAL] ${inserted}/${unique.length} inseridas`);

  const { error: finalErr } = await dbClient.from('discovery_jobs').update({
    status: 'completed',
    stage: 'completed',
    progress: 100,
    total_extraidas: allPromises.length,
    total_inseridas: inserted,
    current_page: totalPages,
    completed_at: new Date().toISOString()
  }).eq('id', job.id);
  if (finalErr) console.error(`[DB] final update: ${finalErr.message}`);

  return { processed: 1, job_id: job.id, extraidas: allPromises.length, inseridas: inserted };
}

async function finalizarInsercoes(dbClient, job, promises) {
  let existingTitles = [];
  try {
    const { data: existing } = await dbClient.from('promises')
      .select('id, promise_title')
      .eq('politician_id', job.politician_id);
    existingTitles = (existing || []).map(p => p.promise_title.toLowerCase().trim());
  } catch (e) { existingTitles = []; }

  const unique = [];
  for (const p of promises) {
    const titulo = (p.titulo || '').trim();
    if (!titulo || titulo.length < 4) continue;
    if (!isDuplicate(titulo, existingTitles)) {
      unique.push(p);
      existingTitles.push(titulo.toLowerCase());
    }
  }

  let inserted = 0;
  for (const p of unique) {
    try {
      const { error } = await dbClient.from('promises').insert({
        politician_id: job.politician_id,
        politician_name: job.politician_name,
        promise_title: (p.titulo || '').trim(),
        category: normalizeCategory(p.categoria),
        status: 'pendente',
        fulfillment_score: 50,
        party: job.party
      });
      if (!error) inserted++;
    } catch (e) { }
  }
  return inserted;
}

export default async function handler(req, res) {
  const dbClient = db();

  try {
    if (req._specificJobId) {
      const { data: job } = await dbClient.from('discovery_jobs').select('*').eq('id', req._specificJobId).single();
      if (!job) return res.json({ processed: 0, error: 'Job nao encontrado' });
      if (job.status === 'completed') return res.json({ processed: 0, message: 'Ja finalizado' });

      await dbClient.from('discovery_jobs').update({
        status: 'processing', stage: 'iniciando', progress: 0,
        started_at: new Date().toISOString()
      }).eq('id', job.id);

      const result = await processNextChunk(dbClient, job);
      return res.json(result);
    }

    const { data: jobs } = await dbClient
      .from('discovery_jobs')
      .select('*')
      .or(`status.eq.pending,status.eq.processing`)
      .order('created_at', { ascending: true })
      .limit(10);

    const incomplete = (jobs || []).find(j =>
      j.status === 'pending' ||
      (j.status === 'processing' && (
        j.total_pages === null || j.total_pages === 0 ||
        (j.current_page || 0) < (j.total_pages || 0)
      ))
    );
    if (!incomplete) {
      return res.json({ processed: 0, message: 'Nenhum job pendente' });
    }

    const job = incomplete;
    await dbClient.from('discovery_jobs').update({
      status: 'processing',
      started_at: new Date().toISOString()
    }).eq('id', job.id);

    const result = await processNextChunk(dbClient, job);
    return res.json(result);

  } catch (err) {
    console.error('[FATAL]', err);
    if (req._specificJobId) {
      await dbClient.from('discovery_jobs').update({
        status: 'failed', erro: err.message, completed_at: new Date().toISOString()
      }).eq('id', req._specificJobId);
    }
    return res.status(500).json({ error: err.message });
  }
}
