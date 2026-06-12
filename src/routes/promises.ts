import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { apiKeyRateLimit } from "../middleware/rateLimit.js";
import { fetchPoliticianPhoto } from "../services/politicianPhotoService.js";
import { autoSearchAndSaveForPromise } from "../services/evidenceService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

export interface PromiseSubmission {
  politician_name: string;
  promise_title: string;
  promise_description?: string;
  category?: string;
  source_link?: string;
}

router.post("/submit", apiKeyRateLimit, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { politician_name, promise_title, promise_description, category, source_link } = req.body;

    if (!politician_name || !promise_title) {
      return res.status(400).json({ error: "Nome do polÃ­tico e tÃ­tulo da promessa sÃ£o obrigatÃ³rios" });
    }

    const { data, error } = await supabase.from("promises").insert({
      politician_name: politician_name.trim(),
      promise_title: promise_title.trim(),
      promise_description: promise_description?.trim() || null,
      category: category || "Outros",
      source_link: source_link || null,
      status: "pendente",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).select().single();

    // Classification automÃ¡tica via IA
    setTimeout(async () => {
      try {
        const { classifyPromise } = await import("../services/promiseAiClassification.js");
        await classifyPromise(data.id);
      } catch (err) {
        console.error("[Promise] Classification error:", err);
      }
    }, 1000);

    if (error) {
      console.error("Promise submission error:", error);
      return res.status(500).json({ error: "Erro ao submeter promessa" });
    }

    console.log(`[Promise] Nova promessa reportada: ${promise_title} - ${politician_name}`);

    setTimeout(async () => {
      try {
        console.log(`[Promise] Starting auto-evidence search for: ${data.id}`);
        const savedCount = await autoSearchAndSaveForPromise(data.id);
        console.log(`[Promise] Auto-search found ${savedCount} evidences`);
      } catch (err) {
        console.error(`[Promise] Auto-search failed:`, err);
      }
    }, 2000);

    return res.status(201).json({ 
      success: true, 
      message: "Promessa registrada com sucesso! Nossa equipe vai analisar.",
      data 
    });
  } catch (err) {  // any-ok
    console.error("Submit promise error:", err);
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/photo/:name", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    if (!name) return res.status(400).json({ error: "Nome Ã© obrigatÃ³rio" });

    const result = await fetchPoliticianPhoto(decodeURIComponent(name));
    return res.json(result);
  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("promises")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Promessa nÃ£o encontrada" });
    }

    return res.json(data);
  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { status, politician, category, limit = 20, offset = 0 } = req.query;
    
    let query = supabase.from("promises").select("*", { count: "exact" });
    
    if (status) query = query.eq("status", status);
    if (politician) query = query.ilike("politician_name", `%${politician}%`);
    if (category) query = query.eq("category", category);
    
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const uniqueNames = [...new Set((data || []).map((p: any) => p.politician_name))] as string[];  // any-ok
    const photoResults = await Promise.allSettled(uniqueNames.map(name => fetchPoliticianPhoto(name)));
    const photoMap: Record<string, string | null> = {};
    photoResults.forEach((result, i) => {
      photoMap[uniqueNames[i]] = result.status === "fulfilled" ? (result.value as any).photoUrl : null;
    });

    const promisesWithPhotos = (data || []).map((p: any) => ({  // any-ok
      ...p,
      photo_url: photoMap[p.politician_name] || null
    }));

    return res.json({ promises: promisesWithPhotos, total: count });
  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

router.patch("/:id/status", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, evidence } = req.body;

    if (!status || !["pendente", "parcial", "cumprida", "quebrada"].includes(status)) {
      return res.status(400).json({ error: "Status invÃ¡lido" });
    }

    const { data, error } = await supabase
      .from("promises")
      .update({ 
        status, 
        evidence: evidence || null,
        updated_at: new Date().toISOString() 
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Promessa nÃ£o encontrada" });
    }

    console.log(`[Promise] Status atualizado: ${id} -> ${status}`);
    return res.json({ success: true, data });
  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

// Classificar promessa especÃ­fica
router.post("/classify/:id", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: promise, error } = await supabase
      .from("promises")
      .select("id")
      .eq("id", id)
      .single();

    if (error || !promise) {
      return res.status(404).json({ error: "Promessa nÃ£o encontrada" });
    }

    const { classifyPromise } = await import("../services/promiseAiClassification.js");
    const success = await classifyPromise(id);

    if (success) {
      return res.json({ success: true, message: "Promessa classificada" });
    } else {
      return res.status(500).json({ error: "Erro ao classificar promessa" });
    }
  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

// Classificar todas as promessas pendentes
router.post("/classify-all", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { classifyAllPending } = await import("../services/promiseAiClassification.js");
    const count = await classifyAllPending();

    return res.json({ success: true, classified: count });
  } catch (err) {  // any-ok
    return res.status(500).json({ error: err.message });
  }
}));

export default router;