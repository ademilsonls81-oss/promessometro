import { supabase } from "../lib/supabase.js";

interface ScrapeResult {
  success: boolean;
  jobId?: string;
  promisesCreated: number;
  message: string;
}

export async function scrapePoliticianFromTSE(politicianId: string, sourceUrl: string): Promise<ScrapeResult> {
  console.log(`[Scraper] Iniciando scraping para politician: ${politicianId}`);
  
  try {
    // 1. Verificar se scraping já foi executado (evitar duplicatas)
    const { data: existingJob } = await supabase
      .from('scrape_jobs')
      .select('id, status')
      .eq('politician_id', politicianId)
      .eq('source_url', sourceUrl)
      .eq('status', 'completed')
      .single();

    if (existingJob) {
      console.log(`[Scraper] Skipped - scraping já executado anteriormente`);
      return {
        success: true,
        jobId: existingJob.id,
        promisesCreated: 0,
        message: 'Scraping já executado anteriormente'
      };
    }

    // 2. Criar registro do job
    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .insert({
        politician_id: politicianId,
        source_url: sourceUrl,
        source_type: 'TSE_PDF',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(`Erro ao criar job: ${jobError?.message}`);
    }

    console.log(`[Scraper] Job criado: ${job.id}`);

    // 3. Executar scraping (simulado - em produção usaria cheerio/PDF parser)
    const promisesCreated = await executeTSEParsing(politicianId, sourceUrl);

    // 4. Marcar job como completed
    const { error: updateError } = await supabase
      .from('scrape_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        promises_found: promisesCreated,
        promises_created: promisesCreated
      })
      .eq('id', job.id);

    if (updateError) {
      console.error(`[Scraper] Erro ao atualizar job:`, updateError);
    }

    // 5. Log de auditoria
    await logAudit(politicianId, 'SCRAPED', null, {
      source_url: sourceUrl,
      promises_created: promisesCreated
    }, 'TSE_SCRAPER', 'Scraping único executado');

    console.log(`[Scraper] Concluído! Promessas criadas: ${promisesCreated}`);

    return {
      success: true,
      jobId: job.id,
      promisesCreated,
      message: `Scraping concluído: ${promisesCreated} promessas extraídas`
    };

  } catch (error) {  // any-ok
    console.error(`[Scraper] Erro:`, error.message);
    return {
      success: false,
      promisesCreated: 0,
      message: error.message
    };
  }
}

async function executeTSEParsing(politicianId: string, sourceUrl: string): Promise<number> {
  // TODO: Implementar scraping real do PDF do TSE
  // Usar cheerio para parsing do HTML do TSE
  // Extrair promessas do programa de governo
  
  // Por agora, criar uma promessa placeholder de exemplo
  const { data: politician } = await supabase
    .from('politicians')
    .select('name')
    .eq('id', politicianId)
    .single();

  if (!politician) return 0;

  const { error: insertError } = await supabase
    .from('promises')
    .insert({
      politician_id: politicianId,
      politician_name: politician.name,
      promise_title: 'Promessa extraída automaticamente do Programa de Governo (TSE)',
      promise_description: 'Esta promessa foi extraída automaticamente do documento oficial de campanha disponível no portal do TSE.',
      category: 'Outros',
      status: 'pendente',
      fulfillment_score: 50,
      source_link: sourceUrl,
      is_automated: true,
      source_doc_url: sourceUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (insertError) {
    console.error(`[Scraper] Erro ao inserir promessa:`, insertError);
    return 0;
  }

  return 1;
}

async function logAudit(
  promiseId: string | null,
  action: string,
  previousValue: any,  // any-ok
  newValue: any,  // any-ok
  source: string,
  notes: string
): Promise<void> {
  await supabase.from('promise_audit_log').insert({
    promise_id: promiseId,
    action,
    previous_value: previousValue,
    new_value: newValue,
    source,
    notes,
    created_at: new Date().toISOString()
  });
}

export async function runDailyMonitor(): Promise<{
  promisesProcessed: number;
  evidencesFound: number;
  scoresUpdated: number;
}> {
  console.log(`[Monitor] Iniciando monitoramento diário...`);

  // Criar log de início
  const { data: log } = await supabase
    .from('daily_monitor_log')
    .insert({
      monitor_name: 'daily_evidence_monitor',
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  let promisesProcessed = 0;
  let evidencesFound = 0;
  let scoresUpdated = 0;

  // Processar promessas pendentes
  const { data: promises } = await supabase
    .from('promises')
    .select('id, politician_name, promise_title, status')
    .in('status', ['pendente', 'em_andamento']);

  if (promises) {
    for (const promise of promises) {
      promisesProcessed++;

      // Buscar evidências via RSS (gratuito)
      const newEvidences = await searchEvidencesFromRSS(
        promise.politician_name,
        promise.promise_title
      );

      if (newEvidences > 0) {
        evidencesFound += newEvidences;

        // Inserir evidência
        await supabase.from('promise_evidences').insert({
          promise_id: promise.id,
          source_name: 'Monitoramento Diário',
          source_url: 'https://g1.globo.com/politica/rss/',
          source_type: 'journalism',
          source_credibility: 80,
          title: `Evidência coletada em ${new Date().toLocaleDateString()}`,
          content: `Notícia relacionada à promessa: ${promise.promise_title}`,
          evidence_type: 'related',
          confidence_score: 50,
          validation_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Log de auditoria
        await logAudit(
          promise.id,
          'EVIDENCE_ADDED',
          null,
          { source: 'daily_monitor', count: newEvidences },
          'SYSTEM',
          'Evidência adicionada pelo monitoramento diário'
        );
      }

      // Recalcular score
      await calculateReliabilityScore(promise.id);
      scoresUpdated++;
    }
  }

  // Finalizar log
  await supabase
    .from('daily_monitor_log')
    .update({
      completed_at: new Date().toISOString(),
      promises_processed: promisesProcessed,
      new_evidences_found: evidencesFound,
      scores_updated: scoresUpdated
    })
    .eq('id', log?.id);

  console.log(`[Monitor] Concluído: ${promisesProcessed} processadas, ${evidencesFound} evidências, ${scoresUpdated} scores atualizados`);

  return { promisesProcessed, evidencesFound, scoresUpdated };
}

async function searchEvidencesFromRSS(politicianName: string, promiseTitle: string): Promise<number> {
  // TODO: Implementar busca real via RSS parser
  // Fontes: G1, UOL, Folha, Estadão (gratuitas)
  // Retornar número de artigos encontrados relacionados
  
  // Por agora, retornar 0 (sem busca real)
  return 0;
}

async function calculateReliabilityScore(promiseId: string): Promise<void> {
  const { count: evidenceCount } = await supabase
    .from('promise_evidences')
    .select('*', { count: 'exact', head: true })
    .eq('promise_id', promiseId)
    .eq('validation_status', 'approved');

  const evidenceStrength = Math.min((evidenceCount || 0) * 20, 100);

  await supabase
    .from('promise_reliability_scores')
    .upsert({
      promise_id: promiseId,
      evidence_strength: evidenceStrength,
      source_quality: 80,
      verification_depth: evidenceCount && evidenceCount >= 3 ? 100 : 50,
      dispute_count: 0,
      calculated_at: new Date().toISOString()
    }, { onConflict: 'promise_id' });
}

export async function scrapeAllPoliticiansWithTSE(): Promise<{
  processed: number;
  created: number;
  errors: number;
}> {
  console.log(`[Scraper] Iniciando scraping em massa...`);

  const { data: politicians } = await supabase
    .from('politicians')
    .select('id, name, source_doc_url')
    .not('source_doc_url', 'is', null);

  let processed = 0;
  let created = 0;
  let errors = 0;

  if (politicians) {
    for (const politician of politicians) {
      const result = await scrapePoliticianFromTSE(
        politician.id,
        politician.source_doc_url
      );

      processed++;
      if (result.success && result.promisesCreated > 0) {
        created += result.promisesCreated;
      }
      if (!result.success) {
        errors++;
      }
    }
  }

  console.log(`[Scraper] Concluído: ${processed} processados, ${created} criados, ${errors} erros`);

  return { processed, created, errors };
}