-- =============================================
-- Promessômetro - Classificação Inteligente de Promessas
-- Executar no Editor SQL do Supabase
-- =============================================

-- 1. Adicionar coluna de classificação_ia
ALTER TABLE promises ADD COLUMN IF NOT EXISTS classificacao_ia JSONB;

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_promisses_classificacao ON promises USING GIN(classificacao_ai);

-- 3. Criar enum para tipos de classificação
DO $$ BEGIN
  CREATE TYPE tipo_promessa AS ENUM (
    'objetiva',
    'subjetiva', 
    'mensuravel',
    'simbolica',
    'dependente_congresso',
    'dependente_orcamento',
    'estadual',
    'federal'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Adicionar coluna tipo se não existir
ALTER TABLE promises ADD COLUMN IF NOT EXISTS tipo_promessa tipo_promessa;

-- 5. Verificar
SELECT 
  'Classificação adicionada!' as status,
  column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'promises' AND column_name = 'classificacao_ia';