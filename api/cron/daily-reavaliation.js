import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_S_URL || 'https://liqutcjzzrqstivvfele.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  const expected = process.env.CRON_SECRET;
  if (!secret || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set' });
  }

  const { data: promises, error: pErr } = await supabase
    .from('promises')
    .select('id, promise_title, texto_original, politician_name, status, fulfillment_score')
    .in('status', ['em_andamento', 'parcialmente_cumprida', 'nao_classificada', 'nao_iniciada', 'cumprida'])
    .limit(5);

  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!promises?.length) return res.json({ status: 'ok', evaluated: 0 });

  let evaluated = 0;
  for (const promise of promises) {
    const { data: evidences } = await supabase
      .from('promise_evidences')
      .select('source_name, evidence_description, evidence_link')
      .eq('promise_id', promise.id)
      .in('validation_status', ['approved', 'pendente'])
      .limit(5);

    const evidenceText = (evidences || []).map(e => `- ${e.source_name}: ${e.evidence_description}`).join('\n') || 'Nenhuma evidência.';

    const prompt = `Avalie a promessa do político ${promise.politician_name}: "${promise.promise_title}". Descrição: ${promise.texto_original || 'não informada'}.\n\nEvidências:\n${evidenceText}\n\nCRITÉRIOS: cumprida(80-100), parcialmente_cumprida(40-79), em_andamento(20-39), nao_iniciada(0-19), nao_classificada(0).\n\nResponda SOMENTE JSON: {"status":"cumprida|parcialmente_cumprida|em_andamento|nao_iniciada|nao_classificada","fulfillment_score":0-100,"justificativa":"explicação clara em português"}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 500 })
    });

    let score = promise.fulfillment_score ?? 50;
    let status = promise.status;
    let justificativa = 'Avaliação automática via IA Groq.';

    if (response.ok) {
      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || '';
      if (raw) {
        try {
          const p = JSON.parse(raw);
          score = p.fulfillment_score ?? score;
          status = p.status || status;
          justificativa = p.justificativa || justificativa;
        } catch (e) {
          console.log(`[Cron] Parse error for ${promise.id}: ${e.message}`);
        }
      }
    } else {
      console.log(`[Cron] Groq error ${response.status} for ${promise.id}`);
    }

    const now = new Date().toISOString();
    await supabase
      .from('promise_explanations')
      .update({ o_que_falta: `Substituído em ${now}` })
      .eq('promise_id', promise.id);

    const { error: insErr } = await supabase.from('promise_explanations').insert({
      promise_id: promise.id,
      status,
      fulfillment_score: score,
      criterio_aplicado: 'avaliacao_groq_v4',
      justificativa,
      evidencias_usadas: [],
      o_que_falta: 'Aguardando evidências.',
      o_que_foi_feito: 'Avaliação automática via Groq AI (llama-3.3-70b-versatile).',
      confianca: 0.5,
      motivo_confianca: 'Avaliação automática via Groq.',
      modelo_ia: 'llama-3.3-70b-versatile',
      gerado_em: now
    });

    if (insErr) {
      console.log(`[Cron] INSERT ERROR ${promise.id}: ${insErr.message}`);
    }
    evaluated++;
  }

  return res.json({ status: 'ok', evaluated, timestamp: new Date().toISOString() });
}