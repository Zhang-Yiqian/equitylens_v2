# CLAUDE.md

Coding conventions and rules for Claude Code when working in this repository.

---

## Build & Run

```bash
# Build all packages (respects Turborepo dependency order)
pnpm build

# Build a single package
pnpm --filter @equitylens/cli build

# Run CLI (always from repo root after build)
node apps/cli/dist/index.js fetch MU --period 2025Q1

# Run tests
pnpm test

# Start web dashboard
pnpm dev --filter=@equitylens/web
```

After any code change, rebuild the affected package before running the CLI:
```bash
pnpm --filter @equitylens/cli build
```

---

## Code Style

- **TypeScript strict mode** — no `any`, no `!` non-null assertions unless unavoidable, always handle nullable types explicitly
- **ESM only** — all imports must use `.js` extension (e.g. `import { foo } from './bar.js'`)
- **`null` over `undefined`** for missing data fields — matches the SEC EDGAR / financial data convention used throughout
- **camelCase** for variables/functions, **PascalCase** for types/interfaces/classes, **SCREAMING_SNAKE_CASE** for top-level constants
- No barrel re-exports that cause circular dependencies — import directly from the source file if needed
- Prefer `interface` over `type` for object shapes; use `type` for unions, aliases, and utility types

---

## Architecture Rules

### Package Boundaries
- `packages/core` — types and constants only, no runtime dependencies, no I/O
- `packages/data` — all external API calls (SEC EDGAR, Yahoo Finance); never import from `packages/store` or `packages/engine`
- `packages/store` — SQLite persistence only; no business logic, no external calls
- `packages/harness` — pipeline primitives only; no domain knowledge about equities
- `apps/cli` — orchestration only; delegates to packages, contains no business logic itself

### Harness Pattern
New data pipeline modules must follow the Generator-Evaluator pattern in `packages/harness/`:
- Implement `ModuleGenerator<T>` and `Evaluator<T, M>`
- Register via `HarnessOrchestrator.register(manifest)`
- Pass data between modules via `ArtifactStore`, never via direct imports
- P0 field failures must throw immediately — no silent null propagation

### Hard Truth Rule
Financial fields (revenue, net income, gross margin, OCF, FCF, R&D, share count) must trace back to **SEC EDGAR XBRL**. If a value is unavailable, use `null` and display `缺失` in the UI. Never fabricate or estimate a missing value.

---

## Database

- Schema lives in `packages/store/src/schema.ts` (Drizzle ORM)
- New columns must be added to **both** the Drizzle schema **and** the `newSnapCols` migration array in `packages/store/src/db.ts` — missing this causes silent column drops
- Never run raw SQL strings with user-provided input — use Drizzle's query builder

---

## Error Handling

- Use typed error classes from `packages/data/src/errors/` for fetch failures
- Throw at the boundary (data layer), catch and log at the orchestration layer (CLI commands)
- Never swallow errors with empty `catch` blocks
- Retryable errors must set `isRetryable: true` — the harness runner uses this flag

---

## SEC EDGAR / XBRL Gotchas

- **Non-calendar fiscal years**: companies like MU (Micron, August FY) store Q1–Q3 of calendar year N under `fy=N+1`. Use the `fy ± 1` fallback in `extractValue` and `matchCalendarQuarter` — only as a fallback when exact match returns nothing
- **Missing concepts**: some XBRL concepts (e.g. `InterestExpense`, `CostOfRevenue`) may have no entries for a given period — skip these in the evaluator rather than flagging as errors
- **`freeCashFlow`** is a computed field, not a raw XBRL concept — exclude it from source consistency checks

---

## What Not to Do (v1 Scope)

- No Feishu / messaging push notifications
- No automated trading or order placement
- No intraday / minute-level price data
- No multi-user or SaaS features
