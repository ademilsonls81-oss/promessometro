import { createClient } from '@supabase/supabase-js';
import { classifySource, getUrlDomain, prioritizeSources } from './sourceLevel.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const CAT_WEIGHTS = { seguranca: 0.30, financas: 0.40, funcionalismo: 0.30 };
const PENALTY_MAP = { condemnation: 50, investigation: 20, alert: 10, irregularity: 5 };

function calcGrade(finalScore, c3) {
  let score = finalScore;
  if (c3 < 20) score = Math.min(score, 59);
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function calcC1(promises, promiseExplanations) {
  const evalMap = {};
  (promiseExplanations || []).forEach(e => evalMap[e.promessa_id || e.promise_id] = e);
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

function normStatus(s) {
  if (!s) return 'pendente';
  const map = {
    'parcialmente_cumprida': 'parcial', 'em_andamento': 'parcial',
    'nao_iniciada': 'pendente', 'nao_classificada': 'pendente',
    'descumprida': 'quebrada'
  };
  return map[s] || s;
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
    if (fact.is_active !== false) {
      c3 -= PENALTY_MAP[fact.fact_type] || 0;
    }
  });
  return Math.max(0, c3);
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

function hasDuplicateDomain(evidencias) {
  const counts = {};
  evidencias.forEach(ev => {
    const d = getUrlDomain(ev.url);
    if (d) counts[d] = (counts[d] || 0) + 1;
  });
  return Object.entries(counts).filter(([_, c]) => c > 1).map(([d, c]) => ({ domain: d, count: c }));
}

async function runAudit(options = { fix: false }) {
  const report = {
    started_at: new Date().toISOString(),
    politicians_checked: 0,
    total_issues: 0,
    fixed: 0,
    issues: []
  };

  const { data: pols } = await db().from('politicians').select('id, name, slug, c1_score, c2_score, c3_score, final_score, grade, methodology_version, last_evaluated_at');

  if (!pols) return report;

  for (const pol of pols) {
    const polIssues = [];
    report.politicians_checked++;

    // --- Check promise_explanations ---
    const { data: explanations } = await db()
      .from('promise_explanations')
      .select('id, promise_id, status, fulfillment_score, evidencias_usadas, o_que_foi_feito, o_que_falta, justificativa')
      .eq('is_latest', true);

    const polEvals = (explanations || []).filter(e => {
      return e.promise_id && pol.id;
    });

    // We need promises to match explanations to politician
    const { data: promises } = await db()
      .from('promises')
      .select('id, politician_id, politician_name, status')
      .eq('politician_id', pol.id);

    const polPromiseIds = new Set((promises || []).map(p => p.id));
    const relevantEvals = (explanations || []).filter(e => polPromiseIds.has(e.promise_id));

    // Check each evaluation
    for (const ev of relevantEvals) {
      const evIssues = [];

      // Rule: minimum 2 independent sources
      if (!hasIndependentSources(ev.evidencias_usadas)) {
        evIssues.push('Mínimo de 2 fontes independentes não atingido');
      }

      // Rule: duplicate domains
      const dupes = hasDuplicateDomain(ev.evidencias_usadas);
      dupes.forEach(d => {
        evIssues.push(`Domínio repetido ${d.domain} aparece ${d.count}x (máx 1 por domínio)`);
      });

      // Rule: nível 5 sem corroboração
      if (ev.evidencias_usadas) {
        const nivel5 = ev.evidencias_usadas.filter(e => classifySource(e.url) === 5);
        if (nivel5.length > 0 && ev.evidencias_usadas.length < 3) {
          evIssues.push(`Fonte(s) nível 5 sem corroboração de nível 1-3`);
        }
      }

      if (evIssues.length > 0) {
        report.total_issues++;
        const issue = {
          politician_id: pol.id, politician_name: pol.name,
          promise_id: ev.promise_id, explanation_id: ev.id,
          issues: evIssues, action: null
        };

        // Auto-fix
        if (options.fix) {
          const fixed = prioritizeSources(ev.evidencias_usadas || []);
          if (JSON.stringify(fixed) !== JSON.stringify(ev.evidencias_usadas)) {
            await db().from('promise_explanations').update({
              evidencias_usadas: fixed
            }).eq('id', ev.id);
            issue.action = 'Evidências reordenadas/priorizadas';
            report.fixed++;
          }
        }

        report.issues.push(issue);
      }

      // Check score clamping by status
      const clampedScore = clampScore(ev.status, ev.fulfillment_score);
      if (Math.abs(clampedScore - ev.fulfillment_score) > 1) {
        report.total_issues++;
        const issue = {
          politician_id: pol.id, politician_name: pol.name,
          promise_id: ev.promise_id, explanation_id: ev.id,
          issues: [`Score ${ev.fulfillment_score} fora do range do status ${ev.status} (deveria ser ${clampedScore})`],
          action: null
        };
        if (options.fix) {
          await db().from('promise_explanations').update({
            fulfillment_score: clampedScore
          }).eq('id', ev.id);
          issue.action = `Score corrigido de ${ev.fulfillment_score} para ${clampedScore}`;
          report.fixed++;
        }
        report.issues.push(issue);
      }
    }

    // --- Check C1 / C2 / C3 consistency ---
    if (pol.c1_score != null || pol.c2_score != null || pol.c3_score != null) {
      const { data: indicators } = await db().from('indicators').select('*').eq('politician_id', pol.id);
      const { data: legalFacts } = await db().from('legal_facts').select('*').eq('politician_id', pol.id);

      const computedC1 = calcC1(promises || [], explanations || []);
      const computedC2 = calcC2(indicators || []);
      const computedC3 = calcC3(legalFacts || []);

      const scoreIssues = [];

      if (Math.abs(computedC1 - (pol.c1_score || 0)) > 0.5) {
        scoreIssues.push(`C1 divergente: banco=${pol.c1_score}, calculado=${computedC1}`);
      }

      if (computedC2 != null && Math.abs(computedC2 - (pol.c2_score || 0)) > 0.5) {
        scoreIssues.push(`C2 divergente: banco=${pol.c2_score}, calculado=${computedC2}`);
      }

      if (Math.abs(computedC3 - (pol.c3_score || 100)) > 0.5) {
        scoreIssues.push(`C3 divergente: banco=${pol.c3_score}, calculado=${computedC3}`);
      }

      if (scoreIssues.length > 0) {
        report.total_issues++;
        const w1 = 0.40, w2 = 0.35, w3 = 0.25;
        const computedFinal = parseFloat((computedC1 * w1 + (computedC2 ?? 0) * w2 + computedC3 * w3).toFixed(1));
        const computedGrade = calcGrade(computedFinal, computedC3);
        const issue = {
          politician_id: pol.id, politician_name: pol.name,
          issues: scoreIssues,
          expected: { c1: computedC1, c2: computedC2, c3: computedC3, final: computedFinal, grade: computedGrade },
          actual: { c1: pol.c1_score, c2: pol.c2_score, c3: pol.c3_score, final: pol.final_score, grade: pol.grade },
          action: null
        };
        if (options.fix) {
          await db().from('politicians').update({
            c1_score: computedC1,
            c2_score: computedC2,
            c3_score: computedC3,
            final_score: computedFinal,
            grade: computedGrade,
            methodology_version: '1.0',
            last_evaluated_at: new Date().toISOString()
          }).eq('id', pol.id);
          issue.action = 'Scores recalculados e salvos';
          report.fixed++;
        }
        report.issues.push(issue);
      }

      // Rule: C3 < 20 and grade not capped
      if ((pol.c3_score ?? 100) < 20 && pol.final_score > 59) {
        report.total_issues++;
        const issue = {
          politician_id: pol.id, politician_name: pol.name,
          issues: [`C3=${pol.c3_score} < 20 mas final_score=${pol.final_score} > 59 (deveria ser no máx C)`],
          actual: { grade: pol.grade, final_score: pol.final_score },
          action: null
        };
        if (options.fix) {
          const newFinal = Math.min(pol.final_score, 59);
          const newGrade = calcGrade(newFinal, pol.c3_score);
          await db().from('politicians').update({
            final_score: newFinal, grade: newGrade,
            last_evaluated_at: new Date().toISOString()
          }).eq('id', pol.id);
          issue.action = `Final corrigido para ${newFinal} (grade ${newGrade})`;
          report.fixed++;
        }
        report.issues.push(issue);
      }
    }
  }

  report.completed_at = new Date().toISOString();
  return report;
}

function clampScore(status, score) {
  const ranges = {
    cumprida: [80, 100], parcial: [40, 79],
    pendente: [0, 39], quebrada: [0, 0]
  };
  const [min, max] = ranges[status] || [0, 100];
  return Math.max(min, Math.min(max, Math.round(score)));
}

export { runAudit };