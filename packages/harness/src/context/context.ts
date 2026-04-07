/**
 * HarnessContext — shared execution context for all harness modules.
 *
 * Combines:
 * - ArtifactStore: inter-module data passing
 * - Telemetry: structured logging
 * - Budget: resource limits
 * - Config: module-specific and global configuration
 *
 * A new context is created per "run" (e.g., per CLI invocation, per agent task).
 */

import { Telemetry } from '../primitives/telemetry.js';
import { Budget } from '../primitives/budget.js';
import type { BudgetConfig } from '../primitives/budget.js';
import { InMemoryArtifactStore } from './artifact-store.js';
import type { ArtifactStore } from './artifact-store.js';

export interface HarnessConfig {
  /** Global log level override */
  logLevel?: number;
  /** Whether to enable harness mode (false = pass-through, no retries/validation) */
  harnessEnabled?: boolean;
  /** Whether to enable evaluator agent (LLM-based quality checks) */
  evaluatorAgentEnabled?: boolean;
  /** Environment variable prefix for config */
  envPrefix?: string;
}

/** Global harness configuration — read from environment variables */
export function resolveHarnessConfig(envPrefix = 'EQUITYLENS_HARNESS'): HarnessConfig {
  return {
    harnessEnabled: envOrBool(`${envPrefix}_MODE`, true),
    evaluatorAgentEnabled: envOrBool(`${envPrefix}_EVALUATOR_AGENT`, false),
    logLevel: envOrNumber(`${envPrefix}_LOG_LEVEL`, 1),
  };
}

function envOrBool(key: string, defaultValue: boolean): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).process?.env as Record<string, string | undefined> | undefined;
  const val = env?.[key];
  if (val === undefined) return defaultValue;
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;
  return defaultValue;
}

function envOrNumber(key: string, defaultValue: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).process?.env as Record<string, string | undefined> | undefined;
  const val = env?.[key];
  const parsed = parseInt(val ?? '', 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * The shared execution context passed to all modules and evaluators.
 *
 * Modules receive a HarnessContext and use it to:
 * - Log events via telemetry
 * - Read/write artifacts via artifactStore
 * - Check budget limits
 * - Access module-specific config
 */
export interface HarnessContext {
  /** Unique run ID for this execution */
  readonly runId: string;
  /** Artifact store for inter-module data passing */
  readonly artifactStore: ArtifactStore;
  /** Telemetry instance for this run */
  readonly telemetry: Telemetry;
  /** Resource budget tracker */
  readonly budget: Budget;
  /** Global harness configuration */
  readonly config: HarnessConfig;
  /** Arbitrary metadata for this run */
  readonly metadata: Record<string, unknown>;

  /** Child context with an additional module name prefix for artifact keys */
  derive(module: string): HarnessContext;
}

/** Implementation of HarnessContext */
export class HarnessContextImpl implements HarnessContext {
  readonly runId: string;
  readonly artifactStore: ArtifactStore;
  readonly telemetry: Telemetry;
  readonly budget: Budget;
  readonly config: HarnessConfig;
  readonly metadata: Record<string, unknown>;
  private readonly _prefix: string;

  constructor(
    runId: string,
    config: HarnessConfig,
    budgetConfig: BudgetConfig | undefined,
    prefix = '',
    metadata: Record<string, unknown> = {},
    sharedArtifactStore?: ArtifactStore,
  ) {
    this.runId = runId;
    this.config = config;
    this._prefix = prefix;
    this.metadata = { ...metadata };
    // Use shared store if provided (for child contexts), otherwise create new
    this.artifactStore = sharedArtifactStore ?? new InMemoryArtifactStore();
    this.telemetry = new Telemetry(prefix || 'harness');
    this.budget = new Budget(budgetConfig);
  }

  derive(module: string): HarnessContext {
    // Share the same artifact store with parent context
    const child = new HarnessContextImpl(
      this.runId,
      this.config,
      undefined, // inherit budget
      this._prefix ? `${this._prefix}.${module}` : module,
      this.metadata,
      this.artifactStore, // share the artifact store
    );
    return child;
  }

  // Convenience getters
  get isEnabled(): boolean {
    return this.config.harnessEnabled ?? true;
  }
}

/** Create a new run context */
export function createRunContext(
  config?: Partial<HarnessConfig>,
  budgetConfig?: BudgetConfig,
  metadata?: Record<string, unknown>,
): HarnessContext {
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const globalConfig = { ...resolveHarnessConfig(), ...config };
  return new HarnessContextImpl(runId, globalConfig, budgetConfig, 'harness', metadata);
}
