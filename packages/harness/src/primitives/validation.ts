/**
 * Composable validation rules for harness modules.
 *
 * Each rule is a pure function: (value: unknown) => ValidationResult
 * Rules can be composed with `and`, `or`, and `chain`.
 *
 * Usage:
 *   const isPositiveRevenue = and(isNumber, (v) => v > 0 ? ok() : fail('must be positive'));
 *   const result = isPositiveRevenue(data.revenue);
 */

export type ValidationResult = {
  ok: true;
} | {
  ok: false;
  errors: string[];
};

export function ok(): ValidationResult {
  return { ok: true };
}

export function fail(error: string): ValidationResult;
export function fail(errors: string[]): ValidationResult;
export function fail(errorOrErrors: string | string[]): ValidationResult {
  return {
    ok: false,
    errors: Array.isArray(errorOrErrors) ? errorOrErrors : [errorOrErrors],
  };
}

export function merge(a: ValidationResult, b: ValidationResult): ValidationResult {
  if (a.ok && b.ok) return ok();
  return {
    ok: false,
    errors: [
      ...(a.ok ? [] : a.errors),
      ...(b.ok ? [] : b.errors),
    ],
  };
}

/** A validation rule */
export type Rule<T = unknown> = (value: T) => ValidationResult;

/** Combine multiple rules with AND logic (all must pass) */
export function and<T>(...rules: Rule<T>[]): Rule<T> {
  return (value: T) => {
    const allErrors: string[] = [];
    for (const rule of rules) {
      const result = rule(value);
      if (result.ok) continue;
      allErrors.push(...result.errors);
    }
    return allErrors.length === 0 ? ok() : fail(allErrors);
  };
}

/** Combine multiple rules with OR logic (at least one must pass) */
export function or<T>(...rules: Rule<T>[]): Rule<T> {
  return (value: T) => {
    for (const rule of rules) {
      const result = rule(value);
      if (result.ok) return ok();
    }
    const allErrors: string[] = [];
    for (const rule of rules) {
      const result = rule(value);
      if (!result.ok) allErrors.push(...result.errors);
    }
    return fail(allErrors);
  };
}

/** Negate a rule */
export function not<T>(rule: Rule<T>, errorMsg?: string): Rule<T> {
  return (value: T) => {
    const result = rule(value);
    if (result.ok) return fail(errorMsg ?? 'rule unexpectedly passed');
    return ok();
  };
}

// ─── Primitive rules ─────────────────────────────────────────────────────────

/** Succeeds if value is not null or undefined */
export function isDefined<T>(value: T | null | undefined): ValidationResult {
  return value !== null && value !== undefined ? ok() : fail('value is null or undefined');
}

/** Succeeds if value is a number and not NaN */
export function isNumber(value: unknown): ValidationResult {
  return typeof value === 'number' && !isNaN(value) ? ok() : fail('not a number');
}

/** Succeeds if value is a string and non-empty */
export function isNonEmptyString(value: unknown): ValidationResult {
  return typeof value === 'string' && value.length > 0 ? ok() : fail('not a non-empty string');
}

/** Check value is within a numeric range (inclusive) */
export function inRange(min: number, max: number): Rule<number> {
  return (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return fail('not a number');
    if (value < min || value > max) return fail(`out of range [${min}, ${max}]: got ${value}`);
    return ok();
  };
}

/** Check value is positive (> 0) */
export function isPositive(value: unknown): ValidationResult {
  if (typeof value !== 'number' || isNaN(value)) return fail('not a number');
  return value > 0 ? ok() : fail(`must be positive, got ${value}`);
}

/** Check value is non-negative (>= 0) */
export function isNonNegative(value: unknown): ValidationResult {
  if (typeof value !== 'number' || isNaN(value)) return fail('not a number');
  return value >= 0 ? ok() : fail(`must be non-negative, got ${value}`);
}

/** Check absolute value is below a threshold */
export function absBelow(threshold: number): Rule<number> {
  return (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return fail('not a number');
    return Math.abs(value) < threshold ? ok() : fail(`|value| must be < ${threshold}, got ${value}`);
  };
}

/** Check value is one of allowed enum values */
export function isEnum<T>(allowed: T[]): Rule<T> {
  return (value: T) => {
    return allowed.includes(value) ? ok() : fail(`not in enum: ${allowed.join(', ')}`);
  };
}

/** Check array has at least minLength elements */
export function hasMinLength(minLength: number): Rule<unknown[]> {
  return (value: unknown[]) => {
    if (!Array.isArray(value)) return fail('not an array');
    return value.length >= minLength ? ok() : fail(`array length ${value.length} < ${minLength}`);
  };
}

/** Check all elements of an array satisfy a rule */
export function every<T>(rule: Rule<T>): Rule<T[]> {
  return (value: T[]) => {
    if (!Array.isArray(value)) return fail('not an array');
    const errors: string[] = [];
    for (let i = 0; i < value.length; i++) {
      const result = rule(value[i]);
      if (!result.ok) {
        errors.push(...result.errors.map((e: string) => `[${i}]: ${e}`));
      }
    }
    return errors.length === 0 ? ok() : fail(errors);
  };
}

/** Check that a required field is present in an object */
export function hasField<K extends string>(
  key: K,
  rule?: Rule<unknown>,
): Rule<Record<string, unknown>> {
  return (obj: Record<string, unknown>) => {
    if (!(key in obj)) return fail(`missing required field: ${key}`);
    if (rule) return rule(obj[key]);
    return ok();
  };
}

/** Check field with a specific rule */
export function checkField<K extends string, T>(
  key: K,
  rule: Rule<T>,
): Rule<Record<string, unknown>> {
  return (obj: Record<string, unknown>) => {
    if (!(key in obj)) return fail(`missing required field: ${key}`);
    return rule(obj[key] as T);
  };
}

/** Check the count of non-null/undefined values in an object meets a threshold */
export function nonNullCount(minCount: number): Rule<Record<string, unknown>> {
  return (obj: Record<string, unknown>) => {
    const count = Object.values(obj).filter((v) => v !== null && v !== undefined).length;
    return count >= minCount ? ok() : fail(`non-null count ${count} < ${minCount}`);
  };
}

/** Check two fields satisfy a relation (e.g., assets > liabilities) */
export function relate<T, U>(
  fieldA: string,
  fieldB: string,
  relation: (a: T, b: U) => boolean,
  description: string,
): Rule<Record<string, unknown>> {
  return (obj: Record<string, unknown>) => {
    const a = obj[fieldA];
    const b = obj[fieldB];
    if (a === null || a === undefined || b === null || b === undefined) return ok(); // skip if either missing
    try {
      return relation(a as T, b as U) ? ok() : fail(`${fieldA} must ${description} ${fieldB}`);
    } catch {
      return fail(`cannot apply relation between ${fieldA} and ${fieldB}`);
    }
  };
}

/** Cross-field consistency check: fieldA should approximately equal fieldB (within tolerance) */
export function approxEqual(
  fieldA: string,
  fieldB: string,
  tolerancePct: number = 1,
): Rule<Record<string, unknown>> {
  return (obj: Record<string, unknown>) => {
    const a = obj[fieldA];
    const b = obj[fieldB];
    if (a === null || a === undefined || b === null || b === undefined) return ok();
    if (typeof a !== 'number' || typeof b !== 'number') return ok();
    if (b === 0) return a === 0 ? ok() : fail(`${fieldA}=${a} vs ${fieldB}=0 (exact mismatch)`);
    const diff = Math.abs((a - b) / b);
    return diff <= tolerancePct / 100 ? ok() : fail(`${fieldA}=${a} vs ${fieldB}=${b}: diff ${(diff * 100).toFixed(2)}% > ${tolerancePct}%`);
  };
}

/** Compose multiple field checks into a single rule for an object */
export function object<T extends Record<string, unknown>>(rules: {
  [K in keyof T]?: Rule<T[K]>;
}): Rule<T> {
  return (obj: T) => {
    const errors: string[] = [];
    for (const [key, rule] of Object.entries(rules)) {
      if (!rule) continue;
      const result = rule(obj[key]);
      if (!result.ok) {
        errors.push(...result.errors.map((e: string) => `${String(key)}: ${e}`));
      }
    }
    return errors.length === 0 ? ok() : fail(errors);
  };
}

/** Map a rule over an object — useful for validating each field */
export function mapValues<T>(
  rule: Rule<T>,
): Rule<Record<string, T>> {
  return (obj: Record<string, T>) => {
    const errors: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const result = rule(value);
      if (!result.ok) {
        errors.push(...result.errors.map((e: string) => `${key}: ${e}`));
      }
    }
    return errors.length === 0 ? ok() : fail(errors);
  };
}

// ─── Schema-like validator builder ───────────────────────────────────────────

/**
 * Validate a snapshot-like object against a schema definition.
 *
 * Usage:
 *   const validator = buildSchemaValidator({
 *     required: ['revenue', 'netIncome', 'totalAssets'],
 *     rules: {
 *       revenue: [isDefined, isPositive],
 *       grossMargin: inRange(0, 100),
 *     },
 *   });
 *   const result = validator(snapshot);
 */
export interface FieldSchema {
  /** Fail if this field is missing or null */
  required?: boolean;
  /** Validation rules to apply */
  rules?: Rule<unknown>[];
}

export type SchemaDefinition = Record<string, FieldSchema>;

export function buildSchemaValidator(schema: SchemaDefinition): Rule<Record<string, unknown>> {
  return (obj: Record<string, unknown>) => {
    const errors: string[] = [];

    for (const [field, fieldSchema] of Object.entries(schema)) {
      const value = obj[field];

      // Required check
      if (fieldSchema.required && (value === null || value === undefined)) {
        errors.push(`${field}: required field is missing`);
        continue;
      }

      // Skip rule validation if value is missing and not required
      if (value === null || value === undefined) continue;

      // Apply field rules
      if (fieldSchema.rules) {
        for (const rule of fieldSchema.rules) {
          const result = rule(value);
          if (!result.ok) {
            errors.push(...result.errors.map((e: string) => `${field}: ${e}`));
          }
        }
      }
    }

    return errors.length === 0 ? ok() : fail(errors);
  };
}
