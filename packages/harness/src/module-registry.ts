/**
 * Module registry for project-level harness orchestration.
 *
 * The HarnessOrchestrator:
 * 1. Collects all registered modules
 * 2. Performs topological sort based on dependencies
 * 3. Runs modules in dependency order
 * 4. Writes each module's artifacts to the shared artifact store
 * 5. Passes artifacts to downstream modules as input
 *
 * Usage:
 *   const orchestrator = new HarnessOrchestrator();
 *   orchestrator.register(financialDataModule);
 *   orchestrator.register(universeMapperModule);
 *   orchestrator.register(scoringModule);
 *   await orchestrator.run(ctx);
 */

import type { HarnessContext } from './context/context.js';
import type { ModuleManifest, RunnerRunResult } from './runner/types.js';

/**
 * Topological sort of module manifests based on dependencies.
 * Modules with no dependencies come first.
 */
export function topologicalSort(manifests: ModuleManifest[]): ModuleManifest[] {
  const sorted: ModuleManifest[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(m: ModuleManifest) {
    if (visited.has(m.name)) return;
    if (visiting.has(m.name)) {
      throw new Error(`Circular dependency detected involving module: ${m.name}`);
    }

    visiting.add(m.name);

    for (const dep of m.dependencies ?? []) {
      const depManifest = manifests.find((x) => x.name === dep);
      if (depManifest) visit(depManifest);
    }

    visiting.delete(m.name);
    visited.add(m.name);
    sorted.push(m);
  }

  for (const m of manifests) {
    visit(m);
  }

  return sorted;
}

export interface ModuleRunResult {
  name: string;
  success: boolean;
  durationMs: number;
  artifactKeys: string[];
  error?: string;
  itemCount?: number;
  passedCount?: number;
  failedCount?: number;
}

/**
 * Orchestrates multiple harness modules in dependency order.
 *
 * Key features:
 * - Topological sort for correct execution order
 * - Shared artifact store for inter-module data passing
 * - Per-module telemetry with module prefix
 * - Budget tracking across all modules
 * - Graceful degradation: if a required module fails, downstream is skipped
 */
export class HarnessOrchestrator {
  private modules: ModuleManifest[] = [];

  register<T = unknown, R = void, M = Record<string, unknown>>(
    manifest: ModuleManifest<T, R, M>,
  ): void {
    const existing = this.modules.find((m) => m.name === manifest.name);
    if (existing) {
      throw new Error(`Module already registered: ${manifest.name}`);
    }
    this.modules.push(manifest as ModuleManifest);
  }

  unregister(name: string): void {
    this.modules = this.modules.filter((m) => m.name !== name);
  }

  listModules(): string[] {
    return this.modules.map((m) => m.name);
  }

  /**
   * Run all registered modules in dependency order.
   *
   * @param ctx - The shared harness context
   * @param targetModules - Optional list of module names to run (if not provided, runs all)
   * @param onProgress - Optional progress callback
   */
  async run(
    ctx: HarnessContext,
    targetModules?: string[],
    onProgress?: (result: ModuleRunResult) => void | Promise<void>,
  ): Promise<ModuleRunResult[]> {
    const sorted = topologicalSort(this.modules);
    const filtered = targetModules
      ? sorted.filter((m) => targetModules.includes(m.name))
      : sorted;

    ctx.telemetry.info('orchestrator.start', {
      moduleCount: filtered.length,
      modules: filtered.map((m) => m.name),
    });

    const results: ModuleRunResult[] = [];

    for (const manifest of filtered) {
      const startTime = Date.now();
      ctx.telemetry.info('orchestrator.module.start', { module: manifest.name });

      try {
        const moduleCtx = ctx.derive(manifest.name);

        // Check budget before running
        if (moduleCtx.budget.isExhausted()) {
          ctx.telemetry.warn('orchestrator.module.skip', {
            module: manifest.name,
            reason: 'Budget exhausted',
          });
          results.push({
            name: manifest.name,
            success: false,
            durationMs: Date.now() - startTime,
            artifactKeys: [],
            error: 'Budget exhausted',
          });
          continue;
        }

        // Run the generator (signal is optional)
        const generatorResult = await manifest.generator.generate({ ctx: moduleCtx });

        // Collect artifact keys written during this module run
        const artifactKeys = moduleCtx.artifactStore.keys().filter(
          (k) => !ctx.artifactStore.keys().includes(k),
        );

        const durationMs = Date.now() - startTime;
        ctx.telemetry.info('orchestrator.module.done', {
          module: manifest.name,
          durationMs,
          artifactKeys,
        });

        const result: ModuleRunResult = {
          name: manifest.name,
          success: true,
          durationMs,
          artifactKeys,
          itemCount: moduleCtx.budget.snapshot.itemsProcessed,
          passedCount: moduleCtx.budget.snapshot.itemsProcessed,
        };
        results.push(result);
        await onProgress?.(result);

      } catch (err) {
        const durationMs = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : String(err);
        ctx.telemetry.error('orchestrator.module.error', {
          module: manifest.name,
          error: errorMsg,
          durationMs,
        });

        const result: ModuleRunResult = {
          name: manifest.name,
          success: false,
          durationMs,
          artifactKeys: [],
          error: errorMsg,
        };
        results.push(result);
        await onProgress?.(result);

        // By default, halt on module failure to prevent cascading errors
        // But if the module is optional, continue
        const isRequired = !manifest.name.startsWith('optional.');
        if (isRequired) {
          ctx.telemetry.error('orchestrator.halt_required', {
            module: manifest.name,
          });
          // Add remaining modules as failed
          for (const remaining of filtered.slice(filtered.indexOf(manifest) + 1)) {
            const r: ModuleRunResult = {
              name: remaining.name,
              success: false,
              durationMs: 0,
              artifactKeys: [],
              error: `Skipped due to upstream failure: ${manifest.name}`,
            };
            results.push(r);
            await onProgress?.(r);
          }
          break;
        }
      }
    }

    ctx.telemetry.info('orchestrator.done', {
      totalModules: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });

    return results;
  }
}

/**
 * Build a module manifest from a name, generator, evaluator, and options.
 */
export function defineModule<T = unknown, R = void, M = Record<string, unknown>>(
  name: string,
  generator: ModuleManifest<T, R, M>['generator'],
  opts?: {
    description?: string;
    dependencies?: string[];
    priority?: number;
    evaluator?: ModuleManifest<T, R, M>['evaluator'];
  },
): ModuleManifest<T, R, M> {
  return {
    name,
    generator,
    evaluator: opts?.evaluator,
    dependencies: opts?.dependencies ?? [],
    description: opts?.description,
    priority: opts?.priority ?? 0,
  };
}
