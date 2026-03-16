import { getWatchlistData } from '@/lib/db'
import { WatchlistTable } from '@/components/WatchlistTable'
import { formatCurrency } from '@/lib/utils'

// Re-render on every request (data may change when CLI runs)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function HomePage() {
  const data = getWatchlistData()

  // Summary stats
  const withAnalysis = data.filter(d => d.verdict)
  const buyCount = withAnalysis.filter(d => ['buy', 'conviction buy'].includes(d.verdict?.toLowerCase() ?? '')).length
  const watchCount = withAnalysis.filter(d => d.verdict?.toLowerCase() === 'watch').length
  const avoidCount = withAnalysis.filter(d => d.verdict?.toLowerCase() === 'avoid').length
  const totalMarketCap = data.reduce((sum, d) => sum + (d.marketCap ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">自选股看板</h1>
        <p className="mt-1 text-sm text-slate-500">
          AI产业链 · {data.length} 个标的 · 三位一体交叉验证
        </p>
      </div>

      {/* Stats cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="总市值" value={formatCurrency(totalMarketCap)} note="所有标的合计" />
        <StatCard
          label="买入"
          value={String(buyCount)}
          valueClass="text-emerald-600"
          note={`共 ${withAnalysis.length} 个已分析`}
        />
        <StatCard
          label="观察"
          value={String(watchCount)}
          valueClass="text-amber-600"
          note="持续跟踪"
        />
        <StatCard
          label="回避"
          value={String(avoidCount)}
          valueClass="text-red-600"
          note="当前不宜持有"
        />
      </div>

      {/* Main table */}
      <WatchlistTable data={data} />

      {/* Hint */}
      <p className="text-xs text-slate-400 text-center">
        点击标的名称查看深度分析报告 · 数据来源：SEC EDGAR + Yahoo Finance + 10-K年报
      </p>
    </div>
  )
}

function StatCard({
  label,
  value,
  note,
  valueClass = 'text-slate-900',
}: {
  label: string
  value: string
  note?: string
  valueClass?: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold font-mono tabular-nums ${valueClass}`}>{value}</p>
      {note && <p className="text-xs text-slate-400 mt-0.5">{note}</p>}
    </div>
  )
}
