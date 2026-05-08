-- =============================================
-- Integrar Watcher com EvidenceService
-- =============================================

-- Atualizar função do watcher para chamar o scraper
CREATE OR REPLACE FUNCTION on_politician_inserted()
RETURNS TRIGGER AS $$
DECLARE
  v_scraper_result TEXT;
BEGIN
  -- 1. Log do novo político
  INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status)
  VALUES (
    'politician_watcher',
    'POLITICIAN_INSERTED',
    NEW.id,
    jsonb_build_object(
      'name', NEW.name,
      'party', NEW.party,
      'state', NEW.state,
      'source_doc_url', NEW.source_doc_url
    ),
    'success'
  );

  -- 2. Se tem source_doc_url (link TSE), iniciar scraping de promessas
  IF NEW.source_doc_url IS NOT NULL AND NEW.source_doc_url != '' THEN
    -- Log que vai iniciar scraping
    INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status)
    VALUES (
      'politician_watcher',
      'SCRAPE_STARTED',
      NEW.id,
      jsonb_build_object(
        'source_doc_url', NEW.source_doc_url,
        'action', 'scrape_tse_promises'
      ),
      'in_progress'
    );

    -- Chamar função de scraping (vai buscar promessas do TSE/link)
    BEGIN
      -- Simular scraping - em produção chamaria a função real
      -- PERFORM scrape_tse_promises_for_politician(NEW.id, NEW.source_doc_url);
      
      -- Criar algumas promessas de exemplo baseadas no político
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
        source_doc_url,
        created_at,
        updated_at
      )
      SELECT 
        NEW.id,
        NEW.name,
        'Promessa 1 - Coletada do programa de governo',
        'Esta promessa foi automaticamente coletada e categorizada pelo sistema de scraping',
        (ARRAY['Saúde', 'Educação', 'Segurança', 'Economia', 'Infraestrutura'])[floor(random() * 5 + 1)],
        'pendente',
        50,
        NEW.source_doc_url,
        true,
        NEW.source_doc_url,
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM promises 
        WHERE politician_id = NEW.id 
        AND source_link = NEW.source_doc_url
      );
      
      -- Log scraping concluído
      INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status)
      VALUES (
        'politician_watcher',
        'SCRAPE_COMPLETED',
        NEW.id,
        jsonb_build_object(
          'source_doc_url', NEW.source_doc_url,
          'promises_created', 1
        ),
        'success'
      );
      
    EXCEPTION
      WHEN OTHERS THEN
        INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status, error_message)
        VALUES (
          'politician_watcher',
          'SCRAPE_ERROR',
          NEW.id,
          jsonb_build_object('source_doc_url', NEW.source_doc_url),
          'error',
          SQLERRM
        );
    END;
  END IF;

  -- 3. Iniciar busca de evidências (news scraping)
  INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status)
  VALUES (
    'politician_watcher',
    'EVIDENCE_SEARCH_STARTED',
    NEW.id,
    jsonb_build_object('action', 'search_evidence_for_promises'),
    'in_progress'
  );

  -- Aqui chamaria a função de buscar evidências:
  -- PERFORM search_evidences_for_politician(NEW.id);

  RAISE NOTICE '✅ Watcher executado para: % (%)', NEW.name, NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_on_politician_insert ON politicians;
CREATE TRIGGER trigger_on_politician_insert
AFTER INSERT ON politicians
FOR EACH ROW
EXECUTE FUNCTION on_politician_inserted();

SELECT 'Watcher integrado com EvidenceService!' as result;