-- AI Evaluator System: promise_explanations enhancements

-- is_latest flag for tracking evaluation history
ALTER TABLE promise_explanations ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT FALSE;

-- Index for faster latest lookups
CREATE INDEX IF NOT EXISTS idx_promise_explanations_latest ON promise_explanations(promise_id, is_latest) WHERE is_latest = TRUE;

-- Index for human review queue (low confidence)
CREATE INDEX IF NOT EXISTS idx_promise_explanations_confianca ON promise_explanations(confianca) WHERE confianca < 0.4;

-- trusted_sources table for cross-validation
CREATE TABLE IF NOT EXISTS trusted_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT,
  type TEXT DEFAULT 'news',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed trusted sources if empty
INSERT INTO trusted_sources (name, url, type) VALUES
  ('G1 - Globo', 'https://g1.globo.com', 'news'),
  ('Folha de S.Paulo', 'https://www.folha.uol.com.br', 'news'),
  ('UOL', 'https://www.uol.com.br', 'news'),
  ('CNN Brasil', 'https://www.cnnbrasil.com.br', 'news'),
  ('Valor Econômico', 'https://valor.globo.com', 'news'),
  ('Estadão', 'https://www.estadao.com.br', 'news'),
  ('Metropoles', 'https://www.metropoles.com', 'news'),
  ('Agência Brasil', 'https://agenciabrasil.ebc.com.br', 'government'),
  ('Presidência da República', 'https://www.gov.br', 'government'),
  ('Diário Oficial da União', 'https://www.in.gov.br', 'government'),
  ('Câmara dos Deputados', 'https://www.camara.leg.br', 'government'),
  ('Senado Federal', 'https://www12.senado.leg.br', 'government'),
  ('TCU', 'https://portal.tcu.gov.br', 'government'),
  ('IGEPP', 'https://portaldeboaspraticas.iffar.edu.br', 'research')
ON CONFLICT DO NOTHING;