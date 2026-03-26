/**
 * Retry L3 classification for tickers that previously failed with api_failed.
 * Uses the same ESM loader path as the CLI.
 * Run: node scripts/retry-l3.mjs
 */

import { resolve, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Load .env manually (pnpm virtual store path is fragile to import directly)
try {
  const envPath = resolve(rootDir, '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch (_) {}

const { getAllUniverseCache, getTenKCache, upsertUniverseCache } = await import(
  resolve(rootDir, 'packages/store/dist/index.js')
);
const { classifyL3 } = await import(
  resolve(rootDir, 'packages/universe/dist/index.js')
);

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
    let keywords = [];
    let categories = [];
    try {
      keywords = JSON.parse(entry.l2MatchedKeywords ?? '[]');
      categories = JSON.parse(entry.l2MatchedCategories ?? '[]');
    } catch (_) {}
    l2Results.push({
      ticker: entry.ticker,
      companyName: entry.companyName,
      matchedKeywords: keywords,
      matchedCategories: categories,
      combinedText: `${entry.ticker} ${entry.companyName}`,
      market: entry.market ?? null,
      matchedSource: 'description',
      descriptionSnippet: desc.item1Business.slice(0, 400),
    });
  }

  console.log(`📋 Re-running L3 for ${l2Results.length} tickers...`);
  const results = await classifyL3(l2Results, { verbose: true });

  console.log('\n💾 Writing results to DB...');
  let updated = 0;
  let stillFailed = 0;

  for (const r of results) {
    const orig = cache.find(e => e.ticker === r.ticker);
    // Preserve all existing fields, only update L3 columns
    upsertUniverseCache({
      ...orig,
      ticker: r.ticker,
      companyName: orig?.companyName ?? r.companyName ?? 'Unknown',
      source: orig?.source ?? 'nasdaq_listed',
      fetchedAt: new Date().toISOString(),
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
