'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronUp, ChevronDown, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPctAbs, verdictLabel, formatDate } from '@/lib/utils'
import type { WatchlistEntry } from '@/lib/db'

type SortKey = 'ticker' | 'verdict' | 'marketCap' | 'revenueGrowthYoY' | 'grossMarginPct' | 'analyzedAt'

interface WatchlistTableProps {
  data: WatchlistEntry[]
}

export function WatchlistTable({ data }: WatchlistTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = [...data].sort((a, b) => {
    let va: string | number | null = a[sortKey] ?? null
    let vb: string | number | null = b[sortKey] ?? null

    if (typeof va === 'string' && typeof vb === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    }

    const na = va as number | null
    const nb = vb as number | null
    if (na == null && nb == null) return 0
    if (na == null) return 1
    if (nb == null) return -1
    return sortDir === 'asc' ? na - nb : nb - na
  })

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <Minus className="w-3 h-3 text-slate-300 ml-1 inline" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-primary ml-1 inline" />
      : <ChevronDown className="w-3 h-3 text-primary ml-1 inline" />
  }

  function verdictBadgeVariant(verdict: string | null): 'buy' | 'watch' | 'avoid' | 'neutral' {
    if (!verdict) return 'neutral'
    const v = verdict.toLowerCase()
    if (v === 'buy' || v === 'conviction buy') return 'buy'
    if (v === 'watch') return 'watch'
    if (v === 'avoid') return 'avoid'
    return 'neutral'
  }

  const ThButton = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => handleSort(k)}
      className="flex items-center text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-slate-900 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
      aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <SortIcon k={k} />
    </button>
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm" aria-label="自选股看板">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <th className="text-left px-4 py-3 w-20">
              <ThButton label="标的" k="ticker" />
            </th>
            <th className="text-left px-4 py-3">
              <ThButton label="评级" k="verdict" />
            </th>
            <th className="text-right px-4 py-3">
              <ThButton label="市值" k="marketCap" />
            </th>
            <th className="text-right px-4 py-3">
              <ThButton label="营收YoY" k="revenueGrowthYoY" />
            </th>
            <th className="text-right px-4 py-3">
              <ThButton label="毛利率" k="grossMarginPct" />
            </th>
            <th className="text-left px-4 py-3 hidden md:table-cell">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">综合结论</span>
            </th>
            <th className="text-right px-4 py-3 hidden sm:table-cell">
              <ThButton label="更新时间" k="analyzedAt" />
            </th>
            <th className="px-4 py-3 w-8" aria-label="详情链接"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.map(entry => {
            const hasAnalysis = !!entry.verdict
            const growthPositive = (entry.revenueGrowthYoY ?? 0) >= 0

            return (
              <tr
                key={entry.ticker}
                className="hover:bg-slate-50/80 transition-colors group"
              >
                {/* Ticker */}
                <td className="px-4 py-3.5">
                  <Link
                    href={`/ticker/${entry.ticker}`}
                    className="font-mono font-semibold text-slate-900 hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline"
                    aria-label={`查看 ${entry.ticker} 详情`}
                  >
                    {entry.ticker}
                  </Link>
                  {entry.year && entry.quarter ? (
                    <p className="text-xs text-slate-400 num mt-0.5">
                      FY{entry.year} Q{entry.quarter}
                    </p>
                  ) : null}
                </td>

                {/* Verdict */}
                <td className="px-4 py-3.5">
                  {hasAnalysis ? (
                    <Badge variant={verdictBadgeVariant(entry.verdict)}>
                      {verdictLabel(entry.verdict!)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-300">未分析</span>
                  )}
                </td>

                {/* Market Cap */}
                <td className="px-4 py-3.5 text-right">
                  <span className="num text-slate-700">
                    {formatCurrency(entry.marketCap)}
                  </span>
                </td>

                {/* Revenue YoY */}
                <td className="px-4 py-3.5 text-right">
                  {entry.revenueGrowthYoY != null ? (
                    <span className={`num font-medium ${growthPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {growthPositive ? '+' : ''}{entry.revenueGrowthYoY.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>

                {/* Gross Margin */}
                <td className="px-4 py-3.5 text-right">
                  <span className="num text-slate-700">
                    {formatPctAbs(entry.grossMarginPct)}
                  </span>
                </td>

                {/* Conclusion snippet */}
                <td className="px-4 py-3.5 max-w-xs hidden md:table-cell">
                  {entry.conclusion ? (
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {entry.conclusion}
                    </p>
                  ) : (
                    <span className="text-xs text-slate-300">暂无分析</span>
                  )}
                </td>

                {/* Analyzed at */}
                <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                  <span className="text-xs text-slate-400">
                    {formatDate(entry.analyzedAt)}
                  </span>
                </td>

                {/* Arrow */}
                <td className="px-4 py-3.5 text-right">
                  <Link
                    href={`/ticker/${entry.ticker}`}
                    className="text-slate-300 group-hover:text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                    aria-label={`查看 ${entry.ticker} 完整报告`}
                    tabIndex={-1}
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {data.length === 0 && (
        <div className="py-16 text-center text-slate-400 text-sm">
          <p className="mb-2">暂无数据</p>
          <p className="text-xs">运行 <code className="font-mono bg-slate-100 px-1 rounded">pnpm analyze NVDA</code> 开始分析</p>
        </div>
      )}
    </div>
  )
}
