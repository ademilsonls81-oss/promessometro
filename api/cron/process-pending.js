import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const TAVILY_KEY = process.env.TAVILY_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const BATCH_SIZE = 20;
const DELAY_BETWEEN_MS = 30000; // 30s entre cada promessa = 2 por minuto
const BUDGET_MS = 590000; // ~10 minutos (cron a cada 10 min)

function db() { return createClient(SUPABASE_URL, SERVICE_ROLE_KEY); }

const STATUS_MAP = {
  cumprida: 'cumprida', parcial: 'parcial', pendente: 'pendente',
  descumprida: 'quebrada', quebrada: 'quebrada'
};

function scoreToStatus(score) {
  if (score >= 80) return 'cumprida';
  if (score >= 50) return 'parcial';
  if (score >= 20) return 'pendente';
  return 'quebrada';
}

function normalizeStatus(s) {
  return STATUS_MAP[s] || scoreToStatus(0);
}

function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;
  let clean = text.trim();
  const blockMatch = clean.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (blockMatch) clean = blockMatch[1].trim();
  let depth = 0, start = -1;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(clean.substring(start, i + 1)); } catch {}
      }
    }
  }
  return null;
}

async function searchTavily(query) {
  if (!TAVILY_KEY) return { fontes: [], urls: [] };
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: TAVILY_KEY, query: query.substring(0, 200), max_results: 5, search_depth: 'basic' }),
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) return { fontes: [], urls: [] };
    const data = await r.json();
    const results = (data.results || []).map(item => ({
      titulo: item.title || '',
      url: item.url || '',
      resumo: item.content ? item.content.substring(0, 300) : ''
    }));
    const urls = results.map(r => r.url).filter(Boolean);
    return { fontes: results, urls };
  } catch (e) {
    console.error('[Tavily] Erro:', e.message?.substring(0, 80));
    return { fontes: [], urls: [] };
  }
}

async function callGroq(prompt) {
  const delays = [500, 1500, 3000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const r = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 1024
        }),
        signal: AbortSignal.timeout(20000)
      });
      if (r.status === 429) {
        if (attempt < delays.length) { await new Promise(r => setTimeout(r, delays[attempt])); continue; }
        return { error: 'rate_limited', text: '' };
      }
      if (!r.ok) return { error: `HTTP ${r.status}`, text: '' };
      const d = await r.json();
      return { error: null, text: d.choices?.[0]?.message?.content || '' };
    } catch (e) {
      if (attempt < delays.length) { await new Promise(r => setTimeout(r, delays[attempt])); continue; }
      return { error: e.message?.substring(0, 80), text: '' };
    }
  }
  return { error: 'max_retries', text: '' };
}

export default async function handler(req, res) {
  const start = Date.now();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.query?.secret || req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!GROQ_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });
  }

  const client = db();
  const resultados = [];

  try {
    const { data: promises, error: fetchErr } = await client
      .from('promises')
      .select('id, promise_title, politician_name, category, status, fulfillment_score')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      return res.status(500).json({ error: `Erro ao buscar promessas: ${fetchErr.message}` });
    }

    if (!promises?.length) {
      return res.json({ processadas: 0, resultados: [], remaining: 0, hasMore: false, ms: Date.now() - start });
    }

    for (const promise of promises) {
      if (Date.now() - start > BUDGET_MS) {
        resultados.push({ id: promise.id, erro: 'Budget time exceeded' });
        break;
      }

      try {
        const query = `${promise.politician_name || ''} ${((promise.promise_title || '').replace(/[,.:;!?()]/g, ' ')).substring(0, 120)}`.replace(/\s+/g, ' ').trim();

        const { fontes, urls } = await searchTavily(query);

        const fontesText = fontes.length > 0
          ? fontes.map((f, i) => `[${i + 1}] ${f.titulo} — ${f.resumo} (Fonte: ${f.url})`).join('\n')
          : 'Nenhuma evidência encontrada na web.';

        const prompt = `Você é um avaliador independente e rigoroso de promessas políticas brasileiras.

Analise a promessa abaixo com base nas evidências da web.

**Político:** ${promise.politician_name || 'Não informado'}
**Promessa:** ${promise.promise_title || 'Sem título'}
**Categoria:** ${promise.category || 'Não informada'}

## Evidências encontradas na web:
${fontesText}

## Regras de avaliação:
- cumprida (80-100): evidências claras de conclusão total
- parcial (20-79): progresso concreto mas incompleto (pode ser qualquer faixa dependendo do contexto)
- pendente (0-39): pouco ou nenhum progresso verificável
- quebrada (0): ação contrária, abandono ou promessa descumprida

IMPORTANTE: O score deve refletir o grau de conclusão REAL baseado nas evidências. Uma promessa parcialmente cumprida pode ter score entre 20-79 dependendo do quanto foi feito.

Responda SOMENTE JSON válido (sem markdown) com EXATAMENTE estes campos:
{
  "status": "cumprida|parcial|pendente|quebrada",
  "score": 0-100,
  "justificativa": "explicação detalhada com pelo menos 2 frases citando as evidências encontradas ou justificando a ausência delas. Mencione o político e o que foi verificado.",
  "o_que_foi_concluido": "texto descritivo do que já foi feito, com detalhes das ações implementadas. Null se nada foi concluído.",
  "o_que_ainda_falta": "texto descritivo do que ainda falta ser feito, com pendências específicas. Null se está completo.",
  "evidencias": [
    {
      "titulo": "título da evidência encontrada",
      "url": "url da fonte",
      "resumo": "resumo do que foi encontrado"
    }
  ],
  "fontes": ["url1", "url2"],
  "grau_confianca": 0-100
}

## Exemplo de resposta ideal:
{
  "status": "parcial",
  "score": 45,
  "justificativa": "O governo de [Político] iniciou ações de [tema da promessa], mas a expansão completa ainda não foi concluída. Há registros de programas pontuais, mas sem cobertura abrangente.",
  "o_que_foi_concluido": "Implantação de [ação] em algumas unidades via programa estadual.",
  "o_que_ainda_falta": "Expandir para a maioria das unidades. Não há dados sobre quantas unidades foram efetivamente integradas.",
  "evidencias": [
    {
      "titulo": "Título da notícia ou fonte oficial",
      "url": "https://exemplo.com/noticia",
      "resumo": "Resumo do que foi encontrado na fonte."
    }
  ],
  "fontes": ["https://exemplo.com/fonte1", "https://exemplo.com/fonte2"],
  "grau_confianca": 55
}

O campo grau_confianca deve ser:
- 90-100: múltiplas fontes oficiais e imprensa confiável
- 70-89: poucas fontes mas consistentes
- 50-69: evidências limitadas
- 20-49: pouca ou nenhuma evidência concreta
- 0-19: completamente baseado em suposição`;

        const { error, text } = await callGroq(prompt);

        if (error) {
          resultados.push({
            id: promise.id,
            titulo: promise.promise_title,
            erro: error === 'rate_limited' ? 'Rate limit Groq excedido' : `Groq: ${error}`
          });
          continue;
        }

        const parsed = extractJSON(text);
        if (!parsed) {
          resultados.push({
            id: promise.id,
            titulo: promise.promise_title,
            erro: 'Resposta inválida da IA'
          });
          continue;
        }

        const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 50)));
        const rawStatus = parsed.status || scoreToStatus(score);
        const status = normalizeStatus(rawStatus);
        const evidencias = Array.isArray(parsed.evidencias) ? parsed.evidencias.slice(0, 8) : [];
        const fontesUrls = Array.isArray(parsed.fontes) ? parsed.fontes.slice(0, 10) : urls.slice(0, 10);
        const confianca = Math.max(0, Math.min(100, Math.round(parsed.grau_confianca ?? 50)));

        const oQueConcluido = parsed.o_que_foi_concluido || parsed.o_que_foi_feito || null;
        const oQueFalta = parsed.o_que_ainda_falta || parsed.o_que_falta || null;

        try {
          await client.from('promise_explanations').update({ is_latest: false })
            .eq('promise_id', promise.id).eq('is_latest', true);
        } catch {}

        try {
          await client.from('promise_explanations').insert({
            promise_id: promise.id,
            status,
            fulfillment_score: score,
            criterio_aplicado: 'cron_tavily_groq_v1',
            justificativa: parsed.justificativa || '',
            o_que_foi_feito: oQueConcluido || '',
            o_que_falta: oQueFalta || '',
            evidencias_usadas: evidencias,
            confianca: confianca / 100,
            modelo_ia: `groq-${MODEL}`,
            is_latest: true,
            gerado_em: new Date().toISOString()
          });
        } catch (e) {
          console.error('[Cron] Erro insert promise_explanations:', e.message);
        }

        try {
          await client.from('promises').update({
            status,
            fulfillment_score: score,
            ai_evaluation: parsed.justificativa || '',
            evidences_used: evidencias,
            last_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq('id', promise.id);
        } catch (e) {
          console.error('[Cron] Erro update promises:', e.message);
        }

        resultados.push({
          id: promise.id,
          titulo: promise.promise_title,
          politico: promise.politician_name,
          status,
          score,
          justificativa: parsed.justificativa || '',
          o_que_foi_concluido: oQueConcluido,
          o_que_ainda_falta: oQueFalta,
          evidencias,
          fontes: fontesUrls,
          grau_confianca: confianca
        });

        await new Promise(r => setTimeout(r, DELAY_BETWEEN_MS));
      } catch (e) {
        resultados.push({ id: promise.id, titulo: promise.promise_title, erro: e.message });
      }
    }

    const { count: remaining } = await client
      .from('promises')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente');

    return res.json({
      processadas: resultados.filter(r => !r.erro).length,
      resultados,
      remaining: remaining || 0,
      hasMore: (remaining || 0) > 0,
      ms: Date.now() - start
    });
  } catch (err) {
    console.error('[Cron] FATAL:', err.message);
    return res.status(500).json({ error: err.message, ms: Date.now() - start });
  }
}
