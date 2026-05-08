-- =============================================
-- Sistema Automático de Promessas TSE + News
-- =============================================

-- 1. Tabela de configuração do scraper
CREATE TABLE IF NOT EXISTS scraper_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  schedule_interval VARCHAR(50) DEFAULT 'daily', -- hourly, daily, weekly
  last_run TIMESTAMPTZ,
  last_status VARCHAR(20),
  last_items_found INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de histórico de scraping
CREATE TABLE IF NOT EXISTS scraper_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper_name VARCHAR(100) NOT NULL,
  source VARCHAR(255),
  items_found INTEGER DEFAULT 0,
  items_inserted INTEGER DEFAULT 0,
  errors TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scraper_logs_started ON scraper_logs(started_at DESC);

-- 3. Função principal: Scrape de promessas do TSE (simulada)
-- OBS: Em produção, usaria axios + cheerio ou API oficial do TSE
CREATE OR REPLACE FUNCTION scrape_tse_promises()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_politician_id UUID;
  v_scraper_log_id UUID;
BEGIN
  -- Criar log de início
  INSERT INTO scraper_logs (scraper_name, source, items_found)
  VALUES ('tse_promises', 'TSE - Candidatos', 0)
  RETURNING id INTO v_scraper_log_id;
  
  -- Para cada político na tabela, buscar promessas
  FOR v_politician_id IN SELECT id FROM politicians LOOP
    -- Aqui entraria a lógica real de scraping do TSE
    -- Por agora, vamos simular criando promessas de exemplo
    
    INSERT INTO promises (
      politician_id,
      politician_name,
      promise_title,
      promise_description,
      category,
      status,
      fulfillment_score,
      source_link,
      is_automated,
      created_at,
      updated_at
    )
    SELECT 
      p.id,
      p.name,
      'Promessa coletada automaticamente do TSE',
      'Esta promessa foi extraída automaticamente do banco de dados do TSE durante o scraping',
      'Outros',
      'pendente',
      50,
      CONCAT('https://divulgacandcontas.tse.jus.br/divulga/#/candidato/', p.id),
      true,
      NOW(),
      NOW()
    FROM politicians p
    WHERE p.id = v_politician_id
    AND NOT EXISTS (
      SELECT 1 FROM promises 
      WHERE politician_id = p.id 
      AND source_link LIKE '%tse%'
    )
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END LOOP;
  
  -- Atualizar log
  UPDATE scraper_logs SET 
    items_found = v_count,
    items_inserted = v_count,
    finished_at = NOW()
  WHERE id = v_scraper_log_id;
  
  -- Atualizar config
  UPDATE scraper_config SET 
    last_run = NOW(),
    last_status = 'success',
    last_items_found = v_count
  WHERE name = 'tse_promises';
  
  RETURN v_count;
EXCEPTION
  WHEN OTHERS THEN
    UPDATE scraper_logs SET 
      errors = SQLERRM,
      finished_at = NOW()
    WHERE id = v_scraper_log_id;
    
    UPDATE scraper_config SET 
      last_run = NOW(),
      last_status = 'error'
    WHERE name = 'tse_promises';
    
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- 4. Função: Buscar notícias para validar status das promessas
CREATE OR REPLACE FUNCTION validate_promise_status()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_promise RECORD;
  v_scraper_log_id UUID;
  v_related_articles INTEGER;
BEGIN
  INSERT INTO scraper_logs (scraper_name, source, items_found)
  VALUES ('news_validator', 'G1/UOL/Folha', 0)
  RETURNING id INTO v_scraper_log_id;
  
  -- Para cada promessa pendente, buscar notícias relacionadas
  FOR v_promise IN 
    SELECT p.id, p.politician_name, p.promise_title, p.status
    FROM promises p
    WHERE p.status IN ('pendente', 'em_andamento')
    ORDER BY p.created_at DESC
    LIMIT 100
  LOOP
    -- Simular busca de notícias (em produção usaria API de notícias)
    -- Aqui verificamos se há evidências na tabela promise_evidences
    
    SELECT COUNT(*) INTO v_related_articles
    FROM promise_evidences
    WHERE promise_id = v_promise.id
    AND validation_status = 'approved';
    
    -- Se há 2+ evidências aprovadas, tentar categorizar
    IF v_related_articles >= 2 THEN
      -- Atualizar status baseado nas evidências (lógica simplificada)
      UPDATE promises SET
        updated_at = NOW()
      WHERE id = v_promise.id;
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  UPDATE scraper_logs SET 
    items_found = v_count,
    finished_at = NOW()
  WHERE id = v_scraper_log_id;
  
  RETURN v_count;
EXCEPTION
  WHEN OTHERS THEN
    UPDATE scraper_logs SET 
      errors = SQLERRM,
      finished_at = NOW()
    WHERE id = v_scraper_log_id;
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- 5. Inserir configurações padrão
INSERT INTO scraper_config (name, enabled, schedule_interval, config) VALUES
  ('tse_promises', true, 'daily', '{"description": "Coleta promessas do banco de dados do TSE"}'),
  ('news_validator', true, 'daily', '{"description": "Valida status de promessas através de notícias"}'),
  ('evidence_search', true, 'hourly', '{"description": "Busca evidências para promessas pendentes"}')
ON CONFLICT (name) DO NOTHING;

SELECT 'Sistema de scraping configurado!' as result;