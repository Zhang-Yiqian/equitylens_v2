import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const newsCache = sqliteTable('news_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  title: text('title').notNull(),
  publisher: text('publisher').notNull().default(''),
  link: text('link').notNull(),
  publishedAt: text('published_at').notNull(),
  fetchedAt: text('fetched_at').notNull(),
}, (table) => [
  index('idx_news_cache_ticker').on(table.ticker),
]);

export const tenKCache = sqliteTable('ten_k_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  item1Business: text('item1_business'),
  item1ARiskFactors: text('item1a_risk_factors'),
  filingDate: text('filing_date').notNull(),
  documentUrl: text('document_url').notNull(),
  fetchedAt: text('fetched_at').notNull(),
}, (table) => [
  uniqueIndex('uq_ten_k_cache_ticker').on(table.ticker),
]);

export const financialSnapshots = sqliteTable('financial_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  year: integer('year').notNull(),
  quarter: integer('quarter').notNull(),
  revenue: real('revenue'),
  netIncome: real('net_income'),
  grossMargin: real('gross_margin'),
  operatingCashFlow: real('operating_cash_flow'),
  freeCashFlow: real('free_cash_flow'),
  rdExpense: real('rd_expense'),
  sharesOutstanding: real('shares_outstanding'),
  totalAssets: real('total_assets'),
  totalLiabilities: real('total_liabilities'),
  eps: real('eps'),
  marketCap: real('market_cap'),
  peRatio: real('pe_ratio'),
  revenueGrowthYoY: real('revenue_growth_yoy'),
  grossMarginPct: real('gross_margin_pct'),
  fcfMarginPct: real('fcf_margin_pct'),
  deferredRevenue: real('deferred_revenue'),
  rpo: real('rpo'),
  source: text('source').notNull().default('merged'),
  rawJson: text('raw_json'),
  fetchedAt: text('fetched_at').notNull(),
}, (table) => [
  uniqueIndex('uq_snapshots_ticker_period').on(table.ticker, table.year, table.quarter),
]);

export const transcripts = sqliteTable('transcripts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  year: integer('year').notNull(),
  quarter: integer('quarter').notNull(),
  content: text('content').notNull(),
  wordCount: integer('word_count').notNull(),
  fetchedAt: text('fetched_at').notNull(),
}, (table) => [
  uniqueIndex('uq_transcripts_ticker_period').on(table.ticker, table.year, table.quarter),
]);

export const analyses = sqliteTable('analyses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  year: integer('year').notNull(),
  quarter: integer('quarter').notNull(),
  promptVersion: text('prompt_version').notNull(),
  modelId: text('model_id').notNull(),
  verdict: text('verdict').notNull(),
  verdictConfidence: integer('verdict_confidence').notNull(),
  thesisSummary: text('thesis_summary').notNull(),
  dimensionsJson: text('dimensions_json').notNull(),
  catalystsJson: text('catalysts_json').notNull(),
  risksJson: text('risks_json').notNull(),
  trackingMetricsJson: text('tracking_metrics_json').notNull(),
  // Cross-validation v1 fields (nullable for backwards compatibility)
  conclusion: text('conclusion'),
  landscapeAnalysis: text('landscape_analysis'),
  riskWarning: text('risk_warning'),
  rawLlmOutput: text('raw_llm_output'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  analyzedAt: text('analyzed_at').notNull(),
}, (table) => [
  index('idx_analyses_ticker_period').on(table.ticker, table.year, table.quarter),
]);

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  analysisId: integer('analysis_id').references(() => analyses.id),
  ticker: text('ticker').notNull(),
  year: integer('year').notNull(),
  quarter: integer('quarter').notNull(),
  markdownContent: text('markdown_content').notNull(),
  filePath: text('file_path').notNull(),
  generatedAt: text('generated_at').notNull(),
});

// ── Universe Funnel Engine ────────────────────────────────────────────────────

export const universeScans = sqliteTable('universe_scans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scanId: text('scan_id').notNull().unique(),
  mode: text('mode').notNull(), // 'full' | 'incremental' | 'dry_run'
  status: text('status').notNull(), // 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  totalNasdaq: integer('total_nasdaq').notNull().default(0),
  afterBlacklist: integer('after_blacklist').notNull().default(0),
  l2Matches: integer('l2_matches').notNull().default(0),
  l3Classified: integer('l3_classified').notNull().default(0),
  afterHardFilter: integer('after_hard_filter').notNull().default(0),
  afterCompliance: integer('after_compliance').notNull().default(0),
  aiCore: integer('ai_core').notNull().default(0),
  aiAdjacent: integer('ai_adjacent').notNull().default(0),
  nonCore: integer('non_core').notNull().default(0),
  unknown: integer('unknown').notNull().default(0),
  diffAdded: integer('diff_added'),
  diffRemoved: integer('diff_removed'),
  errorMessage: text('error_message'),
  l3TokensUsed: integer('l3_tokens_used'),
}, (table) => [
  index('idx_universe_scans_status').on(table.status),
  index('idx_universe_scans_started').on(table.startedAt),
]);

export const universeCache = sqliteTable('universe_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull().unique(),
  companyName: text('company_name').notNull(),
  source: text('source').notNull(), // 'nasdaq_listed' | 'nasdaq_other' | 'manual'
  market: text('market'),
  // L2 match
  l2Matched: integer('l2_matched').notNull().default(0), // 0/1 boolean
  l2MatchedKeywords: text('l2_matched_keywords'),  // JSON array string
  l2MatchedCategories: text('l2_matched_categories'), // JSON array string
  // L3 classification
  aiStatus: text('ai_status'), // 'core' | 'adjacent' | 'non_core' | 'unknown' | 'api_failed'
  supplyChainTag: text('supply_chain_tag'),
  l3Confidence: integer('l3_confidence'),
  l3Reasoning: text('l3_reasoning'),
  l3Evidence: text('l3_evidence'),
  /** 1 if L3 API call failed and fell back to unknown; null or 0 if real classification */
  l3ApiFailed: integer('l3_api_failed').notNull().default(0),
  // Hard filter
  hardFilterPassed: integer('hard_filter_passed'), // 0/1/null
  marketCap: real('market_cap'),
  price: real('price'),
  avgDollarVolume30d: real('avg_dollar_volume_30d'),
  ttmRevenue: real('ttm_revenue'),
  // Compliance
  complianceChecked: integer('compliance_checked').notNull().default(0), // 0/1
  hasGoingConcern: integer('has_going_concern'), // 0/1/null
  hasAuditorResignation: integer('has_auditor_resignation'), // 0/1/null
  // Metadata
  lastScanId: text('last_scan_id'),
  fetchedAt: text('fetched_at').notNull(),
}, (table) => [
  index('idx_universe_cache_ticker').on(table.ticker),
  index('idx_universe_cache_ai_status').on(table.aiStatus),
]);

export const universeBlacklist = sqliteTable('universe_blacklist', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull().unique(),
  reason: text('reason').notNull(), // 'etf_fund_trust' | 'test_issue' | 'compliance_going_concern' | 'compliance_auditor_resignation' | 'manual'
  addedAt: text('added_at').notNull(),
  source: text('source'),
}, (table) => [
  index('idx_universe_blacklist_ticker').on(table.ticker),
  index('idx_universe_blacklist_reason').on(table.reason),
]);
