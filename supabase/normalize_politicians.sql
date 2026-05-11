-- =============================================
-- Normalização do Banco de Dados
-- Adiciona tabela politicians e atualiza referências
-- =============================================

-- 1. Criar tabela politicians se não existir
CREATE TABLE IF NOT EXISTS politicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) UNIQUE,
  role VARCHAR(100),
  party VARCHAR(50),
  state VARCHAR(2),
  city VARCHAR(100),
  photo_url TEXT,
  bio TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Adicionar politician_id à tabela promises (UUID)
ALTER TABLE promises ADD COLUMN IF NOT EXISTS politician_id UUID REFERENCES politicians(id) ON DELETE SET NULL;

-- 3. Adicionar politician_id à tabela promise_evidences
ALTER TABLE promise_evidences ADD COLUMN IF NOT EXISTS politician_id UUID REFERENCES politicians(id) ON DELETE SET NULL;

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_politicians_slug ON politicians(slug);
CREATE INDEX IF NOT EXISTS idx_promises_politician_id ON promises(politician_id);
CREATE INDEX IF NOT EXISTS idx_promise_evidences_politician_id ON promise_evidences(politician_id);

-- 5. Popular tabela politicians a partir de promises existentes
INSERT INTO politicians (name, slug, role, party, state)
SELECT 
  DISTINCT nome_politico,
  LOWER(REGEXP_REPLACE(nome_politico, '[^a-z0-9]+', '-', 'g')),
  cargo,
  partido,
  estado
FROM promises
WHERE nome_politico IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 6. Atualizar politician_id em promises
UPDATE promises p
SET politician_id = pol.id
FROM politicians pol
WHERE p.nome_politico = pol.name
AND p.politician_id IS NULL;

-- 7. Atualizar politician_id em promise_evidences (via promises)
UPDATE promise_evidences e
SET politician_id = p.politician_id
FROM promises p
WHERE e.promise_id = p.id
AND e.politician_id IS NULL;

-- 8. Criar função para gerar slug automaticamente
CREATE OR REPLACE FUNCTION generate_politician_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug = LOWER(REGEXP_REPLACE(NEW.name, '[^a-z0-9]+', '-', 'g'));
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Criar trigger para auto-slug
DROP TRIGGER IF EXISTS trigger_generate_politician_slug ON politicians;
CREATE TRIGGER trigger_generate_politician_slug
  BEFORE INSERT OR UPDATE ON politicians
  FOR EACH ROW EXECUTE FUNCTION generate_politician_slug();

-- 10. Criar view para ranking com politician normalizado
CREATE OR REPLACE VIEW politicians_ranking AS
SELECT 
  pol.id,
  pol.name,
  pol.slug,
  pol.photo_url,
  pol.party,
  pol.role,
  pol.state,
  COUNT(p.id) as total_promises,
  SUM(CASE WHEN p.status = 'cumprida' OR p.status = 'fulfilled' THEN 1 ELSE 0 END) as fulfilled,
  SUM(CASE WHEN p.status = 'parcialmente_cumprida' OR p.status = 'partial' THEN 1 ELSE 0 END) as partial,
  SUM(CASE WHEN p.status = 'descumprida' OR p.status = 'broken' THEN 1 ELSE 0 END) as broken,
  CASE 
    WHEN COUNT(p.id) > 0 
    THEN ROUND((SUM(CASE WHEN p.status IN ('cumprida', 'fulfilled') THEN 100 
                         WHEN p.status IN ('parcialmente_cumprida', 'partial') THEN 50 
                         ELSE 0 END)::numeric) / COUNT(p.id))
    ELSE 50 
  END as percentage
FROM politicians pol
LEFT JOIN promises p ON p.politician_id = pol.id
GROUP BY pol.id, pol.name, pol.slug, pol.photo_url, pol.party, pol.role, pol.state
ORDER BY percentage DESC, total_promises DESC;

SELECT 'Normalização concluída com sucesso!' as result;