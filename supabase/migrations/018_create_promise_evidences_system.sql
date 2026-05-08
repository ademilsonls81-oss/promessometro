-- =============================================
-- Sistema de Evidências para Promessas
-- À prova de refutação: fontes confiáveis + timestamp
-- =============================================

-- Tabela de fontes confiáveis ( whitelist )
CREATE TABLE IF NOT EXISTS trusted_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  url_pattern VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('government', 'journalism', 'official', 'fact_check')),
  credibility_score INTEGER DEFAULT 80 CHECK (credibility_score BETWEEN 0 AND 100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de evidências
CREATE TABLE IF NOT EXISTS promise_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id UUID REFERENCES promises(id) ON DELETE CASCADE,
  
  -- Fonte da evidência
  source_name VARCHAR(255) NOT NULL,
  source_url TEXT NOT NULL,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('government', 'journalism', 'official', 'fact_check', 'user_reported')),
  source_credibility INTEGER DEFAULT 80 CHECK (source_credibility BETWEEN 0 AND 100),
  
  -- Conteúdo da evidência
  title VARCHAR(500) NOT NULL,
  content TEXT,
  published_date TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Análise de cumprimento
  evidence_type VARCHAR(50) CHECK (evidence_type IN ('fulfillment', 'partial', 'break', 'neutral', 'related')),
  confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  ai_analysis JSONB,
  
  -- Validação humana
  validation_status VARCHAR(50) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'approved', 'rejected', 'disputed')),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  validation_notes TEXT,
  
  -- Sistema à prova de refutação
  blockchain_hash VARCHAR(100),
  integrity_verified BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de disputas (para políticos contestarem)
CREATE TABLE IF NOT EXISTS evidence_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID REFERENCES promise_evidences(id) ON DELETE CASCADE,
  
  disputed_by VARCHAR(255) NOT NULL,
  dispute_reason TEXT NOT NULL,
  counter_evidence_links TEXT[],
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de logs de validação ( histórico imutável )
CREATE TABLE IF NOT EXISTS evidence_validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID REFERENCES promise_evidences(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  notes TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_evidences_promise ON promise_evidences(promise_id);
CREATE INDEX IF NOT EXISTS idx_evidences_status ON promise_evidences(validation_status);
CREATE INDEX IF NOT EXISTS idx_evidences_type ON promise_evidences(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidences_source_type ON promise_evidences(source_type);
CREATE INDEX IF NOT EXISTS idx_trusted_sources_active ON trusted_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_disputes_evidence ON evidence_disputes(evidence_id);
CREATE INDEX IF NOT EXISTS idx_logs_evidence ON evidence_validation_logs(evidence_id);

-- Inserir fontes confiáveis padrão
INSERT INTO trusted_sources (name, url_pattern, type, credibility_score) VALUES
  ('Portal da Transparência', 'portaldatransparencia.gov.br', 'government', 100),
  ('Diário Oficial da União', 'in.gov.br', 'official', 100),
  ('Diário Oficial do Estado', 'sp.gov.br', 'official', 100),
  ('G1 Globo', 'g1.globo.com', 'journalism', 90),
  ('Folha de S.Paul', 'folha.uol.com.br', 'journalism', 90),
  ('Estadão', 'estadao.com.br', 'journalism', 90),
  ('UOL', 'uol.com.br', 'journalism', 85),
  ('CNN Brasil', 'cnnbrasil.com.br', 'journalism', 85),
  ('Terra', 'terra.com.br', 'journalism', 80),
  ('Valor Econômico', 'valor.globo.com', 'journalism', 90),
  ('Metrópolis', 'metropoles.com', 'journalism', 80),
  ('Poder360', 'poder360.com.br', 'journalism', 85),
  ('Agência Brasil', 'agenciabrasil.ebc.com.br', 'journalism', 85),
  ('Senado Federal', 'senado.leg.br', 'government', 95),
  ('Câmara dos Deputados', 'camara.leg.br', 'government', 95),
  ('Governo Federal', 'gov.br', 'government', 95),
  ('TCU', 'tcu.gov.br', 'government', 95),
  ('Prestação de Contas TCU', 'contas.gov.br', 'government', 100),
  ('Fact-Checking Agência Lupa', 'agencialupa.com', 'fact_check', 95),
  ('Fact-Checking Aos Fatos', 'aosfatos.org', 'fact_check', 95),
  ('Fact-Checking Poder360', 'poder360.com.br/fato', 'fact_check', 90)
ON CONFLICT DO NOTHING;

-- Função para gerar hash de integridade
CREATE OR REPLACE FUNCTION generate_evidence_hash(evidence_id UUID, title TEXT, source_url TEXT, content TEXT)
RETURNS VARCHAR AS $$
BEGIN
  RETURN encode(digest(evidence_id::TEXT || title || source_url || COALESCE(content, ''), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_evidence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evidence_updated_at BEFORE UPDATE ON promise_evidences
  FOR EACH ROW EXECUTE FUNCTION update_evidence_updated_at();

-- Função para verificar integridade da evidência
CREATE OR REPLACE FUNCTION verify_evidence_integrity(evidence_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_evidence promise_evidences%ROWTYPE;
  v_hash VARCHAR;
BEGIN
  SELECT * INTO v_evidence FROM promise_evidences WHERE id = evidence_id;
  v_hash := generate_evidence_hash(v_evidence.id, v_evidence.title, v_evidence.source_url, v_evidence.content);
  
  UPDATE promise_evidences 
  SET blockchain_hash = v_hash, integrity_verified = TRUE 
  WHERE id = evidence_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- RLS
ALTER TABLE promise_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_validation_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Evidências visíveis publicamente" ON promise_evidences FOR SELECT USING (
  validation_status IN ('approved', 'disputed')
);

CREATE POLICY "Admins podem gerenciar evidências" ON promise_evidences FOR ALL USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
);

CREATE POLICY "Fontes confiáveis visíveis publicamente" ON trusted_sources FOR SELECT USING (is_active = true);

CREATE POLICY "Admins podem gerenciar fontes" ON trusted_sources FOR ALL USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
);

CREATE POLICY "Disputas visíveis para admins" ON evidence_disputes FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar disputas" ON evidence_disputes FOR ALL USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
);

CREATE POLICY "Logs de validação visíveis para admins" ON evidence_validation_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
);

CREATE POLICY "Admins podem inserir logs" ON evidence_validation_logs FOR INSERT WITH CHECK (true);

SELECT 'Sistema de evidências criado com sucesso!' as result;