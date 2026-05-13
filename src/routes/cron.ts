import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { logSystemError } from "../middleware/auditLog.js";

const router = Router();

function getClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : (forwarded as string).split(",")[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function requireCronSecret(req: Request, res: Response): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/daily-reavaliation", async (req: Request, res: Response) => {
  if (!requireCronSecret(req, res)) return;
  await runDailyReavaliation(res);
});

router.post("/daily-reavaliation", async (req: Request, res: Response) => {
  if (!requireCronSecret(req, res)) return;
  await runDailyReavaliation(res);
});

async function runDailyReavaliation(res: Response) {
  try {
    console.log("[Cron] Daily reavaliation started");
    const { data: promises } = await supabase
      .from("promises")
      .select("id, promise_title, promise_description, politician_name, category, status, fulfillment_score")
      .in("status", ["em_andamento", "parcialmente_cumprida", "nao_classificada", "nao_iniciada"])
      .gt("updated_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    let evaluated = 0;
    let failed = 0;

    if (!promises || promises.length === 0) {
      console.log("[Cron] No promises to reavaliate");
      res.json({ status: "ok", promises_evaluated: 0, promises_failed: 0, timestamp: new Date().toISOString() });
      return;
    }

    const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[Cron] GROQ_API_KEY not configured — aborting reavaliation");
      res.status(500).json({ error: "GROQ_API_KEY not configured" });
      return;
    }
    const { evaluatePromise, saveEvaluation } = await import("../services/aiEvaluator.js");

    for (const promise of promises) {
      try {
        const result = await evaluatePromise(promise as any, true);
        const saved = await saveEvaluation(promise.id, result, result.needsHumanReview);
        if (saved.success) evaluated++;
        else failed++;
      } catch (e: any) {
        console.error(`[Cron] Failed to evaluate promise ${promise.id}:`, e.message);
        failed++;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    res.json({
      status: "ok",
      promises_evaluated: evaluated,
      promises_failed: failed,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    await logSystemError("cron_reavaliation", "cron", err.message, err.stack, "medium");
    res.status(500).json({ error: err.message });
  }
}

router.get("/update-stats", async (req: Request, res: Response) => {
  if (!requireCronSecret(req, res)) return;
  try {
    console.log("[Cron] Stats update started");

    const { count: totalPromises } = await supabase
      .from("promises")
      .select("*", { count: "exact", head: true });

    const { count: totalPoliticians } = await supabase
      .from("promises")
      .select("politician_name", { count: "exact", head: true });

    const { count: pendingContestations } = await supabase
      .from("promise_contestations")
      .select("*", { count: "exact", head: true })
      .eq("status", "pendente");

    await supabase.from("system_metrics").upsert({
      metric_key: "daily_stats",
      metric_value: {
        total_promises: totalPromises,
        total_politicians: totalPoliticians,
        pending_contestations: pendingContestations,
        updated_at: new Date().toISOString()
      }
    }, { onConflict: "metric_key" });

    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (err: any) {
    await logSystemError("cron_stats", "cron", err.message, err.stack, "medium");
    res.status(500).json({ error: err.message });
  }
});

router.get("/backup-export", async (req: Request, res: Response) => {
  if (!requireCronSecret(req, res)) return;
  try {
    console.log("[Cron] Backup export started");

    const tables = ["promises", "politicians", "promise_contestations", "promise_evidences", "promise_explanations"];
    const backupData: Record<string, any[]> = {};
    const errors: string[] = [];

    for (const table of tables) {
      try {
        const { data } = await supabase.from(table).select("*");
        backupData[table] = data || [];
      } catch (e: any) {
        errors.push(`${table}: ${e.message}`);
      }
    }

    const backupFileName = `backup_${new Date().toISOString().split("T")[0]}.json`;
    const backupContent = JSON.stringify({
      exported_at: new Date().toISOString(),
      tables,
      data: backupData
    });

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(backupFileName, backupContent, {
        contentType: "application/json",
        upsert: true
      });

    if (uploadError) {
      await logSystemError("cron_backup", "cron", `Upload failed: ${uploadError.message}`, "", "high");
      res.status(500).json({ error: `Backup upload failed: ${uploadError.message}`, errors });
      return;
    }

    await supabase.storage
      .from("backups")
      .remove(await getOldBackups());

    console.log(`[Cron] Backup exported: ${backupFileName}`);
    res.json({ status: "ok", file: backupFileName, tables_exported: tables.length, errors, timestamp: new Date().toISOString() });
  } catch (err: any) {
    await logSystemError("cron_backup", "cron", err.message, err.stack, "critical");
    res.status(500).json({ error: err.message });
  }
});

async function getOldBackups(): Promise<string[]> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: files } = await supabase.storage.from("backups").list();
    return (files || [])
      .filter(f => f.created_at && f.created_at < thirtyDaysAgo)
      .map(f => f.name);
  } catch {
    return [];
  }
}

router.get("/process-evidences", async (req: Request, res: Response) => {
  if (!requireCronSecret(req, res)) return;
  try {
    console.log("[Cron] Evidence processing started");

    const { data: unprocessed } = await supabase
      .from("promise_evidences")
      .select("id, evidencia_url, promise_id")
      .eq("status", "pendente")
      .limit(50);

    let processed = 0;
    for (const evidence of unprocessed || []) {
      const isValid = evidence.evidencia_url && (
        evidence.evidencia_url.startsWith("http://") ||
        evidence.evidencia_url.startsWith("https://")
      );

      await supabase
        .from("promise_evidences")
        .update({ status: isValid ? "validada" : "rejeitada" })
        .eq("id", evidence.id);

      processed++;
    }

    console.log(`[Cron] Evidence processing complete: ${processed} processed`);
    res.json({ status: "ok", processed, timestamp: new Date().toISOString() });
  } catch (err: any) {
    await logSystemError("cron_evidence", "cron", err.message, err.stack, "medium");
    res.status(500).json({ error: err.message });
  }
});

router.get("/politician-ranking", async (req: Request, res: Response) => {
  if (!requireCronSecret(req, res)) return;
  try {
    console.log("[Cron] Politician ranking snapshot started");

    const { data: ranking } = await supabase
      .from("promises")
      .select("politician_name, status, fulfillment_score")
      .not("politician_name", "is", null);

    const stats: Record<string, { total: number; score_sum: number; by_status: Record<string, number> }> = {};
    ranking?.forEach((p: any) => {
      const name = p.politician_name;
      if (!stats[name]) stats[name] = { total: 0, score_sum: 0, by_status: {} };
      stats[name].total++;
      if (p.fulfillment_score) stats[name].score_sum += p.fulfillment_score;
      stats[name].by_status[p.status] = (stats[name].by_status[p.status] || 0) + 1;
    });

    const snapshot = Object.entries(stats)
      .map(([name, s]) => ({ name, total: s.total, avg_score: s.total > 0 ? Math.round(s.score_sum / s.total) : 0, by_status: s.by_status }))
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 100);

    const fileName = `ranking_snapshot_${new Date().toISOString().split("T")[0]}.json`;
    await supabase.storage
      .from("backups")
      .upload(fileName, JSON.stringify({ snapshot_at: new Date().toISOString(), ranking: snapshot }), {
        contentType: "application/json",
        upsert: true
      });

    res.json({ status: "ok", politicians: snapshot.length, file: fileName, timestamp: new Date().toISOString() });
  } catch (err: any) {
    await logSystemError("cron_ranking", "cron", err.message, err.stack, "low");
    res.status(500).json({ error: err.message });
  }
});

export default router;