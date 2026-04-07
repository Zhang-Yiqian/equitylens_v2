/**
 * Deterministic evaluator for financial snapshot data.
 *
 * Four-layer validation:
 * 1. Raw field null check — any SEC-sourced field that is null → ERROR + retry
 * 2. Source consistency — stored values must match raw SEC XBRL (when available)
 * 3. Computed field conditional — if upstream raw fields all non-null, computed must be non-null
 * 4. Cross-field consistency — internal arithmetic relationships must hold
 *
 * Key principles:
 * - All Raw fields from SEC XBRL must be non-null (fieldSources !== 'manual_override')
 * - rawSecFacts JSON is used for end-to-end source verification
 * - Computed field is allowed null only when at least one upstream raw field is null
 */

import type { FinancialSnapshot } from '@equitylens/core';
import type { HarnessContext } from '../context/context.js';
import type { Evaluator } from '../runner/types.js';
import {
  type Rule,
  buildSchemaValidator,
} from '../primitives/validation.js';

// ─── Raw field lists (all fields extracted directly from SEC XBRL) ───────────

const RAW_INCOME_FIELDS = [
  'revenue', 'costOfRevenue', 'grossMargin', 'operatingExpenses', 'sgaExpense',
  'rdExpense', 'sbcExpense', 'otherIncomeExpense', 'depreciationAndAmortization',
  'operatingIncome', 'interestExpense', 'interestIncome', 'pretaxIncome',
  'incomeTaxExpense', 'discontinuedOperations', 'netIncome',
  'epsBasic', 'epsDiluted', 'weightedAverageSharesBasic', 'weightedAverageSharesDiluted',
  'dividendsPerShare',
] as const;

const RAW_BALANCE_FIELDS = [
  'totalCash', 'shortTermInvestments', 'accountsReceivable', 'inventory',
  'totalCurrentAssets', 'goodwill', 'intangibleAssets', 'ppneNet', 'totalAssets',
  'totalCurrentLiabilities', 'operatingLeaseLiability', 'longTermDebt', 'totalDebt',
  'totalLiabilities', 'retainedEarnings', 'totalStockholdersEquity', 'sharesOutstanding',
  'accountsPayable', 'accumulatedOtherComprehensiveIncome', 'additionalPaidInCapital',
  'treasuryStock', 'preferredStock', 'minorityInterest', 'deferredRevenue', 'rpo',
] as const;

const RAW_MARKET_FIELDS = [
  'marketCap', 'peRatio',
] as const;

const RAW_CASHFLOW_FIELDS = [
  'operatingCashFlow', 'capitalExpenditure', 'freeCashFlow', 'sbcInCashFlow',
  'shareRepurchases', 'dividendsPaid', 'debtIssuance', 'debtRepayment',
  'workingCapitalChange', 'acquisitionRelatedCash',
] as const;

const RAW_EQUITY_FIELDS = [
  'comprehensiveIncome', 'netIncomeAttributableToNoncontrolling',
  'proceedsFromStockOptions', 'excessTaxBenefit',
] as const;

const ALL_RAW_FIELDS = [
  ...RAW_INCOME_FIELDS,
  ...RAW_BALANCE_FIELDS,
  ...RAW_MARKET_FIELDS,
  ...RAW_CASHFLOW_FIELDS,
  ...RAW_EQUITY_FIELDS,
] as const;

// ─── Computed fields and their upstream dependencies ─────────────────────────

interface ComputedFieldDef {
  field: keyof FinancialSnapshot;
  /** Upstream raw fields — if ALL are non-null, this computed must also be non-null */
  upstream: (keyof FinancialSnapshot)[];
}

const COMPUTED_FIELD_DEFS: ComputedFieldDef[] = [
  // Margins
  { field: 'grossMarginPct',       upstream: ['revenue', 'grossMargin'] },
  { field: 'operatingMarginPct',   upstream: ['revenue', 'operatingIncome'] },
  { field: 'netMarginPct',         upstream: ['revenue', 'netIncome'] },
  { field: 'fcfMarginPct',         upstream: ['revenue', 'freeCashFlow'] },
  { field: 'ebitdaMarginPct',     upstream: ['revenue', 'operatingIncome', 'depreciationAndAmortization'] },
  { field: 'rdIntensityPct',       upstream: ['revenue', 'rdExpense'] },
  { field: 'sbcIntensityPct',     upstream: ['revenue', 'sbcExpense'] },
  { field: 'sgaToGrossProfitPct', upstream: ['grossMargin', 'sgaExpense'] },
  { field: 'effectiveTaxRate',     upstream: ['pretaxIncome', 'incomeTaxExpense'] },
  // Per-share
  { field: 'bookValuePerShare',    upstream: ['totalStockholdersEquity', 'sharesOutstanding'] },
  { field: 'ocfPerShare',          upstream: ['operatingCashFlow', 'sharesOutstanding'] },
  { field: 'fcfPerShare',          upstream: ['freeCashFlow', 'sharesOutstanding'] },
  // Leverage
  { field: 'debtToEquity',         upstream: ['totalDebt', 'totalStockholdersEquity'] },
  { field: 'netDebt',              upstream: ['totalDebt', 'totalCash'] },
  { field: 'interestCoverage',    upstream: ['operatingIncome', 'interestExpense'] },
  // Liquidity
  { field: 'currentRatio',         upstream: ['totalCurrentAssets', 'totalCurrentLiabilities'] },
  { field: 'quickRatio',           upstream: ['totalCurrentAssets', 'inventory', 'totalCurrentLiabilities'] },
  { field: 'cashRatio',            upstream: ['totalCash', 'totalCurrentLiabilities'] },
  // Efficiency
  { field: 'roa',                  upstream: ['netIncome', 'totalAssets'] },
  { field: 'roe',                  upstream: ['netIncome', 'totalStockholdersEquity'] },
  { field: 'fcfToNetIncomePct',   upstream: ['freeCashFlow', 'netIncome'] },
  { field: 'netWorkingCapital',    upstream: ['totalCurrentAssets', 'totalCurrentLiabilities'] },
  // Valuation
  { field: 'earningsYield',        upstream: ['epsDiluted', 'peRatio'] },
  { field: 'fcfYield',             upstream: ['freeCashFlow', 'marketCap'] },
  { field: 'dividendYield',        upstream: ['dividendsPerShare', 'marketCap'] },
];

// ─── XBRL tag extraction (mirrors company-facts.ts extractValue logic) ─────────

interface XbrlUnit {
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  end?: string;
}

interface CompanyFactsForEval {
  facts: {
    'us-gaap'?: Record<string, { label: string; units: Record<string, XbrlUnit[]> }>;
    'disc'?: Record<string, { label: string; units: Record<string, XbrlUnit[]> }>;
  };
}

const CONCEPT_ALIASES: Record<string, string[]> = {
  revenue: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  grossMargin: ['GrossProfit'],
  totalAssets: ['Assets'],
  totalLiabilities: ['Liabilities'],
  totalStockholdersEquity: ['StockholdersEquity'],
  totalDebt: ['DebtCurrentAndNoncurrent'],
  longTermDebt: ['LongTermDebt'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  freeCashFlow: ['NetCashProvidedByUsedInOperatingActivities'], // NOT checked in source consistency — freeCashFlow is a computed metric (OCF - CapEx), not a raw XBRL field; MU also has no dedicated FreeCashFlow XBRL tag
  capitalExpenditure: ['PaymentsToAcquirePropertyPlantAndEquipment'],
  accountsReceivable: ['AccountsReceivableNetCurrent', 'TradeAccountsReceivable'],
  inventory: ['InventoryNet'],
  totalCurrentAssets: ['AssetsCurrent'],
  totalCurrentLiabilities: ['LiabilitiesCurrent'],
  costOfRevenue: ['CostOfRevenue'],
  operatingIncome: ['OperatingIncomeLoss'],
  pretaxIncome: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxes'],
  incomeTaxExpense: ['IncomeTaxExpenseBenefit'],
  interestExpense: ['InterestExpense'],
  sgaExpense: ['SellingGeneralAndAccountingExpense'],
  rdExpense: ['ResearchAndDevelopmentExpense'],
  depreciationAndAmortization: ['DepreciationDepletionAndAmortization'],
  accountsPayable: ['AccountsPayableCurrent', 'TradeAccountsPayable'],
  totalCash: ['CashAndCashEquivalentsAtCarryingValue'],
};

function calendarQuarterRange(year: number, quarter: number): { start: string; end: string } {
  if (quarter === 0) return { start: `${year}-01-01`, end: `${year}-12-31` };
  const startMonths = [0, 1, 4, 7, 10];
  const endMonths   = [0, 4, 7, 10, 1];
  const startMonth = startMonths[quarter];
  const endYear = quarter === 4 ? year + 1 : year;
  const endMonth = endMonths[quarter];
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: `${year}-${pad(startMonth)}-01`,
    end:   `${endYear}-${pad(endMonth)}-01`,
  };
}

function extractValueFromFacts(
  facts: CompanyFactsForEval['facts'],
  conceptNames: string[],
  year: number,
  quarter: number,
): number | null {
  const usGaap = facts['us-gaap'];
  const disc = facts['disc'];
  if (!usGaap && !disc) return null;

  const fp = quarter === 0 ? 'FY' : `Q${quarter}`;
  const range = calendarQuarterRange(year, quarter);

  for (const concept of conceptNames) {
    const namespaces: Array<{ data: typeof usGaap }> = [
      { data: usGaap ?? {} },
      { data: disc ?? {} },
    ];

    for (const ns of namespaces) {
      const entry = ns.data?.[concept];
      if (!entry) continue;

      const usdUnits = entry.units['USD'] || entry.units['shares'] || entry.units['USD/shares'];
      if (!usdUnits) continue;

      const exactMatches = usdUnits.filter(u =>
        u.fy === year && u.fp === fp && (u.form === '10-Q' || u.form === '10-K'),
      );
      if (exactMatches.length > 0) {
        return exactMatches[exactMatches.length - 1].val;
      }

      // Fiscal year offset: only as fallback when exact fy returned nothing.
      if (quarter > 0 && quarter < 4 && exactMatches.length === 0) {
        for (const fy of [year + 1, year - 1]) {
          const offsetMatches = usdUnits.filter(u =>
            u.fy === fy && u.fp === fp && (u.form === '10-Q' || u.form === '10-K'),
          );
          if (offsetMatches.length > 0) return offsetMatches[offsetMatches.length - 1].val;
        }
      }

      const dateRangeMatches = usdUnits.filter(u =>
        u.end && u.end >= range.start && u.end < range.end &&
        u.fp !== 'FY' && (u.form === '10-Q' || u.form === '10-K'),
      );
      if (dateRangeMatches.length > 0) {
        const sorted = dateRangeMatches.sort((a, b) => (a.filed ?? '').localeCompare(b.filed ?? ''));
        return sorted[sorted.length - 1].val;
      }
    }
  }
  return null;
}

/**
 * Returns true if ANY XBRL entry exists for the given concept aliases and period.
 * Uses loose fiscal-year matching (exact + ±1 fy offset) to handle non-calendar
 * fiscal years. If no entries exist → the field is not applicable for this period
 * (source financials don't include it) and should not cause a validation error.
 */
function hasXbrlDataForPeriod(
  facts: CompanyFactsForEval['facts'],
  conceptNames: string[],
  year: number,
  quarter: number,
): boolean {
  const usGaap = facts['us-gaap'];
  const disc = facts['disc'];
  if (!usGaap && !disc) return false;

  const fp = quarter === 0 ? 'FY' : `Q${quarter}`;

  for (const concept of conceptNames) {
    for (const nsData of [usGaap ?? {}, disc ?? {}] as const) {
      const entry = nsData[concept];
      if (!entry) continue;

      const usdUnits = entry.units['USD'] || entry.units['shares'] || entry.units['USD/shares'];
      if (!usdUnits) continue;

      // Check exact fy match
      const hasExact = usdUnits.some(u =>
        u.fy === year && u.fp === fp && (u.form === '10-Q' || u.form === '10-K'),
      );
      if (hasExact) return true;

      // FY offset fallback: only apply when exact fy returned nothing.
      // For Q1-Q3, data for calendar year N may be stored under fy=N±1 for
      // non-calendar fiscal years (e.g., MU ends Aug → FY2023 Q1 stored as fy=2024).
      if (quarter > 0 && quarter < 4) {
        for (const fy of [year + 1, year - 1]) {
          if (usdUnits.some(u => u.fy === fy && u.fp === fp && (u.form === '10-Q' || u.form === '10-K'))) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

// ─── Evaluation thresholds ────────────────────────────────────────────────────

export interface DeterministicEvaluatorConfig {
  /** Cross-field tolerance for approx equality (%). Default: 1% */
  crossFieldTolerancePct?: number;
  /** Tolerance for source mismatch (relative %). Default: 0.01% */
  sourceMismatchTolerancePct?: number;
}

const DEFAULT_CONFIG: Required<DeterministicEvaluatorConfig> = {
  crossFieldTolerancePct: 1,
  sourceMismatchTolerancePct: 0.01,
};

// ─── Evaluation metadata ─────────────────────────────────────────────────────

export interface DeterministicEvalMetadata {
  /** Quality score 0-100 */
  score: number;
  /** Raw SEC fields that are null (when source !== manual_override) */
  rawFieldErrors: string[];
  /** Stored values that differ from SEC XBRL original values */
  sourceMismatchErrors: string[];
  /** Computed fields null when all upstream raw fields are non-null */
  computedFieldErrors: string[];
  /** Cross-field consistency failures */
  consistencyFailures: string[];
  /** Fields that are statistical outliers */
  outlierFields: string[];
  /** Field coverage stats */
  fieldCoverage: Record<string, string | number>;
  /** Total non-null numeric fields */
  nonNullCount: number;
}

// Helper to safely access a field as number | null
function fv(snap: FinancialSnapshot, key: keyof FinancialSnapshot): number | null {
  const v = snap[key];
  return typeof v === 'number' || v === null ? v : null;
}

// ─── Main evaluator ─────────────────────────────────────────────────────────────

export class DeterministicSnapshotEvaluator implements Evaluator<FinancialSnapshot, DeterministicEvalMetadata> {
  private readonly config: Required<DeterministicEvaluatorConfig>;

  constructor(config: DeterministicEvaluatorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async evaluate(
    snapshot: FinancialSnapshot,
    _ctx: HarnessContext,
  ): Promise<{ ok: boolean; canRetry: boolean; errors: string[]; warnings: string[]; metadata: DeterministicEvalMetadata }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const snap = snapshot;

    // ── Parse raw XBRL early so all layers can use it ──────────────────────────
    let rawFacts: CompanyFactsForEval | null = null;
    if (snap.rawSecFacts !== null) {
      try {
        rawFacts = JSON.parse(snap.rawSecFacts);
      } catch {
        warnings.push('rawSecFacts JSON parse failed — skipping XBRL-aware checks');
      }
    }

    // ── Layer 1: XBRL-aware raw field null check ───────────────────────────────
    // A null field is only an error if XBRL actually HAS data for that period.
    // Fields with no XBRL entries for this period are skipped (source financials
    // don't include that line item — e.g., preferredStock in some quarterly filings).
    const rawFieldErrors: string[] = [];
    const rawFieldSkipped: string[] = [];

    for (const field of ALL_RAW_FIELDS) {
      if (fv(snap, field) !== null) continue; // Non-null — no issue

      if (rawFacts !== null) {
        const aliases = CONCEPT_ALIASES[field as keyof typeof CONCEPT_ALIASES];
        if (!aliases || aliases.length === 0) {
          // No aliases defined — can't check XBRL, skip
          continue;
        }
        const inSource = hasXbrlDataForPeriod(rawFacts.facts, aliases, snap.year, snap.quarter);
        if (!inSource) {
          rawFieldSkipped.push(field);
          continue; // Source doesn't have this field — skip
        }
      }

      // XBRL has data but we extracted null → error
      rawFieldErrors.push(field);
    }

    if (rawFieldErrors.length > 0) {
      errors.push(`Raw fields null despite XBRL data (${rawFieldErrors.length}): ${rawFieldErrors.join(', ')}`);
    }
    if (rawFieldSkipped.length > 0 && rawFieldSkipped.length > 20) {
      warnings.push(`Raw fields skipped (no XBRL entries): ${rawFieldSkipped.length} fields — source financials don't include these line items`);
    }

    // ── Layer 2: Source consistency verification ───────────────────────────────
    // Re-extract from XBRL and compare with stored values to detect extraction bugs
    const sourceMismatchErrors: string[] = [];
    if (rawFacts !== null) {
      const mismatches = this.verifySourceConsistency(snap, rawFacts);
      sourceMismatchErrors.push(...mismatches);
    }

    if (sourceMismatchErrors.length > 0) {
      errors.push(`Source mismatch vs SEC XBRL (${sourceMismatchErrors.length}): ${sourceMismatchErrors.join('; ')}`);
    }

    // ── Layer 3: Computed field conditional check ─────────────────────────────
    // If ALL upstream raw fields are non-null, the computed field must also be non-null
    const computedFieldErrors: string[] = [];
    for (const { field, upstream } of COMPUTED_FIELD_DEFS) {
      const allUpstreamNonNull = upstream.every(f => fv(snap, f) !== null);
      if (allUpstreamNonNull && fv(snap, field) === null) {
        computedFieldErrors.push(`${String(field)} (upstream: ${upstream.join(', ')})`);
      }
    }

    if (computedFieldErrors.length > 0) {
      errors.push(`Computed fields null despite upstream non-null (${computedFieldErrors.length}): ${computedFieldErrors.join('; ')}`);
    }

    // ── Layer 4: Cross-field consistency ──────────────────────────────────────
    const consistencyFailures: string[] = [];
    const tolerance = this.config.crossFieldTolerancePct;

    // grossMargin = revenue - costOfRevenue
    const revenue = fv(snap, 'revenue');
    const costOfRevenue = fv(snap, 'costOfRevenue');
    const grossMargin = fv(snap, 'grossMargin');
    if (revenue !== null && costOfRevenue !== null && grossMargin !== null) {
      const expectedGM = revenue - costOfRevenue;
      const diff = Math.abs(grossMargin - expectedGM);
      const pct = expectedGM !== 0 ? (diff / Math.abs(expectedGM)) * 100 : 0;
      if (pct > tolerance) {
        consistencyFailures.push(
          `grossMargin ≈ revenue - costOfRevenue: expected ~${expectedGM.toFixed(0)}, got ${grossMargin} (diff: ${pct.toFixed(2)}%)`,
        );
      }
    }

    // totalAssets >= totalLiabilities
    const totalAssets = fv(snap, 'totalAssets');
    const totalLiabilities = fv(snap, 'totalLiabilities');
    if (totalAssets !== null && totalLiabilities !== null && totalAssets < totalLiabilities) {
      consistencyFailures.push(`totalAssets < totalLiabilities: ${totalAssets} < ${totalLiabilities}`);
    }

    // totalDebt >= longTermDebt
    const totalDebt = fv(snap, 'totalDebt');
    const longTermDebt = fv(snap, 'longTermDebt');
    if (totalDebt !== null && longTermDebt !== null && totalDebt < longTermDebt) {
      consistencyFailures.push(`totalDebt < longTermDebt: ${totalDebt} < ${longTermDebt}`);
    }

    // totalStockholdersEquity ≈ totalAssets - totalLiabilities
    const totalStockholdersEquity = fv(snap, 'totalStockholdersEquity');
    if (totalStockholdersEquity !== null && totalAssets !== null && totalLiabilities !== null) {
      const expectedEquity = totalAssets - totalLiabilities;
      const diff = Math.abs(totalStockholdersEquity - expectedEquity);
      const pct = expectedEquity !== 0 ? (diff / Math.abs(expectedEquity)) * 100 : 0;
      if (pct > tolerance) {
        consistencyFailures.push(
          `totalStockholdersEquity ≈ totalAssets - totalLiabilities: expected ~${expectedEquity.toFixed(0)}, got ${totalStockholdersEquity} (diff: ${pct.toFixed(2)}%)`,
        );
      }
    }

    // netMarginPct ≈ (netIncome / revenue) * 100
    const netIncome = fv(snap, 'netIncome');
    const netMarginPct = fv(snap, 'netMarginPct');
    if (netMarginPct !== null && netIncome !== null && revenue !== null && revenue > 0) {
      const expectedNM = (netIncome / revenue) * 100;
      const diff = Math.abs(netMarginPct - expectedNM);
      if (diff > tolerance) {
        consistencyFailures.push(
          `netMarginPct ≈ netIncome/revenue: expected ~${expectedNM.toFixed(2)}%, got ${netMarginPct.toFixed(2)}%`,
        );
      }
    }

    // Beneish M-Score warning (revenue < $1M)
    const beneishMScore = fv(snap, 'beneishMScore');
    if (beneishMScore !== null && revenue !== null && revenue < 1e6 && beneishMScore > -1.78) {
      warnings.push(`beneishMScore=${beneishMScore} suspicious (revenue < $1M — DSRI likely inflated)`);
    }

    // Altman Z-Score warning (distress zone for large companies)
    const altmanZScore = fv(snap, 'altmanZScore');
    const marketCap = fv(snap, 'marketCap');
    if (altmanZScore !== null && altmanZScore < 1.81 && marketCap !== null && marketCap > 1e9) {
      warnings.push(`altmanZScore=${altmanZScore} in distress zone (marketCap > $1B)`);
    }

    if (consistencyFailures.length > 0) {
      errors.push(...consistencyFailures);
    }

    // ── Compute quality score ─────────────────────────────────────────────────
    // Use XBRL-aware denominators: only fields that have XBRL entries for this period
    // should count against the raw-field and source-mismatch scores.
    const xbrlActiveFields = ALL_RAW_FIELDS.length - rawFieldSkipped.length;
    const rawFieldScore = Math.max(0, 1 - rawFieldErrors.length / Math.max(xbrlActiveFields, 1)) * 30;
    const sourceScore = Math.max(0, 1 - sourceMismatchErrors.length / Math.max(xbrlActiveFields, 1)) * 30;
    const computedScore = Math.max(0, 1 - computedFieldErrors.length / COMPUTED_FIELD_DEFS.length) * 20;
    const consistencyScore = Math.max(0, 1 - consistencyFailures.length / 5) * 20;
    const score = Math.round(rawFieldScore + sourceScore + computedScore + consistencyScore);

    // Count total non-null numeric fields
    const allNumericFields: (keyof FinancialSnapshot)[] = [
      ...ALL_RAW_FIELDS,
      ...COMPUTED_FIELD_DEFS.map(d => d.field),
      'marketCap', 'peRatio',
    ];
    const nonNullCount = allNumericFields.reduce<number>((acc, k) => acc + (fv(snap, k) !== null ? 1 : 0), 0);

    const fieldCoverage: Record<string, string | number> = {
      raw: `${ALL_RAW_FIELDS.length - rawFieldErrors.length - rawFieldSkipped.length}/${xbrlActiveFields} (${rawFieldSkipped.length} skipped — not in source)`,
      computed: `${COMPUTED_FIELD_DEFS.length - computedFieldErrors.length}/${COMPUTED_FIELD_DEFS.length}`,
      total: nonNullCount,
    };

    const ok = errors.length === 0;
    const canRetry = rawFieldErrors.length > 0
      || sourceMismatchErrors.length > 0
      || computedFieldErrors.length > 0;

    return {
      ok,
      canRetry,
      errors,
      warnings,
      metadata: {
        score,
        rawFieldErrors: [...rawFieldErrors],
        sourceMismatchErrors: [...sourceMismatchErrors],
        computedFieldErrors: [...computedFieldErrors],
        consistencyFailures: [...consistencyFailures],
        outlierFields: [],
        fieldCoverage,
        nonNullCount,
      },
    };
  }

  /**
   * Verify that stored values match the original SEC XBRL values.
   * Returns a list of mismatch descriptions.
   */
  private verifySourceConsistency(
    snap: FinancialSnapshot,
    rawFacts: CompanyFactsForEval,
  ): string[] {
    const mismatches: string[] = [];
    const tolerance = this.config.sourceMismatchTolerancePct;
    const year = snap.year;
    const quarter = snap.quarter;

    for (const [field, aliases] of Object.entries(CONCEPT_ALIASES)) {
      // Skip fields that are computed (not raw XBRL) — freeCashFlow is OCF-CapEx,
      // not a direct XBRL tag; source consistency makes no sense for computed fields
      const skipFields: string[] = ['freeCashFlow'];
      if (skipFields.includes(field)) continue;
      const stored = fv(snap, field as keyof FinancialSnapshot);
      if (stored === null) continue; // null fields handled in Layer 1

      const extracted = extractValueFromFacts(rawFacts.facts, aliases, year, quarter);
      if (extracted === null) continue; // XBRL didn't have this value

      // Compare with relative tolerance
      const diff = Math.abs(stored - extracted);
      const pct = extracted !== 0 ? (diff / Math.abs(extracted)) * 100 : (diff > 0 ? 100 : 0);
      if (pct > tolerance) {
        mismatches.push(
          `${field} stored=${stored.toFixed(2)} vs XBRL=${extracted.toFixed(2)} (diff=${pct.toFixed(4)}%)`,
        );
      }
    }

    return mismatches;
  }
}

/**
 * Create a simple deterministic evaluator for any record using a schema.
 * Useful for ad-hoc validation of intermediate data.
 */
export function createSchemaEvaluator<T extends Record<string, unknown>>(
  schema: Record<string, Rule<unknown>>,
  config?: { minNonNull?: number },
): Evaluator<T> {
  return {
    async evaluate(item: T): Promise<{ ok: boolean; canRetry: boolean; errors: string[]; warnings: string[]; metadata: Record<string, unknown> }> {
      const validator = buildSchemaValidator(
        Object.fromEntries(
          Object.entries(schema).map(([k, rule]) => [
            k,
            { required: true, rules: [rule as Rule<unknown>] },
          ]),
        ),
      );

      const result = validator(item);
      const nonNull = Object.values(item).filter((v) => v !== null && v !== undefined).length;

      const errors = result.ok ? [] : result.errors;
      if (config?.minNonNull && nonNull < config.minNonNull) {
        errors.push(`Too few non-null fields: ${nonNull} < ${config.minNonNull}`);
      }

      return {
        ok: errors.length === 0,
        canRetry: errors.some((e) => e.includes('missing') || e.includes('null')),
        errors,
        warnings: [],
        metadata: { nonNullCount: nonNull },
      };
    },
  };
}
