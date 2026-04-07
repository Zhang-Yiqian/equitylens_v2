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
  filingType: text('filing_type').notNull().default('10-K'), // '10-K' | '10-Q' | '8-K'
  year: integer('year').notNull(), // filing date year, e.g. 2025
  quarter: integer('quarter').notNull().default(0), // 0 = annual/n/a
  filingDate: text('filing_date').notNull(),
  documentUrl: text('document_url').notNull(),
  // ── 10-K Business & Risk (existing) ────────────────────────────────────────
  item1Business: text('item1_business'),
  item1ARiskFactors: text('item1a_risk_factors'),
  // ── 10-K MD&A & Controls (new — full text, no truncation) ───────────────────
  item6SelectedFinData: text('item6_selected_fin_data'), // Selected Financial Data
  item7MdAndA: text('item7_md_and_a'), // Management Discussion & Analysis
  item7AFactors: text('item7a_factors'), // Market Risk Disclosures
  item8Financials: text('item8_financials'), // Financial Statements
  item9Controls: text('item9_controls'), // Internal Controls
  // ── Additional 10-K sections ────────────────────────────────────────────────
  item2Properties: text('item2_properties'),
  item3Legal: text('item3_legal'),
  item4Mine: text('item4_mine'),
  item5Market: text('item5_market'),
  item10Directors: text('item10_directors'),
  item11Compensation: text('item11_compensation'),
  item12Security: text('item12_security'),
  item13Relationships: text('item13_relationships'),
  item14Principal: text('item14_principal'),
  // ── 10-Q specific sections ──────────────────────────────────────────────────
  item1Financials: text('item1_financials'),    // 10-Q Item 1 – Financial Statements
  item2MdAndA: text('item2_md_and_a'),          // 10-Q Item 2 – MD&A
  item3Defaults: text('item3_defaults'),        // 10-Q Item 3 – Quantitative/Defaults
  item4Controls: text('item4_controls'),        // 10-Q Item 4 – Controls
  // ── Extracted quantitative guidance ──────────────────────────────────────────
  extractedGuidance: text('extracted_guidance'), // JSON string
  // ── Metadata ────────────────────────────────────────────────────────────────
  fetchedAt: text('fetched_at').notNull(),
}, (table) => [
  uniqueIndex('uq_ten_k_cache_ticker_type_year_quarter').on(table.ticker, table.filingType, table.year, table.quarter),
]);

export const financialSnapshots = sqliteTable('financial_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  year: integer('year').notNull(),
  quarter: integer('quarter').notNull(),
  // Core (existing)
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
  // ── Income Statement (new) ────────────────────────────────────────────────
  costOfRevenue: real('cost_of_revenue'),
  operatingExpenses: real('operating_expenses'),
  sgaExpense: real('sga_expense'),
  sbcExpense: real('sbc_expense'),
  otherIncomeExpense: real('other_income_expense'),
  depreciationAndAmortization: real('depreciation_and_amortization'),
  operatingIncome: real('operating_income'),
  interestExpense: real('interest_expense'),
  interestIncome: real('interest_income'),
  pretaxIncome: real('pretax_income'),
  incomeTaxExpense: real('income_tax_expense'),
  discontinuedOperations: real('discontinued_operations'),
  // ── EPS & Shares (new) ─────────────────────────────────────────────────────
  epsBasic: real('eps_basic'),
  epsDiluted: real('eps_diluted'),
  weightedAverageSharesBasic: real('weighted_avg_shares_basic'),
  weightedAverageSharesDiluted: real('weighted_avg_shares_diluted'),
  dividendsPerShare: real('dividends_per_share'),
  // ── Balance Sheet (new) ────────────────────────────────────────────────────
  totalCash: real('total_cash'),
  shortTermInvestments: real('short_term_investments'),
  accountsReceivable: real('accounts_receivable'),
  inventory: real('inventory'),
  totalCurrentAssets: real('total_current_assets'),
  goodwill: real('goodwill'),
  intangibleAssets: real('intangible_assets'),
  ppneNet: real('ppne_net'),
  totalCurrentLiabilities: real('total_current_liabilities'),
  operatingLeaseLiability: real('operating_lease_liability'),
  longTermDebt: real('long_term_debt'),
  totalDebt: real('total_debt'),
  retainedEarnings: real('retained_earnings'),
  totalStockholdersEquity: real('total_stockholders_equity'),
  // ── Cash Flow (new) ───────────────────────────────────────────────────────
  capitalExpenditure: real('capital_expenditure'),
  sbcInCashFlow: real('sbc_in_cash_flow'),
  shareRepurchases: real('share_repurchases'),
  dividendsPaid: real('dividends_paid'),
  debtIssuance: real('debt_issuance'),
  debtRepayment: real('debt_repayment'),
  workingCapitalChange: real('working_capital_change'),
  acquisitionRelatedCash: real('acquisition_related_cash'),
  // ── Equity / Comprehensive (new) ─────────────────────────────────────────
  accountsPayable: real('accounts_payable'),
  accumulatedOtherComprehensiveIncome: real('accumulated_other_comprehensive_income'),
  additionalPaidInCapital: real('additional_paid_in_capital'),
  treasuryStock: real('treasury_stock'),
  preferredStock: real('preferred_stock'),
  minorityInterest: real('minority_interest'),
  comprehensiveIncome: real('comprehensive_income'),
  netIncomeAttributableToNoncontrolling: real('net_income_attributable_to_noncontrolling'),
  proceedsFromStockOptions: real('proceeds_from_stock_options'),
  excessTaxBenefit: real('excess_tax_benefit'),
  // ── Field Sources ─────────────────────────────────────────────────────────
  fieldSources: text('field_sources'), // JSON string of FieldSources
  // ── Raw SEC XBRL (for source-consistency verification) ───────────────────
  rawSecFacts: text('raw_sec_facts'), // Original SEC company facts JSON
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

// ── Non-GAAP Adjustments ────────────────────────────────────────────────────────

export const nonGaapAdjustments = sqliteTable('non_gaap_adjustments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  year: integer('year').notNull(),
  quarter: integer('quarter').notNull(),
  // Filing source
  source: text('source').notNull(), // '10-K' | '10-Q' | 'transcript'
  filingDate: text('filing_date'),
  // The GAAP metric being adjusted
  adjustedMetric: text('adjusted_metric').notNull(), // e.g. 'netIncome', 'operatingIncome', 'fcf'
  // The adjustment item name
  adjustmentItem: text('adjustment_item').notNull(), // e.g. 'Stock-Based Compensation', 'Restructuring'
  // Amount (absolute value; sign noted in adjustmentSign)
  amount: real('amount'),
  // GAAP-reported value
  gaapValue: real('gaap_value'),
  // Non-GAAP-reported value
  nonGaapValue: real('non_gaap_value'),
  // Source text snippet (verbatim from filing/call)
  rawTextSnippet: text('raw_text_snippet'),
  // Metadata
  fetchedAt: text('fetched_at').notNull(),
}, (table) => [
  uniqueIndex('uq_non_gaap_ticker_period_metric_item')
    .on(table.ticker, table.year, table.quarter, table.adjustedMetric, table.adjustmentItem),
  index('idx_non_gaap_ticker_period').on(table.ticker, table.year, table.quarter),
]);

// ── Industry-Specific Metrics ──────────────────────────────────────────────────

export const industryMetrics = sqliteTable('industry_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  year: integer('year').notNull(),
  quarter: integer('quarter').notNull(),
  supplyChainTag: text('supply_chain_tag'), // e.g. 'gpu_accelerators', 'ai_saas'

  // Cloud / SaaS
  arr: real('arr'),
  netNewArr: real('net_new_arr'),
  nrr: real('nrr'),                          // Net Revenue Retention %
  mrr: real('mrr'),
  customerCount: integer('customer_count'),
  logoChurnRate: real('logo_churn_rate'),
  ltv: real('ltv'),
  cac: real('cac'),
  ltvCacRatio: real('ltv_cac_ratio'),
  paybackPeriodMonths: integer('payback_period_months'),

  // Semiconductor
  waferCapacityUnits: text('wafer_capacity_units'),   // e.g. "30000 wafers/month"
  capacityUtilizationPct: real('capacity_utilization_pct'),
  aspTrend: text('asp_trend'),           // 'increasing' | 'stable' | 'decreasing'
  advancedNodePct: real('advanced_node_pct'),

  // GPU / Infrastructure
  gpuShipments: integer('gpu_shipments'),
  gpuAsp: real('gpu_asp'),
  datacenterRevenueMix: real('datacenter_revenue_mix'), // % of total revenue
  datacenterPowerMw: real('datacenter_power_mw'),
  pue: real('pue'),

  // Networking
  switchPortsShipped: integer('switch_ports_shipped'),
  routerPortsShipped: integer('router_ports_shipped'),

  // Extracted via LLM
  extractedNarrative: text('extracted_narrative'),
  extractionSource: text('extraction_source'), // 'mda' | 'transcript' | 'yf'

  fetchedAt: text('fetched_at').notNull(),
}, (table) => [
  uniqueIndex('uq_industry_metrics_ticker_period').on(table.ticker, table.year, table.quarter),
  index('idx_industry_metrics_tag').on(table.supplyChainTag),
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
