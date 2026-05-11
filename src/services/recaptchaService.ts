const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";
const RECAPTCHA_SECRET_KEY = import.meta.env.VITE_RECAPTCHA_SECRET_KEY || "";
const SCORE_THRESHOLD = 0.5;

interface RecaptchaVerifyResult {
  success: boolean;
  score: number;
  action: string;
  reason?: string;
}

export async function executeRecaptchaV3(action: string): Promise<string | null> {
  if (!RECAPTCHA_SITE_KEY || typeof window === "undefined") {
    console.warn("[reCAPTCHA] Site key not configured");
    return null;
  }

  if (!(window as any).grecaptcha) {
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?render=" + RECAPTCHA_SITE_KEY;
    script.async = true;
    document.head.appendChild(script);
    
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
    });
  }

  try {
    const token = await new Promise<string>((resolve, reject) => {
      (window as any).grecaptcha.ready(async () => {
        try {
          const token = await (window as any).grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch (e) {
          reject(e);
        }
      });
    });
    return token;
  } catch (e) {
    console.error("[reCAPTCHA] Execute failed:", e);
    return null;
  }
}

export async function verifyRecaptchaToken(token: string, expectedAction: string): Promise<RecaptchaVerifyResult> {
  if (!token) {
    return { success: false, score: 0, action: expectedAction, reason: "no_token" };
  }

  if (!RECAPTCHA_SECRET_KEY) {
    console.warn("[reCAPTCHA] Secret key not configured, allowing request");
    return { success: true, score: 1, action: expectedAction };
  }

  try {
    const response = await fetch("/api/recaptcha-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: expectedAction, secret: RECAPTCHA_SECRET_KEY })
    });

    const data = await response.json();

    if (data.success && data.score >= SCORE_THRESHOLD) {
      return {
        success: true,
        score: data.score,
        action: expectedAction
      };
    }

    return {
      success: false,
      score: data.score || 0,
      action: expectedAction,
      reason: data.score < SCORE_THRESHOLD ? "low_score" : "verification_failed"
    };
  } catch (e) {
    console.error("[reCAPTCHA] Verification error:", e);
    return { success: false, score: 0, action: expectedAction, reason: "network_error" };
  }
}

export function shouldSkipRecaptcha(): boolean {
  return !RECAPTCHA_SITE_KEY || RECAPTCHA_SITE_KEY === "placeholder";
}

export default {
  executeRecaptchaV3,
  verifyRecaptchaToken,
  shouldSkipRecaptcha,
  SCORE_THRESHOLD
};