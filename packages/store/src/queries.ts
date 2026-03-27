import { eq, and, desc, inArray } from 'drizzle-orm';
import { getDb } from './db.js';
import { financialSnapshots, transcripts, analyses, reports, newsCache, tenKCache, universeScans, universeCache, universeBlacklist, industryMetrics, nonGaapAdjustments } from './schema.js';

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

// ── Universe Funnel Engine ─────────────────────────────────────────────────────

export function upsertUniverseScan(data: typeof universeScans.$inferInsert) {
  const db = getDb();
  return db.insert(universeScans)
    .values(data)
    .onConflictDoUpdate({
      target: [universeScans.scanId],
      set: { ...data },
    })
    .run();
}

export function updateUniverseScan(id: number, data: Partial<typeof universeScans.$inferInsert>) {
  const db = getDb();
  return db.update(universeScans).set(data).where(eq(universeScans.id, id)).run();
}

export function getLatestCompletedScan() {
  const db = getDb();
  return db.select().from(universeScans)
    .where(eq(universeScans.status, 'completed'))
    .orderBy(desc(universeScans.completedAt))
    .limit(1)
    .get();
}

export function getUniverseScanById(scanId: string) {
  const db = getDb();
  return db.select().from(universeScans)
    .where(eq(universeScans.scanId, scanId))
    .get();
}

export function upsertUniverseCache(data: typeof universeCache.$inferInsert) {
  const db = getDb();
  return db.insert(universeCache)
    .values(data)
    .onConflictDoUpdate({
      target: [universeCache.ticker],
      set: { ...data },
    })
    .run();
}

export function getUniverseCache(ticker: string) {
  const db = getDb();
  return db.select().from(universeCache)
    .where(eq(universeCache.ticker, ticker))
    .get();
}

export function getAllUniverseCache() {
  const db = getDb();
  return db.select().from(universeCache).all();
}

export function getUniverseCacheByStatus(aiStatus: string) {
  const db = getDb();
  return db.select().from(universeCache)
    .where(eq(universeCache.aiStatus, aiStatus))
    .all();
}

export function upsertBlacklist(data: typeof universeBlacklist.$inferInsert) {
  const db = getDb();
  return db.insert(universeBlacklist)
    .values(data)
    .onConflictDoUpdate({
      target: [universeBlacklist.ticker],
      set: { ...data },
    })
    .run();
}

export function getBlacklist(ticker?: string) {
  const db = getDb();
  if (ticker) {
    return db.select().from(universeBlacklist)
      .where(eq(universeBlacklist.ticker, ticker))
      .get();
  }
  return db.select().from(universeBlacklist).all();
}

export function getAllCachedTickers(): string[] {
  const db = getDb();
  return db.select({ ticker: universeCache.ticker }).from(universeCache)
    .all()
    .map(r => r.ticker);
}

// ── Industry Metrics ────────────────────────────────────────────────────────────

export function upsertIndustryMetrics(data: typeof industryMetrics.$inferInsert) {
  const db = getDb();
  return db.insert(industryMetrics)
    .values(data)
    .onConflictDoUpdate({
      target: [industryMetrics.ticker, industryMetrics.year, industryMetrics.quarter],
      set: { ...data, fetchedAt: new Date().toISOString() },
    })
    .run();
}

export function getIndustryMetrics(ticker: string, year: number, quarter: number) {
  const db = getDb();
  return db.select().from(industryMetrics)
    .where(and(
      eq(industryMetrics.ticker, ticker),
      eq(industryMetrics.year, year),
      eq(industryMetrics.quarter, quarter),
    ))
    .get();
}

export function getIndustryMetricsByTag(supplyChainTag: string) {
  const db = getDb();
  return db.select().from(industryMetrics)
    .where(eq(industryMetrics.supplyChainTag, supplyChainTag))
    .all();
}

// ── Non-GAAP Adjustments ───────────────────────────────────────────────────────

export function upsertNonGaapAdjustment(data: typeof nonGaapAdjustments.$inferInsert) {
  const db = getDb();
  return db.insert(nonGaapAdjustments)
    .values(data)
    .onConflictDoUpdate({
      target: [
        nonGaapAdjustments.ticker,
        nonGaapAdjustments.year,
        nonGaapAdjustments.quarter,
        nonGaapAdjustments.adjustedMetric,
        nonGaapAdjustments.adjustmentItem,
      ],
      set: { ...data, fetchedAt: new Date().toISOString() },
    })
    .run();
}

export function getNonGaapAdjustments(ticker: string, year: number, quarter: number) {
  const db = getDb();
  return db.select().from(nonGaapAdjustments)
    .where(and(
      eq(nonGaapAdjustments.ticker, ticker),
      eq(nonGaapAdjustments.year, year),
      eq(nonGaapAdjustments.quarter, quarter),
    ))
    .all();
}
