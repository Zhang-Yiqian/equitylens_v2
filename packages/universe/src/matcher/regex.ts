import { AI_KEYWORD_CONFIG } from '../config/ai-keywords.js';
import type { L2MatchResult, L2MatchSource, NasdaqMarket } from '@equitylens/core';
import { fetchCompanyDescriptionsBatch } from '../fetcher/company-description.js';
import { isBlacklisted } from './blacklist.js';

interface NasdaRow {
  symbol: string;
  companyName: string;
  market: NasdaqMarket | null;
  source: string;
}

export { isBlacklisted as blacklistRows } from './blacklist.js';

// ── Keyword pattern builder ───────────────────────────────────────────────────
//
// Two-tier matching strategy:
//   1. Single-word keywords (e.g. "AI", "GPU", "LLM", "AGI") — matched
//      CASE-SENSITIVELY with \b word boundaries. Original case is preserved
//      from the config so "AI" only matches uppercase "AI" (not "maintain").
//   2. Multi-word phrases (e.g. "AI accelerator", "generative AI") — the
//      spaces act as natural word boundaries; case-insensitive substring match.
//
function buildKeywordPatterns() {
  const categoryMap = new Map<string, string>();

  // Track original-case keywords grouped by single/multi word
  const singleWordOriginal: string[] = [];   // original case for regex
  const multiWordOriginal: string[] = [];    // original case for regex

  for (const [catKey, cat] of Object.entries<{ label: string; keywords: string[] }>(AI_KEYWORD_CONFIG.categories)) {
    for (const kw of cat.keywords) {
      // Map lowercased → category for lookups
      categoryMap.set(kw.toLowerCase(), catKey);

      // Track original case for regex patterns
      if (kw.includes(' ')) {
        if (!multiWordOriginal.includes(kw)) multiWordOriginal.push(kw);
      } else {
        if (!singleWordOriginal.includes(kw)) singleWordOriginal.push(kw);
      }
    }
  }

  // Single-word: use ORIGINAL case, \b-wrapped, case-SENSITIVE
  // Use non-capturing group (?:...) so \b applies to ALL alternatives, not just the last.
  // \b(?:AI|GPU|HBM)\b matches "AI" in "... AI platform" but NOT "maintain" or "TailwindAI".
  const singlePart = singleWordOriginal.map(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped;
  });
  const sensitivePat = singlePart.length > 0
    ? new RegExp(`\\b(?:${singlePart.join('|')})\\b`, 'g')
    : null;

  // Multi-word: original case, case-INSENSITIVE (no \b needed — spaces protect)
  // BUT: multi-word phrases that START with a single-word acronym (e.g. "AI platform")
  // should NOT be matched by the single-word sensitive pattern if the acronym is
  // already captured there. The sensitive pattern above handles "AI" separately.
  const multiPart = multiWordOriginal.map(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped;
  });
  const insensitivePat = multiPart.length > 0
    ? new RegExp(multiPart.join('|'), 'gi')
    : null;

  return { sensitivePat, insensitivePat, categoryMap };
}

const _patterns = buildKeywordPatterns();
const KEYWORD_SENSITIVE_PAT: RegExp | null = _patterns.sensitivePat;
const KEYWORD_INSENSITIVE_PAT: RegExp | null = _patterns.insensitivePat;
const CATEGORY_MAP = _patterns.categoryMap;

// ── Snippet helpers ─────────────────────────────────────────────────────────

const SNIPPET_CONTEXT = 80;

function extractSnippet(text: string, keyword: string): string {
  // Keyword from match[0] may be uppercase (case-sensitive regex).
  // Search case-insensitively in the source text so we always find a hit.
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return '';

  const start = Math.max(0, idx - SNIPPET_CONTEXT);
  const end = Math.min(text.length, idx + keyword.length + SNIPPET_CONTEXT);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}

function buildDescriptionSnippet(text: string, keywords: string[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const kw of keywords) {
    const s = extractSnippet(text, kw);
    if (s && !seen.has(s)) {
      seen.add(s);
      parts.push(s);
    }
  }

  const combined = parts.join(' | ');
  return combined.length > 400 ? combined.slice(0, 400) + '…' : combined;
}

// ── Core matching ───────────────────────────────────────────────────────────

/**
 * Match a single company's description against AI keywords.
 * Returns null if no keywords matched.
 */
export function matchDescription(
  symbol: string,
  companyName: string,
  description: string,
): L2MatchResult | null {
  const matchedKeywords = new Set<string>();
  const matchedCategories = new Set<string>();

  // Pattern 1: single-word acronyms, case-SENSITIVE, \b-wrapped
  // e.g. "AI", "GPU", "LLM" — only matches uppercase variants in text
  let match: RegExpExecArray | null;
  if (KEYWORD_SENSITIVE_PAT) {
    KEYWORD_SENSITIVE_PAT.lastIndex = 0;
    while ((match = KEYWORD_SENSITIVE_PAT.exec(description)) !== null) {
      const kwLower = match[0].toLowerCase();
      matchedKeywords.add(match[0]);
      const cat = CATEGORY_MAP.get(kwLower);
      if (cat) matchedCategories.add(cat);
    }
  }

  // Pattern 2: multi-word phrases, case-INSENSITIVE, no \b needed
  // e.g. "generative AI", "AI accelerator" — spaces act as natural boundaries
  if (KEYWORD_INSENSITIVE_PAT) {
    KEYWORD_INSENSITIVE_PAT.lastIndex = 0;
    while ((match = KEYWORD_INSENSITIVE_PAT.exec(description)) !== null) {
      const kwLower = match[0].toLowerCase();
      matchedKeywords.add(match[0]);
      const cat = CATEGORY_MAP.get(kwLower);
      if (cat) matchedCategories.add(cat);
    }
  }

  if (matchedKeywords.size === 0) return null;

  return {
    ticker: symbol,
    companyName,
    matchedKeywords: [...matchedKeywords],
    matchedCategories: [...matchedCategories],
    combinedText: `${symbol} ${companyName}`,
    market: null,
    matchedSource: 'description' as L2MatchSource,
    descriptionSnippet: buildDescriptionSnippet(description, [...matchedKeywords]),
  };
}

/**
 * L2: Async description-based keyword matching.
 *
 * Strategy:
 * 1. Apply L2 blacklist (company name patterns) — skip SEC calls for obvious non-operating entities
 * 2. For remaining rows: fetch 10-K Item 1 descriptions (cache-first, rate-limited)
 * 3. Match AI keywords in the description text
 * 4. Return only companies with matching keywords
 *
 * Note: whitelist entries should be added separately in scan.ts
 * (they bypass L2 and go directly to L3).
 */
export async function runL2Matching(
  rows: NasdaRow[],
  options?: {
    signal?: AbortSignal;
    verbose?: boolean;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<L2MatchResult[]> {
  const { signal, verbose, onProgress } = options ?? {};

  if (rows.length === 0) return [];

  // Step 1: Filter out blacklisted company names BEFORE any SEC calls
  const filteredRows = rows.filter(r => !isBlacklisted(r.companyName));
  const skippedByBlacklist = rows.length - filteredRows.length;

  if (verbose) {
    if (skippedByBlacklist > 0) {
      console.log(`  🚫 Blacklist filtered: ${skippedByBlacklist} tickers skipped (non-operating entities)`);
    }
    console.log(`  📄 Fetching 10-K descriptions for ${filteredRows.length} tickers…`);
  }

  if (filteredRows.length === 0) return [];

  // Build ticker → row lookup
  const tickerToRow = new Map(filteredRows.map(r => [r.symbol, r]));

  // Step 2: Fetch descriptions (cache-first, rate-limited)
  // Cache hits → no SEC call. Cache misses → fetch from SEC and write to DB.
  const descriptions = await fetchCompanyDescriptionsBatch(
    filteredRows.map(r => r.symbol),
    { signal, verbose, onProgress },
  );

  // Step 3: Match keywords in fetched descriptions
  const results: L2MatchResult[] = [];

  for (const [ticker, desc] of descriptions.entries()) {
    if (!desc.item1Business) continue;

    const row = tickerToRow.get(ticker);
    if (!row) continue;

    const result = matchDescription(ticker, row.companyName, desc.item1Business);
    if (result) {
      result.market = row.market ?? null;
      results.push(result);
    }
  }

  return results;
}
