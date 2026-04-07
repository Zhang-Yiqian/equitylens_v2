# EquityLens v2

> **⚠️ 个人自用工具，不对外开放，不接受贡献，不提供技术支持。**

**AI 产业链投资研究平台**

> 专为美股 AI 产业链波段交易（3个月至1年持仓周期）打造的个人投研工具。结合权威 SEC EDGAR 财务数据与 LLM 分析能力——零虚构数据，零黑盒。

---

## 为什么做这个项目

市面上大多数散户投研工具要么过于通用，要么不透明。EquityLens 专为解答一个核心问题而生：

> *"AI 供应链中，哪些公司值得持仓——以及为什么？"*

通过三大核心模块实现，底层运行一套**生产级数据管道框架（Harness）**，在每个阶段强制保证数据质量、自动重试和结构化评估。

---

## 三大模块

### 1. Universe Builder — 全市场扫描
从 Nasdaq Trader 符号目录拉取全量美股（约 11,000 个标的），通过三级漏斗识别 AI 产业链公司：

```
L1: Nasdaq 目录（~11,000 个标的）
    ↓ 黑名单过滤（ETF、权证、粉单、测试标的）
L2: 关键词匹配（25 个 AI 相关词，9 个产业节点）
    ↓ 正则匹配公司名 + 描述
L3: LLM 分类（Gemini / Claude）
    → AI 核心 / AI 相关 / 非核心 / 未知
    → 置信度（0–100）+ 推理过程 + 证据
```

**9 个产业节点**：GPU/加速芯片 · 存储 · 光模块 · 半导体 · EDA/IP · 服务器/OEM · 数据中心 · 云计算 · 大模型平台/AI SaaS

### 2. AI 产业链图谱 — 竞争定位
两阶段管道：高召回率关键词初筛 → 高精度 LLM 分类。每个结果携带**结构化证据**（命中关键词、来源、文本片段），所有决策均可审计。

### 3. 提示词驱动评分 — 三视角分析
逐公司生成结构化研究摘要，从三个独立视角进行评估：

| 视角 | 关注点 |
|------|--------|
| **个人视角** | AI 行业论点——增长、管理层、生态位 |
| **巴菲特视角** | 护城河与财务质量 |
| **芒格视角** | 简单性、长期耐久性、不可替代性 |

每家公司输出：**买入 / 观察 / 回避** 结论 + 3–5 条有据可查的理由 + 0–100 综合评分（细分为4个子维度：成长空间、护城河、财务质量、估值）。

---

## Harness 工程架构

本项目最具特色的工程设计是 `packages/harness/` 中的 **Generator-Evaluator 框架**。这是一个可复用的数据管道框架，在每个阶段强制保证质量——不仅适用于本项目，更是 LLM 增强型数据管道的通用模式。

### 核心模式

```
Generator → 数据流
    ↓
Evaluator → ok | canRetry | errors | warnings
    ↓
Runner → 带预算跟踪的重试循环
    ↓
ArtifactStore → 模块间类型化数据交接
```

每个产生数据的模块在将数据传递给下游之前，必须**自我评估输出结果**。不允许静默降级——关键字段缺失会立即报错。

### 包结构

```
packages/harness/src/
├── primitives/
│   ├── retry.ts          # 指数退避 + 抖动 + isRetryable 判断
│   ├── telemetry.ts      # 结构化日志（DEBUG/INFO/WARN/ERROR/FATAL）
│   ├── validation.ts     # 可组合规则组合子（isDefined, inRange, hasField…）
│   └── budget.ts         # 运行预算：token 数、耗时、条目数、重试次数
├── context/
│   ├── artifact-store.ts # 内存 KV 存储，用于模块间类型化交接
│   └── context.ts        # HarnessContext：runId、artifactStore、日志、预算、配置
├── runner/
│   ├── runner.ts         # Generator → Evaluator → 重试循环
│   └── types.ts          # Evaluator<T,M>、EvaluatorResult、RunnerRunResult、ModuleManifest
├── evaluator/
│   ├── deterministic.ts  # P0/P1/P2 字段分级、跨字段一致性、异常值检测
│   └── probabilistic.ts  # LLMClassificationEvaluator、LLMScoringEvaluator
└── module-registry.ts    # HarnessOrchestrator：拓扑排序、依赖顺序
```

### 设计原则

| 原则 | 实现方式 |
|------|---------|
| **硬阈值** | P0 字段缺失立即报错——关键字段不允许静默 null |
| **自我评估** | 每个模块写入 ArtifactStore 前先调用自身 evaluator |
| **结构化交接** | 模块间通过 `ArtifactStore` 通信——禁止模块间隐式导入 |
| **预算强制** | 每次运行跟踪 token 数、耗时、条目限制 |
| **分层评估** | 第一层=原始字段 null 检查；第二层=跨字段一致性；第三层=LLM 评分 |

### 关键抽象

```typescript
// 模块通过 manifest 描述自身
const manifest = defineModule('financial-data', myGenerator, {
  dependencies: ['universe-scan'],  // 拓扑排序
  evaluator: myEvaluator,
});
orchestrator.register(manifest);

// Evaluator 接口
interface Evaluator<T, M> {
  evaluate(item: T, ctx: HarnessContext): Promise<EvaluatorResult<M>>;
  // 返回：{ ok, canRetry, errors, warnings, metadata }
}
```

### CLI Harness 模式

```bash
# 标准模式（默认行为）
node apps/cli/dist/index.js fetch MU --period 2025Q1

# Harness 模式：结构化错误、重试、预校验
EQUITYLENS_HARNESS_MODE=true node apps/cli/dist/index.js fetch MU --period 2025Q1 --harness

# 启用 LLM 评估器（需要 ANTHROPIC_API_KEY）
EQUITYLENS_HARNESS_EVALUATOR_AGENT=true ...
```

---

## 数据来源与硬真相规则

| 数据类型 | 来源 | 说明 |
|---------|------|------|
| 股票池 | Nasdaq Trader 符号目录 | 免费、权威的美股挂牌列表 |
| 财务数据 | **SEC EDGAR XBRL** | 所有关键字段均溯源至官方申报文件 |
| 价格数据 | Yahoo Finance | 中期策略用收盘价数据 |
| 10-K 文本 | SEC EDGAR | Item 1 + Item 1A 定性分析 |

**硬真相规则**：营收、净利润、毛利率、经营现金流、自由现金流、研发费用、股本变动——全部来源于 SEC XBRL。字段不可用时，系统显示 `缺失`，从不捏造数值。

---

## 项目结构

```
equitylens-v2/
├── apps/
│   ├── cli/              # CLI：fetch / list / scan / prefetch 命令
│   └── web/              # Next.js 14 仪表盘（端口 3001）
├── packages/
│   ├── core/             # 类型、常量、错误定义
│   ├── data/             # SEC EDGAR XBRL + Yahoo Finance 数据获取
│   ├── engine/           # LLM 客户端（OpenRouter）、模型配置、汇编器
│   ├── harness/          # Generator-Evaluator 管道框架（见上）
│   ├── store/            # SQLite + Drizzle ORM 持久化
│   └── universe/         # Universe Builder — L1/L2/L3 扫描管道
└── data/                 # SQLite 数据库文件
```

### 技术栈

- **运行时**：Node.js 20+，TypeScript 5.x（严格模式）
- **构建**：pnpm workspaces + Turborepo + tsup
- **数据库**：SQLite via better-sqlite3 + Drizzle ORM
- **LLM**：OpenRouter API（Gemini / Claude）
- **Web**：Next.js 14 App Router，React 18，Tailwind CSS，shadcn/ui

---

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 复制并填写环境变量
cp .env.example .env

# 启动 Web 仪表盘
pnpm dev --filter=@equitylens/web
# → http://localhost:3001
```

### 环境变量

```bash
OPENROUTER_API_KEY=sk-or-v1-...          # LLM 路由（openrouter.ai）
SEC_EDGAR_USER_AGENT="Name email@x.com"  # SEC 合理使用政策要求
ANTHROPIC_API_KEY=sk-ant-...             # 可选：启用 Harness 中的 LLM 评估器
```

### CLI 命令

```bash
# 获取股票财务数据（SEC EDGAR XBRL）
node apps/cli/dist/index.js fetch NVDA

# 获取指定期间数据
node apps/cli/dist/index.js fetch MU --period 2025Q1

# 列出所有已追踪公司
node apps/cli/dist/index.js list

# 运行全量 Universe 扫描（L1 → L2 → L3）
node apps/cli/dist/index.js scan --full

# 增量扫描（仅处理新增/移除标的）
node apps/cli/dist/index.js scan

# 预获取 Universe 公司描述
node apps/cli/dist/index.js prefetch
```

---

## 路线图

### Phase 1 — 数据管道基础（已完成 ✅）
- [x] CLI + SEC EDGAR XBRL 财务数据获取
- [x] 基础 Markdown 研究报告
- [x] SQLite + Drizzle ORM 持久化

### Phase 2 — Universe Builder + Web 仪表盘（已完成 ✅）
- [x] Nasdaq 全量股票池接入（L1/L2/L3 扫描管道）
- [x] AI 产业链图谱——9 个产业节点
- [x] Next.js Web 仪表盘 + 漏斗可视化
- [x] 自选股仪表盘 + CSV 导出

### Phase 3 — Harness 工程（已完成 ✅ — 当前）
- [x] Generator-Evaluator Harness 框架（`packages/harness/`）
- [x] 确定性评估器：P0/P1/P2 字段分级、跨字段一致性
- [x] 概率性（LLM）评估器：分类与评分
- [x] 预算跟踪（token、时间、条目数、重试次数）
- [x] `HarnessOrchestrator` 拓扑模块排序
- [x] CLI `--harness` 标志启用结构化管道模式
- [x] 非日历财年公司 FY 偏移回退逻辑（如 MU 的 8 月财年）

### Phase 4 — 分析深度（计划中）
- [ ] 三视角提示词评分 UI（个人 / 巴菲特 / 芒格）
- [ ] 提示词版本管理 + 回滚 + diff 对比
- [ ] 10-K 文本分析（Item 1 + Item 1A 提取）
- [ ] 产业链可视化（交互式节点图）
- [ ] 新闻情绪集成（Finnhub）

### Phase 5 — 自动化与扩展（未来）
- [ ] 自动化每周 Universe 扫描
- [ ] 实时收盘价数据（Tiingo API）
- [ ] 多 LLM 对比与评分一致性检验
- [ ] 投资机会排行榜 + 自选股提醒
- [ ] 回测框架（结论验证）

---

## 工程亮点

本项目将**生产级工程实践**应用于真实的个人投资问题：

- **Harness 模式**——每个数据模块都有 generator、evaluator 和重试策略，零静默失败。
- **硬真相强制执行**——财务数据溯源至 SEC XBRL，从结构上杜绝数据捏造。
- **财年边界处理**——通过 `extractValue` 和 `matchCalendarQuarter` 中的 `fy ± 1` 回退逻辑，正确处理非日历财年公司（如 Micron 的 8 月财年）。
- **Monorepo 架构**——pnpm workspaces + Turborepo，实现清晰的包边界和快速增量构建。
- **TypeScript 严格模式**——从数据获取到 UI 渲染的端到端类型安全。

---

## 致谢

- [SEC EDGAR](https://www.sec.gov/edgar/searchedgar/companysearch) — 权威财务数据
- [Nasdaq Trader](https://www.nasdaqtrader.com/) — 股票符号目录
- [OpenRouter](https://openrouter.ai/) — LLM API 抽象层
- [daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) — 数据来源模式参考
