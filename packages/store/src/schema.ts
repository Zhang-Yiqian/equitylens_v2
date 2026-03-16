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
