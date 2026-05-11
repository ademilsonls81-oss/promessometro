-- =============================================
-- Sistema de Proteção Contra Ataques
-- Tabelas para content guard, contestações e audit log
-- =============================================

-- 1. Tabela de logs do content guard
CREATE TABLE IF NOT EXISTS content_guard_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id UUID REFERENCES promises(id) ON DELETE CASCADE,
  campo TEXT NOT NULL,
  texto_original TEXT,
  texto_sanitizado TEXT,
  violacoes JSONB DEFAULT '[]',
  которое_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_guard_promise ON content_guard_log(promise_id);
CREATE INDEX IF NOT EXISTS idx_content_guard_date ON content_guard_log(que_em DESC);

-- RLS
ALTER TABLE content_guard_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "content_guard_view" ON content_guard_log;
CREATE POLICY "content_guard_view" ON content_guard_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "content_guard_insert" ON content_guard_log;
CREATE POLICY "content_guard_insert" ON content_guard_log FOR INSERT WITH CHECK (true);

-- 2. Tabela de contestações públicas
CREATE TABLE IF NOT EXISTS promise_contestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id UUID REFERENCES promises(id) ON DELETE CASCADE,
  nome_contestante TEXT NOT NULL,
  email_contestante TEXT,
  motivo TEXT NOT NULL,
  evidencia_url TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'aceita', 'rejeitada')),
  resposta_editorial TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  respondido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contestations_promise ON promise_contestations(promise_id);
CREATE INDEX IF NOT EXISTS idx_contestations_status ON promise_contestations(status);
CREATE INDEX IF NOT EXISTS idx_contestations_date ON promise_contestations(criado_em DESC);

-- RLS
ALTER TABLE promise_contestations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contestations_public_view" ON promise_contestations;
CREATE POLICY "contestations_public_view" ON promise_contestations FOR SELECT 
  USING (status = 'aceita');

DROP POLICY IF EXISTS "contestations_insert" ON promise_contestations;
CREATE POLICY "contestations_insert" ON promise_contestations FOR INSERT 
  WITH CHECK (nome_contestante IS NOT NULL AND motivo IS NOT NULL);

DROP POLICY IF EXISTS "contestations_admin_all" ON promise_contestations;
CREATE POLICY "contestations_admin_all" ON promise_contestations FOR ALL 
  USING (true);

-- 3. Tabela de audit log das promessas
CREATE TABLE IF NOT EXISTS promise_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id UUID REFERENCES promises(id) ON DELETE CASCADE,
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  motivo TEXT,
  alterado_por TEXT DEFAULT 'sistema',
  alterado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_promise ON promise_audit_log(promise_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON promise_audit_log(alterado_em DESC);

-- RLS
ALTER TABLE promise_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_view" ON promise_audit_log;
CREATE POLICY "audit_view" ON promise_audit_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "audit_insert" ON promise_audit_log;
CREATE POLICY "audit_insert" ON promise_audit_log FOR INSERT WITH CHECK (true);

SELECT 'Tabelas de proteção criadas com sucesso!' as result;