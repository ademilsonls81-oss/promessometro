import { Router, Request, Response } from "express";

import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const RECAPTCHA_SECRET = process.env.VITE_RECAPTCHA_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY || "";
const SCORE_THRESHOLD = 0.5;

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
}

router.post("/recaptcha-verify", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { token, action, secret } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: "No token provided" });
    }

    const verificationSecret = secret || RECAPTCHA_SECRET;
    
    if (!verificationSecret) {
      console.warn("[reCAPTCHA] No secret key configured, allowing request");
      return res.json({ success: true, score: 1 });
    }

    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${verificationSecret}&response=${token}`
    });

    const data: RecaptchaResponse = await response.json();

    if (data.success && data.score !== undefined && data.score >= SCORE_THRESHOLD) {
      if (action && data.action !== action) {
        console.warn("[reCAPTCHA] Action mismatch:", { expected: action, got: data.action });
      }

      return res.json({
        success: true,
        score: data.score,
        action: data.action
      });
    }

    return res.json({
      success: false,
      score: data.score || 0,
      error: data["error-codes"]?.join(", ") || "Verification failed"
    });
  } catch (err) {  // any-ok
    console.error("[reCAPTCHA] Verification error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}));

export default router;