import { createClient } from '@supabase/supabase-js';
import { classifySource, getUrlDomain } from './sourceLevel.js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
const AI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
const SERPER_API_KEY = process.env.SERPER_API_KEY;

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const CAT_WEIGHTS = { seguranca: 0.30, financas: 0.40, funcionalismo: 0.30 };
const PENALTY_MAP = { condemnation: 50, investigation: 20, alert: 10, irregularity: 5 };

const HUMAN_CRITERIA = new Set(['human_reviewed_v1', 'human_reviewed_v2']);

function isHumanReviewed(criterio) {
  return criterio && HUMAN_CRITERIA.has(criterio);
}

function calcGrade(finalScore, c3) {
  let score = finalScore;
  if (c3 < 20) score = Math.min(score, 59);
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function normStatus(s) {
  if (!s) return 'pendente';
  const map = {
    'parcialmente_cumprida': 'parcial', 'em_andamento': 'parcial',
    'nao_iniciada': 'pendente', 'nao_classificada': 'pendente',
    'descumprida': 'quebrada'
  };
  return map[s] || s;
}

function extractHostname(url) {
  if (!url) return '';
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url.split('/')[2]?.replace('www.', '') || ''; }
}

function clampScore(status, score) {
  const ranges = {
    cumprida: [80, 100], parcial: [40, 79],
    pendente: [0, 39], quebrada: [0, 0]
  };
  const [min, max] = ranges[status] || [0, 100];
  return Math.max(min, Math.min(max, Math.round(score)));
}

function hasIndependentSources(evidencias) {
  if (!evidencias || evidencias.length < 2) return false;
  const domains = new Set();
  evidencias.forEach(ev => {
    const d = getUrlDomain(ev.url);
    if (d) domains.add(d);
  });
  return domains.size >= 2;
}

function dedupDomains(evidencias) {
  const bestPerDomain = new Map();
  for (const ev of evidencias) {
    const domain = getUrlDomain(ev.url) || '__no_url__';
    const existing = bestPerDomain.get(domain);
    const evLevel = classifySource(ev.url);
    if (!existing || evLevel < (existing._level || 99)) {
      bestPerDomain.set(domain, { ...ev, _level: evLevel });
    }
  }
  return Array.from(bestPerDomain.values()).map(({ _level, ...rest }) => rest);
}

function mapStatusToFrontend(aiStatus) {
  const map = {
    'cumprida': 'cumprida', 'parcialmente_cumprida': 'parcial',
    'em_andamento': 'parcial', 'nao_iniciada': 'pendente',
    'nao_classificada': 'pendente', 'pendente': 'pendente',
    'descumprida': 'quebrada', 'parcial': 'parcial', 'quebrada': 'quebrada'
  };
  return map[aiStatus] || 'pendente';
}

async function searchSerper(query) {
  if (!SERPER_API_KEY) return [];
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': SERPER_API_KEY },
      body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br', num: 5 })
    });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.organic || []).map(r => ({
      descricao: r.snippet || '',
      fonte: r.source || extractHostname(r.link) || '',
      url: r.link || '',
      data: r.date || null
    }));
  } catch { return []; }
}

let lastAiCall = 0;
const AI_CALL_INTERVAL = 2000;
const MAX_RETRIES = 3;
const MAX_AI_CALLS_PER_RUN = 30;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function evaluateViaAI(promise, evidences) {
  if (!GROQ_API_KEY) return null;
  const evText = evidences.length > 0
    ? evidences.map(e => `[${e.fonte}]: ${e.descricao} (${e.url})`).join('\n')
    : 'Nenhuma evidência encontrada.';
  const prompt = `Avaliador de promessas políticas brasileiras. PROMESSA: ${promise.promise_title}. POLÍTICO: ${promise.politician_name}. EVIDÊNCIAS: ${evText}. Responda JSON: {"status":"cumprida|parcial|pendente|quebrada","fulfillment_score":0-100,"justificativa":"explicacao","o_que_foi_feito":"o que foi concluido","o_que_falta":"o que ainda falta"}`;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const now = Date.now();
    const timeSinceLastCall = now - lastAiCall;
    if (timeSinceLastCall < AI_CALL_INTERVAL) {
      await sleep(AI_CALL_INTERVAL - timeSinceLastCall);
    }
    lastAiCall = Date.now();

    try {
      const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } })
      });
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '10', 10);
        if (attempt < MAX_RETRIES - 1) {
          await sleep(retryAfter * 1000 + 2000);
          continue;
        }
        return null;
      }
      if (!res.ok) return null;
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    } catch {
      if (attempt < MAX_RETRIES - 1) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function runAudit(options = { autoFix: false }) {
  const report = {
    started_at: new Date().toISOString(),
    politicians_checked: 0,
    total_issues: 0,
    fixed: 0,
    skipped_human_reviewed: 0,
    issues: []
  };

  const { data: pols } = await db().from('politicians').select('id, name, slug, c1_score, c2_score, c3_score, final_score, grade');

  if (!pols) return report;

  const { data: allExplanations } = await db()
    .from('promise_explanations')
    .select('id, promise_id, status, fulfillment_score, evidencias_usadas, criterio_aplicado, o_que_foi_feito, o_que_falta, justificativa')
    .eq('is_latest', true);

  let aiCallsThisRun = 0;

  for (const pol of pols) {
    report.politicians_checked++;

    const { data: promises } = await db()
      .from('promises')
      .select('id, politician_id, politician_name, promise_title, status, category')
      .eq('politician_id', pol.id);

    const polPromiseIds = new Set((promises || []).map(p => p.id));
    const relevantEvals = (allExplanations || []).filter(e => polPromiseIds.has(e.promise_id));

    for (const ev of relevantEvals) {
      if (isHumanReviewed(ev.criterio_aplicado)) {
        report.skipped_human_reviewed++;
        continue;
      }

      const promise = (promises || []).find(p => p.id === ev.promise_id);
      if (!promise) continue;

      let needsFix = false;
      const issues = [];

      if (aiCallsThisRun >= MAX_AI_CALLS_PER_RUN && options.autoFix) {
        issues.push('Limite de chamadas IA atingido — será processado na próxima execução');
        report.issues.push({
          politician_id: pol.id, politician_name: pol.name,
          promise_id: ev.promise_id, explanation_id: ev.id,
          issues: ['Limite de chamadas IA atingido — será processado na próxima execução do cron'],
          action: null
        });
        report.total_issues++;
        continue;
      }
      let newEvidencias = ev.evidencias_usadas || [];
      let newStatus = ev.status;
      let newScore = ev.fulfillment_score;
      let newJustificativa = ev.justificativa || '';
      let newOQueFoiFeito = ev.o_que_foi_feito || '';
      let newOQueFalta = ev.o_que_falta || '';
      let action = null;

      // --- Step 1: Dedup domains ---
      const deduped = dedupDomains(newEvidencias);
      if (deduped.length < newEvidencias.length) {
        const removed = newEvidencias.length - deduped.length;
        issues.push(`Domínios duplicados removidos: ${removed} fonte(s)`);
        newEvidencias = deduped;
        needsFix = true;
      }

      // --- Step 2: Check minimum 2 independent sources ---
      if (!hasIndependentSources(newEvidencias) && options.autoFix) {
        issues.push('Menos de 2 fontes independentes — buscando novas evidências via Serper');

        const serperResults = await searchSerper(`${promise.politician_name} ${promise.promise_title}`);
        const existingUrls = new Set(newEvidencias.map(e => e.url));
        const newSources = serperResults.filter(s => s.url && !existingUrls.has(s.url));

        if (newSources.length > 0) {
          newEvidencias = [...newEvidencias, ...newSources];
          const rededuped = dedupDomains(newEvidencias);
          newEvidencias = rededuped;

          // Re-evaluate via AI with new evidence
          aiCallsThisRun++;
          const aiResult = await evaluateViaAI(promise, newEvidencias);
          if (aiResult) {
            const mappedStatus = mapStatusToFrontend(aiResult.status);
            const clamped = clampScore(mappedStatus, aiResult.fulfillment_score);
            newStatus = mappedStatus;
            newScore = clamped;
            newJustificativa = aiResult.justificativa || '';
            newOQueFoiFeito = aiResult.o_que_foi_feito || '';
            newOQueFalta = aiResult.o_que_falta || '';
            issues.push(`Reavaliado via IA: status=${mappedStatus}, score=${clamped}`);
          } else {
            issues.push(`${newSources.length} nova(s) fonte(s) encontrada(s), IA indisponível para reavaliação`);
          }
          needsFix = true;
        } else {
          issues.push('Nenhuma nova fonte encontrada — mantendo avaliação atual');
        }
      }

      // --- Step 3: Check score clamping ---
      const clampedScore = clampScore(newStatus, newScore);
      if (Math.abs(clampedScore - newScore) > 1) {
        issues.push(`Score ${newScore} ajustado para ${clampedScore} (range de ${newStatus})`);
        newScore = clampedScore;
        needsFix = true;
      }

      // --- Step 4: Apply fixes ---
      if (needsFix && options.autoFix) {
        const updateData = {};
        if (newEvidencias !== ev.evidencias_usadas) updateData.evidencias_usadas = newEvidencias;
        if (newStatus !== ev.status) updateData.status = newStatus;
        if (newScore !== ev.fulfillment_score) updateData.fulfillment_score = newScore;
        if (newJustificativa !== ev.justificativa) updateData.justificativa = newJustificativa;
        if (newOQueFoiFeito !== ev.o_que_foi_feito) updateData.o_que_foi_feito = newOQueFoiFeito;
        if (newOQueFalta !== ev.o_que_falta) updateData.o_que_falta = newOQueFalta;

        if (Object.keys(updateData).length > 0) {
          await db().from('promise_explanations').update(updateData).eq('id', ev.id);
          action = issues.join('; ');
          report.fixed++;
        }
      }

      if (issues.length > 0) {
        report.total_issues++;
        report.issues.push({
          politician_id: pol.id, politician_name: pol.name,
          promise_id: ev.promise_id, explanation_id: ev.id,
          status_original: ev.status, score_original: ev.fulfillment_score,
          status_novo: needsFix ? newStatus : undefined,
          score_novo: needsFix ? newScore : undefined,
          issues, action,
          fontes_original: ev.evidencias_usadas?.length || 0,
          fontes_novo: newEvidencias.length
        });
      }
    }

    // --- Step 5: Recalculate C1/C2/C3 ---
    if (pol.c1_score != null || pol.c2_score != null || pol.c3_score != null) {
      const { data: indicators } = await db().from('indicators').select('*').eq('politician_id', pol.id);
      const { data: legalFacts } = await db().from('legal_facts').select('*').eq('politician_id', pol.id);

      const computedC1 = calcC1(promises || [], allExplanations || []);
      const computedC2 = calcC2(indicators || []);
      const computedC3 = calcC3(legalFacts || []);
      const w1 = 0.40, w2 = 0.35, w3 = 0.25;
      const computedFinal = parseFloat((computedC1 * w1 + (computedC2 ?? 0) * w2 + computedC3 * w3).toFixed(1));
      const computedGrade = calcGrade(computedFinal, computedC3);

      let needsScoreFix = false;
      const scoreIssues = [];

      if (Math.abs(computedC1 - (pol.c1_score || 0)) > 0.5) {
        scoreIssues.push(`C1: ${pol.c1_score} → ${computedC1}`);
        needsScoreFix = true;
      }
      if (computedC2 != null && Math.abs(computedC2 - (pol.c2_score || 0)) > 0.5) {
        scoreIssues.push(`C2: ${pol.c2_score} → ${computedC2}`);
        needsScoreFix = true;
      }
      if (Math.abs(computedC3 - (pol.c3_score || 100)) > 0.5) {
        scoreIssues.push(`C3: ${pol.c3_score} → ${computedC3}`);
        needsScoreFix = true;
      }
      if (Math.abs(computedFinal - (pol.final_score || 0)) > 0.5) {
        scoreIssues.push(`Final: ${pol.final_score} → ${computedFinal}`);
        needsScoreFix = true;
      }
      if (computedGrade !== pol.grade) {
        scoreIssues.push(`Grade: ${pol.grade} → ${computedGrade}`);
        needsScoreFix = true;
      }
      if ((computedC3 < 20) && (pol.final_score || 0) > 59) {
        scoreIssues.push(`C3=${computedC3} < 20 — nota máxima C aplicada`);
        needsScoreFix = true;
      }

      if (needsScoreFix && options.autoFix) {
        const cappedFinal = computedC3 < 20 ? Math.min(computedFinal, 59) : computedFinal;
        const cappedGrade = calcGrade(cappedFinal, computedC3);
        await db().from('politicians').update({
          c1_score: computedC1, c2_score: computedC2, c3_score: computedC3,
          final_score: parseFloat(cappedFinal.toFixed(1)), grade: cappedGrade,
          methodology_version: '1.0', last_evaluated_at: new Date().toISOString()
        }).eq('id', pol.id);
        report.issues.push({
          politician_id: pol.id, politician_name: pol.name,
          issues: scoreIssues,
          action: 'Scores recalculados e salvos'
        });
        report.total_issues++;
        report.fixed++;
      }
    }
  }

  report.completed_at = new Date().toISOString();
  return report;
}

function calcC1(promises, explanations) {
  const evalMap = {};
  (explanations || []).forEach(e => evalMap[e.promise_id] = e);
  let f = 0, pa = 0, total = 0;
  (promises || []).forEach(p => {
    const ev = evalMap[p.id];
    const s = ev ? normStatus(ev.status) : normStatus(p.status);
    if (s === 'cumprida') f++;
    else if (s === 'parcial') pa++;
    total++;
  });
  return total > 0 ? parseFloat(((f * 1.0 + pa * 0.5) / total * 100).toFixed(1)) : 0;
}

function calcC2(indicators) {
  const catScores = { seguranca: [], financas: [], funcionalismo: [] };
  (indicators || []).forEach(ind => {
    if (ind.score != null && catScores[ind.category]) catScores[ind.category].push(ind.score);
  });
  let weightSum = 0, scoreSum = 0;
  for (const [cat, scores] of Object.entries(catScores)) {
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const w = CAT_WEIGHTS[cat] || 0;
      scoreSum += avg * w;
      weightSum += w;
    }
  }
  return weightSum > 0 ? parseFloat((scoreSum / weightSum).toFixed(1)) : null;
}

function calcC3(legalFacts) {
  let c3 = 100;
  (legalFacts || []).forEach(fact => {
    if (fact.is_active !== false) c3 -= PENALTY_MAP[fact.fact_type] || 0;
  });
  return Math.max(0, c3);
}

export { runAudit };