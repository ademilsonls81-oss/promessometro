interface BudgetConfig {
  maxRequestsPerRun: number;
  maxTokensPerRun: number;
  windowMs: number;
}

interface BudgetStats {
  requestsUsed: number;
  tokensUsed: number;
  lastReset: string;
  budgetExceeded: boolean;
}

class BudgetController {
  private config: BudgetConfig;
  private stats: BudgetStats;
  private running: boolean = false;

  constructor(config?: Partial<BudgetConfig>) {
    this.config = {
      maxRequestsPerRun: parseInt(process.env.AI_MAX_REQUESTS_PER_RUN || '50'),
      maxTokensPerRun: parseInt(process.env.AI_MAX_TOKENS_PER_RUN || '100000'),
      windowMs: 60 * 60 * 1000
    };
    
    this.stats = {
      requestsUsed: 0,
      tokensUsed: 0,
      lastReset: new Date().toISOString(),
      budgetExceeded: false
    };
  }

  canMakeRequest(estimatedTokens: number = 1000): boolean {
    if (this.stats.budgetExceeded) {
      console.warn(`[Budget] Limit exceeded. Used: ${this.stats.requestsUsed}/${this.config.maxRequestsPerRun}`);
      return false;
    }

    if (this.stats.requestsUsed >= this.config.maxRequestsPerRun) {
      this.stats.budgetExceeded = true;
      console.warn(`[Budget] Request limit reached: ${this.stats.requestsUsed}/${this.config.maxRequestsPerRun}`);
      return false;
    }

    if (this.stats.tokensUsed + estimatedTokens > this.config.maxTokensPerRun) {
      this.stats.budgetExceeded = true;
      console.warn("[Budget] Budget limit would be exceeded");
      return false;
    }

    return true;
  }

  recordRequest(tokensUsed: number = 0): void {
    this.stats.requestsUsed++;
    this.stats.tokensUsed += tokensUsed;
    console.log(`[Budget] Used: ${this.stats.requestsUsed} requests`);
  }

  getStats(): BudgetStats {
    return { ...this.stats };
  }

  reset(): void {
    this.stats = {
      requestsUsed: 0,
      tokensUsed: 0,
      lastReset: new Date().toISOString(),
      budgetExceeded: false
    };
    console.log('[Budget] Reset');
  }

  isRunning(): boolean {
    return this.running;
  }

  setRunning(value: boolean): void {
    this.running = value;
  }
}

export const budgetController = new BudgetController();

export function checkBudget(estimatedTokens: number = 1000): boolean {
  return budgetController.canMakeRequest(estimatedTokens);
}

export function recordAiCall(tokensUsed: number = 0): void {
  budgetController.recordRequest(tokensUsed);
}

export function getBudgetStats(): BudgetStats {
  return budgetController.getStats();
}

export function resetBudget(): void {
  budgetController.reset();
}

export default budgetController;