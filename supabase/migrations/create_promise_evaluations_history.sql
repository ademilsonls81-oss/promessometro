DROP TABLE IF EXISTS promise_evaluations_history;

CREATE TABLE promise_evaluations_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  promise_id uuid NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
  politician_id uuid,
  evaluated_at timestamptz DEFAULT now(),
  status_resultado text NOT NULL,
  fulfillment_score int,
  justificativa_ia text,
  fontes jsonb DEFAULT '[]'::jsonb,
  o_que_foi_feito text,
  o_que_falta text,
  modelo_ia text DEFAULT 'llama-3.1-8b-instant',
  duracao_ms int DEFAULT 0,
  fallback boolean DEFAULT false,
  cron_execution_id text
);

CREATE INDEX idx_eval_history_promise_id ON promise_evaluations_history(promise_id);
CREATE INDEX idx_eval_history_politician_id ON promise_evaluations_history(politician_id);
CREATE INDEX idx_eval_history_evaluated_at ON promise_evaluations_history(evaluated_at DESC);

-- cron_logs (sumário de execuções, opcional — se não existir, endpoint retorna vazio)
CREATE TABLE IF NOT EXISTS cron_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  processed int DEFAULT 0,
  failed int DEFAULT 0,
  remaining int DEFAULT 0,
  duration_ms int DEFAULT 0,
  cron_execution_id text,
  promises_data jsonb DEFAULT '[]'::jsonb
);
