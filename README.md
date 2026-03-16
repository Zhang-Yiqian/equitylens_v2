# EquityLens v2

**AI Industry Chain Investment Research Platform**

A personal investment research tool that combines structured financial data analysis with AI-powered insights. Built for swing trading decisions in the US AI industry chain (3-month to 1-year horizon).

> ⚠️ **Project Status**: MVP completed in March 2026. This is an active side project for learning and personal use — not a production commercial product.

---

## 🎯 What It Does

Analyzes AI industry chain companies through a multi-dimensional framework:

| Layer | Companies | Focus |
|-------|-----------|-------|
| **AI Application** | APP, PLTR, CRWD | AI-powered software platforms |
| **AI Energy & Infrastructure** | CEG, VST, ASTS | Data center power, satellite communications |
| **Optical Communications** | LITE, CIEN | Data center interconnect |
| **Hardware & Storage** | WDC, MU | Enterprise storage, HBM memory |

Each company is evaluated across **8 analytical dimensions** using a three-perspective framework (Personal / Buffett / Munger), producing a structured verdict: **Buy / Watch / Avoid**.

---

## 🏗️ Architecture

```
equitylens-v2/
├── apps/
│   ├── cli/           # Command-line analysis engine
│   └── web/           # Next.js 14 dashboard (port 3001)
├── packages/
│   ├── core/          # Types, constants, tickers
│   ├── store/         # SQLite + Drizzle ORM persistence
│   ├── data/          # SEC EDGAR, Yahoo Finance, 10-K fetchers
│   ├── engine/        # LLM prompts, cross-validation parser
│   └── report/        # Markdown report generation
```

### Tech Stack

- **Runtime**: Node.js 20+, TypeScript 5.x (strict mode)
- **Build**: pnpm workspaces + Turborepo + tsup
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **LLM**: OpenRouter API (Gemini 2.5 Pro / Claude Opus)
- **Web**: Next.js 14 App Router, React 18, Tailwind CSS, shadcn/ui, Recharts

---

## 📊 Data Sources (Hard Truth Rule)

| Data Type | Source | Principle |
|-----------|--------|-----------|
| Financials | SEC EDGAR XBRL | Authoritative — all key fields trace back to official filings |
| Pricing | Yahoo Finance | EOD data sufficient for medium-term strategy |
| News | Yahoo Finance | Supplementary context |
| 10-K Text | SEC EDGAR | Item 1 + Item 1A sections for qualitative analysis |

**No fabricated data** — if a field is unavailable, the system displays "缺失" (missing) rather than guessing.

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start the web dashboard
pnpm dev --filter=@equitylens/web
# → http://localhost:3001
```

### CLI Usage

```bash
# List all tracked companies
node apps/cli/dist/index.js list

# Full analysis (fetch data → LLM analysis → generate report)
node apps/cli/dist/index.js analyze PLTR

# Batch analysis all 10 companies
node apps/cli/dist/index.js batch
```

### Environment Variables

```bash
# Copy example
cp .env.example .env

# Required keys:
OPENROUTER_API_KEY=sk-or-v1-...   # LLM routing (openrouter.ai)
SEC_EDGAR_USER_AGENT="YourName your@email.com"  # SEC requirement
```

---

## 🔬 Analysis Framework

### 8-Dimension Cross-Validation

| Category | Dimensions |
|----------|-----------|
| **A. Competitive Landscape** | A1: Market structure, A2: Moat strength |
| **B. Financial Signals** | B1: Revenue growth trajectory, B2: Margin evolution, B3: Cash flow health |
| **C. News & Events** | C1: Management signals, C2: Product launches, C3: Regulatory/competitive events |

### Three-Perspective Scoring

Each analysis produces three independent scores:

- **Personal** — AI industry lens (growth, leadership, ecosystem)
- **Buffett** — Moat and financial quality
- **Munger** — Simplicity, long-term durability

**Composite Score**: `total = you*w1 + buffett*w2 + munger*w3` (default weights: 1:1:1)

### Evidence Validation

Every claim from the LLM is cross-validated against source documents:

- Financial claims → SEC XBRL facts
- Business description → 10-K Item 1
- Risk factors → 10-K Item 1A
- Recent events → News articles

---

## 📈 Current Results

Latest batch analysis (FY2024 Q4, March 2026):

| Company | Verdict | Key Catalyst |
|---------|---------|--------------|
| VST | **Buy** | Data center power demand |
| WDC | **Buy** | AI storage tailwinds |
| MU | **Buy** | HBM memory supercycle |
| APP | **Buy** | AI ad platform growth |
| CIEN | **Buy** | Optical network upgrade |
| PLTR | Watch | Commercial expansion |
| CRWD | Watch | AI security platform |
| CEG | Watch | Nuclear power growth |
| ASTS | Watch | Satellite connectivity |
| LITE | Watch | 800G optical demand |

---

## 🛤️ Roadmap

This is a personal learning project. Below is my planned iteration path:

### Phase 1 (Done ✅)
- [x] CLI with financial data fetching
- [x] SEC EDGAR integration (XBRL)
- [x] 12-dimension inflection analysis
- [x] Basic Markdown reports

### Phase 2 (Done ✅ — Current)
- [x] Web dashboard (Next.js)
- [x] 8-dimension cross-validation framework
- [x] 10-K text analysis
- [x] News sentiment integration
- [x] SQLite persistence

### Phase 3 (Planned)
- [ ] Real-time pricing integration (Tiingo API)
- [ ] Industry chain visualization (node graph)
- [ ] Watchlist with price alerts
- [ ] Prompt version comparison

### Phase 4 (Future)
- [ ] Automated weekly scan
- [ ] Multi-LLM comparison
- [ ] Backtesting framework
- [ ] iOS/Android companion app

---

## 💡 Why This Matters to Me

I'm building EquityLens to:

1. **Learn by building** — Hands-on experience with full-stack AI application development
2. **Apply investment research** — Systematic approach to analyzing AI industry chains
3. **Demonstrate engineering skills** — TypeScript, system design, data pipeline, LLMs

This project showcases:
- **System design** — Monorepo architecture, data pipeline, caching strategy
- **LLM integration** — Prompt engineering, response parsing, hallucination prevention
- **Full-stack development** — Next.js, SQLite, API design
- **Code quality** — TypeScript strict mode, Vitest testing, Drizzle ORM type safety

---

## 📄 License

MIT — Personal project, not for commercial use.

---

## 🙏 Acknowledgments

- [SEC EDGAR](https://www.sec.gov/edgar/searchedgar/companysearch) for authoritative financial data
- [OpenRouter](https://openrouter.ai/) for LLM API abstraction
- [Yahoo Finance](https://finance.yahoo.com/) for pricing and news
- Reference: [daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) for data sourcing patterns
