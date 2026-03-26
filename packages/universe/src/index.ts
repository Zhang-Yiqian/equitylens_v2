// Types
export type {
  AIStatus,
  ScanMode,
  ScanStatus,
  BlacklistReason,
  UniverseSource,
  NasdaqMarket,
  L2MatchSource,
  L2MatchResult,
  HardFilterInput,
  HardFilterResult,
  L3Classification,
  ComplianceResult,
  BlacklistEntry,
  FunnelStats,
  PoolBreakdown,
  ChainDistribution,
  ScanDiff,
  UniverseScan,
  UniverseCache,
  L3BatchInput,
  UniverseScanResult,
} from '@equitylens/core';

// Fetcher
export { fetchNasdaqUniverse } from './fetcher/nasdaq.js';
export { fetchCompanyDescription, fetchCompanyDescriptionsBatch } from './fetcher/company-description.js';

// Matcher
export { runL2Matching, matchDescription } from './matcher/regex.js';
export { isBlacklisted, isWhitelisted, WHITELIST_EXACT } from './matcher/blacklist.js';

// Classifier
export { classifyL3 } from './classifier/batch.js';
export { parseL3Response } from './classifier/parser.js';
export { L3_SYSTEM_PROMPT, buildL3UserMessage } from './classifier/l3-prompt.js';

// Filter
export { applyHardFilters } from './filter/hard-filters.js';
export { checkCompliance } from './filter/compliance.js';

// Pipeline
export { runScan } from './pipeline/scan.js';
export { retryFailedL3 } from './pipeline/retry-l3.js';
export type { RetryResult } from './pipeline/retry-l3.js';
export type { ScanOptions } from './pipeline/scan.js';
export { printProgress, printFunnelTable, printChainDistribution, printL2CategoryBreakdown } from './pipeline/progress.js';
