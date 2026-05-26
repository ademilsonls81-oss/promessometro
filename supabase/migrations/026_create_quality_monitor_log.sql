CREATE TABLE IF NOT EXISTS quality_monitor_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evaluation_id text NOT NULL,
  promise_id uuid,
  problem text NOT NULL,
  action text NOT NULL,
  details text DEFAULT '',
  corrected_by text DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_monitor_log_created_at ON quality_monitor_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_monitor_log_action ON quality_monitor_log(action);
