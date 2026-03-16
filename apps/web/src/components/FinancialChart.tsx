'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import type { FinancialHistory } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'

interface FinancialChartProps {
  data: FinancialHistory[]
}

function quarterLabel(year: number, quarter: number): string {
  if (quarter === 0) return `FY${year}`
  return `${year}Q${quarter}`
}

function toChartData(data: FinancialHistory[]) {
  return data
    .filter(d => d.quarter !== 0) // exclude annual summaries
    .map(d => ({
      period: quarterLabel(d.year, d.quarter),
      revenue: d.revenue ? d.revenue / 1e9 : null,           // in $B
      netIncome: d.netIncome ? d.netIncome / 1e9 : null,     // in $B
      grossMarginPct: d.grossMarginPct,
      freeCashFlow: d.freeCashFlow ? d.freeCashFlow / 1e9 : null, // in $B
      revenueGrowthYoY: d.revenueGrowthYoY,
    }))
}

const CHART_COLORS = {
  revenue: '#1E40AF',       // primary blue
  netIncome: '#059669',     // emerald
  grossMargin: '#D97706',   // amber
  fcf: '#7C3AED',          // purple
  growth: '#0891B2',        // cyan
}

const tooltipStyle = {
  backgroundColor: 'white',
  border: '1px solid #E2E8F0',
  borderRadius: '6px',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
}

export function RevenueChart({ data }: FinancialChartProps) {
  const chartData = toChartData(data)
  if (chartData.length === 0) return <EmptyChart />

  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">单位：十亿美元（$B）</p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.7} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v.toFixed(0)}B`}
            width={52}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [
              `$${value?.toFixed(2)}B`,
              name === 'revenue' ? '营收' : '净利润',
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#64748B' }}
            formatter={(v) => v === 'revenue' ? '营收' : '净利润'}
          />
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.15} />
              <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="netIncomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.netIncome} stopOpacity={0.15} />
              <stop offset="95%" stopColor={CHART_COLORS.netIncome} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={CHART_COLORS.revenue}
            strokeWidth={2}
            fill="url(#revenueGrad)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="netIncome"
            stroke={CHART_COLORS.netIncome}
            strokeWidth={2}
            fill="url(#netIncomeGrad)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MarginChart({ data }: FinancialChartProps) {
  const chartData = toChartData(data)
  if (chartData.length === 0) return <EmptyChart />

  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">百分比（%）</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.7} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v.toFixed(0)}%`}
            width={44}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [
              `${value?.toFixed(1)}%`,
              name === 'grossMarginPct' ? '毛利率' : 'YoY增速',
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#64748B' }}
            formatter={(v) => v === 'grossMarginPct' ? '毛利率' : '营收YoY增速'}
          />
          <Line
            type="monotone"
            dataKey="grossMarginPct"
            stroke={CHART_COLORS.grossMargin}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="revenueGrowthYoY"
            stroke={CHART_COLORS.growth}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CashFlowChart({ data }: FinancialChartProps) {
  const chartData = toChartData(data)
  if (chartData.length === 0) return <EmptyChart />

  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">单位：十亿美元（$B）</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.7} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v.toFixed(0)}B`}
            width={52}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [
              `$${value?.toFixed(2)}B`,
              name === 'freeCashFlow' ? '自由现金流' : '经营现金流',
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#64748B' }}
            formatter={(v) => v === 'freeCashFlow' ? '自由现金流' : '经营现金流'}
          />
          <Line
            type="monotone"
            dataKey="freeCashFlow"
            stroke={CHART_COLORS.fcf}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[220px] flex items-center justify-center bg-slate-50 rounded border border-dashed border-slate-200">
      <p className="text-sm text-slate-400">暂无财务数据</p>
    </div>
  )
}
