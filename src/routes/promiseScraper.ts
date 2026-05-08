import { Router, Request, Response } from "express";
import { runPromiseScraper } from "../services/promiseScraper.js";
import { processNewsQueue } from "../services/promiseAiService.js";

const router = Router();

router.post("/scrape", async (req: Request, res: Response) => {
  try {
    console.log("[Admin] Starting promise scraper...");
    const result = await runPromiseScraper();
    
    return res.json({
      success: true,
      message: "Scraping completed",
      ...result
    });
  } catch (err: any) {
    console.error("Scrape error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    console.log("[Admin] Starting AI analysis...");
    await processNewsQueue();
    
    return res.json({
      success: true,
      message: "Analysis completed"
    });
  } catch (err: any) {
    console.error("Analyze error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/sources", async (req: Request, res: Response) => {
  try {
    const { SCRAPER_SOURCES } = await import("../services/promiseScraper.js");
    return res.json({ sources: SCRAPER_SOURCES });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;