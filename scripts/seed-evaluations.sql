-- Script para popular promise_explanations com dados básicos
-- Execute no SQL Editor do Supabase

-- Inserir avaliações baseadas no status atual das promessas
INSERT INTO promise_explanations (
  promise_id,
  status,
  fulfillment_score,
  criterio_aplicado,
  justificativa,
  evidencias_usadas,
  o_que_falta,
  o_que_foi_feito,
  confianca,
  modelo_ia,
  is_latest,
  gerado_em
)
SELECT 
  p.id,
  p.status,
  COALESCE(p.fulfillment_score, 50),
  'seed_2026',
  CASE 
    WHEN p.status = 'cumprida' THEN 'Promessa avaliada como cumprida pelo sistema'
    WHEN p.status = 'parcial' THEN 'Promessa parcialmente cumplida - progresso demonstrado'
    WHEN p.status = 'pendente' THEN 'Promessa ainda não avaliada'
    WHEN p.status = 'quebrada' THEN 'Promessa não foi cumprida'
    ELSE 'Avaliação automática pendente'
  END,
  '[]'::jsonb,
  CASE 
    WHEN p.status = 'cumprida' THEN 'Completo'
    ELSE 'Aguardando avaliação completa'
  END,
  'Dados populados via seed script em ' || NOW()::text,
  50,
  'seed-v1',
  true,
  NOW()
FROM promises p
WHERE NOT EXISTS (
  SELECT 1 FROM promise_explanations pe 
  WHERE pe.promise_id = p.id AND pe.is_latest = true
)
ON CONFLICT DO NOTHING;

-- Verificar resultado
SELECT 
  p.politician_name,
  p.promise_title,
  p.status,
  pe.status as evaluation_status,
  pe.justificativa,
  pe.gerado_em
FROM promises p
LEFT JOIN promise_explanations pe ON p.id = pe.promise_id AND pe.is_latest = true
ORDER BY p.politician_name, p.created_at
LIMIT 20;