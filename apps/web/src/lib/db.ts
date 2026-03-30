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
  getTenKCache,
  getAllTenKCache,
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

// ── TenKCache (10-K filing text sections) ─────────────────────────────────────

export interface TenKCacheData {
  ticker: string
  year: number
  filingType: string | null
  filingDate: string | null
  documentUrl: string | null
  item1Business: string | null
  item1ARiskFactors: string | null
  item6SelectedFinData: string | null
  item7MdAndA: string | null
  item7AFactors: string | null
  item8Financials: string | null
  item9Controls: string | null
  item2Properties: string | null
  item3Legal: string | null
  item4Mine: string | null
  item5Market: string | null
  item10Directors: string | null
  item11Compensation: string | null
  item12Security: string | null
  item13Relationships: string | null
  item14Principal: string | null
  extractedGuidance: string | null
  // 10-Q specific
  item1Financials: string | null
  item2MdAndA: string | null
  item3Defaults: string | null
  item4Controls: string | null
}

export function getTenKCacheData(ticker: string): TenKCacheData | null {
  const row = getTenKCache(ticker.toUpperCase())
  if (!row) return null
  // Cast to our interface to ensure type safety
  return row as unknown as TenKCacheData
}

/** Get all 10-K and 10-Q filings for a ticker, sorted newest first. */
export function getAllTenKCacheData(ticker: string): TenKCacheData[] {
  const rows = getAllTenKCache(ticker.toUpperCase())
  return rows as unknown as TenKCacheData[]
}

// ── Data Quality Matrix (for heatmap / PRD 5.2 View E) ───────────────────────────

const P0_FIELDS = [
  'revenue',
  'costOfRevenue',
  'grossMargin',
  'operatingIncome',
  'interestExpense',
  'interestIncome',
  'pretaxIncome',
  'incomeTaxExpense',
  'netIncome',
  'epsDiluted',
  'depreciationAndAmortization',
  'sbcExpense',
  'capitalExpenditure',
  'freeCashFlow',
  'operatingCashFlow',
  'totalDebt',
  'totalCash',
  'totalStockholdersEquity',
  'goodwill',
  'totalAssets',
  'totalLiabilities',
  'totalCurrentAssets',
  'totalCurrentLiabilities',
  'accountsReceivable',
  'inventory',
  'deferredRevenue',
  'operatingExpenses',
  'sgaExpense',
  'rdExpense',
  'dividendsPaid',
  'shareRepurchases',
  'intangibleAssets',
  'longTermDebt',
] as const

const FIELD_LABELS: Record<string, string> = {
  revenue: '收入',
  costOfRevenue: '营业成本',
  grossMargin: '毛利润',
  operatingIncome: '营业利润',
  interestExpense: '利息支出',
  interestIncome: '利息收入',
  pretaxIncome: '税前利润',
  incomeTaxExpense: '所得税',
  netIncome: '净利润',
  epsDiluted: 'EPS (摊薄)',
  depreciationAndAmortization: 'D&A',
  sbcExpense: 'SBC 股权激励',
  capitalExpenditure: '资本支出',
  freeCashFlow: '自由现金流',
  operatingCashFlow: '经营活动现金流',
  totalDebt: '总债务',
  totalCash: '现金及等价物',
  totalStockholdersEquity: '股东权益',
  goodwill: '商誉',
  totalAssets: '总资产',
  totalLiabilities: '总负债',
  totalCurrentAssets: '流动资产',
  totalCurrentLiabilities: '流动负债',
  accountsReceivable: '应收账款',
  inventory: '存货',
  deferredRevenue: '递延收入',
  operatingExpenses: '运营费用',
  sgaExpense: 'SG&A',
  rdExpense: '研发费用',
  dividendsPaid: '已付股息',
  shareRepurchases: '股票回购',
  intangibleAssets: '无形资产',
  longTermDebt: '长期债务',
}

export interface DataQualityRow {
  ticker: string
  year: number
  quarter: number
  periodsCount: number
  coveragePct: number
  hardTruthCoverage: number // 5 core fields
  p0Coverage: number // 31 P0 fields
  fieldSourcesCount: number
  fieldCoverage: Record<string, 'present' | 'missing'>
}

export function getDataQualityMatrix(): DataQualityRow[] {
  const tickers = Array.from(MVP_TICKER_SET)
  return tickers.map(ticker => {
    const rows = getAllFinancialSnapshots(ticker)
    if (rows.length === 0) {
      return {
        ticker,
        year: 0,
        quarter: 0,
        periodsCount: 0,
        coveragePct: 0,
        hardTruthCoverage: 0,
        p0Coverage: 0,
        fieldSourcesCount: 0,
        fieldCoverage: {},
      }
    }

    // Use best row (most populated hard fields)
    const best = rows.reduce((a, b) => {
      const hardFields = ['revenue', 'netIncome', 'grossMargin', 'freeCashFlow', 'operatingCashFlow']
      const ca = hardFields.filter(f => (a as Record<string, unknown>)[f] !== null).length
      const cb = hardFields.filter(f => (b as Record<string, unknown>)[f] !== null).length
      return cb > ca ? b : a
    }, rows[0])

    const fieldCoverage: Record<string, 'present' | 'missing'> = {}
    for (const f of P0_FIELDS) {
      const v = (best as Record<string, unknown>)[f]
      fieldCoverage[f] = v !== null && v !== undefined ? 'present' : 'missing'
    }

    const presentCount = P0_FIELDS.filter(f => fieldCoverage[f] === 'present').length
    const p0Cov = Math.round(presentCount / P0_FIELDS.length * 100)
    const hardFields = ['revenue', 'netIncome', 'grossMargin', 'freeCashFlow', 'operatingCashFlow']
    const hardCov = hardFields.filter(f => (best as Record<string, unknown>)[f] !== null).length

    let fieldSourcesCount = 0
    try {
      const fs = best.fieldSources ? JSON.parse(best.fieldSources) : null
      fieldSourcesCount = fs ? Object.keys(fs).length : 0
    } catch { /* ignore */ }

    return {
      ticker,
      year: best.year,
      quarter: best.quarter,
      periodsCount: rows.length,
      coveragePct: p0Cov,
      hardTruthCoverage: hardCov,
      p0Coverage: presentCount,
      fieldSourcesCount,
      fieldCoverage,
    }
  })
}

// ── Full Financial Snapshot (all P0 fields for a ticker) ─────────────────────

export interface FullFinancialRow {
  year: number
  quarter: number
  // Income Statement
  revenue: number | null
  costOfRevenue: number | null
  grossMargin: number | null
  grossMarginPct: number | null
  operatingExpenses: number | null
  sgaExpense: number | null
  rdExpense: number | null
  sbcExpense: number | null
  depreciationAndAmortization: number | null
  operatingIncome: number | null
  interestExpense: number | null
  interestIncome: number | null
  pretaxIncome: number | null
  incomeTaxExpense: number | null
  netIncome: number | null
  discontinuedOperations: number | null
  comprehensiveIncome: number | null
  // Per-share
  epsDiluted: number | null
  epsBasic: number | null
  weightedAverageSharesBasic: number | null
  weightedAverageSharesDiluted: number | null
  dividendsPerShare: number | null
  // Balance Sheet
  totalCash: number | null
  shortTermInvestments: number | null
  accountsReceivable: number | null
  accountsPayable: number | null
  inventory: number | null
  totalCurrentAssets: number | null
  goodwill: number | null
  intangibleAssets: number | null
  ppneNet: number | null
  totalAssets: number | null
  totalCurrentLiabilities: number | null
  operatingLeaseLiability: number | null
  longTermDebt: number | null
  totalDebt: number | null
  totalLiabilities: number | null
  retainedEarnings: number | null
  totalStockholdersEquity: number | null
  // Cash Flow
  operatingCashFlow: number | null
  capitalExpenditure: number | null
  freeCashFlow: number | null
  fcfMarginPct: number | null
  sbcInCashFlow: number | null
  shareRepurchases: number | null
  dividendsPaid: number | null
  debtIssuance: number | null
  debtRepayment: number | null
  workingCapitalChange: number | null
  acquisitionRelatedCash: number | null
  // Deferred
  deferredRevenue: number | null
  rpo: number | null
  // Market
  marketCap: number | null
  peRatio: number | null
  // Growth
  revenueGrowthYoY: number | null
  // Derived: Margins
  operatingMarginPct: number | null
  netMarginPct: number | null
  ebitdaMarginPct: number | null
  rdIntensityPct: number | null
  sbcIntensityPct: number | null
  sgaToGrossProfitPct: number | null
  effectiveTaxRate: number | null
  // Derived: Per-share
  bookValuePerShare: number | null
  ocfPerShare: number | null
  fcfPerShare: number | null
  ocfpsGrowthYoY: number | null
  fcfpsGrowthYoY: number | null
  // Derived: Leverage
  debtToEquity: number | null
  debtToEbitda: number | null
  netDebt: number | null
  netDebtToEbitda: number | null
  interestCoverage: number | null
  // Derived: Liquidity
  currentRatio: number | null
  quickRatio: number | null
  cashRatio: number | null
  // Derived: Efficiency
  assetTurnover: number | null
  roa: number | null
  roe: number | null
  roic: number | null
  ownersEarnings: number | null
  capexToOcfPct: number | null
  fcfToNetIncomePct: number | null
  // Derived: Working capital
  netWorkingCapital: number | null
  dso: number | null
  dio: number | null
  dpo: number | null
  cashConversionCycle: number | null
  inventoryTurnover: number | null
  // Derived: Growth (YoY)
  netIncomeGrowthYoY: number | null
  operatingIncomeGrowthYoY: number | null
  fcfGrowthYoY: number | null
  odfGrowthYoY: number | null
  // Equity / Comprehensive
  accumulatedOtherComprehensiveIncome: number | null
  additionalPaidInCapital: number | null
  treasuryStock: number | null
  preferredStock: number | null
  minorityInterest: number | null
  netIncomeAttributableToNoncontrolling: number | null
  proceedsFromStockOptions: number | null
  excessTaxBenefit: number | null
  assetGrowthYoY: number | null
  equityGrowthYoY: number | null
  // Derived: Valuation
  earningsYield: number | null
  fcfYield: number | null
  dividendYield: number | null
  buybackYield: number | null
  totalShareholderYield: number | null
  // Derived: Buffett/Moat
  retainedEarningsToMarketValue: number | null
  // Advanced Scoring
  altmanZScore: number | null
  piotroskiFScore: number | null
  beneishMScore: number | null
  // Valuation Multiples
  evEbitda: number | null
  evFcf: number | null
  // CAGR
  revenueCAGR3Y: number | null
  revenueCAGR5Y: number | null
}

// ── Derived metrics helpers (inlined to avoid web-app depending on @equitylens/data) ──

function marginPct(n: number | null, d: number | null): number | null {
  if (n == null || d == null || d === 0) return null
  return (n / d) * 100
}

function div(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null
  return a / b
}

function sumNonNull(...values: (number | null)[]): number | null {
  const filtered = values.filter((v): v is number => v !== null && !isNaN(v))
  if (filtered.length === 0) return null
  return filtered.reduce((a, b) => a + b, 0)
}

function divByDays(value: number | null, revenue: number | null): number | null {
  const ratio = div(value, revenue)
  return ratio !== null ? ratio * 365 : null
}

function yoy(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null
  return ((current - prior) / Math.abs(prior)) * 100
}

function priceFromShares(marketCap: number | null, shares: number | null): number | null {
  if (marketCap != null && shares != null && shares > 0) return marketCap / shares
  return null
}

/** Compute all derived metrics from a raw DB row snapshot. */
function computeRowMetrics(r: Record<string, number | null>, prior: Record<string, number | null> | null) {
  const revenue = r.revenue
  const grossMargin = r.grossMargin
  const operatingIncome = r.operatingIncome
  const netIncome = r.netIncome
  const freeCashFlow = r.freeCashFlow
  const operatingCashFlow = r.operatingCashFlow
  const rdExpense = r.rdExpense
  const sbcExpense = r.sbcExpense
  const sgaExpense = r.sgaExpense
  const pretaxIncome = r.pretaxIncome
  const incomeTaxExpense = r.incomeTaxExpense
  const interestExpense = r.interestExpense
  const depreciationAndAmortization = r.depreciationAndAmortization
  const sharesOutstanding = r.sharesOutstanding
  const totalStockholdersEquity = r.totalStockholdersEquity
  const totalDebt = r.totalDebt
  const totalCash = r.totalCash
  const shortTermInvestments = r.shortTermInvestments
  const totalCurrentAssets = r.totalCurrentAssets
  const totalCurrentLiabilities = r.totalCurrentLiabilities
  const inventory = r.inventory
  const costOfRevenue = r.costOfRevenue
  const accountsReceivable = r.accountsReceivable
  const capitalExpenditure = r.capitalExpenditure
  const dividendsPerShare = r.dividendsPerShare
  const shareRepurchases = r.shareRepurchases
  const retainedEarnings = r.retainedEarnings
  const marketCap = r.marketCap

  // Margins
  const gmPct    = marginPct(grossMargin, revenue)
  const opMargin  = marginPct(operatingIncome, revenue)
  const netMargin = marginPct(netIncome, revenue)
  const ebitda    = sumNonNull(operatingIncome, depreciationAndAmortization)
  const ebitdaMargin = marginPct(ebitda, revenue)
  const fcfMargin   = marginPct(freeCashFlow, revenue)
  const rdIntensity = marginPct(rdExpense, revenue)
  const sbcIntensity = marginPct(sbcExpense, revenue)
  const sgaToGp    = marginPct(sgaExpense, grossMargin)
  const effTaxRate  = marginPct(incomeTaxExpense, pretaxIncome)

  // Per-share
  const bvps     = div(totalStockholdersEquity, sharesOutstanding)
  const ocfPerShare = div(operatingCashFlow, sharesOutstanding)
  const fcfPerShare = div(freeCashFlow, sharesOutstanding)

  // Leverage
  const netDebt = sumNonNull(totalDebt ?? 0, -(totalCash ?? 0), -(shortTermInvestments ?? 0))
  const debtToEquity  = div(totalDebt, totalStockholdersEquity)
  const debtToEbitda_  = div(totalDebt, ebitda)
  const netDebtToEbitda = div(netDebt, ebitda)
  const interestCoverage = div(
    sumNonNull(pretaxIncome ?? 0, interestExpense ?? 0),
    Math.abs(interestExpense ?? 0),
  )

  // Liquidity
  const currentRatio = div(totalCurrentAssets, totalCurrentLiabilities)
  const quickRatio   = div(
    sumNonNull(totalCurrentAssets ?? 0, -(inventory ?? 0)),
    totalCurrentLiabilities,
  )
  const cashRatio = div(
    sumNonNull(totalCash ?? 0, shortTermInvestments ?? 0),
    totalCurrentLiabilities,
  )

  // Efficiency
  const assetTurnover = div(revenue, r.totalAssets)
  const roa  = div(netIncome, r.totalAssets)
  const roe  = div(netIncome, totalStockholdersEquity)
  const investedCapital = sumNonNull(
    totalStockholdersEquity ?? 0,
    totalDebt ?? 0,
    -(totalCash ?? 0),
    -(shortTermInvestments ?? 0),
  )
  const taxAdjNopat = (netIncome !== null && incomeTaxExpense !== null && pretaxIncome !== null && pretaxIncome !== 0)
    ? netIncome + (incomeTaxExpense / pretaxIncome) * (operatingIncome ?? 0)
    : netIncome
  const roic = div(taxAdjNopat, investedCapital)
  const ownersEarnings = sumNonNull(
    netIncome ?? 0,
    depreciationAndAmortization ?? 0,
    -(capitalExpenditure ?? 0),
  )
  const capexToOcf = marginPct(capitalExpenditure, operatingCashFlow)
  const fcfToNI   = marginPct(freeCashFlow, netIncome)

  // Working capital
  const nwc = sumNonNull(totalCurrentAssets ?? 0, -(totalCurrentLiabilities ?? 0))
  const dso = divByDays(accountsReceivable, revenue)
  const dio = divByDays(inventory, costOfRevenue)
  const dpo = divByDays(totalCurrentLiabilities, costOfRevenue)
  const ccc = dso !== null && dio !== null && dpo !== null ? dso + dio - dpo : null
  const invTurnover = div(costOfRevenue, inventory)

  // Valuation
  const price = priceFromShares(marketCap, sharesOutstanding)
  const earningsYield = div(netIncome, marketCap)
  const fcfYield_     = div(freeCashFlow, marketCap)
  const divYield      = div(dividendsPerShare, price)
  const buybackYield_  = div(shareRepurchases, marketCap)
  const totalSYield   = divYield !== null && buybackYield_ !== null
    ? divYield + buybackYield_
    : (divYield ?? buybackYield_)

  // Buffett
  const retainedToMarket = div(retainedEarnings, marketCap)

  // YoY Growth
  let revGrowth: number | null = null
  let niGrowth: number | null = null
  let opIncGrowth: number | null = null
  let fcfGrowth: number | null = null
  let ocfGrowth: number | null = null
  let assetGrowth: number | null = null
  let equityGrowth: number | null = null
  let ocfpsGrowth: number | null = null
  let fcfpsGrowth: number | null = null

  if (prior && prior.year !== undefined) {
    revGrowth   = yoy(revenue, prior.revenue)
    niGrowth    = yoy(netIncome, prior.netIncome)
    opIncGrowth = yoy(operatingIncome, prior.operatingIncome)
    fcfGrowth  = yoy(freeCashFlow, prior.freeCashFlow)
    ocfGrowth  = yoy(operatingCashFlow, prior.operatingCashFlow)
    assetGrowth = yoy(r.totalAssets, prior.totalAssets)
    equityGrowth = yoy(totalStockholdersEquity, prior.totalStockholdersEquity)
    ocfpsGrowth = yoy(ocfPerShare, div(prior.operatingCashFlow, prior.sharesOutstanding))
    fcfpsGrowth = yoy(fcfPerShare, div(prior.freeCashFlow, prior.sharesOutstanding))
  }

  return {
    // Margins
    operatingMarginPct: opMargin,
    netMarginPct: netMargin,
    ebitdaMarginPct: ebitdaMargin,
    rdIntensityPct: rdIntensity,
    sbcIntensityPct: sbcIntensity,
    sgaToGrossProfitPct: sgaToGp,
    effectiveTaxRate: effTaxRate,
    // Per-share
    bookValuePerShare: bvps,
    ocfPerShare,
    fcfPerShare,
    ocfpsGrowthYoY: ocfpsGrowth,
    fcfpsGrowthYoY: fcfpsGrowth,
    // Leverage
    debtToEquity,
    debtToEbitda: debtToEbitda_,
    netDebt,
    netDebtToEbitda: netDebtToEbitda,
    interestCoverage,
    // Liquidity
    currentRatio,
    quickRatio,
    cashRatio,
    // Efficiency
    assetTurnover,
    roa,
    roe,
    roic,
    ownersEarnings,
    capexToOcfPct: capexToOcf,
    fcfToNetIncomePct: fcfToNI,
    // Working capital
    netWorkingCapital: nwc,
    dso,
    dio,
    dpo,
    cashConversionCycle: ccc,
    inventoryTurnover: invTurnover,
    // Growth
    netIncomeGrowthYoY: niGrowth,
    operatingIncomeGrowthYoY: opIncGrowth,
    fcfGrowthYoY: fcfGrowth,
    odfGrowthYoY: ocfGrowth,
    assetGrowthYoY: assetGrowth,
    equityGrowthYoY: equityGrowth,
    // Valuation
    earningsYield,
    fcfYield: fcfYield_,
    dividendYield: divYield,
    buybackYield: buybackYield_,
    totalShareholderYield: totalSYield,
    retainedEarningsToMarketValue: retainedToMarket,
  }
}

export function getFullFinancialHistory(ticker: string): FullFinancialRow[] {
  const rows = getAllFinancialSnapshots(ticker.toUpperCase())

  // Enforce 5-year scope: FY2021–FY2025 (supports 3Y CAGR, 5Y CAGR, Beneish M-Score)
  const now = new Date()
  const currentYear = now.getFullYear()
  const startYear = currentYear - 5   // FY2021 (5 years back)
  const endYear = currentYear - 1    // FY2025 (last completed full year)

  // Filter to 5 fiscal years, then reverse to oldest→newest
  const filtered = rows
    .filter(r => r.year >= startYear && r.year <= endYear)
    .reverse() // oldest → newest

  // ── CAGR helpers ──────────────────────────────────────────────────────────
  // Find annual (quarter=0) snapshots for CAGR computation
  const annualRows = filtered.filter(r => r.quarter === 0)
  function getAnnualRevenue(year: number): number | null {
    const row = annualRows.find(r => r.year === year)
    return row?.revenue ?? null
  }

  // ── Altman Z-Score helpers ────────────────────────────────────────────────
  function totalAssetsTA(r: typeof filtered[0]): number | null { return r.totalAssets ?? null }
  function totalLiabilitiesTL(r: typeof filtered[0]): number | null { return r.totalLiabilities ?? null }
  function revenueR(r: typeof filtered[0]): number | null { return r.revenue ?? null }
  function ebitdaEBIT(r: typeof filtered[0]): number | null {
    if (r.operatingIncome == null || r.depreciationAndAmortization == null) return null
    return r.operatingIncome + r.depreciationAndAmortization
  }
  function marketCapME(r: typeof filtered[0]): number | null { return r.marketCap ?? null }
  function equityE(r: typeof filtered[0]): number | null { return r.totalStockholdersEquity ?? null }
  function wc(r: typeof filtered[0]): number | null {
    if (r.totalCurrentAssets == null || r.totalCurrentLiabilities == null) return null
    return r.totalCurrentAssets - r.totalCurrentLiabilities
  }
  function re(r: typeof filtered[0]): number | null { return r.retainedEarnings ?? null }

  function altmanZ(r: typeof filtered[0]): number | null {
    const TA = totalAssetsTA(r)
    const TL = totalLiabilitiesTL(r)
    const R = revenueR(r)
    const EBIT = ebitdaEBIT(r)
    const ME = marketCapME(r)
    const E = equityE(r)
    const WC = wc(r)
    const RE = re(r)

    if (!TA || !TL || TL === 0) return null
    const X1 = (WC != null) ? WC / TA : null
    const X2 = (RE != null) ? RE / TA : null
    const X3 = (EBIT != null) ? EBIT / TA : null
    const marketEquity = ME ?? E
    const X4 = (marketEquity != null) ? marketEquity / TL : null
    const X5 = (R != null) ? R / TA : null

    const components = [X1, X2, X3, X4, X5].filter((c): c is number => c !== null)
    if (components.length < 3) return null
    return 1.2*(X1??0) + 1.4*(X2??0) + 3.3*(X3??0) + 0.6*(X4??0) + 1.0*(X5??0)
  }

  // ── Piotroski F-Score helper ──────────────────────────────────────────────
  function piotroskiF(r: typeof filtered[0], prior: typeof filtered[0] | null): number | null {
    if (!prior) return null
    const roaPos = (r.totalAssets && r.netIncome) ? r.netIncome / r.totalAssets > 0 : false
    const ocfPos = (r.operatingCashFlow ?? 0) > 0
    const priorRoa = (prior.totalAssets && prior.netIncome) ? prior.netIncome / prior.totalAssets : null
    const currRoa = (r.totalAssets && r.netIncome) ? r.netIncome / r.totalAssets : null
    const roaImp = currRoa !== null && priorRoa !== null ? currRoa > priorRoa : false
    const noNewDebt = r.longTermDebt != null && prior.longTermDebt != null
      ? r.longTermDebt <= prior.longTermDebt : true
    const gmCurr = r.revenue ? (r.grossMargin ?? 0) / r.revenue : null
    const gmPrior = prior.revenue ? (prior.grossMargin ?? 0) / prior.revenue : null
    const gmImp = gmCurr !== null && gmPrior !== null ? gmCurr > gmPrior : false
    const atCurr = r.totalAssets && r.revenue ? r.revenue / r.totalAssets : null
    const atPrior = prior.totalAssets && prior.revenue ? prior.revenue / prior.totalAssets : null
    const atImp = atCurr !== null && atPrior !== null ? atCurr > atPrior : false

    return Number(roaPos) + Number(ocfPos) + Number(roaImp) +
      Number(r.operatingCashFlow && r.netIncome ? r.operatingCashFlow > r.netIncome : false) +
      Number(noNewDebt) + Number(gmImp) + Number(atImp)
  }

  // ── Beneish M-Score helper (simplified, requires prior year) ───────────────
  function beneishM(r: typeof filtered[0], prior: typeof filtered[0] | null): number | null {
    if (!prior || !r.totalAssets || !prior.totalAssets) return null
    const currR = r.revenue
    const priorR = prior.revenue
    if (!currR || !priorR || priorR === 0) return null
    const currDSR = r.accountsReceivable && currR ? r.accountsReceivable / currR : null
    const priorDSR = prior.accountsReceivable && priorR ? prior.accountsReceivable / priorR : null
    const DSRI = currDSR && priorDSR && priorDSR !== 0 ? currDSR / priorDSR : null
    const GMI = currR && r.grossMargin && priorR && prior.grossMargin
      ? (prior.grossMargin / priorR) / (r.grossMargin / currR) : null
    const SGI = currR / priorR
    const TATA = r.netIncome != null && r.operatingCashFlow != null
      ? (r.netIncome - r.operatingCashFlow) / ((r.totalAssets + prior.totalAssets) / 2)
      : null
    const t = (v: number | null) => v ?? 0
    return -4.84 + 0.920*t(DSRI) + 0.528*t(GMI) + 0.892*t(SGI) + 4.697*t(TATA)
  }

  // ── EV / EBITDA / FCF ────────────────────────────────────────────────────
  function evCalc(r: typeof filtered[0]): number | null {
    const MC = r.marketCap
    const TD = r.totalDebt
    const PS = r.preferredStock
    const MI = r.minorityInterest
    const C = r.totalCash
    const STI = r.shortTermInvestments
    if (MC == null && TD == null) return null
    return (MC ?? 0) + (TD ?? 0) + (PS ?? 0) + (MI ?? 0) - (C ?? 0) - (STI ?? 0)
  }

  return filtered.map((r, i) => {
    const raw = r as unknown as Record<string, number | null>
    // Prior snapshot: same fiscal quarter (quarter/period), prior year
    const prior = filtered.find(p =>
      p.quarter === r.quarter &&
      p.year === r.year - 1
    ) as (typeof filtered)[0] | undefined ?? null
    const derived = computeRowMetrics(raw, prior ? prior as unknown as Record<string, number | null> : null)

    // CAGR: compute from annual snapshots
    const revFY2025 = getAnnualRevenue(currentYear - 1)
    const revFY2022 = getAnnualRevenue(currentYear - 4)
    const revFY2020 = getAnnualRevenue(currentYear - 6)
    const cagr3Y = revFY2025 != null && revFY2022 != null ? Math.pow(revFY2025 / revFY2022, 1/3) - 1 : null
    const cagr5Y = revFY2025 != null && revFY2020 != null ? Math.pow(revFY2025 / revFY2020, 1/5) - 1 : null

    // EV/EBITDA/FCF
    const ev = evCalc(r)
    const ebitda = r.operatingIncome != null && r.depreciationAndAmortization != null
      ? r.operatingIncome + r.depreciationAndAmortization : null
    const evEbitda_ = ev != null && ebitda != null && ebitda !== 0 ? ev / ebitda : null
    const evFcf_ = ev != null && r.freeCashFlow != null && r.freeCashFlow !== 0 ? ev / r.freeCashFlow : null

    return {
      year: r.year,
      quarter: r.quarter,
      // Income Statement
      revenue: r.revenue,
      costOfRevenue: r.costOfRevenue,
      grossMargin: r.grossMargin,
      grossMarginPct: r.grossMarginPct,
      operatingExpenses: r.operatingExpenses,
      sgaExpense: r.sgaExpense,
      rdExpense: r.rdExpense,
      sbcExpense: r.sbcExpense,
      depreciationAndAmortization: r.depreciationAndAmortization,
      operatingIncome: r.operatingIncome,
      interestExpense: r.interestExpense,
      interestIncome: r.interestIncome,
      pretaxIncome: r.pretaxIncome,
      incomeTaxExpense: r.incomeTaxExpense,
      netIncome: r.netIncome,
      discontinuedOperations: r.discontinuedOperations,
      comprehensiveIncome: r.comprehensiveIncome,
      // Per-share
      epsDiluted: r.epsDiluted ?? r.eps,
      epsBasic: r.epsBasic,
      weightedAverageSharesBasic: r.weightedAverageSharesBasic,
      weightedAverageSharesDiluted: r.weightedAverageSharesDiluted,
      dividendsPerShare: r.dividendsPerShare,
      // Balance Sheet
      totalCash: r.totalCash,
      shortTermInvestments: r.shortTermInvestments,
      accountsReceivable: r.accountsReceivable,
      accountsPayable: r.accountsPayable,
      inventory: r.inventory,
      totalCurrentAssets: r.totalCurrentAssets,
      goodwill: r.goodwill,
      intangibleAssets: r.intangibleAssets,
      ppneNet: r.ppneNet,
      totalAssets: r.totalAssets,
      totalCurrentLiabilities: r.totalCurrentLiabilities,
      operatingLeaseLiability: r.operatingLeaseLiability,
      longTermDebt: r.longTermDebt,
      totalDebt: r.totalDebt,
      totalLiabilities: r.totalLiabilities,
      retainedEarnings: r.retainedEarnings,
      totalStockholdersEquity: r.totalStockholdersEquity,
      // Cash Flow
      operatingCashFlow: r.operatingCashFlow,
      capitalExpenditure: r.capitalExpenditure,
      freeCashFlow: r.freeCashFlow,
      fcfMarginPct: r.fcfMarginPct,
      sbcInCashFlow: r.sbcInCashFlow,
      shareRepurchases: r.shareRepurchases,
      dividendsPaid: r.dividendsPaid,
      debtIssuance: r.debtIssuance,
      debtRepayment: r.debtRepayment,
      workingCapitalChange: r.workingCapitalChange,
      acquisitionRelatedCash: r.acquisitionRelatedCash,
      // Deferred
      deferredRevenue: r.deferredRevenue,
      rpo: r.rpo,
      // Market
      marketCap: r.marketCap,
      peRatio: r.peRatio,
      // Growth
      revenueGrowthYoY: r.revenueGrowthYoY,
      // Equity / Comprehensive
      accumulatedOtherComprehensiveIncome: r.accumulatedOtherComprehensiveIncome,
      additionalPaidInCapital: r.additionalPaidInCapital,
      treasuryStock: r.treasuryStock,
      preferredStock: r.preferredStock,
      minorityInterest: r.minorityInterest,
      netIncomeAttributableToNoncontrolling: r.netIncomeAttributableToNoncontrolling,
      proceedsFromStockOptions: r.proceedsFromStockOptions,
      excessTaxBenefit: r.excessTaxBenefit,
      // Derived
      ...derived,
      // Advanced Scoring Models
      altmanZScore: altmanZ(r),
      piotroskiFScore: piotroskiF(r, prior),
      beneishMScore: beneishM(r, prior),
      // Valuation Multiples
      evEbitda: evEbitda_,
      evFcf: evFcf_,
      // CAGR
      revenueCAGR3Y: cagr3Y,
      revenueCAGR5Y: cagr5Y,
    }
  })
}
