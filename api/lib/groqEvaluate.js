const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

function extractJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function groqCall(prompt, key) {
  const delays = [500, 1000, 2000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const r = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.15, max_tokens: 800 }),
        signal: AbortSignal.timeout(15000)
      });
      if (r.status === 429) {
        if (attempt < delays.length) { await new Promise(resolve => setTimeout(resolve, delays[attempt])); continue; }
        return { error: 'rate_limited', text: '' };
      }
      if (!r.ok) return { error: `HTTP ${r.status}`, text: '' };
      const d = await r.json();
      return { error: null, text: d.choices?.[0]?.message?.content || '' };
    } catch (e) {
      if (attempt < delays.length) { await new Promise(resolve => setTimeout(resolve, delays[attempt])); continue; }
      return { error: e.message?.substring(0, 80), text: '' };
    }
  }
  return { error: 'max_retries', text: '' };
}

export async function groqReevaluate(promiseData, explanationData, evidencesData) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return { error: 'GROQ_API_KEY não configurada' };
  }

  const politician = promiseData.nome_politico || promiseData.politician_name || '?';
  const titulo = promiseData.titulo || promiseData.promise_title || '?';
  const statusAtual = explanationData?.status || 'pendente';
  const scoreAtual = explanationData?.fulfillment_score || 50;
  const oQueFez = explanationData?.o_que_foi_feito || '';
  const oQueFalta = explanationData?.o_que_falta || '';
  const justificativa = explanationData?.justificativa || '';
  const fontes = Array.isArray(evidencesData) ? evidencesData : [];
  const confiancaAtual = explanationData?.confianca || 0.5;

  const fontesText = fontes.length > 0
    ? fontes.map(f => `- ${f.title || f.description || 'Sem descrição'} (${f.source_name || f.url || 'Sem fonte'})`).join('\n')
    : 'Nenhuma fonte disponível';

  const temEvidencia = fontes.length > 0;

  const prompt = `Você é um avaliador independente e rigoroso de promessas políticas brasileiras.

Reavalie esta promessa com base NAS EVIDÊNCIAS disponíveis abaixo.

## Dados Atuais:
**Político:** ${politician}
**Promessa:** ${titulo}
**Status atual:** ${statusAtual}
**Score atual:** ${scoreAtual}
**Confiança atual:** ${(confiancaAtual * 100).toFixed(0)}%

**O que foi feito:**
${oQueFez || 'Não informado'}

**O que falta:**
${oQueFalta || 'Não informado'}

**Justificativa atual:**
${justificativa || 'Sem justificativa'}

## Evidências:
${fontesText}

Formate o_que_foi_feito e o_que_falta como uma lista de itens, cada item começando com "- ".

## Regras:
1. Use as evidências acima para reavaliar — o que foi feito, o que falta, score e status
2. Se status/score estiverem inconsistentes com as evidências, CORRIJA
3. Descreva em o_que_foi_feito as ações concretas como UMA LISTA (cada item começando com "- ")
4. Descreva em o_que_falta os itens pendentes como UMA LISTA (cada item começando com "- ")
5. Se não houver evidência alguma, mantenha dados existentes com confiança baixa

## Classificação:
- cumprida (80-100): evidências claras de conclusão total
- parcial (40-79): progresso concreto mas incompleto
- pendente (0-39): pouco ou nenhum progresso
- quebrada (0): ação contrária ou promessa abandonada

Responda APENAS JSON válido (sem markdown):
{
  "status": "cumprida|parcial|pendente|quebrada",
  "score": 0-100,
  "o_que_foi_feito": "- item 1\n- item 2\n- item 3",
  "o_que_falta": "- item 1\n- item 2",
  "justificativa": "explicação CITANDO as evidências usadas",
  "confianca": 0.0-1.0,
  "campos_corrigidos": ["lista de campos que foram corrigidos"],
  "observacao": "nota sobre a avaliação"
}`;

  const { error, text } = await groqCall(prompt, key);
  if (error) {
    return { error: error === 'rate_limited' ? 'Rate limit excedido' : `Groq: ${error}` };
  }

  const parsed = extractJSON(text);
  if (!parsed) {
    return { error: 'Resposta inválida da IA' };
  }

  const evidenciasUsadas = fontes.slice(0, 8).map(e => ({ titulo: e.title || e.description || '', url: e.url || '', resumo: e.description || '' }));

  return {
    status: parsed.status || statusAtual,
    score: Math.max(0, Math.min(100, Math.round(parsed.score ?? scoreAtual))),
    o_que_foi_feito: parsed.o_que_foi_feito || oQueFez,
    o_que_falta: parsed.o_que_falta || oQueFalta,
    justificativa: parsed.justificativa || justificativa,
    confianca: Math.max(0, Math.min(1, parsed.confianca ?? confiancaAtual)),
    campos_corrigidos: parsed.campos_corrigidos || [],
    observacao: parsed.observacao || '',
    modelo: `groq-${MODEL}`,
    evidencias_usadas: evidenciasUsadas
  };
}

function nivelFonte(url) {
  if (!url) return 5;
  const u = url.toLowerCase();
  if (u.includes('dou.gov') || u.includes('diariooficial') || u.includes('tse.jus') ||
    u.includes('tce.') || u.includes('tcu') || u.includes('planalto') || u.includes('senado') ||
    u.includes('camara') || u.includes('decreto') || u.includes('portaria')) return 1;
  if (u.includes('ibge') || u.includes('ipea') || u.includes('gov.br') || u.includes('dados.gov') ||
    u.includes('transparencia')) return 2;
  if (u.includes('g1.globo') || u.includes('folha') || u.includes('estadao') || u.includes('uol') ||
    u.includes('oglobo') || u.includes('cnn') || u.includes('bbc') || u.includes('poder360') ||
    u.includes('metropoles') || u.includes('r7') || u.includes('ebc')) return 3;
  if (u.includes('youtube') || u.includes('instagram') || u.includes('twitter') || u.includes('x.com')) return 4;
  return 5;
}

async function searchDDG(query) {
  const q = query.substring(0, 200);
  const out = [];

  try {
    const params = new URLSearchParams({ q });
    const r = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      body: params.toString(),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) {
      console.error('[searchDDG] HTTP', r.status, 'para', q.substring(0, 50));
    } else {
      const html = await r.text();
      if (html.length < 200) {
        console.error('[searchDDG] resposta curta:', html.substring(0, 100));
      }
      const re = /<a rel="nofollow" class="result__a" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        const url = m[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
        const title = m[2].replace(/<[^>]+>/g, '').trim();
        const snippet = m[3].replace(/<[^>]+>/g, '').trim().substring(0, 200);
        if (title && url && !url.includes('duckduckgo')) out.push({ title, url, snippet, nivel: nivelFonte(url) });
      }
    }
  } catch (e) {
    console.error('[searchDDG] erro:', e.message?.substring(0, 80), 'para', q.substring(0, 50));
  }

  return out.slice(0, 8);
}

export async function groqEvaluate(promise) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return { status: 'pendente', score: 0, motivo: 'GROQ_API_KEY não configurada', confianca: 0, evidencias: [], modelo: 'error' };
  }

  const q = `${promise.politician_name || ''} ${(promise.promise_title || '').replace(/[,.:;!?()]/g, ' ')}`.replace(/\s+/g, ' ').trim().substring(0, 150);

  const evidencias = await searchDDG(q);
  const temFontes = evidencias.filter(e => e.nivel <= 3).length > 0;
  const evText = temFontes
    ? evidencias.map(e => `[Nível ${e.nivel}] ${e.title} (${e.url}) - ${e.snippet || ''}`).join('\n')
    : '';

  const prompt = `Você é um especialista em avaliar promessas políticas brasileiras. Avalie com base no seu conhecimento.

Político: ${promise.politician_name || '?'}
Promessa: ${promise.promise_title || '?'}${temFontes ? `\n\nEvidências encontradas:\n${evText}` : ''}

Regras de avaliação (responda APENAS JSON, sem markdown):
- cumprida (80-100): evidências claras de conclusão
- parcial (40-79): progresso concreto mas incompleto
- pendente (0-39): pouco ou nenhum progresso
- quebrada (0): ação contrária ou prazo expirado${temFontes ? '' : '\n- SEM evidências na web: use seu conhecimento geral, score máximo 40'}

{"score":0,"status":"pendente|parcial|cumprida|quebrada","motivo":"explicação curta"}`;

  const { error, text } = await groqCall(prompt, key);
  if (error) {
    return { status: 'pendente', score: 0, motivo: error === 'rate_limited' ? 'Rate limit excedido' : `Groq: ${error}`, confianca: 0, evidencias, modelo: 'error' };
  }

  const parsed = extractJSON(text);
  if (!parsed) return { status: 'pendente', score: 0, motivo: 'Resposta inválida', confianca: 0, evidencias, modelo: MODEL };

  return {
    status: parsed.status || 'pendente',
    score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
    motivo: (parsed.motivo || '').substring(0, 500),
    confianca: temFontes ? Math.min(1, evidencias.filter(e => e.nivel <= 3).length / 5 + 0.2) : 0,
    evidencias,
    modelo: `groq-${MODEL}`
  };
}