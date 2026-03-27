'use client'

import { useState } from 'react'
import { formatCurrency, formatPctAbs, formatPct } from '@/lib/utils'

type Tab = 'income' | 'balance' | 'cashflow' | 'per-share' | 'growth' | 'derived' | 'equity'

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
                    return (
                      <td
                        key={i}
                        className={`px-3 py-1.5 text-right tabular-nums min-w-[5rem] ${
                          v == null ? 'text-slate-300' : 'text-slate-700'
                        }`}
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

// ── Component ──────────────────────────────────────────────────────────────────

interface TickerDetailTabsProps {
  ticker: string
  financialHistory: unknown[]
  analysis?: unknown
}

export function TickerDetailTabs({ ticker, financialHistory, analysis }: TickerDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('income')

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
          <FinancialTable rows={rows} fields={INCOME_FIELDS} />
        )}
        {activeTab === 'balance' && (
          <FinancialTable rows={rows} fields={BALANCE_FIELDS} />
        )}
        {activeTab === 'cashflow' && (
          <FinancialTable rows={rows} fields={CASHFLOW_FIELDS} />
        )}
        {activeTab === 'per-share' && (
          <FinancialTable rows={rows} fields={PER_SHARE_FIELDS} />
        )}
        {activeTab === 'derived' && (
          <div className="divide-y divide-slate-100">
            <DerivedSection title="盈利能力" fields={MARGIN_FIELDS} rows={rows} />
            <DerivedSection title="财务杠杆" fields={LEVERAGE_FIELDS} rows={rows} />
            <DerivedSection title="流动性" fields={LIQUIDITY_FIELDS} rows={rows} />
            <DerivedSection title="经营效率" fields={EFFICIENCY_FIELDS} rows={rows} />
            <DerivedSection title="估值指标" fields={VALUATION_FIELDS} rows={rows} />
          </div>
        )}
        {activeTab === 'growth' && (
          <FinancialTable rows={rows} fields={GROWTH_FIELDS} />
        )}
        {activeTab === 'equity' && (
          <FinancialTable rows={rows} fields={EQUITY_FIELDS} />
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
