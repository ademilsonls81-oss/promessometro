-- Escalabilidade Nacional: Índices para milhões de registros

-- Índice composto para filtros combinados (estado + eleição + status)
CREATE INDEX IF NOT EXISTS idx_promises_state_year_status
  ON promises(ano_eleitoral, status);

CREATE INDEX IF NOT EXISTS idx_promises_state_status
  ON promises(state, status);

-- Índice para políticos por estado e cargo
CREATE INDEX IF NOT EXISTS idx_politicians_state_role
  ON politicians(state, position);

-- Full-text search em português para títulos de promessas
CREATE INDEX IF NOT EXISTS idx_promises_title_search
  ON promises USING gin(to_tsvector('portuguese', COALESCE(promise_title, title, '')));

-- Full-text search para nomes de políticos
CREATE INDEX IF NOT EXISTS idx_politicians_name_search
  ON politicians USING gin(to_tsvector('portuguese', COALESCE(name, nome, '')));

-- Cursor-based pagination helpers
CREATE INDEX IF NOT EXISTS idx_promises_created_cursor
  ON promises(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_promises_explanations_latest
  ON promise_explanations(promise_id, is_latest DESC, gerado_em DESC)
  WHERE is_latest = TRUE;

-- election_year na politicians se não existir
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS election_year INTEGER;