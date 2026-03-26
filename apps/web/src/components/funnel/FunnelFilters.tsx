'use client'

import { Search, Download } from 'lucide-react'

type AiStatusFilter = 'all' | 'core' | 'adjacent' | 'non_core' | 'unknown'

const AI_STATUS_OPTIONS: { value: AiStatusFilter; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'core', label: 'AI 核心' },
  { value: 'adjacent', label: 'AI 关联' },
  { value: 'non_core', label: '非核心' },
  { value: 'unknown', label: '未知' },
]

const SUPPLY_CHAIN_OPTIONS = [
  { value: 'all', label: '全产业链' },
  { value: 'gpu_accelerators', label: 'GPU/加速器' },
  { value: 'storage', label: '存储' },
  { value: 'optical_modules', label: '光模块' },
  { value: 'semiconductors', label: '半导体' },
  { value: 'eda_ip', label: 'EDA/IP' },
  { value: 'servers_oem', label: '服务器/OEM' },
  { value: 'data_center', label: '数据中心' },
  { value: 'cloud', label: '云平台' },
  { value: 'llm_platforms', label: 'LLM平台' },
  { value: 'ai_saas', label: 'AI SaaS' },
  { value: 'networking', label: '网络' },
  { value: 'power_thermal', label: '电力/散热' },
  { value: 'materials', label: '材料' },
  { value: 'capital_formation', label: '资本' },
  { value: 'software_dev', label: '软件开发' },
  { value: 'none', label: '无' },
]

interface FunnelFiltersProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  aiStatusFilter: AiStatusFilter
  onAiStatusChange: (v: AiStatusFilter) => void
  supplyChainFilter: string
  onSupplyChainChange: (v: string) => void
  totalVisible: number
  totalEntries: number
  onExport: () => void
}

export function FunnelFilters({
  searchQuery,
  onSearchChange,
  aiStatusFilter,
  onAiStatusChange,
  supplyChainFilter,
  onSupplyChainChange,
  totalVisible,
  totalEntries,
  onExport,
}: FunnelFiltersProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="搜索标的 / 公司名称…"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors placeholder:text-slate-400"
          />
        </div>

        {/* AI status filter */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="ai-status-filter" className="text-xs text-slate-500 whitespace-nowrap">AI状态:</label>
          <select
            id="ai-status-filter"
            value={aiStatusFilter}
            onChange={e => onAiStatusChange(e.target.value as AiStatusFilter)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          >
            {AI_STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Supply chain filter */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="supply-chain-filter" className="text-xs text-slate-500 whitespace-nowrap">产业链:</label>
          <select
            id="supply-chain-filter"
            value={supplyChainFilter}
            onChange={e => onSupplyChainChange(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white max-w-36"
          >
            {SUPPLY_CHAIN_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Count */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-700">{totalVisible.toLocaleString()}</span>
            {totalVisible !== totalEntries && (
              <span className="text-slate-400"> / {totalEntries.toLocaleString()}</span>
            )}
            <span className="ml-1">家公司</span>
          </span>

          {/* Export */}
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-pointer"
            title="导出 CSV"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>
    </div>
  )
}
