import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let db: ReturnType<typeof drizzle> | null = null;
let sqlite: Database.Database | null = null;

const DEFAULT_DB_PATH = './data/equitylens.db';

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
}
