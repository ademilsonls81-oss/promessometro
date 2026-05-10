-- =============================================
-- Promessômetro - Script SQL Corrigido e Definitivo
-- Baseado no schema real do Supabase
-- Executar no Editor SQL do Supabase
-- =============================================

-- =============================================
-- 1. CRIAR ENUMS
-- =============================================

DO $$ BEGIN
  CREATE TYPE promise_status AS ENUM (
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

DO $$ BEGIN
  CREATE TYPE promise_type AS ENUM (
    'objetiva',
    'subjetiva',
    'mensuravel',
    'vaga',
    'simbolica'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- 2. ADICIONAR COLUNAS EM promises
-- (schema real usa: politician_name, promise_title, 
--  source_link, evidence, made_at, deadline)
-- =============================================

ALTER TABLE promises ADD COLUMN IF NOT EXISTS nome_politico VARCHAR(255);
ALTER TABLE promises ADD COLUMN IF NOT EXISTS cargo VARCHAR(100);
ALTER TABLE promises ADD COLUMN IF NOT EXISTS partido VARCHAR(50);
ALTER TABLE promises ADD COLUMN IF NOT EXISTS estado VARCHAR(2);
ALTER TABLE promises ADD COLUMN IF NOT EXISTS ano_eleitoral INTEGER;
ALTER TABLE promises ADD COLUMN IF NOT EXISTS titulo VARCHAR(255);
ALTER TABLE promises ADD COLUMN IF NOT EXISTS texto_original TEXT;
ALTER TABLE promises ADD COLUMN IF NOT EXISTS link_fonte TEXT;
ALTER TABLE promises ADD COLUMN IF NOT EXISTS data_promessa DATE;
ALTER TABLE promises ADD COLUMN IF NOT EXISTS prazo_estimado VARCHAR(255);
ALTER TABLE promises ADD COLUMN IF NOT EXISTS tipo_promessa VARCHAR(50) DEFAULT 'vaga';
ALTER TABLE promises ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(100);
ALTER TABLE promises ADD COLUMN IF NOT EXISTS justificativa TEXT;

-- =============================================
-- 3. ADICIONAR COLUNAS EM politicians
-- (schema real usa: name, party, state, role, bio)
-- =============================================

ALTER TABLE politicians ADD COLUMN IF NOT EXISTS nome VARCHAR(255);
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS partido VARCHAR(50);
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS cargo VARCHAR(100);
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS estado VARCHAR(2);
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS biografia TEXT;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS promises_count INTEGER DEFAULT 0;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS fulfilled_count INTEGER DEFAULT 0;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS partial_count INTEGER DEFAULT 0;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS broken_count INTEGER DEFAULT 0;

-- =============================================
-- 4. ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_promises_politician_id ON promises(politician_id);
CREATE INDEX IF NOT EXISTS idx_promises_politician_name ON promises(politician_name);
CREATE INDEX IF NOT EXISTS idx_promises_cargo ON promises(cargo);
CREATE INDEX IF NOT EXISTS idx_promises_partido ON promises(partido);
CREATE INDEX IF NOT EXISTS idx_promises_estado ON promises(estado);
CREATE INDEX IF NOT EXISTS idx_promises_status ON promises(status);
CREATE INDEX IF NOT EXISTS idx_promises_category ON promises(category);
CREATE INDEX IF NOT EXISTS idx_promises_ano ON promises(ano_eleitoral);
CREATE INDEX IF NOT EXISTS idx_promises_created ON promises(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_politicians_name ON politicians(name);
CREATE INDEX IF NOT EXISTS idx_politicians_party ON politicians(party);
CREATE INDEX IF NOT EXISTS idx_politicians_state ON politicians(state);

-- =============================================
-- 5. MIGRAR DADOS LEGADOS
-- (usando nomes reais das colunas do schema)
-- =============================================

UPDATE promises SET titulo = promise_title 
  WHERE titulo IS NULL AND promise_title IS NOT NULL;

UPDATE promises SET texto_original = evidence 
  WHERE texto_original IS NULL AND evidence IS NOT NULL;

UPDATE promises SET link_fonte = source_link 
  WHERE link_fonte IS NULL AND source_link IS NOT NULL;

UPDATE promises SET data_promessa = made_at 
  WHERE data_promessa IS NULL AND made_at IS NOT NULL;

UPDATE promises SET prazo_estimado = deadline::text 
  WHERE prazo_estimado IS NULL AND deadline IS NOT NULL;

UPDATE promises SET nome_politico = politician_name 
  WHERE nome_politico IS NULL AND politician_name IS NOT NULL;

-- Copiar partido/estado dos políticos via FK real
UPDATE promises p
SET partido = pol.party,
    estado = pol.state,
    cargo = pol.role
FROM politicians pol
WHERE p.politician_id = pol.id
AND p.partido IS NULL;

-- Espelhar colunas inglês → português em politicians
UPDATE politicians SET nome = name WHERE nome IS NULL;
UPDATE politicians SET partido = party WHERE partido IS NULL;
UPDATE politicians SET cargo = role WHERE cargo IS NULL;
UPDATE politicians SET estado = state WHERE estado IS NULL;
UPDATE politicians SET biografia = bio WHERE biografia IS NULL;

-- =============================================
-- 6. POLÍTICAS RLS
-- =============================================

ALTER TABLE promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE politicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promises_view" ON promises;
DROP POLICY IF EXISTS "promises_insert" ON promises;
DROP POLICY IF EXISTS "promises_update" ON promises;
DROP POLICY IF EXISTS "politicians_view" ON politicians;

-- Leitura pública sem login
CREATE POLICY "promises_view" ON promises FOR SELECT USING (true);
CREATE POLICY "promises_insert" ON promises FOR INSERT WITH CHECK (true);
CREATE POLICY "promises_update" ON promises FOR UPDATE USING (true);
CREATE POLICY "politicians_view" ON politicians FOR SELECT USING (true);

-- =============================================
-- 7. TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS promises_updated_at ON promises;
CREATE TRIGGER promises_updated_at BEFORE UPDATE ON promises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS politicians_updated_at ON politicians;
CREATE TRIGGER politicians_updated_at BEFORE UPDATE ON politicians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 8. SEED - POLÍTICOS
-- (usando colunas reais: name, party, state, role)
-- =============================================

INSERT INTO politicians (name, nome, party, partido, state, estado, role, cargo) VALUES
  ('Luiz Inácio Lula da Silva', 'Luiz Inácio Lula da Silva', 'PT', 'PT', 'BR', 'BR', 'presidente', 'Presidente'),
  ('Jair Bolsonaro', 'Jair Bolsonaro', 'PL', 'PL', 'BR', 'BR', 'presidente', 'Presidente'),
  ('Tarcísio Gomes de Freitas', 'Tarcísio Gomes de Freitas', 'PL', 'PL', 'SP', 'SP', 'governador', 'Governador'),
  ('Romeu Zema', 'Romeu Zema', 'NOVO', 'NOVO', 'MG', 'MG', 'governador', 'Governador'),
  ('Cláudia Lei', 'Cláudia Lei', 'MDB', 'MDB', 'RJ', 'RJ', 'governador', 'Governador')
ON CONFLICT DO NOTHING;

-- =============================================
-- 8B. SEED - PROMESSAS
-- (usando colunas reais: politician_name, promise_title,
--  category, source_link — NÃO categoria/titulo/link_fonte)
-- =============================================

INSERT INTO promises (politician_name, promise_title, category, status, fulfillment_score, ano_eleitoral, source_link, nome_politico, cargo, partido, estado) VALUES
  ('Luiz Inácio Lula da Silva', 'Zerar a fome no Brasil', 'Saúde', 'em_andamento', 65, 2022, 'https://plano2022.lula.com.br', 'Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR'),
  ('Luiz Inácio Lula da Silva', '6 milhões de empregos', 'Trabalho', 'cumprida', 100, 2022, 'https://plano2022.lula.com.br', 'Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR'),
  ('Luiz Inácio Lula da Silva', 'Reconhecer Venezuela', 'Relações Exteriores', 'descumprida', 0, 2022, NULL, 'Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR'),
  ('Jair Bolsonaro', '100 anos de petróleo', 'Economia', 'nao_iniciada', 10, 2022, 'https://plano2022.bolsonaro.com.br', 'Jair Bolsonaro', 'Presidente', 'PL', 'BR'),
  ('Jair Bolsonaro', 'Armas para cidadãos', 'Segurança', 'descumprida', 15, 2022, 'https://plano2022.bolsonaro.com.br', 'Jair Bolsonaro', 'Presidente', 'PL', 'BR'),
  ('Jair Bolsonaro', 'Imposto único', 'Economia', 'nao_classificada', 0, 2022, NULL, 'Jair Bolsonaro', 'Presidente', 'PL', 'BR'),
  ('Tarcísio Gomes de Freitas', 'Metrô linha 2', 'Transporte', 'em_andamento', 50, 2022, 'https://tarcisio.com.br', 'Tarcísio Gomes de Freitas', 'Governador', 'PL', 'SP'),
  ('Romeu Zema', 'Mil novas escolas', 'Educação', 'nao_iniciada', 5, 2022, 'https://romeuzema.com.br', 'Romeu Zema', 'Governador', 'NOVO', 'MG'),
  ('Cláudia Lei', 'Segurança pública', 'Segurança', 'parcialmente_cumprida', 45, 2022, NULL, 'Cláudia Lei', 'Governador', 'MDB', 'RJ')
ON CONFLICT DO NOTHING;

-- =============================================
-- 9. VIEW PARA RANKING
-- (usando colunas reais de politicians e JOIN por FK)
-- =============================================

CREATE OR REPLACE VIEW politician_stats AS
SELECT
  p.name AS nome_politico,
  p.role AS cargo,
  p.party AS partido,
  p.state AS estado,
  p.photo_url,
  COUNT(pr.id) AS total_promessas,
  SUM(CASE WHEN pr.status = 'cumprida' THEN 1 ELSE 0 END) AS cumpridas,
  SUM(CASE WHEN pr.status = 'parcialmente_cumprida' THEN 1 ELSE 0 END) AS parcialmente_cumpridas,
  SUM(CASE WHEN pr.status = 'em_andamento' THEN 1 ELSE 0 END) AS em_andamento,
  SUM(CASE WHEN pr.status = 'nao_iniciada' THEN 1 ELSE 0 END) AS nao_iniciadas,
  SUM(CASE WHEN pr.status = 'descumprida' THEN 1 ELSE 0 END) AS descumpridas,
  ROUND(AVG(COALESCE(pr.fulfillment_score, 0)), 1) AS media_fulfillment
FROM politicians p
LEFT JOIN promises pr ON pr.politician_id = p.id
GROUP BY p.id, p.name, p.role, p.party, p.state, p.photo_url
ORDER BY media_fulfillment DESC;

-- =============================================
-- VERIFICAÇÃO FINAL
-- =============================================

SELECT 'Schema aplicado com sucesso!' AS status;
SELECT COUNT(*) AS total_politicians FROM politicians;
SELECT COUNT(*) AS total_promises FROM promises;
SELECT viewname FROM pg_views WHERE viewname = 'politician_stats';
SELECT indexname FROM pg_indexes WHERE tablename IN ('promises', 'politicians') ORDER BY tablename;
