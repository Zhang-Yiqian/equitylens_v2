import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, TrendingUp, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react'
import { getLatestAnalysisForTicker, getFullFinancialHistory, getAllTenKCacheData } from '@/lib/db'
import { Badge } from '@/components/ui/badge'

/**
 * Returns Tailwind color class for a financial metric value.
 */
function metricColor(
  value: number | null,
  type: 'pct' | 'ratio',
  thresholds: { green: number; amber: number; invert?: boolean },
): string {
  if (value == null) return 'text-slate-400'
  const { green, amber, invert } = thresholds
  if (invert) {
    if (value <= green) return 'text-emerald-600'
    if (value <= amber) return 'text-amber-600'
    return 'text-red-500'
  }
  if (type === 'pct') {
    if (value >= green) return 'text-emerald-600'
    if (value >= amber) return 'text-amber-600'
    return 'text-red-500'
  }
  // ratio
  if (value <= green) return 'text-emerald-600'
  if (value <= amber) return 'text-amber-600'
  return 'text-red-500'
}
import { TickerDetailTabs } from '@/components/TickerDetailTabs'
import { verdictLabel, formatCurrency, formatPctAbs, formatDate } from '@/lib/utils'

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
  const financialHistory = getFullFinancialHistory(ticker)
  const tenKCacheData = getAllTenKCacheData(ticker)

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

  // Parse JSON analysis fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dimensions: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let catalysts: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let risks: any[] = []
  try {
    if (analysis?.dimensionsJson) dimensions = JSON.parse(analysis.dimensionsJson)
    if (analysis?.catalystsJson) catalysts = JSON.parse(analysis.catalystsJson)
    if (analysis?.risksJson) risks = JSON.parse(analysis.risksJson)
  } catch { /* ignore parse errors */ }

  const secEdgarUrl = `https://data.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=10-K&dateb=&owner=include&count=10`

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

          {/* Key financial metrics — 10 metrics with color coding */}
          {latest && (
            <div className="flex flex-wrap gap-4 sm:text-right">
              <div>
                <p className="text-xs text-slate-400">市值</p>
                <p className="num font-semibold text-slate-800">{formatCurrency(latest.marketCap)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">营收</p>
                <p className="num font-semibold text-slate-800">{formatCurrency(latest.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">毛利率</p>
                <p className={`num font-semibold ${metricColor(latest.grossMarginPct, 'pct', { green: 50, amber: 30 })}`}>
                  {latest.grossMarginPct != null ? formatPctAbs(latest.grossMarginPct) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">FCF</p>
                <p className="num font-semibold text-slate-800">{formatCurrency(latest.freeCashFlow)}</p>
              </div>
              {latest.operatingMarginPct != null && (
                <div>
                  <p className="text-xs text-slate-400">营业利润率</p>
                  <p className={`num font-semibold ${metricColor(latest.operatingMarginPct, 'pct', { green: 20, amber: 10 })}`}>
                    {formatPctAbs(latest.operatingMarginPct)}
                  </p>
                </div>
              )}
              {latest.netMarginPct != null && (
                <div>
                  <p className="text-xs text-slate-400">净利润率</p>
                  <p className={`num font-semibold ${metricColor(latest.netMarginPct, 'pct', { green: 20, amber: 10 })}`}>
                    {formatPctAbs(latest.netMarginPct)}
                  </p>
                </div>
              )}
              {latest.debtToEquity != null && (
                <div>
                  <p className="text-xs text-slate-400">Debt/Equity</p>
                  <p className={`num font-semibold ${metricColor(latest.debtToEquity, 'ratio', { green: 0.5, amber: 1.5, invert: true })}`}>
                    {latest.debtToEquity.toFixed(2)}x
                  </p>
                </div>
              )}
              {latest.roic != null && (
                <div>
                  <p className="text-xs text-slate-400">ROIC</p>
                  <p className={`num font-semibold ${metricColor(latest.roic, 'pct', { green: 15, amber: 8 })}`}>
                    {formatPctAbs(latest.roic)}
                  </p>
                </div>
              )}
              {latest.currentRatio != null && (
                <div>
                  <p className="text-xs text-slate-400">流动比率</p>
                  <p className={`num font-semibold ${metricColor(latest.currentRatio, 'ratio', { green: 2, amber: 1 })}`}>
                    {latest.currentRatio.toFixed(2)}x
                  </p>
                </div>
              )}
              {latest.revenueGrowthYoY != null && (
                <div>
                  <p className="text-xs text-slate-400">营收 YoY</p>
                  <p className={`num font-semibold ${metricColor(latest.revenueGrowthYoY, 'pct', { green: 20, amber: 5, invert: true })}`}>
                    {formatPctAbs(latest.revenueGrowthYoY)}
                  </p>
                </div>
              )}
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

      {/* Analysis verdict + conclusion */}
      {analysis && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800">AI 分析结论</h2>
            </div>
            <a
              href={secEdgarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              SEC EDGAR
            </a>
          </div>
          <div className="p-4 space-y-4">
            {/* Verdict + confidence */}
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {verdictBadgeVariant === 'buy' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                {verdictBadgeVariant === 'watch' && <TrendingUp className="w-5 h-5 text-amber-500" />}
                {verdictBadgeVariant === 'avoid' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                {verdictBadgeVariant === 'neutral' && <BarChart3 className="w-5 h-5 text-slate-400" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {verdictLabel(analysis.verdict)}
                  {analysis.verdictConfidence != null && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      置信度 {analysis.verdictConfidence}%
                    </span>
                  )}
                </p>
                {analysis.conclusion && (
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">{analysis.conclusion}</p>
                )}
              </div>
            </div>

            {/* Thesis summary */}
            {analysis.thesisSummary && (
              <div className="bg-slate-50 rounded-lg px-3 py-2.5">
                <p className="text-xs font-medium text-slate-500 mb-1">核心论点</p>
                <p className="text-sm text-slate-700 leading-relaxed">{analysis.thesisSummary}</p>
              </div>
            )}

            {/* Landscape analysis */}
            {analysis.landscapeAnalysis && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">产业格局分析</p>
                <p className="text-sm text-slate-600 leading-relaxed">{analysis.landscapeAnalysis}</p>
              </div>
            )}

            {/* Risk warning */}
            {analysis.riskWarning && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                <p className="text-xs font-semibold text-red-600 mb-1">风险提示</p>
                <p className="text-sm text-red-700 leading-relaxed">{analysis.riskWarning}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis dimensions */}
      {analysis && dimensions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">多维度评估</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {dimensions.map((dim, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <span className="inline-block w-5 h-5 rounded bg-slate-100 text-xs font-semibold text-slate-500 text-center leading-5">
                    {(i + 1).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-slate-800">{dim.name ?? dim.label ?? dim.dimension ?? `维度 ${i + 1}`}</span>
                    {dim.score != null && (
                      <span className={`text-xs font-semibold ${dim.score >= 70 ? 'text-emerald-600' : dim.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {dim.score}/100
                      </span>
                    )}
                  </div>
                  {dim.evidence && (
                    <p className="text-xs text-slate-500 leading-relaxed">{dim.evidence}</p>
                  )}
                  {dim.reasoning && (
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{dim.reasoning}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalysts + Risks side-by-side */}
      {analysis && (catalysts.length > 0 || risks.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Catalysts */}
          {catalysts.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-semibold text-slate-800">看涨催化剂</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {catalysts.map((cat, i) => (
                  <div key={i} className="px-4 py-2.5">
                    {cat.event && <p className="text-xs font-medium text-emerald-700">{cat.event}</p>}
                    <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{cat.description ?? cat.reason ?? cat.detail ?? JSON.stringify(cat)}</p>
                    {cat.probability != null && (
                      <p className="text-[10px] text-slate-400 mt-0.5">概率: {cat.probability}%</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {risks.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-semibold text-slate-800">风险因素</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {risks.map((rsk, i) => (
                  <div key={i} className="px-4 py-2.5">
                    {rsk.event && <p className="text-xs font-medium text-red-700">{rsk.event}</p>}
                    <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{rsk.description ?? rsk.reason ?? rsk.detail ?? JSON.stringify(rsk)}</p>
                    {rsk.severity && (
                      <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        rsk.severity === 'high' || rsk.severity === 'critical' ? 'bg-red-100 text-red-600' :
                        rsk.severity === 'medium' ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {rsk.severity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabbed financial data (always show, even before analysis) */}
      <TickerDetailTabs ticker={ticker} financialHistory={financialHistory} analysis={analysis} tenKCacheData={tenKCacheData} />

      {/* SEC data source note */}
      {financialHistory.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>数据来源: SEC EDGAR XBRL · Yahoo Finance 补充 · SEC 优先原则</span>
          <a
            href={secEdgarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            查看 SEC EDGAR 10-K/10-Q 原始文件
          </a>
        </div>
      )}

      {/* No analysis prompt */}
      {!analysis && financialHistory.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          该标的尚无财务数据。运行：
          <code className="font-mono bg-amber-100 rounded px-1 mx-1">
            node apps/cli/dist/index.js fetch {ticker}
          </code>
          抓取数据
        </div>
      )}
      {!analysis && financialHistory.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          该标的尚未运行分析。运行：
          <code className="font-mono bg-amber-100 rounded px-1 mx-1">
            node apps/cli/dist/index.js analyze {ticker}
          </code>
        </div>
      )}
    </div>
  )
}
