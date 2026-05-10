-- =============================================
-- Promessômetro - Schema SQL Completo
-- Tabela de promessas políticas
-- =============================================

-- Enum parastatus de cumprimento
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

-- Enum para tipo de promessa
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

-- Tabela de promessas
CREATE TABLE IF NOT EXISTS promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Informações do político
  politician_id UUID,
  nome_politico VARCHAR(255) NOT NULL,
  cargo VARCHAR(100) NOT NULL,
  partido VARCHAR(50),
  estado VARCHAR(2),
  foto_url TEXT,
  
  -- Informações da promessa
  titulo VARCHAR(500) NOT NULL,
  texto_original TEXT,
  descricao TEXT,
  link_fonte TEXT,
  categoria VARCHAR(100) DEFAULT 'Outros',
  subcategoria VARCHAR(100),
  data_promessa DATE,
  prazo_estimado VARCHAR(255),
  tipo_promessa promise_type DEFAULT 'vaga',
  
  -- Status
  status promise_status DEFAULT 'nao_classificada',
  fulfillment_score INTEGER DEFAULT 50,
  justificativa TEXT,
  
  -- Metadata
  ano_eleitoral INTEGER,
  is_automated BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_promises_politician ON promises(nome_politico);
CREATE INDEX IF NOT EXISTS idx_promises_cargo ON promises(cargo);
CREATE INDEX IF NOT EXISTS idx_promises_partido ON promises(partido);
CREATE INDEX IF NOT EXISTS idx_promises_estado ON promises(estado);
CREATE INDEX IF NOT EXISTS idx_promises_status ON promises(status);
CREATE INDEX IF NOT EXISTS idx_promises_category ON promises(categoria);
CREATE INDEX IF NOT EXISTS idx_promises_ano ON promises(ano_eleitoral);
CREATE INDEX IF NOT EXISTS idx_promises_created ON promises(created_at DESC);

-- Tabela de políticos
CREATE TABLE IF NOT EXISTS politicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL UNIQUE,
  foto_url TEXT,
  partido VARCHAR(50),
  cargo VARCHAR(100),
  estado VARCHAR(2),
  nascimento DATE,
  biografia TEXT,
  
  -- Stats
  promises_count INTEGER DEFAULT 0,
  fulfilled_count INTEGER DEFAULT 0,
  partial_count INTEGER DEFAULT 0,
  broken_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_politicians_name ON politicians(nome);
CREATE INDEX IF NOT EXISTS idx_politicians_party ON politicians(partido);

-- Tabela de evidências
CREATE TABLE IF NOT EXISTS promise_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id UUID REFERENCES promises(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  link TEXT,
  descricao TEXT,
  fonte VARCHAR(255),
  data_evidencia DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidences_promise ON promise_evidences(promise_id);

-- Tabela de submissions (relatórios de usuários)
CREATE TABLE IF NOT EXISTS promise_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_reportante VARCHAR(255),
  email_reportante VARCHAR(255),
  nome_politico VARCHAR(255) NOT NULL,
  cargo VARCHAR(100),
  partido VARCHAR(50),
  estado VARCHAR(2),
  titulo VARCHAR(500) NOT NULL,
  texto_original TEXT,
  link_fonte TEXT,
  categoria VARCHAR(100),
  data_promessa DATE,
  status VARCHAR(50) DEFAULT 'pendente',
  notas_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON promise_reports(status);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE politicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE promise_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE promise_reports ENABLE ROW LEVEL SECURITY;

-- Promises: leitura pública, escrita para auth
CREATE POLICY "promises_view" ON promises FOR SELECT USING (true);
CREATE POLICY "promises_insert" ON promises FOR INSERT WITH CHECK (true);
CREATE POLICY "promises_update" ON promises FOR UPDATE USING (true);

-- Politicians: leitura pública
CREATE POLICY "politicians_view" ON politicians FOR SELECT USING (true);

-- Evidence: leitura pública
CREATE POLICY "evidence_view" ON promise_evidences FOR SELECT USING (true);
CREATE POLICY "evidence_insert" ON promise_evidences FOR INSERT WITH CHECK (true);

-- Reports: inserção pública, leitura para auth
CREATE POLICY "reports_insert" ON promise_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "reports_view" ON promise_reports FOR SELECT USING (true);

-- =============================================
-- Functions e Triggers
-- =============================================

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER promises_updated_at BEFORE UPDATE ON promises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER politicians_updated_at BEFORE UPDATE ON politicians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reports_updated_at BEFORE UPDATE ON promise_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
--seed: Exemplos de promessas
-- =============================================

INSERT INTO promises (nome_politico, cargo, partido, estado, titulo, texto_original, categoria, status, fulfillment_score, ano_eleitoral, link_fonte) VALUES
  ('Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR', 'Zerar a fome no Brasil', 'Erradicar a fome e a pobreza extrema no país', 'Saúde', 'em_andamento', 65, 2022, 'https://plano2022 Lula.pdf'),
  ('Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR', '6 milhões de empregos', 'Criar 6 milhões de novos empregos formais', 'Trabalho', 'cumprida', 100, 2022, 'https://plano2022 Lula.pdf'),
  ('Luiz Inácio Lula da Silva', 'Presidente', 'PT', 'BR', 'Reconhecer Venezuela', 'Reconhecer o governo venezuelano de Maduro', 'Relações Exteriores', 'descumprida', 0, 2022, NULL),
  ('Jair Bolsonaro', 'Presidente', 'PL', 'BR', '100 anos de petróleo', 'Explorar petróleo do pré-sal pelos próximos 100 anos', 'Economia', 'nao_iniciada', 10, 2022, 'https://plano2022 Bolsonaro.pdf'),
  ('Jair Bolsonaro', 'Presidente', 'PL', 'BR', 'Armas para cidadãos', 'Liberar porte de armas para cidadãos de bem', 'Segurança', 'descumprida', 15, 2022, 'https://plano2022 Bolsonaro.pdf'),
  ('Jair Bolsonaro', 'Presidente', 'PL', 'BR', 'Imposto único', 'Implementar imposto único', 'Economia', 'nao_classificada', 0, 2022, NULL),
  ('Tarcísio Gomes de Freitas', 'Governador', 'PL', 'SP', 'Metrô linha 2', 'Completar a linha 2 do metrô de São Paulo', 'Transporte', 'em_andamento', 50, 2022, 'https://tarcisio.com.br/plano'),
  ('Romeu Zema', 'Governador', 'NOVO', 'MG', 'Mil novas escolas', 'Construir mil novas escolas em Minas Gerais', 'Educação', 'nao_iniciada', 5, 2022, 'https://romeuzema.com.br/plano'),
  ('Claudia Lei (MDB)', 'Governador', 'MDB', 'RJ', 'Segurança pública', 'Reduzirriminalidade no Rio de Janeiro em 50%', 'Segurança', 'parcialmente_cumprida', 45, 2022, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO politicians (nome, partido, cargo, estado) VALUES
  ('Luiz Inácio Lula da Silva', 'PT', 'Presidente', 'BR'),
  ('Jair Bolsonaro', 'PL', 'Presidente', 'BR'),
  ('Tarcísio Gomes de Freitas', 'PL', 'Governador', 'SP'),
  ('Romeu Zema', 'NOVO', 'Governador', 'MG'),
  ('Claudia Lei', 'MDB', 'Governador', 'RJ')
ON CONFLICT DO NOTHING;

-- =============================================
-- View para ranking de políticos
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