import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { apiKeyRateLimit } from "../middleware/rateLimit.js";

const router = Router();

export interface PromiseSubmission {
  politician_name: string;
  promise_title: string;
  promise_description?: string;
  category?: string;
  source_link?: string;
  reported_by?: string;
}

router.post("/submit", apiKeyRateLimit, async (req: Request, res: Response) => {
  try {
    const { politician_name, promise_title, promise_description, category, source_link, reported_by } = req.body;

    if (!politician_name || !promise_title) {
      return res.status(400).json({ error: "Nome do político e título da promessa são obrigatórios" });
    }

    const { data, error } = await supabase.from("promises").insert({
      politician_name: politician_name.trim(),
      promise_title: promise_title.trim(),
      promise_description: promise_description?.trim() || null,
      category: category || "Outros",
      source_link: source_link || null,
      reported_by: reported_by || null,
      status: "pending_analysis",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).select().single();

    if (error) {
      console.error("Promise submission error:", error);
      return res.status(500).json({ error: "Erro ao submeter promessa" });
    }

    console.log(`[Promise] Nova promessa reportada: ${promise_title} - ${politician_name}`);
    return res.status(201).json({ 
      success: true, 
      message: "Promessa registrada com sucesso! Nossa equipe vai analisar.",
      data 
    });
  } catch (err: any) {
    console.error("Submit promise error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("promises")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Promessa não encontrada" });
    }

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req: Request, res: Response) => {
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

    return res.json({ promises: data, total: count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, evidence } = req.body;

    if (!status || !["pending_analysis", "verified", "rejected", "fulfilled", "broken", "partial"].includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
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
      return res.status(404).json({ error: "Promessa não encontrada" });
    }

    console.log(`[Promise] Status atualizado: ${id} -> ${status}`);
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;