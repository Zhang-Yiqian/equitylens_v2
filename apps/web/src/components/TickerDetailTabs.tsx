'use client'

import { useState } from 'react'
import { formatCurrency, formatPctAbs, formatPct } from '@/lib/utils'

type FilingTypeFilter = 'all' | '10-K' | '10-Q';

type Tab = 'income' | 'balance' | 'cashflow' | 'per-share' | 'growth' | 'derived' | 'equity' | 'annual'

// ── Color coding for key metrics ────────────────────────────────────────────────

/** Color class for a pct-type metric value. */
function pctColor(v: number | null, green: number, amber: number): string {
  if (v == null) return 'text-slate-400'
  if (v >= green) return 'text-emerald-600'
  if (v >= amber) return 'text-amber-600'
  return 'text-red-500'
}

/** Color class for a ratio-type metric value. */
function ratioColor(v: number | null, green: number, amber: number): string {
  if (v == null) return 'text-slate-400'
  if (v <= green) return 'text-emerald-600'
  if (v <= amber) return 'text-amber-600'
  return 'text-red-500'
}

/** Format and color a key metric value for display. */
function KeyMetric({ label, value, colorClass }: { label: string; value: string; colorClass: string }) {
  return (
    <span className={`font-semibold ${colorClass}`}>{value}</span>
  )
}

// ── Expandable filing text section ─────────────────────────────────────────

function FilingSection({ title, content, sectionType }: { title: string; content: string | null; sectionType: 'mda' | 'risk' | 'selectedFinData' | 'marketRisk' | 'controls' }) {
  const [expanded, setExpanded] = useState(false)
  const sectionColor: Record<string, string> = {
    mda: 'border-blue-200 bg-blue-50/50',
    risk: 'border-red-200 bg-red-50/50',
    selectedFinData: 'border-amber-200 bg-amber-50/50',
    marketRisk: 'border-purple-200 bg-purple-50/50',
    controls: 'border-emerald-200 bg-emerald-50/50',
  }
  const labelColor: Record<string, string> = {
    mda: 'text-blue-700',
    risk: 'text-red-700',
    selectedFinData: 'text-amber-700',
    marketRisk: 'text-purple-700',
    controls: 'text-emerald-700',
  }
  const borderColor: Record<string, string> = {
    mda: 'border-blue-200',
    risk: 'border-red-200',
    selectedFinData: 'border-amber-200',
    marketRisk: 'border-purple-200',
    controls: 'border-emerald-200',
  }

  if (!content) return null
  const wordCount = content.split(/\s+/).filter(Boolean).length
  const displayText = expanded ? content : content.slice(0, 2000) + (content.length > 2000 ? '...' : '')

  return (
    <div className={`rounded-lg border ${borderColor[sectionType]} ${sectionColor[sectionType]} overflow-hidden`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/50 transition-colors"
      >
        <span className={`text-sm font-semibold ${labelColor[sectionType]}`}>{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{wordCount.toLocaleString()} 字</span>
          <span className="text-xs text-slate-400">{expanded ? '收起' : '展开'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-mono">
            {displayText}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Scoring display ─────────────────────────────────────────────────────────

function ScoringBadge({ label, value, zone }: { label: string; value: number | null; zone?: 'safe' | 'grey' | 'distress' | 'manipulation' | 'strong' | 'neutral' | 'weak' }) {
  const colors: Record<string, string> = {
    safe: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    strong: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    grey: 'bg-amber-100 text-amber-700 border-amber-200',
    neutral: 'bg-amber-100 text-amber-700 border-amber-200',
    distress: 'bg-red-100 text-red-700 border-red-200',
    weak: 'bg-red-100 text-red-700 border-red-200',
    manipulation: 'bg-red-100 text-red-700 border-red-200',
  }
  if (value == null) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[zone ?? 'neutral'] ?? colors.neutral}`}>
      {label}: {typeof value === 'number' ? value.toFixed(2) : value}
    </span>
  )
}

// ── Raw P0 fields ──────────────────────────────────────────────────────────────

const INCOME_FIELDS = [
  { key: 'revenue', label: '营业收入' },
  { key: 'costOfRevenue', label: '营业成本' },
  { key: 'grossMargin', label: '毛利润' },
  { key: 'grossMarginPct', label: '毛利率 %' },
  { key: 'operatingExpenses', label: '运营费用' },
  { key: 'sgaExpense', label: 'SG&A' },
  { key: 'rdExpense', label: '研发费用' },
  { key: 'sbcExpense', label: 'SBC 股权激励' },
  { key: 'depreciationAndAmortization', label: 'D&A' },
  { key: 'operatingIncome', label: '营业利润' },
  { key: 'interestExpense', label: '利息支出' },
  { key: 'interestIncome', label: '利息收入' },
  { key: 'pretaxIncome', label: '税前利润' },
  { key: 'incomeTaxExpense', label: '所得税' },
  { key: 'netIncome', label: '净利润' },
  { key: 'discontinuedOperations', label: '终止经营' },
  { key: 'comprehensiveIncome', label: '综合收益' },
]

const BALANCE_FIELDS = [
  { key: 'totalCash', label: '现金及等价物' },
  { key: 'shortTermInvestments', label: '短期投资' },
  { key: 'accountsReceivable', label: '应收账款' },
  { key: 'accountsPayable', label: '应付账款' },
  { key: 'inventory', label: '存货' },
  { key: 'totalCurrentAssets', label: '流动资产' },
  { key: 'goodwill', label: '商誉' },
  { key: 'intangibleAssets', label: '无形资产' },
  { key: 'ppneNet', label: '固定资产净值 (PP&E)' },
  { key: 'totalAssets', label: '总资产' },
  { key: 'totalCurrentLiabilities', label: '流动负债' },
  { key: 'operatingLeaseLiability', label: '租赁负债' },
  { key: 'longTermDebt', label: '长期负债' },
  { key: 'totalDebt', label: '总债务' },
  { key: 'totalLiabilities', label: '总负债' },
  { key: 'retainedEarnings', label: '留存收益' },
  { key: 'totalStockholdersEquity', label: '股东权益' },
]

const CASHFLOW_FIELDS = [
  { key: 'operatingCashFlow', label: '经营活动现金流' },
  { key: 'capitalExpenditure', label: '资本支出 (CapEx)' },
  { key: 'freeCashFlow', label: '自由现金流 (FCF)' },
  { key: 'fcfMarginPct', label: 'FCF Margin %' },
  { key: 'sbcInCashFlow', label: 'SBC (Cash Flow)' },
  { key: 'shareRepurchases', label: '股票回购' },
  { key: 'dividendsPaid', label: '已付股息' },
  { key: 'debtIssuance', label: '债务发行' },
  { key: 'debtRepayment', label: '债务偿还' },
  { key: 'workingCapitalChange', label: '营运资本变动' },
  { key: 'acquisitionRelatedCash', label: '收购/并购现金' },
]

const PER_SHARE_FIELDS = [
  { key: 'epsDiluted', label: 'EPS 摊薄' },
  { key: 'epsBasic', label: 'EPS 基础' },
  { key: 'weightedAverageSharesBasic', label: '加权平均股数 (B)' },
  { key: 'weightedAverageSharesDiluted', label: '加权平均股数 (D)' },
  { key: 'dividendsPerShare', label: '每股股息' },
  { key: 'bookValuePerShare', label: '每股净资产 (BPS)' },
  { key: 'ocfPerShare', label: '每股经营现金流' },
  { key: 'fcfPerShare', label: '每股自由现金流' },
]

// ── Growth YoY ─────────────────────────────────────────────────────────────────

const GROWTH_FIELDS = [
  { key: 'revenueGrowthYoY', label: '营收 YoY' },
  { key: 'netIncomeGrowthYoY', label: '净利润 YoY' },
  { key: 'operatingIncomeGrowthYoY', label: '营业利润 YoY' },
  { key: 'odfGrowthYoY', label: '经营现金流 YoY' },
  { key: 'fcfGrowthYoY', label: 'FCF YoY' },
  { key: 'ocfpsGrowthYoY', label: 'OCFPS YoY' },
  { key: 'fcfpsGrowthYoY', label: 'FCFPS YoY' },
  { key: 'assetGrowthYoY', label: '总资产 YoY' },
  { key: 'equityGrowthYoY', label: '股东权益 YoY' },
]

const EQUITY_FIELDS = [
  { key: 'additionalPaidInCapital', label: '资本公积' },
  { key: 'treasuryStock', label: '库存股' },
  { key: 'preferredStock', label: '优先股账面价值' },
  { key: 'accumulatedOtherComprehensiveIncome', label: '累计其他综合收益' },
  { key: 'minorityInterest', label: '少数股东权益' },
  { key: 'netIncomeAttributableToNoncontrolling', label: '归母净利润' },
  { key: 'proceedsFromStockOptions', label: '期权行权收入' },
  { key: 'excessTaxBenefit', label: 'SBC 税收优惠' },
]

// ── Derived metrics ────────────────────────────────────────────────────────────

const MARGIN_FIELDS = [
  { key: 'grossMarginPct', label: '毛利率 %' },
  { key: 'operatingMarginPct', label: '营业利润率 %' },
  { key: 'netMarginPct', label: '净利润率 %' },
  { key: 'ebitdaMarginPct', label: 'EBITDA Margin %' },
  { key: 'fcfMarginPct', label: 'FCF Margin %' },
  { key: 'rdIntensityPct', label: '研发强度 %' },
  { key: 'sbcIntensityPct', label: 'SBC 强度 %' },
  { key: 'sgaToGrossProfitPct', label: 'SG&A/毛利润 %' },
  { key: 'effectiveTaxRate', label: '实际税率 %' },
]

const LEVERAGE_FIELDS = [
  { key: 'debtToEquity', label: 'Debt / Equity' },
  { key: 'debtToEbitda', label: 'Debt / EBITDA' },
  { key: 'netDebt', label: '净债务' },
  { key: 'netDebtToEbitda', label: '净债务/EBITDA' },
  { key: 'interestCoverage', label: '利息覆盖倍数' },
]

const LIQUIDITY_FIELDS = [
  { key: 'currentRatio', label: '流动比率' },
  { key: 'quickRatio', label: '速动比率' },
  { key: 'cashRatio', label: '现金比率' },
]

const EFFICIENCY_FIELDS = [
  { key: 'assetTurnover', label: '资产周转率' },
  { key: 'roa', label: 'ROA %' },
  { key: 'roe', label: 'ROE %' },
  { key: 'roic', label: 'ROIC %' },
  { key: 'ownersEarnings', label: '所有者收益' },
  { key: 'capexToOcfPct', label: 'CapEx/OCF %' },
  { key: 'fcfToNetIncomePct', label: 'FCF/净利润 %' },
  { key: 'dso', label: 'DSO 应收账款天数' },
  { key: 'dio', label: 'DIO 存货天数' },
  { key: 'dpo', label: 'DPO 应付账款天数' },
  { key: 'cashConversionCycle', label: '现金转换周期' },
]

const VALUATION_FIELDS = [
  { key: 'earningsYield', label: '盈利收益率 %' },
  { key: 'fcfYield', label: 'FCF 收益率 %' },
  { key: 'dividendYield', label: '股息率 %' },
  { key: 'buybackYield', label: '回购收益率 %' },
  { key: 'totalShareholderYield', label: '股东总收益率 %' },
]

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Detect if a field is a derived metric that needs special formatting. */
function fieldType(key: string): 'pct' | 'days' | 'currency' | 'ratio' | 'number' {
  if (key.endsWith('GrowthYoY') || key.endsWith('MarginPct') ||
      key.endsWith('IntensityPct') || key.endsWith('GrossProfitPct') ||
      key === 'effectiveTaxRate' || key.endsWith('ToGrossProfitPct') ||
      key.endsWith('capexToOcfPct') || key.endsWith('fcfToNetIncomePct') ||
      key.endsWith('Yield')) {
    return 'pct'
  }
  if (key === 'dso' || key === 'dio' || key === 'dpo' || key === 'cashConversionCycle') {
    return 'days'
  }
  if (key === 'netDebt' || key === 'ownersEarnings') {
    return 'currency'
  }
  if (key.endsWith('Ratio') || key.endsWith('Turnover') || key.endsWith('assetTurnover') ||
      key === 'debtToEquity' || key === 'debtToEbitda' || key === 'netDebtToEbitda' ||
      key === 'interestCoverage') {
    return 'ratio'
  }
  return 'number'
}

/**
 * Get color class for a key metric cell.
 * Green: strong (ROIC > 15%, grossMargin > 50%, debtToEquity < 0.5x, etc.)
 * Amber: moderate (ROIC 8-15%, grossMargin 30-50%, debtToEquity 0.5-1.5x)
 * Red: weak/risk (ROIC < 8%, grossMargin < 30%, debtToEquity > 1.5x, negative OCF)
 */
function keyMetricColor(key: string, v: number): string {
  switch (key) {
    // Strong metrics (higher = better)
    case 'roic':
    case 'roe':
    case 'roa':
      if (v >= 15) return 'text-emerald-600'
      if (v >= 8) return 'text-amber-600'
      return 'text-red-500'
    case 'grossMarginPct':
    case 'operatingMarginPct':
    case 'netMarginPct':
    case 'ebitdaMarginPct':
    case 'fcfMarginPct':
      if (v >= 50) return 'text-emerald-600'
      if (v >= 30) return 'text-amber-600'
      return 'text-red-500'
    case 'revenueGrowthYoY':
    case 'netIncomeGrowthYoY':
    case 'fcfGrowthYoY':
    case 'operatingIncomeGrowthYoY':
      if (v >= 20) return 'text-emerald-600'
      if (v >= 5) return 'text-amber-600'
      return v >= 0 ? 'text-slate-600' : 'text-red-500'
    case 'debtToEquity':
    case 'debtToEbitda':
    case 'netDebtToEbitda':
      if (v <= 0.5) return 'text-emerald-600'
      if (v <= 1.5) return 'text-amber-600'
      return 'text-red-500'
    case 'currentRatio':
    case 'quickRatio':
      if (v >= 2) return 'text-emerald-600'
      if (v >= 1) return 'text-amber-600'
      return 'text-red-500'
    case 'interestCoverage':
      if (v >= 5) return 'text-emerald-600'
      if (v >= 2) return 'text-amber-600'
      return 'text-red-500'
    case 'cashConversionCycle':
      if (v <= 30) return 'text-emerald-600'
      if (v <= 90) return 'text-amber-600'
      return 'text-red-500'
    // Cash flow metrics (positive = better)
    case 'freeCashFlow':
    case 'operatingCashFlow':
    case 'ownersEarnings':
      if (v > 0) return 'text-emerald-600'
      return 'text-red-500'
    // Valuation metrics (lower = better for earnings yield, etc.)
    case 'evEbitda':
      if (v <= 15) return 'text-emerald-600'
      if (v <= 25) return 'text-amber-600'
      return 'text-red-500'
    case 'evFcf':
      if (v <= 20) return 'text-emerald-600'
      if (v <= 35) return 'text-amber-600'
      return 'text-red-500'
    case 'revenueCAGR3Y':
    case 'revenueCAGR5Y':
      if (v >= 0.20) return 'text-emerald-600'
      if (v >= 0.05) return 'text-amber-600'
      return v >= 0 ? 'text-slate-600' : 'text-red-500'
    default:
      return ''
  }
}

function formatDerived(v: number | null, key: string): string | null {
  if (v == null) return null
  const t = fieldType(key)
  if (t === 'pct') return formatPct(v)
  if (t === 'days') return `${v.toFixed(0)} 天`
  if (t === 'currency') return formatCurrency(v)
  if (t === 'ratio') return `${v.toFixed(2)}x`
  return formatCurrency(v)
}

// ── FinancialTable ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FinancialTable({ rows, fields }: { rows: any[]; fields: { key: string; label: string }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">暂无数据</p>
  }

  // Two-table layout: left = frozen label column, right = horizontally scrolling data
  return (
    <div className="flex gap-0 overflow-hidden rounded-lg border border-slate-200">
      {/* ── Left: frozen metric labels ───────────────────────────── */}
      <div className="shrink-0 overflow-hidden border-r border-slate-200 bg-white z-10"
           style={{ width: '9rem' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">
                指标
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map(({ key, label }) => {
              const present = rows.filter(r => r[key] != null).length
              const rowBg = present === rows.length
                ? 'bg-emerald-50'
                : present > 0
                ? 'bg-amber-50'
                : ''
              const rowColor = present === rows.length
                ? 'text-emerald-700'
                : present > 0
                ? 'text-amber-700'
                : 'text-slate-400'
              return (
                <tr key={key} className={`border-b border-slate-100 hover:bg-slate-50/50 ${rowBg}`}>
                  <td className={`px-3 py-1.5 font-medium ${rowColor}`}>
                    {label}
                    {present < rows.length && (
                      <span className="ml-1 text-[10px] text-slate-400">({present}/{rows.length})</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Right: horizontally scrolling data columns ───────────── */}
      <div className="flex-1 overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {rows.map((r, i) => (
                <th key={i} className={`px-3 py-2 text-right font-semibold whitespace-nowrap min-w-[5rem] ${
                  r.quarter === 0 ? 'text-primary' : 'text-slate-600'
                }`}>
                  {r.quarter === 0 ? `FY${r.year} 年度` : `FY${r.year} Q${r.quarter}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map(({ key }) => {
              const present = rows.filter(r => r[key] != null).length
              const rowBg = present === rows.length
                ? 'bg-emerald-50'
                : present > 0
                ? 'bg-amber-50'
                : ''
              return (
                <tr key={key} className={`border-b border-slate-100 hover:bg-slate-50/50 ${rowBg}`}>
                  {rows.map((r, i) => {
                    const v = r[key]
                    let fmt: string | null = null
                    if (typeof v === 'number') {
                      fmt = formatDerived(v, key)
                      if (fmt === null) {
                        if (Math.abs(v) >= 1e9) fmt = formatCurrency(v)
                        else if (Math.abs(v) >= 1e6) fmt = formatCurrency(v)
                        else if (v >= 100 || v <= -100) fmt = formatCurrency(v)
                        else if (Number.isInteger(v)) fmt = formatCurrency(v)
                        else if (v < 0) fmt = `${(v * 100).toFixed(1)}%`
                        else if (v > 1) fmt = `${v.toFixed(2)}x`
                        else fmt = formatPctAbs(v)
                      }
                    }
                    const colorClass = typeof v === 'number' ? keyMetricColor(key, v) : ''
                    return (
                      <td
                        key={i}
                        className={`px-3 py-1.5 text-right tabular-nums min-w-[5rem] ${
                          v == null ? 'text-slate-300' : 'text-slate-700'
                        } ${colorClass ?? ''}`}
                      >
                        {fmt ?? '—'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Derived sub-section table (one section at a time) ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DerivedSection({ title, fields, rows }: { title: string; fields: { key: string; label: string }[]; rows: any[] }) {
  const nonEmpty = fields.filter(f => rows.some(r => r[f.key] != null))
  if (nonEmpty.length === 0) return null
  return (
    <div>
      <p className="px-3 pt-3 pb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      <FinancialTable rows={rows} fields={nonEmpty} />
    </div>
  )
}

// ── Report card (one filing) ───────────────────────────────────────────────────

function ReportCard({ report, ticker }: { report: TenKCacheDisplay; ticker: string }) {
  const [expanded, setExpanded] = useState(false)
  const is10K = report.filingType === '10-K'

  const labelColor = is10K
    ? 'bg-slate-800 text-white'
    : 'bg-slate-500 text-white'
  const label = is10K ? '10-K 年报' : '10-Q 季报'

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Report header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${labelColor}`}>
            {label}
          </span>
          <div className="text-left">
            <div className="text-sm font-semibold text-slate-700">
              FY{report.year} {report.filingDate ? `· ${report.filingDate}` : ''}
            </div>
            <div className="text-xs text-slate-400">
              {ticker} · {is10K ? 'Annual Report' : 'Quarterly Report'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {report.documentUrl && (
            <a
              href={report.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-slate-400 hover:text-primary transition-colors"
            >
              SEC EDGAR ↗
            </a>
          )}
          <span className="text-xs text-slate-400">{expanded ? '收起' : '展开'}</span>
        </div>
      </button>

      {/* Expanded sections */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50/30">
          {is10K ? (
            <>
              {report.item7MdAndA && (
                <FilingSection title="Item 7 — 管理层讨论与分析 (MD&A)" content={report.item7MdAndA} sectionType="mda" />
              )}
              {report.item6SelectedFinData && (
                <FilingSection title="Item 6 — 精选财务数据" content={report.item6SelectedFinData} sectionType="selectedFinData" />
              )}
              {report.item7AFactors && (
                <FilingSection title="Item 7A — 市场风险披露" content={report.item7AFactors} sectionType="marketRisk" />
              )}
              {report.item9Controls && (
                <FilingSection title="Item 9A — 内部控制" content={report.item9Controls} sectionType="controls" />
              )}
              {report.item1ARiskFactors && (
                <FilingSection title="Item 1A — 风险因素" content={report.item1ARiskFactors} sectionType="risk" />
              )}
              {report.item1Business && (
                <FilingSection title="Item 1 — 业务概述" content={report.item1Business} sectionType="mda" />
              )}
            </>
          ) : (
            <>
              {report.item2MdAndA && (
                <FilingSection title="Item 2 — 管理层讨论与分析 (MD&A)" content={report.item2MdAndA} sectionType="mda" />
              )}
              {report.item1Financials && (
                <FilingSection title="Item 1 — 财务报表" content={report.item1Financials} sectionType="selectedFinData" />
              )}
              {report.item3Defaults && (
                <FilingSection title="Item 3 — 定量/定性市场风险" content={report.item3Defaults} sectionType="marketRisk" />
              )}
              {report.item4Controls && (
                <FilingSection title="Item 4 — 内部控制" content={report.item4Controls} sectionType="controls" />
              )}
            </>
          )}
          {!is10K && !report.item2MdAndA && !report.item1Financials && !report.item3Defaults && !report.item4Controls && (
            <p className="text-xs text-slate-400 py-2">此报告章节内容暂未提取。</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

interface TenKCacheDisplay {
  year: number
  filingDate: string | null
  filingType: string | null
  documentUrl: string | null
  item7MdAndA: string | null
  item6SelectedFinData: string | null
  item7AFactors: string | null
  item9Controls: string | null
  item1ARiskFactors: string | null
  item1Business: string | null
  // 10-Q specific
  item1Financials: string | null
  item2MdAndA: string | null
  item3Defaults: string | null
  item4Controls: string | null
}

interface TickerDetailTabsProps {
  ticker: string
  financialHistory: unknown[]
  analysis?: unknown
  tenKCacheData?: TenKCacheDisplay[] | null
}

export function TickerDetailTabs({ ticker, financialHistory, analysis, tenKCacheData }: TickerDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('income')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenK: TenKCacheDisplay[] = tenKCacheData ?? []
  const [reportFilter, setReportFilter] = useState<FilingTypeFilter>('all')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (financialHistory as any[]).slice().reverse() // oldest → newest

  const tabDefs: { id: Tab; label: string; count: number }[] = [
    { id: 'income', label: '利润表', count: INCOME_FIELDS.length },
    { id: 'balance', label: '资产负债表', count: BALANCE_FIELDS.length },
    { id: 'cashflow', label: '现金流量表', count: CASHFLOW_FIELDS.length },
    { id: 'per-share', label: '每股指标', count: PER_SHARE_FIELDS.length },
    { id: 'derived', label: '分析', count: MARGIN_FIELDS.length + LEVERAGE_FIELDS.length + LIQUIDITY_FIELDS.length + EFFICIENCY_FIELDS.length + VALUATION_FIELDS.length },
    { id: 'growth', label: '增长分析', count: GROWTH_FIELDS.length },
    { id: 'equity', label: '权益/综合', count: EQUITY_FIELDS.length },
    { id: 'annual', label: '年报原文', count: tenK.length },
  ]

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {tabDefs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs font-normal text-slate-400">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {activeTab === 'income' && (
          <>
            <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-600">
              📊 财报指标 · 利润表
            </div>
            <FinancialTable rows={rows} fields={INCOME_FIELDS} />
          </>
        )}
        {activeTab === 'balance' && (
          <>
            <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-600">
              📊 财报指标 · 资产负债表
            </div>
            <FinancialTable rows={rows} fields={BALANCE_FIELDS} />
          </>
        )}
        {activeTab === 'cashflow' && (
          <>
            <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-600">
              📊 财报指标 · 现金流量表
            </div>
            <FinancialTable rows={rows} fields={CASHFLOW_FIELDS} />
          </>
        )}
        {activeTab === 'per-share' && (
          <>
            <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-600">
              📊 财报指标 · 每股指标
            </div>
            <FinancialTable rows={rows} fields={PER_SHARE_FIELDS} />
          </>
        )}
        {activeTab === 'derived' && (
          <>
            <div className="px-3 py-1.5 bg-purple-50 border-b border-purple-100 text-xs font-semibold text-purple-600">
              🔢 派生分析 · Altman Z-Score / Piotroski F-Score / Beneish M-Score / EV倍数
            </div>
            {/* Scoring summary bar */}
            {rows.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100">
                {(() => {
                  const latest = rows[rows.length - 1]
                  return (
                    <>
                      {latest.altmanZScore != null && (
                        <ScoringBadge
                          label="Altman Z"
                          value={latest.altmanZScore}
                          zone={latest.altmanZScore > 2.99 ? 'safe' : latest.altmanZScore >= 1.81 ? 'grey' : 'distress'}
                        />
                      )}
                      {latest.piotroskiFScore != null && (
                        <ScoringBadge
                          label="Piotroski F"
                          value={latest.piotroskiFScore}
                          zone={latest.piotroskiFScore >= 7 ? 'strong' : latest.piotroskiFScore >= 4 ? 'neutral' : 'weak'}
                        />
                      )}
                      {latest.beneishMScore != null && (
                        <ScoringBadge
                          label="Beneish M"
                          value={latest.beneishMScore}
                          zone={latest.beneishMScore > -1.78 ? 'manipulation' : 'safe'}
                        />
                      )}
                      {latest.evEbitda != null && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          EV/EBITDA: {latest.evEbitda.toFixed(1)}x
                        </span>
                      )}
                      {latest.evFcf != null && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          EV/FCF: {latest.evFcf.toFixed(1)}x
                        </span>
                      )}
                      {latest.revenueCAGR3Y != null && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${ratioColor(latest.revenueCAGR3Y, 0.15, 0.05)} bg-emerald-50 border-emerald-200`}>
                          营收3Y CAGR: {(latest.revenueCAGR3Y * 100).toFixed(1)}%
                        </span>
                      )}
                      {latest.revenueCAGR5Y != null && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${ratioColor(latest.revenueCAGR5Y, 0.15, 0.05)} bg-emerald-50 border-emerald-200`}>
                          营收5Y CAGR: {(latest.revenueCAGR5Y * 100).toFixed(1)}%
                        </span>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
            <div className="divide-y divide-slate-100">
              <div className="px-3 pt-3 pb-1 text-xs font-semibold text-purple-600 uppercase tracking-wide bg-purple-50/50">
                🔢 派生分析 · 盈利能力
              </div>
              <DerivedSection title="盈利能力" fields={MARGIN_FIELDS} rows={rows} />
              <div className="px-3 pt-3 pb-1 text-xs font-semibold text-purple-600 uppercase tracking-wide bg-purple-50/50">
                🔢 派生分析 · 财务杠杆
              </div>
              <DerivedSection title="财务杠杆" fields={LEVERAGE_FIELDS} rows={rows} />
              <div className="px-3 pt-3 pb-1 text-xs font-semibold text-purple-600 uppercase tracking-wide bg-purple-50/50">
                🔢 派生分析 · 流动性
              </div>
              <DerivedSection title="流动性" fields={LIQUIDITY_FIELDS} rows={rows} />
              <div className="px-3 pt-3 pb-1 text-xs font-semibold text-purple-600 uppercase tracking-wide bg-purple-50/50">
                🔢 派生分析 · 经营效率
              </div>
              <DerivedSection title="经营效率" fields={EFFICIENCY_FIELDS} rows={rows} />
              <div className="px-3 pt-3 pb-1 text-xs font-semibold text-purple-600 uppercase tracking-wide bg-purple-50/50">
                🔢 派生分析 · 估值指标
              </div>
              <DerivedSection title="估值指标" fields={VALUATION_FIELDS} rows={rows} />
            </div>
          </>
        )}
        {activeTab === 'growth' && (
          <>
            <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-600">
              📊 财报指标 · 增长分析
            </div>
            <FinancialTable rows={rows} fields={GROWTH_FIELDS} />
          </>
        )}
        {activeTab === 'equity' && (
          <>
            <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-600">
              📊 财报指标 · 权益/综合
            </div>
            <FinancialTable rows={rows} fields={EQUITY_FIELDS} />
          </>
        )}
        {activeTab === 'annual' && (
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">年报 / 季报原文 (SEC EDGAR)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  共 {tenK.length} 份报告
                </p>
              </div>
            </div>

            {/* Key metrics highlight */}
            {rows.length > 0 && (() => {
              const latest = rows[rows.length - 1]
              const hasData = latest.revenue || latest.grossMarginPct || latest.roic || latest.debtToEquity
              if (!hasData) return null
              return (
                <div className="flex flex-wrap gap-3 text-xs">
                  {latest.revenue != null && (
                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-600">
                      营收: {formatCurrency(latest.revenue)}
                    </span>
                  )}
                  {latest.grossMarginPct != null && (
                    <span className={`px-2 py-1 rounded ${pctColor(latest.grossMarginPct, 50, 30)} bg-slate-100`}>
                      毛利率: {formatPctAbs(latest.grossMarginPct)}
                    </span>
                  )}
                  {latest.roic != null && (
                    <span className={`px-2 py-1 rounded ${pctColor(latest.roic, 15, 8)} bg-slate-100`}>
                      ROIC: {formatPctAbs(latest.roic)}
                    </span>
                  )}
                  {latest.debtToEquity != null && (
                    <span className={`px-2 py-1 rounded ${ratioColor(latest.debtToEquity, 0.5, 1.5)} bg-slate-100`}>
                      D/E: {latest.debtToEquity.toFixed(2)}x
                    </span>
                  )}
                  {latest.currentRatio != null && (
                    <span className={`px-2 py-1 rounded ${ratioColor(latest.currentRatio, 2, 1)} bg-slate-100`}>
                      流动比率: {latest.currentRatio.toFixed(2)}x
                    </span>
                  )}
                  {latest.operatingMarginPct != null && (
                    <span className={`px-2 py-1 rounded ${pctColor(latest.operatingMarginPct, 20, 10)} bg-slate-100`}>
                      营业利润率: {formatPctAbs(latest.operatingMarginPct)}
                    </span>
                  )}
                  {latest.freeCashFlow != null && (
                    <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">
                      FCF: {formatCurrency(latest.freeCashFlow)}
                    </span>
                  )}
                </div>
              )
            })()}

            {tenK.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 space-y-1">
                <p>暂无年报/季报原文数据。</p>
                <p>运行 <code className="font-mono bg-slate-100 px-1 rounded">node dist/index.js fetch {ticker} --history 1 --force-refresh</code> 抓取 10-K 和 10-Q 文件。</p>
              </div>
            ) : (
              <>
                {/* Filter bar */}
                <div className="flex gap-2">
                  {(['all', '10-K', '10-Q'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setReportFilter(f)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        reportFilter === f
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {f === 'all' ? '全部报告' : f === '10-K' ? '年报 (10-K)' : '季报 (10-Q)'}
                    </button>
                  ))}
                </div>

                {/* Reports list */}
                <div className="space-y-4">
                  {tenK
                    .filter(r => reportFilter === 'all' || r.filingType === reportFilter)
                    .map((report, idx) => (
                      <ReportCard key={`${report.year}-${report.filingType}-${idx}`} report={report} ticker={ticker} />
                    ))}
                  {tenK.filter(r => reportFilter === 'all' || r.filingType === reportFilter).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">
                      没有{reportFilter === '10-K' ? '年报' : '季报'}数据
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Period indicator */}
      {rows.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          {ticker} · {rows.filter(r => r.quarter > 0).length} 个季度 + {rows.filter(r => r.quarter === 0).length} 个年度 · {rows[0]?.year ?? '—'}–{rows[rows.length - 1]?.year ?? '—'} · 数据来源: SEC EDGAR XBRL
        </p>
      )}
    </div>
  )
}
