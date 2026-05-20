import { Router } from "express";
import { checkAdmin } from "../middleware/auth.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

// POST /api/admin/start-discovery-job — cria job discovery
router.post("/start-discovery-job", checkAdmin, async (req, res) => {
  try {
    const { politician_id, politician_name, role, state, party } = req.body;
    if (!politician_id) return res.status(400).json({ error: "politician_id obrigatório" });

    // Auto-migrate
    const sql = `CREATE TABLE IF NOT EXISTS discovery_jobs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      politician_id UUID, politician_name TEXT, cargo TEXT, role TEXT,
      state TEXT, party TEXT, status TEXT DEFAULT 'pending',
      pdf_url TEXT, pdf_text TEXT, total_extraidas INT DEFAULT 0,
      total_inseridas INT DEFAULT 0, erro TEXT,
      started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    ); ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'pending';
    ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
    ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS pdf_source_url TEXT;
    ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS current_page INT DEFAULT 0;
    ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS total_pages INT DEFAULT 0;
    ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS chunks_processed INT DEFAULT 0;
    ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS partial_promises JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS last_processed_chunk TEXT;
    ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS last_checkpoint_at TIMESTAMPTZ;
    SELECT 1; NOTIFY pgrst, 'reload schema'; SELECT 1;`;
    try { await supabase.rpc("exec_sql", { sql }); } catch (e) { console.error("migrate error:", e); }
    await new Promise(r => setTimeout(r, 500));

    const { data: job, error } = await supabase.from("discovery_jobs").insert({
      politician_id, politician_name, role, state, party,
      cargo: ["governador","presidente","prefeito","senador"].includes((role||"").toLowerCase()) ? "majoritario" : "proporcional",
      status: "pending"
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      job_id: job.id,
      status: "pending",
      stage: "criado",
      progress: 0,
      total_extraidas: 0,
      total_inseridas: 0,
      message: "Job criado! Aguardando processamento incremental..."
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/discovery-status/:jobId
router.get("/discovery-status/:jobId", checkAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { data: job } = await supabase.from("discovery_jobs")
      .select("id, status, stage, progress, total_extraidas, total_inseridas, erro, current_page, total_pages, partial_promises, last_checkpoint_at")
      .eq("id", jobId).single();
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    let lastPromises: any[] = [];
    try {
      const all = typeof job.partial_promises === "string"
        ? JSON.parse(job.partial_promises) : (job.partial_promises || []);
      lastPromises = Array.isArray(all) ? all.slice(-10) : [];
    } catch { lastPromises = []; }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.json({ ...job, partial_promises: undefined, last_promises: lastPromises });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/discovery-run-now
router.post("/discovery-run-now", checkAdmin, async (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: "job_id obrigatório" });

    const { default: processor } = await import("../../api/cron/discovery-processor.js");
    const specificReq = { ...req, _specificJobId: job_id };
    let processorRes: any;
    try {
      await processor(specificReq, {
        json: (data: any) => { processorRes = data; },
        status: () => ({ json: (data: any) => { processorRes = data; } })
      });
    } catch (e: any) {
      console.error("[discovery-run-now] error:", e.message);
    }
    const { data: job } = await supabase.from("discovery_jobs").select("*").eq("id", job_id).single();
    let lastPromises: any[] = [];
    try {
      const all = typeof job?.partial_promises === "string"
        ? JSON.parse(job.partial_promises) : (job?.partial_promises || []);
      lastPromises = Array.isArray(all) ? all.slice(-10) : [];
    } catch { lastPromises = []; }
    return res.json({ ...(job || {}), partial_promises: undefined, last_promises: lastPromises });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
