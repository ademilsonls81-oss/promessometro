import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupWatcher() {
  console.log('🔧 Configurando Watcher...\n');
  
  // 1. Adicionar source_doc_url se não existir
  console.log('1. Verificando/colunindo politicians.source_doc_url...');
  
  // Try to insert with the column - Supabase will create it if needed in some cases
  // But first let's check the table
  const { data: checkCols } = await supabase
    .from('politicians')
    .select('*')
    .limit(1);
    
  if (checkCols && checkCols.length > 0) {
    console.log('   Colunas existentes:', Object.keys(checkCols[0]).join(', '));
  }
  
  // 2. Criar tabela de watcher_logs
  console.log('\n2. Criando watcher_logs...');
  const { error: logError } = await supabase
    .from('watcher_logs')
    .insert({
      watcher_name: 'test',
      event_type: 'test',
      status: 'test'
    })
    .select();
    
  if (logError && !logError.message.includes('duplicate')) {
    console.log('   Erro (pode precisar criar manualmente):', logError.message.substring(0, 50));
  } else {
    console.log('   ✅ watcher_logs OK');
  }
  
  // 3. Inserir político de teste
  console.log('\n3. Inserindo político de teste...');
  const { data: newPolitician, error: politicianError } = await supabase
    .from('politicians')
    .insert({
      name: 'João Doria',
      party: 'PSDB',
      state: 'SP'
    })
    .select()
    .single();
    
  if (politicianError) {
    console.log('   Erro:', politicianError.message);
  } else {
    console.log('   ✅ Político criado:', newPolitician.name, '(' + newPolitician.id + ')');
  }
  
  // 4. Verificar logs
  console.log('\n4. Verificando watcher_logs...');
  const { data: logs } = await supabase
    .from('watcher_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (logs && logs.length > 0) {
    console.log('   ✅ Logs encontrados:');
    logs.forEach(l => {
      console.log(`   - ${l.watcher_name}: ${l.event_type}`);
    });
  } else {
    console.log('   ⚠️ Nenhum log - trigger pode não ter sido criado');
  }
  
  console.log('\n✨ Setup completo!');
  console.log('\nPara criar as funções do banco manualmente, execute no SQL Editor:');
  console.log('\n-- Criar trigger para watcher');
  console.log('CREATE OR REPLACE FUNCTION on_politician_inserted()');
  console.log('RETURNS TRIGGER AS $$');
  console.log('BEGIN');
  console.log("  INSERT INTO watcher_logs (watcher_name, event_type, record_id, status)");
  console.log("  VALUES ('politician_watcher', 'INSERT', NEW.id, 'success');");
  console.log('  RETURN NEW;');
  console.log('END;');
  console.log('$$ LANGUAGE plpgsql;');
}

setupWatcher();