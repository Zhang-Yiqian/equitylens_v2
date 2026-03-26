'use client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TickerDetailTabsProps {
  analysis: any
  financialHistory: unknown[]
}

export function TickerDetailTabs({ analysis, financialHistory }: TickerDetailTabsProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <p className="text-sm text-slate-500">分析详情 (TickerDetailTabs 待实现)</p>
      <p className="text-xs text-slate-400 mt-1">Prompt version: {String(analysis?.promptVersion ?? 'N/A')}</p>
      <p className="text-xs text-slate-400">财务历史: {financialHistory.length} 条记录</p>
    </div>
  )
}
