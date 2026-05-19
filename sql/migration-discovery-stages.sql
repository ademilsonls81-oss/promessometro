ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'pending';
ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS pdf_source_url TEXT;
SELECT 1;

NOTIFY pgrst, 'reload schema';
SELECT 1;
