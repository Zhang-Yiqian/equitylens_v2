import { eq, and, desc } from 'drizzle-orm';
import { getDb } from './db.js';
import { financialSnapshots, transcripts, analyses, reports, newsCache, tenKCache } from './schema.js';

export function getFinancialSnapshot(ticker: string, year: number, quarter: number) {
  const db = getDb();
  return db.select().from(financialSnapshots)
    .where(and(
      eq(financialSnapshots.ticker, ticker),
      eq(financialSnapshots.year, year),
      eq(financialSnapshots.quarter, quarter),
    ))
    .get();
}

export function upsertFinancialSnapshot(data: typeof financialSnapshots.$inferInsert) {
  const db = getDb();
  return db.insert(financialSnapshots)
    .values(data)
    .onConflictDoUpdate({
      target: [financialSnapshots.ticker, financialSnapshots.year, financialSnapshots.quarter],
      set: { ...data, fetchedAt: new Date().toISOString() },
    })
    .run();
}

export function getAllFinancialSnapshots(ticker: string) {
  const db = getDb();
  return db.select().from(financialSnapshots)
    .where(eq(financialSnapshots.ticker, ticker))
    .orderBy(desc(financialSnapshots.year), desc(financialSnapshots.quarter))
    .all();
}

export function getTranscript(ticker: string, year: number, quarter: number) {
  const db = getDb();
  return db.select().from(transcripts)
    .where(and(
      eq(transcripts.ticker, ticker),
      eq(transcripts.year, year),
      eq(transcripts.quarter, quarter),
    ))
    .get();
}

export function upsertTranscript(data: typeof transcripts.$inferInsert) {
  const db = getDb();
  return db.insert(transcripts)
    .values(data)
    .onConflictDoUpdate({
      target: [transcripts.ticker, transcripts.year, transcripts.quarter],
      set: { ...data, fetchedAt: new Date().toISOString() },
    })
    .run();
}

export function saveAnalysis(data: typeof analyses.$inferInsert) {
  const db = getDb();
  return db.insert(analyses).values(data).run();
}

export function getLatestAnalysis(ticker: string) {
  const db = getDb();
  return db.select().from(analyses)
    .where(eq(analyses.ticker, ticker))
    .orderBy(desc(analyses.analyzedAt))
    .limit(1)
    .get();
}

export function saveReport(data: typeof reports.$inferInsert) {
  const db = getDb();
  return db.insert(reports).values(data).run();
}

// ── News Cache ────────────────────────────────────────────────────────────────

export function getNewsCache(ticker: string) {
  const db = getDb();
  return db.select().from(newsCache)
    .where(eq(newsCache.ticker, ticker))
    .orderBy(desc(newsCache.publishedAt))
    .all();
}

export function saveNewsItems(
  ticker: string,
  items: Array<{ title: string; publisher: string; link: string; publishedAt: string }>,
) {
  const db = getDb();
  const now = new Date().toISOString();
  // Delete old news for this ticker first, then insert fresh
  db.delete(newsCache).where(eq(newsCache.ticker, ticker)).run();
  for (const item of items) {
    db.insert(newsCache).values({ ...item, ticker, fetchedAt: now }).run();
  }
}

// ── 10-K Cache ───────────────────────────────────────────────────────────────

export function getTenKCache(ticker: string) {
  const db = getDb();
  return db.select().from(tenKCache)
    .where(eq(tenKCache.ticker, ticker))
    .get();
}

export function upsertTenKCache(data: typeof tenKCache.$inferInsert) {
  const db = getDb();
  return db.insert(tenKCache)
    .values(data)
    .onConflictDoUpdate({
      target: [tenKCache.ticker],
      set: { ...data, fetchedAt: new Date().toISOString() },
    })
    .run();
}

// ── Cross-validation analysis ─────────────────────────────────────────────────

export function saveCrossValidationAnalysis(data: typeof analyses.$inferInsert) {
  const db = getDb();
  return db.insert(analyses).values(data).run();
}
