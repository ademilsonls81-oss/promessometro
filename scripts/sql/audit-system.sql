-- =============================================
-- SISTEMA DE PROMISSAS: CUSTO ZERO + RIGOR DE AUDITORIA
-- =============================================

-- 1. TABELA DE AUDITORIA COMPLETA (RIGOR)
CREATE TABLE IF NOT EXISTS promise_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'CREATED', 'SCRAPED', 'STATUS_CHANGED', 'EVIDENCE_ADDED', 
    'VALIDATED', 'DISPUTED', 'CATEGORIZED', 'EXPORTED'
  )),
  previous_value JSONB,
  new_value JSONB,
  source VARCHAR(100) CHECK (source IN ('SYSTEM', 'WATCHER', 'MANUAL', 'AI_ANALYSIS', 'USER_REPORT', 'TSE_SCRAPER')),
  user_id UUID,
  ip_address VARCHAR(50),
  notes TEXT,
  integrity_hash VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_promise ON promise_audit_log(promise_id);
CREATE INDEX idx_audit_created ON promise_audit_log(created_at DESC);

-- 2.Função para gerar hash de integridade
CREATE OR REPLACE FUNCTION generate_audit_hash(action TEXT, promise_id UUID, new_value JSONB)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(action || promise_id::TEXT || COALESCE(new_value->>'title', '') || NOW()::TEXT, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- 3. Tabela de categorização por evidência (IA + Humanos)
CREATE TABLE IF NOT EXISTS promise_categorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id UUID NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
  
  -- Fonte da categorização
  category_source VARCHAR(50) CHECK (category_source IN ('AI_AUTO', 'HUMAN_REVIEW', 'EVIDENCE_BASED', 'VOTING')),
  
  -- Resultado
  status_suggested VARCHAR(50),
  confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  evidence_count INTEGER DEFAULT 0,
  
  -- Detalhes
  reasoning TEXT,
  supporting_sources JSONB,
  conflicting_sources JSONB,
  
  -- Validação humana
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categorizations_promise ON promise_categorizations(promise_id);

-- 4. Sistema de pontuação de confiabilidade (CUSTO ZERO)
-- Usando apenas dados do banco - sem APIs externas
CREATE TABLE IF NOT EXISTS promise_reliability_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id UUID NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
  
  -- Componentes de pontuação (0-100 cada)
  evidence_strength INTEGER DEFAULT 0,      -- Quantidade de evidências
  source_quality INTEGER DEFAULT 0,         -- Qualidade das fontes
  verification_depth INTEGER DEFAULT 0,    -- Profundidade da verificação
  dispute_count INTEGER DEFAULT 0,         -- Quantidade de disputas (inverso)
  
  -- Pontuação final
  reliability_score INTEGER GENERATED ALWAYS AS (
    (evidence_strength + source_quality + verification_depth - dispute_count * 5)
  ) STORED,
  
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Função para calcular scores automaticamente (CUSTO ZERO)
CREATE OR REPLACE FUNCTION calculate_promise_reliability(promise_id UUID)
RETURNS VOID AS $$
DECLARE
  v_evidence_count INTEGER;
  v_avg_credibility NUMERIC;
  v_dispute_count INTEGER;
BEGIN
  -- Contar evidências aprobadas
  SELECT COUNT(*), COALESCE(AVG(source_credibility), 0)
  INTO v_evidence_count, v_avg_credibility
  FROM promise_evidences
  WHERE promise_id = promise_id AND validation_status = 'approved';

  -- Contar disputas
  SELECT COUNT(*) INTO v_dispute_count
  FROM evidence_disputes
  WHERE promise_id = promise_id AND status = 'open';

  -- Inserir/atualizar pontuação
  INSERT INTO promise_reliability_scores (
    promise_id, evidence_strength, source_quality, verification_depth, dispute_count
  )
  VALUES (
    promise_id,
    LEAST(v_evidence_count * 20, 100),           -- Max 100 pontos
    ROUND(v_avg_credibility),                      -- 0-100 baseado na credibilidade
    CASE WHEN v_evidence_count >= 3 THEN 100       -- Alto depth se 3+ evidências
         WHEN v_evidence_count >= 1 THEN 50 
         ELSE 10 END,
    v_dispute_count
  )
  ON CONFLICT (promise_id) DO UPDATE SET
    evidence_strength = LEAST(v_evidence_count * 20, 100),
    source_quality = ROUND(v_avg_credibility),
    verification_depth = CASE WHEN v_evidence_count >= 3 THEN 100 WHEN v_evidence_count >= 1 THEN 50 ELSE 10 END,
    dispute_count = v_dispute_count,
    calculated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 6. Função de auditoria (RIGOR)
CREATE OR REPLACE FUNCTION log_promise_audit(
  p_promise_id UUID,
  p_action VARCHAR,
  p_prev_value JSONB,
  p_new_value JSONB,
  p_source VARCHAR,
  p_notes TEXT
)
RETURNS VOID AS $$
DECLARE
  v_hash TEXT;
BEGIN
  v_hash := generate_audit_hash(p_action, p_promise_id, p_new_value);
  
  INSERT INTO promise_audit_log (
    promise_id, action, previous_value, new_value, source, notes, integrity_hash
  )
  VALUES (
    p_promise_id, p_action, p_prev_value, p_new_value, p_source, p_notes, v_hash
  );
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger para auditar automaticamente mudanças de status
CREATE OR REPLACE FUNCTION audit_promise_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_promise_audit(
      NEW.id,
      'STATUS_CHANGED',
      jsonb_build_object('status', OLD.status, 'score', OLD.fulfillment_score),
      jsonb_build_object('status', NEW.status, 'score', NEW.fulfillment_score),
      'SYSTEM',
      CONCAT('Status alterado de ', OLD.status, ' para ', NEW.status)
    );
    
    -- Recalcular confiabilidade
    PERFORM calculate_promise_reliability(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_promise_changes
AFTER UPDATE ON promises
FOR EACH ROW
EXECUTE FUNCTION audit_promise_changes();

-- 8. View para dashboard de auditoria
CREATE OR REPLACE VIEW promise_audit_summary AS
SELECT 
  p.id as promise_id,
  p.politician_name,
  p.promise_title,
  p.status,
  p.fulfillment_score,
  rs.reliability_score,
  (SELECT COUNT(*) FROM promise_evidences WHERE promise_id = p.id) as evidence_count,
  (SELECT COUNT(*) FROM evidence_disputes WHERE promise_id = p.id) as dispute_count,
  (SELECT COUNT(*) FROM promise_audit_log WHERE promise_id = p.id) as audit_count
FROM promises p
LEFT JOIN promise_reliability_scores rs ON rs.promise_id = p.id
ORDER BY p.created_at DESC;

SELECT 'Sistema de Custo Zero + Auditoria configurado!' as result;