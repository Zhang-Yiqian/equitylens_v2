# EquityLens v2

**AI Industry Chain Investment Research Platform**

AI 产业链投资研究平台

---

A personal investment research tool that combines structured financial data analysis with AI-powered insights. Built for swing trading decisions in the US AI industry chain (3-month to 1-year horizon).

一款结合结构化财务数据与 AI 智能分析的个人投资研究工具，专注于美股 AI 产业链的波段交易决策（3个月至1年持有期）。

> ⚠️ **Project Status**: MVP completed in March 2026. This is an active side project for learning and personal use — not a production commercial product.
>
> ⚠️ **项目状态**: 2026年3月完成 MVP。这是一个活跃的副项目，用于学习或个人使用，非商业产品。

---

## 🎯 What It Does / 功能概述

Analyzes AI industry chain companies through a multi-dimensional framework:

通过多维框架分析 AI 产业链公司：

| Layer / 层级 | Companies / 公司 | Focus / 焦点 |
|-------|-----------|---------|
| **AI Application** / AI 应用层 | APP, PLTR, CRWD | AI-powered software platforms / AI 驱动软件平台 |
| **AI Energy & Infrastructure** / AI 能源与基建 | CEG, VST, ASTS | Data center power, satellite communications / 数据中心供电、卫星通信 |
| **Optical Communications** / 光通信 | LITE, CIEN | Data center interconnect / 数据中心光互联 |
| **Hardware & Storage** / 硬件与存储 | WDC, MU | Enterprise storage, HBM memory / 企业存储、HBM 内存 |

Each company is evaluated across **8 analytical dimensions** using a three-perspective framework (Personal / Buffett / Munger), producing a structured verdict: **Buy / Watch / Avoid**.

每家公司通过 **8 个分析维度** 和三视角框架（个人 / 巴菲特 / 芒格）进行评估，输出结构化结论：**买入 / 观察 / 回避**。

---

## 🏗️ Architecture / 架构设计

```
equitylens-v2/
├── apps/
│   ├── cli/           # Command-line analysis engine / 命令行分析引擎
│   └── web/           # Next.js 14 dashboard (port 3001) / Web 看板
├── packages/
│   ├── core/          # Types, constants, tickers / 类型、常量、股票池
│   ├── store/         # SQLite + Drizzle ORM persistence / 数据持久化
│   ├── data/          # SEC EDGAR, Yahoo Finance, 10-K 数据获取
│   ├── engine/        # LLM prompts, cross-validation 提示词与交叉验证
│   └── report/        # Markdown report generation / 报告生成
```

### Tech Stack / 技术栈

- **Runtime**: Node.js 20+, TypeScript 5.x (strict mode)
- **Build**: pnpm workspaces + Turborepo + tsup
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **LLM**: OpenRouter API (Gemini 2.5 Pro / Claude Opus)
- **Web**: Next.js 14 App Router, React 18, Tailwind CSS, shadcn/ui, Recharts

---

## 📊 Data Sources / 数据源 (Hard Truth Rule / 硬核实原则)

| Data Type / 数据类型 | Source / 来源 | Principle / 原则 |
|-----------|--------|-----------|
| Financials / 财务数据 | SEC EDGAR XBRL | Authoritative — all key fields trace back to official filings / 权威来源 — 所有关键字段追溯至官方 filing |
| Pricing / 行情数据 | Yahoo Finance | EOD data sufficient for medium-term strategy / 收盘价足以支持中期策略 |
| News / 新闻 | Yahoo Finance | Supplementary context / 补充上下文 |
| 10-K Text / 年报文本 | SEC EDGAR | Item 1 + Item 1A sections for qualitative analysis / 定性分析用业务描述与风险因素 |

**No fabricated data** — if a field is unavailable, the system displays "缺失" (missing) rather than guessing.

**无伪造数据** — 如果某字段不可用，系统显示"缺失"而非自行猜测。

---

## 🚀 Quick Start / 快速开始

```bash
# Install dependencies / 安装依赖
pnpm install

# Build all packages / 构建所有包
pnpm build

# Start the web dashboard / 启动 Web 看板
pnpm dev --filter=@equitylens/web
# → http://localhost:3001
```

### CLI Usage / CLI 使用方法

```bash
# List all tracked companies / 列出所有跟踪公司
node apps/cli/dist/index.js list

# Full analysis (fetch data → LLM analysis → generate report) / 完整分析流程
node apps/cli/dist/index.js analyze PLTR

# Batch analysis all 10 companies / 批量分析全部 10 家公司
node apps/cli/dist/index.js batch
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

## 🔬 Analysis Framework / 分析框架

### 8-Dimension Cross-Validation / 8维度交叉验证

| Category / 类别 | Dimensions / 维度 |
|----------|-----------|
| **A. Competitive Landscape** / 竞争格局 | A1: Market structure / 市场结构, A2: Moat strength / 护城河强度 |
| **B. Financial Signals** / 财务信号 | B1: Revenue growth trajectory / 营收增长轨迹, B2: Margin evolution / 利润率演变, B3: Cash flow health / 现金流健康度 |
| **C. News & Events** / 新闻事件 | C1: Management signals /管理层信号, C2: Product launches / 产品发布, C3: Regulatory/competitive events / 监管/竞争事件 |

### Three-Perspective Scoring / 三视角评分

Each analysis produces three independent scores:

每次分析生成三个独立分数：

- **Personal** — AI industry lens (growth, leadership, ecosystem) / 个人视角 — AI 行业视角（增长、领导力、生态）
- **Buffett** — Moat and financial quality / 巴菲特视角 — 护城河与财务质量
- **Munger** — Simplicity, long-term durability / 芒格视角 — 简单性、长期可持续性

**Composite Score**: `total = you*w1 + buffett*w2 + munger*w3` (default weights: 1:1:1)

**综合分数**: `总计 = 个人*w1 + 巴菲特*w2 + 芒格*w3`（默认权重 1:1:1）

### Evidence Validation / 证据验证

Every claim from the LLM is cross-validated against source documents:

LLM 输出的每个结论都会与源文档进行交叉验证：

- Financial claims → SEC XBRL facts / 财务声明 → SEC XBRL 事实
- Business description → 10-K Item 1 / 业务描述 → 10-K 第一部分
- Risk factors → 10-K Item 1A / 风险因素 → 10-K 第一部分 A
- Recent events → News articles / 近期事件 → 新闻报道

---

## 📈 Current Results / 当前分析结果

Latest batch analysis (FY2024 Q4, March 2026):

最新批量分析（2024 财年 Q4，2026年3月）：

| Company / 公司 | Verdict / 结论 | Key Catalyst / 关键催化剂 |
|-----------|-----------|----------|
| VST | **Buy / 买入** | Data center power demand / 数据中心电力需求 |
| WDC | **Buy / 买入** | AI storage tailwinds / AI 存储利好 |
| MU | **Buy / 买入** | HBM memory supercycle / HBM 内存超级周期 |
| APP | **Buy / 买入** | AI ad platform growth / AI 广告平台增长 |
| CIEN | **Buy / 买入** | Optical network upgrade / 光网络升级 |
| PLTR | Watch / 观察 | Commercial expansion / 商业化扩展 |
| CRWD | Watch / 观察 | AI security platform / AI 安全平台 |
| CEG | Watch / 观察 | Nuclear power growth / 核电增长 |
| ASTS | Watch / 观察 | Satellite connectivity / 卫星通信 |
| LITE | Watch / 观察 | 800G optical demand / 800G 光模块需求 |

---

## 🛤️ Roadmap / 迭代路线图

This is a personal learning project. Below is my planned iteration path:

这是一个个人学习项目。以下是我的计划迭代路径：

### Phase 1 (Done ✅)
- [x] CLI with financial data fetching / CLI 财务数据获取
- [x] SEC EDGAR integration (XBRL) / SEC EDGAR 集成
- [x] 12-dimension inflection analysis / 12 维度拐点分析
- [x] Basic Markdown reports / 基础 Markdown 报告

### Phase 2 (Done ✅ — Current / 当前)
- [x] Web dashboard (Next.js) / Web 看板
- [x] 8-dimension cross-validation framework / 8 维度交叉验证框架
- [x] 10-K text analysis / 10-K 文本分析
- [x] News sentiment integration / 新闻情绪集成
- [x] SQLite persistence / SQLite 持久化

### Phase 3 (Planned / 计划中)
- [ ] Real-time pricing integration (Tiingo API) / 实时行情集成
- [ ] Industry chain visualization (node graph) / 产业链可视化
- [ ] Watchlist with price alerts / 自选股价格提醒
- [ ] Prompt version comparison / 提示词版本对比

### Phase 4 (Future / 未来)
- [ ] Automated weekly scan / 自动化周度扫描
- [ ] Multi-LLM comparison / 多 LLM 对比
- [ ] Backtesting framework / 回测框架
- [ ] iOS/Android companion app / iOS/Android 配套应用

---

## 💡 Why This Matters to Me / 为什么做这个项目

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

## 📄 License / 许可证

MIT — Personal project, not for commercial use.

MIT — 个人项目，非商业用途。

---

## 🙏 Acknowledgments / 致谢

- [SEC EDGAR](https://www.sec.gov/edgar/searchedgar/companysearch) for authoritative financial data / 权威财务数据
- [OpenRouter](https://openrouter.ai/) for LLM API abstraction / LLM API 抽象
- [Yahoo Finance](https://finance.yahoo.com/) for pricing and news / 行情与新闻数据
- Reference: [daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) for data sourcing patterns / 数据获取模式参考
