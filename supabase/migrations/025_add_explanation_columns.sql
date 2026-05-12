-- Add missing columns to promise_explanations
ALTER TABLE promise_explanations ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT FALSE;
ALTER TABLE promise_explanations ADD COLUMN IF NOT EXISTS revisado_em TIMESTAMPTZ;
ALTER TABLE promise_explanations ADD COLUMN IF NOT EXISTS revisado_por UUID;

-- Set is_latest = true for existing records (the most recent one per promise)
UPDATE promise_explanations pe1
SET is_latest = true
WHERE pe1.id = (
  SELECT pe2.id FROM promise_explanations pe2
  WHERE pe2.promise_id = pe1.promise_id
  ORDER BY pe2.gerado_em DESC
  LIMIT 1
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_promise_explanations_latest ON promise_explanations(promise_id, is_latest) WHERE is_latest = TRUE;