/**
 * Token / time / count budget tracking for harness runs.
 *
 * Used by the runner to enforce resource limits and prevent runaway operations.
 * Budgets are checked before each generator yield and after each evaluator run.
 *
 * Usage:
 *   const budget = new Budget({ maxTokens: 100_000, maxTimeMs: 300_000, maxItems: 200 });
 *   budget.consumeTokens(500);
 *   if (budget.isExhausted()) throw new Error('Out of budget');
 */

export interface BudgetConfig {
  /** Maximum tokens to consume (0 = unlimited) */
  maxTokens?: number;
  /** Maximum wall-clock time in ms (0 = unlimited) */
  maxTimeMs?: number;
  /** Maximum items to process (0 = unlimited) */
  maxItems?: number;
  /** Maximum retry attempts (0 = unlimited, default: 10) */
  maxRetries?: number;
  /** Start time (defaults to now) */
  startTimeMs?: number;
}

export interface BudgetSnapshot {
  tokensUsed: number;
  elapsedMs: number;
  itemsProcessed: number;
  retriesUsed: number;
  /** % of token budget consumed (0-100), NaN if unlimited */
  tokenBudgetPct: number;
  /** % of time budget consumed (0-100), NaN if unlimited */
  timeBudgetPct: number;
  /** % of item budget consumed (0-100), NaN if unlimited */
  itemBudgetPct: number;
}

export class Budget {
  private _tokensUsed = 0;
  private _startTimeMs: number;
  private _itemsProcessed = 0;
  private _retriesUsed = 0;
  private readonly _maxTokens: number;
  private readonly _maxTimeMs: number;
  private readonly _maxItems: number;
  private readonly _maxRetries: number;

  constructor(config: BudgetConfig = {}) {
    this._maxTokens = config.maxTokens ?? 0;
    this._maxTimeMs = config.maxTimeMs ?? 0;
    this._maxItems = config.maxItems ?? 0;
    this._maxRetries = config.maxRetries ?? 10;
    this._startTimeMs = config.startTimeMs ?? Date.now();
  }

  /** Current snapshot of budget state */
  get snapshot(): BudgetSnapshot {
    const elapsedMs = Date.now() - this._startTimeMs;
    return {
      tokensUsed: this._tokensUsed,
      elapsedMs,
      itemsProcessed: this._itemsProcessed,
      retriesUsed: this._retriesUsed,
      tokenBudgetPct: this._maxTokens > 0 ? (this._tokensUsed / this._maxTokens) * 100 : NaN,
      timeBudgetPct: this._maxTimeMs > 0 ? (elapsedMs / this._maxTimeMs) * 100 : NaN,
      itemBudgetPct: this._maxItems > 0 ? (this._itemsProcessed / this._maxItems) * 100 : NaN,
    };
  }

  /** Consume tokens (can be fractional) */
  consumeTokens(amount: number): void {
    this._tokensUsed += amount;
  }

  /** Increment item count */
  incrementItems(count = 1): void {
    this._itemsProcessed += count;
  }

  /** Increment retry count */
  incrementRetries(count = 1): void {
    this._retriesUsed += count;
  }

  /** Check if token budget is exhausted */
  isTokenExhausted(): boolean {
    return this._maxTokens > 0 && this._tokensUsed >= this._maxTokens;
  }

  /** Check if time budget is exhausted */
  isTimeExhausted(): boolean {
    if (this._maxTimeMs <= 0) return false;
    return Date.now() - this._startTimeMs >= this._maxTimeMs;
  }

  /** Check if item budget is exhausted */
  isItemExhausted(): boolean {
    return this._maxItems > 0 && this._itemsProcessed >= this._maxItems;
  }

  /** Check if retry budget is exhausted */
  isRetryExhausted(): boolean {
    return this._maxRetries > 0 && this._retriesUsed >= this._maxRetries;
  }

  /** Check if any budget dimension is exhausted */
  isExhausted(): boolean {
    return this.isTokenExhausted() || this.isTimeExhausted() || this.isItemExhausted();
  }

  /** Remaining token budget (NaN if unlimited) */
  get tokensRemaining(): number {
    return this._maxTokens > 0 ? Math.max(0, this._maxTokens - this._tokensUsed) : NaN;
  }

  /** Remaining time in ms (NaN if unlimited) */
  get timeRemainingMs(): number {
    if (this._maxTimeMs <= 0) return NaN;
    return Math.max(0, this._maxTimeMs - (Date.now() - this._startTimeMs));
  }

  /** Remaining item budget (NaN if unlimited) */
  get itemsRemaining(): number {
    return this._maxItems > 0 ? Math.max(0, this._maxItems - this._itemsProcessed) : NaN;
  }
}
