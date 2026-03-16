import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'buy' | 'watch' | 'avoid' | 'bullish' | 'bearish' | 'neutral' | 'skipped' | 'outline'
}

const variantClass: Record<string, string> = {
  buy: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  watch: 'bg-amber-50 text-amber-700 border border-amber-200',
  avoid: 'bg-red-50 text-red-700 border border-red-200',
  bullish: 'bg-emerald-50 text-emerald-700',
  bearish: 'bg-red-50 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
  skipped: 'bg-slate-50 text-slate-400 border border-slate-200',
  outline: 'bg-transparent border border-slate-300 text-slate-600',
}

export function Badge({ children, className, variant = 'neutral' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tracking-wide',
        variantClass[variant] ?? variantClass.neutral,
        className,
      )}
    >
      {children}
    </span>
  )
}
