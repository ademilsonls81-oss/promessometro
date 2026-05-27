export function normStatus(s) {
  const m = { 'cumprida': 'cumprida', 'parcial': 'parcial', 'parcialmente_cumprida': 'parcial', 'em_andamento': 'parcial', 'nao_iniciada': 'pendente', 'nao_classificada': 'pendente', 'pendente': 'pendente', 'descumprida': 'quebrada', 'quebrada': 'quebrada', 'nao_cumprida': 'quebrada', 'fulfilled': 'cumprida', 'broken': 'quebrada' };
  return m[s] || 'pendente';
}

export function expectedStatusForScore(score, currentStatus) {
  if (score == null) return null;
  if (score >= 80) return 'cumprida';
  if (score >= 40) return 'parcial';
  if (score === 0 && currentStatus === 'quebrada') return 'quebrada';
  return 'pendente';
}

export function getRealFontes(fontes) {
  if (!fontes || !Array.isArray(fontes)) return [];
  return fontes.filter(f => {
    if (!f) return false;
    const texto = (typeof f === 'string' ? f : (f.descricao || f.fonte || f.url || '')).toLowerCase();
    if (!texto) return false;
    if (texto.includes('ausência de evidências') || texto.includes('ausencia de evidencias')) return false;
    return true;
  });
}

export function isWaitingForReavaliation(justificativa) {
  if (!justificativa) return false;
  const t = justificativa.toLowerCase();
  return t.includes('aguardando reavaliação') || t.includes('aguardando reavaliacao');
}

export async function qualityScan(dbClient) {
  const { data: evaluations, error } = await dbClient
    .from('promise_explanations')
    .select('id, promise_id, status, fulfillment_score, justificativa, evidencias_usadas, confianca, modelo_ia, gerado_em, is_latest')
    .eq('is_latest', true)
    .limit(2000);

  if (error) throw new Error(`Erro ao buscar avaliações: ${error.message}`);

  const promiseIds = [...new Set((evaluations || []).map(e => e.promise_id).filter(Boolean))];
  const promisesMap = {};
  if (promiseIds.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < promiseIds.length; i += chunkSize) {
      const chunk = promiseIds.slice(i, i + chunkSize);
      const { data: promises } = await dbClient
        .from('promises')
        .select('id, promise_title, politician_name, politician_id, status')
        .in('id', chunk);
      for (const p of promises || []) promisesMap[p.id] = p;
    }
  }

  const polIds = [...new Set(Object.values(promisesMap).map(p => p.politician_id).filter(Boolean))];
  const polsMap = {};
  if (polIds.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < polIds.length; i += chunkSize) {
      const chunk = polIds.slice(i, i + chunkSize);
      const { data: pols } = await dbClient
        .from('politicians')
        .select('id, name, state, role')
        .in('id', chunk);
      for (const p of pols || []) polsMap[p.id] = p;
    }
  }

  const items = [];

  for (const ev of evaluations || []) {
    const promise = promisesMap[ev.promise_id];
    if (!promise) continue;

    const politician = polsMap[promise.politician_id];
    const issues = [];
    let category = 'valid';
    const score = ev.fulfillment_score;
    const status = normStatus(ev.status);

    if (isWaitingForReavaliation(ev.justificativa)) {
      category = 'notEvaluated';
      issues.push('Não avaliada: motivo padrão "Aguardando reavaliação por IA"');
    }

    if (score != null && status) {
      const expected = expectedStatusForScore(score, status);
      if (expected && status !== expected) {
        if (status === 'pendente' && score <= 39) {
          // Pendente e score <= 39 está correto
        } else if (status === 'quebrada' && score === 0) {
          // Quebrada e score 0 também é correto
        } else {
          issues.push(`Score ${score} incompatível com status "${status}" (esperado "${expected}")`);
          if (category === 'valid') category = 'warning';
        }
      }
    }

    const fontes = ev.evidencias_usadas || [];
    const fontesReais = getRealFontes(fontes);

    if (fontesReais.length === 0) {
      if (status === 'pendente' && score <= 25) {
        // Valid scenario with the new JS logic: no evidence -> status pendente + score <= 25
      } else {
        if (fontes.length > 0) {
          issues.push('INVÁLIDA: "Ausência de Evidências" como única fonte mas o score/status estão altos');
        } else {
          issues.push('INVÁLIDA: nenhuma evidência registrada e não foi limitado o score/status');
        }
        category = 'invalid';
      }
    } else if (fontesReais.length < 2) {
      issues.push(`Apenas ${fontesReais.length} fonte independente — o ideal são 2+`);
      if (category === 'valid') category = 'warning';
    }

    if (!ev.modelo_ia) {
      issues.push('Modelo IA não registrado');
      if (category === 'valid') category = 'warning';
    }

    if (!ev.gerado_em) {
      issues.push('Data de avaliação ausente');
      if (category === 'valid') category = 'warning';
    }

    if (politician) {
      if (promise.politician_name && politician.name) {
        const a = promise.politician_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const b = politician.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (a !== b) {
          issues.push(`Inconsistência: promessa="${promise.politician_name}" ≠ político="${politician.name}"`);
          if (category === 'valid') category = 'warning';
        }
      }
    }

    items.push({
      id: ev.id,
      promiseId: ev.promise_id,
      promiseTitle: promise.promise_title || 'Sem título',
      politicianName: promise.politician_name || 'Desconhecido',
      politicianId: promise.politician_id,
      state: politician?.state || null,
      score,
      status,
      category,
      issues,
      issuesCount: issues.length,
      model: ev.modelo_ia || 'não registrado',
      evaluatedAt: ev.gerado_em || null,
      fontesCount: fontesReais.length,
      fontesTotal: fontes.length,
      justification: (ev.justificativa || '').substring(0, 300)
    });
  }

  const counts = { valid: 0, warning: 0, invalid: 0, notEvaluated: 0 };
  for (const item of items) counts[item.category]++;
  const needsAttention = counts.warning + counts.invalid;

  return { counts, needsAttention, items };
}

export async function fetchCorrectionLog(dbClient, limit = 50) {
  try {
    const { data } = await dbClient
      .from('quality_monitor_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  } catch {
    return [];
  }
}

export async function logCorrection(dbClient, entry) {
  try {
    await dbClient.from('quality_monitor_log').insert({
      evaluation_id: entry.evaluationId,
      promise_id: entry.promiseId,
      problem: entry.problem,
      action: entry.action,
      details: entry.details || '',
      corrected_by: entry.correctedBy || 'admin',
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('[qualityMonitor] Erro ao salvar log:', e.message);
  }
}
