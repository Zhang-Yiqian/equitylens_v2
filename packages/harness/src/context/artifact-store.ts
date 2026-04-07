/**
 * Artifact Store — a KV store for structured inter-module data passing.
 *
 * Modules write artifacts (labeled key-value snapshots) to the store.
 * Downstream modules read them without importing the source module directly.
 *
 * Key format: `moduleName:artifactName` (e.g., `universe:ai-core-tickers`)
 *
 * This decouples modules: a Trading Strategy module can read the output
 * of Universe Builder without importing it.
 */

export type ArtifactValue = unknown;

export interface Artifact {
  key: string;
  value: ArtifactValue;
  /** Human-readable label for debugging */
  label?: string;
  /** Module that produced this artifact */
  producedBy: string;
  /** When this artifact was produced (ISO timestamp) */
  producedAt: string;
  /** Semantic version or commit hash of the producing module */
  version?: string;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

export interface ArtifactStore {
  /** Get an artifact by key */
  get<T = ArtifactValue>(key: string): T | undefined;
  /** Get an artifact with full metadata */
  getArtifact(key: string): Artifact | undefined;
  /** Set an artifact */
  set(key: string, value: ArtifactValue, options?: Partial<Omit<Artifact, 'key' | 'value'>>): void;
  /** Check if an artifact exists */
  has(key: string): boolean;
  /** Delete an artifact */
  delete(key: string): void;
  /** List all artifacts whose key starts with prefix */
  list(prefix?: string): Artifact[];
  /** Get all keys */
  keys(): string[];
  /** Clear all artifacts (or only those matching a prefix) */
  clear(prefix?: string): void;
  /** Get artifact count */
  get size(): number;
}

/** In-memory artifact store — suitable for single-run contexts */
export class InMemoryArtifactStore implements ArtifactStore {
  private artifacts = new Map<string, Artifact>();

  get<T = ArtifactValue>(key: string): T | undefined {
    return (this.artifacts.get(key)?.value as T) ?? undefined;
  }

  getArtifact(key: string): Artifact | undefined {
    return this.artifacts.get(key);
  }

  set(
    key: string,
    value: ArtifactValue,
    options?: Partial<Omit<Artifact, 'key' | 'value'>>,
  ): void {
    const artifact: Artifact = {
      key,
      value,
      producedBy: options?.producedBy ?? 'unknown',
      producedAt: options?.producedAt ?? new Date().toISOString(),
      label: options?.label,
      version: options?.version,
      metadata: options?.metadata,
    };
    this.artifacts.set(key, artifact);
  }

  has(key: string): boolean {
    return this.artifacts.has(key);
  }

  delete(key: string): void {
    this.artifacts.delete(key);
  }

  list(prefix?: string): Artifact[] {
    if (!prefix) return Array.from(this.artifacts.values());
    return Array.from(this.artifacts.values()).filter((a) => a.key.startsWith(prefix));
  }

  keys(): string[] {
    return Array.from(this.artifacts.keys());
  }

  clear(prefix?: string): void {
    if (!prefix) {
      this.artifacts.clear();
      return;
    }
    for (const key of this.keys()) {
      if (key.startsWith(prefix)) this.artifacts.delete(key);
    }
  }

  get size(): number {
    return this.artifacts.size;
  }
}

/**
 * Snapshot of an artifact store at a point in time.
 * Useful for checkpointing and replay.
 */
export interface ArtifactStoreSnapshot {
  artifacts: Artifact[];
  /** ISO timestamp of the snapshot */
  snapshotAt: string;
  /** Total artifact count */
  count: number;
}

export function snapshotArtifactStore(store: ArtifactStore): ArtifactStoreSnapshot {
  return {
    artifacts: store.list(),
    snapshotAt: new Date().toISOString(),
    count: store.size,
  };
}

/**
 * Restore an artifact store from a snapshot.
 */
export function restoreArtifactStore(
  store: ArtifactStore,
  snapshot: ArtifactStoreSnapshot,
): void {
  store.clear();
  for (const artifact of snapshot.artifacts) {
    store.set(artifact.key, artifact.value, artifact);
  }
}
