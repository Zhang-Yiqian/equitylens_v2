import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getLatestAnalysisForTicker, getFinancialHistory } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { TickerDetailTabs } from '@/components/TickerDetailTabs'
import { verdictLabel, verdictColor, formatCurrency, formatPctAbs, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { symbol: string }
}

export function generateMetadata({ params }: Props) {
  return {
    title: `${params.symbol.toUpperCase()} — EquityLens v2`,
  }
}

export default function TickerPage({ params }: Props) {
  const ticker = params.symbol.toUpperCase()
  const analysis = getLatestAnalysisForTicker(ticker)
  const financialHistory = getFinancialHistory(ticker)

  if (!analysis && financialHistory.length === 0) {
    notFound()
  }

  const isCrossValidation = analysis?.promptVersion?.includes('cross-validation')
  const verdictBadgeVariant = analysis
    ? ((['buy', 'conviction buy'].includes(analysis.verdict.toLowerCase()) ? 'buy'
      : analysis.verdict.toLowerCase() === 'watch' ? 'watch'
        : analysis.verdict.toLowerCase() === 'avoid' ? 'avoid'
          : 'neutral') as 'buy' | 'watch' | 'avoid' | 'neutral')
    : null

  const latest = financialHistory[financialHistory.length - 1]

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          返回看板
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            {/* Ticker + Rating */}
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-mono font-bold text-slate-900 tracking-tight">
                {ticker}
              </h1>
              {analysis && verdictBadgeVariant && (
                <Badge variant={verdictBadgeVariant} className="text-sm px-2.5 py-1">
                  {verdictLabel(analysis.verdict)}
                </Badge>
              )}
              {!analysis && (
                <span className="text-xs text-slate-400 bg-slate-100 border border-slate-200 rounded px-2 py-1">
                  未分析
                </span>
              )}
            </div>

            {/* Period & model info */}
            {analysis && (
              <p className="text-sm text-slate-500">
                FY{analysis.year} Q{analysis.quarter}
                <span className="mx-2 text-slate-200">·</span>
                <span className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5">
                  {analysis.promptVersion}
                </span>
                <span className="mx-2 text-slate-200">·</span>
                {analysis.modelId}
              </p>
            )}
          </div>

          {/* Key financial metrics */}
          {latest && (
            <div className="flex flex-wrap gap-4 sm:text-right">
              <div>
                <p className="text-xs text-slate-400">市值</p>
                <p className="num font-semibold text-slate-800">{formatCurrency(latest.revenue ? undefined : undefined)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">营收</p>
                <p className="num font-semibold text-slate-800">{formatCurrency(latest.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">毛利率</p>
                <p className="num font-semibold text-slate-800">{formatPctAbs(latest.grossMarginPct)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">FCF</p>
                <p className="num font-semibold text-slate-800">{formatCurrency(latest.freeCashFlow)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Token usage & updated-at */}
        {analysis && (
          <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span>最新分析: {formatDate(analysis.analyzedAt)}</span>
            {analysis.totalTokens && (
              <span>Token 用量: {analysis.totalTokens.toLocaleString()}</span>
            )}
            {isCrossValidation ? (
              <span className="text-primary/70">三位一体交叉验证 · 8维度</span>
            ) : (
              <span className="text-slate-400/70">12维度拐点分析 (legacy)</span>
            )}
          </div>
        )}
      </div>

      {/* Tabs: report / dimensions / financials */}
      {analysis ? (
        <TickerDetailTabs analysis={analysis} financialHistory={financialHistory} />
      ) : (
        /* No analysis yet, just show financial charts */
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
            该标的尚未运行分析。运行：
            <code className="font-mono bg-amber-100 rounded px-1 mx-1">
              node apps/cli/dist/index.js analyze {ticker}
            </code>
          </div>
          <div className="text-center text-sm text-slate-500 py-8">
            财务数据历史：{financialHistory.length} 条季度记录
          </div>
        </div>
      )}
    </div>
  )
}
