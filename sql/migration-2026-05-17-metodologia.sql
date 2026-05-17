-- ============================================
-- Migration: Nova Metodologia do Promessômetro
-- Data: 2026-05-17
-- ============================================

-- 1. Tabela de mandatos (lista fechada por mandato)
CREATE TABLE IF NOT EXISTS mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id UUID REFERENCES politicians(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  source_doc_url TEXT, -- link para o plano de governo TSE
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Novas colunas em promises (padrão metodológico)
ALTER TABLE promises ADD COLUMN IF NOT EXISTS mandate_id UUID REFERENCES mandates(id);
ALTER TABLE promises ADD COLUMN IF NOT EXISTS is_primary_source BOOLEAN DEFAULT false;
ALTER TABLE promises ADD COLUMN IF NOT EXISTS verification_sources JSONB DEFAULT '[]'::jsonb;
ALTER TABLE promises ADD COLUMN IF NOT EXISTS government_response TEXT;
ALTER TABLE promises ADD COLUMN IF NOT EXISTS contestation_sent_at TIMESTAMPTZ;
ALTER TABLE promises ADD COLUMN IF NOT EXISTS contestation_response TEXT;
ALTER TABLE promises ADD COLUMN IF NOT EXISTS fulfillment_percentage INTEGER CHECK (fulfillment_percentage >= 0 AND fulfillment_percentage <= 100);
ALTER TABLE promises ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 3. Tabela de indicadores objetivos (Camada 2)
CREATE TABLE IF NOT EXISTS indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id UUID REFERENCES politicians(id) ON DELETE CASCADE,
  mandate_id UUID REFERENCES mandates(id),
  name TEXT NOT NULL,
  description TEXT,
  weight INTEGER NOT NULL CHECK (weight > 0 AND weight <= 100),
  historical_average DECIMAL,
  historical_period TEXT, -- e.g. '2018-2022'
  result_value DECIMAL,
  result_year INTEGER,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  source_url TEXT,
  category TEXT CHECK (category IN ('seguranca', 'financas', 'funcionalismo')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabela de fatos jurídicos (Camada 3)
CREATE TABLE IF NOT EXISTS legal_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id UUID REFERENCES politicians(id) ON DELETE CASCADE,
  mandate_id UUID REFERENCES mandates(id),
  fact_type TEXT NOT NULL CHECK (fact_type IN ('condemnation', 'investigation', 'alert', 'irregularity')),
  description TEXT NOT NULL,
  authority TEXT NOT NULL,
  date DATE NOT NULL,
  penalty_points INTEGER NOT NULL CHECK (penalty_points IN (5, 10, 20, 50)),
  source_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Novas colunas em politicians para notas calculadas
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS c1_score DECIMAL;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS c2_score DECIMAL;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS c3_score DECIMAL;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS final_score DECIMAL;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'F'));
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS methodology_version TEXT DEFAULT '1.0';
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ;

-- 6. Tabela de metodologia (documento versionado)
CREATE TABLE IF NOT EXISTS methodology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  content JSONB NOT NULL,
  published_at TIMESTAMPTZ DEFAULT now(),
  is_current BOOLEAN DEFAULT false
);

-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_promises_mandate ON promises(mandate_id);
CREATE INDEX IF NOT EXISTS idx_promises_is_primary ON promises(is_primary_source);
CREATE INDEX IF NOT EXISTS idx_indicators_politician ON indicators(politician_id);
CREATE INDEX IF NOT EXISTS idx_legal_facts_politician ON legal_facts(politician_id);
CREATE INDEX IF NOT EXISTS idx_mandates_politician ON mandates(politician_id);
