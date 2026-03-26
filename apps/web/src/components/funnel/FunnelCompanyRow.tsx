'use client'

import Link from 'next/link'

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

const AI_STATUS_STYLE: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  core: { label: 'AI 核心', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  adjacent: { label: 'AI 关联', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  non_core: { label: '非核心', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  unknown: { label: '未知', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
}

const SUPPLY_CHAIN_LABELS: Record<string, string> = {
  gpu_accelerators: 'GPU/加速器',
  storage: '存储',
  optical_modules: '光模块',
  semiconductors: '半导体',
  eda_ip: 'EDA/IP',
  servers_oem: '服务器/OEM',
  data_center: '数据中心',
  cloud: '云平台',
  llm_platforms: 'LLM平台',
  ai_saas: 'AI SaaS',
  networking: '网络',
  power_thermal: '电力/散热',
  materials: '材料',
  capital_formation: '资本',
  software_dev: '软件开发',
  none: '无',
}

export function FunnelCompanyRow({ entry }: { entry: BucketEntry }) {
  const statusStyle = entry.aiStatus ? AI_STATUS_STYLE[entry.aiStatus] : null
  const supplyChainLabel = entry.supplyChainTag ? SUPPLY_CHAIN_LABELS[entry.supplyChainTag] ?? entry.supplyChainTag : null

  return (
    <div className="grid grid-cols-12 gap-2 px-3 py-2.5 hover:bg-slate-50/50 transition-colors items-start text-sm border-b border-slate-100 last:border-0">

      {/* Ticker */}
      <div className="col-span-4 md:col-span-1">
        <Link
          href={`/ticker/${entry.ticker}`}
          className="font-mono font-semibold text-slate-900 hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline text-xs"
        >
          {entry.ticker}
        </Link>
        {entry.l3ApiFailed && (
          <div className="text-[10px] text-red-500 mt-0.5">⚠️ API失败</div>
        )}
      </div>

      {/* Company name */}
      <div className="col-span-8 md:col-span-2">
        <p className="text-slate-700 text-xs leading-snug line-clamp-2">{entry.companyName}</p>
        {/* Keyword + category badges in company column on mobile */}
        <div className="flex flex-wrap gap-1 mt-1 md:hidden">
          {entry.l2MatchedKeywords.slice(0, 3).map(kw => (
            <span key={kw} className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
              {kw}
            </span>
          ))}
          {entry.l2MatchedKeywords.length > 3 && (
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] text-slate-400 bg-slate-50 border border-slate-200">
              +{entry.l2MatchedKeywords.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* AI status / confidence */}
      <div className="hidden md:flex md:col-span-2 items-start gap-1.5 flex-wrap">
        {statusStyle ? (
          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {statusStyle.label}
          </div>
        ) : null}
        {entry.l3Confidence != null && (
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-10 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${entry.l3Confidence >= 70 ? 'bg-emerald-400' : entry.l3Confidence >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${entry.l3Confidence}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{entry.l3Confidence}</span>
          </div>
        )}
        {supplyChainLabel && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
            {supplyChainLabel}
          </span>
        )}
        {/* Keyword badges */}
        <div className="flex flex-wrap gap-1 w-full">
          {entry.l2MatchedKeywords.slice(0, 3).map(kw => (
            <span key={kw} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
              {kw}
            </span>
          ))}
          {entry.l2MatchedKeywords.length > 3 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-slate-400 bg-slate-50 border border-slate-200">
              +{entry.l2MatchedKeywords.length - 3}
            </span>
          )}
          {entry.l2MatchedCategories.slice(0, 2).map(cat => (
            <span key={cat} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* 理由 */}
      <div className="col-span-12 md:col-span-3 md:border-l md:border-slate-200 md:pl-2 text-xs text-slate-600 leading-relaxed">
        {entry.l3Reasoning ? (
          <span className="line-clamp-4">{entry.l3Reasoning}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </div>

      {/* 证据 */}
      <div className="col-span-12 md:col-span-4 md:border-l md:border-slate-200 md:pl-2 text-xs text-slate-500 leading-relaxed">
        {entry.l3Evidence ? (
          <span className="line-clamp-4">{entry.l3Evidence}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </div>

    </div>
  )
}
