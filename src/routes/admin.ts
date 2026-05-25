import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { checkAdmin } from "../middleware/auth.js";
import { queueService } from "../services/queueService.js";
import { runIngestion } from "../services/ingestionService.js";
import { logAuditAction } from "../middleware/auditLog.js";
import rateLimit from "express-rate-limit";
import { execSync } from "child_process";
import { sanitizeInput } from "../middleware/security.js";

// Rate limiter para endpoints admin: 5 req/min por IP

// Rate limiter para endpoints admin: 5 req/min por IP
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many admin requests — try again in 1 minute" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown",
});

const router = Router();

router.use((req: any, _res: any, next: any) => {
  if (req.body && Object.keys(req.body).length > 0) {
    req.body = sanitizeInput(req.body);
  }
  next();
});

// Aplicar rate limiter em TODAS as rotas admin
router.use(adminRateLimit);

// Helpers (referenciados pelas rotas)
declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string };
  }
}

function cacheInvalidate(pattern?: string) {
  // Re-export simplificado — o cache vive no server.ts
  // Aqui apenas sinalizamos via broadcast
}

function broadcastWsUpdate(_data: any) {
  // Placeholder — será chamado via server.ts
}

// GET /api/admin/posts
router.get("/posts", checkAdmin, async (req, res) => {
  const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/admin/process-batch
router.post("/process-batch", checkAdmin, async (req, res) => {
  const { data: pending } = await supabase.from("posts").select("id").eq("status", "pending").limit(50);
  if (!pending?.length) return res.json({ message: "No pending posts" });

  queueService.addTasks(pending.map(p => p.id));
  logAuditAction((req as any).user.id, "PROCESS_BATCH_MANUAL", req, { count: pending.length });
  res.json({ message: `Queueing ${pending.length} posts` });
});

// POST /api/admin/ingest - Manual RSS sync
router.post("/ingest", checkAdmin, async (req, res) => {
  try {
    const count = await runIngestion();
    logAuditAction((req as any).user.id, "MANUAL_INGESTION", req, { count });
    res.json({ message: `Ingestion complete. Found ${count} new items.`, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/feeds
router.post("/feeds", checkAdmin, async (req, res) => {
  const { name, url, category } = req.body;
  const { data, error } = await supabase.from("feeds").insert({ name, url, category }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  logAuditAction((req as any).user.id, "ADD_FEED", req, { name, url });
  res.json(data);
});

// GET /api/admin/feeds/summary
router.get("/feeds/summary", checkAdmin, async (req, res) => {
  try {
    const { data: feeds } = await supabase.from("feeds").select("id, name, url, category").eq("active", true).order("category");
    const { data: posts } = await supabase.from("posts").select("category, status").eq("status", "published");

    const feedByCategory: Record<string, number> = {};
    feeds?.forEach(f => { const cat = f.category || "Uncategorized"; feedByCategory[cat] = (feedByCategory[cat] || 0) + 1; });

    const postByCategory: Record<string, number> = {};
    posts?.forEach(p => { const cat = p.category || "Uncategorized"; postByCategory[cat] = (postByCategory[cat] || 0) + 1; });

    res.json({
      total_feeds: feeds?.length || 0,
      total_published_posts: posts?.length || 0,
      feeds_by_category: feedByCategory,
      posts_by_category: postByCategory,
      feeds: feeds || []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/feeds/health - Health de todos os feeds
router.get("/feeds/health", checkAdmin, async (req, res) => {
  try {
    const { data: feeds } = await supabase.from("feeds").select("*").eq("active", true);
    const { data: health } = await supabase.from("feed_health").select("*");

    const healthMap = new Map((health as any[] || []).map((h: any) => [h.feed_id, h]));

    const enrichedFeeds = (feeds || []).map((feed: any) => {
      const h = healthMap.get(feed.id);
      return {
        ...feed,
        health_score: h?.health_score ?? 50,
        last_status: h?.last_status ?? "unknown",
        last_latency_ms: h?.last_latency_ms,
        last_error: h?.last_error,
        last_checked_at: h?.last_checked_at,
        consecutive_errors: h?.consecutive_errors ?? 0,
        success_count: h?.success_count ?? 0,
        error_count: h?.error_count ?? 0
      };
    }).sort((a: any, b: any) => a.health_score - b.health_score);

    const failed = enrichedFeeds.filter((f: any) => f.last_status === "error" || !f.last_status);
    const healthy = enrichedFeeds.filter((f: any) => f.last_status === "success");
    const unhealthy = enrichedFeeds.filter((f: any) => f.health_score < 50);

    res.json({
      feeds: enrichedFeeds,
      summary: {
        total: enrichedFeeds.length,
        healthy: healthy.length,
        failed: failed.length,
        unhealthy: unhealthy.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/feeds/:id
router.patch("/feeds/:id", checkAdmin, async (req, res) => {
  const { category } = req.body;
  const validCategories = ["Tech", "Finance", "Science", "Health", "General"];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: "Categoria inválida", valid: validCategories });
  }

  const { data, error } = await supabase.from("feeds").update({ category }).eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  logAuditAction((req as any).user.id, "UPDATE_FEED_CATEGORY", req, { feed_id: req.params.id, category });
  res.json(data);
});

// ==========================================
// FASE 11: SYSTEM DASHBOARD ENDPOINTS
// ==========================================

// GET /api/admin/system/status - Status do sistema
router.get("/system/status", checkAdmin, async (_req, res) => {
  try {
    const { count: totalFixes } = await supabase
      .from("auto_fixes")
      .select("*", { count: "exact", head: true })
      .eq("status", "applied");

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentErrorCount } = await supabase
      .from("system_errors")
      .select("*", { count: "exact", head: true })
      .gte("created_at", twentyFourHoursAgo);

    res.json({
      loop_status: { is_running: false, can_execute: false, message: "Sistema autônomo desabilitado" },
      circuit_breaker: { is_active: false, consecutive_failures: 0, threshold: 5, cooldown_ends_at: null, message: "Desabilitado" },
      last_loop_execution: null,
      total_fixes_applied: totalFixes || 0,
      errors_last_24h: recentErrorCount || 0,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/system/errors - Últimos erros do sistema
router.get("/system/errors", checkAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const severity = req.query.severity as string;

    let query = supabase
      .from("system_errors")
      .select("id, error_type, source, message, stack_trace, severity, endpoint, http_status, created_at")
      .order("created_at", { ascending: false });

    if (severity) {
      query = query.eq("severity", severity);
    }

    const { data, error, count } = await supabase
      .from("system_errors")
      .select("id, error_type, source, message, stack_trace, severity, endpoint, http_status, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      errors: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (err: any) {
    console.error("[Admin/System] Error fetching errors:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/system/fixes - Histórico de correções automáticas
router.get("/system/fixes", checkAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    let query = supabase
      .from("auto_fixes")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await supabase
      .from("auto_fixes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      fixes: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (err: any) {
    console.error("[Admin/System] Error fetching fixes:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/system/decisions - Decisões de risco recentes
router.get("/system/decisions", checkAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const riskLevel = req.query.risk_level as string;
    const decision = req.query.decision as string;

    let query = supabase
      .from("risk_decisions")
      .select("*")
      .order("created_at", { ascending: false });

    if (riskLevel) {
      query = query.eq("risk_level", riskLevel);
    }

    if (decision) {
      query = query.eq("decision", decision);
    }

    const { data, error, count } = await supabase
      .from("risk_decisions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      decisions: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (err: any) {
    console.error("[Admin/System] Error fetching decisions:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/system/metrics - Métricas rápidas do dia
router.get("/system/metrics", checkAdmin, async (_req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayISO = startOfDay.toISOString();

    const startOfYesterday = new Date(Date.now() - 48 * 60 * 60 * 1000);
    startOfYesterday.setHours(0, 0, 0, 0);
    const startOfYesterdayISO = startOfYesterday.toISOString();

    // Métricas de hoje
    const [errorsToday, fixesToday, decisionsToday, postsPublished] = await Promise.all([
      supabase.from("system_errors").select("*", { count: "exact", head: true }).gte("created_at", startOfDayISO),
      supabase.from("auto_fixes").select("*", { count: "exact", head: true }).gte("created_at", startOfDayISO),
      supabase.from("risk_decisions").select("*", { count: "exact", head: true }).gte("created_at", startOfDayISO),
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("status", "published").gte("created_at", startOfDayISO)
    ]);

    // Métricas de ontem (para comparação)
    const [errorsYesterday, fixesYesterday] = await Promise.all([
      supabase.from("system_errors").select("*", { count: "exact", head: true }).gte("created_at", startOfYesterdayISO).lt("created_at", startOfDayISO),
      supabase.from("auto_fixes").select("*", { count: "exact", head: true }).gte("created_at", startOfYesterdayISO).lt("created_at", startOfDayISO)
    ]);

    res.json({
      today: {
        errors_detected: errorsToday.count || 0,
        fixes_applied: fixesToday.count || 0,
        risk_decisions: decisionsToday.count || 0,
        posts_published: postsPublished.count || 0
      },
      yesterday: {
        errors_detected: errorsYesterday.count || 0,
        fixes_applied: fixesYesterday.count || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("[Admin/System] Error fetching metrics:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/feeds - Lista todos os feeds
router.get("/feeds", checkAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error, count } = await supabase
      .from("feeds")
      .select("*", { count: "exact" })
      .eq("active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      feeds: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (err: any) {
    console.error("[Admin/Feeds] Error fetching feeds:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users - Lista todos os usuários
router.get("/users", checkAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const plan = req.query.plan as string;

    let query = supabase
      .from("users")
      .select("id, email, plan, usage_count, role, created_at", { count: "exact" })
      .order("created_at", { ascending: false });

    if (plan) {
      query = query.eq("plan", plan);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      users: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (err: any) {
    console.error("[Admin/Users] Error fetching users:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit-logs - Logs de auditoria
router.get("/audit-logs", checkAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const userId = req.query.user_id as string;

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      logs: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (err: any) {
    console.error("[Admin/AuditLogs] Error fetching audit logs:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SYSTEM BACKUP & ROLLBACK (GIT WRAPPER)
// ==========================================

// GET /api/admin/backups - Listar snapshots
router.get("/backups", checkAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("system_snapshots")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/backups/snapshot - Criar novo ponto de restauração
router.post("/backups/snapshot", checkAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const msg = message || `Automatic Snapshot - ${new Date().toISOString()}`;

    // 1. Git Add + Commit
    execSync('git add .');
    try {
        execSync(`git commit -m "${msg}"`);
    } catch (e: any) {
        if (e.message.includes("nothing to commit")) {
            return res.status(400).json({ error: "No changes to backup" });
        }
        throw e;
    }
    
    const hash = execSync('git rev-parse --short HEAD').toString().trim();

    // 2. Salvar no Banco
    const { data, error } = await supabase
      .from("system_snapshots")
      .insert({
        hash,
        message: msg,
        type: message ? 'manual' : 'push'
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    logAuditAction((req as any).user.id, "CREATE_SNAPSHOT", req, { hash, message: msg });
    res.json({ message: "Snapshot created successfully", snapshot: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/backups/restore - Restaurar sistema para um hash
router.post("/backups/restore", checkAdmin, async (req, res) => {
  try {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ error: "Hash required" });

    console.log(`>>> [ROLLBACK] Restoring system to: ${hash}`);

    // Git Reset
    execSync(`git reset --hard ${hash}`);
    
    logAuditAction((req as any).user.id, "RESTORE_SYSTEM", req, { hash });
    
    // Opcional: Reiniciar o servidor se estiver em modo monitorado (ex: PM2)
    // process.exit(0);

    res.json({ message: `System restored to ${hash}.` });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/traffic-stats
router.get("/traffic-stats", checkAdmin, async (_req, res) => {
  try {
    const { getTrafficStats, getSuspiciousActivityLogs } = await import("../middleware/antiAbuse.js");
    const stats = getTrafficStats();
    const logs = getSuspiciousActivityLogs();
    res.json({ ...stats, suspiciousActivities: logs.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/suspicious-logs
router.get("/suspicious-logs", checkAdmin, async (_req, res) => {
  try {
    const { getSuspiciousActivityLogs } = await import("../middleware/antiAbuse.js");
    const logs = getSuspiciousActivityLogs();
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
