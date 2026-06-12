import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { uploadEvidence } from "../services/snapshotService.js";
import { logSystemError } from "../middleware/auditLog.js";

import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const MAX_SIZE = 10 * 1024 * 1024;

router.post("/evidence", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { promise_id, url, description } = req.body;

    if (!promise_id) {
      return res.status(400).json({ error: "promise_id Ã© obrigatÃ³rio" });
    }

    if (!url && !req.body.base64) {
      return res.status(400).json({ error: "URL ou arquivo Ã© obrigatÃ³rio" });
    }

    if (url) {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return res.status(400).json({ error: "URL invÃ¡lida" });
      }

      const { data, error } = await supabase.from("promise_evidences").insert({
        promise_id,
        evidencia_url: url,
        descricao: description || null,
        source_type: "manual",
        status: "pendente"
      }).select().single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.body.base64) {
      const base64Data = req.body.base64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const mimeType = req.body.mime_type || "application/octet-stream";

      const result = await uploadEvidence(buffer, req.body.file_name || "evidence.bin", mimeType, promise_id);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      const { data, error: insertError } = await supabase.from("promise_evidences").insert({
        promise_id,
        evidencia_url: result.url,
        descricao: description || null,
        source_type: "upload",
        status: "pendente"
      }).select().single();

      if (insertError) throw insertError;
      return res.status(201).json(data);
    }
  } catch (err) {  // any-ok
    await logSystemError("evidence_upload", "api", err.message, err.stack, "low");
    res.status(500).json({ error: err.message });
  }
}));

router.get("/evidence/:promiseId", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("promise_evidences")
      .select("*")
      .eq("promise_id", req.params.promiseId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ evidences: data });
  } catch (err) {  // any-ok
    res.status(500).json({ error: err.message });
  }
}));

export default router;