-- =============================================
-- Promessômetro - Sistema de Evidências via RSS
-- Fontes brasileiras de política e pipeline de evidências
-- =============================================

-- 1. Tabela de fontes RSS brasileiras
CREATE TABLE IF NOT EXISTS rss_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category VARCHAR(100) DEFAULT 'politica',
  is_active BOOLEAN DEFAULT true,
  last_fetched TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de artigos capturados via RSS
CREATE TABLE IF NOT EXISTS rss_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID REFERENCES rss_feeds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT UNIQUE,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  content TEXT
);

-- 3. Tabela de evidências (já existe mas adicionamos campos)
ALTER TABLE promise_evidences ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'rss';
ALTER TABLE promise_evidences ADD COLUMN IF NOT EXISTS relevance_score INTEGER;
ALTER TABLE promise_evidences ADD COLUMN IF NOT EXISTSai_analysis JSONB;

-- 4. Inserir fontes brasileiras de política
INSERT INTO rss_feeds (name, url, category) VALUES
  ('G1 Política', 'https://g1.globo.com/rss/g1/politica/', 'politica'),
  ('UOL Notícias', 'https://rss.uol.com.br/feed/noticias.xml', 'politica'),
  ('Folha Poder', 'https://feeds.folha.uol.com.br/poder/rss091.xml', 'politica'),
  ('Estadão Política', 'https://www.estadao.com.br/rss/politica/', 'politica'),
  ('Agência Brasil', 'https://agenciabrasil.ebc.com.br/rss/politica/', 'politica'),
  ('CNN Brasil', 'https://www.cnnbrasil.com.br/politica/feed/', 'politica')
ON CONFLICT (url) DO NOTHING;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_articles_link ON rss_articles(link);
CREATE INDEX IF NOT EXISTS idx_articles_published ON rss_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeds_active ON rss_feeds(is_active);

-- 6. Verificar
SELECT COUNT(*) as total_feeds FROM rss_feeds;
SELECT name, url, is_active FROM rss_feeds;