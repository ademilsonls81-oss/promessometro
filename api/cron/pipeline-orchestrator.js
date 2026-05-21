import { createClient } from '@supabase/supabase-js';
import { prioritizeSources, classifySource, getLevelLabel } from '../lib/sourceLevel.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function extractHostname(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url.split('/')[2]?.replace('www.', '') || '';
  }
}

const TAVILY_SOURCES = [
  'g1.globo.com', 'folha.uol.com.br', 'uol.com.br', 'estadao.com.br',
  'metropoles.com', 'cnnbrasil.com.br', 'www12.senado.leg.br', 'www.camara.leg.br',
  'www.planalto.gov.br', 'portaldatransparencia.gov.br', 'agenciabrasil.ebc.com.br',
  'veja.abril.com.br', 'oglobo.globo.com', 'congressoemfoco.uol.com.br', 'noticias.r7.com'
];
const CREDIBLE_DOMAINS = new Set(TAVILY_SOURCES);

function isCredible(url) {
  if (!url) return false;
  const d = url.toLowerCase();
  if (CREDIBLE_DOMAINS.has(d)) return true;
  return d.includes('.gov.br') || d.includes('diariooficial') || d.includes('transparencia') || d.includes('camara.leg.br') || d.includes('senado.leg.br');
}

function clampScore(status, score) {
  const ranges = {
    cumprida: [80, 100], parcial: [40, 79],
    pendente: [0, 39], quebrada: [0, 0]
  };
  const [min, max] = ranges[status] || [0, 100];
  return Math.max(min, Math.min(max, Math.round(score)));
}

function mapToFrontend(aiStatus) {
  const map = {
    'cumprida': 'cumprida',
    'parcialmente_cumprida': 'parcial',
    'em_andamento': 'parcial',
    'nao_iniciada': 'pendente',
    'nao_classificada': 'pendente',
    'pendente': 'pendente',
    'descumprida': 'quebrada',
    'parcial': 'parcial',
    'quebrada': 'quebrada'
  };
  return map[aiStatus] || 'pendente';
}

function requireCronSecret(req, res) {
  if (process.env.NODE_ENV !== 'production') return true;
  const raw = JSON.stringify(req.headers || '').toLowerCase();
  const isCron = raw.includes('vercel-cron') || raw.includes('vercel/internal');
  if (isCron) return true;
  const secret = req.headers['x-cron-secret'] || req.query?.secret;
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return false;
  }
  return true;
}

function parseSerperDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date().toISOString();
  }
  const lower = dateStr.toLowerCase();
  if (lower.includes('ago') || lower.includes('days') || lower.includes('months') || lower.includes('year') || lower.includes('hours')) {
    return new Date().toISOString();
  }
  const ptMonths = {
    'jan': 'Jan', 'fev': 'Feb', 'mar': 'Mar', 'abr': 'Apr',
    'mai': 'May', 'jun': 'Jun', 'jul': 'Jul', 'ago': 'Aug',
    'set': 'Sep', 'out': 'Oct', 'nov': 'Nov', 'dez': 'Dec'
  };
  const monthMatch = dateStr.match(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i);
  if (monthMatch) {
    const pt = monthMatch[1].toLowerCase();
    const en = ptMonths[pt];
    if (en) {
      const replaced = dateStr.replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi, en);
      const parsed = new Date(replaced);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return new Date().toISOString();
}

async function searchEv(query, maxResults = 8, includeDomains = []) {
  const SERPER_KEY = process.env.SERPER_API_KEY;
  if (SERPER_KEY) {
    try {
      const r = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': SERPER_KEY
        },
        body: JSON.stringify({
          q: query,
          gl: 'br',
          hl: 'pt-br'
        })
      });
      if (r.ok) {
        const d = await r.json();
        const results = d.organic || [];
        console.log(`[Pipeline:Serper] ${results.length} resultados para: ${query}`);
        return results.map(r => ({
          descricao: r.snippet || r.title || '',
          fonte: r.source || extractHostname(r.link) || '',
          url: r.link || '',
          data: parseSerperDate(r.date),
          credible: isCredible(r.link || ''),
          relevance: 75,
          credibility: isCredible(r.link || '') ? 90 : 50,
          titulo: r.title || ''
        }));
      } else {
        const errText = await r.text();
        console.error(`[Pipeline:Serper] HTTP ${r.status}: ${errText}`);
      }
    } catch(err) {
      console.error(`[Pipeline:Serper] ERROR: ${err.message}`);
    }
  }

  // Fallback Groq quando Serper falha
  const GROQ = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!GROQ) return [];
  try {
    console.log(`[Pipeline:Groq] Fallback search para: ${query}`);
    const r = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'user',
          content: `Você é um avaliador de promessas políticas brasileiras.
Sobre a promessa: "${query}"
Liste até 5 URLs reais de fontes jornalísticas ou oficiais brasileiras que comprovem ou contestem essa promessa.
Responda SOMENTE JSON: {"links":["url1","url2"]}`
        }],
        temperature: 0.1,
        max_tokens: 512
      })
    });
    if (r.ok) {
      const d = await r.json();
      const t = d.choices?.[0]?.message?.content || '{}';
      const m = t.match(/\{[\s\S]*\}/);
      if (m) {
        const p = JSON.parse(m[0]);
        const links = p.links || [];
        console.log(`[Pipeline:Groq] ${links.length} URLs sugeridas`);
        return links.map(u => ({
          descricao: `Fonte sugerida pelo modelo de linguagem`,
          fonte: (() => { try { return new URL(u).hostname; } catch { return u; } })(),
          url: u,
          data: null,
          credible: isCredible(u),
          relevance: 65,
          credibility: isCredible(u) ? 80 : 40,
          titulo: query
        }));
      }
    } else {
      const errText = await r.text();
      console.error(`[Pipeline:Groq] Fallback HTTP ${r.status}: ${errText}`);
    }
  } catch (err) {
    console.error(`[Pipeline:Groq] Fallback error: ${err.message}`);
  }
  return [];
}

function normalizeUrl(url) {
  try { return new URL(url).toString().split('?')[0].replace(/\/$/, ''); } catch { return url; }
}

async function searchAI(query, promise, includeDomains = []) {
  console.log(`[Pipeline:searchAI] Processing promise: ${promise.promise_title}`);
  const API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  const BASE = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';

  const { data: dbEvidences } = await db()
    .from('promise_evidences')
    .select('title, description, url, source_name, published_at')
    .eq('promise_id', promise.id)
    .limit(10);

  let evidences = [];
  if (dbEvidences && dbEvidences.length > 0) {
    evidences = dbEvidences.map(e => ({
      titulo: e.title || e.description || '',
      descricao: e.description || '',
      fonte: e.source_name || '',
      url: e.url || '',
      data: e.published_at || null,
      credible: isCredible(e.url || ''),
      relevance: 75,
      credibility: isCredible(e.url || '') ? 90 : 50
    }));
  }

  if (evidences.length === 0) {
    evidences = await searchEv(`${promise.politician_name || ''} ${promise.promise_title || ''} ${promise.category || ''}`, 8, includeDomains);
    for (const ev of evidences) {
      await db().from('promise_evidences').insert({
        promise_id: promise.id,
        title: ev.titulo || ev.descricao?.substring(0, 100) || null,
        description: ev.descricao || null,
        url: ev.url || null,
        source_name: ev.fonte || extractHostname(ev.url) || null,
        evidence_type: 'news',
        source_type: ev.credible ? 'official' : 'press',
        validation_status: 'pending',
        published_at: ev.data || null,
        confiabilidade: ev.credibility,
        relevance_score: ev.relevance || 0,
        credibility_score: ev.credibility || 0,
        discovered_at: new Date().toISOString(),
        validated: ev.credible,
        needs_review: !ev.credible
      }).catch(() => {});
    }
  }

  const evText = evidences.length > 0
    ? evidences.map(e => `[${e.fonte}]: ${e.descricao || e.titulo} (${e.url || 'sem link'})`).join('\n')
    : 'Nenhuma evidência encontrada.';

  const prompt = `Você é um avaliador independente de promessas políticas brasileiras.

PROMESSA: ${promise.promise_title || ''}
POLÍTICO: ${promise.politician_name || ''}

EVIDÊNCIAS ENCONTRADAS (USE ESTAS URLs EXATAS PARA AVALIAR):
${evText}

CRITÉRIOS:
| Status | Score | Quando usar |
| cumprida | 80-100 | Ação concluída com prova verificável |
| parcialmente_cumprida | 40-79 | Progresso parcial demonstrado |
| em_andamento | 20-39 | Processo iniciado sem entrega final |
| nao_iniciada | 0-19 | Nenhuma ação verificável |
| descumprida | 0 | Ação contrária ou prazo expirado |

IMPORTANTE: Use APENAS as evidências acima. Cada evidência tem uma URL específica - use-a para verificar o status real da promessa.

REGRAS:
- Sem evidência com URL real: score máximo 30, status "nao_iniciada"
- Score > 70 exige evidência verificável com URL real das listadas acima
- Responda SOMENTE com JSON estruturado:
{"status":"status","fulfillment_score":0-100,"justificativa":"explicação clara citing os titulos das evidencias usadas","evidencias_usadas":[{"fonte":"nome da fonte","url":"url exata da evidencia"}]}`;

  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1, max_tokens: 512
      })
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error(`[searchAI:Groq] HTTP ${r.status}: ${errText}`);
      throw new Error(`Groq ${r.status}`);
    }
    const d = await r.json();
    let text = (d.choices?.[0]?.message?.content || '{}').replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    const p = match ? JSON.parse(match[0]) : {};
    let status = p.status || 'nao_classificada';
    let score = p.fulfillment_score ?? 50;
    if (evidences.length === 0 && score > 30) { status = 'nao_iniciada'; score = 30; }
    return {
      status, score: clampScore(status, score),
      rawScore: score, justification: p.justificativa || '',
      evidences, needsReview: score > 80 || evidences.length === 0
    };
  } catch (err) {
    throw new Error(`AI failed: ${err.message}`);
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!requireCronSecret(req, res)) return;

  const executionId = `pipeline_${Date.now()}`;
  const startTime = new Date();
  const stage = req.query?.stage || 'all';
  
  // 1. Log START
  try {
    await db().from('cron_executions').insert({
      execution_id: executionId,
      trigger: 'vercel_cron',
      status: 'started',
      started_at: startTime.toISOString(),
      details: JSON.stringify({ stage })
    });
  } catch (logErr) {
    console.error('[Pipeline] Start log failed:', logErr.message);
  }

  let step1Discovered = 0, step1Inserted = 0, step1Dupes = 0;
  let step2Updated = 0;
  let step3Evaluated = 0, step3Failed = 0;
  let summary = {};

  try {
    const dailyCutoff = new Date(startTime.getTime() - 23 * 60 * 60 * 1000).toISOString();
    const weeklyCutoff = new Date(startTime.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch active political feeds from DB
    const { data: activeFeeds } = await db()
      .from('feeds')
      .select('url')
      .eq('active', true)
      .in('category', ['Política', 'Governo']);

    const activeDomains = (activeFeeds || []).map(f => {
      try { return new URL(f.url).hostname; } catch { return null; }
    }).filter(Boolean);

    // Merge with static credible domains for verification
    if (activeDomains.length > 0) {
      activeDomains.forEach(d => CREDIBLE_DOMAINS.add(d.toLowerCase()));
    }

    console.log(`[Pipeline] ${executionId} started at ${startTime.toISOString()}, stage=${stage}, active_domains=${activeDomains.length}`);

    if (stage === 'all' || stage === 'discover') {
      const { data: promises } = await db()
        .from('promises')
        .select('id, promise_title, politician_name, category, status, evidence_count')
        .not('status', 'eq', 'cumprida')
        .limit(5);

      if (promises && promises.length > 0) {
        console.log(`[Pipeline:Discover] Processing ${promises.length} promises`);
        for (const promise of promises) {
          try {
            const evidences = await searchEv(`${promise.politician_name || ''} ${promise.promise_title || ''} ${promise.category || ''}`, 8, activeDomains);
            for (const ev of evidences) {
              step1Discovered++;
              const domain = normalizeUrl(ev.url).split('/')[2] || '';
              const { data: existing } = await db().from('promise_evidences')
                .select('id, url').eq('promise_id', promise.id).limit(10);
              const isDup = existing?.some(e => normalizeUrl(e.url || '').includes(domain));
              if (isDup) { step1Dupes++; continue; }
              const sc = Math.round(ev.relevance * 0.4 + ev.credibility * 0.6);
              const { error } = await db().from('promise_evidences').insert({
                promise_id: promise.id,
                title: ev.titulo || ev.descricao?.substring(0, 100) || null,
                description: ev.descricao || null,
                url: ev.url || null,
                source_name: ev.fonte || extractHostname(ev.url) || null,
                evidence_type: 'news',
                source_type: ev.credible ? 'official' : 'press',
                validation_status: 'pending',
                published_at: ev.data || null,
                confiabilidade: sc,
                relevance_score: ev.relevance || 0,
                credibility_score: ev.credibility || 0,
                discovered_at: startTime.toISOString(),
                validated: ev.credible,
                needs_review: !ev.credible
              });
              if (!error) {
                step1Inserted++;
              } else {
                console.error(`[Pipeline:Insert] ERRO ao inserir evidência: ${error.message}`, {
                  promise_id: promise.id,
                  url: ev.url
                });
              }
            }
          } catch (e) { console.error(`[Pipeline:Discover] ✗ ${promise.id}: ${e.message}`); }
          await new Promise(r => setTimeout(r, 200));
        }
      }
    }

    if (stage === 'all' || stage === 'reavaliate') {
       const GROQ = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
       if (!GROQ || GROQ === 'YOUR_GROQ_API_KEY') {
         console.log('[Pipeline:Reavaliate] Using evidence-based evaluation (no GROQ_API_KEY)');
         // Avaliação baseada em evidências quando IA não está disponível
         for (const promise of toReavaliate) {
           try {
             // Busca evidências recentes para esta promessa
             const { data: recentEvidences } = await db()
               .from('promise_evidences')
               .select('url, fonte, credible')
               .eq('promise_id', promise.id)
               .order('discovered_at', { ascending: false })
               .limit(10);

             let basicScore = 50;
             let basicStatus = 'nao_iniciada';
             
             if (recentEvidences && recentEvidences.length > 0) {
               // Conta evidências credíveis
               const credibleEvidences = recentEvidences.filter(e => e.credible);
               
               if (credibleEvidences.length >= 3) {
                 basicScore = 85; // Boa quantidade de evidências credíveis
                 basicStatus = 'cumprida';
               } else if (credibleEvidences.length > 0) {
                 basicScore = 60; // Algumas evidências credíveis
                 basicStatus = 'parcial';
               } else if (recentEvidences.length > 0) {
                 basicScore = 40; // Evidências não credíveis
                 basicStatus = 'pendente';
               }
             }
             
             const frontendStatus = mapToFrontend(basicStatus);
             const clampedScore = clampScore(frontendStatus, basicScore);
             
             const { error: upErr } = await db().from('promises').update({
               status: frontendStatus, fulfillment_score: clampedScore,
               ai_evaluation: `Avaliação baseada em ${recentEvidences?.length || 0} evidências (${credibleEvidences?.length || 0} credíveis). IA não disponível para avaliação detalhada.`,
               evidences_used: recentEvidences?.slice(0, 3).map(e => ({ 
                 fonte: e.fonte || '', 
                 url: e.url || '' 
               })) || [],
               needs_human_review: true,
               last_verified_at: startTime.toISOString()
             }).eq('id', promise.id);

if (upErr) {
                console.error(`[Pipeline:Reavaliate] ERRO ao atualizar promise ${promise.id}: ${upErr.message}`);
                step3Failed++; continue;
              }

              try {
                await db().from('status_history').insert({
                  promise_id: promise.id, old_status: promise.status, new_status: frontendStatus
                });
              } catch (e) { console.error(`[status_history] ${e.message}`); }

              try {
                await db().from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id);
              } catch (e) { }

              try {
                await db().from('promise_explanations').insert({
                  promise_id: promise.id, status: frontendStatus, fulfillment_score: clampedScore,
                 criterio_aplicado: 'evidence_based_fallback', justificativa: `Avaliação baseada em ${recentEvidences?.length || 0} evidências (${credibleEvidences?.length || 0} credíveis). IA não disponível para avaliação detalhada.`,
                 evidencias_usadas: prioritizeSources(recentEvidences?.map(e => ({
                   descricao: e.descricao || e.titulo || '',
                   fonte: e.fonte || '',
                   url: e.url || ''
                 })) || []),
                 o_que_falta: 'Revisão humana necessária para avaliação IA detalhada',
                 o_que_foi_feito: `Análise baseada em ${recentEvidences?.length || 0} evidências encontradas`,
                 confianca: 0.5,
                 modelo_ia: 'evidence-fallback-v1',
                 is_latest: true, gerado_em: startTime.toISOString()
               });
             } catch (e) { console.error(`[promise_explanations] ${e.message}`); }

             try {
await db().from('audit_logs').insert({
                  action: 'pipeline_reavaliation', entity_type: 'promises', entity_id: promise.id,
                  details: JSON.stringify({
                    promise_id: promise.id, promise_title: promise.promise_title,
                    politician: promise.politician_name,
                    old_status: promise.status, new_status: frontendStatus,
                    previous_score: promise.fulfillment_score, new_score: clampedScore,
                    evidences_count: recentEvidences?.length || 0, needs_human_review: true
                  })
                });
             } catch (e) { console.error(`[audit_logs] ${e.message}`); }

             step3Evaluated++;
           } catch (e) {
             console.error(`[Pipeline:Reavaliate] ✗ FALHA na promessa ${promise.id}: ${e.message}`);
             step3Failed++;
           }
           await new Promise(r => setTimeout(r, 500));
         }
       } else {
        const { data: staleDaily } = await db()
          .from('promises')
          .select('id, promise_title, politician_name, category, status, fulfillment_score, last_verified_at, evidence_count')
          .lt('last_verified_at', dailyCutoff)
          .not('status', 'eq', 'cumprida')
          .limit(5);

        const { data: never } = await db()
          .from('promises')
          .select('id, promise_title, politician_name, category, status, fulfillment_score, last_verified_at, evidence_count')
          .is('last_verified_at', null)
          .limit(10);

        const { data: staleWeekly } = await db()
          .from('promises')
          .select('id, promise_title, politician_name, category, status, fulfillment_score, last_verified_at, evidence_count')
          .lt('last_verified_at', weeklyCutoff)
          .in('status', ['cumprida', 'descumprida'])
          .limit(3);

        const seen = new Set();
        const toReavaliate = [];
        for (const p of [...(staleDaily || []), ...(never || []), ...(staleWeekly || [])]) {
          if (!seen.has(p.id)) { seen.add(p.id); toReavaliate.push(p); }
        }

        if (toReavaliate.length > 0) {
          console.log(`[Pipeline:Reavaliate] Processing ${toReavaliate.length} promises`);
          for (const promise of toReavaliate) {
            try {
              const result = await searchAI(`${promise.politician_name || ''} ${promise.promise_title || ''}`, promise, activeDomains);
              const frontendStatus = mapToFrontend(result.status);

              const { error: upErr } = await db().from('promises').update({
                status: frontendStatus, fulfillment_score: result.score,
                ai_evaluation: result.justification, evidences_used: result.evidences,
                needs_human_review: result.needsReview, last_verified_at: startTime.toISOString()
              }).eq('id', promise.id);

              if (upErr) {
                console.error(`[Pipeline:Reavaliate] ERRO ao atualizar promise ${promise.id}: ${upErr.message}`);
                step3Failed++; continue;
              }

              try {
                await db().from('status_history').insert({
                  promise_id: promise.id, old_status: promise.status, new_status: frontendStatus
                });
              } catch (e) { console.error(`[status_history] ${e.message}`); }

              try {
                await db().from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id);
              } catch (e) { }

              try {
                await db().from('promise_explanations').insert({
                  promise_id: promise.id, status: frontendStatus, fulfillment_score: result.score,
                  criterio_aplicado: 'pipeline_auto_evaluation', justificativa: result.justification || 'Avaliação automática via pipeline',
                  evidencias_usadas: prioritizeSources(result.evidences || []), o_que_falta: result.needsReview ? 'Revisão humana necessária' : 'Completo',
                  o_que_foi_feito: result.justification || 'Análise IA.', confianca: result.needsReview ? 0.5 : 0.85,
                  modelo_ia: 'pipeline-v1-groq', is_latest: true, gerado_em: startTime.toISOString()
                });
              } catch (e) { console.error(`[promise_explanations] ${e.message}`); }

              try {
                await db().from('audit_logs').insert({
                  action: 'pipeline_reavaliation', entity_type: 'promises', entity_id: promise.id,
                  details: JSON.stringify({
                    promise_id: promise.id, promise_title: promise.promise_title,
                    politician: promise.politician_name,
                    old_status: promise.status, new_status: frontendStatus,
                    previous_score: promise.fulfillment_score, new_score: result.score,
                    evidences_count: result.evidences?.length || 0, needs_human_review: result.needsReview
                  })
                });
              } catch (e) { console.error(`[audit_logs] ${e.message}`); }

              step3Evaluated++;
            } catch (e) {
              console.error(`[Pipeline:Reavaliate] ✗ FALHA na promessa ${promise.id}: ${e.message}`);
              step3Failed++;
            }
            await new Promise(r => setTimeout(r, 500));
          }
        }
      }
    }

    if (stage === 'all' || stage === 'count') {
      const { data: promises } = await db()
        .from('promises')
        .select('id, status, last_verified_at')
        .limit(50);

      if (promises) {
        console.log(`[Pipeline:Count] Updating ${promises.length} promises`);
        for (const promise of promises) {
          try {
            const { count } = await db()
              .from('promise_evidences')
              .select('*', { count: 'exact', head: true })
              .eq('promise_id', promise.id);

            const updateData = { evidence_count: count || 0 };

            await db().from('promises').update(updateData).eq('id', promise.id);
            step2Updated++;
          } catch (_) { }
        }
      }
    }

    summary = {
      discover: { discovered: step1Discovered, inserted: step1Inserted, dupes: step1Dupes },
      count: { updated: step2Updated },
      reavaliate: { evaluated: step3Evaluated, failed: step3Failed }
    };

    // 2. Log SUCCESS
    await db().from('cron_executions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      promises_evaluated: step3Evaluated,
      promises_failed: step3Failed,
      details: JSON.stringify(summary)
    }).eq('execution_id', executionId);

    // 3. Daily Monitor Log
    await db().from('daily_monitor_log').insert({
      monitor_name: 'pipeline_orchestrator',
      promises_processed: step3Evaluated,
      new_evidences_found: step1Inserted,
      errors: step3Failed > 0 ? JSON.stringify({ failed: step3Failed }) : null,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString()
    });

    return res.status(200).json({ status: 'ok', execution_id: executionId, summary });

  } catch (err) {
    console.error(`[Pipeline] FATAL ERROR: ${err.message}`);
    
    // 4. Log FAILURE
    await db().from('cron_executions').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      details: JSON.stringify({ error: err.message, partial_summary: summary })
    }).eq('execution_id', executionId);

    return res.status(500).json({ status: 'error', error: err.message, execution_id: executionId });
  }
}