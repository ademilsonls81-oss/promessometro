import { Router, Request, Response } from "express";
import { scrapePoliticianFromTSE, runDailyMonitor, scrapeAllPoliticiansWithTSE } from "../services/scraperService.js";
import { checkAdmin } from "../middleware/auth.js";

const router = Router();

router.post("/scrape/:politicianId", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { politicianId } = req.params;
    const { sourceUrl } = req.body;

    if (!sourceUrl) {
      return res.status(400).json({ error: "sourceUrl Ã© obrigatÃ³rio" });
    }

    console.log(`[Scraper API] Iniciando scraping para polÃ­tico: ${politicianId}`);

    const result = await scrapePoliticianFromTSE(politicianId, sourceUrl);

    if (!result.success) {
      return res.status(500).json({ error: result.message });
    }

    return res.json({
      success: true,
      jobId: result.jobId,
      promisesCreated: result.promisesCreated,
      message: result.message
    });

  } catch (err) {  // any-ok
    console.error(`[Scraper API] Erro:`, err);
    return res.status(500).json({ error: err.message });
  }
}));

router.post("/scrape-all", checkAdmin, asyncHandler(async (_req: Request, res: Response) => {
  try {
    console.log(`[Scraper API] Executando scraping em massa...`);

    const result = await scrapeAllPoliticiansWithTSE();

    return res.json({
      success: true,
      processed: result.processed,
      created: result.created,
      errors: result.errors
    });

  } catch (err) {  // any-ok
    console.error(`[Scraper API] Erro:`, err);
    return res.status(500).json({ error: err.message });
  }
}));

router.post("/daily-monitor", checkAdmin, asyncHandler(async (_req: Request, res: Response) => {
  try {
    console.log(`[Scraper API] Executando monitoramento diÃ¡rio...`);

    const result = await runDailyMonitor();

    return res.json({
      success: true,
      promisesProcessed: result.promisesProcessed,
      evidencesFound: result.evidencesFound,
      scoresUpdated: result.scoresUpdated
    });

  } catch (err) {  // any-ok
    console.error(`[Scraper API] Erro:`, err);
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/jobs", asyncHandler(async (_req: Request, res: Response) => {
  try {
    const { data: jobs } = await supabase
      .from('scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    return res.json({ jobs: jobs || [] });

  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/monitor-logs", asyncHandler(async (_req: Request, res: Response) => {
  try {
    const { data: logs } = await supabase
      .from('daily_monitor_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);

    return res.json({ logs: logs || [] });

  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

import { supabase } from "../lib/supabase.js";

import { asyncHandler } from "../utils/asyncHandler.js";

export default router;