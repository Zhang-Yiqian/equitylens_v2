import type OpenAI from 'openai';
import type { FinancialSnapshot } from '@equitylens/core';
import { formatFinancialValue } from '@equitylens/core';
import { INFLECTION_PROMPT_V1 } from './prompt-templates/inflection-v1.js';

export function buildPromptMessages(
  current: FinancialSnapshot,
  historicalQuarters: FinancialSnapshot[] = [],
  annualSnapshots: FinancialSnapshot[] = [],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  messages.push({
    role: 'system',
    content: INFLECTION_PROMPT_V1.system,
  });

  let dataPayload = INFLECTION_PROMPT_V1.dataPayloadPrefix(
    current.ticker,
    current.year,
    current.quarter,
  );

  dataPayload += formatFinancialTable(current, historicalQuarters, annualSnapshots);

  messages.push({ role: 'user', content: dataPayload });
  messages.push({ role: 'user', content: INFLECTION_PROMPT_V1.trigger });

  return messages;
}

const FINANCIAL_FIELDS: Array<{ key: keyof FinancialSnapshot; label: string; isPct?: boolean }> = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'netIncome', label: 'Net Income' },
  { key: 'grossMargin', label: 'Gross Profit' },
  { key: 'grossMarginPct', label: 'Gross Margin %', isPct: true },
  { key: 'operatingCashFlow', label: 'Operating Cash Flow' },
  { key: 'freeCashFlow', label: 'Free Cash Flow' },
  { key: 'fcfMarginPct', label: 'FCF Margin %', isPct: true },
  { key: 'rdExpense', label: 'R&D Expense' },
  { key: 'eps', label: 'EPS (Diluted)' },
  { key: 'sharesOutstanding', label: 'Shares Outstanding' },
  { key: 'totalAssets', label: 'Total Assets' },
  { key: 'totalLiabilities', label: 'Total Liabilities' },
  { key: 'deferredRevenue', label: 'Deferred Revenue' },
  { key: 'rpo', label: 'RPO' },
  { key: 'marketCap', label: 'Market Cap' },
  { key: 'peRatio', label: 'P/E Ratio' },
];

function formatVal(val: number | null | undefined, isPct?: boolean): string {
  if (val === null || val === undefined) return 'N/A';
  return isPct ? `${val.toFixed(1)}%` : formatFinancialValue(val);
}

function formatPctChange(cur: number | null | undefined, prev: number | null | undefined): string {
  if (cur == null || prev == null || prev === 0) return 'N/A';
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/**
 * Renders two sections:
 * 1. Quarterly trend table — current quarter + up to 7 historical quarters (newest-first)
 * 2. Annual comparison table — annual snapshots with YoY change column
 */
export function formatFinancialTable(
  current: FinancialSnapshot,
  historicalQuarters: FinancialSnapshot[] = [],
  annualSnapshots: FinancialSnapshot[] = [],
): string {
  const parts: string[] = [];

  // ── Section 1: Quarterly trend ──────────────────────────────────────────────
  // Columns: current + historical quarters (newest first), capped at 8 total
  const quarters = [current, ...historicalQuarters].slice(0, 8);
  const qHeaders = quarters.map(q => `Q${q.quarter} ${q.year}`);

  const qSep = qHeaders.map(() => '--------');
  parts.push(`#### 季度财务趋势`);
  parts.push(`| Metric | ${qHeaders.join(' | ')} |`);
  parts.push(`|--------|${qSep.join('|')}|`);

  for (const { key, label, isPct } of FINANCIAL_FIELDS) {
    const cells = quarters.map(q => formatVal(q[key] as number | null, isPct));
    parts.push(`| ${label} | ${cells.join(' | ')} |`);
  }

  // ── Section 2: Annual comparison ────────────────────────────────────────────
  if (annualSnapshots.length > 0) {
    parts.push('');
    parts.push(`#### 年度财务对比`);

    const annuals = annualSnapshots.slice(0, 3); // cap at 3 years
    const aHeaders = annuals.map(a => `FY${a.year}`);
    const aSep = aHeaders.map(() => '--------');
    const hasYoY = annuals.length >= 2;

    const headerRow = hasYoY
      ? `| Metric | ${aHeaders.join(' | ')} | YoY Change (最新) |`
      : `| Metric | ${aHeaders.join(' | ')} |`;
    const sepRow = hasYoY
      ? `|--------|${aSep.join('|')}|------------------|`
      : `|--------|${aSep.join('|')}|`;

    parts.push(headerRow);
    parts.push(sepRow);

    for (const { key, label, isPct } of FINANCIAL_FIELDS) {
      const cells = annuals.map(a => formatVal(a[key] as number | null, isPct));
      if (hasYoY) {
        const yoy = formatPctChange(
          annuals[0][key] as number | null,
          annuals[1][key] as number | null,
        );
        parts.push(`| ${label} | ${cells.join(' | ')} | ${yoy} |`);
      } else {
        parts.push(`| ${label} | ${cells.join(' | ')} |`);
      }
    }
  }

  return parts.join('\n');
}
