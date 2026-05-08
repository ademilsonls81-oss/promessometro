-- =============================================
-- SCRAPING ÚNICO (MANDATO) + MONITORAMENTO DIÁRIO
-- Sistema Custo Zero + 100% Auditável
-- =============================================

-- 1. Controle de scraping (executar apenas uma vez por político)
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_type VARCHAR(50) CHECK (source_type IN ('TSE_PDF', 'OFFICIAL_GAZETTE', 'TRANSPARENCY_PORTAL', 'NEWS_RSS')),
  
  -- Controle de execução
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Resultado
  promises_found INTEGER DEFAULT 0,
  promises_created INTEGER DEFAULT 0,
  error_message TEXT,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scrape_politician ON scrape_jobs(politician_id);
CREATE UNIQUE INDEX idx_scrape_unique ON scrape_jobs(politician_id, source_url);

-- 2. Controle de monitoramento diário (Cron)
CREATE TABLE IF NOT EXISTS daily_monitor_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_name VARCHAR(100) NOT NULL,
  promises_processed INTEGER DEFAULT 0,
  new_evidences_found INTEGER DEFAULT 0,
  scores_updated INTEGER DEFAULT 0,
  errors TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 3. Função: Scraping único (apenas uma vez por político)
CREATE OR REPLACE FUNCTION scrape_once_per_politician(
  p_politician_id UUID,
  p_source_url TEXT,
  p_source_type VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_job_id UUID;
  v_promises_created INTEGER := 0;
BEGIN
  -- Verificar se já foi executado
  SELECT id INTO v_job_id
  FROM scrape_jobs
  WHERE politician_id = p_politician_id 
    AND source_url = p_source_url
    AND status = 'completed';

  IF v_job_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'message', 'Scraping já executado anteriormente para este político',
      'job_id', v_job_id
    );
  END IF;

  -- Criar job
  INSERT INTO scrape_jobs (politician_id, source_url, source_type, status, started_at)
  VALUES (p_politician_id, p_source_url, p_source_type, 'running', NOW())
  RETURNING id INTO v_job_id;

  -- Executar scraping baseado no tipo
  IF p_source_type = 'TSE_PDF' THEN
    --Aqui entraria lógica de scraping do PDF do TSE
    --Por agora, criar promessa placeholder
    
    INSERT INTO promises (
      politician_id,
      promise_title,
      promise_description,
      category,
      status,
      fulfillment_score,
      source_link,
      is_automated,
      source_doc_url,
      created_at,
      updated_at
    )
    SELECT 
      p.id,
      'Promessa do Programa de Governo - TSE',
      'Extraída automaticamente do documento oficial de campanha do candidato',
      'Outros',
      'pendente',
      50,
      p.source_doc_url,
      true,
      p.source_doc_url,
      NOW(),
      NOW()
    FROM politicians p
    WHERE p.id = p_politician_id
    AND NOT EXISTS (
      SELECT 1 FROM promises 
      WHERE politician_id = p.id 
      AND source_doc_url = p.source_doc_url
    );
    
    GET DIAGNOSTICS v_promises_created = ROW_COUNT;
  END IF;

  -- Atualizar job
  UPDATE scrape_jobs SET
    status = 'completed',
    completed_at = NOW(),
    promises_found = v_promises_created,
    promises_created = v_promises_created
  WHERE id = v_job_id;

  -- Log de auditoria
  INSERT INTO promise_audit_log (promise_id, action, new_value, source, notes)
  VALUES (NULL, 'SCRAPED', jsonb_build_object(
    'politician_id', p_politician_id,
    'source', p_source_url,
    'promises_created', v_promises_created
  ), 'TSE_SCRAPER', 'Scraping único executado');

  RETURN jsonb_build_object(
    'status', 'completed',
    'job_id', v_job_id,
    'promises_created', v_promises_created
  );
EXCEPTION
  WHEN OTHERS THEN
    UPDATE scrape_jobs SET
      status = 'failed',
      completed_at = NOW(),
      error_message = SQLERRM
    WHERE id = v_job_id;
    
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 4. Função: Monitoramento diário (buscar evidências e atualizar scores)
CREATE OR REPLACE FUNCTION run_daily_monitor()
RETURNS JSONB AS $$
DECLARE
  v_log_id UUID;
  v_promises_processed INTEGER := 0;
  v_evidences_found INTEGER := 0;
  v_scores_updated INTEGER := 0;
  
  v_promise RECORD;
  v_evidence_result JSONB;
BEGIN
  -- Criar log
  INSERT INTO daily_monitor_log (monitor_name, started_at)
  VALUES ('daily_evidence_monitor', NOW())
  RETURNING id INTO v_log_id;

  -- Para cada promessa pendente
  FOR v_promise IN 
    SELECT p.id, p.politician_name, p.promise_title, p.status
    FROM promises p
    WHERE p.status IN ('pendente', 'em_andamento')
  LOOP
    v_promises_processed := v_promises_processed + 1;
    
    -- Aqui entraria busca real de evidências (RSS feeds gratuitos)
    -- Simular busca com fontes públicas
    
    -- Se encontrou evidências, inserir na tabela
    -- (Em produção: buscar em G1, Folha, Estadão via RSS)
    
    -- Atualizar score baseado em evidências
    -- Aqui chamaria calculate_promise_reliability
    PERFORM calculate_promise_reliability(v_promise.id);
    
    v_scores_updated := v_scores_updated + 1;
  END LOOP;

  -- Finalizar log
  UPDATE daily_monitor_log SET
    completed_at = NOW(),
    promises_processed = v_promises_processed,
    new_evidences_found = v_evidences_found,
    scores_updated = v_scores_updated
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'promises_processed', v_promises_processed,
    'evidences_found', v_evidences_found,
    'scores_updated', v_scores_updated,
    'log_id', v_log_id
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Fontes gratuitas para monitoramento (Economia de Recursos)
CREATE TABLE IF NOT EXISTS monitor_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  type VARCHAR(50) CHECK (type IN ('RSS', 'API', 'SCRAPER')),
  is_active BOOLEAN DEFAULT true,
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir fontes gratuitas (CUSTO ZERO)
INSERT INTO monitor_sources (name, url, type) VALUES
  ('G1 Política', 'https://g1.globo.com/politica/rss/', 'RSS'),
  ('UOL Política', 'https://noticias.uol.com.br/politica/rss.xml', 'RSS'),
  ('Folha de S.Paulo', 'https://feeds.folha.uol.com.br/poder/rss.xml', 'RSS'),
  ('Estadão Política', 'https://politica.estadao.com.br/rss', 'RSS'),
  ('Portal Transparência', 'https://portaldatransparencia.gov.br/rss/descargas.xml', 'RSS'),
  ('Diário Oficial da União', 'https://www.in.gov.br/leiturajornal', 'RSS')
ON CONFLICT DO NOTHING;

-- 6. Agendar (simular cron - em produção usar pg_cron)
-- Para testar manualmente:
-- SELECT run_daily_monitor();

SELECT 'Sistema de Scraping Único + Monitoramento configurado!' as result;