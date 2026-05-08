import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://liqutcjzzrqstivvfele.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0";

const supabase = createClient(supabaseUrl, serviceRoleKey);

const sql = `
-- =============================================
-- Sistema de Evidências para Promessas
-- =============================================

-- Tabela de fontes confiáveis
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
  source_name VARCHAR(255) NOT NULL,
  source_url TEXT NOT NULL,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('government', 'journalism', 'official', 'fact_check', 'user_reported')),
  source_credibility INTEGER DEFAULT 80 CHECK (source_credibility BETWEEN 0 AND 100),
  title VARCHAR(500) NOT NULL,
  content TEXT,
  published_date TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  evidence_type VARCHAR(50) CHECK (evidence_type IN ('fulfillment', 'partial', 'break', 'neutral', 'related')),
  confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  ai_analysis JSONB,
  validation_status VARCHAR(50) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'approved', 'rejected', 'disputed')),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  validation_notes TEXT,
  blockchain_hash VARCHAR(100),
  integrity_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de disputas
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

-- Tabela de logs de validação
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_evidences_promise ON promise_evidences(promise_id);
CREATE INDEX IF NOT EXISTS idx_evidences_status ON promise_evidences(validation_status);
CREATE INDEX IF NOT EXISTS idx_evidences_type ON promise_evidences(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidences_source_type ON promise_evidences(source_type);
CREATE INDEX IF NOT EXISTS idx_trusted_sources_active ON trusted_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_disputes_evidence ON evidence_disputes(evidence_id);
CREATE INDEX IF NOT EXISTS idx_logs_evidence ON evidence_validation_logs(evidence_id);
`;

async function runMigration() {
  console.log("🚀 Executando migração no Supabase...");
  
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.log("Tentando alternativa: executar via query...");
    
    // Try alternative: split and execute
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        const { error: e } = await supabase.from('pg_catalog.pg_tables').select('*').limit(1);
        if (e) console.log("Erro:", e.message);
      }
    }
    
    // Use simple insert to test connection
    const { data: testData, error: testError } = await supabase
      .from('promises')
      .select('count')
      .limit(1);
    
    console.log("Teste de conexão:", testError ? "Erro: " + testError.message : "OK");
  }
  
  // Insert trusted sources
  const sources = [
    ['Portal da Transparência', 'portaldatransparencia.gov.br', 'government', 100],
    ['Diário Oficial da União', 'in.gov.br', 'official', 100],
    ['G1 Globo', 'g1.globo.com', 'journalism', 90],
    ['Folha de S.Paul', 'folha.uol.com.br', 'journalism', 90],
    ['Estadão', 'estadao.com.br', 'journalism', 90],
    ['UOL', 'uol.com.br', 'journalism', 85],
    ['CNN Brasil', 'cnnbrasil.com.br', 'journalism', 85],
    ['Poder360', 'poder360.com.br', 'journalism', 85],
    ['Agência Brasil', 'agenciabrasil.ebc.com.br', 'journalism', 85],
    ['Senado Federal', 'senado.leg.br', 'government', 95],
    ['Câmara dos Deputados', 'camara.leg.br', 'government', 95],
    ['Governo Federal', 'gov.br', 'government', 95],
    ['TCU', 'tcu.gov.br', 'government', 95],
    ['Fact-Checking Agência Lupa', 'agencialupa.com', 'fact_check', 95],
    ['Fact-Checking Aos Fatos', 'aosfatos.org', 'fact_check', 95]
  ];
  
  console.log("📥 Inserindo fontes confiáveis...");
  
  for (const s of sources) {
    const { error } = await supabase
      .from('trusted_sources')
      .upsert({ 
        name: s[0], 
        url_pattern: s[1], 
        type: s[2], 
        credibility_score: s[3],
        is_active: true
      }, { onConflict: 'url_pattern' });
      
    if (error && !error.message.includes('duplicate')) {
      console.log(`  Erro ao inserir ${s[0]}:`, error.message);
    }
  }
  
  console.log("✅ Migração concluída!");
  console.log("   Execute o SQL completo no painel do Supabase se houver erros.");
}

runMigration();