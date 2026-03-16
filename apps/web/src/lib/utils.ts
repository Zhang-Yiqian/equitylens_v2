import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined, compact = true): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (compact) {
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
    return `${sign}$${abs.toFixed(2)}`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
}

export function formatPctAbs(value: number | null | undefined, digits = 1): string {
  if (value == null) return '—'
  return `${value.toFixed(digits)}%`
}

export function verdictColor(verdict: string): string {
  const v = verdict.toLowerCase()
  if (v === 'buy' || v === 'conviction buy') return 'badge-buy'
  if (v === 'watch') return 'badge-watch'
  if (v === 'avoid') return 'badge-avoid'
  return 'badge-neutral'
}

export function signalColor(signal: string): string {
  const s = signal.toLowerCase()
  if (s === 'bullish') return 'badge-bullish'
  if (s === 'bearish') return 'badge-bearish'
  if (s === 'skipped') return 'badge-skipped'
  return 'badge-neutral'
}

export function signalLabel(signal: string): string {
  const map: Record<string, string> = {
    bullish: '看涨',
    bearish: '看跌',
    neutral: '中性',
    skipped: '跳过',
  }
  return map[signal.toLowerCase()] ?? signal
}

export function verdictLabel(verdict: string): string {
  const map: Record<string, string> = {
    buy: '买入',
    'conviction buy': '强烈买入',
    watch: '观察',
    avoid: '回避',
  }
  return map[verdict.toLowerCase()] ?? verdict
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return iso
  }
}
