# EquityLens v2

**AI Industry Chain Investment Research Platform**

> A personal investment research tool built for swing trading in the US AI industry chain (3-month to 1-year horizon). Combines authoritative SEC EDGAR financial data with LLM-powered analysis — no fabricated numbers, no black boxes.

---

## Why This Project

Most retail investment tools are either too generic or too opaque. EquityLens is purpose-built for one question:

> *"Which companies in the AI supply chain are worth owning — and why?"*

It does this through three core modules running on top of a **production-grade data pipeline harness** that enforces data quality, retries, and structured evaluation at every stage.

---

## Three Modules

### 1. Universe Builder — Full Market Scan
Pulls the entire US tradable stock universe from Nasdaq Trader Symbol Directory, then runs it through a three-tier funnel to identify AI-chain companies:

```
L1: Nasdaq Directory (~11,000 symbols)
    ↓ Blacklist (ETFs, warrants, pink sheets, test issues)
L2: Keyword Match (25 AI-related terms, 9 industry nodes)
    ↓ Regex against company name + description
L3: LLM Classification (Gemini / Claude)
    → AI Core / AI Adjacent / Non-Core / Unknown
    → Confidence score (0–100) + reasoning + evidence
```

**9 Industry Nodes**: GPU/Accelerators · Storage · Optical Modules · Semiconductors · EDA/IP · Servers/OEM · Data Center · Cloud · LLM Platforms/AI SaaS

### 2. AI Chain Mapper — Competitive Positioning
Two-stage pipeline: high-recall keyword pass → high-precision LLM classification. Each result carries **structured evidence** (hit keyword, source, text snippet) so you can audit every decision.

### 3. Prompt-Driven Scoring — Three-Perspective Analysis
Generates a structured research summary per company, then evaluates it from three independent lenses:

| Perspective | Focus |
|-------------|-------|
| **Personal** | AI industry thesis — growth, leadership, ecosystem position |
| **Buffett** | Moat and financial quality |
| **Munger** | Simplicity, long-term durability, irreplaceability |

Output per company: **Buy / Watch / Avoid** verdict + 3–5 evidence-backed reasons + 0–100 composite score broken into 4 sub-scores (growth space, moat, financial quality, valuation).

---

## Harness Engineering Architecture

The most distinctive engineering aspect of this project is the **Generator-Evaluator harness** in `packages/harness/`. It's a reusable data pipeline framework that enforces quality at every stage — not just for this project, but as a general pattern for LLM-augmented data pipelines.

### Core Pattern

```
Generator → Item stream
    ↓
Evaluator → ok | canRetry | errors | warnings
    ↓
Runner → retry loop with budget tracking
    ↓
ArtifactStore → typed handoff between modules
```

Every module that produces data must **evaluate its own output** before passing it downstream. There is no silent degradation — missing critical fields fail immediately and loudly.

### Package Structure

```
packages/harness/src/
├── primitives/
│   ├── retry.ts          # Exponential backoff with jitter + isRetryable predicate
│   ├── telemetry.ts      # Structured logging (DEBUG/INFO/WARN/ERROR/FATAL)
│   ├── validation.ts     # Composable Rule<T> combinators (isDefined, inRange, hasField…)
│   └── budget.ts         # Per-run budget: tokens, elapsed time, item count, retries
├── context/
│   ├── artifact-store.ts # In-memory KV store for typed inter-module handoffs
│   └── context.ts        # HarnessContext: runId, artifactStore, telemetry, budget, config
├── runner/
│   ├── runner.ts         # Generator → Evaluator → retry loop
│   └── types.ts          # Evaluator<T,M>, EvaluatorResult, RunnerRunResult, ModuleManifest
├── evaluator/
│   ├── deterministic.ts  # P0/P1/P2 field tiers, cross-field consistency, outlier detection
│   └── probabilistic.ts  # LLMClassificationEvaluator, LLMScoringEvaluator
└── module-registry.ts    # HarnessOrchestrator: topological sort, dependency ordering
```

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Hard Thresholds** | P0 field gaps fail immediately — no silent nulls in critical fields |
| **Self-Evaluation** | Each module calls its own evaluator before writing to ArtifactStore |
| **Structured Handoffs** | Modules communicate via `ArtifactStore` — no implicit imports between modules |
| **Budget Enforcement** | Token count, elapsed time, and item limits tracked per run |
| **Layered Evaluation** | Layer 1 = raw field null checks; Layer 2 = cross-field consistency; Layer 3 = LLM scoring |

### Key Abstractions

```typescript
// A module describes itself via a manifest
const manifest = defineModule('financial-data', myGenerator, {
  dependencies: ['universe-scan'],  // topological ordering
  evaluator: myEvaluator,
});
orchestrator.register(manifest);

// Evaluator interface
interface Evaluator<T, M> {
  evaluate(item: T, ctx: HarnessContext): Promise<EvaluatorResult<M>>;
  // Returns: { ok, canRetry, errors, warnings, metadata }
}
```

### CLI Harness Mode

```bash
# Standard mode (legacy behavior)
node apps/cli/dist/index.js fetch MU --period 2025Q1

# Harness mode: structured errors, retry, pre-validation
EQUITYLENS_HARNESS_MODE=true node apps/cli/dist/index.js fetch MU --period 2025Q1 --harness

# Enable LLM evaluator (uses ANTHROPIC_API_KEY)
EQUITYLENS_HARNESS_EVALUATOR_AGENT=true ...
```

---

## Data Sources & Hard Truth Rule

| Data Type | Source | Notes |
|-----------|--------|-------|
| Universe | Nasdaq Trader Symbol Directory | Free, authoritative US equity listing |
| Financials | **SEC EDGAR XBRL** | All key fields trace back to official filings |
| Pricing | Yahoo Finance | EOD data for medium-term strategy |
| 10-K Text | SEC EDGAR | Item 1 + Item 1A for qualitative analysis |

**Hard Truth Rule**: Revenue, net income, gross margin, operating cash flow, free cash flow, R&D expense, share changes — all must come from SEC XBRL. If a field is unavailable, the system displays `缺失` (missing), never a fabricated value.

---

## Project Structure

```
equitylens-v2/
├── apps/
│   ├── cli/              # CLI: fetch / list / scan / prefetch commands
│   └── web/              # Next.js 14 dashboard (port 3001)
├── packages/
│   ├── core/             # Types, constants, error definitions
│   ├── data/             # SEC EDGAR XBRL + Yahoo Finance fetching
│   ├── engine/           # LLM client (OpenRouter), model config, assembler
│   ├── harness/          # Generator-Evaluator pipeline framework (see above)
│   ├── store/            # SQLite + Drizzle ORM persistence
│   └── universe/         # Universe Builder — L1/L2/L3 scan pipeline
└── data/                 # SQLite database files
```

### Tech Stack

- **Runtime**: Node.js 20+, TypeScript 5.x (strict mode)
- **Build**: pnpm workspaces + Turborepo + tsup
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **LLM**: OpenRouter API (Gemini / Claude)
- **Web**: Next.js 14 App Router, React 18, Tailwind CSS, shadcn/ui

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Copy and fill in environment variables
cp .env.example .env

# Start the web dashboard
pnpm dev --filter=@equitylens/web
# → http://localhost:3001
```

### Environment Variables

```bash
OPENROUTER_API_KEY=sk-or-v1-...          # LLM routing (openrouter.ai)
SEC_EDGAR_USER_AGENT="Name email@x.com"  # Required by SEC fair-use policy
ANTHROPIC_API_KEY=sk-ant-...             # Optional: enables LLM evaluator in harness
```

### CLI Commands

```bash
# Fetch financial data for a ticker (SEC EDGAR XBRL)
node apps/cli/dist/index.js fetch NVDA

# Fetch a specific period
node apps/cli/dist/index.js fetch MU --period 2025Q1

# List all tracked companies
node apps/cli/dist/index.js list

# Run full universe scan (L1 → L2 → L3)
node apps/cli/dist/index.js scan --full

# Incremental scan (new/removed tickers only)
node apps/cli/dist/index.js scan

# Pre-fetch company descriptions for the universe
node apps/cli/dist/index.js prefetch
```

---

## Roadmap

### Phase 1 — Data Pipeline Foundation (Done ✅)
- [x] CLI with SEC EDGAR XBRL financial data fetching
- [x] Basic Markdown research reports
- [x] SQLite persistence with Drizzle ORM

### Phase 2 — Universe Builder + Web Dashboard (Done ✅)
- [x] Nasdaq universe ingestion (L1/L2/L3 scan pipeline)
- [x] AI Chain Mapper — 9 industry nodes
- [x] Next.js web dashboard with funnel visualization
- [x] Watchlist dashboard + CSV export

### Phase 3 — Harness Engineering (Done ✅ — Current)
- [x] Generator-Evaluator harness framework (`packages/harness/`)
- [x] Deterministic evaluator: P0/P1/P2 field tiers, cross-field consistency
- [x] Probabilistic (LLM) evaluator for classification and scoring
- [x] Budget tracking (tokens, time, items, retries)
- [x] `HarnessOrchestrator` with topological module ordering
- [x] CLI `--harness` flag for structured pipeline mode
- [x] FY-offset fallback logic for non-calendar fiscal year companies (e.g. MU)

### Phase 4 — Analysis Depth (Planned)
- [ ] Three-perspective prompt scoring UI (Personal / Buffett / Munger)
- [ ] Prompt version management with rollback + diff
- [ ] 10-K text analysis (Item 1 + Item 1A extraction)
- [ ] Industry chain visualization (interactive node graph)
- [ ] News sentiment integration (Finnhub)

### Phase 5 — Automation & Scale (Future)
- [ ] Automated weekly universe scan
- [ ] Real-time EOD pricing (Tiingo API)
- [ ] Multi-LLM comparison and scoring consistency checks
- [ ] Investment opportunity leaderboard with watchlist alerts
- [ ] Backtesting framework for verdict validation

---

## Engineering Highlights

This project is built to demonstrate **production-grade engineering practices** applied to a real personal finance problem:

- **Harness pattern** — Every data module has a generator, evaluator, and retry policy. No silent failures.
- **Hard Truth enforcement** — Financial data is traced to SEC XBRL; fabrication is structurally impossible.
- **Fiscal year edge cases** — Handles non-calendar FY companies (e.g. Micron's August FY) via `fy ± 1` fallback logic in `extractValue` and `matchCalendarQuarter`.
- **Monorepo architecture** — pnpm workspaces + Turborepo for clean package boundaries and fast incremental builds.
- **TypeScript strict mode** — End-to-end type safety from data fetching to UI rendering.

---

## License

MIT — Personal project, not for commercial use.

---

## Acknowledgments

- [SEC EDGAR](https://www.sec.gov/edgar/searchedgar/companysearch) — authoritative financial data
- [Nasdaq Trader](https://www.nasdaqtrader.com/) — symbol directory
- [OpenRouter](https://openrouter.ai/) — LLM API abstraction
- [daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) — reference for data sourcing patterns
