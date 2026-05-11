import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CRIA APP EXPRESS IMEDIATAMENTE
// ==========================================
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middlewares básicos
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Security headers (antes das rotas)
app.use((req: any, res: any, next: any) => {
  const { secureHeaders } = require("./src/middleware/security.js");
  secureHeaders(req, res, next);
});

app.use((req: any, res: any, next: any) => {
  const { csrfValidation } = require("./src/middleware/security.js");
  csrfValidation(req, res, next);
});

app.use("/api", (req: any, res: any, next: any) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// ==========================================
// INICIA SERVER PRIMEIRO
// ==========================================
let server: any;
try {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is live on port ${PORT}`);
  });
} catch (err: any) {
  console.error(`❌ Failed to start server: ${err.message}`);
  process.exit(1);
}

// WebSocket
const wss = new WebSocketServer({ server, path: "/ws/stats" });
wss.on("connection", (ws) => {
  console.log('[WS] Client connected');
  ws.on("close", () => console.log('[WS] Client disconnected'));
  ws.on("error", () => console.log('[WS] Client error'));
});

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/api/health", async (req, res) => {
  const startDb = Date.now();
  let dbStatus = "ok";
  let dbLatency = 0;
  try {
    const { error } = await supabase.from("promises").select("id").limit(1);
    dbLatency = Date.now() - startDb;
    if (error) dbStatus = "error";
    if (dbLatency > 3000) dbStatus = "slow";
  } catch {
    dbStatus = "error";
  }

  const healthy = dbStatus === "ok";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    database: dbStatus,
    latency_ms: dbLatency,
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// ==========================================
// DEFINE ROUTES (sem executar lógica pesada)
// ==========================================
app.use("/api/sitemap", (req, res, next) => {
  import("./src/routes/sitemap.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/og", (req, res, next) => {
  import("./src/routes/og.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/recaptcha-verify", (req, res, next) => {
  import("./src/routes/recaptcha.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/admin", (req, res, next) => {
  import("./src/routes/admin.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/cron", (req, res, next) => {
  import("./src/routes/cron.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/skills", (req, res, next) => {
  import("./src/routes/skills.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/ai-review", (req, res, next) => {
  import("./src/routes/aiReview.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/feeds", (req, res, next) => {
  import("./src/routes/feeds.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/promises", (req, res, next) => {
  import("./src/routes/promises.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/politicians", (req, res, next) => {
  import("./src/routes/politicians.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/contestations", (req, res, next) => {
  import("./src/routes/contestations.js").then(m => m.default(req, res, next)).catch(next);
});

// =============================================
// ENDPOINTS DE PIPELINE DE EVIDÊNCIAS (antes do middleware evidence)
// =============================================

// Pipeline status tracking
let pipelineStatus = {
  running: false,
  startTime: null as string | null,
  lastRun: null as string | null,
  lastResult: null as any,
  jobId: null as string | null
};

// GET /api/evidence/pipeline/run - Retorna 202 e processa em background
app.get("/api/evidence/pipeline/run", async (req, res) => {
  if (pipelineStatus.running) {
    return res.status(409).json({
      status: "already_running",
      message: "Pipeline já está em execução",
      job_id: pipelineStatus.jobId,
      start_time: pipelineStatus.startTime
    });
  }

  const jobId = `job_${Date.now()}`;
  pipelineStatus = {
    running: true,
    startTime: new Date().toISOString(),
    lastRun: null,
    lastResult: null,
    jobId
  };

  setImmediate(async () => {
    try {
      console.log(`[Pipeline] Started job ${jobId}`);
      const { runEvidencePipeline } = await import("./src/services/evidencePipeline.js");
      const result = await runEvidencePipeline();
      
      pipelineStatus.lastRun = new Date().toISOString();
      pipelineStatus.lastResult = {
        status: "ok",
        feeds_processados: 6,
        artigos_encontrados: result.articles_fetched,
        evidencias_salvas: result.evidences_found
      };
      console.log(`[Pipeline] Completed job ${jobId}`);
    } catch (err: any) {
      console.error(`[Pipeline] Error in job ${jobId}:`, err.message);
      pipelineStatus.lastResult = {
        status: "error",
        message: err.message
      };
    } finally {
      pipelineStatus.running = false;
    }
  });

  res.status(202).json({
    status: "accepted",
    message: "Pipeline iniciado em background",
    job_id: jobId,
    check_status: "/api/evidence/pipeline/status"
  });
});

// GET /api/evidence/pipeline/status
app.get("/api/evidence/pipeline/status", async (req, res) => {
  try {
    const { supabase } = await import("./src/lib/supabase.js");
    const { getBudgetStats } = await import("./src/services/budgetController.js");
    
    const { data: lastArticle } = await supabase
      .from("rss_articles")
      .select("fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .single();
    
    const { count: articlesCount } = await supabase
      .from("rss_articles")
      .select("*", { count: "exact", head: true });
    
    const { count: evidenciasCount } = await supabase
      .from("promise_evidences")
      .select("*", { count: "exact", head: true })
      .eq("source_type", "rss");
    
    const budgetStats = getBudgetStats();
    
    res.json({
      status: "ok",
      pipeline: {
        running: pipelineStatus.running,
        job_id: pipelineStatus.jobId,
        start_time: pipelineStatus.startTime,
        last_run: pipelineStatus.lastRun,
        last_result: pipelineStatus.lastResult
      },
      ai_budget: {
        requests_used: budgetStats.requestsUsed,
        max_requests: parseInt(process.env.AI_MAX_REQUESTS_PER_RUN || '50'),
        budget_exceeded: budgetStats.budgetExceeded,
        last_reset: budgetStats.lastReset
      },
      data: {
        last_article: lastArticle?.fetched_at || null,
        total_artigos: articlesCount || 0,
        total_evidencias: evidenciasCount || 0
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Middleware de evidence (depois dos endpoints específicos)
app.use("/api/evidence", (req, res, next) => {
  import("./src/routes/evidence.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/evidences", (req, res, next) => {
  import("./src/routes/evidences.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/scrape", (req, res, next) => {
  import("./src/routes/scraper.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/score", (req, res, next) => {
  import("./src/routes/score.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api", (req, res, next) => {
  import("./src/routes/public.js").then(m => m.default(req, res, next)).catch(next);
});

// Stripe webhook (antes do express.json)
app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const { handleStripeWebhook } = await import("./src/routes/stripeWebhook.js");
    await handleStripeWebhook(req, res);
  } catch (err: any) {
    console.error(`Webhook error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Static files (production)
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

// ==========================================
// INICIALIZAÇÕES PESADAS (DEPOIS)
// ==========================================
async function initHeavyServices() {
  console.log('📦 Loading services...');
  
  try {
    // Rate limiting
    const { globalIpLimit, apiKeyRateLimit } = await import("./src/middleware/rateLimit.js");
    app.use(globalIpLimit);
    
    // Sentry
    if (process.env.SENTRY_DSN) {
      const Sentry = await import("@sentry/node");
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
      });
      console.log('✅ Sentry initialized');
    }
    
    // Stripe
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_fake") {
      const Stripe = await import("stripe");
      const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" as any });
      console.log('✅ Stripe initialized');
    }
    
    // Cron jobs (production)
    if (process.env.NODE_ENV === "production") {
      const { startCronJob } = await import("./src/services/skillScheduler.js");
      const { startMonthlyResetJob } = await import("./src/services/monthlyReset.js");
      const { startMonitor } = await import("./src/autonomous/monitor.js");
      
      try { startCronJob(); } catch (e: any) { console.error(`[Cron] ${e.message}`); }
      try { startMonthlyResetJob(); } catch (e: any) { console.error(`[Reset] ${e.message}`); }
      try { startMonitor(); } catch (e: any) { console.error(`[Monitor] ${e.message}`); }
    }
    
    // Ingestion
    const { runIngestion } = await import("./src/services/ingestionService.js");
    runIngestion();
    
    console.log('✅ All services loaded');
  } catch (err: any) {
    console.error(`⚠️ Some services failed to load: ${err.message}`);
  }
}

// Inicia serviços em background
setTimeout(initHeavyServices, 100);

// Heartbeat
setInterval(() => {
  console.log(`💓 ${new Date().toISOString()} | Server running on port ${PORT}`);
}, 5 * 60 * 1000);

// Error handlers
process.on("uncaughtException", (error) => console.error("UNCAUGHT:", error.message));
process.on("unhandledRejection", (reason) => console.error("UNHANDLED:", reason));

app.use((err: any, req: any, res: any, next: any) => {
  const { errorHandler } = require("./src/middleware/security.js");
  errorHandler(err, req, res, next);
});

console.log(`✅ PROMESSÔMETRO API started in ${process.env.NODE_ENV || "development"}`);