/**
 * Server-side database access for Next.js.
 * Delegates to @equitylens/store which owns the Drizzle ORM layer.
 * This file adds web-specific query shapes on top.
 */
import {
  getDb,
  analyses,
  financialSnapshots,
  getAllFinancialSnapshots,
  getLatestAnalysis,
} from '@equitylens/store'
import { MVP_TICKER_SET } from '@equitylens/core'

export interface WatchlistEntry {
  ticker: string
  verdict: string | null
  verdictConfidence: number | null
  conclusion: string | null
  analyzedAt: string | null
  promptVersion: string | null
  revenue: number | null
  netIncome: number | null
  grossMarginPct: number | null
  freeCashFlow: number | null
  marketCap: number | null
  peRatio: number | null
  revenueGrowthYoY: number | null
  year: number | null
  quarter: number | null
}

export interface AnalysisDetail {
  id: number
  ticker: string
  year: number
  quarter: number
  promptVersion: string
  modelId: string
  verdict: string
  verdictConfidence: number
  thesisSummary: string
  conclusion: string | null
  landscapeAnalysis: string | null
  riskWarning: string | null
  dimensionsJson: string
  catalystsJson: string
  risksJson: string
  analyzedAt: string
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

export interface FinancialHistory {
  year: number
  quarter: number
  revenue: number | null
  netIncome: number | null
  grossMarginPct: number | null
  freeCashFlow: number | null
  operatingCashFlow: number | null
  revenueGrowthYoY: number | null
}

export function getWatchlistData(): WatchlistEntry[] {
  const tickers = Array.from(MVP_TICKER_SET)

  return tickers.map(ticker => {
    const latestAnalysis = getLatestAnalysis(ticker)

    // Use getAllFinancialSnapshots (sorted desc) and pick the first quarterly (q > 0)
    const allSnapshots = getAllFinancialSnapshots(ticker)
    const latestFinancial = allSnapshots.find(s => s.quarter > 0) ?? allSnapshots[0] ?? null

    return {
      ticker,
      verdict: latestAnalysis?.verdict ?? null,
      verdictConfidence: latestAnalysis?.verdictConfidence ?? null,
      conclusion: (latestAnalysis as Record<string, unknown> | undefined)?.conclusion as string | null ?? null,
      analyzedAt: latestAnalysis?.analyzedAt ?? null,
      promptVersion: latestAnalysis?.promptVersion ?? null,
      revenue: latestFinancial?.revenue ?? null,
      netIncome: latestFinancial?.netIncome ?? null,
      grossMarginPct: latestFinancial?.grossMarginPct ?? null,
      freeCashFlow: latestFinancial?.freeCashFlow ?? null,
      marketCap: latestFinancial?.marketCap ?? null,
      peRatio: latestFinancial?.peRatio ?? null,
      revenueGrowthYoY: latestFinancial?.revenueGrowthYoY ?? null,
      year: latestFinancial?.year ?? null,
      quarter: latestFinancial?.quarter ?? null,
    }
  })
}

export function getLatestAnalysisForTicker(ticker: string): AnalysisDetail | null {
  const result = getLatestAnalysis(ticker.toUpperCase())
  if (!result) return null
  // Cast to AnalysisDetail — the schema fields are a superset
  return result as unknown as AnalysisDetail
}

export function getFinancialHistory(ticker: string): FinancialHistory[] {
  const rows = getAllFinancialSnapshots(ticker.toUpperCase())

  return rows
    .filter(r => r.quarter > 0) // quarterly only
    .slice(0, 8)
    .reverse() // oldest first for chart
    .map(r => ({
      year: r.year,
      quarter: r.quarter,
      revenue: r.revenue ?? null,
      netIncome: r.netIncome ?? null,
      grossMarginPct: r.grossMarginPct ?? null,
      freeCashFlow: r.freeCashFlow ?? null,
      operatingCashFlow: r.operatingCashFlow ?? null,
      revenueGrowthYoY: r.revenueGrowthYoY ?? null,
    }))
}
