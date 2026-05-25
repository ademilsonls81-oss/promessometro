import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { checkAdmin } from "../middleware/auth.js";
import { searchEvidenceForPromise, saveEvidence, autoSearchAndSaveForPromise, verifyEvidenceIntegrity, logValidation } from "../services/evidenceService.js";
import { autoCategorizePromise } from "../services/promiseCategorization.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/search/:promiseId", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { promiseId } = req.params;

    const { data: promise, error: promiseError } = await supabase
      .from("promises")
      .select("*")
      .eq("id", promiseId)
      .single();

    if (promiseError || !promise) {
      return res.status(404).json({ error: "Promessa nÃ£o encontrada" });
    }

    console.log(`[Evidence API] Searching evidences for: ${promise.politician_name} - ${promise.promise_title.substring(0, 50)}`);

    const evidences = await searchEvidenceForPromise({
      promiseTitle: promise.promise_title,
      promiseDescription: promise.promise_description || undefined,
      politicianName: promise.politician_name,
      category: promise.category || undefined
    });

    return res.json({
      promise_id: promiseId,
      evidences_found: evidences.length,
      evidences
    });
  } catch (err: any) {
    console.error("[Evidence API] Search error:", err);
    return res.status(500).json({ error: err.message });
  }
}));

router.post("/save/:promiseId", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { promiseId } = req.params;
    const { evidence } = req.body;

    if (!evidence) {
      return res.status(400).json({ error: "EvidÃªncia Ã© obrigatÃ³ria" });
    }

    const savedId = await saveEvidence(promiseId, evidence);

    if (!savedId) {
      return res.status(500).json({ error: "Erro ao salvar evidÃªncia" });
    }

    return res.json({ success: true, evidence_id: savedId });
  } catch (err: any) {
    console.error("[Evidence API] Save error:", err);
    return res.status(500).json({ error: err.message });
  }
}));

router.post("/auto-search/:promiseId", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { promiseId } = req.params;

    console.log(`[Evidence API] Auto-search for promise: ${promiseId}`);

    const savedCount = await autoSearchAndSaveForPromise(promiseId);

    return res.json({
      promise_id: promiseId,
      evidences_saved: savedCount,
      message: `${savedCount} evidÃªncias encontradas e salvas`
    });
  } catch (err: any) {
    console.error("[Evidence API] Auto-search error:", err);
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/promise/:promiseId", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { promiseId } = req.params;
    const { status, type } = req.query;

    let query = supabase
      .from("promise_evidences")
      .select("*")
      .eq("promise_id", promiseId)
      .order("confidence_score", { ascending: false });

    if (status) {
      query = query.eq("validation_status", status);
    }
    if (type) {
      query = query.eq("evidence_type", type);
    }

    const { data: evidences, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ evidences: evidences || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}));

router.patch("/:evidenceId/validate", checkAdmin, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const { status, notes } = req.body;
    const userId = req.headers["x-user-id"] as string;

    if (!["approved", "rejected", "disputed"].includes(status)) {
      return res.status(400).json({ error: "Status invÃ¡lido" });
    }

    const { data: evidence, error: fetchError } = await supabase
      .from("promise_evidences")
      .select("validation_status")
      .eq("id", evidenceId)
      .single();

    if (fetchError || !evidence) {
      return res.status(404).json({ error: "EvidÃªncia nÃ£o encontrada" });
    }

    const previousStatus = evidence.validation_status;

    const { error } = await supabase
      .from("promise_evidences")
      .update({
        validation_status: status,
        validated_by: userId,
        validated_at: new Date().toISOString(),
        validation_notes: notes || null
      })
      .eq("id", evidenceId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    await logValidation(evidenceId, `status_change_${status}`, userId, notes);

    if (status === "approved") {
      await verifyEvidenceIntegrity(evidenceId);
      
      const { data: evidence } = await supabase
        .from("promise_evidences")
        .select("promise_id")
        .eq("id", evidenceId)
        .single();
        
      if (evidence?.promise_id) {
        const categorization = await autoCategorizePromise(evidence.promise_id);
        if (categorization && categorization.currentStatus !== categorization.newStatus) {
          console.log(`[Evidence API] Promise auto-categorized: ${categorization.newStatus}`);
        }
      }
    }

    return res.json({ success: true, message: `EvidÃªncia ${status}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}));

router.post("/verify/:evidenceId", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;

    const verified = await verifyEvidenceIntegrity(evidenceId);

    return res.json({ 
      verified, 
      evidence_id: evidenceId,
      integrity_checked: verified 
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { promise_id, status, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from("promise_evidences")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (promise_id) {
      query = query.eq("promise_id", promise_id);
    }
    if (status) {
      query = query.eq("validation_status", status);
    }

    const { data: evidences, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ evidences: evidences || [], total: count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/sources", asyncHandler(async (_req: Request, res: Response) => {
  try {
    const { data: sources } = await supabase
      .from("trusted_sources")
      .select("*")
      .eq("is_active", true)
      .order("credibility_score", { ascending: false });

    return res.json({ sources: sources || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}));

router.post("/dispute/:evidenceId", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const { disputed_by, dispute_reason, counter_evidence_links } = req.body;

    if (!disputed_by || !dispute_reason) {
      return res.status(400).json({ error: "Campos obrigatÃ³rios: disputed_by, dispute_reason" });
    }

    const { data, error } = await supabase.from("evidence_disputes").insert({
      evidence_id: evidenceId,
      disputed_by,
      dispute_reason,
      counter_evidence_links: counter_evidence_links || null,
      status: "open",
      created_at: new Date().toISOString()
    }).select().single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    await supabase
      .from("promise_evidences")
      .update({ validation_status: "disputed" })
      .eq("id", evidenceId);

    return res.json({ success: true, dispute: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/disputes", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { evidence_id, status } = req.query;

    let query = supabase
      .from("evidence_disputes")
      .select("*")
      .order("created_at", { ascending: false });

    if (evidence_id) {
      query = query.eq("evidence_id", evidence_id);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data: disputes, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ disputes: disputes || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}));

export default router;