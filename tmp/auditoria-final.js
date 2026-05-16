import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://liqutcjzzrqstivvfele.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0'
);

const problems = [];
const fixed = [];

async function checkEvidences() {
  console.log('=== Verificação de Evidências ===\n');

  // Evidências sem descrição ou URL
  const { data: badEvidences } = await supabase
    .from('promise_evidences')
    .select('id, promise_id, descricao, url, fonte')
    .or('url.is.null,url.eq.,descricao.is.null,descricao.eq.,descricao.eq.Fonte sugerida pelo modelo de linguagem');

  const badCount = badEvidences?.length || 0;
  if (badCount > 0) {
    problems.push(`Evidências inválidas: ${badCount} sem descrição, URL ou com descrição genérica`);
  }
  console.log(`Evidências inválidas: ${badCount}`);

  // Atualizar is_verified
  const { data: updated } = await supabase
    .from('promise_evidences')
    .update({ is_verified: true })
    .not('url', 'is', null)
    .not('url', 'eq', '')
    .not('descricao', 'is', null)
    .not('descricao', 'eq', '')
    .not('descricao', 'eq', 'Fonte sugerida pelo modelo de linguagem')
    .not('fonte', 'is', null)
    .not('fonte', 'eq', '')
    .select();

  fixed.push(`Marcadas ${updated?.length || 0} evidências como is_verified=true`);
  console.log(`Marcadas ${updated?.length || 0} evidências como verificadas\n`);
}

async function checkEvaluations() {
  console.log('=== Verificação de Avaliações ===\n');

  const { data: promises } = await supabase
    .from('promises')
    .select('id, promise_title, status, fulfillment_score');

  const { data: evaluations } = await supabase
    .from('promise_explanations')
    .select('promise_id, status, fulfillment_score, confianca, is_latest')
    .eq('is_latest', true);

  const evalMap = {};
  (evaluations || []).forEach(e => { evalMap[e.promise_id] = e; });

  let semAvaliacao = 0;
  let divergentes = 0;

  for (const p of promises || []) {
    const ev = evalMap[p.id];
    if (!ev) {
      semAvaliacao++;
      if (semAvaliacao <= 5) {
        console.log(`  ⚠ Sem avaliação: "${p.promise_title?.substring(0, 40)}"`);
      }
    }
  }

  problems.push(`Promessas sem avaliação: ${semAvaliacao}`);
  console.log(`Promessas sem avaliação em promise_explanations: ${semAvaliacao}`);

  const statusEquivalente = {
    'cumprida': ['cumprida'],
    'parcial': ['parcial', 'parcialmente_cumprida', 'em_andamento'],
    'pendente': ['pendente', 'nao_iniciada', 'nao_classificada'],
    'quebrada': ['quebrada', 'descumprida'],
    'parcialmente_cumprida': ['parcial', 'parcialmente_cumprida'],
    'em_andamento': ['parcial', 'em_andamento'],
    'nao_iniciada': ['pendente', 'nao_iniciada'],
    'nao_classificada': ['pendente', 'nao_classificada'],
    'descumprida': ['quebrada', 'descumprida']
  };

  for (const p of promises || []) {
    const ev = evalMap[p.id];
    if (ev) {
      const allowedStatuses = statusEquivalente[ev.status] || [ev.status];
      if (!allowedStatuses.includes(p.status)) {
        if (divergentes < 5) {
          console.log(`  ⚠ Divergência: "${p.promise_title?.substring(0, 40)}" -> evaluation=${ev.status}, promise=${p.status}`);
        }
        divergentes++;
      }
    }
  }

  if (divergentes > 0) {
    problems.push(`Status divergentes entre evaluation e promise: ${divergentes}`);
  }
  console.log(`Status divergentes: ${divergentes}\n`);
}

async function checkPoliticianColumns() {
  console.log('=== Verificação de Colunas ===\n');

  // Verificar se há políticos com nome em PT
  const { data: ptColumn } = await supabase
    .from('politicians')
    .select('nome, cargo, estado, partido')
    .not('nome', 'is', null)
    .limit(1);

  if (ptColumn && ptColumn.length > 0) {
    problems.push('Tabela politicians ainda tem colunas em PT (nome, cargo, estado, partido). Devem ser migradas para name, role, state, party.');
    console.log('⚠ Colunas PT detectadas em politicians');
  } else {
    console.log('✅ Colunas em politicians estão padronizadas (EN)');
  }

  // Verificar promises
  const { data: ptPromise } = await supabase
    .from('promises')
    .select('nome_politico, titulo, cargo')
    .not('nome_politico', 'is', null)
    .limit(1);

  if (ptPromise && ptPromise.length > 0) {
    console.log('⚠ Colunas PT detectadas em promises (nome_politico, titulo, cargo)');
  } else {
    console.log('✅ Colunas em promises estão padronizadas');
  }

  console.log('');
}

async function runAudit() {
  console.log('========================================');
  console.log('  AUDITORIA COMPLETA - PROMESSÔMETRO');
  console.log('========================================\n');

  await checkPoliticianColumns();
  await checkEvidences();
  await checkEvaluations();

  console.log('========================================');
  console.log('  RELATÓRIO DE PROBLEMAS');
  console.log('========================================\n');
  
  if (problems.length === 0) {
    console.log('✅ Nenhum problema encontrado!');
  } else {
    problems.forEach((p, i) => console.log(`${i + 1}. ❌ ${p}`));
  }

  console.log('\n========================================');
  console.log('  CORREÇÕES REALIZADAS');
  console.log('========================================\n');
  
  if (fixed.length === 0) {
    console.log('Nenhuma correção necessária.');
  } else {
    fixed.forEach((f, i) => console.log(`${i + 1}. ✅ ${f}`));
  }

  console.log('\n========================================');
  console.log('  RESUMO');
  console.log('========================================\n');
  console.log(`Problemas encontrados: ${problems.length}`);
  console.log(`Correções aplicadas: ${fixed.length}`);
  console.log('');

  // Verificação final
  if (problems.length === 0) {
    console.log('✅ SISTEMA CONSISTENTE');
  } else {
    console.log('⚠ Existem problemas que precisam de atenção manual:');
    problems.forEach(p => console.log(`   - ${p}`));
  }
}

runAudit().catch(console.error);
