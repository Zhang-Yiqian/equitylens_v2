export interface FinancialSnapshot {
  ticker: string;
  year: number;
  quarter: number;
  // Hard Truth fields from SEC EDGAR (nullable = 缺失)
  revenue: number | null;
  netIncome: number | null;
  grossMargin: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  rdExpense: number | null;
  sharesOutstanding: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  eps: number | null;
  // Supplementary fields (Yahoo Finance or derived)
  marketCap: number | null;
  peRatio: number | null;
  revenueGrowthYoY: number | null;
  grossMarginPct: number | null;
  fcfMarginPct: number | null;
  // Deferred revenue / RPO (key inflection signals)
  deferredRevenue: number | null;
  rpo: number | null;
  // Metadata
  source: DataSource;
  fetchedAt: string;
}

export type DataSource = 'sec' | 'yahoo' | 'merged';

export interface HardTruthField {
  value: number | null;
  source: 'sec' | 'yahoo';
  secConcept?: string;
}

export function formatFinancialValue(value: number | null): string {
  if (value === null) return '缺失';
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}
