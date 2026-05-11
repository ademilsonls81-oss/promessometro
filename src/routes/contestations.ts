import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";

const router = Router();

interface ContestationsFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { promise_id, nome_contestante, email_contestante, motivo, evidencia_url } = req.body;

    if (!promise_id || !nome_contestante || !motivo) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: promise_id, nome_contestante, motivo" 
      });
    }

    const { data: promise, error: promiseError } = await supabase
      .from("promises")
      .select("id")
      .eq("id", promise_id)
      .single();

    if (promiseError || !promise) {
      return res.status(404).json({ error: "Promessa não encontrada" });
    }

    const { data, error } = await supabase
      .from("promise_contestations")
      .insert({
        promise_id,
        nome_contestante: nome_contestante.trim(),
        email_contestante: email_contestante?.trim() || null,
        motivo: motivo.trim(),
        evidencia_url: evidencia_url?.trim() || null,
        status: "pendente"
      })
      .select()
      .single();

    if (error) {
      console.error("[Contestations] Insert error:", error);
      return res.status(500).json({ error: "Erro ao submeter contestação" });
    }

    return res.status(201).json({ 
      success: true, 
      message: "Contestação registrada com sucesso! Nossa equipe vai analisar.",
      data 
    });
  } catch (err: any) {
    console.error("[Contestations] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query as unknown as ContestationsFilters;

    let query = supabase
      .from("promise_contestations")
      .select(`
        *,
        promises!inner(
          id,
          promise_title,
          politician_name
        )
      `, { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query
      .order("criado_em", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      console.error("[Contestations] Fetch error:", error);
      return res.status(500).json({ error: error.message });
    }

    const formatted = (data || []).map((c: any) => ({
      id: c.id,
      promise_id: c.promise_id,
      promise_title: c.promises?.promise_title,
      politician_name: c.promises?.politician_name,
      nome_contestante: c.nome_contestante,
      email_contestante: c.email_contestante,
      motivo: c.motivo,
      evidencia_url: c.evidencia_url,
      status: c.status,
      resposta_editorial: c.resposta_editorial,
      criado_em: c.criado_em,
      respondido_em: c.respondido_em
    }));

    return res.json({ contestations: formatted, total: count });
  } catch (err: any) {
    console.error("[Contestations] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/public/:promiseId", async (req: Request, res: Response) => {
  try {
    const { promiseId } = req.params;

    const { data, error } = await supabase
      .from("promise_contestations")
      .select("*")
      .eq("promise_id", promiseId)
      .eq("status", "aceita")
      .order("criado_em", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ contestations: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, resposta_editorial } = req.body;

    if (!status || !["pendente", "em_analise", "aceita", "rejeitada"].includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const updateData: any = {
      status,
      atualizado_em: new Date().toISOString()
    };

    if (status !== "pendente" && status !== "em_analise") {
      updateData.respondido_em = new Date().toISOString();
    }

    if (resposta_editorial) {
      updateData.resposta_editorial = resposta_editorial.trim();
    }

    const { data, error } = await supabase
      .from("promise_contestations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Contestação não encontrada" });
    }

    console.log(`[Contestations] Updated ${id} to ${status}`);
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { count: pending } = await supabase
      .from("promise_contestations")
      .select("*", { count: "exact", head: true })
      .eq("status", "pendente");

    const { count: analyzing } = await supabase
      .from("promise_contestations")
      .select("*", { count: "exact", head: true })
      .eq("status", "em_analise");

    const { count: accepted } = await supabase
      .from("promise_contestations")
      .select("*", { count: "exact", head: true })
      .eq("status", "aceita");

    const { count: rejected } = await supabase
      .from("promise_contestations")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejeitada");

    return res.json({
      total: (pending || 0) + (analyzing || 0) + (accepted || 0) + (rejected || 0),
      pendente: pending || 0,
      em_analise: analyzing || 0,
      aceita: accepted || 0,
      rejeitada: rejected || 0
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;