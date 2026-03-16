import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse bg-slate-200 rounded', className)}
      aria-hidden="true"
    />
  )
}

export function TableSkeleton({ rows = 10, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="加载中..." className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className={cn('h-8', j === 0 ? 'w-16' : 'flex-1')}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">正在加载数据...</span>
    </div>
  )
}
