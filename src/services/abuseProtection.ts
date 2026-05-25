const STORAGE_KEY = "pm_abuse_protection";
const COOLDOWN_KEY = "pm_cooldowns";

interface CooldownEntry {
  action: string;
  target: string;
  timestamp: number;
}

interface AbuseProtectionState {
  fingerprint: string;
  requestCount: number;
  windowStart: number;
  cooldowns: CooldownEntry[];
  blockedUntil: number | null;
}

function generateFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || "",
    navigator.platform,
  ];
  
  let hash = 0;
  for (const comp of components) {
    const combined = hash + comp.charCodeAt(0);
    hash = ((combined << 5) - combined) + comp.charCodeAt(0);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36) + Date.now().toString(36);
}

function getOrCreateFingerprint(): string {
  const stored = sessionStorage.getItem(`${STORAGE_KEY}_fp`);
  if (stored) return stored;
  
  const fp = generateFingerprint();
  sessionStorage.setItem(`${STORAGE_KEY}_fp`, fp);
  return fp;
}

function getState(): AbuseProtectionState {
  const defaultState: AbuseProtectionState = {
    fingerprint: getOrCreateFingerprint(),
    requestCount: 0,
    windowStart: Date.now(),
    cooldowns: [],
    blockedUntil: null,
  };

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const windowDuration = 60 * 1000;
      if (Date.now() - parsed.windowStart > windowDuration) {
        parsed.requestCount = 0;
        parsed.windowStart = Date.now();
      }
      return parsed;
    }
  } catch (e) {
    console.error("[AbuseProtection] Failed to load state:", e);
  }
  
  return defaultState;
}

function saveState(state: AbuseProtectionState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("[AbuseProtection] Failed to save state:", e);
  }
}

function getIPFromRequest(): string {
  return "anonymous";
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  retryAfter?: number;
}

export function checkRateLimit(maxRequests: number = 100, windowMs: number = 60000): RateLimitResult {
  const state = getState();
  const now = Date.now();
  
  if (state.blockedUntil && now < state.blockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: state.blockedUntil - now,
      retryAfter: state.blockedUntil - now
    };
  }
  
  if (now - state.windowStart > windowMs) {
    state.requestCount = 0;
    state.windowStart = now;
  }
  
  if (state.requestCount >= maxRequests) {
    state.blockedUntil = now + windowMs;
    saveState(state);
    return {
      allowed: false,
      remaining: 0,
      resetIn: windowMs,
      retryAfter: windowMs
    };
  }
  
  state.requestCount++;
  saveState(state);
  
  return {
    allowed: true,
    remaining: maxRequests - state.requestCount,
    resetIn: windowMs - (now - state.windowStart)
  };
}

interface CooldownResult {
  allowed: boolean;
  remainingTime: number;
}

export function checkCooldown(action: string, target: string, cooldownMs: number = 24 * 60 * 60 * 1000): CooldownResult {
  const state = getState();
  const now = Date.now();
  
  const existing = state.cooldowns.find(
    c => c.action === action && c.target === target
  );
  
  if (existing) {
    const elapsed = now - existing.timestamp;
    if (elapsed < cooldownMs) {
      return {
        allowed: false,
        remainingTime: cooldownMs - elapsed
      };
    }
  }
  
  state.cooldowns = state.cooldowns.filter(c => !(c.action === action && c.target === target));
  state.cooldowns.push({ action, target, timestamp: now });
  state.cooldowns = state.cooldowns.slice(-100);
  saveState(state);
  
  return {
    allowed: true,
    remainingTime: 0
  };
}

export function recordAction(action: string, target: string): void {
  const state = getState();
  const now = Date.now();
  
  state.cooldowns = state.cooldowns.filter(c => !(c.action === action && c.target === target));
  state.cooldowns.push({ action, target, timestamp: now });
  state.cooldowns = state.cooldowns.slice(-100);
  saveState(state);
}

interface HoneypotResult {
  isBot: boolean;
  honeypotFilled: boolean;
}

export function checkHoneypot(formId: string): HoneypotResult {
  try {
    const hpField = document.getElementById(`hp_${formId}`) as HTMLInputElement;
    if (hpField && hpField.value) {
      return { isBot: true, honeypotFilled: true };
    }
  } catch (e) {
    console.error("[Honeypot] Check failed:", e);
  }
  return { isBot: false, honeypotFilled: false };
}

export function getHoneypotField(formId: string): string {
  return `
    <input 
      type="text" 
      name="website" 
      id="hp_${formId}"
      tabindex="-1" 
      autocomplete="off"
      style="position: absolute; left: -9999px; top: -9999px; opacity: 0; pointer-events: none;"
      aria-hidden="true"
    />
  `;
}

interface RecaptchaResult {
  success: boolean;
  score: number;
  token?: string;
  error?: string;
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

export async function executeRecaptcha(action: string): Promise<RecaptchaResult> {
  if (!RECAPTCHA_SITE_KEY || typeof window === "undefined" || !(window as any).grecaptcha) {
    if (!RECAPTCHA_SITE_KEY) {
      console.warn("[Recaptcha] Site key not configured, skipping");
      return { success: true, score: 1 };
    }
    return { success: false, score: 0, error: "reCAPTCHA not loaded" };
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

    const score = action === "submit_contestation" ? 0.7 :
                  action === "submit_report" ? 0.6 : 0.5;

    return { success: true, score, token };
  } catch (e: any) {
    return { success: false, score: 0, error: e.message };
  }
}

export async function verifyRecaptchaToken(token: string): Promise<{ valid: boolean; score: number }> {
  if (!token || !RECAPTCHA_SITE_KEY) {
    return { valid: true, score: 1 };
  }
  
  try {
    const response = await fetch("/api/recaptcha-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, secret: import.meta.env.VITE_RECAPTCHA_SECRET_KEY || "" })
    });
    
    const data = await response.json();
    return {
      valid: data.success && data.score >= 0.5,
      score: data.score || 0
    };
  } catch (e) {
    console.error("[Recaptcha] Verification failed:", e);
    return { valid: true, score: 0.5 };
  }
}

interface ProtectionCheckResult {
  allowed: boolean;
  reasons: string[];
  canProceed: boolean;
  benefits: string[];
}

export function checkProtection(
  action: string,
  target: string,
  options: { maxRateLimit?: number; cooldownMs?: number } = {}
): ProtectionCheckResult {
  const { maxRateLimit = 100, cooldownMs = 24 * 60 * 60 * 1000 } = options;
  
  const reasons: string[] = [];
  
  const rateLimit = checkRateLimit(maxRateLimit);
  if (!rateLimit.allowed) {
    reasons.push(`Muitas requisições. Tente novamente em ${Math.ceil(rateLimit.retryAfter! / 1000)}s`);
  }
  
  if (!rateLimit.allowed) {
    return {
      allowed: false,
      reasons,
      canProceed: false,
      benefits: ["Fazer login ajuda a evitar limites de uso"]
    };
  }
  
  const cooldown = checkCooldown(action, target, cooldownMs);
  if (!cooldown.allowed) {
    const hours = Math.floor(cooldown.remainingTime / (60 * 60 * 1000));
    const minutes = Math.floor((cooldown.remainingTime % (60 * 60 * 1000)) / (60 * 1000));
    reasons.push(`Você já fez essa ação recentemente. Aguarde ${hours}h ${minutes}min`);
  }
  
  if (!cooldown.allowed) {
    return {
      allowed: false,
      reasons,
      canProceed: false,
      benefits: ["Com login, você pode gerenciar suas submissões"]
    };
  }
  
  return {
    allowed: true,
    reasons: [],
    canProceed: true,
    benefits: [
      "Acompanhe suas contestações",
      "Histórico pessoal de submissions",
      "Notificações de atualização de status"
    ]
  };
}

export function getFingerprint(): string {
  return getOrCreateFingerprint();
}

export function formatCooldown(ms: number): string {
  if (ms < 60 * 1000) return `${Math.ceil(ms / 1000)}s`;
  if (ms < 60 * 60 * 1000) return `${Math.ceil(ms / (60 * 1000))}min`;
  if (ms < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${mins}min`;
  }
  const hours = Math.floor(ms / (60 * 60 * 1000));
  return `${hours}h`;
}

export default {
  checkRateLimit,
  checkCooldown,
  checkHoneypot,
  getHoneypotField,
  executeRecaptcha,
  verifyRecaptchaToken,
  checkProtection,
  getFingerprint,
  recordAction,
  formatCooldown
};