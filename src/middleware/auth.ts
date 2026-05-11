import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";

export async function checkAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized — Bearer token required" });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const { data: userData } = await supabase
      .from("users").select("role, mfa_enabled, last_session_at").eq("id", user.id).single();

    if (!userData) {
      return res.status(403).json({ error: "User not found" });
    }

    const adminRoles = ["admin", "super_admin"];
    if (!adminRoles.includes(userData.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (userData.mfa_enabled !== true) {
      return res.status(403).json({ error: "2FA required for admin access", require_2fa: true });
    }

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const lastSession = userData.last_session_at ? new Date(userData.last_session_at).getTime() : 0;
    if (lastSession < twoHoursAgo) {
      return res.status(401).json({ error: "Session expired — re-authenticate required" });
    }

    await supabase
      .from("users")
      .update({ last_session_at: new Date().toISOString() })
      .eq("id", user.id);

    (req as any).user = { id: user.id, role: userData.role };
    next();
  } catch (err) {
    res.status(401).json({ error: "Authentication failed" });
  }
}
