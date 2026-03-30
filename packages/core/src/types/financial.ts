// ── Yahoo Finance raw financial data ─────────────────────────────────────────

export interface YahooFinancials {
  income: {
    date: string;
    symbol: string;
    period: string;
    // Core
    revenue: number | null;
    netIncome: number | null;
    grossProfit: number | null;
    grossProfitRatio: number | null;
    researchAndDevelopmentExpenses: number | null;
    epsdiluted: number | null;
    weightedAverageShsOutDil: number | null;
    // ── Income Statement (expanded) ──────────────────────────
    costOfRevenue: number | null;
    operatingExpenses: number | null;
    sgaExpense: number | null;
    sbcExpense: number | null;
    otherIncomeExpense: number | null;
    depreciationAmortization: number | null;
    operatingIncome: number | null;
    interestExpense: number | null;
    interestIncome: number | null;
    pretaxIncome: number | null;
    incomeTaxExpense: number | null;
    discontinuedOps: number | null;
    dividendsPerShare: number | null;
    // Shares
    weightedAverageSharesBasic: number | null;
  } | null;
  balance: {
    date: string;
    symbol: string;
    period: string;
    totalAssets: number | null;
    totalLiabilities: number | null;
    deferredRevenue: number | null;
    // ── Balance Sheet (expanded) ────────────────────────────
    totalCash: number | null;
    shortTermInvestments: number | null;
    accountsReceivable: number | null;
    inventory: number | null;
    totalCurrentAssets: number | null;
    goodwill: number | null;
    intangibleAssets: number | null;
    ppneNet: number | null;
    totalDebt: number | null;
    totalCurrentLiabilities: number | null;
    operatingLeaseLiability: number | null;
    longTermDebt: number | null;
    retainedEarnings: number | null;
    totalStockholdersEquity: number | null;
  } | null;
  cashFlow: {
    date: string;
    symbol: string;
    period: string;
    operatingCashFlow: number | null;
    freeCashFlow: number | null;
    // ── Cash Flow (expanded) ─────────────────────────────────
    sbcCashFlow: number | null;
    shareRepurchases: number | null;
    dividendsPaid: number | null;
    debtIssuance: number | null;
    debtRepayment: number | null;
    workingCapitalChange: number | null;
    acquisitionRelatedCash: number | null;
    capitalExpenditure: number | null;
  } | null;
  metrics: {
    date: string;
    symbol: string;
    period: string;
    marketCap: number | null;
    peRatio: number | null;
  } | null;
}

// ── Financial Snapshot (expanded, all P0 raw fields) ────────────────────────

export type DataSource = 'sec' | 'yahoo' | 'merged';

export type FieldSource = 'sec' | 'yahoo' | 'fmp' | 'computed' | 'manual_override';

export interface FieldSources {
  [fieldName: string]: FieldSource;
}

/** All raw financial fields from XBRL / Yahoo Finance. null = 缺失. */
export interface FinancialSnapshot {
  // ── Identity ───────────────────────────────────────────────────────────────
  ticker: string;
  year: number;
  quarter: number;
  source: DataSource;
  fetchedAt: string;
  fieldSources: FieldSources | null;

  // ── Income Statement (raw) ─────────────────────────────────────────────────
  revenue: number | null;
  costOfRevenue: number | null;
  grossMargin: number | null; // alias: grossProfit
  operatingExpenses: number | null;
  sgaExpense: number | null;
  rdExpense: number | null;
  sbcExpense: number | null;
  otherIncomeExpense: number | null;
  depreciationAndAmortization: number | null;
  operatingIncome: number | null;
  interestExpense: number | null;
  interestIncome: number | null;
  pretaxIncome: number | null;
  incomeTaxExpense: number | null;
  discontinuedOperations: number | null;
  netIncome: number | null;

  // ── EPS & Shares ────────────────────────────────────────────────────────────
  epsBasic: number | null;
  epsDiluted: number | null;
  weightedAverageSharesBasic: number | null;
  weightedAverageSharesDiluted: number | null;
  dividendsPerShare: number | null;

  // ── Balance Sheet ───────────────────────────────────────────────────────────
  totalCash: number | null;
  shortTermInvestments: number | null;
  accountsReceivable: number | null;
  inventory: number | null;
  totalCurrentAssets: number | null;
  goodwill: number | null;
  intangibleAssets: number | null;
  ppneNet: number | null;
  totalAssets: number | null;
  totalCurrentLiabilities: number | null;
  operatingLeaseLiability: number | null;
  longTermDebt: number | null;
  totalDebt: number | null;
  totalLiabilities: number | null;
  retainedEarnings: number | null;
  totalStockholdersEquity: number | null;
  sharesOutstanding: number | null; // period-end shares (non-weighted average)

  // ── Cash Flow ───────────────────────────────────────────────────────────────
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
  freeCashFlow: number | null;
  sbcInCashFlow: number | null;
  shareRepurchases: number | null;
  dividendsPaid: number | null;
  debtIssuance: number | null;
  debtRepayment: number | null;
  workingCapitalChange: number | null;
  acquisitionRelatedCash: number | null;

  // ── Equity / Comprehensive (new) ─────────────────────────────────────────────
  accountsPayable: number | null;
  accumulatedOtherComprehensiveIncome: number | null;
  additionalPaidInCapital: number | null;
  treasuryStock: number | null;
  preferredStock: number | null;
  minorityInterest: number | null;
  comprehensiveIncome: number | null;
  netIncomeAttributableToNoncontrolling: number | null;
  proceedsFromStockOptions: number | null;
  excessTaxBenefit: number | null;

  // ── Deferred Revenue / RPO ─────────────────────────────────────────────────
  deferredRevenue: number | null;
  rpo: number | null;

  // ── Market & Valuation ─────────────────────────────────────────────────────
  marketCap: number | null;
  peRatio: number | null;

  // ── Supplementary / Derived (backwards-compatible fields) ──────────────────
  grossMarginPct: number | null;
  fcfMarginPct: number | null;
  revenueGrowthYoY: number | null;

  // ── Full Derived Metrics (computed by computeDerivedMetrics) ───────────────
  // Margins
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  ebitdaMarginPct: number | null;
  rdIntensityPct: number | null;
  sbcIntensityPct: number | null;
  sgaToGrossProfitPct: number | null;
  effectiveTaxRate: number | null;
  // Per-share
  bookValuePerShare: number | null;
  ocfPerShare: number | null;
  fcfPerShare: number | null;
  ocfpsGrowthYoY: number | null;
  fcfpsGrowthYoY: number | null;
  // Leverage
  debtToEquity: number | null;
  debtToEbitda: number | null;
  netDebt: number | null;
  netDebtToEbitda: number | null;
  interestCoverage: number | null;
  // Liquidity
  currentRatio: number | null;
  quickRatio: number | null;
  cashRatio: number | null;
  // Efficiency
  assetTurnover: number | null;
  roa: number | null;
  roe: number | null;
  roic: number | null;
  ownersEarnings: number | null;
  capexToOcfPct: number | null;
  fcfToNetIncomePct: number | null;
  // Working capital
  netWorkingCapital: number | null;
  dso: number | null;
  dio: number | null;
  dpo: number | null;
  cashConversionCycle: number | null;
  inventoryTurnover: number | null;
  // Growth (YoY — set when prior period available)
  netIncomeGrowthYoY: number | null;
  operatingIncomeGrowthYoY: number | null;
  fcfGrowthYoY: number | null;
  odfGrowthYoY: number | null;
  assetGrowthYoY: number | null;
  equityGrowthYoY: number | null;
  // Valuation
  earningsYield: number | null;
  fcfYield: number | null;
  dividendYield: number | null;
  buybackYield: number | null;
  totalShareholderYield: number | null;
  // Buffett/Moat
  retainedEarningsToMarketValue: number | null;

  // ── Advanced Scoring Models ──────────────────────────────────────────────────
  altmanZScore: number | null;  // Z > 2.99 safe, 1.81-2.99 grey, < 1.81 distress
  piotroskiFScore: number | null; // 0-9 binary score
  beneishMScore: number | null;  // M > -1.78 suggests manipulation

  // ── Valuation Multiples ─────────────────────────────────────────────────────
  evEbitda: number | null;      // Enterprise Value / EBITDA
  evFcf: number | null;         // Enterprise Value / Free Cash Flow

  // ── CAGR (5-year history) ──────────────────────────────────────────────────
  revenueCAGR3Y: number | null; // FY2022 → FY2025
  revenueCAGR5Y: number | null; // FY2020 → FY2025
  grossMarginStdDev10Y: number | null; // 10-year gross margin std dev
}

// ── Derived / Computed Metrics ─────────────────────────────────────────────

// ── Equity / Comprehensive (raw P0 fields) ─────────────────────────────────────
// These are raw fields added here so computeDerivedMetrics return type is a
// subtype of FinancialSnapshot (spreading DerivedMetrics into a FinancialSnapshot).
export interface EquityRawFields {
  accountsPayable: number | null;
  accumulatedOtherComprehensiveIncome: number | null;
  additionalPaidInCapital: number | null;
  treasuryStock: number | null;
  preferredStock: number | null;
  minorityInterest: number | null;
  comprehensiveIncome: number | null;
  netIncomeAttributableToNoncontrolling: number | null;
  proceedsFromStockOptions: number | null;
  excessTaxBenefit: number | null;
}

export interface DerivedMetrics extends EquityRawFields {
  // Margins
  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  ebitdaMarginPct: number | null;
  fcfMarginPct: number | null;
  rdIntensityPct: number | null;         // R&D / Revenue
  sbcIntensityPct: number | null;        // SBC / Revenue
  sgaToGrossProfitPct: number | null;    // SG&A / Gross Profit
  effectiveTaxRate: number | null;       // Income Tax / Pretax Income

  // Per-share
  bookValuePerShare: number | null;       // Total Equity / Shares Outstanding
  ocfPerShare: number | null;
  fcfPerShare: number | null;
  ocfpsGrowthYoY: number | null;
  fcfpsGrowthYoY: number | null;

  // Leverage
  debtToEquity: number | null;
  debtToEbitda: number | null;
  netDebt: number | null;
  netDebtToEbitda: number | null;
  interestCoverage: number | null;        // EBIT / Interest Expense

  // Liquidity
  currentRatio: number | null;
  quickRatio: number | null;
  cashRatio: number | null;

  // Efficiency
  assetTurnover: number | null;
  roa: number | null;                    // Net Income / Total Assets
  roe: number | null;                    // Net Income / Total Equity
  roic: number | null;                   // NOPAT / Invested Capital
  ownersEarnings: number | null;         // NI + D&A - CapEx (maintenance)
  capexToOcfPct: number | null;          // CapEx / OCF
  fcfToNetIncomePct: number | null;      // FCF / Net Income

  // Working capital
  netWorkingCapital: number | null;      // Current Assets - Current Liabilities
  dso: number | null;                     // Days Sales Outstanding
  dio: number | null;                     // Days Inventory Outstanding
  dpo: number | null;                     // Days Payable Outstanding
  cashConversionCycle: number | null;    // DSO + DIO - DPO
  inventoryTurnover: number | null;

  // Growth (YoY — set when prior period available)
  revenueGrowthYoY: number | null;
  netIncomeGrowthYoY: number | null;
  operatingIncomeGrowthYoY: number | null;
  fcfGrowthYoY: number | null;
  odfGrowthYoY: number | null;
  assetGrowthYoY: number | null;
  equityGrowthYoY: number | null;

  // Valuation
  earningsYield: number | null;           // EPS / Price (or 1/PE)
  fcfYield: number | null;                // FCF / Market Cap
  dividendYield: number | null;
  buybackYield: number | null;            // Share Repurchases / Market Cap
  totalShareholderYield: number | null;   // Div Yield + Buyback Yield

  // Buffett/Moat
  retainedEarningsToMarketValue: number | null;
  grossMarginStdDev10Y: number | null;    // 10-year gross margin std dev (cross-period)

  // ── Advanced Scoring Models ──────────────────────────────────────────────────
  altmanZScore: number | null;
  piotroskiFScore: number | null;
  beneishMScore: number | null;

  // ── Valuation Multiples ─────────────────────────────────────────────────────
  evEbitda: number | null;
  evFcf: number | null;

  // ── CAGR ────────────────────────────────────────────────────────────────────
  revenueCAGR3Y: number | null;
  revenueCAGR5Y: number | null;
}

// ── Utilities ───────────────────────────────────────────────────────────────

export function formatFinancialValue(value: number | null): string {
  if (value === null) return '缺失';
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function calendarQuarterRange(year: number, quarter: number): { start: string; end: string } {
  const qStartMonths = ['', '01', '04', '07', '10'];
  const qEndMonths   = ['', '04', '07', '10', '01'];
  const endYear = quarter === 4 ? year + 1 : year;
  return {
    start: `${year}-${qStartMonths[quarter]}-01`,
    end: `${endYear}-${qEndMonths[quarter]}-01`,
  };
}

export function matchCalendarQuarter(
  results: YahooFinancials[],
  year: number,
  quarter: number,
): YahooFinancials | null {
  const range = calendarQuarterRange(year, quarter);
  return results.find(f => {
    const date = f.income?.date;
    if (!date) return false;
    return date >= range.start && date < range.end;
  }) ?? null;
}
