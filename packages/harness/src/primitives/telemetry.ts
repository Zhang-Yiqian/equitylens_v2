/**
 * Structured telemetry for harness runs.
 *
 * Replaces ad-hoc console.log/warn/error with a structured event system.
 * Telemetry handlers are objects with a `handle(event)` method.
 *
 * Log levels: debug < info < warn < error < fatal
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export const LOG_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

export interface TelemetryEvent {
  /** ISO timestamp */
  timestamp: string;
  /** Event name (e.g., 'module.generate', 'evaluator.pass', 'runner.retry') */
  name: string;
  /** Structured payload */
  payload?: Record<string, unknown>;
  /** Module name if applicable */
  module?: string;
  /** Nesting level (0 = root) */
  depth: number;
}

/** A telemetry handler processes events */
export interface TelemetryHandler {
  handle(event: TelemetryEvent): void;
}

/** Object-style handler that wraps a function */
export class FnTelemetryHandler implements TelemetryHandler {
  constructor(private readonly fn: (event: TelemetryEvent) => void) {}
  handle(event: TelemetryEvent): void {
    this.fn(event);
  }
}

/** Console handler that formats events as readable strings */
export function consoleHandler(minLevel: LogLevel = LogLevel.INFO): TelemetryHandler {
  return new FnTelemetryHandler((event: TelemetryEvent) => {
    const level = event.payload?.['level'] as LogLevel | undefined;
    if (level !== undefined && level < minLevel) return;

    const indent = '  '.repeat(event.depth);
    const label = LOG_LABELS[level ?? LogLevel.INFO] ?? 'INFO';
    const module = event.module ? `[${event.module}] ` : '';
    const name = event.name;
    const payload = event.payload ? ` ${JSON.stringify(event.payload)}` : '';

    const formatted = `${indent}${label} ${module}${name}${payload}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).console;
    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      c?.error(formatted);
    } else if (level === LogLevel.WARN) {
      c?.warn(formatted);
    } else {
      c?.log(formatted);
    }
  });
}

/** In-memory buffer handler — useful for tests and inspection */
export class MemoryTelemetryHandler implements TelemetryHandler {
  private _events: TelemetryEvent[] = [];

  handle(event: TelemetryEvent): void {
    this._events.push({ ...event });
  }

  get events_(): readonly TelemetryEvent[] {
    return this._events;
  }

  getEventsByName(name: string): readonly TelemetryEvent[] {
    return this._events.filter((e) => e.name === name);
  }

  getEventsByModule(module: string): readonly TelemetryEvent[] {
    return this._events.filter((e) => e.module === module);
  }

  clear(): void {
    this._events = [];
  }

  /** Summarize events into a human-readable string */
  summary(): string {
    const counts: Record<string, number> = {};
    for (const e of this._events) {
      counts[e.name] = (counts[e.name] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => `  ${name}: ${count}`)
      .join('\n');
  }
}

/** Composite handler that delegates to multiple handlers */
export class CompositeTelemetryHandler implements TelemetryHandler {
  private handlers: TelemetryHandler[] = [];

  add(handler: TelemetryHandler): void {
    this.handlers.push(handler);
  }

  handle(event: TelemetryEvent): void {
    for (const handler of this.handlers) {
      handler.handle(event);
    }
  }
}

/**
 * Telemetry context — manages handlers and emits structured events.
 *
 * Usage:
 *   const telemetry = new Telemetry('financial-data');
 *   telemetry.on(consoleHandler(LogLevel.INFO));
 *
 *   telemetry.emit('generate.start', { ticker: 'NVDA', year: 2024 });
 *   telemetry.emit('generate.item', { ticker: 'NVDA', year: 2024, quarter: 1 });
 *   telemetry.emit('generate.done', { count: 40 });
 */
export class Telemetry {
  readonly module: string;
  private handlers: TelemetryHandler[] = [];
  private depth = 0;
  private globalMinLevel: LogLevel;

  constructor(module: string, minLevel: LogLevel = LogLevel.INFO) {
    this.module = module;
    this.globalMinLevel = minLevel;
  }

  /** Register a telemetry handler */
  on(handler: TelemetryHandler): void {
    this.handlers.push(handler);
  }

  /** Unregister all handlers */
  off(): void {
    this.handlers = [];
  }

  /** Increment depth for nested operations */
  nest<T>(label: string, fn: () => T): T {
    this.emit(`${label}.enter`);
    this.depth++;
    try {
      return fn();
    } finally {
      this.depth--;
      this.emit(`${label}.exit`);
    }
  }

  /** Async version of nest */
  async nestAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.emit(`${label}.enter`);
    this.depth++;
    try {
      return await fn();
    } finally {
      this.depth--;
      this.emit(`${label}.exit`);
    }
  }

  /**
   * Emit a telemetry event to all handlers.
   * Payload can include a `level` field to override the default log level.
   */
  emit(name: string, payload?: Record<string, unknown>): void {
    const level = (payload?.['level'] as LogLevel | undefined) ?? this.defaultLevel(name);
    if (level < this.globalMinLevel) return;

    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      name,
      payload,
      module: this.module,
      depth: this.depth,
    };

    for (const handler of this.handlers) {
      handler.handle(event);
    }
  }

  /** Determine default log level from event name */
  private defaultLevel(name: string): LogLevel {
    if (name.endsWith('.error') || name.endsWith('.fail') || name.endsWith('.fatal')) {
      return LogLevel.ERROR;
    }
    if (name.endsWith('.warn') || name.endsWith('.retry')) return LogLevel.WARN;
    if (name.endsWith('.enter') || name.endsWith('.exit') || name.endsWith('.start') || name.endsWith('.done')) {
      return LogLevel.DEBUG;
    }
    return LogLevel.INFO;
  }

  // Convenience methods
  debug(name: string, payload?: Record<string, unknown>): void {
    this.emit(name, { ...payload, level: LogLevel.DEBUG });
  }

  info(name: string, payload?: Record<string, unknown>): void {
    this.emit(name, { ...payload, level: LogLevel.INFO });
  }

  warn(name: string, payload?: Record<string, unknown>): void {
    this.emit(name, { ...payload, level: LogLevel.WARN });
  }

  error(name: string, payload?: Record<string, unknown>): void {
    this.emit(name, { ...payload, level: LogLevel.ERROR });
  }
}
