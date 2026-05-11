-- =============================================
-- Promessômetro - Tabela de Explicabilidade
-- promise_explanations: Armazena explicações detalhadas das avaliações
-- =============================================

-- 1. Criar tipo enumerado para status (se não existir)
DO $$ 
BEGIN
  CREATE TYPE promise_status_enum AS ENUM (
    'cumprida', 
    'parcialmente_cumprida', 
    'em_andamento', 
    'nao_iniciada', 
    'descumprida',
    'nao_classificada'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Criar tabela promise_explanations
CREATE TABLE IF NOT EXISTS promise_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id UUID REFERENCES promises(id) ON DELETE CASCADE,
  status promise_status_enum,
  fulfillment_score INT,
  criterio_aplicado TEXT,
  justificativa TEXT,
  evidencias_usadas JSONB DEFAULT '[]'::jsonb,
  o_que_falta TEXT,
  o_que_foi_feito TEXT,
  confianca NUMERIC(3,2),
  motivo_confianca TEXT,
  gerado_em TIMESTAMPTZ DEFAULT NOW(),
  modelo_ia TEXT DEFAULT 'llama-3.3-70b-versatile'
);

-- 3. Criar índices
CREATE INDEX IF NOT EXISTS idx_explanations_promise ON promise_explanations(promise_id);
CREATE INDEX IF NOT EXISTS idx_explanations_date ON promise_explanations(gerado_em DESC);
CREATE INDEX IF NOT EXISTS idx_explanations_confianca ON promise_explanations(confianca);

-- 4. Habilitar RLS
ALTER TABLE promise_explanations ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
DROP POLICY IF EXISTS "explanations_view" ON promise_explanations;
CREATE POLICY "explanations_view" ON promise_explanations FOR SELECT USING (true);

DROP POLICY IF EXISTS "explanations_insert" ON promise_explanations;
CREATE POLICY "explanations_insert" ON promise_explanations FOR INSERT WITH CHECK (true);

-- 6. Verificar tabela criada
SELECT COUNT(*) as total_explanations FROM promise_explanations;
SELECT * FROM promise_explanations LIMIT 1;

-- 7. Adicionar kolom ke tabela promises se não existir
ALTER TABLE promises ADD COLUMN IF NOT EXISTS classificacao_ia JSONB;