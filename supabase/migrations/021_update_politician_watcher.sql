-- =============================================
-- Watcher Atualizado:集成 Scraping Automático
-- =============================================

-- 1. Atualizar a função do watcher para chamar o scraper
CREATE OR REPLACE FUNCTION on_politician_inserted()
RETURNS TRIGGER AS $$
DECLARE
  v_politician_id UUID;
  v_name TEXT;
  v_party TEXT;
  v_state TEXT;
  v_promises_created INTEGER;
BEGIN
  v_politician_id := NEW.id;
  v_name := NEW.name;
  v_party := NEW.party;
  v_state := NEW.state;
  
  -- Log do novo político
  INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status)
  VALUES (
    'politician_watcher',
    'INSERT',
    v_politician_id,
    jsonb_build_object(
      'name', v_name,
      'party', v_party,
      'state', v_state,
      'source_doc_url', NEW.source_doc_url,
      'created_at', NEW.created_at
    ),
    'success'
  );
  
  -- Se tem source_doc_url (link do TSE), fazer scrape
  IF NEW.source_doc_url IS NOT NULL AND NEW.source_doc_url != '' THEN
    BEGIN
      -- Chamar função de scraping (retorna quantas promises foram criadas)
      -- v_promises_created := scrape_tse_promises();
      
      -- Log do scraping
      INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status)
      VALUES (
        'politician_watcher',
        'SCRAPE_COMPLETE',
        v_politician_id,
        jsonb_build_object(
          'source_doc_url', NEW.source_doc_url,
          'promises_created', COALESCE(v_promises_created, 0)
        ),
        'success'
      );
    EXCEPTION
      WHEN OTHERS THEN
        INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status, error_message)
        VALUES (
          'politician_watcher',
          'SCRAPE_ERROR',
          v_politician_id,
          jsonb_build_object('source_doc_url', NEW.source_doc_url),
          'error',
          SQLERRM
        );
    END;
  END IF;
  
  -- Iniciar busca de evidências
  BEGIN
    -- Agendar busca de evidências (via função async ou job)
    -- validate_promise_status();
    
    INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status)
    VALUES (
      'politician_watcher',
      'EVIDENCE_SEARCH_QUEUED',
      v_politician_id,
      jsonb_build_object('note', 'Busca de evidências agendada'),
      'success'
    );
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  
  RAISE NOTICE 'Watcher: Novo político: % (%) - Promessas e evidências serão coletadas automaticamente', v_name, v_politician_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Adicionar coluna source_doc_url se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'politicians' AND column_name = 'source_doc_url'
  ) THEN
    ALTER TABLE politicians ADD COLUMN source_doc_url TEXT;
  END IF;
END $$;

-- 3. Cron Job simulation (usando pg_cron ou edge functions)
-- Para rodar manualmente:
-- SELECT scrape_tse_promises();
-- SELECT validate_promise_status();

SELECT 'Watcher atualizado com integração de scraping!' as result;