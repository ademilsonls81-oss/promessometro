-- =============================================
-- Promessômetro - Script SQL Completo
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
-- 2. CRIAR/ALTERAR TABELA promises
-- =============================================

-- Adicionar colunas se não existirem
DO $$
BEGIN
  -- Informações do político
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'nome_politico') THEN
    ALTER TABLE promises ADD COLUMN nome_politico VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'cargo') THEN
    ALTER TABLE promises ADD COLUMN cargo VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'partido') THEN
    ALTER TABLE promises ADD COLUMN partido VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'estado') THEN
    ALTER TABLE promises ADD COLUMN estado VARCHAR(2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'ano_eleitoral') THEN
    ALTER TABLE promises ADD COLUMN ano_eleitoral INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'data_promessa') THEN
    ALTER TABLE promises ADD COLUMN data_promessa DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'prazo_estimado') THEN
    ALTER TABLE promises ADD COLUMN prazo_estimado VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'texto_original') THEN
    ALTER TABLE promises ADD COLUMN texto_original TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'tipo_promessa') THEN
    ALTER TABLE promises ADD COLUMN tipo_promessa VARCHAR(50) DEFAULT 'vaga';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'subcategoria') THEN
    ALTER TABLE promises ADD COLUMN subcategoria VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promises' AND column_name = 'justificativa') THEN
    ALTER TABLE promises ADD COLUMN justificativa TEXT;
  END IF;
END $$;

-- =============================================
-- 3. CRIAR/ALTERAR TABELA politicians
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'politicians') THEN
    CREATE TABLE politicians (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR(255) NOT NULL UNIQUE,
      foto_url TEXT,
      partido VARCHAR(50),
      cargo VARCHAR(100),
      estado VARCHAR(2),
      nascimento DATE,
      biografia TEXT,
      promises_count INTEGER DEFAULT 0,
      fulfilled_count INTEGER DEFAULT 0,
      partial_count INTEGER DEFAULT 0,
      broken_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'
    );
  END IF;
  
  -- Adicionar colunas se não existirem
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'politicians' AND column_name = 'cargo') THEN
    ALTER TABLE politicians ADD COLUMN cargo VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'politicians' AND column_name = 'estado') THEN
    ALTER TABLE politicians ADD COLUMN estado VARCHAR(2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'politicians' AND column_name = 'biografia') THEN
    ALTER TABLE politicians ADD COLUMN biografia TEXT;
  END IF;
END $$;

-- =============================================
-- 4. CRIARÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_promises_politician ON promises(nome_politico);
CREATE INDEX IF NOT EXISTS idx_promises_cargo ON promises(cargo);
CREATE INDEX IF NOT EXISTS idx_promises_partido ON promises(partido);
CREATE INDEX IF NOT EXISTS idx_promises_estado ON promises(estado);
CREATE INDEX IF NOT EXISTS idx_promises_status ON promises(status);
CREATE INDEX IF NOT EXISTS idx_promises_category ON promises(category);
CREATE INDEX IF NOT EXISTS idx_promises_ano ON promises(ano_eleitoral);
CREATE INDEX IF NOT EXISTS idx_promises_created ON promises(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_politicians_name ON politicians(nome);
CREATE INDEX IF NOT EXISTS idx_politicians_party ON politicians(partido);

-- =============================================
-- 5. COPIAR DADOS LEGADOS
-- =============================================

-- Copiar dados das colunas antigas para novas
UPDATE promises SET nome_politico = politician_name WHERE nome_politico IS NULL AND politician_name IS NOT NULL;
UPDATE promises SET cargo = 'Presidente' WHERE cargo IS NULL;
UPDATE promises SET titulo = promise_title WHERE titulo IS NULL AND promise_title IS NOT NULL;
UPDATE promises SET texto_original = promise_description WHERE texto_original IS NULL AND promise_description IS NOT NULL;
UPDATE promises SET link_fonte = source_link WHERE link_fonte IS NULL AND source_link IS NOT NULL;

-- Copiar partido/estado dos políticos
UPDATE promises p
SET partido = pol.partido,
    estado = pol.state
FROM politicians pol
WHERE p.nome_politico = pol.nome
AND p.partido IS NULL;

-- =============================================
-- 6. POLÍTICAS RLS
-- =============================================

ALTER TABLE promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE politicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promises_view" ON promises;
DROP POLICY IF EXISTS "promises_insert" ON promises;
DROP POLICY IF EXISTS "promises_update" ON promises;
DROP POLICY IF EXISTS "politicians_view" ON politicians;

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
-- 8. SEED - DADOS DE EXEMPLO
-- =============================================

-- Inserir políticos
INSERT INTO politicians (nome, partido, cargo, estado) VALUES
  ('Luiz Inácio Lula da Silva', 'PT', 'Presidente', 'BR'),
  ('Jair Bolsonaro', 'PL', 'Presidente', 'BR'),
  ('Tarcísio Gomes de Freitas', 'PL', 'Governador', 'SP'),
  ('Romeu Zema', 'NOVO', 'Governador', 'MG'),
  ('Cláudia Lei', 'MDB', 'Governador', 'RJ')
ON CONFLICT (nome) DO NOTHING;

-- Inserir promessas
INSERT INTO promises (nome_politico, cargo, partido, estado, titulo, texto_original, categoria, status, fulfillment_score, ano_eleitoral, link_fonte) VALUES
  ('Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR', 'Zerar a fome no Brasil', 'Erradicar a fome e a pobreza extrema no país', 'Saúde', 'em_andamento', 65, 2022, 'https://plano2022.lula.com.br'),
  ('Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR', '6 milhões de empregos', 'Criar 6 milhões de novos empregos formais', 'Trabalho', 'cumprida', 100, 2022, 'https://plano2022.lula.com.br'),
  ('Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR', 'Reconhecer Venezuela', 'Reconhecer o governo venezuelano de Maduro', 'Relações Exteriores', 'descumprida', 0, 2022, NULL),
  ('Jair Bolsonaro', 'Presidente', 'PL', 'BR', '100 anos de petróleo', 'Explorar petróleo do pré-sal pelos próximos 100 anos', 'Economia', 'nao_iniciada', 10, 2022, 'https://plano2022.bolsonaro.com.br'),
  ('Jair Bolsonaro', 'Presidente', 'PL', 'BR', 'Armas para cidadãos', 'Liberar porte de armas para cidadãos de bem', 'Segurança', 'descumprida', 15, 2022, 'https://plano2022.bolsonaro.com.br'),
  ('Jair Bolsonaro', 'Presidente', 'PL', 'BR', 'Imposto único', 'Implementar imposto único', 'Economia', 'nao_classificada', 0, 2022, NULL),
  ('Tarcísio Gomes de Freitas', 'Governador', 'PL', 'SP', 'Metrô linha 2', 'Completar a linha 2 do metrô de São Paulo', 'Transporte', 'em_andamento', 50, 2022, 'https://tarcisio.com.br'),
  ('Romeu Zema', 'Governador', 'NOVO', 'MG', 'Mil novas escolas', 'Construir mil novas escolas em Minas Gerais', 'Educação', 'nao_iniciada', 5, 2022, 'https://romeuzema.com.br'),
  ('Cláudia Lei', 'Governador', 'MDB', 'RJ', 'Segurança pública', 'Reduzir a criminalidade no Rio de Janeiro em 50%', 'Segurança', 'parcialmente_cumprida', 45, 2022, NULL)
ON CONFLICT DO NOTHING;

-- =============================================
-- 9. VIEW PARA RANKING
-- =============================================

CREATE OR REPLACE VIEW politician_stats AS
SELECT 
  p.nome as nome_politico,
  p.cargo,
  p.partido,
  p.estado,
  COUNT(pr.id) as total_promessas,
  SUM(CASE WHEN pr.status = 'cumprida' THEN 1 ELSE 0 END) as cumpridas,
  SUM(CASE WHEN pr.status = 'parcialmente_cumprida' THEN 1 ELSE 0 END) as parcialmente_cumpridas,
  SUM(CASE WHEN pr.status = 'em_andamento' THEN 1 ELSE 0 END) as em_andamento,
  SUM(CASE WHEN pr.status = 'descumprida' THEN 1 ELSE 0 END) as descumpridas,
  ROUND(AVG(CASE WHEN pr.fulfillment_score IS NOT NULL THEN pr.fulfillment_score ELSE 0 END), 1) as media_fulfillment
FROM politicians p
LEFT JOIN promises pr ON pr.nome_politico = p.nome
GROUP BY p.nome, p.cargo, p.partido, p.estado
ORDER BY media_fulfillment DESC;

-- =============================================
-- VERIFICAÇÃO
-- =============================================

SELECT 'Tabelas criadas com sucesso!' as status;
SELECT COUNT(*) as total_politicians FROM politicians;
SELECT COUNT(*) as total_promises FROM promises;