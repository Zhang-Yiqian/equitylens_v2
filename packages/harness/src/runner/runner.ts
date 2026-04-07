/**
 * Generator-Evaluator orchestration engine.
 *
 * The core run loop:
 *   1. Generator yields an item
 *   2. Evaluator checks the item
 *   3. If PASS → accept item, continue
 *   4. If FAIL + canRetry → retry item (up to maxRetries)
 *   5. If FAIL + cannotRetry → reject item (optionally halt)
 *   6. Repeat until generator is exhausted
 *
 * Usage:
 *   const runner = new Runner(generator, evaluator);
 *   const result = await runner.run(ctx, { maxRetries: 2 });
 */

import type { HarnessContext } from '../context/context.js';
import type {
  Evaluator,
  EvaluatorResult,
  GeneratorParams,
  ModuleGenerator,
  RunnerConfig,
  RunnerItemResult,
  RunnerRunResult,
  RunnerRunStats,
} from './types.js';
import { failEval, passEval } from './types.js';

const DEFAULT_CONFIG: RunnerConfig = {
  maxRetries: 2,
  haltOnFail: false,
  haltOnP0Fail: true,
  minPassScore: 60,
};

export class Runner<T, R = void, M = Record<string, unknown>> {
  constructor(
    private readonly generator: ModuleGenerator<T, R>,
    private readonly evaluator?: Evaluator<T, M>,
  ) {}

  /**
   * Run the generator → evaluator loop.
   *
   * When no evaluator is provided, all items are auto-accepted (pass-through mode).
   */
  async run(
    ctx: HarnessContext,
    config: RunnerConfig = {},
  ): Promise<RunnerRunResult<T, R, M>> {
    const startTime = Date.now();
    const cfg: RunnerConfig = { ...DEFAULT_CONFIG, ...config };
    const items: RunnerItemResult<T, M>[] = [];
    const failures: RunnerItemResult<T, M>[] = [];
    const successes: RunnerItemResult<T, M>[] = [];
    let totalAttempts = 0;
    let retried = 0;
    let generatorResult: R | undefined;

    // Check harness mode — pass-through if disabled
    const isEnabled = (ctx as { isEnabled?: boolean }).isEnabled ?? true;
    if (!isEnabled) {
      ctx.telemetry.info('runner.pass_through', { reason: 'harness_disabled' });
      for await (const item of this.generator.generate({ ctx, signal: cfg.signal })) {
        items.push({ item, result: passEval(), attempts: 1, accepted: true });
        successes.push(items[items.length - 1]);
        ctx.budget.incrementItems();
      }
    } else {
      const params: GeneratorParams = { ctx, signal: cfg.signal };

      // Check abort signal
      cfg.signal?.throwIfAborted();

      try {
        for await (const item of this.generator.generate(params)) {
          const itemStart = Date.now();
          ctx.telemetry.debug('runner.item.start', { item: String(item) });

          // Budget check
          if (ctx.budget.isExhausted()) {
            ctx.telemetry.warn('runner.budget_exhausted', {
              budgetSnapshot: ctx.budget.snapshot,
            });
            ctx.budget.incrementItems();
            items.push({
              item,
              result: failEval(['Budget exhausted'], false),
              attempts: 1,
              accepted: false,
            });
            failures.push(items[items.length - 1]);
            if (cfg.haltOnFail) break;
            continue;
          }

          // Evaluate with retry
          const { result: itemResult, attempts: itemAttempts, accepted: itemAccepted } =
            await this.evaluateWithRetry(item, ctx, cfg);

          totalAttempts += itemAttempts;
          if (itemAttempts > 1) retried++;

          ctx.budget.incrementItems();

          items.push({ item, result: itemResult, attempts: itemAttempts, accepted: itemAccepted });

          if (itemResult.ok) {
            successes.push(items[items.length - 1]);
            ctx.telemetry.debug('runner.item.pass', {
              item: String(item),
              attempts: itemAttempts,
              elapsedMs: Date.now() - itemStart,
            });
          } else {
            failures.push(items[items.length - 1]);
            ctx.telemetry.error('runner.item.fail', {
              item: String(item),
              errors: itemResult.errors,
              attempts: itemAttempts,
            });
            if (cfg.haltOnFail) break;
          }
        }
      } catch (err) {
        ctx.telemetry.error('runner.generator.error', { error: String(err) });
        throw err;
      }
    }

    const durationMs = Date.now() - startTime;
    const stats: RunnerRunStats = {
      total: items.length,
      passed: successes.length,
      failed: failures.length,
      retried,
      totalAttempts,
      durationMs,
    };

    ctx.telemetry.info('runner.done', { stats });

    return { generatorResult, items, stats, failures, successes };
  }

  /**
   * Evaluate an item with retry logic.
   */
  private async evaluateWithRetry(
    item: T,
    ctx: HarnessContext,
    cfg: RunnerConfig,
  ): Promise<RunnerItemResult<T, M>> {
    // No evaluator → auto-pass
    if (!this.evaluator) {
      return { item, result: passEval(), attempts: 1, accepted: true };
    }

    let attempts = 0;
    let lastResult: EvaluatorResult<M> | undefined;

    while (attempts <= (cfg.maxRetries ?? 2)) {
      attempts++;

      try {
        const result = await this.evaluator.evaluate(item, ctx);

        // Check for probabilistic score threshold
        const score = (result.metadata as { score?: number } | undefined)?.score;
        if (score !== undefined && score < (cfg.minPassScore ?? 60)) {
          lastResult = {
            ...result,
            ok: false,
            canRetry: result.canRetry || attempts <= (cfg.maxRetries ?? 2),
            errors: [...result.errors, `Score ${score} below threshold ${cfg.minPassScore}`],
          };
        } else {
          lastResult = result;
        }

        if (lastResult.ok) {
          return { item, result: lastResult, attempts, accepted: true };
        }

        if (!lastResult.canRetry || attempts > (cfg.maxRetries ?? 2)) {
          return { item, result: lastResult, attempts, accepted: false };
        }

        // Retry
        ctx.telemetry.warn('runner.item.retry', {
          item: String(item),
          attempt: attempts,
          errors: lastResult.errors,
        });
        ctx.budget.incrementRetries();

        if (ctx.budget.isRetryExhausted()) {
          ctx.telemetry.warn('runner.retry_exhausted', { attempts });
          return { item, result: lastResult, attempts, accepted: false };
        }

      } catch (err) {
        // Generator/evaluator threw — treat as retryable error
        if (attempts > (cfg.maxRetries ?? 2)) {
          return {
            item,
            result: failEval([`Unrecoverable error: ${String(err)}`], false),
            attempts,
            accepted: false,
          };
        }
        ctx.telemetry.warn('runner.item.retry_error', {
          item: String(item),
          attempt: attempts,
          error: String(err),
        });
        ctx.budget.incrementRetries();
      }
    }

    return { item, result: lastResult ?? failEval(['No result']), attempts, accepted: false };
  }
}

/**
 * Build a simple generator from an async iterator.
 */
export function fromAsyncIterator<T, R = void>(
  fn: (params: GeneratorParams) => AsyncGenerator<T, R, unknown>,
): ModuleGenerator<T, R> {
  return { generate: fn };
}

/**
 * Build a generator from an array (synchronous data).
 */
export function fromArray<T, R = void>(
  data: T[],
  extraResult?: R,
): ModuleGenerator<T, R> {
  return {
    async *generate({ signal }: GeneratorParams): AsyncGenerator<T, R, unknown> {
      for (const item of data) {
        signal?.throwIfAborted();
        yield item;
      }
      // Return the extra result if provided
      if (extraResult !== undefined) {
        return extraResult as R;
      }
      // Explicit return for TypeScript async generator return type
      return undefined as unknown as R;
    },
  };
}

/**
 * Build a simple evaluator from a predicate function.
 */
export function fromPredicate<T, M = Record<string, unknown>>(
  fn: (item: T) => boolean | Promise<boolean>,
  errorMsg = 'Validation failed',
): Evaluator<T, M> {
  return {
    async evaluate(item: T): Promise<EvaluatorResult<M>> {
      const ok = await fn(item);
      return ok ? passEval() : failEval([errorMsg]);
    },
  };
}
