-- =============================================
-- CORREÇÃO DE AUDITORIA - Promessômetro
-- =============================================

-- 1. Adicionar coluna is_verified em promise_evidences
ALTER TABLE promise_evidences ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- 2. Marcar evidências válidas como verificadas
UPDATE promise_evidences
SET is_verified = true
WHERE url IS NOT NULL AND url != ''
  AND descricao IS NOT NULL AND descricao != ''
  AND descricao != 'Fonte sugerida pelo modelo de linguagem'
  AND fonte IS NOT NULL AND fonte != '';

-- 3. Garantir que promise_explanations tenha apenas 1 is_latest por promise
-- (Remove duplicatas, mantendo apenas a mais recente)
DELETE FROM promise_explanations pe1
WHERE pe1.is_latest = true
AND EXISTS (
  SELECT 1 FROM promise_explanations pe2
  WHERE pe2.promise_id = pe1.promise_id
    AND pe2.is_latest = true
    AND pe2.gerado_em > pe1.gerado_em
);

-- 4. Recriar view de ranking usando promise_explanations como fonte única
DROP VIEW IF EXISTS politicians_ranking;
CREATE OR REPLACE VIEW politicians_ranking AS
SELECT 
  pol.id,
  pol.name,
  pol.slug,
  pol.photo_url,
  pol.party,
  pol.role,
  pol.state,
  COUNT(p.id) as total_promises,
  COUNT(pe.id) FILTER (WHERE pe.is_latest = true AND pe.status = 'cumprida') as fulfilled,
  COUNT(pe.id) FILTER (WHERE pe.is_latest = true AND pe.status IN ('parcial', 'parcialmente_cumprida')) as partial,
  COUNT(pe.id) FILTER (WHERE pe.is_latest = true AND pe.status = 'quebrada') as broken,
  ROUND(AVG(pe.fulfillment_score) FILTER (WHERE pe.is_latest = true)) as avg_score,
  CASE 
    WHEN COUNT(pe.id) FILTER (WHERE pe.is_latest = true) > 0
    THEN ROUND(AVG(pe.fulfillment_score) FILTER (WHERE pe.is_latest = true))
    ELSE 0
  END as percentage
FROM politicians pol
LEFT JOIN promises p ON p.politician_id = pol.id
LEFT JOIN promise_explanations pe ON pe.promise_id = p.id AND pe.is_latest = true
GROUP BY pol.id, pol.name, pol.slug, pol.photo_url, pol.party, pol.role, pol.state
ORDER BY percentage DESC, total_promises DESC;

-- 5. Adicionar campo is_verified_source em promise_evidences para rastrear credibilidade
ALTER TABLE promise_evidences ADD COLUMN IF NOT EXISTS is_verified_source BOOLEAN DEFAULT false;
UPDATE promise_evidences
SET is_verified_source = true
WHERE fonte ILIKE '%.gov.br'
   OR fonte ILIKE '%.leg.br'
   OR fonte ILIKE 'agenciabrasil.ebc.com.br'
   OR fonte ILIKE 'g1.globo.com'
   OR fonte ILIKE 'folha.uol.com.br'
   OR fonte ILIKE 'estadao.com.br';

-- 6. Criar índices para performance das queries
CREATE INDEX IF NOT EXISTS idx_promise_evidences_verified ON promise_evidences(is_verified);
CREATE INDEX IF NOT EXISTS idx_promise_evidences_promise_verified ON promise_evidences(promise_id, is_verified);

-- 7. Remover duplicatas de promise_evidences (mesma URL + mesma promise_id)
DELETE FROM promise_evidences e1
USING promise_evidences e2
WHERE e1.id > e2.id
  AND e1.promise_id = e2.promise_id
  AND e1.url = e2.url;

-- 8. Garantir que promises tenha o status normalizado
UPDATE promises
SET status = CASE
  WHEN status IN ('nao_iniciada', 'nao_classificada', 'pendente') THEN 'pendente'
  WHEN status IN ('parcialmente_cumprida', 'em_andamento') THEN 'parcial'
  WHEN status = 'descumprida' THEN 'quebrada'
  ELSE status
  END;

-- 9. Report final
SELECT 'CORREÇÃO CONCLUÍDA' as status;
