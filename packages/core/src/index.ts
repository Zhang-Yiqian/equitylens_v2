/**
 * @equitylens/core — Types, Constants, and Utilities only.
 *
 * This package must NOT import @equitylens/data (circular dependency risk).
 * All data-layer APIs live in @equitylens/data.
 */
export type {
  FinancialSnapshot,
  DerivedMetrics,
  YahooFinancials,
  DataSource,
  FieldSource,
  FieldSources,
} from './types/financial.js';
export { formatFinancialValue, matchCalendarQuarter } from './types/financial.js';

export type { EarningsTranscript, TranscriptSection } from './types/transcript.js';
export type { Report } from './types/report.js';
export type {
  UniverseScan,
  UniverseCache,
  AIStatus,
  SupplyChainTag,
  ScanMode,
  ScanStatus,
  ScanDiff,
  L2MatchResult,
  L3Classification,
  HardFilterResult,
  HardFilterInput,
  ComplianceResult,
  BlacklistEntry,
  BlacklistReason,
  UniverseSource,
  NasdaqMarket,
  L2MatchSource,
  FunnelStats,
  PoolBreakdown,
  ChainDistribution,
  UniverseScanResult,
  L3BatchInput,
} from './types/universe.js';

export { MVP_TICKERS, MVP_TICKER_SET } from './constants/tickers.js';
export {
  EquityLensError,
  DataFetchError,
  LLMError,
  ValidationError,
  CacheError,
} from './errors.js';
