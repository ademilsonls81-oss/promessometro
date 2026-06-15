import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_S_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const TAVILY_KEY = process.env.TAVILY_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = 'llama-3.1-8b-instant';
const FALLBACK_MODEL = 'gemma2-9b-it';
const DEEPSEEK_MODEL = 'deepseek/deepseek-chat';
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OR_KEY = process.env.UNFILTERED_API_KEY || '';
const BATCH_SIZE = 1;
const BUDGET_MS = 28000;
const MAX_TENTATIVAS = 10;
const RETRY_DELAY_MS = 10 * 60 * 1000;        // 10 min — erros de API
const RATE_LIMIT_DELAY_MS = 60 * 60 * 1000;   // 1h — rate limit diário Groq
const PENDENTE_RECHECK_MS = 24 * 60 * 60 * 1000; // 24h — avaliado mas pendente
const MAX_BLOCKED_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias — max tentativas

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

async function callOpenRouter(prompt) {
  if (!OR_KEY) return { error: 'no_or_key', text: '' };
  try {
    const r = await fetch(OR_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${OR_KEY}`,
        'HTTP-Referer': 'https://promessometro.com.br',
        'X-Title': 'Promessometro'
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1024
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      return { error: `OR_HTTP_${r.status}: ${errBody.substring(0, 100)}`, text: '' };
    }
    const d = await r.json();
    return { error: null, text: d.choices?.[0]?.message?.content || '', model: DEEPSEEK_MODEL };
  } catch (e) {
    return { error: `OR_timeout: ${e.message?.substring(0, 50)}`, text: '' };
  }
}

async function callGroq(prompt, model = PRIMARY_MODEL) {
  try {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1024
      }),
      signal: AbortSignal.timeout(20000)
    });

    // 429 = rate limit — não retry, vai direto pro fallback
    if (r.status === 429) {
      console.log(`[Groq] ${model} rate limited (429) — trying fallback`);
      if (model === PRIMARY_MODEL) {
        return callGroq(prompt, FALLBACK_MODEL);
      }
      // Ambos modelos Groq limitados — usa OpenRouter
      console.log(`[Groq] All Groq models limited — switching to OpenRouter DeepSeek`);
      return callOpenRouter(prompt);
    }

    // 400 = bad request (prompt inválido ou modelo indisponível)
    if (r.status === 400) {
      const errBody = await r.text().catch(() => '');
      console.log(`[Groq] HTTP 400: ${errBody.substring(0, 200)}`);
      return { error: `groq_400: ${errBody.substring(0, 80)}`, text: '' };
    }

    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      return { error: `groq_${r.status}: ${errBody.substring(0, 80)}`, text: '' };
    }

    const d = await r.json();
    return { error: null, text: d.choices?.[0]?.message?.content || '', model };
  } catch (e) {
    return { error: `groq_exception: ${e.message?.substring(0, 80)}`, text: '' };
  }
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
  // delays definidos como constantes globais acima

  try {
    const { data: promises, error: fetchErr } = await client
      .from('promises')
      .select('id, promise_title, politician_name, category, status, fulfillment_score, tentativas, next_retry_at')
      .eq('status', 'pendente')
      .or('next_retry_at.is.null,next_retry_at.lt.' + new Date().toISOString())
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

      // ── Limite de tentativas ──────────────────────────────────────────
      const tentativasAtuais = promise.tentativas || 0;
      if (tentativasAtuais >= MAX_TENTATIVAS) {
        const blockedUntil = new Date(Date.now() + MAX_BLOCKED_MS).toISOString();
        await client.from('promises').update({ next_retry_at: blockedUntil }).eq('id', promise.id);
        console.log(`[Cron] BLOQUEADA (${MAX_TENTATIVAS} tent): ${promise.promise_title?.substring(0, 50)}`);
        resultados.push({
          id: promise.id,
          titulo: promise.promise_title,
          erro: `Bloqueada: ${MAX_TENTATIVAS} tentativas sem resolução`,
          bloqueada_ate: blockedUntil
        });
        continue;
      }

      try {
        const query = `${promise.politician_name || ''} ${((promise.promise_title || '').replace(/[,.:;!?()]/g, ' ')).substring(0, 120)}`.replace(/\s+/g, ' ').trim();
        console.log(`[Cron] Processando: "${promise.promise_title?.substring(0, 50)}" (${promise.id})`);

        const { fontes, urls } = await searchTavily(query);
        console.log(`[Tavily] ${fontes.length} fontes encontradas`);

        const fontesText = fontes.length > 0
          ? fontes.map((f, i) => `[${i + 1}] ${f.titulo} — ${f.resumo} (Fonte: ${f.url})`).join('\n')
          : 'Nenhuma evidência encontrada na web.';

        const prompt = `Avalie esta promessa política brasileira. Responda SOMENTE JSON.

Político: ${promise.politician_name || 'Não informado'}
Promessa: ${promise.promise_title || 'Sem título'}
Categoria: ${promise.category || 'Não informada'}

Evidências da web:
${fontesText}

Regas de score:
- cumprida (80-100): conclusão total comprovada
- parcial (20-79): progresso mas incompleto
- pendente (0-39): sem progresso verificável
- quebrada (0): descumprida ou ação contrária

JSON obrigatório:
{"status":"cumprida|parcial|pendente|quebrada","score":0-100,"justificativa":"2+ frases citando evidências ou justificando ausência","o_que_foi_concluido":"o que foi feito, null se nada","o_que_ainda_falta":"pendências, null se completo","evidencias":[{"titulo":"","url":"","resumo":""}],"fontes":["url"],"grau_confianca":0-100}`;

        const { error, text, model: actualModel } = await callGroq(prompt);

        if (error) {
          const novasTentativas = tentativasAtuais + 1;
          const isRateLimit = error.includes('429') || error.includes('rate_limit') || error.includes('TPD');
          const retryDelay = isRateLimit ? RATE_LIMIT_DELAY_MS : RETRY_DELAY_MS;
          const nextRetry = new Date(Date.now() + retryDelay).toISOString();

          await client.from('promises').update({
            tentativas: novasTentativas,
            next_retry_at: nextRetry
          }).eq('id', promise.id);

          resultados.push({
            id: promise.id,
            titulo: promise.promise_title,
            erro: isRateLimit ? `Rate limit — retry em ${Math.round(retryDelay/60000)}min` : error,
            tentativas: novasTentativas,
            next_retry_at: nextRetry
          });
          // Se rate limit, para de processar esse batch — esperar cooldown
          if (isRateLimit) {
            console.log(`[Cron] Rate limit detectado — parando batch`);
            break;
          }
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
        let status = normalizeStatus(rawStatus);
        // Cross-validação score × status — garante consistência
        if (score >= 80 && (status === 'pendente' || status === 'parcial')) status = 'cumprida';
        if (score >= 50 && score < 80 && status === 'pendente') status = 'parcial';
        if (score < 20 && status === 'pendente') status = 'quebrada';
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
            modelo_ia: actualModel || 'unknown',
            is_latest: true,
            gerado_em: new Date().toISOString()
          });
        } catch (e) {
          console.error('[Cron] Erro insert promise_explanations:', e.message);
        }

        // Se status ainda é pendente após avaliação, agenda recheck em 24h
        // e incrementa tentativas para controle de loop
        const promiseUpdate = {
          status,
          fulfillment_score: score,
          ai_evaluation: parsed.justificativa || '',
          evidences_used: evidencias,
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        if (status === 'pendente') {
          promiseUpdate.tentativas = tentativasAtuais + 1;
          promiseUpdate.next_retry_at = new Date(Date.now() + PENDENTE_RECHECK_MS).toISOString();
        } else {
          // Resolvida — zera o controle de retry
          promiseUpdate.tentativas = 0;
          promiseUpdate.next_retry_at = null;
        }
        try {
          await client.from('promises').update(promiseUpdate).eq('id', promise.id);
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

        if (promises.indexOf(promise) < promises.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (e) {
        resultados.push({ id: promise.id, titulo: promise.promise_title, erro: e.message });
      }
    }

    // remaining = elegíveis agora (exclui bloqueadas com retry futuro)
    const nowIso = new Date().toISOString();
    const { count: remaining } = await client
      .from('promises')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .or('next_retry_at.is.null,next_retry_at.lt.' + nowIso);

    const { count: totalPendente } = await client
      .from('promises')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente');

    return res.json({
      processadas: resultados.filter(r => !r.erro).length,
      resultados,
      remaining: remaining || 0,
      totalPendente: totalPendente || 0,
      hasMore: (remaining || 0) > 0,
      ms: Date.now() - start
    });
  } catch (err) {
    console.error('[Cron] FATAL:', err.message);
    return res.status(500).json({ error: err.message, ms: Date.now() - start });
  }
}
