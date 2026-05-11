import { Request, Response, NextFunction } from "express";

const IP_STORE = new Map<string, { count: number; resetTime: number; blocked: boolean }>();

const RATE_LIMITS = {
  public: { max: 300, windowMs: 60 * 1000 },
  sensitive: { max: 10, windowMs: 60 * 1000 },
  api: { max: 60, windowMs: 60 * 1000 }
};

interface RateLimitOptions {
  type: "public" | "sensitive" | "api";
  customLimit?: number;
}

export function rateLimitMiddleware(options: RateLimitOptions) {
  const config = RATE_LIMITS[options.type];
  const maxRequests = options.customLimit || config.max;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIP(req);
    const now = Date.now();

    let record = IP_STORE.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + config.windowMs, blocked: false };
    }

    if (record.blocked && now < record.resetTime) {
      res.setHeader("Retry-After", Math.ceil((record.resetTime - now) / 1000));
      return res.status(429).json({
        error: "Muitas requisições",
        message: "Você está fazendo muitas requisições. Tente novamente em alguns minutos.",
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
        type: options.type
      });
    }

    record.count++;

    if (record.count > maxRequests) {
      record.blocked = true;
      IP_STORE.set(ip, record);

      if (options.type === "sensitive") {
        logSuspiciousActivity(ip, "rate_limit_exceeded", { type: options.type, count: record.count });
      }

      res.setHeader("Retry-After", Math.ceil((record.resetTime - now) / 1000));
      return res.status(429).json({
        error: "Limite excedido",
        message: "Você excedeu o limite de requisições. Por favor, aguarde.",
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    IP_STORE.set(ip, record);

    res.setHeader("X-RateLimit-Limit", maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - record.count).toString());
    res.setHeader("X-RateLimit-Reset", new Date(record.resetTime).toISOString());

    next();
  };
}

function getClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function antiScrapingHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
}

interface SuspiciousActivity {
  ip: string;
  type: string;
  details: Record<string, any>;
  timestamp: string;
}

const suspiciousLogs: SuspiciousActivity[] = [];
const MAX_LOGS = 1000;

function logSuspiciousActivity(ip: string, type: string, details: Record<string, any>) {
  const entry: SuspiciousActivity = {
    ip,
    type,
    details,
    timestamp: new Date().toISOString()
  };

  suspiciousLogs.unshift(entry);
  if (suspiciousLogs.length > MAX_LOGS) {
    suspiciousLogs.pop();
  }

  console.warn(`[AntiAbuse] Suspicious activity from ${ip}: ${type}`, details);
}

export function getSuspiciousActivityLogs(): SuspiciousActivity[] {
  return suspiciousLogs;
}

export function getTrafficStats() {
  const now = Date.now();
  const activeIPs = Array.from(IP_STORE.entries()).filter(([, record]) => !record.blocked && now < record.resetTime);
  const blockedIPs = Array.from(IP_STORE.entries()).filter(([, record]) => record.blocked);

  let totalRequests = 0;
  for (const [, record] of IP_STORE) {
    totalRequests += record.count;
  }

  return {
    activeConnections: activeIPs.length,
    blockedIPs: blockedIPs.length,
    totalRequestsToday: totalRequests,
    suspiciousActivities: suspiciousLogs.length,
    memoryUsage: IP_STORE.size
  };
}

export function clearOldRecords() {
  const now = Date.now();
  for (const [ip, record] of IP_STORE.entries()) {
    if (now > record.resetTime && !record.blocked) {
      IP_STORE.delete(ip);
    }
  }
}

setInterval(clearOldRecords, 5 * 60 * 1000);

export default {
  rateLimitMiddleware,
  antiScrapingHeaders,
  getSuspiciousActivityLogs,
  getTrafficStats,
  logSuspiciousActivity
};