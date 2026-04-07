// AbortSignal is a web API available in Node 15+ but not in tsconfig ES2022 lib
// Define minimal interface for use in this package
interface AbortSignal {
  readonly aborted: boolean;
  reason?: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: 'abort', listener: (this: AbortSignal, event: any) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeEventListener(type: 'abort', listener: (this: AbortSignal, event: any) => void): void;
  throwIfAborted(): void;
}

/**
 * Core types for the Generator-Evaluator runner.
 *
 * Key abstractions:
 * - Generator: async function that yields items
 * - Evaluator: function that checks a yielded item (returns pass/fail + metadata)
 * - Runner: orchestrates generate → evaluate → (retry | accept | reject) loop
 */

import type { HarnessContext } from '../context/context.js';
import type { ValidationResult } from '../primitives/validation.js';

// ─── Generator / Evaluator contracts ─────────────────────────────────────────

/**
 * A harness module's generator — yields items to be evaluated.
 * The runner drives this generator: each yielded item is passed to the evaluator.
 *
 * @typeParam T - The item type being generated
 * @typeParam R - The final result type
 */
export interface ModuleGenerator<T, R = void> {
  /**
   * Generate items one at a time.
   * The generator should be resumable (on retry, it starts fresh).
   */
  generate(params: GeneratorParams): AsyncGenerator<T, R, unknown>;
}

export interface GeneratorParams {
  /** The harness context for this run */
  ctx: HarnessContext;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Evaluator — checks a yielded item and decides: pass, retry, or fail.
 *
 * @typeParam T - The item type being evaluated
 * @typeParam M - Additional metadata returned with the result
 */
export interface Evaluator<T, M = Record<string, unknown>> {
  evaluate(item: T, ctx: HarnessContext): Promise<EvaluatorResult<M>>;
}

/** Result of an evaluator run */
export interface EvaluatorResult<M = Record<string, unknown>> {
  /** Whether the item passed evaluation */
  ok: boolean;
  /** Whether this item can be retried (on failure) */
  canRetry: boolean;
  /** Validation errors or quality issues */
  errors: string[];
  /** Warnings that don't fail the item */
  warnings: string[];
  /** Arbitrary metadata from the evaluator */
  metadata: M;
}

/** Default evaluator result helpers */
export function passEval<M = Record<string, unknown>>(metadata: M = {} as M): EvaluatorResult<M> {
  return { ok: true, canRetry: false, errors: [], warnings: [], metadata };
}

export function failEval<M = Record<string, unknown>>(
  errors: string[],
  canRetry = false,
  metadata: M = {} as M,
): EvaluatorResult<M> {
  return { ok: false, canRetry, errors, warnings: [], metadata };
}

// ─── Runner configuration ─────────────────────────────────────────────────────

export interface RunnerConfig {
  /** Maximum retry attempts per item (default: 2) */
  maxRetries?: number;
  /** Whether to halt on first non-retryable failure (default: false) */
  haltOnFail?: boolean;
  /** Whether to halt on first non-retryable failure of a P0 field (default: true) */
  haltOnP0Fail?: boolean;
  /** Minimum passing score for probabilistic evaluators (default: 60) */
  minPassScore?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** When true, all SEC XBRL raw fields must be non-null (default: true) */
  strictFieldCoverage?: boolean;
}

/** Per-item result in a runner run */
export interface RunnerItemResult<T, M = Record<string, unknown>> {
  item: T;
  /** Final evaluator result (after all retries) */
  result: EvaluatorResult<M>;
  /** Number of evaluation attempts made */
  attempts: number;
  /** Whether the item was accepted (passed or retried-then-passed) */
  accepted: boolean;
}

/** Summary of a runner run */
export interface RunnerRunResult<T, R = void, M = Record<string, unknown>> {
  /** Final result from the generator (e.g., summary stats) */
  generatorResult?: R;
  /** Per-item results */
  items: RunnerItemResult<T, M>[];
  /** Aggregate statistics */
  stats: RunnerRunStats;
  /** All items that failed (accepted = false) */
  failures: RunnerItemResult<T, M>[];
  /** All items that passed */
  successes: RunnerItemResult<T, M>[];
}

export interface RunnerRunStats {
  total: number;
  passed: number;
  failed: number;
  retried: number;
  /** Total evaluation attempts across all items */
  totalAttempts: number;
  /** Run duration in ms */
  durationMs: number;
}

// ─── Progress callback ────────────────────────────────────────────────────────

/** Called periodically during a run to report progress */
export type ProgressCallback<T, M = Record<string, unknown>> = (
  progress: RunnerProgress<T, M>,
) => void | Promise<void>;

export interface RunnerProgress<T, M = Record<string, unknown>> {
  /** Current item index (0-based) */
  current: number;
  /** Total items seen so far */
  total: number;
  /** Current item being processed */
  currentItem?: T;
  /** Current evaluator result for this item */
  currentResult?: EvaluatorResult<M>;
  /** Whether the current item passed */
  currentPassed?: boolean;
  /** Cumulative stats so far */
  stats: Pick<RunnerRunStats, 'passed' | 'failed' | 'retried'>;
  /** Elapsed time in ms */
  elapsedMs: number;
}

// ─── Module manifest ─────────────────────────────────────────────────────────

/**
 * Manifest entry for a harness-aware module.
 * Used by the HarnessOrchestrator for dependency ordering.
 */
export interface ModuleManifest<T = unknown, R = void, M = Record<string, unknown>> {
  /** Unique module name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Modules that must run before this one */
  dependencies?: string[];
  /** The generator function */
  generator: ModuleGenerator<T, R>;
  /** The evaluator function */
  evaluator?: Evaluator<T, M>;
  /** Priority (higher = runs first, default: 0) */
  priority?: number;
}
