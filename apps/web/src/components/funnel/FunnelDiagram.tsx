'use client'

import { formatCurrency } from '@/lib/utils'

interface FunnelStats {
  totalNasdaq: number
  afterBlacklist: number
  l2Matches: number
  l3Classified: number
  aiCore: number
  aiAdjacent: number
  nonCore: number
  unknown: number
  l3ApiFailed: number
}

interface FunnelDiagramProps {
  funnelStats: FunnelStats
}

const STAGES = [
  { key: 'totalNasdaq', label: 'L1a 原始下载', color: 'bg-blue-200', textColor: 'text-blue-800', bar: 'bg-blue-100' },
  { key: 'afterBlacklist', label: 'L1b 黑名单过滤', color: 'bg-blue-300', textColor: 'text-blue-800', bar: 'bg-blue-100' },
  { key: 'l2Matches', label: 'L2 关键词匹配', color: 'bg-blue-400', textColor: 'text-blue-50', bar: 'bg-blue-100' },
  { key: 'l3Classified', label: 'L3 AI 分类', color: 'bg-blue-500', textColor: 'text-blue-50', bar: 'bg-blue-100' },
]

const FINAL_STAGES = [
  { key: 'aiCore', label: 'AI 核心', color: 'bg-emerald-500', textColor: 'text-emerald-50' },
  { key: 'aiAdjacent', label: 'AI 关联', color: 'bg-amber-500', textColor: 'text-amber-50' },
  { key: 'nonCore', label: '非核心', color: 'bg-slate-500', textColor: 'text-slate-50' },
  { key: 'unknown', label: '未知', color: 'bg-slate-400', textColor: 'text-slate-50' },
  { key: 'l3ApiFailed', label: 'API 失败', color: 'bg-red-500', textColor: 'text-red-50' },
]

export function FunnelDiagram({ funnelStats }: FunnelDiagramProps) {
  const total = funnelStats.totalNasdaq || 1

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">筛选漏斗</h2>

      {/* Stage bars */}
      <div className="space-y-2">
        {STAGES.map((stage) => {
          const value = funnelStats[stage.key as keyof FunnelStats] ?? 0
          const pct = Math.min((value / total) * 100, 100)
          const prevStage = STAGES[STAGES.indexOf(stage) - 1]
          const prevValue = prevStage ? funnelStats[prevStage.key as keyof FunnelStats] ?? 0 : total
          const passRate = prevValue > 0 ? ((value / prevValue) * 100).toFixed(1) : '—'
          return (
            <div key={stage.key} className="flex items-center gap-3">
              <div className="w-32 text-xs text-slate-600 text-right shrink-0">{stage.label}</div>
              <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                <div
                  className={`${stage.color} h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${pct}%`, minWidth: pct > 0 ? '2rem' : 0 }}
                >
                  {pct > 8 && (
                    <span className={`text-xs font-mono font-semibold ${stage.textColor}`}>
                      {value.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              {pct <= 8 && pct > 0 && (
                <span className="text-xs font-mono text-slate-500 w-12">{value.toLocaleString()}</span>
              )}
              <div className="w-14 text-xs text-slate-400 text-right shrink-0">
                {pct > 0 ? `${pct.toFixed(1)}%` : '—'}
              </div>
              {prevStage && (
                <div className="w-12 text-xs text-slate-400 text-right shrink-0">
                  通过 {passRate}%
                </div>
              )}
              {!prevStage && <div className="w-12 shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* Final pool breakdown */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">最终候选池</h3>
          <span className="text-xs text-slate-400">
            ({formatCurrency(funnelStats.l3Classified ?? 0, true)} companies)
          </span>
        </div>
        <div className="flex rounded-full overflow-hidden h-7">
          {FINAL_STAGES.map((stage, i) => {
            const value = funnelStats[stage.key as keyof FunnelStats] ?? 0
            const totalFinal = (funnelStats.l3Classified || 1)
            const pct = (value / totalFinal) * 100
            if (pct === 0) return null
            return (
              <div
                key={stage.key}
                className={`${stage.color} flex items-center justify-center px-2 text-xs font-semibold ${stage.textColor}`}
                style={{ width: `${pct}%`, minWidth: pct > 0 ? '2rem' : 0 }}
                title={`${stage.label}: ${value}`}
              >
                {pct > 5 && value > 0 ? (
                  <span className="truncate">{value}</span>
                ) : pct > 0 && value > 0 ? (
                  <span className="font-mono text-[10px]">{value}</span>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-2 flex-wrap">
          {FINAL_STAGES.map(stage => {
            const value = funnelStats[stage.key as keyof FunnelStats] ?? 0
            const totalFinal = (funnelStats.l3Classified || 1)
            const pct = totalFinal > 0 ? ((value / totalFinal) * 100).toFixed(1) : '0.0'
            return (
              <div key={stage.key} className="flex items-center gap-1.5 text-xs">
                <div className={`w-2.5 h-2.5 rounded-sm ${stage.color}`} />
                <span className="text-slate-600">{stage.label}</span>
                <span className="font-mono font-semibold text-slate-800">{value.toLocaleString()}</span>
                <span className="text-slate-400">({pct}%)</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
