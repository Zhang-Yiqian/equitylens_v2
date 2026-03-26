'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react'
import { FunnelCompanyRow } from './FunnelCompanyRow'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

interface BucketEntry {
  ticker: string
  companyName: string
  aiStatus: string | null
  supplyChainTag: string | null
  l3Confidence: number | null
  l3Reasoning: string | null
  l3Evidence: string | null
  l2MatchedKeywords: string[]
  l2MatchedCategories: string[]
  l3ApiFailed?: boolean
  failReasons: string[]
  passReasons: string[]
}

interface SubGroup {
  core: BucketEntry[]
  adjacent: BucketEntry[]
  non_core: BucketEntry[]
  unknown: BucketEntry[]
}

interface Bucket {
  bucket: number
  label: string
  labelEn: string
  description: string
  color: string
  entries: BucketEntry[]
  subGroups?: SubGroup
}

interface AiStatusFilter {
  core?: boolean
  adjacent?: boolean
  non_core?: boolean
  unknown?: boolean
}

const BUCKET_COLORS: Record<string, { bg: string; border: string; badge: string; text: string; icon: string }> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700', icon: 'bg-emerald-500' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-700', icon: 'bg-orange-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700', icon: 'bg-amber-500' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', text: 'text-blue-700', icon: 'bg-blue-500' },
  slate: { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600', text: 'text-slate-600', icon: 'bg-slate-400' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600', text: 'text-gray-600', icon: 'bg-gray-400' },
  red: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', text: 'text-red-700', icon: 'bg-red-500' },
}

const AI_STATUS_LABELS: Record<string, string> = {
  core: 'AI 核心',
  adjacent: 'AI 关联',
  non_core: '非核心',
  unknown: '未知',
  api_failed: 'API 失败',
}

interface FunnelStageSectionProps {
  bucket: Bucket
  isExpanded: boolean
  onToggle: () => void
  filteredEntries: BucketEntry[]
  aiStatusFilter?: AiStatusFilter | string
}

export function FunnelStageSection({
  bucket,
  isExpanded,
  onToggle,
  filteredEntries,
  aiStatusFilter,
}: FunnelStageSectionProps) {
  const colors = BUCKET_COLORS[bucket.color] ?? BUCKET_COLORS.slate
  const totalEntries = bucket.entries.length
  const [currentPage, setCurrentPage] = useState(0)

  // Reset to first page whenever filtered entries change
  useEffect(() => {
    setCurrentPage(0)
  }, [filteredEntries.length])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const start = currentPage * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, filteredEntries.length)
  const pageEntries = filteredEntries.slice(start, end)

  // Build sub-group headers for bucket 0
  const subGroupHeaders = bucket.bucket === 0 && bucket.subGroups ? (
    <div className="flex flex-wrap gap-3 mt-2">
      {(['core', 'adjacent', 'non_core', 'unknown'] as const).map(status => {
        const entries = bucket.subGroups![status]
        const count = entries.length
        if (count === 0) return null
        const isActive = aiStatusFilter === 'all' || aiStatusFilter === status
        const statusColors: Record<string, { bg: string; border: string; badge: string; text: string }> = {
          core: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700' },
          adjacent: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700' },
          non_core: { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600', text: 'text-slate-600' },
          unknown: { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600', text: 'text-gray-600' },
        }
        const sc = statusColors[status]
        return (
          <div
            key={status}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${sc.border} ${sc.badge}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${status === 'core' ? 'bg-emerald-500' : status === 'adjacent' ? 'bg-amber-500' : 'bg-slate-400'}`} />
            <span>{AI_STATUS_LABELS[status]}</span>
            <span className={`font-mono font-semibold ${sc.text}`}>{count}</span>
          </div>
        )
      })}
    </div>
  ) : null

  return (
    <div className={cn('border rounded-lg overflow-hidden transition-colors', colors.border, colors.bg)}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary cursor-pointer"
        aria-expanded={isExpanded}
      >
        <div className={cn('shrink-0 transition-transform', isExpanded ? 'rotate-0' : '-rotate-90')}>
          <ChevronRight className={cn('w-4 h-4', colors.text)} />
        </div>

        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: bucket.color === 'emerald' ? '#10b981' : bucket.color === 'orange' ? '#f97316' : bucket.color === 'amber' ? '#f59e0b' : bucket.color === 'blue' ? '#3b82f6' : bucket.color === 'slate' ? '#64748b' : bucket.color === 'red' ? '#ef4444' : '#9ca3af' }} />

        <div className="flex-1 flex items-center gap-2 text-left">
          <span className={cn('text-sm font-semibold', colors.text)}>{bucket.label}</span>
          <span className="text-xs text-slate-400">/</span>
          <span className="text-xs text-slate-500">{bucket.labelEn}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold border', colors.badge)}>
            {filteredEntries.length.toLocaleString()}
            {filteredEntries.length !== totalEntries && (
              <span className="ml-1 opacity-60">/ {totalEntries.toLocaleString()}</span>
            )}
          </span>
          <span className="text-xs text-slate-400 max-w-xs truncate hidden sm:inline">{bucket.description}</span>
        </div>
      </button>

      {/* Sub-group headers for bucket 0 */}
      {isExpanded && subGroupHeaders}

      {/* Expanded content */}
      {isExpanded && filteredEntries.length > 0 && (
        <div className="border-t border-inherit px-4 py-3">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-200 mb-1">
            <div className="col-span-1">标的</div>
            <div className="col-span-2">公司名称</div>
            <div className="col-span-2">AI分类 / 置信度</div>
            <div className="col-span-3">理由</div>
            <div className="col-span-4">证据</div>
          </div>
          <div className="divide-y divide-slate-100">
            {pageEntries.map(entry => (
              <FunnelCompanyRow key={entry.ticker} entry={entry} />
            ))}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                第 <span className="font-mono font-medium text-slate-600">{start + 1}–{end}</span> 条， 共 <span className="font-mono">{filteredEntries.length.toLocaleString()}</span> 条
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="上一页"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const page = totalPages <= 7 ? i : (
                    currentPage < 5 ? i :
                    currentPage > totalPages - 5 ? totalPages - 7 + i :
                    currentPage - 3 + i
                  )
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        'w-7 h-7 rounded text-xs font-medium transition-colors',
                        page === currentPage
                          ? 'bg-primary text-white'
                          : 'text-slate-500 hover:bg-slate-100'
                      )}
                    >
                      {page + 1}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="下一页"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isExpanded && filteredEntries.length === 0 && (
        <div className="border-t border-inherit px-4 py-6 text-center">
          <p className="text-xs text-slate-400">没有符合条件的公司</p>
        </div>
      )}
    </div>
  )
}
