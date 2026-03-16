import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EquityLens v2 — AI 产业链投研平台',
  description: '三位一体交叉验证 · 8维度量化分析 · 自选股看板',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh bg-background">
        {/* Skip link for keyboard accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded"
        >
          跳至主要内容
        </a>

        {/* Top navigation bar */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center gap-4">
              <a href="/" className="flex items-center gap-2 font-semibold text-slate-900 hover:text-primary transition-colors" aria-label="EquityLens 主页">
                {/* Logo mark */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-primary">
                  <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor" opacity="0.8"/>
                  <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor" opacity="0.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor" opacity="0.5"/>
                  <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor"/>
                </svg>
                <span className="font-mono font-semibold tracking-tight">EquityLens</span>
                <span className="hidden sm:inline text-slate-400 text-xs font-sans font-normal">v2 · AI产业链投研</span>
              </a>

              <nav className="ml-auto flex items-center gap-1" aria-label="主导航">
                <a href="/" className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer">
                  自选股看板
                </a>
                <span className="text-slate-300 text-xs">|</span>
                <a href="/api/health" className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer" title="API状态">
                  API
                </a>
              </nav>
            </div>
          </div>
        </header>

        <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        <footer className="mt-16 border-t border-slate-100 py-6 text-center text-xs text-slate-400">
          EquityLens v2 · 仅供个人研究参考，不构成投资建议
        </footer>
      </body>
    </html>
  )
}
