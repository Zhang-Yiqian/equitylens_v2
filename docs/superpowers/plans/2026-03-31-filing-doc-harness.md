# Filing Document Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix history fetch to capture the correct 10-K/10-Q original filing text for each period (year+quarter), and add a harness FilingSectionEvaluator to verify key section coverage.

**Architecture:** Three core changes: (1) DB schema adds `quarter` to `ten_k_cache`; (2) filing finder gets per-period lookup; (3) evaluator validates key section coverage. No new harness module needed — FilingSectionEvaluator runs alongside existing DeterministicSnapshotEvaluator.

**Tech Stack:** TypeScript, Drizzle ORM, SEC EDGAR API, existing harness primitives

---

## File Map

| File | Action |
|---|---|
| `packages/store/src/schema.ts` | Modify: add `quarter` column + update unique index |
| `packages/store/src/db.ts` | Modify: add migration for `quarter` column |
| `packages/data/src/sec-edgar/filing-index.ts` | Modify: add `find10QByPeriod(cik, year, quarter)` |
| `packages/data/src/sec-edgar/ten-k-fetcher.ts` | Modify: add `fetch10KByPeriod`, `fetch10QByPeriod` |
| `packages/harness/src/evaluator/filing-section.ts` | **Create**: FilingSectionEvaluator |
| `packages/harness/src/index.ts` | Modify: export FilingSectionEvaluator |
| `apps/cli/src/commands/fetch.ts` | Modify: call filing section per period in history loop |

---

## Task 1: Add `quarter` column to `ten_k_cache` schema

**Files:**
- Modify: `packages/store/src/schema.ts:15-47`
- Modify: `packages/store/src/db.ts`

**Steps:**

- [ ] **Step 1: Add `quarter` column to schema**

In `tenKCache` table in `schema.ts`, add `quarter: integer('quarter').notNull().default(0)` to the column list (after `year`). Also update the unique index from `.on(table.ticker, table.filingType, table.year)` to `.on(table.ticker, table.filingType, table.year, table.quarter)`.

```typescript
// In schema.ts, tenKCache columns section, after 'year':
quarter: integer('quarter').notNull().default(0), // 0=annual(10-K), 1-4=quarterly(10-Q)
```

And update the unique index:
```typescript
// Change from:
uniqueIndex('uq_ten_k_cache_ticker_type_year').on(table.ticker, table.filingType, table.year),
// To:
uniqueIndex('uq_ten_k_cache_ticker_type_year_quarter').on(table.ticker, table.filingType, table.year, table.quarter),
```

- [ ] **Step 2: Add migration in db.ts**

Read `packages/store/src/db.ts` to find the `initTables()` function and the `newSnapCols` array. Add `['quarter', 'INTEGER DEFAULT 0']` to the columns list, and add the unique index creation.

```typescript
// In the ALTER TABLE ADD COLUMN section, add after year column:
// quarter column
if (!colExists(tableMeta, 'quarter')) {
  await db.run(sql`ALTER TABLE ten_k_cache ADD COLUMN quarter INTEGER DEFAULT 0`);
}
```

- [ ] **Step 3: Verify and commit**

```bash
cd /Users/zhangyiqian/Documents/code/equitylens_v2
pnpm --filter @equitylens/store build
git add packages/store/src/schema.ts packages/store/src/db.ts
git commit -m "feat(store): add quarter column to ten_k_cache schema"
```

---

## Task 2: Add `find10QByPeriod` to filing-index.ts

**Files:**
- Modify: `packages/data/src/sec-edgar/filing-index.ts`

**Steps:**

- [ ] **Step 1: Add `find10QByPeriod` function**

Add a new exported function that finds a specific 10-Q by year+quarter. It fetches the Submissions API once, then filters for `form === '10-Q'` entries where the filing date falls within the calendar quarter range.

```typescript
/**
 * Find a 10-Q filing for a specific year and quarter by CIK.
 * Returns null if no matching 10-Q found in the Submissions API recent filings.
 * Filing date must fall within the calendar quarter:
 *   Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
 */
export async function find10QByPeriod(
  client: SecEdgarClient,
  cik: string,
  year: number,
  quarter: number,
): Promise<FilingInfo | null> {
  const paddedCik = cik.padStart(10, '0');
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  let submissions: SubmissionsResponse;
  try {
    submissions = await client.fetch<SubmissionsResponse>(submissionsUrl);
  } catch {
    return null;
  }

  const recent = submissions?.filings?.recent;
  if (!recent) return null;

  const { accessionNumber, filingDate, form, primaryDocument } = recent;

  // Calendar quarter date ranges
  const quarterRanges: Record<number, [string, string]> = {
    1: [`${year}-01-01`, `${year}-04-01`],
    2: [`${year}-04-01`, `${year}-07-01`],
    3: [`${year}-07-01`, `${year}-10-01`],
    4: [`${year}-10-01`, `${String(year + 1)}-01-01`],
  };

  const [qStart, qEnd] = quarterRanges[quarter] ?? ['', ''];

  for (let i = 0; i < form.length; i++) {
    const formType = form[i];
    if (formType !== '10-Q' && formType !== '10-Q405') continue;

    const fDate = filingDate[i];
    if (fDate < qStart || fDate >= qEnd) continue;

    const rawAccession = accessionNumber[i];
    const cleanAccession = rawAccession.replace(/-/g, '');
    const docName = primaryDocument[i];
    const documentUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${cleanAccession}/${docName}`;

    return {
      accessionNumber: rawAccession,
      filingDate: fDate,
      documentUrl,
      cik,
    };
  }

  return null;
}

/**
 * High-level: ticker → CIK → 10-Q by period
 */
export async function find10QByPeriodByTicker(
  client: SecEdgarClient,
  ticker: string,
  year: number,
  quarter: number,
): Promise<FilingInfo | null> {
  const cik = await lookupCik(client, ticker);
  if (!cik) return null;
  return find10QByPeriod(client, cik, year, quarter);
}
```

- [ ] **Step 2: Also add `find10KByPeriod` for completeness**

Also add a `find10KByPeriod(client, cik, year)` that finds the 10-K whose filing date falls in calendar year `year` (since 10-K is always filed in the calendar year following the fiscal year end). This makes the API consistent.

```typescript
/**
 * Find a 10-K filing for a specific calendar year by CIK.
 * Returns the 10-K filed in calendar year `year` (i.e., covering FY year-1).
 */
export async function find10KByPeriod(
  client: SecEdgarClient,
  cik: string,
  year: number,
): Promise<FilingInfo | null> {
  const paddedCik = cik.padStart(10, '0');
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  let submissions: SubmissionsResponse;
  try {
    submissions = await client.fetch<SubmissionsResponse>(submissionsUrl);
  } catch {
    return null;
  }

  const recent = submissions?.filings?.recent;
  if (!recent) return null;

  const { accessionNumber, filingDate, form, primaryDocument } = recent;

  for (let i = 0; i < form.length; i++) {
    const formType = form[i];
    if (formType !== '10-K' && formType !== '10-K405') continue;

    const fDate = filingDate[i];
    const fYear = fDate.slice(0, 4);
    if (fYear !== String(year)) continue;

    const rawAccession = accessionNumber[i];
    const cleanAccession = rawAccession.replace(/-/g, '');
    const docName = primaryDocument[i];
    const documentUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${cleanAccession}/${docName}`;

    return {
      accessionNumber: rawAccession,
      filingDate: fDate,
      documentUrl,
      cik,
    };
  }

  return null;
}

export async function find10KByPeriodByTicker(
  client: SecEdgarClient,
  ticker: string,
  year: number,
): Promise<FilingInfo | null> {
  const cik = await lookupCik(client, ticker);
  if (!cik) return null;
  return find10KByPeriod(client, cik, year);
}
```

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter @equitylens/data build
git add packages/data/src/sec-edgar/filing-index.ts
git commit -m "feat(sec-edgar): add find10QByPeriod and find10KByPeriod"
```

---

## Task 3: Add `fetch10KByPeriod` and `fetch10QByPeriod` to ten-k-fetcher.ts

**Files:**
- Modify: `packages/data/src/sec-edgar/ten-k-fetcher.ts`
- Modify: `packages/data/src/index.ts` (export new functions)

**Steps:**

- [ ] **Step 1: Add period-specific fetch functions**

Add these two new exported functions to `ten-k-fetcher.ts`:

```typescript
/**
 * Fetch 10-K sections for a specific filing year.
 * Uses find10KByPeriod to locate the correct filing.
 */
export async function fetch10KByPeriod(
  client: SecEdgarClient,
  ticker: string,
  year: number,
): Promise<FilingSections | null> {
  const cik = await lookupCik(client, ticker);
  if (!cik) {
    console.warn(`[fetch10KByPeriod] CIK not found for ticker: ${ticker}`);
    return null;
  }

  const filing = await find10KByPeriod(client, cik, year);
  if (!filing) {
    console.warn(`[fetch10KByPeriod] No 10-K filing found for ${ticker} in calendar year ${year}`);
    return null;
  }

  const filingYear = parseInt(filing.filingDate.slice(0, 4), 10);

  const sections = await extractFilingSections(
    client, ticker, '10-K',
    filing.filingDate, filing.documentUrl,
    filingYear, 0, // 0 = annual
  );

  return sections;
}

/**
 * Fetch 10-Q sections for a specific year and quarter.
 * Uses find10QByPeriod to locate the correct filing.
 */
export async function fetch10QByPeriod(
  client: SecEdgarClient,
  ticker: string,
  year: number,
  quarter: number,
): Promise<FilingSections | null> {
  const cik = await lookupCik(client, ticker);
  if (!cik) {
    console.warn(`[fetch10QByPeriod] CIK not found for ticker: ${ticker}`);
    return null;
  }

  const filing = await find10QByPeriod(client, cik, year, quarter);
  if (!filing) {
    console.warn(`[fetch10QByPeriod] No 10-Q filing found for ${ticker} FY${year} Q${quarter}`);
    return null;
  }

  const filingYear = parseInt(filing.filingDate.slice(0, 4), 10);
  // Infer quarter from filing date month as fallback
  const month = parseInt(filing.filingDate.slice(5, 7), 10);
  const inferredQ = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;

  const sections = await extractFilingSections(
    client, ticker, '10-Q',
    filing.filingDate, filing.documentUrl,
    filingYear, inferredQ,
  );

  return sections;
}
```

- [ ] **Step 2: Update index.ts exports**

In `packages/data/src/index.ts`, add exports for `fetch10KByPeriod` and `fetch10QByPeriod`.

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter @equitylens/data build
git add packages/data/src/sec-edgar/ten-k-fetcher.ts packages/data/src/index.ts
git commit -m "feat(data): add fetch10KByPeriod and fetch10QByPeriod"
```

---

## Task 4: Create FilingSectionEvaluator

**Files:**
- Create: `packages/harness/src/evaluator/filing-section.ts`

**Steps:**

- [ ] **Step 1: Write the evaluator**

Create the file with the FilingSectionEvaluator class:

```typescript
/**
 * Evaluator for SEC filing document sections (10-K / 10-Q text).
 *
 * P0 (hard fail): Missing key sections for the filing type
 *   - 10-K: item1Business + item7MdAndA
 *   - 10-Q: item1Financials + item2MdAndA
 * P1 (warnings): Missing non-critical sections
 *
 * Key design: Only checks for presence of text (non-null, non-empty).
 * Does NOT verify content quality or re-parse the raw HTML.
 */

import type { FilingSections } from '@equitylens/data';
import type { HarnessContext } from '../context/context.js';
import type { Evaluator } from '../runner/types.js';

export interface FilingSectionEvalMetadata {
  filingType: string;
  year: number;
  quarter: number;
  ticker: string;
  missingKeySections: string[];
  presentSections: string[];
  hasGuidance: boolean;
}

// Key sections per filing type
const KEY_SECTIONS_10K = ['item1Business', 'item7MdAndA'] as const;
const KEY_SECTIONS_10Q = ['item1Financials', 'item2MdAndA'] as const;

function isNonEmpty(val: string | null | undefined): boolean {
  return typeof val === 'string' && val.trim().length > 100;
}

function getKeySections(filingType: string): readonly string[] {
  if (filingType === '10-Q') return KEY_SECTIONS_10Q;
  return KEY_SECTIONS_10K; // default to 10-K
}

function getSectionLabel(field: string): string {
  const labels: Record<string, string> = {
    item1Business: 'Item 1 (Business)',
    item7MdAndA: 'Item 7 (MD&A)',
    item1Financials: 'Item 1 (Financial Statements)',
    item2MdAndA: 'Item 2 (MD&A)',
  };
  return labels[field] ?? field;
}

export class FilingSectionEvaluator implements Evaluator<FilingSections, FilingSectionEvalMetadata> {
  async evaluate(
    sections: FilingSections,
    _ctx: HarnessContext,
  ): Promise<{
    ok: boolean;
    canRetry: boolean;
    errors: string[];
    warnings: string[];
    metadata: FilingSectionEvalMetadata;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const filingType = sections.filingType ?? '10-K';
    const keySections = getKeySections(filingType);
    const missingKeySections: string[] = [];

    // P0 check: key sections must be non-empty
    for (const field of keySections) {
      const val = (sections as Record<string, unknown>)[field] as string | null | undefined;
      if (!isNonEmpty(val)) {
        const label = getSectionLabel(field);
        errors.push(`Missing key section: ${label}`);
        missingKeySections.push(field);
      }
    }

    // Collect all present sections for metadata
    const sectionFields = [
      'item1Business', 'item1ARiskFactors', 'item2Properties', 'item3Legal',
      'item4Mine', 'item5Market', 'item6SelectedFinData', 'item7MdAndA',
      'item7AFactors', 'item8Financials', 'item9Controls',
      'item1Financials', 'item2MdAndA', 'item3Defaults', 'item4Controls',
    ];
    const presentSections = sectionFields.filter(f =>
      isNonEmpty((sections as Record<string, unknown>)[f] as string | null | undefined),
    );

    // P1 warning: check if the filing was fetched at all
    if (sections.isRawFallback) {
      errors.push('Filing HTML fetch failed — raw fallback used');
    }

    // P1 warning: check for extracted guidance
    const hasGuidance = sections.extractedGuidance !== null
      && sections.extractedGuidance !== undefined;

    if (!hasGuidance && isNonEmpty(sections.item7MdAndA ?? sections.item2MdAndA)) {
      warnings.push('MD&A text present but no quantitative guidance extracted');
    }

    const ok = missingKeySections.length === 0 && errors.filter(
      e => !e.includes('raw fallback'),
    ).length === 0;

    return {
      ok,
      canRetry: sections.isRawFallback,
      errors,
      warnings,
      metadata: {
        filingType,
        year: sections.year,
        quarter: sections.quarter,
        ticker: sections.ticker,
        missingKeySections,
        presentSections,
        hasGuidance,
      },
    };
  }
}
```

- [ ] **Step 2: Export from harness index**

In `packages/harness/src/index.ts`, add:
```typescript
export { FilingSectionEvaluator, type FilingSectionEvalMetadata } from './evaluator/filing-section.js';
```

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter @equitylens/harness build
git add packages/harness/src/evaluator/filing-section.ts packages/harness/src/index.ts
git commit -m "feat(harness): add FilingSectionEvaluator for 10-K/10-Q section coverage"
```

---

## Task 5: Update fetch.ts history loop

**Files:**
- Modify: `apps/cli/src/commands/fetch.ts`

**Steps:**

- [ ] **Step 1: Fix the 10-Q period loop (the core bug)**

The current 10-Q fetching in `fetchFilingSections` (lines 400-446) ignores the year/quarter parameters. Fix it to use `fetch10QByPeriod` and pass year+quarter per iteration.

Replace the `recent10QYears` loop with this corrected version:

```typescript
// Fetch 10-Q for each period in the history
console.log('📜 Fetching 10-Q filing sections per period...');
let qFetched = 0;
for (const qy of recent10QYears) {
  for (const q of [1, 2, 3, 4] as const) {
    process.stdout.write(`  FY${qy} Q${q} 10-Q... `);
    try {
      // Use fetch10QByPeriod to get the CORRECT filing for this specific period
      const qSections = await fetch10QByPeriod(secClient, ticker, qy, q);
      if (qSections && qSections.filingDate) {
        const qFilingYear = parseInt(qSections.filingDate.slice(0, 4), 10);
        upsertTenKCache({
          ticker,
          filingType: '10-Q',
          year: qFilingYear,
          quarter: q, // Store the actual quarter
          filingDate: qSections.filingDate,
          documentUrl: qSections.documentUrl ?? '',
          // ... rest of fields unchanged ...
        });
        console.log(`✅ (${qSections.filingDate})`);
        qFetched++;
      } else {
        console.log('⚠️  no filing found');
      }
    } catch (err) {
      console.log(`⚠️  error: ${err instanceof Error ? err.message : err}`);
    }
    await new Promise(r => setTimeout(r, 250));
  }
}
```

Also add `quarter` to the upsertTenKCache call in the 10-K section and the existing 10-Q section.

- [ ] **Step 2: Also add per-period filing fetch in harness mode**

In the harness `--history` loop (around line 231), after each FinancialSnapshot is stored, also fetch the filing sections for that period. The filing section fetch should happen inside the history loop for each period.

```typescript
// Inside the history loop, after assembling financial data:
// Also fetch filing sections for this specific period
const filingType = quarter === 0 ? '10-K' : '10-Q';
try {
  if (quarter === 0) {
    const kSections = await fetch10KByPeriod(secClient, ticker, year);
    if (kSections) { /* upsertTenKCache */ }
  } else {
    const qSections = await fetch10QByPeriod(secClient, ticker, year, quarter);
    if (qSections) { /* upsertTenKCache with quarter */ }
  }
} catch { /* non-critical */ }
```

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter @equitylens/cli build
git add apps/cli/src/commands/fetch.ts
git commit -m "fix(fetch): fetch 10-K/10-Q filing sections per period and add quarter column"
```

---

## Task 6: Integration test with MU

**Steps:**

- [ ] **Step 1: Run history fetch for MU**

```bash
cd /Users/zhangyiqian/Documents/code/equitylens_v2/apps/cli
node dist/index.js fetch MU --history 2 --force-refresh --harness
```

Expected: Each FY/Q period should report "✅ (score=X, fields=Y)" AND the filing section fetch should log the correct filing date per period.

- [ ] **Step 2: Verify DB contents**

```bash
cd /Users/zhangyiqian/Documents/code/equitylens_v2/apps/cli
node dist/index.js fetch MU --all
```

Check that each period has the correct filing date and `quarter` column is populated.

- [ ] **Step 3: Commit if all passes**

```bash
git add -A
git commit -m "test: verify filing sections fetched per period for MU"
```

---

## Verification Checklist

After all tasks:
- [ ] `ten_k_cache` table has `quarter` column (0 for 10-K, 1-4 for 10-Q)
- [ ] `find10QByPeriod(ticker, year, quarter)` returns the correct filing
- [ ] History loop fetches 10-K/10-Q for each period (not just the latest)
- [ ] FilingSectionEvaluator fails if Item 1 + MD&A are missing
- [ ] MU 2-year history fetch completes with correct period-filing mapping
