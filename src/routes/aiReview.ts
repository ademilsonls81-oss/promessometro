import { Router, Request, Response } from "express";
import { checkAdmin } from "../middleware/auth.js";
import { getPendingReviews, approveEvaluation } from "../services/aiEvaluator.js";
import { supabase } from "../lib/supabase.js";
import { validateBody } from "../middleware/security.js";
import { z } from "zod";

import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const reviewSchema = z.object({
  explanation_id: z.string().uuid(),
  action: z.enum(["approve", "reject", "recalculate"]),
  notes: z.string().optional()
});

router.get("/ai-review", checkAdmin, asyncHandler(async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const confiancaMax = req.query.confianca_max ? parseFloat(req.query.confianca_max as string) : 0.4;

    const { data, error, count } = await supabase
      .from("promise_explanations")
      .select(`
        id,
        promise_id,
        status,
        fulfillment_score,
        confianca,
        justificativa,
        o_que_falta,
        o_que_foi_feito,
        evidencias_usadas,
        modelo_ia,
        gerado_em,
        revisado_em,
        revisado_por,
        is_latest,
        promises:promises(id, promise_title, politician_name, category)
      `, { count: "exact" })
      .eq("is_latest", true)
      .lt("confianca", confiancaMax)
      .order("gerado_em", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      reviews: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (err) {  // any-ok
    res.status(500).json({ error: err.message });
  }
}));

router.post("/ai-review/action", checkAdmin, validateBody(reviewSchema), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { explanation_id, action, notes } = req.body;
    const reviewerId = (req as any).user.id;

    if (action === "approve") {
      const success = await approveEvaluation(explanation_id, reviewerId, notes);
      if (!success) return res.status(404).json({ error: "ExplicaÃ§Ã£o nÃ£o encontrada" });

      const { data: exp } = await supabase
        .from("promise_explanations")
        .select("promise_id")
        .eq("id", explanation_id)
        .single();

      if (exp) {
        const { data: latest } = await supabase
          .from("promise_explanations")
          .select("*")
          .eq("promise_id", exp.promise_id)
          .eq("is_latest", true)
          .single();

        if (latest) {
          await supabase.from("promises").update({
            status: latest.status,
            fulfillment_score: latest.fulfillment_score
          }).eq("id", exp.promise_id);
        }
      }

      res.json({ success: true, message: "AvaliaÃ§Ã£o aprovada e publicada" });
    } else if (action === "recalculate") {
      const { evaluatePromise, saveEvaluation } = await import("../services/aiEvaluator.js");

      const { data: exp } = await supabase
        .from("promise_explanations")
        .select("promise_id")
        .eq("id", explanation_id)
        .single();

      if (!exp) return res.status(404).json({ error: "ExplicaÃ§Ã£o nÃ£o encontrada" });

      const { data: promise } = await supabase
        .from("promises")
        .select("*")
        .eq("id", exp.promise_id)
        .single();

      if (!promise) return res.status(404).json({ error: "Promessa nÃ£o encontrada" });

      const result = await evaluatePromise(promise, true);
      const saveResult = await saveEvaluation(exp.promise_id, result, result.needsHumanReview, reviewerId);

      res.json({
        success: true,
        message: "ReavaliaÃ§Ã£o iniciada",
        needs_human_review: saveResult.requiresHumanReview,
        new_confianca: result.confianca
      });
    } else {
      res.status(400).json({ error: "AÃ§Ã£o nÃ£o reconhecida" });
    }
  } catch (err) {  // any-ok
    res.status(500).json({ error: err.message });
  }
}));

router.get("/ai-review/stats", checkAdmin, asyncHandler(async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [lowConf, totalToday, reviewedToday, byStatus] = await Promise.all([
      supabase.from("promise_explanations").select("*", { count: "exact", head: true }).eq("is_latest", true).lt("confianca", 0.4),
      supabase.from("promise_explanations").select("*", { count: "exact", head: true }).gte("gerado_em", today.toISOString()),
      supabase.from("promise_explanations").select("*", { count: "exact", head: true }).gte("revisado_em", today.toISOString()).not("revisado_por", "is", null),
      supabase.from("promise_explanations").select("status", { count: "exact", head: true }).eq("is_latest", true).lt("confianca", 0.4)
    ]);

    res.json({
      pending_review: lowConf.count || 0,
      generated_today: totalToday.count || 0,
      reviewed_today: reviewedToday.count || 0,
      confidence_distribution: {
        low: 0,
        medium: 0,
        high: 0
      }
    });
  } catch (err) {  // any-ok
    res.status(500).json({ error: err.message });
  }
}));

export default router;