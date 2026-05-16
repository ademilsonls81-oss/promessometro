-- Migration: Fix score clamping for existing promises
-- Date: 2026-05-16
-- Description: Corrige promessas com score fora do range do status

-- Cumpridas com score < 80 -> ajustar para 85
UPDATE promises
SET fulfillment_score = 85,
    updated_at = NOW()
WHERE status = 'cumprida' AND (fulfillment_score IS NULL OR fulfillment_score < 80);

-- Parciais com score fora de 40-79 -> ajustar para 50
UPDATE promises
SET fulfillment_score = 50,
    updated_at = NOW()
WHERE status IN ('parcial', 'parcialmente_cumprida', 'em_andamento')
  AND (fulfillment_score IS NULL OR fulfillment_score < 40 OR fulfillment_score > 79);

-- Pendentes com score > 39 -> ajustar para 20
UPDATE promises
SET fulfillment_score = 20,
    updated_at = NOW()
WHERE status IN ('pendente', 'nao_iniciada', 'nao_classificada')
  AND (fulfillment_score IS NULL OR fulfillment_score > 39);

-- Quebradas com score > 0 -> ajustar para 0
UPDATE promises
SET fulfillment_score = 0,
    updated_at = NOW()
WHERE status IN ('quebrada', 'descumprida')
  AND (fulfillment_score IS NULL OR fulfillment_score > 0);

-- Fix promise_explanations scores to match status ranges
-- Cumpridas
UPDATE promise_explanations
SET fulfillment_score = 85
WHERE status = 'cumprida' AND (fulfillment_score IS NULL OR fulfillment_score < 80);

-- Parciais
UPDATE promise_explanations
SET fulfillment_score = 50
WHERE status IN ('parcial', 'parcialmente_cumprida', 'em_andamento')
  AND (fulfillment_score IS NULL OR fulfillment_score < 40 OR fulfillment_score > 79);

-- Pendentes
UPDATE promise_explanations
SET fulfillment_score = 20
WHERE status IN ('pendente', 'nao_iniciada', 'nao_classificada')
  AND (fulfillment_score IS NULL OR fulfillment_score > 39);

-- Quebradas
UPDATE promise_explanations
SET fulfillment_score = 0
WHERE status IN ('quebrada', 'descumprida')
  AND (fulfillment_score IS NULL OR fulfillment_score > 0);

-- Fix confianca values that were inserted as integers (50/85) instead of numeric (0.5/0.85)
UPDATE promise_explanations
SET confianca = 0.5
WHERE confianca > 1 AND confianca <= 50;

UPDATE promise_explanations
SET confianca = 0.85
WHERE confianca > 50 AND confianca <= 100;
