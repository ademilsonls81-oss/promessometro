import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
);

function requireCronSecret(req, res) {
  if (process.env.NODE_ENV !== 'production') return true;
  const raw = JSON.stringify(req.headers || '').toLowerCase();
  const isCron = raw.includes('vercel-cron') || raw.includes('vercel/internal');
  if (isCron) return true;
  const secret = req.headers['x-cron-secret'] || req.query?.secret;
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

const TAVILY_SOURCES = [
  'g1.globo.com',
  'folha.uol.com.br',
  'uol.com.br',
  'estadao.com.br',
  'metropoles.com',
  'cnnbrasil.com.br',
  'www12.senado.leg.br',
  'www.camara.leg.br',
  'www.planalto.gov.br',
  'portaldatransparencia.gov.br',
  'agenciabrasil.ebc.com.br',
  'veja.abril.com.br',
  'oglobo.globo.com',
  'g1.globo.com',
  'congressoemfoco.uol.com.br',
  'noticias.r7.com'
];

const CREDIBLE_DOMAINS = new Set(TAVILY_SOURCES);

function isCredibleSource(url) {
  if (!url) return false;
  const domain = url.toLowerCase();
  if (CREDIBLE_DOMAINS.has(domain)) return true;
  if (domain.includes('.gov.br')) return true;
  if (domain.includes('diariooficial')) return true;
  if (domain.includes('portal') && domain.includes('transparencia')) return true;
  if (domain.includes('camara.leg.br') || domain.includes('senado.leg.br')) return true;
  return false;
}

function scoreEvidence(relevance, credibility) {
  let score = 0;
  score += relevance * 0.4;
  score += credibility * 0.6;
  return Math.round(Math.min(100, score * 100));
}

async function searchEvidence(query, maxResults = 8) {
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!TAVILY_API_KEY || TAVILY_API_KEY === 'YOUR_TAVILY_API_KEY') {
    const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    if (!GROQ_API_KEY) return [];
    const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
    try {
      const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'user',
            content: `Busque links de notícias confiáveis sobre: ${query}. Liste no máximo 5 URLs de fontes jornalísticas brasileiras oficiais (G1, Folha, UOL, Estadão, etc). Responda apenas com JSON: {"links": ["url1", "url2"]}`
          }],
          temperature: 0.1,
          max_tokens: 512
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '{}';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return (parsed.links || []).map(url => ({
            descricao: `Notícia sobre: ${query}`,
            fonte: new URL(url).hostname,
            url,
            data: null,
            is_credible: isCredibleSource(url),
            relevance_score: 70,
            credibility_score: 80
          }));
        }
      }
    } catch (_) { }
    return [];
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': TAVILY_API_KEY },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false
      })
    });
    if (res.ok) {
      const data = await res.json();
      return (data.results || []).map(r => {
        const credible = isCredibleSource(r.url);
        const relevance = r.score || 0.5;
        const credibility = credible ? 0.9 : r.score && r.score > 0.7 ? 0.7 : 0.4;
        return {
          descricao: r.content || r.title || '',
          fonte: r.source || new URL(r.url || 'https://example.com').hostname,
          url: r.url || '',
          data: r.published_date || null,
          is_credible: credible,
          relevance_score: Math.round(relevance * 100),
          credibility_score: Math.round(credibility * 100),
          titulo: r.title || ''
        };
      });
    }
  } catch (_) { }
  return [];
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.toString().split('?')[0].replace(/\/$/, '');
  } catch {
    return url;
  }
}

async function isDuplicate(url, politicianName, promiseId) {
  const { data } = await supabase
    .from('promise_evidences')
    .select('id, url')
    .eq('politician_name', politicianName)
    .limit(50);

  if (!data) return false;
  const normalized = normalizeUrl(url);
  return data.some(e => normalizeUrl(e.url || '') === normalized);
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireCronSecret(req, res)) return;

  console.log('[EvidenceDiscovery] Started');

  const { data: promises, error } = await supabase
    .from('promises')
    .select('id, promise_title, politician_name, category, status, evidence_count, last_verified_at')
    .not('status', 'eq', 'cumprida')
    .not('status', 'eq', 'descumprida')
    .not('status', 'eq', 'pendente')
    .limit(30);

  if (error) {
    console.error('[EvidenceDiscovery] Fetch error:', error.message);
    return res.status(500).json({ status: 'error', error: error.message });
  }

  if (!promises || promises.length === 0) {
    return res.status(200).json({ status: 'ok', discovered: 0, inserted: 0, duplicates: 0 });
  }

  console.log(`[EvidenceDiscovery] Processing ${promises.length} promises`);

  let discovered = 0;
  let inserted = 0;
  let duplicates = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const promise of promises) {
    try {
      const query = `${promise.politician_name || ''} ${promise.promise_title || ''} ${promise.category || ''}`;
      const evidences = await searchEvidence(query, 8);

      for (const ev of evidences) {
        discovered++;
        const dup = await isDuplicate(ev.url, promise.politician_name, promise.id);
        if (dup) { duplicates++; continue; }

        const score = scoreEvidence(
          ev.relevance_score / 100,
          ev.credibility_score / 100
        );

        const { error: insertError } = await supabase
          .from('promise_evidences')
          .insert({
            promise_id: promise.id,
            politician_name: promise.politician_name,
            promise_title: promise.promise_title,
            descricao: ev.descricao,
            fonte: ev.fonte,
            url: ev.url,
            data_publicacao: ev.data,
            tipo: ev.is_credible ? 'oficial' : 'jornal',
            confiabilidade: score,
            relevance_score: ev.relevance_score,
            credibility_score: ev.credibility_score,
            titulo: ev.titulo || null,
            discovered_at: now,
            validated: ev.is_credible,
            needs_review: !ev.is_credible
          });

        if (insertError) {
          console.error(`[EvidenceDiscovery] Insert error for ${promise.id}: ${insertError.message}`);
        } else {
          inserted++;
        }
      }

      await supabase
        .from('promises')
        .update({ last_verified_at: now })
        .eq('id', promise.id);

    } catch (e) {
      console.error(`[EvidenceDiscovery] ✗ ${promise.id}: ${e.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[EvidenceDiscovery] Done: discovered=${discovered} inserted=${inserted} dup=${duplicates} failed=${failed}`);

  return res.status(200).json({
    status: 'ok',
    promises_processed: promises.length,
    evidences_discovered: discovered,
    evidences_inserted: inserted,
    duplicates_skipped: duplicates,
    failed,
    timestamp: now
  });
}