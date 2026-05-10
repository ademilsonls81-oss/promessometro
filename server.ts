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
const PORT = process.env.PORT || 3000;

// Middlewares básicos
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

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
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ==========================================
// DEFINE ROUTES (sem executar lógica pesada)
// ==========================================
app.use("/api/admin", (req, res, next) => {
  import("./src/routes/admin.js").then(m => m.default(req, res, next)).catch(next);
});

app.use("/api/skills", (req, res, next) => {
  import("./src/routes/skills.js").then(m => m.default(req, res, next)).catch(next);
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

// =============================================
// ENDPOINTS DE PIPELINE DE EVIDÊNCIAS (antes do middleware evidence)
// =============================================

// GET /api/evidence/pipeline/run
app.get("/api/evidence/pipeline/run", async (req, res) => {
  try {
    const { runEvidencePipeline } = await import("./src/services/evidencePipeline.js");
    const result = await runEvidencePipeline();
    res.json({
      status: "ok",
      feeds_processados: 6,
      artigos_encontrados: result.articles_fetched,
      evidencias_salvas: result.evidences_found
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// GET /api/evidence/pipeline/status
app.get("/api/evidence/pipeline/status", async (req, res) => {
  try {
    const { supabase } = await import("./src/lib/supabase.js");
    
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
    
    res.json({
      status: "ok",
      last_run: lastArticle?.fetched_at || null,
      total_artigos: articlesCount || 0,
      total_evidencias: evidenciasCount || 0
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Middleware de evidence (depois dos endpoints específicos)
app.use("/api/evidence", (req, res, next) => {
  import("./src/routes/evidence.js").then(m => m.default(req, res, next)).catch(next);
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

console.log(`✅ PROMESSÔMETRO API started in ${process.env.NODE_ENV || "development"}`);