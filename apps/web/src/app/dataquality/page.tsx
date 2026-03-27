import { getDataQualityMatrix } from '@/lib/db'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '数据质量热力图 — EquityLens v2',
}

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
  epsDiluted: 'EPS摊薄',
  depreciationAndAmortization: 'D&A',
  sbcExpense: 'SBC股权激励',
  capitalExpenditure: '资本支出',
  freeCashFlow: '自由现金流',
  operatingCashFlow: '经营活动CF',
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
}

const DISPLAY_FIELDS = [
  'revenue', 'costOfRevenue', 'grossMargin', 'operatingIncome',
  'interestExpense', 'interestIncome', 'pretaxIncome', 'incomeTaxExpense',
  'netIncome', 'epsDiluted', 'depreciationAndAmortization', 'sbcExpense',
  'capitalExpenditure', 'freeCashFlow', 'operatingCashFlow', 'totalDebt',
  'totalCash', 'totalStockholdersEquity', 'goodwill', 'totalAssets',
  'totalLiabilities', 'totalCurrentAssets', 'totalCurrentLiabilities',
  'accountsReceivable', 'inventory', 'deferredRevenue', 'operatingExpenses',
  'sgaExpense', 'rdExpense', 'dividendsPaid', 'shareRepurchases',
]

function coverageColor(pct: number): { bg: string; text: string; label: string } {
  if (pct >= 80) return { bg: 'bg-emerald-50', text: 'text-emerald-600', label: '🟩' }
  if (pct >= 60) return { bg: 'bg-amber-50', text: 'text-amber-600', label: '🟨' }
  if (pct >= 40) return { bg: 'bg-orange-50', text: 'text-orange-600', label: '🟧' }
  return { bg: 'bg-red-50', text: 'text-red-600', label: '🟥' }
}

function covCellColor(present: boolean): string {
  return present ? 'bg-emerald-100 border-emerald-300' : 'bg-slate-50 border-slate-200'
}

function covCellChar(present: boolean): string {
  return present ? '✓' : '—'
}

function covCellTextColor(present: boolean): string {
  return present ? 'text-emerald-600' : 'text-slate-300'
}

export default function DataQualityPage() {
  const matrix = getDataQualityMatrix()

  const totalPeriods = matrix.reduce((s, r) => s + r.periodsCount, 0)
  const avgCoverage = Math.round(matrix.reduce((s, r) => s + r.coveragePct, 0) / Math.max(matrix.length, 1))
  const uniqueTickers = matrix.length
  const coverageByField: Record<string, number> = {}
  for (const f of DISPLAY_FIELDS) {
    coverageByField[f] = matrix.filter(r => r.fieldCoverage[f] === 'present').length
  }

  const bestCov = Math.max(...matrix.map(r => r.coveragePct))
  const bestTicker = matrix.find(r => r.coveragePct === bestCov)?.ticker ?? ''
  const hardCov = matrix.reduce((s, r) => s + r.hardTruthCoverage, 0)

  const overallCov = coverageColor(avgCoverage)
  const bestCovColor = coverageColor(bestCov)

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回看板
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            数据质量热力图
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {uniqueTickers} 个标的 · {totalPeriods} 个季度记录 · 平均 {avgCoverage}% P0 覆盖率
          </p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <div className="text-xs text-slate-400">SEC EDGAR XBRL + Yahoo Finance</div>
          <div className="text-xs text-slate-400">字段来源逐字段追踪 (fieldSources)</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Hard Truth 覆盖"
          value={`${hardCov}/${uniqueTickers * 5}`}
          sub="5 核心字段全部标的"
        />
        <StatCard
          label="P0 平均覆盖率"
          value={`${avgCoverage}%`}
          sub="30 个 P0 原始字段"
          highlight
        />
        <StatCard
          label="总季度记录"
          value={String(totalPeriods)}
          sub="所有标的合计"
        />
        <StatCard
          label="最高覆盖率"
          value={`${bestCov}%`}
          sub={bestTicker || '—'}
          highlight
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>🟩 ≥80% 完整</span>
        <span>🟨 60–79% 良好</span>
        <span>🟧 40–59% 部分</span>
        <span>🟥 &lt;40% 缺失多</span>
        <span className="ml-auto text-slate-400">点击标的名称 → 公司详情
        </span>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5 text-left font-semibold text-slate-700 whitespace-nowrap border-r border-slate-200">
                标的
              </th>
              <th className="px-2 py-2.5 text-center font-semibold text-slate-700 whitespace-nowrap border-r border-slate-200">
                期间
              </th>
              <th className="px-2 py-2.5 text-center font-semibold text-slate-700 whitespace-nowrap border-r border-slate-200">
                记录数
              </th>
              <th className="px-2 py-2.5 text-center font-semibold text-slate-700 whitespace-nowrap border-r border-slate-200">
                P0 覆盖
              </th>
              <th className="px-2 py-2.5 text-center font-semibold text-slate-700 whitespace-nowrap border-r border-slate-200">
                来源数
              </th>
              {DISPLAY_FIELDS.map(f => (
                <th
                  key={f}
                  className="px-1 py-2.5 text-center font-medium text-slate-600 min-w-[2rem] border-r border-slate-100 last:border-r-0"
                  title={FIELD_LABELS[f] ?? f}
                >
                  <span className="block" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {FIELD_LABELS[f] ?? f}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(row => {
              const cov = coverageColor(row.coveragePct)
              return (
                <tr key={row.ticker} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-mono font-semibold text-slate-900 whitespace-nowrap border-r border-slate-200">
                    <Link href={`/ticker/${row.ticker}`} className="hover:text-primary transition-colors">
                      {row.ticker}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center text-slate-500 whitespace-nowrap border-r border-slate-200">
                    {row.year > 0 ? `FY${row.year} Q${row.quarter}` : '—'}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-500 whitespace-nowrap border-r border-slate-200">
                    {row.periodsCount}
                  </td>
                  <td className={`px-2 py-2 text-center font-bold whitespace-nowrap border-r border-slate-200 ${cov.text} ${cov.bg}`}>
                    {row.coveragePct}%
                  </td>
                  <td className="px-2 py-2 text-center text-slate-400 whitespace-nowrap border-r border-slate-200">
                    {row.fieldSourcesCount}
                  </td>
                  {DISPLAY_FIELDS.map(f => {
                    const present = row.fieldCoverage[f] === 'present'
                    return (
                      <td
                        key={f}
                        className={`px-0.5 py-0.5 text-center border-r border-slate-100 last:border-r-0 ${covCellColor(present)}`}
                        title={`${FIELD_LABELS[f] ?? f}: ${present ? '有数据' : '缺失'}`}
                      >
                        <span className={covCellTextColor(present)}>{covCellChar(present)}</span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          {/* Footer: field-level aggregate */}
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-300">
              <td colSpan={5} className="px-3 py-2 font-semibold text-slate-700 text-center">
                字段覆盖率
              </td>
              {DISPLAY_FIELDS.map(f => {
                const cnt = coverageByField[f] ?? 0
                const pct = Math.round(cnt / Math.max(uniqueTickers, 1) * 100)
                const c = coverageColor(pct)
                return (
                  <td
                    key={f}
                    className={`px-0.5 py-1 text-center text-[10px] font-semibold border-r border-slate-200 last:border-r-0 ${c.text} ${c.bg}`}
                    title={`${FIELD_LABELS[f] ?? f}: ${cnt}/${uniqueTickers} 个标的`}
                  >
                    {c.label}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Per-field detail table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">字段级别覆盖详情</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {DISPLAY_FIELDS.length} 个 P0 原始字段在 {uniqueTickers} 个标的中的覆盖情况
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2 text-left font-semibold text-slate-700">字段名</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700">中文</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700">覆盖</th>
                <th className="px-4 py-2 text-center font-semibold text-slate-700">覆盖率</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">进度条</th>
              </tr>
            </thead>
            <tbody>
              {DISPLAY_FIELDS.map(f => {
                const cnt = coverageByField[f] ?? 0
                const pct = Math.round(cnt / Math.max(uniqueTickers, 1) * 100)
                const c = coverageColor(pct)
                const barWidth = `${Math.max(pct, 1)}%`
                return (
                  <tr key={f} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2 font-mono text-slate-700">{f}</td>
                    <td className="px-4 py-2 text-center text-slate-500">{FIELD_LABELS[f] ?? '—'}</td>
                    <td className="px-4 py-2 text-center font-bold text-slate-700">{cnt}/{uniqueTickers}</td>
                    <td className={`px-4 py-2 text-center font-bold ${c.text}`}>{pct}%</td>
                    <td className="px-4 py-2">
                      <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : pct >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                          style={{ width: barWidth }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source tracking info */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <strong>字段来源说明：</strong>
        每个快照的 <code className="font-mono bg-white px-1 rounded">fieldSources</code> JSON 对象记录每个字段的原始来源：
        <code className="ml-1 font-mono bg-white px-1 rounded">sec</code> = SEC EDGAR XBRL 优先，
        <code className="font-mono bg-white px-1 rounded">yahoo</code> = Yahoo Finance 补充，
        <code className="font-mono bg-white px-1 rounded">computed</code> = 计算得出。
        SEC 优先原则：同一字段两个来源都有值时，取 SEC 数据。
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  const cardClass = highlight ? 'rounded-xl border border-primary/20 bg-primary/5' : 'rounded-xl border border-slate-200 bg-white'
  const valueClass = highlight ? 'text-2xl font-semibold tabular-nums mt-1 text-primary' : 'text-2xl font-semibold tabular-nums mt-1 text-slate-900'
  return (
    <div className={cardClass}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={valueClass}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}
