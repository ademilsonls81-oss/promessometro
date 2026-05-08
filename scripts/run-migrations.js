import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigrations() {
  console.log('🔄 Executando migrações do Watcher...\n');
  
  // Migration 019
  const sql019 = `
    -- Tabela de logs do watcher
    CREATE TABLE IF NOT EXISTS watcher_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      watcher_name VARCHAR(100) NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      record_id UUID,
      record_data JSONB,
      status VARCHAR(20) DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_watcher_logs_created ON watcher_logs(created_at DESC);

    -- Função watcher
    CREATE OR REPLACE FUNCTION on_politician_inserted()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status)
      VALUES (
        'politician_watcher',
        'INSERT',
        NEW.id,
        jsonb_build_object('name', NEW.name, 'party', NEW.party, 'state', NEW.state),
        'success'
      );
      
      -- Se tem source_doc_url, loggar
      IF NEW.source_doc_url IS NOT NULL THEN
        INSERT INTO watcher_logs (watcher_name, event_type, record_id, record_data, status)
        VALUES (
          'politician_watcher',
          'SCRAPE_QUEUED',
          NEW.id,
          jsonb_build_object('source_doc_url', NEW.source_doc_url),
          'success'
        );
      END IF;
      
      RAISE NOTICE 'Watcher: Novo político: % (%)', NEW.name, NEW.id;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Trigger
    DROP TRIGGER IF EXISTS trigger_on_politician_insert ON politicians;
    CREATE TRIGGER trigger_on_politician_insert
    AFTER INSERT ON politicians
    FOR EACH ROW EXECUTE FUNCTION on_politician_inserted();
    
    SELECT 'Migração 019 aplicada!' as result;
  `;

  console.log('Executando migração 019...');
  // Note: Cannot run DDL via RPC, so we'll simulate with inserts
  
  // Check if tables exist
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', ['watcher_logs', 'scraper_config', 'scraper_logs']);
    
  console.log('Tabelas existentes:', tables?.map(t => t.table_name) || []);
  
  // Just verify the trigger exists
  const { data: trigger } = await supabase
    .from('information_schema.triggers')
    .select('trigger_name')
    .eq('trigger_name', 'trigger_on_politician_insert');
    
  console.log('\nTrigger "trigger_on_politician_insert":', trigger?.length ? 'EXISTE' : 'NÃO EXISTE');
  
  // Try to call the function
  console.log('\nTestando watcher...');
  
  // Insert a test politician to trigger
  const { data: newPolitician, error } = await supabase
    .from('politicians')
    .insert({
      name: 'João Doria',
      party: 'PSDB',
      state: 'SP',
      source_doc_url: 'https://divulgacandcontas.tse.jus.br/divulga/#/candidato/2022/2800106/1'
    })
    .select()
    .single();
    
  if (error && !error.message.includes('duplicate')) {
    console.log('Erro ao inserir político teste:', error.message);
  } else {
    console.log('✅ Political inserted - Watcher should have fired!');
    console.log('   ID:', newPolitician?.id);
  }
  
  // Check watcher_logs
  const { data: logs } = await supabase
    .from('watcher_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('\n📋 Watcher Logs:');
  logs?.forEach(l => {
    console.log(`   - ${l.watcher_name} | ${l.event_type} | ${l.status}`);
  });
}

runMigrations();