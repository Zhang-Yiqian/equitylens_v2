/**
 * Fetch company business descriptions for L2 enrichment.
 *
 * Strategy:
 * 1. Yahoo Finance `longBusinessSummary` (primary) — fast, reliable, no SEC rate limits
 * 2. Store in ten_k_cache.item1_business as the text source
 *
 * Yahoo Finance is the primary source because:
 * - No SEC EDGAR rate limits or TLS issues
 * - Typically < 200ms per ticker
 * - longBusinessSummary is 500-2000 chars of curated business description
 * - Covers ~95% of US-listed companies
 */

import { getTenKCache, upsertTenKCache } from '@equitylens/store';
import { YahooClient, fetchYahooDescription } from '@equitylens/data';

export interface CompanyDescription {
  ticker: string;
  item1Business: string | null;
  fetchedFrom: 'cache' | 'yahoo';
  fetchedAt: string;
}

let globalYahooClient: YahooClient | null = null;

function getYahooClient(): YahooClient {
  if (!globalYahooClient) {
    globalYahooClient = new YahooClient();
  }
  return globalYahooClient;
}

// Step 1: In-memory cache — avoids repeated SQLite lookups for same ticker in one scan
const memoryCache = new Map<string, CompanyDescription>();

/**
 * Fetch description for a single ticker.
 * Returns null if the description cannot be obtained.
 */
export async function fetchCompanyDescription(
  ticker: string,
  options?: { signal?: AbortSignal },
): Promise<CompanyDescription | null> {
  const { signal } = options ?? {};

  // 1. Check in-memory cache first (fastest, ~0.1ms)
  const mem = memoryCache.get(ticker);
  if (mem) return mem;

  // 2. Check SQLite cache
  const cached = getTenKCache(ticker);
  if (cached?.item1Business) {
    const result: CompanyDescription = {
      ticker,
      item1Business: cached.item1Business,
      fetchedFrom: 'cache',
      fetchedAt: cached.fetchedAt,
    };
    memoryCache.set(ticker, result);
    return result;
  }

  // 3. Fetch from Yahoo Finance
  try {
    if (signal?.aborted) return null;

    const client = getYahooClient();
    const desc = await fetchYahooDescription(client, ticker);

    if (!desc) return null;

    const fetchedAt = new Date().toISOString();
    const year = new Date().getFullYear();

    // 4. Save to SQLite + memory cache
    upsertTenKCache({
      ticker,
      year,
      filingType: 'description',
      item1Business: desc,
      filingDate: fetchedAt, // reuse field: stores the fetch date when using Yahoo source
      documentUrl: '',
      fetchedAt,
    });

    const result: CompanyDescription = {
      ticker,
      item1Business: desc,
      fetchedFrom: 'yahoo',
      fetchedAt,
    };
    memoryCache.set(ticker, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Fetch descriptions for multiple tickers with concurrency.
 * Cache hits → no Yahoo call. Cache misses → Yahoo Finance.
 */
export async function fetchCompanyDescriptionsBatch(
  tickers: string[],
  options?: {
    signal?: AbortSignal;
    concurrency?: number;
    verbose?: boolean;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<Map<string, CompanyDescription>> {
  const { signal, concurrency = 5, verbose, onProgress } = options ?? {};

  const results = new Map<string, CompanyDescription>();
  let lastBatchDone = Date.now();
  const minBatchInterval = 20; // ms — minimum breathing room for Yahoo Finance

  for (let i = 0; i < tickers.length; i += concurrency) {
    if (signal?.aborted) break;

    const batch = tickers.slice(i, i + concurrency);

    const settled = await Promise.allSettled(
      batch.map(ticker => fetchCompanyDescription(ticker, { signal })),
    );

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      if (result.status === 'fulfilled' && result.value) {
        results.set(batch[j], result.value);
      }
    }

    if (verbose) {
      onProgress?.(Math.min(i + concurrency, tickers.length), tickers.length);
    }

    // Dynamic interval: wait only if batch completed faster than minBatchInterval
    if (i + concurrency < tickers.length) {
      const elapsed = Date.now() - lastBatchDone;
      if (elapsed < minBatchInterval) {
        await new Promise(r => setTimeout(r, minBatchInterval - elapsed));
      }
      lastBatchDone = Date.now();
    }
  }

  if (verbose) {
    const fromCache = [...results.values()].filter(r => r.fetchedFrom === 'cache').length;
    const fromYahoo = [...results.values()].filter(r => r.fetchedFrom === 'yahoo').length;
    console.log(
      `  📄 Description fetch: ${results.size}/${tickers.length} got descriptions ` +
      `(cache: ${fromCache}, Yahoo: ${fromYahoo})`,
    );
  }

  return results;
}
