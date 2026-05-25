import { Request, Response, NextFunction } from "express";
import { ZodSchema, z } from "zod";
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://promessometro-brasil.vercel.app,https://promessometro.com.br").split(",").map(o => o.trim());
const IS_PROD = process.env.NODE_ENV === "production";

export function sanitizeInput(obj: any): any {
  if (typeof obj === "string") {
    return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeInput(value);
    }
    return result;
  }
  return obj;
}

export function csrfValidation(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (IS_PROD) {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }

    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (!ALLOWED_ORIGINS.includes(refUrl.origin)) {
          return res.status(403).json({ error: "Referer not allowed" });
        }
      } catch {
        return res.status(403).json({ error: "Invalid referer" });
      }
    }
  }

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers["x-csrf-token"] as string;

  if (cookieToken && headerToken && cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
}

export function generateCsrfToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(`[Error] ${err.message}`);

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map(e => ({ path: e.path.join("."), message: e.message }))
    });
  }

  if (err.name === "SyntaxError" && err.status === 400) {
    return res.status(400).json({ error: "Malformed JSON payload" });
  }

  res.status(err.status || 500).json({
    error: err.expose ? err.message : "An unexpected error occurred"
  });
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: err.issues.map(e => ({ path: e.path.join("."), message: e.message }))
        });
      }
      next(err);
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid query parameters",
          details: err.issues.map(e => ({ path: e.path.join("."), message: e.message }))
        });
      }
      next(err);
    }
  };
}

export function secureHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  if (IS_PROD) {
    res.setHeader("Content-Security-Policy", [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha https://www.gstatic.com https://cdn.tailwindcss.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.supabase.co https://*.supabase.com https://www.google.com https://www.gstatic.com",
      "frame-src 'self' https://www.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; "));
  }

  next();
}

export const roleLevels: Record<string, number> = {
  public: 0,
  moderador: 1,
  admin: 2,
  super_admin: 3
};

export function requireRole(minRole: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    try {
      const { supabase: adminClient } = await import("../lib/supabase.js");
      const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const { data: userData } = await adminClient
        .from("users").select("role, mfa_enabled, last_session_at").eq("id", user.id).single();

      if (!userData) {
        return res.status(403).json({ error: "User not found" });
      }

      const userLevel = roleLevels[userData.role] ?? 0;
      const requiredLevel = roleLevels[minRole] ?? 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      if (["admin", "super_admin"].includes(userData.role)) {
        if (userData.mfa_enabled !== true) {
          return res.status(403).json({ error: "2FA required for admin access", require_2fa: true });
        }

        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const lastSession = userData.last_session_at ? new Date(userData.last_session_at).getTime() : 0;
        if (lastSession < twoHoursAgo) {
          return res.status(401).json({ error: "Session expired — please re-authenticate" });
        }
      }

      (req as any).user = { id: user.id, role: userData.role };
      next();
    } catch {
      res.status(401).json({ error: "Authentication failed" });
    }
  };
}

export default {
  sanitizeInput,
  csrfValidation,
  generateCsrfToken,
  errorHandler,
  validateBody,
  validateQuery,
  secureHeaders,
  requireRole,
  roleLevels
};