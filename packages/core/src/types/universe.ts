// Universe Funnel Engine — Core Types

/** AI classification status for a company */
export type AIStatus = 'core' | 'adjacent' | 'non_core' | 'unknown' | 'api_failed';

/** Supply chain node tag for AI industry mapping */
export type SupplyChainTag =
  | 'gpu_accelerators'
  | 'storage'
  | 'optical_modules'
  | 'semiconductors'
  | 'eda_ip'
  | 'servers_oem'
  | 'data_center'
  | 'cloud'
  | 'llm_platforms'
  | 'ai_saas'
  | 'networking'
  | 'power_thermal'
  | 'materials'
  | 'capital_formation'
  | 'software_dev'
  | 'none';

/** Scan execution mode */
export type ScanMode = 'full' | 'incremental' | 'dry_run';

/** Scan execution status */
export type ScanStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/** Reason a ticker is on the blacklist */
export type BlacklistReason =
  | 'etf_fund_trust'
  | 'test_issue'
  | 'compliance_going_concern'
  | 'compliance_auditor_resignation'
  | 'manual';

/** Source of a company in the universe */
export type UniverseSource = 'nasdaq_listed' | 'nasdaq_other' | 'manual';

/** Market tier based on Nasdaq data */
export type NasdaqMarket = 'NASDAQ Global Select Market' | 'NASDAQ Global Market' | 'NASDAQ Capital Market';

/** How a ticker reached L2 */
export type L2MatchSource = 'whitelist' | 'description';

/** L2 regex match result */
export interface L2MatchResult {
  ticker: string;
  companyName: string;
  matchedKeywords: string[];
  matchedCategories: string[];
  combinedText: string;
  market: NasdaqMarket | null;
  /** How this ticker was matched */
  matchedSource: L2MatchSource;
  /** Snippet from 10-K Item 1 description showing matched keywords */
  descriptionSnippet?: string;
}

/** Hard filter input */
export interface HardFilterInput {
  ticker: string;
  marketCap?: number | null;    // in dollars
  price?: number | null;
  avgDollarVolume30d?: number | null; // average daily dollar volume
  ttmRevenue?: number | null;   // in dollars
}

/** Hard filter result */
export interface HardFilterResult {
  ticker: string;
  passed: boolean;
  marketCap?: number | null;
  price?: number | null;
  avgDollarVolume30d?: number | null;
  ttmRevenue?: number | null;
  reason?: string;
}

/** L3 Gemini classification result */
export interface L3Classification {
  ticker: string;
  companyName: string;
  aiStatus: AIStatus;
  supplyChainTag: SupplyChainTag;
  confidence: number;          // 0-100
  reasoning: string;          // Chinese explanation
  evidence: string;           // Key phrase from analysis
  modelId: string;
  analyzedAt: string;
  /** Whether this result came from an API failure fallback (not a real classification) */
  l3ApiFailed?: boolean;
}

/** Compliance check result */
export interface ComplianceResult {
  ticker: string;
  hasGoingConcern: boolean;
  hasAuditorResignation: boolean;
  matchedPatterns: string[];
  checkedAt: string;
}

/** Blacklist entry */
export interface BlacklistEntry {
  ticker: string;
  reason: BlacklistReason;
  addedAt: string;
  source?: string;
}

/** Funnel statistics at each stage */
export interface FunnelStats {
  /** Total raw tickers from Nasdaq download */
  totalNasdaq: number;
  /** After ETF/fund/warrant blacklist filter */
  afterBlacklist: number;
  /** After L2 keyword regex match */
  l2Matches: number;
  /** After L3 Gemini classification */
  l3Classified: number;
  /** After hard market cap/revenue/volume filters */
  afterHardFilter: number;
  /** After compliance check */
  afterCompliance: number;
  /** Final: AI Core companies */
  aiCore: number;
  /** Final: AI Adjacent companies */
  aiAdjacent: number;
  /** Final: Non-core companies */
  nonCore: number;
  /** Final: Unknown status (genuinely unclassifiable by model) */
  unknown: number;
  /** L3 API failures after all retries exhausted */
  l3ApiFailed: number;
}

/** Pool breakdown by AI status */
export interface PoolBreakdown {
  core: number;
  adjacent: number;
  nonCore: number;
  unknown: number;
}

/** Supply chain distribution */
export interface ChainDistribution {
  tag: SupplyChainTag;
  count: number;
  tickers: string[];
}

/** Scan diff between two scans */
export interface ScanDiff {
  added: string[];   // new tickers in this scan
  removed: string[];  // tickers in previous scan but not in this one
}

/** Universe scan record */
export interface UniverseScan {
  id?: number;
  scanId: string;
  mode: ScanMode;
  status: ScanStatus;
  startedAt: string;
  completedAt?: string;
  totalNasdaq: number;
  afterBlacklist: number;
  l2Matches: number;
  l3Classified: number;
  afterHardFilter: number;
  afterCompliance: number;
  aiCore: number;
  aiAdjacent: number;
  nonCore: number;
  unknown: number;
  diffAdded?: number;
  diffRemoved?: number;
  errorMessage?: string;
  l3TokensUsed?: number;
}

/** Universe cache entry — stores company data after processing */
export interface UniverseCache {
  id?: number;
  ticker: string;
  companyName: string;
  source: UniverseSource;
  market?: NasdaqMarket | null;
  // L2 match
  l2Matched: boolean;
  l2MatchedKeywords?: string | null;   // JSON array
  l2MatchedCategories?: string | null; // JSON array
  // L3 classification
  aiStatus?: AIStatus | null;
  supplyChainTag?: SupplyChainTag | null;
  l3Confidence?: number | null;
  l3Reasoning?: string | null;
  l3Evidence?: string | null;
  /** True if this entry failed L3 API call and fell back to unknown (not a real classification) */
  l3ApiFailed?: boolean | null;
  // Hard filter
  hardFilterPassed?: boolean | null;
  marketCap?: number | null;
  price?: number | null;
  avgDollarVolume30d?: number | null;
  ttmRevenue?: number | null;
  // Compliance
  complianceChecked?: boolean | null;
  hasGoingConcern?: boolean | null;
  hasAuditorResignation?: boolean | null;
  // Metadata
  lastScanId?: string | null;
  fetchedAt?: string;
}

/** Batch input for L3 classification */
export interface L3BatchInput {
  ticker: string;
  companyName: string;
  matchedKeywords: string[];
  matchedCategories: string[];
}

/** Complete scan result returned by pipeline */
export interface UniverseScanResult {
  scanId: string;
  mode: ScanMode;
  stats: FunnelStats;
  diff?: ScanDiff;
  poolBreakdown: PoolBreakdown;
  chainDistribution: ChainDistribution[];
  completedAt: string;
  durationMs: number;
  l3TokensUsed?: number;
  errors: string[];
}
