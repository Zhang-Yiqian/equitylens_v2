import 'dotenv/config';
import { getAllUniverseCache, getTenKCache, upsertUniverseCache } from '@equitylens/store';
import { classifyL3 } from '@equitylens/universe';

async function retryFailedL3() {
  const cache = getAllUniverseCache();
  const failed = cache.filter(e => e.aiStatus === 'api_failed' || e.l3ApiFailed === 1);
  console.log(`🔄 Retrying L3 for ${failed.length} failed tickers...`);

  const l2Results = [];
  for (const entry of failed) {
    const desc = getTenKCache(entry.ticker);
    if (!desc?.item1Business) {
      console.log(`  ⏭ ${entry.ticker}: no description — skip`);
      continue;
    }
    const keywords = JSON.parse(entry.l2MatchedKeywords ?? '[]');
    const categories = JSON.parse(entry.l2MatchedCategories ?? '[]');
    l2Results.push({
      ticker: entry.ticker,
      companyName: entry.companyName,
      matchedKeywords: keywords,
      matchedCategories: categories,
      combinedText: `${entry.ticker} ${entry.companyName}`,
      market: (entry.market ?? null) as any,
      matchedSource: 'description' as const,
      descriptionSnippet: desc.item1Business.slice(0, 400),
    });
  }

  console.log(`📋 Re-running L3 for ${l2Results.length} tickers...`);
  const results = await classifyL3(l2Results, { verbose: true });

  console.log('\n💾 Writing results to DB...');
  let updated = 0;
  let stillFailed = 0;

  for (const r of results) {
    upsertUniverseCache({
      ticker: r.ticker,
      aiStatus: r.aiStatus,
      supplyChainTag: r.supplyChainTag,
      l3Confidence: r.confidence,
      l3Reasoning: r.reasoning,
      l3Evidence: r.evidence,
      l3ApiFailed: r.l3ApiFailed ? 1 : 0,
    });
    if (r.l3ApiFailed) stillFailed++;
    else updated++;
  }

  console.log(`\n✅ Done. Updated: ${updated} | Still failed: ${stillFailed}`);
}

retryFailedL3().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
