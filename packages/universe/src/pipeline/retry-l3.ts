/**
 * Retry L3 classification for tickers that previously failed with api_failed.
 * Reconstructs L2MatchResult objects from DB cache + ten_k_cache, then re-runs L3.
 */

import { getAllUniverseCache, getTenKCache, upsertUniverseCache } from '@equitylens/store';
import { classifyL3 } from '../classifier/batch.js';
import type { L2MatchResult, L3Classification } from '@equitylens/core';

export interface RetryResult {
  updated: number;
  stillFailed: number;
  errors: string[];
}

/**
 * Retry L3 classification for all tickers with aiStatus = 'api_failed'.
 * Only touches existing DB entries — no new tickers are added.
 */
export async function retryFailedL3(options?: {
  verbose?: boolean;
}): Promise<RetryResult> {
  const { verbose = false } = options ?? {};
  const errors: string[] = [];

  const cache = getAllUniverseCache();
  const failed = cache.filter(
    e => e.aiStatus === 'api_failed' || e.l3ApiFailed === 1
  );

  if (verbose) {
    console.log(`🔄 L3 Retry: found ${failed.length} failed tickers`);
  }

  // Reconstruct L2MatchResult for each failed ticker from DB cache
  const l2Results: L2MatchResult[] = [];

  for (const entry of failed) {
    const desc = getTenKCache(entry.ticker);
    if (!desc?.item1Business) {
      if (verbose) console.log(`  ⏭ ${entry.ticker}: no description in ten_k_cache — skip`);
      continue;
    }

    let keywords: string[] = [];
    let categories: string[] = [];
    try {
      keywords = JSON.parse(entry.l2MatchedKeywords ?? '[]');
      categories = JSON.parse(entry.l2MatchedCategories ?? '[]');
    } catch {
      // ignore parse errors
    }

    l2Results.push({
      ticker: entry.ticker,
      companyName: entry.companyName,
      matchedKeywords: keywords,
      matchedCategories: categories,
      combinedText: `${entry.ticker} ${entry.companyName}`,
      market: (entry.market ?? null) as L2MatchResult['market'],
      matchedSource: 'description',
      descriptionSnippet: desc.item1Business.slice(0, 400),
    });
  }

  if (verbose) {
    console.log(`📋 Re-running L3 for ${l2Results.length} tickers...`);
  }

  let updated = 0;
  let stillFailed = 0;

  if (l2Results.length > 0) {
    try {
      const results = await classifyL3(l2Results, {
        verbose,
        onProgress: (done, total) => {
          if (verbose) process.stdout.write(`\r  Progress: ${done}/${total} `);
        },
      });

      if (verbose) console.log();

      for (const r of results) {
        const orig = failed.find(e => e.ticker === r.ticker);
        if (!orig) continue;
        upsertUniverseCache({
          ticker: r.ticker,
          companyName: orig.companyName,
          source: orig.source,
          fetchedAt: new Date().toISOString(),
          aiStatus: r.aiStatus,
          supplyChainTag: r.supplyChainTag,
          l3Confidence: r.confidence,
          l3Reasoning: r.reasoning,
          l3Evidence: r.evidence,
          l3ApiFailed: r.l3ApiFailed ? 1 : 0,
        });

        if (r.l3ApiFailed) {
          stillFailed++;
        } else {
          updated++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
    }
  }

  return { updated, stillFailed, errors };
}
