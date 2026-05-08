-- =============================================
-- Watcher: Detecta novos políticos e executa ações
-- =============================================

-- 1. Criar tabela de logs do watcher
CREATE TABLE IF NOT EXISTS watcher_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watcher_name VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  record_id UUID,
  record_data JSONB,
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watcher_logs_created ON watcher_logs(created_at DESC);

-- 2. Função que o watcher vai executar
CREATE OR REPLACE FUNCTION on_politician_inserted()
RETURNS TRIGGER AS $$
DECLARE
  v_politician_id UUID;
  v_name TEXT;
  v_party TEXT;
  v_state TEXT;
BEGIN
  v_politician_id := NEW.id;
  v_name := NEW.name;
  v_party := NEW.party;
  v_state := NEW.state;
  
  -- Log do novo político
  INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status)
  VALUES (
    'politician_watcher',
    'INSERT',
    v_politician_id,
    jsonb_build_object(
      'name', v_name,
      'party', v_party,
      'state', v_state,
      'created_at', NEW.created_at
    ),
    'success'
  );
  
  -- Aqui você pode adicionar mais ações automáticas:
  -- 1. Enviar notificação (Slack/Discord)
  -- 2. Criar perfil vazio em outra tabela
  -- 3. Buscar foto automaticamente
  -- 4. Verificar dados públicos
  
  RAISE NOTICE 'Watcher: Novo político detectado: % (%)', v_name, v_politician_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar o trigger
DROP TRIGGER IF EXISTS trigger_on_politician_insert ON politicians;

CREATE TRIGGER trigger_on_politician_insert
AFTER INSERT ON politicians
FOR EACH ROW
EXECUTE FUNCTION on_politician_inserted();

-- 4. Teste: Inserir político de teste (vai ativar o watcher)
-- INSERT INTO politicians (name, party, state) VALUES ('Teste Watcher', 'TEST', 'TS');

SELECT 'Watcher criado com sucesso!' as result;