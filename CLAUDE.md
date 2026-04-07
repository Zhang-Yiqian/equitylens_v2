# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EquityLens v2** is an AI industry chain US stock investment decision tool for personal long-term/swing investing (3-month to 1-year horizon). The full PRD is in `PRD.md`.

This project is currently in **pre-development phase** — only `PRD.md` exists. Tech stack and build commands will be added here once the stack is chosen.

## Core Architecture (Three Modules)

### Module 1: Universe Builder
- Fetches tradable US stock universe from **Nasdaq Trader Symbol Directory** (`nasdaqlisted.txt`, `otherlisted.txt`)
- Cleans/filters out ETFs, funds, warrants, test issues
- Maintains versioned snapshots with diff tracking (new/removed tickers per scan)

### Module 2: AI Chain Mapper
- Two-stage pipeline: **Stage 1** = high-recall keyword match (configurable keyword library) → **Stage 2** = high-precision node classification with confidence score (0–100) and evidence
- 9 industry node categories across upstream (GPU/accelerators, storage, optical modules, semiconductors, EDA/IP), mid-stream (servers/OEM, data center, cloud), and downstream (LLM platforms, AI SaaS)
- Every recall result must store **evidence** (hit keyword, source, text snippet)
- Nodes are user-configurable (add/remove/rename)
- Coverage metrics: per-node company count, top-N market cap coverage, mandatory "key names" recall list

### Module 3: Prompt-driven Scoring
- Generates a **structured research summary** per company (financial trends, valuation snapshot, moat evidence, risk list) as stable input for prompts
- Three perspective prompt templates: Personal (AI industry lens), Buffett (moat/value), Munger (simplicity/long-term durability)
- Prompts are **versioned** with rollback and cross-version comparison
- Output per company: Buy/Watch/Avoid verdict, 3–5 evidence-backed reasons, key variables, risks, and a 0–100 score broken into 4 equal sub-scores (growth space, moat/replaceability, financial quality, valuation)
- Composite score: `total = you*w1 + buffett*w2 + munger*w3` (weights configurable, default 1/1/1)

## Data Sources

| Data Type | Source | Notes |
|---|---|---|
| Universe | Nasdaq Trader Symbol Directory | Free, download via HTTP |
| Financial Hard Truth | SEC EDGAR XBRL APIs (`company facts`, `company concept`) | Authoritative anchor — all key financial fields must trace back here |
| Pricing (EOD) | Tiingo EOD | Sufficient for medium/long-term strategy |
| News (optional v1) | Finnhub Company News | Per-ticker news fetch |

**Hard Truth rule**: Revenue, net income, gross margin, operating cash flow, free cash flow, R&D expense, share changes, and segment disclosures must come from SEC XBRL. If a field is missing, display "缺失" — never fabricate values.

## Key Pages (5 UI Views)

1. **全市场扫描** — Universe scan: version, stats cards, diff view, CSV export
2. **产业链地图** — Left: node tree; Center: company list sortable by market cap/score; Right: node stats + coverage indicators
3. **公司详情** — Tabs: chain position + evidence / Hard Truth financials (with SEC source link) / three-perspective analysis (switchable prompt version) / personal notes
4. **投资机会排行榜** — Filter by node/score range/market cap; sort by composite score; watchlist; CSV export
5. **提示词管理** — Edit/version/rollback/compare for all three prompt perspectives

## Data Update Cadence (v1 defaults)

- Universe: manual weekly refresh
- Financial Hard Truth: quarterly (after earnings releases)
- EOD pricing: daily
- News: 1-hour cycle if enabled

## Harness Architecture

This project uses a unified **Generator-Evaluator** harness pattern for all data pipeline modules. See `packages/harness/` for the framework implementation.

### Core Principles

| Principle | Description |
|---|---|
| **Generator-Evaluator** | Generator yields items; Evaluator checks quality; Runner drives the retry loop |
| **Hard Thresholds** | Critical field gaps fail immediately — no silent degradation |
| **Self-Evaluation** | Each module validates its own output before passing it downstream |
| **Structured Handoffs** | Modules communicate via `ArtifactStore` (KV store in `HarnessContext`), not implicit imports |
| **Budget Tracking** | Token count, elapsed time, and item limits are enforced per-module |

### Package Structure

```
packages/harness/src/
├── primitives/
│   ├── retry.ts          # Exponential backoff with jitter, maxAttempts, isRetryable predicate
│   ├── telemetry.ts      # Structured logging (DEBUG/INFO/WARN/ERROR/FATAL), console + memory handlers
│   ├── validation.ts     # Composable Rule<T> combinators (isDefined, inRange, hasField, etc.)
│   └── budget.ts         # Budget tracking (tokens, time, items, retries)
├── context/
│   ├── artifact-store.ts # In-memory KV store for inter-module data passing
│   └── context.ts        # HarnessContext: runId, artifactStore, telemetry, budget, config
├── runner/
│   ├── runner.ts         # Generator → Evaluator → retry loop; fromAsyncIterator/fromArray helpers
│   └── types.ts          # Evaluator<T,M>, EvaluatorResult, RunnerRunResult, ModuleManifest
├── evaluator/
│   ├── deterministic.ts  # DeterministicSnapshotEvaluator: P0/P1/P2 field tiers, cross-field consistency, outlier detection
│   └── probabilistic.ts  # LLMClassificationEvaluator, LLMScoringEvaluator (uses ANTHROPIC_API_KEY)
└── module-registry.ts    # HarnessOrchestrator: topological sort, dependency ordering
```

### Key Abstractions

- **`HarnessContext`** — shared across a run: `artifactStore`, `telemetry`, `budget`, `config`
- **`Evaluator<T, M>`** — `evaluate(item: T, ctx: HarnessContext): Promise<EvaluatorResult<M>>` → `{ ok, canRetry, errors, warnings, metadata }`
- **`ModuleManifest<T, R, M>`** — describes a module: name, generator, optional evaluator, dependencies, priority
- **`ArtifactStore`** — modules write/read artifacts by key, no import dependency between modules

### Adding a New Module

Implement `ModuleGenerator<T>` and `Evaluator<T, M>`, then register with `HarnessOrchestrator`:

```typescript
const manifest = defineModule('my-module', myGenerator, {
  dependencies: ['financial-data'], // runs after
  evaluator: myEvaluator,
});
orchestrator.register(manifest);
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `EQUITYLENS_HARNESS_MODE` | `false` | Enable harness mode for CLI fetch commands |
| `EQUITYLENS_HARNESS_EVALUATOR_AGENT` | `false` | Enable LLM-powered evaluator (requires `ANTHROPIC_API_KEY`) |
| `EQUITYLENS_HARNESS_LOG_LEVEL` | `INFO` | Minimum log level (DEBUG/INFO/WARN/ERROR/FATAL) |

### CLI Integration

Pass `--harness` to `pnpm fetch` to use harness mode (structured errors, retry, pre-validate). Without the flag, legacy behavior is preserved.

## Reference Implementation

`PRD.md` section 1.3 cites [https://github.com/ZhuLinsen/daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) as a reference for data sourcing and notification patterns to adapt for this project's needs.

## v1 Exclusions (Do Not Implement)

- Feishu/messaging push notifications (v2)
- Automated trading or order placement
- Intraday/minute-level price data
- Multi-user / SaaS features
