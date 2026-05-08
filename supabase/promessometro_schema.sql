-- =============================================
-- Promessômetro - Schema SQL
-- Tabela de promessas políticas
-- =============================================

-- Tabela de promessas
CREATE TABLE IF NOT EXISTS promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_name VARCHAR(255) NOT NULL,
  promise_title VARCHAR(500) NOT NULL,
  promise_description TEXT,
  category VARCHAR(100) DEFAULT 'Outros',
  status VARCHAR(50) DEFAULT 'pending_analysis',
  source_link TEXT,
  reported_by VARCHAR(255),
  evidence TEXT,
  fulfillment_score INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_promises_politician ON promises(politician_name);
CREATE INDEX IF NOT EXISTS idx_promises_status ON promises(status);
CREATE INDEX IF NOT EXISTS idx_promises_category ON promises(category);
CREATE INDEX IF NOT EXISTS idx_promises_created ON promises(created_at DESC);

-- Tabela de políticos
CREATE TABLE IF NOT EXISTS politicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  party VARCHAR(50),
  position VARCHAR(100),
  state VARCHAR(50),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_politicians_name ON politicians(name);

-- Tabela de evidências
CREATE TABLE IF NOT EXISTS promise_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id UUID REFERENCES promises(id) ON DELETE CASCADE,
  evidence_type VARCHAR(50),
  evidence_link TEXT,
  evidence_description TEXT,
  source_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidences_promise ON promise_evidences(promise_id);

-- Tabela de submissions (relatórios de usuários)
CREATE TABLE IF NOT EXISTS promise_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_name VARCHAR(255),
  reporter_email VARCHAR(255),
  politician_name VARCHAR(255) NOT NULL,
  promise_title VARCHAR(500) NOT NULL,
  promise_description TEXT,
  evidence_link TEXT,
  status VARCHAR(50) DEFAULT 'pending_review',
  admin_notes TEXT,
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
CREATE POLICY "Promises are viewable by everyone" ON promises FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert promises" ON promises FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update promises" ON promises FOR UPDATE USING (
  auth.role() = 'authenticated' AND 
  (metadata->>'is_admin' = 'true' OR true)
);

-- Politicians: leitura pública
CREATE POLICY "Politicians are viewable by everyone" ON politicians FOR SELECT USING (true);

-- Reports: leitura para admins, inserção pública
CREATE POLICY "Anyone can submit reports" ON promise_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view reports" ON promise_reports FOR SELECT USING (true);

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
-- Seed: Exemplos de promessas
-- =============================================

INSERT INTO promises (politician_name, promise_title, promise_description, category, status, fulfillment_score) VALUES
  ('Lula', 'Zerar hambre no Brasil', 'Erradicar a fome e a pobreza extrema no país', 'Saúde', 'partial', 60),
  ('Lula', '6 milhões de empregos', 'Criar 6 milhões de novos empregos formais', 'Trabalho', 'fulfilled', 100),
  ('Bolsonaro', '100 anos de petróleo', 'Explorar petróleo do pré-sal pelos próximos 100 anos', 'Economia', 'pending', 50),
  ('Bolsonaro', 'Armas para cidadãos', 'Liberar porte de armas para cidadãos de bem', 'Segurança', 'broken', 20)
ON CONFLICT DO NOTHING;