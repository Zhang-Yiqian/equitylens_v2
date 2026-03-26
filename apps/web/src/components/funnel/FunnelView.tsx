'use client'

import { useState, useEffect, useCallback } from 'react'
import { FunnelDiagram } from './FunnelDiagram'
import { FunnelStageSection } from './FunnelStageSection'
import { FunnelFilters } from './FunnelFilters'
import { formatDate } from '@/lib/utils'

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

interface FunnelData {
  scanId: string | null
  mode: string | null
  completedAt: string | null
  startedAt: string | null
  funnelStats: {
    totalNasdaq: number
    afterBlacklist: number
    l2Matches: number
    l3Classified: number
    aiCore: number
    aiAdjacent: number
    nonCore: number
    unknown: number
    l3ApiFailed: number
  } | null
  buckets: Bucket[]
}

type AiStatusFilter = 'all' | 'core' | 'adjacent' | 'non_core' | 'unknown'

export function FunnelView() {
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set([0, 1, 2]))
  const [searchQuery, setSearchQuery] = useState('')
  const [aiStatusFilter, setAiStatusFilter] = useState<AiStatusFilter>('all')
  const [supplyChainFilter, setSupplyChainFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/universe/funnel')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(e => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  const toggleStage = useCallback((bucket: number) => {
    setExpandedStages(prev => {
      const next = new Set(prev)
      if (next.has(bucket)) next.delete(bucket)
      else next.add(bucket)
      return next
    })
  }, [])

  const handleExportCsv = useCallback(() => {
    if (!data) return

    const rows: string[] = ['Bucket,Ticker,Company,AI Status,Supply Chain,Confidence,Fail Reasons,Pass Reasons,L3 Reasoning,L3 Evidence']

    for (const bucket of data.buckets) {
      const entries = getFilteredEntries(bucket)
      for (const entry of entries) {
        rows.push([
          bucket.label,
          entry.ticker,
          `"${entry.companyName.replace(/"/g, '""')}"`,
          entry.aiStatus ?? '',
          entry.supplyChainTag ?? '',
          entry.l3Confidence?.toString() ?? '',
          `"${entry.failReasons.join('; ')}"`,
          `"${entry.passReasons.join('; ')}"`,
          `"${(entry.l3Reasoning ?? '').replace(/"/g, '""')}"`,
          `"${(entry.l3Evidence ?? '').replace(/"/g, '""')}"`,
        ].join(','))
      }
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `funnel-export-${data.scanId ?? 'scan'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">加载筛选漏斗数据…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-500 text-sm">加载失败：{error ?? '未知错误'}</p>
      </div>
    )
  }

  if (!data.scanId || !data.funnelStats) {
    return (
      <div className="py-24 text-center">
        <p className="text-slate-400 text-sm">暂无扫描数据。请先运行 <code className="font-mono bg-slate-100 px-1 rounded">pnpm scan --full</code> 完成全市场扫描。</p>
      </div>
    )
  }

  function getFilteredEntries(bucket: Bucket): BucketEntry[] {
    let entries: BucketEntry[] = bucket.entries

    // For bucket 0, apply AI status filter to subGroups
    if (bucket.bucket === 0 && bucket.subGroups) {
      if (aiStatusFilter === 'all') {
        entries = [...bucket.subGroups.core, ...bucket.subGroups.adjacent, ...bucket.subGroups.non_core, ...bucket.subGroups.unknown]
      } else {
        entries = bucket.subGroups[aiStatusFilter as keyof SubGroup] ?? []
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      entries = entries.filter(e =>
        e.ticker.toLowerCase().includes(q) || e.companyName.toLowerCase().includes(q)
      )
    }

    if (supplyChainFilter !== 'all') {
      entries = entries.filter(e => e.supplyChainTag === supplyChainFilter)
    }

    return entries
  }

  const totalVisible = data.buckets.reduce((sum, b) => sum + getFilteredEntries(b).length, 0)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">全市场扫描</h1>
            <p className="mt-1 text-sm text-slate-500">
              Scan {data.scanId} · {formatDate(data.completedAt ?? data.startedAt ?? null)}
              {data.mode && <span className="ml-2 text-slate-400">({data.mode})</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Funnel diagram */}
      <FunnelDiagram funnelStats={data.funnelStats} />

      {/* Filters */}
      <FunnelFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        aiStatusFilter={aiStatusFilter}
        onAiStatusChange={setAiStatusFilter}
        supplyChainFilter={supplyChainFilter}
        onSupplyChainChange={setSupplyChainFilter}
        totalVisible={totalVisible}
        totalEntries={data.buckets.reduce((s, b) => s + b.entries.length, 0)}
        onExport={handleExportCsv}
      />

      {/* Stage sections */}
      <div className="space-y-3">
        {data.buckets.map(bucket => {
          const filtered = getFilteredEntries(bucket)
          const isExpanded = expandedStages.has(bucket.bucket)
          return (
            <FunnelStageSection
              key={bucket.bucket}
              bucket={bucket}
              isExpanded={isExpanded}
              onToggle={() => toggleStage(bucket.bucket)}
              filteredEntries={filtered}
              aiStatusFilter={bucket.bucket === 0 ? aiStatusFilter : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
