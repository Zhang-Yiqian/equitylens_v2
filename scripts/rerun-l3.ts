/**
 * Re-run L3 classification for ALL companies in universeCache using the CURRENT prompt.
 * Use this after updating l3-prompt.ts criteria.
 * Only touches companies that have L2 match data (l2Matched = 1).
 */
import 'dotenv/config';
import { getAllUniverseCache, getTenKCache, upsertUniverseCache } from '@equitylens/store';
import { classifyL3 } from '@equitylens/universe';
import type { L2MatchResult } from '@equitylens/core';

async function rerunL3(options: { onlyStatus?: string } = {}) {
  const { onlyStatus } = options;
  const cache = getAllUniverseCache();

  // Only re-classify companies that have L2 match data
  const l2Matched = cache.filter(e => e.l2Matched === 1);

  console.log(`\n🔬 L3 Full Re-run (using CURRENT prompt criteria)`);
  console.log(`   Total cached: ${cache.length} | L2-matched: ${l2Matched.length}`);

  // Build L2MatchResult objects
  const l2Results: L2MatchResult[] = [];
  let skippedNoDesc = 0;

  for (const entry of l2Matched) {
    // Optionally filter by current status
    if (onlyStatus && entry.aiStatus !== onlyStatus) continue;

    const desc = getTenKCache(entry.ticker);
    if (!desc?.item1Business) {
      console.log(`  ⏭ ${entry.ticker}: no 10-K description — skip`);
      skippedNoDesc++;
      continue;
    }

    let keywords: string[] = [];
    let categories: string[] = [];
    try {
      keywords = JSON.parse(entry.l2MatchedKeywords ?? '[]');
      categories = JSON.parse(entry.l2MatchedCategories ?? '[]');
    } catch {
      // ignore
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

  if (skippedNoDesc > 0) {
    console.log(`   (skipped ${skippedNoDesc} with no 10-K description)`);
  }

  console.log(`📋 Re-running L3 for ${l2Results.length} companies...\n`);

  const results = await classifyL3(l2Results, {
    verbose: true,
    onProgress: (done, total) => {
      process.stdout.write(`\r  Progress: ${done}/${total} `);
    },
  });

  console.log(`\n\n💾 Writing results to DB...`);
  let updated = 0;
  let apiFailed = 0;

  const statusCounts = { core: 0, adjacent: 0, non_core: 0, unknown: 0, api_failed: 0 };

  for (const r of results) {
    // Preserve non-L3 fields
    const orig = cache.find(e => e.ticker === r.ticker);
    upsertUniverseCache({
      ticker: r.ticker,
      companyName: orig?.companyName,
      source: orig?.source,
      market: orig?.market,
      l2Matched: 1,
      l2MatchedKeywords: orig?.l2MatchedKeywords,
      l2MatchedCategories: orig?.l2MatchedCategories,
      fetchedAt: new Date().toISOString(),
      aiStatus: r.aiStatus,
      supplyChainTag: r.supplyChainTag,
      l3Confidence: r.confidence,
      l3Reasoning: r.reasoning,
      l3Evidence: r.evidence,
      l3ApiFailed: r.l3ApiFailed ? 1 : 0,
      hardFilterPassed: orig?.hardFilterPassed,
      marketCap: orig?.marketCap,
      price: orig?.price,
      avgDollarVolume30d: orig?.avgDollarVolume30d,
      ttmRevenue: orig?.ttmRevenue,
      complianceChecked: orig?.complianceChecked,
      hasGoingConcern: orig?.hasGoingConcern,
      hasAuditorResignation: orig?.hasAuditorResignation,
    });

    if (r.l3ApiFailed) {
      apiFailed++;
    } else {
      updated++;
      statusCounts[r.aiStatus as keyof typeof statusCounts]++;
    }
  }

  console.log(`\n✅ Done. Updated: ${updated} | API failures: ${apiFailed}`);
  console.log(`   ├─ core:     ${statusCounts.core}`);
  console.log(`   ├─ adjacent: ${statusCounts.adjacent}`);
  console.log(`   ├─ non_core: ${statusCounts.non_core}`);
  console.log(`   └─ unknown:  ${statusCounts.unknown}`);

  if (apiFailed > 0) {
    console.log(`\n⚠️  ${apiFailed} tickers still have API failures. Run: npx tsx scripts/retry-l3.ts`);
  }
}

const onlyStatus = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : undefined;

if (onlyStatus && !['core', 'adjacent', 'non_core', 'unknown', 'api_failed'].includes(onlyStatus)) {
  console.error(`Invalid --only value: ${onlyStatus}`);
  console.error('Valid values: core, adjacent, non_core, unknown, api_failed');
  process.exit(1);
}

rerunL3({ onlyStatus }).catch(e => { console.error('Fatal:', e.message); process.exit(1); });
