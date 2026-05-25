import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { checkAdmin } from "../middleware/auth.js";
import { classifyPromise, applyScore, batchClassify, getCriteria, getExplanation } from "../services/scoreService.js";
import { invalidate as cacheInvalidate } from "../services/cacheService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/:id", checkAdmin, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: promise, error: promiseError } = await supabase
      .from("promises")
      .select("*")
      .eq("id", id)
      .single();

    if (promiseError || !promise) {
      return res.status(404).json({ error: "Promessa nÃ£o encontrada" });
    }

    console.log(`[Score] Classifying: ${promise.politician_name} - ${promise.promise_title?.substring(0, 50)}`);

    const result = await classifyPromise(id);

    if (!result) {
      return res.status(500).json({ error: "Erro ao classificar promessa" });
    }

    await applyScore(id, result);

    cacheInvalidate("ranking");

    res.json({
      promise_id: id,
      ...result,
      message: "ClassificaÃ§Ã£o aplicada com sucesso",
    });
  } catch (err: any) {
    console.error("[Score API] Error:", err);
    res.status(500).json({ error: err.message });
  }
}));

router.post("/batch", checkAdmin, asyncHandler(async (_req: Request, res: Response) => {
  try {
    console.log("[Score] Starting batch classification...");

    const result = await batchClassify();

    console.log(`[Score] Batch complete:`, result);

    cacheInvalidate("ranking");

    res.json({
      ...result,
      message: "ClassificaÃ§Ã£o em lote concluÃ­da",
    });
  } catch (err: any) {
    console.error("[Score API] Batch error:", err);
    res.status(500).json({ error: err.message });
  }
}));

router.get("/criteria", asyncHandler(async (_req: Request, res: Response) => {
  try {
    const criteria = getCriteria();
    res.json(criteria);
  } catch (err: any) {
    console.error("[Score API] Criteria error:", err);
    res.status(500).json({ error: err.message });
  }
}));

router.get("/stats", checkAdmin, asyncHandler(async (_req: Request, res: Response) => {
  try {
    const { data: promises } = await supabase.from("promises").select("status");

    const stats = {
      total: promises?.length || 0,
      cumprir: promises?.filter(p => p.status === "cumprida").length || 0,
      parcialmente_cumprida: promises?.filter(p => p.status === "parcialmente_cumprida").length || 0,
      em_andamento: promises?.filter(p => p.status === "em_andamento").length || 0,
      nao_iniciada: promises?.filter(p => p.status === "nao_iniciada").length || 0,
      descumprida: promises?.filter(p => p.status === "descumprida").length || 0,
      nao_classificada: promises?.filter(p => p.status === "nao_classificada" || !p.status).length || 0,
    };

    res.json(stats);
  } catch (err: any) {
    console.error("[Score API] Stats error:", err);
    res.status(500).json({ error: err.message });
  }
}));

router.get("/explanation/:id", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const explanation = await getExplanation(id);

    if (!explanation) {
      return res.status(404).json({ error: "ExplicaÃ§Ã£o nÃ£o encontrada" });
    }

    res.json(explanation);
  } catch (err: any) {
    console.error("[Score API] Explanation error:", err);
    res.status(500).json({ error: err.message });
  }
}));

export default router;