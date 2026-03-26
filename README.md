# EquityLens v2

**AI Industry Chain Investment Research Platform**

AI 产业链投资研究平台

---

A personal investment research tool that combines structured financial data analysis with AI-powered insights. Built for swing trading decisions in the US AI industry chain (3-month to 1-year horizon).

一款结合结构化财务数据与 AI 智能分析的个人投资研究工具，专注于美股 AI 产业链的波段交易决策（3个月至1年持有期）。

> **Project Status**: Active development. MVP completed — see Roadmap for current phase.
> **项目状态**: 积极开发中。MVP 已完成 — 详见路线图。

---

## What It Does / 功能概述

EquityLens v2 是一个 AI 产业链投研平台，包含三个核心模块：

1. **Universe Builder** — 从 Nasdaq Trader Symbol Directory 抓取全市场股票数据，通过 L1/L2/L3 三级筛选漏斗识别 AI 产业链公司
2. **AI Chain Mapper** — LLM 驱动的产业链节点分类（GPU/加速器、存储、光模块、服务器、数据中心、云平台、AI SaaS 等 9 个节点）
3. **Prompt-driven Scoring** — 三视角（个人/巴菲特/芒格）深度分析，输出结构化研报

Each company is evaluated through an 8-dimension cross-validation framework, producing a structured verdict: **Buy / Watch / Avoid**.

每家公司通过 8 维度交叉验证框架进行评估，输出结构化结论：**买入 / 观察 / 回避**。

---

## Architecture / 架构设计

```
equitylens-v2/
├── apps/
│   ├── cli/              # Universe scan CLI (list/fetch/scan/batch 命令)
│   └── web/              # Next.js 14 dashboard (port 3001)
│       ├── app/          # App Router pages
│       │   ├── page.tsx              # 自选股看板 (Watchlist Dashboard)
│       │   ├── funnel/               # 全市场扫描 (Universe Funnel)
│       │   │   ├── page.tsx          # FunnelView 漏斗视图
│       │   │   └── api/              # API routes
│       │   ├── ticker/[symbol]/      # 标的详情页
│       │   └── api/                  # Health, watchlist APIs
│       └── components/              # UI components (funnel/, ui/, WatchlistTable)
├── packages/
│   ├── core/             # Types, constants, error definitions
│   ├── data/             # SEC EDGAR (XBRL/10-K) + Yahoo Finance data fetching
│   ├── engine/           # LLM client (OpenRouter), model config, assembler
│   ├── store/            # SQLite + Drizzle ORM persistence
│   └── universe/         # Universe Builder — L1/L2/L3 scan pipeline
│       ├── fetcher/      # Nasdaq universe, company description, AI core list
│       ├── matcher/      # Regex keyword matching, blacklist/whitelist
│       ├── classifier/   # L3 LLM classification (batch + parser + prompt)
│       ├── filter/       # Hard filters (market cap, price, exchange), compliance
│       └── pipeline/     # Scan orchestration, progress printing, retry logic
└── data/                 # SQLite database files (equitylens.db)
```

### Tech Stack / 技术栈

- **Runtime**: Node.js 20+, TypeScript 5.x (strict mode)
- **Build**: pnpm workspaces + Turborepo + tsup
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **LLM**: OpenRouter API (Gemini 3.1 Flash / Claude Opus)
- **Web**: Next.js 14 App Router, React 18, Tailwind CSS, shadcn/ui, Recharts

---

## Data Sources / 数据源 (Hard Truth Rule / 硬核实原则)

| Data Type / 数据类型 | Source / 来源 | Principle / 原则 |
|-----------|--------|-----------|
| Universe / 股票池 | Nasdaq Trader Symbol Directory | Free, authoritative listing of all US exchange stocks / 权威免费美股目录 |
| Financials / 财务数据 | SEC EDGAR XBRL | Authoritative — all key fields trace back to official filings / 权威来源 — 所有关键字段追溯至官方 filing |
| Pricing / 行情数据 | Yahoo Finance | EOD data sufficient for medium-term strategy / 收盘价足以支持中期策略 |
| 10-K Text / 年报文本 | SEC EDGAR | Item 1 + Item 1A sections for qualitative analysis / 定性分析用业务描述与风险因素 |

**No fabricated data** — if a field is unavailable, the system displays "缺失" (missing) rather than guessing.

**无伪造数据** — 如果某字段不可用，系统显示"缺失"而非自行猜测。

---

## Quick Start / 快速开始

```bash
# Install dependencies / 安装依赖
pnpm install

# Build all packages / 构建所有包
pnpm build

# Start the web dashboard / 启动 Web 看板
pnpm dev --filter=@equitylens/web
# → http://localhost:3001
```

### CLI Commands / CLI 命令

```bash
# List all tracked companies / 列出所有跟踪公司
node apps/cli/dist/index.js list

# Fetch financial data for a single ticker / 获取单个标的财务数据
node apps/cli/dist/index.js fetch PLTR

# Run full universe scan (L1/L2/L3 pipeline) / 运行全市场扫描（L1/L2/L3 管道）
node apps/cli/dist/index.js scan --full

# Incremental scan (only new/removed tickers) / 增量扫描
node apps/cli/dist/index.js scan

# Batch analyze all tracked companies / 批量分析所有自选股
node apps/cli/dist/index.js batch

# Show scan progress stats / 显示扫描统计
node apps/cli/dist/index.js scan --verbose
```

### Environment Variables / 环境变量

```bash
# Copy example / 复制示例
cp .env.example .env

# Required keys / 必需密钥:
OPENROUTER_API_KEY=sk-or-v1-...   # LLM routing (openrouter.ai)
SEC_EDGAR_USER_AGENT="YourName your@email.com"  # SEC requirement / SEC 要求
```

---

## Universe Builder — L1/L2/L3 Scan Pipeline

The Universe Builder module scans the entire US stock market through a three-tier funnel:

```
L1: Nasdaq Directory (Nasdaq Trader Symbol Directory)
    ↓ Blacklist filter (ETFs, funds, warrants, test issues, pink sheets, etc.)
L2: Keyword Matching (regex against company name + description)
    ↓ 25 AI-related keywords across 9 industry nodes
L3: LLM Classification (OpenRouter Gemini 2.5 Pro)
    → AI Core / AI Adjacent / Non-Core / Unknown
    → Confidence score (0-100) + reasoning + evidence
```

### Filter Stages / 过滤阶段

| Stage / 阶段 | What it does / 做什么 |
|-----|--------|
| **Blacklist** | Remove ETFs, ETNs, preferred stock, warrants, test issues, pink sheets |
| **Hard Filters** | Market cap < $50M, price < $1, non-US exchange |
| **Compliance** | OTC markets, "shell company", "bankrupt" in description |
| **L2 Keyword** | Regex match against company name + description (case-insensitive) |
| **L3 Classifier** | LLM categorizes into AI Core / Adjacent / Non-Core / Unknown |

### 9 Industry Nodes / 9 个产业节点

- **Upstream / 上游**: GPU/Accelerators, Storage, Optical Modules, Semiconductors, EDA/IP
- **Mid-stream / 中游**: Servers/OEM, Data Center, Cloud
- **Downstream / 下游**: LLM Platforms, AI SaaS

---

## Web Dashboard / Web 看板

### Pages / 页面

1. **自选股看板** (`/`) — Watchlist Dashboard
   - Stats cards: total market cap, buy/watch/avoid counts
   - Sortable table with ticker, company, AI status, supply chain tag, score, verdict
   - Click ticker to see detailed analysis

2. **全市场扫描** (`/funnel`) — Universe Funnel
   - Funnel diagram showing L1→L2→L3→AI Core/Adjacent/Non-Core/Unknown counts
   - Expandable stage sections with company lists
   - Filters: search by ticker/company, AI status filter, supply chain tag filter
   - CSV export

3. **标的详情** (`/ticker/[symbol]`) — Ticker Detail
   - Tabs: Chain Position + Evidence / Financial Hard Truth / Analysis / Notes

### API Routes

| Route | Description |
|-------|-------------|
| `GET /api/health` | Health check |
| `GET /api/universe/funnel` | Get funnel data for scan visualization |
| `GET /api/watchlist` | Get watchlist with scores and verdicts |
| `GET /api/ticker/[symbol]` | Get detailed data for a ticker |

---

## Analysis Framework / 分析框架

### 8-Dimension Cross-Validation / 8维度交叉验证

| Category / 类别 | Dimensions / 维度 |
|----------|-----------|
| **A. Competitive Landscape / 竞争格局** | A1: Market structure / 市场结构, A2: Moat strength / 护城河强度 |
| **B. Financial Signals / 财务信号** | B1: Revenue growth trajectory / 营收增长轨迹, B2: Margin evolution / 利润率演变, B3: Cash flow health / 现金流健康度 |
| **C. News & Events / 新闻事件** | C1: Management signals / 管理层信号, C2: Product launches / 产品发布, C3: Regulatory/competitive events / 监管/竞争事件 |

### Three-Perspective Scoring / 三视角评分

Each analysis produces three independent scores:

每次分析生成三个独立分数：

- **Personal** — AI industry lens (growth, leadership, ecosystem) / 个人视角 — AI 行业视角（增长、领导力、生态）
- **Buffett** — Moat and financial quality / 巴菲特视角 — 护城河与财务质量
- **Munger** — Simplicity, long-term durability / 芒格视角 — 简单性、长期可持续性

**Composite Score**: `total = you*w1 + buffett*w2 + munger*w3` (default weights: 1:1:1)

**综合分数**: `总计 = 个人*w1 + 巴菲特*w2 + 芒格*w3`（默认权重 1:1:1）

---

## Roadmap / 迭代路线图

### Phase 1 (Done ✅)
- [x] CLI with financial data fetching / CLI 财务数据获取
- [x] SEC EDGAR integration (XBRL) / SEC EDGAR 集成
- [x] Basic Markdown reports / 基础 Markdown 报告

### Phase 2 (Done ✅ — Current / 当前)
- [x] Web dashboard (Next.js) / Web 看板
- [x] Universe Builder L1/L2/L3 scan pipeline / 全市场扫描管道
- [x] AI Chain Mapper — 9 industry nodes / 9 个产业节点
- [x] SQLite persistence / SQLite 持久化
- [x] Funnel visualization / 漏斗可视化
- [x] Watchlist dashboard / 自选股看板
- [x] CSV export / CSV 导出

### Phase 3 (Planned / 计划中)
- [ ] 10-K text analysis / 10-K 文本分析
- [ ] News sentiment integration / 新闻情绪集成
- [ ] Industry chain visualization (node graph) / 产业链可视化
- [ ] Prompt version management / 提示词版本管理
- [ ] Watchlist with price alerts / 自选股价格提醒

### Phase 4 (Future / 未来)
- [ ] Real-time pricing integration (Tiingo API) / 实时行情集成
- [ ] Automated weekly scan / 自动化周度扫描
- [ ] Multi-LLM comparison / 多 LLM 对比
- [ ] Backtesting framework / 回测框架
- [ ] iOS/Android companion app / iOS/Android 配套应用

---

## Why This Project / 为什么做这个项目

I'm building EquityLens to:

我正在构建 EquityLens 以：

1. **Learn by building** — Hands-on experience with full-stack AI application development
   **通过实践学习** — 全栈 AI 应用开发的实践经验

2. **Apply investment research** — Systematic approach to analyzing AI industry chains
   **应用投资研究** — 系统化分析 AI 产业链的方法论

3. **Demonstrate engineering skills** — TypeScript, system design, data pipeline, LLMs
   **展示工程能力** — TypeScript、系统设计、数据管道、LLM 集成

This project showcases:
此项目展示：

- **System design** — Monorepo architecture, data pipeline, caching strategy
  **系统设计** — Monorepo 架构、数据管道、缓存策略
- **LLM integration** — Prompt engineering, response parsing, hallucination prevention
  **LLM 集成** — 提示词工程、响应解析、幻觉防护
- **Full-stack development** — Next.js, SQLite, API design
  **全栈开发** — Next.js、SQLite、API 设计
- **Code quality** — TypeScript strict mode, Vitest testing, Drizzle ORM type safety
  **代码质量** — TypeScript 严格模式、Vitest 测试、Drizzle ORM 类型安全

---

## License / 许可证

MIT — Personal project, not for commercial use.

MIT — 个人项目，非商业用途。

---

## Acknowledgments / 致谢

- [SEC EDGAR](https://www.sec.gov/edgar/searchedgar/companysearch) for authoritative financial data / 权威财务数据
- [Nasdaq Trader](https://www.nasdaqtrader.com/) for symbol directory / 股票代码目录
- [OpenRouter](https://openrouter.ai/) for LLM API abstraction / LLM API 抽象
- [Yahoo Finance](https://finance.yahoo.com/) for pricing and news / 行情与新闻数据
- Reference: [daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) for data sourcing patterns / 数据获取模式参考
