/**
 * @equitylens/harness — Unified Generator-Evaluator framework for EquityLens v2.
 *
 * Architecture:
 * - primitives/  : Zero-dependency infrastructure (retry, telemetry, validation, budget)
 * - context/     : Shared execution context (artifact store, config)
 * - runner/      : Generator-Evaluator orchestration engine
 * - evaluator/   : Pre-built evaluators (deterministic, probabilistic/LLM)
 * - module-registry.ts: Project-level orchestration
 *
 * Usage:
 *   import { Runner, createRunContext, DeterministicSnapshotEvaluator } from '@equitylens/harness';
 *
 *   const ctx = createRunContext({ harnessEnabled: true });
 *   const runner = new Runner(generator, new DeterministicSnapshotEvaluator());
 *   const result = await runner.run(ctx, { maxRetries: 2 });
 */

// ─── Primitives ────────────────────────────────────────────────────────────────
export {
  withRetry,
  retryingGenerator,
  computeDelay,
  isHttpRetryable,
  httpRetryablePredicate,
} from './primitives/retry.js';
export type { RetryOptions, RetryResult } from './primitives/retry.js';

export {
  Telemetry,
  MemoryTelemetryHandler,
  CompositeTelemetryHandler,
  consoleHandler,
} from './primitives/telemetry.js';
export type { TelemetryHandler, TelemetryEvent } from './primitives/telemetry.js';
export { LogLevel, LOG_LABELS } from './primitives/telemetry.js';

export {
  ok,
  fail,
  merge,
  and,
  or,
  not,
  isDefined,
  isNumber,
  isNonEmptyString,
  inRange,
  isPositive,
  isNonNegative,
  absBelow,
  isEnum,
  hasMinLength,
  every,
  hasField,
  checkField,
  nonNullCount,
  relate,
  approxEqual,
  object,
  mapValues,
  buildSchemaValidator,
} from './primitives/validation.js';
export type { ValidationResult, Rule, FieldSchema, SchemaDefinition } from './primitives/validation.js';

export { Budget } from './primitives/budget.js';
export type { BudgetConfig, BudgetSnapshot } from './primitives/budget.js';

// ─── Context ──────────────────────────────────────────────────────────────────
export {
  InMemoryArtifactStore,
  snapshotArtifactStore,
  restoreArtifactStore,
} from './context/artifact-store.js';
export type {
  ArtifactStore,
  Artifact,
  ArtifactValue,
  ArtifactStoreSnapshot,
} from './context/artifact-store.js';

export {
  HarnessContextImpl,
  createRunContext,
  resolveHarnessConfig,
} from './context/context.js';
export type { HarnessContext, HarnessConfig } from './context/context.js';

// ─── Runner ───────────────────────────────────────────────────────────────────
export { Runner, fromAsyncIterator, fromArray, fromPredicate } from './runner/runner.js';
export type {
  ModuleGenerator,
  GeneratorParams,
  Evaluator,
  EvaluatorResult,
  RunnerConfig,
  RunnerItemResult,
  RunnerRunResult,
  RunnerRunStats,
  ProgressCallback,
  RunnerProgress,
  ModuleManifest,
} from './runner/types.js';
export { passEval, failEval } from './runner/types.js';

// ─── Evaluators ───────────────────────────────────────────────────────────────
export {
  DeterministicSnapshotEvaluator,
  createSchemaEvaluator,
} from './evaluator/deterministic.js';
export type {
  DeterministicEvaluatorConfig,
  DeterministicEvalMetadata,
} from './evaluator/deterministic.js';

export {
  LLMClassificationEvaluator,
  LLMScoringEvaluator,
} from './evaluator/probabilistic.js';
export type {
  LLMClassificationItem,
  LLMScoringItem,
  LLMClassificationMetadata,
  LLMScoringMetadata,
  LLMClassificationEvaluatorConfig,
} from './evaluator/probabilistic.js';

// ─── Orchestration ─────────────────────────────────────────────────────────────
export {
  HarnessOrchestrator,
  topologicalSort,
  defineModule,
} from './module-registry.js';
export type { ModuleRunResult } from './module-registry.js';
