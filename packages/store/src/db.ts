import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let db: ReturnType<typeof drizzle> | null = null;
let sqlite: Database.Database | null = null;

const DEFAULT_DB_PATH = process.env.DATABASE_PATH || './data/equitylens.db';

export function getDb(dbPath: string = DEFAULT_DB_PATH): ReturnType<typeof drizzle> {
  if (db) return db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  db = drizzle(sqlite, { schema });

  // Auto-create tables
  initTables(sqlite);

  return db;
}

export function closeDb(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

function initTables(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS financial_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      -- Core (existing)
      revenue REAL,
      net_income REAL,
      gross_margin REAL,
      operating_cash_flow REAL,
      free_cash_flow REAL,
      rd_expense REAL,
      shares_outstanding REAL,
      total_assets REAL,
      total_liabilities REAL,
      eps REAL,
      market_cap REAL,
      pe_ratio REAL,
      revenue_growth_yoy REAL,
      gross_margin_pct REAL,
      fcf_margin_pct REAL,
      deferred_revenue REAL,
      rpo REAL,
      source TEXT NOT NULL DEFAULT 'merged',
      raw_json TEXT,
      fetched_at TEXT NOT NULL,
      -- Phase 3: Income Statement (new)
      cost_of_revenue REAL,
      operating_expenses REAL,
      sga_expense REAL,
      sbc_expense REAL,
      other_income_expense REAL,
      depreciation_and_amortization REAL,
      operating_income REAL,
      interest_expense REAL,
      interest_income REAL,
      pretax_income REAL,
      income_tax_expense REAL,
      discontinued_operations REAL,
      -- Phase 3: EPS & Shares (new)
      eps_basic REAL,
      eps_diluted REAL,
      weighted_avg_shares_basic REAL,
      weighted_avg_shares_diluted REAL,
      dividends_per_share REAL,
      -- Phase 3: Balance Sheet (new)
      total_cash REAL,
      short_term_investments REAL,
      accounts_receivable REAL,
      inventory REAL,
      total_current_assets REAL,
      goodwill REAL,
      intangible_assets REAL,
      ppne_net REAL,
      total_current_liabilities REAL,
      operating_lease_liability REAL,
      long_term_debt REAL,
      total_debt REAL,
      retained_earnings REAL,
      total_stockholders_equity REAL,
      -- Phase 3: Cash Flow (new)
      sbc_in_cash_flow REAL,
      share_repurchases REAL,
      dividends_paid REAL,
      debt_issuance REAL,
      debt_repayment REAL,
      working_capital_change REAL,
      acquisition_related_cash REAL,
      -- Phase 3: Field Sources
      field_sources TEXT,
      -- Raw SEC XBRL (for source-consistency verification)
      raw_sec_facts TEXT,
      -- Equity / Comprehensive (new)
      accounts_payable REAL,
      accumulated_other_comprehensive_income REAL,
      additional_paid_in_capital REAL,
      treasury_stock REAL,
      preferred_stock REAL,
      minority_interest REAL,
      comprehensive_income REAL,
      net_income_attributable_to_noncontrolling REAL,
      proceeds_from_stock_options REAL,
      excess_tax_benefit REAL,
      UNIQUE(ticker, year, quarter)
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      content TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      fetched_at TEXT NOT NULL,
      UNIQUE(ticker, year, quarter)
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      prompt_version TEXT NOT NULL,
      model_id TEXT NOT NULL,
      verdict TEXT NOT NULL,
      verdict_confidence INTEGER NOT NULL,
      thesis_summary TEXT NOT NULL,
      dimensions_json TEXT NOT NULL,
      catalysts_json TEXT NOT NULL,
      risks_json TEXT NOT NULL,
      tracking_metrics_json TEXT NOT NULL,
      conclusion TEXT,
      landscape_analysis TEXT,
      risk_warning TEXT,
      raw_llm_output TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      analyzed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER,
      ticker TEXT NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      markdown_content TEXT NOT NULL,
      file_path TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_ticker ON financial_snapshots(ticker, year, quarter);
    CREATE INDEX IF NOT EXISTS idx_transcripts_ticker ON transcripts(ticker, year, quarter);
    CREATE INDEX IF NOT EXISTS idx_analyses_ticker ON analyses(ticker, year, quarter);
  `);

  // Migrate existing analyses table: add cross-validation columns if missing
  const existingCols = new Set(
    (sqlite.pragma('table_info(analyses)') as Array<{ name: string }>).map(r => r.name)
  );
  for (const [col, def] of [
    ['conclusion', 'TEXT'],
    ['landscape_analysis', 'TEXT'],
    ['risk_warning', 'TEXT'],
  ] as const) {
    if (!existingCols.has(col)) {
      sqlite.exec(`ALTER TABLE analyses ADD COLUMN ${col} ${def}`);
    }
  }

  // Migrate financial_snapshots: add Phase 3 new columns if missing
  const snapCols = new Set(
    (sqlite.pragma('table_info(financial_snapshots)') as Array<{ name: string }>).map(r => r.name)
  );
  const newSnapCols: Array<[string, string]> = [
    // Phase 2 additions
    ['revenue_growth_yoy', 'REAL'],
    ['gross_margin_pct', 'REAL'],
    ['fcf_margin_pct', 'REAL'],
    ['deferred_revenue', 'REAL'],
    ['rpo', 'REAL'],
    // Phase 3 Income Statement
    ['cost_of_revenue', 'REAL'],
    ['operating_expenses', 'REAL'],
    ['sga_expense', 'REAL'],
    ['sbc_expense', 'REAL'],
    ['other_income_expense', 'REAL'],
    ['depreciation_and_amortization', 'REAL'],
    ['operating_income', 'REAL'],
    ['interest_expense', 'REAL'],
    ['interest_income', 'REAL'],
    ['pretax_income', 'REAL'],
    ['income_tax_expense', 'REAL'],
    ['discontinued_operations', 'REAL'],
    // Phase 3 EPS & Shares
    ['eps_basic', 'REAL'],
    ['eps_diluted', 'REAL'],
    ['weighted_avg_shares_basic', 'REAL'],
    ['weighted_avg_shares_diluted', 'REAL'],
    ['dividends_per_share', 'REAL'],
    // Phase 3 Balance Sheet
    ['total_cash', 'REAL'],
    ['short_term_investments', 'REAL'],
    ['accounts_receivable', 'REAL'],
    ['inventory', 'REAL'],
    ['total_current_assets', 'REAL'],
    ['goodwill', 'REAL'],
    ['intangible_assets', 'REAL'],
    ['ppne_net', 'REAL'],
    ['total_current_liabilities', 'REAL'],
    ['operating_lease_liability', 'REAL'],
    ['long_term_debt', 'REAL'],
    ['total_debt', 'REAL'],
    ['retained_earnings', 'REAL'],
    ['total_stockholders_equity', 'REAL'],
    // Phase 3 Cash Flow
    ['capital_expenditure', 'REAL'],
    ['sbc_in_cash_flow', 'REAL'],
    ['share_repurchases', 'REAL'],
    ['dividends_paid', 'REAL'],
    ['debt_issuance', 'REAL'],
    ['debt_repayment', 'REAL'],
    ['working_capital_change', 'REAL'],
    ['acquisition_related_cash', 'REAL'],
    // Field Sources
    ['field_sources', 'TEXT'],
    // Raw SEC XBRL (for source-consistency verification)
    ['raw_sec_facts', 'TEXT'],
    // Equity / Comprehensive (new)
    ['accounts_payable', 'REAL'],
    ['accumulated_other_comprehensive_income', 'REAL'],
    ['additional_paid_in_capital', 'REAL'],
    ['treasury_stock', 'REAL'],
    ['preferred_stock', 'REAL'],
    ['minority_interest', 'REAL'],
    ['comprehensive_income', 'REAL'],
    ['net_income_attributable_to_noncontrolling', 'REAL'],
    ['proceeds_from_stock_options', 'REAL'],
    ['excess_tax_benefit', 'REAL'],
  ];
  for (const [col, def] of newSnapCols) {
    if (!snapCols.has(col)) {
      sqlite.exec(`ALTER TABLE financial_snapshots ADD COLUMN ${col} ${def}`);
    }
  }

  // ── Universe Funnel Engine ────────────────────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS universe_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL UNIQUE,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      total_nasdaq INTEGER NOT NULL DEFAULT 0,
      after_blacklist INTEGER NOT NULL DEFAULT 0,
      l2_matches INTEGER NOT NULL DEFAULT 0,
      l3_classified INTEGER NOT NULL DEFAULT 0,
      after_hard_filter INTEGER NOT NULL DEFAULT 0,
      after_compliance INTEGER NOT NULL DEFAULT 0,
      ai_core INTEGER NOT NULL DEFAULT 0,
      ai_adjacent INTEGER NOT NULL DEFAULT 0,
      non_core INTEGER NOT NULL DEFAULT 0,
      unknown INTEGER NOT NULL DEFAULT 0,
      diff_added INTEGER,
      diff_removed INTEGER,
      error_message TEXT,
      l3_tokens_used INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_universe_scans_status ON universe_scans(status);
    CREATE INDEX IF NOT EXISTS idx_universe_scans_started ON universe_scans(started_at);

    CREATE TABLE IF NOT EXISTS universe_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      source TEXT NOT NULL,
      market TEXT,
      l2_matched INTEGER NOT NULL DEFAULT 0,
      l2_matched_keywords TEXT,
      l2_matched_categories TEXT,
      ai_status TEXT,
      supply_chain_tag TEXT,
      l3_confidence INTEGER,
      l3_reasoning TEXT,
      l3_evidence TEXT,
      l3_api_failed INTEGER NOT NULL DEFAULT 0,
      hard_filter_passed INTEGER,
      market_cap REAL,
      price REAL,
      avg_dollar_volume_30d REAL,
      ttm_revenue REAL,
      compliance_checked INTEGER NOT NULL DEFAULT 0,
      has_going_concern INTEGER,
      has_auditor_resignation INTEGER,
      last_scan_id TEXT,
      fetched_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_universe_cache_ticker ON universe_cache(ticker);
    CREATE INDEX IF NOT EXISTS idx_universe_cache_ai_status ON universe_cache(ai_status);

    CREATE TABLE IF NOT EXISTS universe_blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL,
      added_at TEXT NOT NULL,
      source TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_universe_blacklist_ticker ON universe_blacklist(ticker);
    CREATE INDEX IF NOT EXISTS idx_universe_blacklist_reason ON universe_blacklist(reason);
  `);

  // Migration: add l3_api_failed column if missing
  const cacheCols = new Set(
    (sqlite.pragma('table_info(universe_cache)') as Array<{ name: string }>).map(r => r.name)
  );
  if (!cacheCols.has('l3_api_failed')) {
    sqlite.exec(`ALTER TABLE universe_cache ADD COLUMN l3_api_failed INTEGER NOT NULL DEFAULT 0`);
  }

  // ── Phase 2 tables ───────────────────────────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS news_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      title TEXT NOT NULL,
      publisher TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL,
      published_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_news_cache_ticker ON news_cache(ticker);
  `);

  // ── ten_k_cache migration ──────────────────────────────────────────────────
  // Detect the current UNIQUE constraint on ten_k_cache.
  //   - sqlite_autoindex_ten_k_cache_1 → old UNIQUE(ticker)
  //   - uq_ten_k_cache_ticker_type_year → intermediate 3-col index (missing quarter)
  //   - uq_ten_k_cache_ticker_type_year_quarter → final 4-col index
  const tenKIndexes = (sqlite.pragma('index_list(ten_k_cache)') as Array<{ name: string; unique: number }>);
  const hasFinalIdx = tenKIndexes.some(i => i.name === 'uq_ten_k_cache_ticker_type_year_quarter');
  const hasOldTickerIdx = tenKIndexes.some(i => i.name.startsWith('sqlite_autoindex_ten_k_cache'));

  if (!hasFinalIdx && (hasOldTickerIdx || tenKIndexes.length === 0)) {
    // Old UNIQUE(ticker) constraint is active (or no index at all).
    // SQLite cannot ALTER a UNIQUE constraint — rebuild the table.
    const cols = new Set(
      (sqlite.pragma('table_info(ten_k_cache)') as Array<{ name: string }>).map(r => r.name)
    );
    // Rename old table
    sqlite.exec(`ALTER TABLE ten_k_cache RENAME TO ten_k_cache_old`);
    // Create new table with correct composite UNIQUE constraint + quarter column
    sqlite.exec(`
      CREATE TABLE ten_k_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        filing_type TEXT NOT NULL DEFAULT '10-K',
        year INTEGER NOT NULL,
        quarter INTEGER NOT NULL DEFAULT 0,
        filing_date TEXT NOT NULL,
        document_url TEXT NOT NULL,
        item1_business TEXT,
        item1a_risk_factors TEXT,
        item6_selected_fin_data TEXT,
        item7_md_and_a TEXT,
        item7a_factors TEXT,
        item8_financials TEXT,
        item9_controls TEXT,
        item2_properties TEXT,
        item3_legal TEXT,
        item4_mine TEXT,
        item5_market TEXT,
        item10_directors TEXT,
        item11_compensation TEXT,
        item12_security TEXT,
        item13_relationships TEXT,
        item14_principal TEXT,
        extracted_guidance TEXT,
        item1_financials TEXT,
        item2_md_and_a TEXT,
        item3_defaults TEXT,
        item4_controls TEXT,
        fetched_at TEXT NOT NULL
      )
    `);
    sqlite.exec(
      `CREATE UNIQUE INDEX uq_ten_k_cache_ticker_type_year_quarter
       ON ten_k_cache(ticker, filing_type, year, quarter)`
    );
    // Copy data from old table (year may be NULL for old rows — backfill from filing_date)
    sqlite.exec(`
      INSERT OR IGNORE INTO ten_k_cache
        (id, ticker, filing_type, year, quarter, filing_date, document_url,
         item1_business, item1a_risk_factors, item6_selected_fin_data,
         item7_md_and_a, item7a_factors, item8_financials, item9_controls,
         item2_properties, item3_legal, item4_mine, item5_market,
         item10_directors, item11_compensation, item12_security,
         item13_relationships, item14_principal, extracted_guidance,
         item1_financials, item2_md_and_a, item3_defaults, item4_controls,
         fetched_at)
      SELECT
        id, ticker,
        COALESCE(filing_type, '10-K'),
        CAST(substr(filing_date, 1, 4) AS INTEGER),
        0,
        filing_date, document_url,
        item1_business, item1a_risk_factors, item6_selected_fin_data,
        item7_md_and_a, item7a_factors, item8_financials, item9_controls,
        item2_properties, item3_legal, item4_mine, item5_market,
        item10_directors, item11_compensation, item12_security,
        item13_relationships, item14_principal, extracted_guidance,
        item1_financials, item2_md_and_a, item3_defaults, item4_controls,
        fetched_at
      FROM ten_k_cache_old
    `);
    sqlite.exec(`DROP TABLE ten_k_cache_old`);
  } else if (!hasFinalIdx) {
    // Table exists with old 3-col index (or no recognized index) — add quarter column and rebuild index
    const curCols = new Set(
      (sqlite.pragma('table_info(ten_k_cache)') as Array<{ name: string }>).map(r => r.name)
    );
    // Add quarter column if missing
    if (!curCols.has('quarter')) {
      sqlite.exec(`ALTER TABLE ten_k_cache ADD COLUMN quarter INTEGER NOT NULL DEFAULT 0`);
    }
    // Backfill year from filing_date if needed
    sqlite.exec(
      `UPDATE ten_k_cache SET year = CAST(substr(filing_date, 1, 4) AS INTEGER) WHERE year IS NULL`
    );
    const addCols: Array<[string, string]> = [
      ['item1_financials', 'TEXT'],
      ['item2_md_and_a', 'TEXT'],
      ['item3_defaults', 'TEXT'],
      ['item4_controls', 'TEXT'],
    ];
    for (const [col, def] of addCols) {
      if (!curCols.has(col)) {
        sqlite.exec(`ALTER TABLE ten_k_cache ADD COLUMN ${col} ${def}`);
      }
    }
    // Drop old index if exists and create new 4-col index
    const oldIdx = tenKIndexes.find(i => i.name === 'uq_ten_k_cache_ticker_type_year');
    if (oldIdx) {
      sqlite.exec(`DROP INDEX uq_ten_k_cache_ticker_type_year`);
    }
    sqlite.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_ten_k_cache_ticker_type_year_quarter
       ON ten_k_cache(ticker, filing_type, year, quarter)`
    );
  }
  // else: final 4-col index already exists — nothing to do

  // ── Phase 3: industry_metrics ───────────────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS industry_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      supply_chain_tag TEXT,
      -- Cloud / SaaS
      arr REAL,
      net_new_arr REAL,
      nrr REAL,
      mrr REAL,
      customer_count INTEGER,
      logo_churn_rate REAL,
      ltv REAL,
      cac REAL,
      ltv_cac_ratio REAL,
      payback_period_months INTEGER,
      -- Semiconductor
      wafer_capacity_units TEXT,
      capacity_utilization_pct REAL,
      asp_trend TEXT,
      advanced_node_pct REAL,
      -- GPU / Infrastructure
      gpu_shipments INTEGER,
      gpu_asp REAL,
      datacenter_revenue_mix REAL,
      datacenter_power_mw REAL,
      pue REAL,
      -- Networking
      switch_ports_shipped INTEGER,
      router_ports_shipped INTEGER,
      -- Extracted via LLM
      extracted_narrative TEXT,
      extraction_source TEXT,
      fetched_at TEXT NOT NULL,
      UNIQUE(ticker, year, quarter)
    );
    CREATE INDEX IF NOT EXISTS idx_industry_metrics_tag ON industry_metrics(supply_chain_tag);
  `);

  // ── Phase 3: non_gaap_adjustments ───────────────────────────────────────
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS non_gaap_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      source TEXT NOT NULL,
      filing_date TEXT,
      adjusted_metric TEXT NOT NULL,
      adjustment_item TEXT NOT NULL,
      amount REAL,
      gaap_value REAL,
      non_gaap_value REAL,
      raw_text_snippet TEXT,
      fetched_at TEXT NOT NULL,
      UNIQUE(ticker, year, quarter, adjusted_metric, adjustment_item)
    );
    CREATE INDEX IF NOT EXISTS idx_non_gaap_ticker_period
      ON non_gaap_adjustments(ticker, year, quarter);
  `);
}
