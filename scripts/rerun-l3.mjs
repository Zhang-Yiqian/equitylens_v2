/**
 * Re-run L3 classification for ALL companies in universeCache using the CURRENT prompt.
 * Use this after updating l3-prompt.ts criteria.
 * Only touches companies that have L2 match data (l2Matched = 1).
 * Run: node scripts/rerun-l3.mjs
 */

import { resolve, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// ── Load .env manually (dotenv in pnpm store path is fragile) ─────────────────
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

// ── Imports from built packages ───────────────────────────────────────────────
const { getAllUniverseCache, getTenKCache, upsertUniverseCache } = await import(
  resolve(rootDir, 'packages/store/dist/index.js')
);
const { classifyL3 } = await import(
  resolve(rootDir, 'packages/universe/dist/index.js')
);

// ── Parse CLI args ─────────────────────────────────────────────────────────────
const onlyArgIdx = process.argv.indexOf('--only');
const onlyStatus = onlyArgIdx >= 0 ? process.argv[onlyArgIdx + 1] : undefined;

if (onlyStatus && !['core', 'adjacent', 'non_core', 'unknown', 'api_failed'].includes(onlyStatus)) {
  console.error(`Invalid --only value: ${onlyStatus}`);
  console.error('Valid values: core, adjacent, non_core, unknown, api_failed');
  process.exit(1);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function rerunL3() {
  const cache = getAllUniverseCache();

  // Only re-classify companies that have L2 match data
  const l2Matched = cache.filter(e => e.l2Matched === 1);

  console.log(`\n🔬 L3 Full Re-run (using CURRENT prompt criteria)`);
  console.log(`   Total cached: ${cache.length} | L2-matched: ${l2Matched.length}`);

  if (onlyStatus) {
    const filtered = l2Matched.filter(e => e.aiStatus === onlyStatus);
    console.log(`   Filtering to --only=${onlyStatus}: ${filtered.length} companies`);
  }

  // Build L2MatchResult objects
  const l2Results = [];
  let skippedNoDesc = 0;

  for (const entry of l2Matched) {
    if (onlyStatus && entry.aiStatus !== onlyStatus) continue;

    const desc = getTenKCache(entry.ticker);
    if (!desc?.item1Business) {
      skippedNoDesc++;
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

  if (skippedNoDesc > 0) {
    console.log(`   (skipped ${skippedNoDesc} with no 10-K description)`);
  }

  console.log(`\n📋 Re-running L3 for ${l2Results.length} companies...\n`);

  const results = await classifyL3(l2Results, {
    verbose: true,
    onProgress: (done, total) => {
      process.stdout.write(`\r  Progress: ${done}/${total} `);
    },
  });

  console.log(`\n\n💾 Writing results to DB...`);
  const statusCounts = { core: 0, adjacent: 0, non_core: 0, unknown: 0, api_failed: 0 };

  for (const r of results) {
    const orig = cache.find(e => e.ticker === r.ticker);
    upsertUniverseCache({
      ticker: r.ticker,
      companyName: orig?.companyName ?? r.companyName ?? 'Unknown',
      source: orig?.source ?? null,
      market: orig?.market ?? null,
      l2Matched: 1,
      l2MatchedKeywords: orig?.l2MatchedKeywords ?? null,
      l2MatchedCategories: orig?.l2MatchedCategories ?? null,
      fetchedAt: new Date().toISOString(),
      aiStatus: r.aiStatus,
      supplyChainTag: r.supplyChainTag,
      l3Confidence: r.confidence,
      l3Reasoning: r.reasoning,
      l3Evidence: r.evidence,
      l3ApiFailed: r.l3ApiFailed ? 1 : 0,
      hardFilterPassed: orig?.hardFilterPassed ?? null,
      marketCap: orig?.marketCap ?? null,
      price: orig?.price ?? null,
      avgDollarVolume30d: orig?.avgDollarVolume30d ?? null,
      ttmRevenue: orig?.ttmRevenue ?? null,
      complianceChecked: orig?.complianceChecked ?? null,
      hasGoingConcern: orig?.hasGoingConcern ?? null,
      hasAuditorResignation: orig?.hasAuditorResignation ?? null,
    });

    if (r.l3ApiFailed) {
      statusCounts.api_failed++;
    } else {
      statusCounts[r.aiStatus]++;
    }
  }

  const updated = results.filter(r => !r.l3ApiFailed).length;
  const apiFailed = statusCounts.api_failed;

  console.log(`\n✅ Done. Updated: ${updated} | API failures: ${apiFailed}`);
  console.log(`   ├─ core:     ${statusCounts.core}`);
  console.log(`   ├─ adjacent: ${statusCounts.adjacent}`);
  console.log(`   ├─ non_core: ${statusCounts.non_core}`);
  console.log(`   └─ unknown:  ${statusCounts.unknown}`);

  if (apiFailed > 0) {
    console.log(`\n⚠️  ${apiFailed} tickers have API failures. Run: node scripts/retry-l3.mjs to retry those.`);
  }
}

rerunL3().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
