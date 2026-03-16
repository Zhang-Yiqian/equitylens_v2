# EquityLens v2

**AI Inflection Point Discovery for US Equities**

A CLI tool that analyzes earnings calls and financial data to identify business inflection points for AI industry chain companies. Built around a 12-dimension analysis engine with SEC EDGAR as the authoritative financial data source and anti-hallucination evidence validation.

## Features

- **12-Dimension Inflection Analysis Engine** -- structured scoring across growth, profitability, competitive position, and more
- **SEC EDGAR Hard Truth Financial Data** -- revenue, margins, cash flow, and segment data sourced directly from XBRL filings (authoritative, not estimated)
- **FMP API Supplementary Data** -- earnings call transcripts, market data, and additional financial context
- **Anti-Hallucination Evidence Validation** -- every claim must trace back to a verifiable data source; missing fields display "缺失" rather than fabricated values
- **Structured Markdown Reports** -- per-company analysis output with verdict, evidence, risks, and sub-scores
- **10 Pre-Configured AI Industry Chain Companies** -- ready-to-analyze universe spanning GPU, cloud, data center, and AI software segments

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **pnpm** (package manager)

### Install and Build

```bash
pnpm install
pnpm build
```

## API Key Setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Fill in the three keys in `.env`:

| Service | How to Get | Cost |
|---------|-----------|------|
| **FMP API** | Register at [financialmodelingprep.com](https://site.financialmodelingprep.com/register) | Free (250 requests/day) |
| **SEC EDGAR** | Just set a User-Agent string (`"YourName your@email.com"`) | Free, no key needed |
| **OpenRouter** | Register at [openrouter.ai](https://openrouter.ai/), create a key under Settings > Keys, preload $5 | Pay-per-use |

## Usage

### List available tickers

```bash
node apps/cli/dist/index.js list
```

### Fetch data only (no LLM analysis)

```bash
node apps/cli/dist/index.js fetch PLTR
```

### Full analysis pipeline (fetch + analyze + report)

```bash
node apps/cli/dist/index.js analyze PLTR
```

### Batch analyze all 10 pre-configured tickers

```bash
node apps/cli/dist/index.js batch
```

### Options

| Flag | Description |
|------|-------------|
| `--quarter <Q1\|Q2\|Q3\|Q4>` | Target fiscal quarter |
| `--year <YYYY>` | Target fiscal year |
| `--model <model>` | LLM model to use (default: Gemini 2.5 Pro via OpenRouter) |
| `--output <path>` | Custom output directory for reports |
| `--force-refresh` | Re-fetch all data even if cached |
| `--json` | Output results as JSON instead of Markdown |

## Architecture

EquityLens v2 is organized as a **pnpm monorepo** managed by Turborepo.

```
equitylens-v2/
├── apps/
│   └── cli/          # CLI entry point and command routing
├── packages/
│   ├── core/         # Shared types, constants, configuration
│   ├── store/        # Local data persistence and caching
│   ├── data/         # Data fetchers (SEC EDGAR, FMP, pricing)
│   ├── engine/       # 12-dimension inflection analysis engine
│   └── report/       # Markdown/JSON report generation
├── turbo.json        # Turborepo pipeline configuration
└── pnpm-workspace.yaml
```

| Package | Responsibility |
|---------|---------------|
| `core` | Shared TypeScript types, enums, configuration schema, and constants |
| `store` | File-based local storage for fetched data and analysis results |
| `data` | API clients for SEC EDGAR XBRL, FMP (financials + transcripts), and EOD pricing |
| `engine` | 12-dimension scoring logic, prompt construction, LLM integration, evidence validation |
| `report` | Renders structured analysis output into Markdown and JSON formats |
| `cli` | User-facing CLI commands (`list`, `fetch`, `analyze`, `batch`) |

## 12 Dimensions

The inflection analysis engine evaluates each company across 12 dimensions, grouped into four categories:

| Category | Dimensions |
|----------|-----------|
| **Growth** | Revenue acceleration, Segment/geographic expansion, Forward guidance shift |
| **Profitability** | Margin inflection, Operating leverage, Free cash flow trajectory |
| **Competitive Position** | Market share movement, Pricing power signals, Customer concentration change |
| **Strategic** | R&D intensity shift, Capital allocation pivot, Management narrative change |

Each dimension produces a sub-score (0--100) with supporting evidence traced back to SEC filings or earnings call transcripts.

## Testing

```bash
pnpm test
```

Tests are run with [Vitest](https://vitest.dev/) across all packages.

## Cost Estimate

| Item | Cost |
|------|------|
| SEC EDGAR API | Free |
| FMP API (free tier) | Free (250 requests/day) |
| LLM analysis (Gemini 2.5 Pro via OpenRouter) | ~$0.02--$0.08 per company analysis |
| **Typical full batch (10 companies)** | **~$0.20--$0.80** |

## License

MIT
