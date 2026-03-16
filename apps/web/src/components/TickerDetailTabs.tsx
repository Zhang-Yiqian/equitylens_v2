'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { DimensionGroup } from '@/components/DimensionCard'
import { RevenueChart, MarginChart, CashFlowChart } from '@/components/FinancialChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AnalysisDetail, FinancialHistory } from '@/lib/db'
import { formatCurrency, formatPctAbs } from '@/lib/utils'

interface Props {
  analysis: AnalysisDetail
  financialHistory: FinancialHistory[]
}

type Tab = 'report' | 'dimensions' | 'financials'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'report', label: '研判报告' },
  { id: 'dimensions', label: '8维度分析' },
  { id: 'financials', label: '财务趋势' },
]

export function TickerDetailTabs({ analysis, financialHistory }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('report')

  // Parse JSON fields
  let dimensions: ReturnType<typeof parseDimensions> = []
  let catalysts: unknown[] = []
  let risks: unknown[] = []
  try { dimensions = parseDimensions(analysis.dimensionsJson) } catch { }
  try { catalysts = JSON.parse(analysis.catalystsJson) } catch { }
  try { risks = JSON.parse(analysis.risksJson) } catch { }

  // Group dimensions by category
  const catA = dimensions.filter(d => d.category === 'A')
  const catB = dimensions.filter(d => d.category === 'B')
  const catC = dimensions.filter(d => d.category === 'C')
  const catD = dimensions.filter(d => d.category === 'D')

  // Check if cross-validation (has conclusion/landscapeAnalysis)
  const isCrossValidation = !!(analysis.conclusion || analysis.landscapeAnalysis)

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-6" role="tablist" aria-label="分析标签页">
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-t',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Report */}
      {activeTab === 'report' && (
        <div id="tabpanel-report" role="tabpanel" aria-labelledby="tab-report">
          {isCrossValidation ? (
            <CrossValidationReport analysis={analysis} />
          ) : (
            <LegacyReport analysis={analysis} />
          )}

          {/* Catalysts & Risks */}
          {(catalysts.length > 0 || risks.length > 0) && (
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {catalysts.length > 0 && (
                <CatalystRiskList
                  title="催化剂"
                  items={catalysts as Array<{ description: string; timeline: string; probability: string }>}
                  type="catalyst"
                />
              )}
              {risks.length > 0 && (
                <CatalystRiskList
                  title="风险清单"
                  items={risks as Array<{ description: string; severity: string }>}
                  type="risk"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: 8-dimension */}
      {activeTab === 'dimensions' && (
        <div id="tabpanel-dimensions" role="tabpanel" aria-labelledby="tab-dimensions" className="space-y-6">
          {catA.length > 0 && <DimensionGroup category="A" dimensions={catA} />}
          {catB.length > 0 && <DimensionGroup category="B" dimensions={catB} />}
          {catC.length > 0 && <DimensionGroup category="C" dimensions={catC} />}
          {catD.length > 0 && <DimensionGroup category="D" dimensions={catD} />}
          {dimensions.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">暂无维度分析数据</div>
          )}
        </div>
      )}

      {/* Tab: Financials */}
      {activeTab === 'financials' && (
        <div id="tabpanel-financials" role="tabpanel" aria-labelledby="tab-financials">
          <FinancialTab history={financialHistory} />
        </div>
      )}
    </div>
  )
}

// ── Cross-validation report rendering ────────────────────────────────────────

function CrossValidationReport({ analysis }: { analysis: AnalysisDetail }) {
  return (
    <div className="space-y-5">
      {/* Section 1: 综合结论 */}
      {analysis.conclusion && (
        <ReportSection
          number="一"
          title="综合结论"
          borderColor="border-primary/30"
          bgColor="bg-blue-50/30"
        >
          <div className="report-prose">
            <ReactMarkdown>{analysis.conclusion}</ReactMarkdown>
          </div>
        </ReportSection>
      )}

      {/* Section 2: 竞争格局分析 */}
      {analysis.landscapeAnalysis && (
        <ReportSection
          number="二"
          title="竞争格局分析（基于10-K）"
          borderColor="border-amber-300/40"
          bgColor="bg-amber-50/20"
        >
          <div className="report-prose">
            <ReactMarkdown>{analysis.landscapeAnalysis}</ReactMarkdown>
          </div>
        </ReportSection>
      )}

      {/* Section 3: 核心风险提示 */}
      {analysis.riskWarning && (
        <ReportSection
          number="三"
          title="核心风险提示"
          borderColor="border-red-300/40"
          bgColor="bg-red-50/20"
        >
          <div className="report-prose">
            <ReactMarkdown>{analysis.riskWarning}</ReactMarkdown>
          </div>
        </ReportSection>
      )}

      {/* Fallback to thesisSummary if all three are missing */}
      {!analysis.conclusion && !analysis.landscapeAnalysis && !analysis.riskWarning && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
          <div className="report-prose">
            <ReactMarkdown>{analysis.thesisSummary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function LegacyReport({ analysis }: { analysis: AnalysisDetail }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
      <p className="text-xs text-slate-400 mb-3 font-mono">legacy · {analysis.promptVersion}</p>
      <div className="report-prose">
        <ReactMarkdown>{analysis.thesisSummary}</ReactMarkdown>
      </div>
    </div>
  )
}

function ReportSection({
  number,
  title,
  children,
  borderColor,
  bgColor,
}: {
  number: string
  title: string
  children: React.ReactNode
  borderColor: string
  bgColor: string
}) {
  return (
    <div className={cn('border rounded-lg p-5', borderColor, bgColor)}>
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <span className="font-mono text-xs bg-white/70 border border-slate-200 rounded px-1.5 py-0.5 text-slate-500">
          {number}
        </span>
        {title}
      </h3>
      {children}
    </div>
  )
}

// ── Catalysts & Risks ─────────────────────────────────────────────────────────

function CatalystRiskList({
  title,
  items,
  type,
}: {
  title: string
  items: Array<{ description: string; timeline?: string; probability?: string; severity?: string }>
  type: 'catalyst' | 'risk'
}) {
  const levelColor = (level: string | undefined) => {
    const l = level?.toLowerCase()
    if (l === 'high') return type === 'risk' ? 'text-red-600' : 'text-emerald-600'
    if (l === 'medium') return 'text-amber-600'
    return 'text-slate-500'
  }

  const levelLabel = (level: string | undefined) => {
    const map: Record<string, string> = { high: '高', medium: '中', low: '低' }
    return map[level?.toLowerCase() ?? ''] ?? level ?? ''
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {items.map((item, i) => {
          const level = item.probability ?? item.severity
          return (
            <div key={i} className="flex gap-3 py-2 border-b border-slate-50 last:border-0">
              <div className="shrink-0 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400 font-mono mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 leading-relaxed">{item.description}</p>
                <div className="flex items-center gap-3 mt-1">
                  {item.timeline && (
                    <span className="text-xs text-slate-400">{item.timeline}</span>
                  )}
                  {level && (
                    <span className={cn('text-xs font-medium', levelColor(level))}>
                      {levelLabel(level)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── Financial Tab ─────────────────────────────────────────────────────────────

function FinancialTab({ history }: { history: FinancialHistory[] }) {
  const latest = history[history.length - 1]

  return (
    <div className="space-y-6">
      {/* Key metrics strip */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="营收" value={formatCurrency(latest.revenue)} />
          <MiniStat label="净利润" value={formatCurrency(latest.netIncome)} />
          <MiniStat label="毛利率" value={formatPctAbs(latest.grossMarginPct)} />
          <MiniStat label="自由现金流" value={formatCurrency(latest.freeCashFlow)} />
        </div>
      )}

      {/* Charts */}
      <Card>
        <CardHeader><CardTitle>营收 & 净利润趋势</CardTitle></CardHeader>
        <CardContent><RevenueChart data={history} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>利润率 & 增速趋势</CardTitle></CardHeader>
        <CardContent><MarginChart data={history} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>自由现金流趋势</CardTitle></CardHeader>
        <CardContent><CashFlowChart data={history} /></CardContent>
      </Card>

      <p className="text-xs text-slate-400 text-center">
        数据来源：SEC EDGAR XBRL + Yahoo Finance · 仅供参考
      </p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-md px-3 py-2.5">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="num text-base font-semibold text-slate-800">{value}</p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDimensions(json: string) {
  const arr = JSON.parse(json) as Array<{
    id: string
    name: string
    category: string
    signal: string
    confidence: number
    summary: string
    evidence: Array<{ quote: string; source: string; context?: string }>
  }>
  return arr
}
