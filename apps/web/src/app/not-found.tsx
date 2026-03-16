import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-6xl font-bold text-slate-200 mb-4">404</p>
      <h2 className="text-xl font-semibold text-slate-700 mb-2">页面不存在</h2>
      <p className="text-sm text-slate-500 mb-8">
        该标的可能未在系统中运行分析，或路径错误。
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        返回看板
      </Link>
    </div>
  )
}
