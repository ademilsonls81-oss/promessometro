import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
  );
}

const CREDIBLE_DOMAINS = new Set([
  'g1.globo.com', 'folha.uol.com.br', 'uol.com.br', 'estadao.com.br',
  'metropoles.com', 'cnnbrasil.com.br', 'www12.senado.leg.br', 'www.camara.leg.br',
  'www.planalto.gov.br', 'portaldatransparencia.gov.br', 'agenciabrasil.ebc.com.br',
  'veja.abril.com.br', 'oglobo.globo.com', 'congressoemfoco.uol.com.br', 'noticias.r7.com',
  'www.gov.br', 'institutolula.org'
]);

function isCredible(url) {
  if (!url) return false;
  const d = url.toLowerCase();
  if (CREDIBLE_DOMAINS.has(d)) return true;
  return d.includes('.gov.br') || d.includes('diariooficial') || d.includes('transparencia');
}

function clampScore(status, score) {
  const ranges = {
    cumprida: [80, 100], parcialmente_cumprida: [40, 79],
    em_andamento: [20, 39], nao_iniciada: [0, 19],
    descumprida: [0, 0], nao_classificada: [0, 100], pendente: [0, 19],
    parcial: [40, 79], quebrada: [0, 0]
  };
  const [min, max] = ranges[status] || [0, 100];
  return Math.max(min, Math.min(max, Math.round(score)));
}

function mapToFrontend(aiStatus) {
  const map = {
    'cumprida': 'cumprida', 'parcialmente_cumprida': 'parcial',
    'em_andamento': 'parcial', 'nao_iniciada': 'pendente',
    'nao_classificada': 'pendente', 'pendente': 'pendente',
    'descumprida': 'quebrada', 'parcial': 'parcial', 'quebrada': 'quebrada'
  };
  return map[aiStatus] || 'pendente';
}

function parseSerperDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date().toISOString();
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
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

async function searchSerper(query) {
  const SERPER_KEY = process.env.SERPER_API_KEY;
  if (!SERPER_KEY) return [];
  try {
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_KEY },
      body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br' })
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.organic || []).map(r => ({
      titulo: r.title || '',
      descricao: r.snippet || '',
      fonte: r.source || '',
      url: r.link || '',
      data: parseSerperDate(r.date),
      credible: isCredible(r.link || ''),
      relevance: 75,
      credibility: isCredible(r.link || '') ? 90 : 50
    }));
  } catch { return []; }
}

async function evaluateWithAI(promise, evidences) {
  const GROQ = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!GROQ) {
    return {
      status: promise.status || 'pendente',
      fulfillment_score: promise.fulfillment_score ?? 50,
      justificativa: 'Avaliacao herdada do status original',
      evidencias_usadas: evidences.slice(0, 3).map(e => ({ fonte: e.fonte, url: e.url })),
      needsReview: true
    };
  }

  const evText = evidences.length > 0
    ? evidences.map(e => `[${e.fonte}]: ${e.descricao || e.titulo} (${e.url || 'sem link'})`).join('\n')
    : 'Nenhuma evidencia encontrada.';

  const prompt = `Voce e um avaliador independente de promessas politicas brasileiras.

PROMESSA: ${promise.promise_title || ''}
POLITICO: ${promise.politician_name || ''}
CATEGORIA: ${promise.category || ''}

EVIDENCIAS ENCONTRADAS:
${evText}

CRITERIOS:
| Status | Score | Quando usar |
| cumprida | 80-100 | Acao concluida com prova verificavel |
| parcialmente_cumprida | 40-79 | Progresso parcial demonstrado |
| em_andamento | 20-39 | Processo iniciado sem entrega final |
| nao_iniciada | 0-19 | Nenhuma acao verificavel |
| descumprida | 0 | Acao contraria ou prazo expirado |

REGRAS:
- Sem evidencia com URL real: score maximo 30, status "nao_iniciada"
- Score > 70 exige evidencia verificavel com URL real
- Responda SOMENTE com JSON:
{"status":"status","fulfillment_score":0-100,"justificativa":"explicacao","evidencias_usadas":[{"fonte":"nome","url":"url"}]}`;

  try {
    const r = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1, max_tokens: 512
      })
    });
    if (!r.ok) throw new Error(`Groq ${r.status}`);
    const d = await r.json();
    let text = (d.choices?.[0]?.message?.content || '{}').replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    const p = match ? JSON.parse(match[0]) : {};
    let status = p.status || 'nao_classificada';
    let score = p.fulfillment_score ?? 50;
    if (evidences.length === 0 && score > 30) { status = 'nao_iniciada'; score = 30; }
    return {
      status,
      fulfillment_score: clampScore(status, score),
      justificativa: p.justificativa || 'Avaliacao automatica via IA',
      evidencias_usadas: p.evidencias_usadas || evidences.slice(0, 3).map(e => ({ fonte: e.fonte, url: e.url })),
      needsReview: score > 80 || evidences.length === 0
    };
  } catch (err) {
    return {
      status: promise.status || 'pendente',
      fulfillment_score: promise.fulfillment_score ?? 50,
      justificativa: 'Avaliacao herdada do status original - IA falhou',
      evidencias_usadas: evidences.slice(0, 3).map(e => ({ fonte: e.fonte, url: e.url })),
      needsReview: true
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const executionId = `autonomous_${Date.now()}`;
  const startTime = new Date().toISOString();
  const batchSize = parseInt(req.query?.batch) || 3;
  const offset = parseInt(req.query?.offset) || 0;

  try {
    await db().from('cron_executions').insert({
      execution_id: executionId,
      trigger: 'autonomous_seed',
      status: 'started',
      started_at: startTime,
      details: JSON.stringify({ batch_size: batchSize, offset })
    });

    const { data: promises, error: fetchErr } = await db()
      .from('promises')
      .select('*')
      .order('created_at', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);
    if (!promises || promises.length === 0) {
      return res.json({ status: 'done', message: 'No more promises to process', offset, total_processed: 0 });
    }

    let results = {
      evidences_discovered: 0,
      evidences_inserted: 0,
      evaluations_completed: 0,
      status_history_inserted: 0,
      explanations_inserted: 0,
      audit_logs_inserted: 0,
      promises_updated: 0,
      errors: []
    };

    for (const promise of promises) {
      try {
        // Step 1: Discover evidences via Serper
        const query = `${promise.politician_name || ''} ${promise.promise_title || ''} ${promise.category || ''}`;
        const evidences = await searchSerper(query);
        results.evidences_discovered += evidences.length;

        // Step 2: Insert evidences into promise_evidences
        for (const ev of evidences) {
          const { error: evErr } = await db().from('promise_evidences').insert({
            promise_id: promise.id,
            politician_name: promise.politician_name,
            promise_title: promise.promise_title,
            titulo: ev.titulo || null,
            descricao: ev.descricao || null,
            fonte: ev.fonte || null,
            url: ev.url || null,
            data_publicacao: ev.data || null,
            tipo: ev.credible ? 'oficial' : 'jornal',
            confiabilidade: ev.credibility,
            discovered_at: startTime,
            validated: ev.credible,
            needs_review: !ev.credible
          });
          if (!evErr) results.evidences_inserted++;
        }

        // Step 3: Evaluate with AI
        const evaluation = await evaluateWithAI(promise, evidences);
        const frontendStatus = mapToFrontend(evaluation.status);

        // Step 4: Update promise
        const { error: upErr } = await db().from('promises').update({
          status: frontendStatus,
          fulfillment_score: evaluation.fulfillment_score,
          ai_evaluation: evaluation.justificativa,
          evidences_used: evaluation.evidencias_usadas,
          needs_human_review: evaluation.needsReview,
          last_verified_at: startTime,
          evidence_count: evidences.length
        }).eq('id', promise.id);
        if (!upErr) results.promises_updated++;

        // Step 5: Insert status_history
        const { error: shErr } = await db().from('status_history').insert({
          promise_id: promise.id,
          previous_status: promise.status || 'pendente',
          new_status: frontendStatus,
          previous_score: promise.fulfillment_score || 0,
          new_score: evaluation.fulfillment_score,
          changed_by: 'autonomous_seed',
          change_reason: evaluation.justificativa || 'Seed automatico',
          evaluation_type: 'ai_auto'
        });
        if (!shErr) results.status_history_inserted++;

        // Step 6: Insert/replace promise_explanations
        await db().from('promise_explanations').update({ is_latest: false }).eq('promise_id', promise.id);
        const { error: peErr } = await db().from('promise_explanations').insert({
          promise_id: promise.id,
          status: frontendStatus,
          fulfillment_score: evaluation.fulfillment_score,
          criterio_aplicado: 'autonomous_seed_v1',
          justificativa: evaluation.justificativa,
          evidencias_usadas: evaluation.evidencias_usadas,
          o_que_falta: evaluation.needsReview ? 'Revisao humana necessaria' : 'Completo',
          o_que_foi_feito: evaluation.justificativa || 'Analise IA automatica',
          confianca: evaluation.needsReview ? 50 : 85,
          modelo_ia: 'autonomous-seed-v1',
          is_latest: true,
          gerado_em: startTime
        });
        if (!peErr) results.explanations_inserted++;

        // Step 7: Insert audit_log
        const { error: alErr } = await db().from('audit_logs').insert({
          action: 'autonomous_seed_evaluation',
          table_name: 'promises',
          record_id: promise.id,
          old_value: { status: promise.status, score: promise.fulfillment_score },
          new_value: { status: frontendStatus, score: evaluation.fulfillment_score },
          performed_by: 'autonomous_seed',
          details: {
            promise_title: promise.promise_title,
            politician: promise.politician_name,
            evidences_count: evidences.length,
            needs_human_review: evaluation.needsReview
          }
        });
        if (!alErr) results.audit_logs_inserted++;

        results.evaluations_completed++;

        // Rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        results.errors.push({ promise_id: promise.id, error: err.message });
        console.error(`[Autonomous] Error on ${promise.id}: ${err.message}`);
      }
    }

    // Update cron_executions
    await db().from('cron_executions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      promises_evaluated: results.evaluations_completed,
      promises_failed: results.errors.length,
      details: JSON.stringify(results)
    }).eq('execution_id', executionId);

    // Log to daily_monitor_log
    await db().from('daily_monitor_log').insert({
      monitor_name: 'autonomous_seed',
      promises_processed: results.evaluations_completed,
      new_evidences_found: results.evidences_inserted,
      errors: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
      started_at: startTime,
      completed_at: new Date().toISOString()
    });

    const nextOffset = offset + batchSize;
    const { count: totalCount } = await db().from('promises').select('*', { count: 'exact', head: true });

    return res.json({
      status: 'ok',
      execution_id: executionId,
      batch: { processed: promises.length, offset, next_offset: nextOffset, total: totalCount || 0 },
      results,
      has_more: nextOffset < (totalCount || 0)
    });
  } catch (err) {
    await db().from('cron_executions').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      details: JSON.stringify({ error: err.message })
    }).eq('execution_id', executionId);

    return res.status(500).json({ status: 'error', error: err.message, execution_id: executionId });
  }
}
