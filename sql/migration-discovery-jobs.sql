CREATE TABLE IF NOT EXISTS discovery_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  politician_id UUID REFERENCES politicians(id),
  politician_name TEXT,
  cargo TEXT,
  role TEXT,
  state TEXT,
  party TEXT,
  status TEXT DEFAULT 'pending',
  pdf_url TEXT,
  pdf_text TEXT,
  total_extraidas INT DEFAULT 0,
  total_inseridas INT DEFAULT 0,
  erro TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
); SELECT 1;
