import { eq, and, desc } from 'drizzle-orm';
import { getDb } from './db.js';
import { financialSnapshots, transcripts, analyses, reports } from './schema.js';

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
    .orderBy(analyses.analyzedAt)
    .limit(1)
    .get();
}

export function saveReport(data: typeof reports.$inferInsert) {
  const db = getDb();
  return db.insert(reports).values(data).run();
}
