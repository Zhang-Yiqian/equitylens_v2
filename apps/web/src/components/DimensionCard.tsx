import { Badge } from '@/components/ui/badge'
import { signalLabel, cn } from '@/lib/utils'

interface DimensionData {
  id: string
  name: string
  category: string
  signal: string
  confidence: number
  summary: string
  evidence: Array<{ quote: string; source: string; context?: string }>
}

const CATEGORY_NAMES: Record<string, string> = {
  A: '10-K 竞争格局基线',
  B: '财务异动侦测',
  C: '新闻事件验证',
  D: '情绪与博弈',
}

const SOURCE_LABELS: Record<string, string> = {
  '10k': '10-K年报',
  financial: '财务数据',
  news: '新闻',
  transcript: '财报电话',
}

function SignalBar({ confidence, signal }: { confidence: number; signal: string }) {
  const barColor = signal === 'bullish'
    ? 'bg-emerald-500'
    : signal === 'bearish'
      ? 'bg-red-500'
      : signal === 'skipped'
        ? 'bg-slate-200'
        : 'bg-slate-400'

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${confidence}%` }}
          aria-label={`置信度 ${confidence}%`}
        />
      </div>
      <span className="text-xs text-slate-400 num w-8 text-right">{confidence}</span>
    </div>
  )
}

function signalVariant(signal: string): 'bullish' | 'bearish' | 'neutral' | 'skipped' {
  const s = signal.toLowerCase()
  if (s === 'bullish') return 'bullish'
  if (s === 'bearish') return 'bearish'
  if (s === 'skipped') return 'skipped'
  return 'neutral'
}

interface DimensionGroupProps {
  category: string
  dimensions: DimensionData[]
}

export function DimensionGroup({ category, dimensions }: DimensionGroupProps) {
  if (dimensions.length === 0) return null

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        [{category}] {CATEGORY_NAMES[category] ?? category}
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {dimensions.map(dim => (
          <DimensionCard key={dim.id} dim={dim} />
        ))}
      </div>
    </div>
  )
}

function DimensionCard({ dim }: { dim: DimensionData }) {
  const isSkipped = dim.signal === 'skipped'

  return (
    <div
      className={cn(
        'border rounded-lg p-3.5 text-sm',
        isSkipped
          ? 'border-slate-100 bg-slate-50/50'
          : dim.signal === 'bullish'
            ? 'border-emerald-100 bg-emerald-50/30'
            : dim.signal === 'bearish'
              ? 'border-red-100 bg-red-50/30'
              : 'border-slate-200 bg-white',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-slate-400 mb-0.5">{dim.id}</p>
          <p className="font-medium text-slate-800 text-sm leading-tight">{dim.name}</p>
        </div>
        <Badge variant={signalVariant(dim.signal)} className="shrink-0 mt-0.5">
          {signalLabel(dim.signal)}
        </Badge>
      </div>

      {/* Confidence bar */}
      {!isSkipped && <SignalBar confidence={dim.confidence} signal={dim.signal} />}

      {/* Summary */}
      <p className={cn('text-xs leading-relaxed mt-2.5', isSkipped ? 'text-slate-400' : 'text-slate-600')}>
        {dim.summary}
      </p>

      {/* Evidence */}
      {dim.evidence.length > 0 && (
        <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5">
          {dim.evidence.slice(0, 2).map((ev, i) => (
            <div key={i} className="text-xs">
              <blockquote className="border-l-2 border-slate-200 pl-2 text-slate-500 italic leading-relaxed line-clamp-2">
                "{ev.quote}"
              </blockquote>
              <p className="text-slate-400 mt-0.5 pl-2">
                {SOURCE_LABELS[ev.source] ?? ev.source}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
