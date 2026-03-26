import { randomUUID } from 'node:crypto';
import type { ScanMode, UniverseScanResult, ScanDiff, FunnelStats, ChainDistribution, SupplyChainTag, L3Classification } from '@equitylens/core';
import {
  upsertUniverseScan,
  updateUniverseScan,
  getLatestCompletedScan,
  upsertUniverseCache,
  upsertBlacklist,
  getAllCachedTickers,
} from '@equitylens/store';
import { fetchNasdaqUniverse } from '../fetcher/nasdaq.js';
import { runL2Matching } from '../matcher/regex.js';
import { isWhitelisted } from '../matcher/blacklist.js';
import { classifyL3 } from '../classifier/batch.js';
import { applyHardFilters } from '../filter/hard-filters.js';
import { checkCompliance } from '../filter/compliance.js';
import { printProgress } from './progress.js';
import { loadAiCoreListFromFile } from '../fetcher/ai-core-list.js';

export interface ScanOptions {
  mode?: ScanMode;
  dryRun?: boolean;
  skipL3?: boolean;
  skipHardFilter?: boolean;
  skipCompliance?: boolean;
  l2Only?: boolean;
  maxL3?: number;
  noCache?: boolean;
  verbose?: boolean;
  signal?: AbortSignal;
  /** Path to a .txt file containing AI Core tickers (one per line) */
  aiCoreListFile?: string;
  /** Skip L3 classification for tickers loaded from aiCoreListFile */
  noL3ForList?: boolean;
}

function makeScanId(): string {
  return `scan-${new Date().toISOString().slice(0, 13).replace(/[:-]/g, '')}-${randomUUID().slice(0, 8)}`;
}

async function getIncrementalTickers(
  nasdaqTickers: Set<string>,
  verbose: boolean,
): Promise<{ newTickers: string[]; removedTickers: string[] }> {
  const cachedTickers = new Set(getAllCachedTickers());
  const newTickers: string[] = [];
  const removedTickers: string[] = [];

  for (const t of nasdaqTickers) {
    if (!cachedTickers.has(t)) newTickers.push(t);
  }
  for (const t of cachedTickers) {
    if (!nasdaqTickers.has(t)) removedTickers.push(t);
  }

  if (verbose) {
    console.log(`\n📊 Incremental diff: +${newTickers.length} new, -${removedTickers.length} removed`);
  }

  return { newTickers, removedTickers };
}

function buildStats(
  totalNasdaq: number,
  afterBlacklist: number,
  l2Matches: number,
  l3Classified: number,
  afterHardFilter: number,
  afterCompliance: number,
  aiCore: number,
  aiAdjacent: number,
  nonCore: number,
  unknown: number,
  l3ApiFailed: number,
): FunnelStats {
  return { totalNasdaq, afterBlacklist, l2Matches, l3Classified, afterHardFilter, afterCompliance, aiCore, aiAdjacent, nonCore, unknown, l3ApiFailed };
}

function buildChainDistribution(
  cache: Array<{ ticker: string; aiStatus: string | null; supplyChainTag: string | null }>,
): ChainDistribution[] {
  const map = new Map<SupplyChainTag, Set<string>>();

  for (const entry of cache) {
    if (entry.aiStatus === 'core' && entry.supplyChainTag) {
      const tag = entry.supplyChainTag as SupplyChainTag;
      if (!map.has(tag)) map.set(tag, new Set());
      map.get(tag)!.add(entry.ticker);
    }
  }

  return [...map.entries()]
    .map(([tag, tickers]) => ({ tag, count: tickers.size, tickers: [...tickers] }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Main scan pipeline: L1 → L2 → L3 → Hard Filter → Compliance
 */
export async function runScan(options: ScanOptions = {}): Promise<UniverseScanResult> {
  const {
    mode = 'full',
    dryRun = false,
    skipL3 = false,
    skipHardFilter = true,
    skipCompliance = true,
    l2Only = false,
    maxL3,
    noCache = false,
    verbose = false,
    signal,
    aiCoreListFile,
    noL3ForList = false,
  } = options;

  const scanId = makeScanId();
  const startTime = Date.now();
  const errors: string[] = [];

  if (verbose) {
    console.log(`\n🚀 Starting Universe Scan: ${scanId}`);
    console.log(`   Mode: ${mode} | DryRun: ${dryRun} | SkipL3: ${skipL3} | SkipHard: ${skipHardFilter} (default true) | SkipCompliance: ${skipCompliance} (default true)`);
  }

  // ── Initialize scan record ────────────────────────────────────────────────
  if (!dryRun) {
    upsertUniverseScan({
      scanId,
      mode,
      status: 'running',
      startedAt: new Date().toISOString(),
      totalNasdaq: 0,
      afterBlacklist: 0,
      l2Matches: 0,
      l3Classified: 0,
      afterHardFilter: 0,
      afterCompliance: 0,
      aiCore: 0,
      aiAdjacent: 0,
      nonCore: 0,
      unknown: 0,
    });
  }

  try {
    // ── L1: Fetch Nasdaq Universe ───────────────────────────────────────────
    if (verbose) console.log('\n─── L1: Fetching Nasdaq Universe ───');
    const nasdaqRows = await fetchNasdaqUniverse({ noCache, signal });
    const nasdaqTickers = new Set(nasdaqRows.map(r => r.symbol));
    const totalNasdaq = nasdaqRows.length;
    if (verbose) console.log(`  ✅ Downloaded ${totalNasdaq} tickers`);

    let afterBlacklist = totalNasdaq;
    let diffAdded = 0;
    let diffRemoved = 0;

    // ── Incremental Mode: Diff ───────────────────────────────────────────────
    let scanTickers = nasdaqRows;
    if (mode === 'incremental') {
      const { newTickers, removedTickers } = await getIncrementalTickers(nasdaqTickers, verbose);
      diffAdded = newTickers.length;
      diffRemoved = removedTickers.length;

      // Only scan new tickers plus previously cached that passed
      scanTickers = nasdaqRows.filter(r => newTickers.includes(r.symbol));
      if (verbose) console.log(`  📊 Scanning ${scanTickers.length} new tickers (incremental)`);
    }

    // ── L2: 10-K Description Keyword Matching ────────────────────────────────
    // L2 is purely description-based. All non-blacklisted scanTickers go through
    // description fetching + keyword matching.
    // Whitelist tickers bypass L2 and go directly to L3 (added separately below).
    if (verbose) console.log('\n─── L2: 10-K Description Keyword Matching ───');
    if (verbose) console.log(`  📋 ${scanTickers.length} tickers to process…`);

    // ── AI Core List: build whitelist entries (bypass L2, go directly to L3) ──
    const whitelistEntries: Array<{
      ticker: string;
      companyName: string;
      market: string | null;
    }> = [];

    if (aiCoreListFile) {
      if (verbose) console.log(`\n─── AI Core List: ${aiCoreListFile} ───`);
      const listTickers = loadAiCoreListFromFile(aiCoreListFile);
      if (verbose) console.log(`  Loaded ${listTickers.length} tickers from AI Core List (bypass L2 → direct to L3)`);

      for (const ticker of listTickers) {
        const nasdaqRow = nasdaqRows.find(r => r.symbol === ticker);
        if (!nasdaqRow) {
          if (verbose) console.log(`  ⚠️  ${ticker} not found in Nasdaq universe, skipping`);
          continue;
        }
        whitelistEntries.push({
          ticker: nasdaqRow.symbol,
          companyName: nasdaqRow.companyName,
          market: nasdaqRow.market ?? null,
        });
        if (verbose) console.log(`  ✅ ${ticker} → ${nasdaqRow.companyName}`);
      }
    }

    // ── L2: 10-K Description Keyword Matching ────────────────────────────────
    // Exclude whitelist tickers from L2 so they don't waste SEC API calls.
    // They bypass L2 entirely and go directly to L3.
    const whitelistSet = new Set(whitelistEntries.map(e => e.ticker));
    const rowsForL2 = scanTickers.filter(r => !whitelistSet.has(r.symbol));

    if (verbose) console.log(`\n─── L2: 10-K Description Keyword Matching ───`);
    if (verbose) console.log(`  📋 ${rowsForL2.length} non-whitelist tickers to match…`);

    const l2Results = await runL2Matching(rowsForL2, { signal, verbose });
    const l2Matches = l2Results.length;

    if (verbose) {
      console.log(`  ✅ L2 matched: ${l2Matches} companies (description keyword match)`);
      printProgress('L2', l2Matches, totalNasdaq);
    }

    if (l2Only) {
      const durationMs = Date.now() - startTime;
      return {
        scanId,
        mode,
        stats: buildStats(totalNasdaq, afterBlacklist, l2Matches, 0, 0, 0, 0, 0, 0, 0, 0),
        poolBreakdown: { core: 0, adjacent: 0, nonCore: 0, unknown: 0 },
        chainDistribution: [],
        completedAt: new Date().toISOString(),
        durationMs,
        errors: [],
      };
    }

    // ── L3: Gemini Classification ────────────────────────────────────────────
    let l3Results: L3Classification[] = [];

    // Whitelist/AI Core List entries: lifted outside if block so DB write can access them
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whitelistForL3: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noL3Entries: any[] = [];

    if (!skipL3) {
      if (verbose) console.log('\n─── L3: Gemini AI Purity Classification ───');

      // L2 description-matched companies need L3 classification
      let l2ForL3 = l2Results;

      // Whitelist/AI Core List entries: if noL3ForList, mark as core directly; else send to L3
      if (noL3ForList && whitelistEntries.length > 0) {
        for (const entry of whitelistEntries) {
          noL3Entries.push({
            ticker: entry.ticker,
            companyName: entry.companyName,
            matchedKeywords: ['__ai_core_list__'],
            matchedCategories: ['ai_core_list'],
            combinedText: `${entry.ticker} ${entry.companyName}`,
            market: entry.market as import('@equitylens/core').NasdaqMarket | null,
            matchedSource: 'whitelist',
          });
        }
        if (verbose) console.log(`  🔓 ${noL3Entries.length} AI Core List tickers skip L3 (marked core)`);
      } else if (whitelistEntries.length > 0) {
        for (const entry of whitelistEntries) {
          whitelistForL3.push({
            ticker: entry.ticker,
            companyName: entry.companyName,
            matchedKeywords: ['__ai_core_list__'],
            matchedCategories: ['ai_core_list'],
            combinedText: `${entry.ticker} ${entry.companyName}`,
            market: entry.market as import('@equitylens/core').NasdaqMarket | null,
            matchedSource: 'whitelist',
          });
        }
        if (verbose) console.log(`  📋 ${whitelistForL3.length} AI Core List tickers included in L3`);
      }

      // Combine L2 results + whitelist entries for L3 classification
      const allForL3 = [...l2ForL3, ...whitelistForL3];

      if (maxL3 !== undefined && maxL3 < allForL3.length) {
        if (verbose) console.log(`  📊 Limiting L3 to first ${maxL3} companies`);
        // Prioritize whitelist entries when limiting
        const limitedWhitelist = whitelistForL3.slice(0, Math.min(whitelistForL3.length, maxL3));
        const remaining = maxL3 - limitedWhitelist.length;
        allForL3.length = 0;
        allForL3.push(...limitedWhitelist, ...l2ForL3.slice(0, remaining));
      }

      const l3Classifications = await classifyL3(allForL3, {
        verbose,
        signal,
        onProgress: (done, total) => {
          if (verbose) process.stdout.write(`\r  Progress: ${done}/${total} `);
        },
      });

      if (verbose) console.log();

      l3Results = l3Classifications.map(c => ({
        ticker: c.ticker,
        companyName: c.companyName,
        aiStatus: c.aiStatus,
        supplyChainTag: c.supplyChainTag,
        confidence: c.confidence,
        reasoning: c.reasoning,
        evidence: c.evidence,
        modelId: c.modelId,
        analyzedAt: c.analyzedAt,
      }));

      // Add no-L3 entries as core with null supplyChainTag (deferred classification)
      for (const entry of noL3Entries) {
        l3Results.push({
          ticker: entry.ticker,
          companyName: entry.companyName,
          aiStatus: 'core',
          supplyChainTag: 'none' as SupplyChainTag,
          confidence: 0,
          reasoning: '来自 AI Core List（--no-l3-for-list），产业链节点待后续手动标注',
          evidence: 'AI Core List',
          modelId: 'deferred',
          analyzedAt: new Date().toISOString(),
        } as L3Classification);
      }
    }

    const l3Classified = l3Results.length;

    // ── Hard Filter ──────────────────────────────────────────────────────────
    let hardFilterResults: Array<{ ticker: string; passed: boolean; marketCap?: number | null; price?: number | null; avgDollarVolume30d?: number | null; ttmRevenue?: number | null }> = [];

    if (!skipHardFilter) {
      if (verbose) console.log('\n─── Hard Market Filters ───');
      const tickersToCheck = l3Results.length > 0
        ? l3Results.map(r => r.ticker)
        : l2Results.map(r => r.ticker);

      hardFilterResults = await applyHardFilters(tickersToCheck, { verbose, signal });
    }

    // ── Compliance Check ─────────────────────────────────────────────────────
    let complianceBlacklist: Map<string, { reason: string; pattern: string }> = new Map();

    if (!skipCompliance && !dryRun) {
      if (verbose) console.log('\n─── Compliance Check (Going Concern + Auditor) ───');
      const tickersForCompliance = hardFilterResults.length > 0
        ? hardFilterResults.filter(r => r.passed).map(r => r.ticker)
        : l3Results.map(r => r.ticker);

      const { blacklist } = await checkCompliance(tickersForCompliance, { verbose, signal });

      for (const [ticker, entry] of blacklist.entries()) {
        complianceBlacklist.set(ticker, entry);
      }
    }

    // ── Compute Final Stats ─────────────────────────────────────────────────
    const aiCore = l3Results.filter(r => r.aiStatus === 'core').length;
    const aiAdjacent = l3Results.filter(r => r.aiStatus === 'adjacent').length;
    const nonCore = l3Results.filter(r => r.aiStatus === 'non_core').length;
    const unknown = l3Results.filter(r => r.aiStatus === 'unknown').length;
    const l3ApiFailed = l3Results.filter(r => r.aiStatus === 'api_failed').length;

    const afterHardFilter = l3Classified;
    const afterCompliance = l3Classified;

    // ── Write to Database ───────────────────────────────────────────────────
    if (!dryRun) {
      if (verbose) console.log('\n─── Writing to Database ───');

      const now = new Date().toISOString();

      // Write cache entries for L2 description-matched companies
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cacheEntries: any[] = l2Results.map(l2 => {
        const l3 = l3Results.find(r => r.ticker === l2.ticker);
        const hard = hardFilterResults.find(r => r.ticker === l2.ticker);
        const complianceEntry = complianceBlacklist.get(l2.ticker);

        return {
          ticker: l2.ticker,
          companyName: l2.companyName,
          source: 'nasdaq_listed' as const,
          market: l2.market ?? null,
          l2Matched: 1,
          l2MatchedKeywords: JSON.stringify(l2.matchedKeywords),
          l2MatchedCategories: JSON.stringify(l2.matchedCategories),
          aiStatus: l3?.aiStatus ?? null,
          supplyChainTag: l3?.supplyChainTag ?? null,
          l3Confidence: l3?.confidence ?? null,
          l3Reasoning: l3?.reasoning ?? null,
          l3Evidence: l3?.evidence ?? null,
          l3ApiFailed: l3?.l3ApiFailed ? 1 : 0,
          hardFilterPassed: hard ? (hard.passed ? 1 : 0) : null,
          marketCap: hard?.marketCap ?? null,
          price: hard?.price ?? null,
          avgDollarVolume30d: hard?.avgDollarVolume30d ?? null,
          ttmRevenue: hard?.ttmRevenue ?? null,
          complianceChecked: !skipCompliance ? 1 : 0,
          hasGoingConcern: complianceEntry ? 1 : 0,
          hasAuditorResignation: complianceEntry ? 1 : 0,
          lastScanId: scanId,
          fetchedAt: now,
        };
      });

      // Write whitelist/AI Core List entries (bypass L2, directly to L3)
      for (const entry of noL3Entries) {
        const hard = hardFilterResults.find(r => r.ticker === entry.ticker);
        const complianceEntry = complianceBlacklist.get(entry.ticker);
        cacheEntries.push({
          ticker: entry.ticker,
          companyName: entry.companyName,
          source: 'nasdaq_listed' as const,
          market: entry.market ?? null,
          l2Matched: 1,
          l2MatchedKeywords: JSON.stringify(entry.matchedKeywords),
          l2MatchedCategories: JSON.stringify(entry.matchedCategories),
          aiStatus: 'core',
          supplyChainTag: null,
          l3Confidence: null,
          l3Reasoning: '来自 AI Core List（--no-l3-for-list），产业链节点待后续手动标注',
          l3Evidence: 'AI Core List',
          l3ApiFailed: 0,
          hardFilterPassed: hard ? (hard.passed ? 1 : 0) : null,
          marketCap: hard?.marketCap ?? null,
          price: hard?.price ?? null,
          avgDollarVolume30d: hard?.avgDollarVolume30d ?? null,
          ttmRevenue: hard?.ttmRevenue ?? null,
          complianceChecked: !skipCompliance ? 1 : 0,
          hasGoingConcern: complianceEntry ? 1 : 0,
          hasAuditorResignation: complianceEntry ? 1 : 0,
          lastScanId: scanId,
          fetchedAt: now,
        });
      }

      for (const entry of cacheEntries) {
        upsertUniverseCache(entry);
      }

      // Write compliance blacklist
      for (const [ticker, entry] of complianceBlacklist.entries()) {
        upsertBlacklist({
          ticker,
          reason: entry.reason as 'compliance_going_concern' | 'compliance_auditor_resignation',
          addedAt: now,
          source: scanId,
        });
      }

      // Update scan record
      upsertUniverseScan({
        scanId,
        mode,
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalNasdaq,
        afterBlacklist,
        l2Matches,
        l3Classified,
        afterHardFilter,
        afterCompliance,
        aiCore,
        aiAdjacent,
        nonCore,
        unknown,
        diffAdded: mode === 'incremental' ? diffAdded : undefined,
        diffRemoved: mode === 'incremental' ? diffRemoved : undefined,
        errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
        l3TokensUsed: 0,
      });
    }

    // ── Print Summary ───────────────────────────────────────────────────────
    if (verbose) {
      console.log('\n');
      printScanSummary({
        scanId,
        mode,
        totalNasdaq,
        afterBlacklist,
        l2Matches,
        l3Classified,
        afterHardFilter,
        afterCompliance,
        aiCore,
        aiAdjacent,
        nonCore,
        unknown,
        diffAdded,
        diffRemoved,
      });
    }

    const durationMs = Date.now() - startTime;
    const cacheData = l3Results.map(r => ({ ticker: r.ticker, aiStatus: r.aiStatus, supplyChainTag: r.supplyChainTag }));

    return {
      scanId,
      mode,
      stats: buildStats(totalNasdaq, afterBlacklist, l2Matches, l3Classified, afterHardFilter, afterCompliance, aiCore, aiAdjacent, nonCore, unknown, l3ApiFailed),
      diff: mode === 'incremental' ? { added: [], removed: [] } : undefined,
      poolBreakdown: { core: aiCore, adjacent: aiAdjacent, nonCore, unknown },
      chainDistribution: buildChainDistribution(cacheData),
      completedAt: new Date().toISOString(),
      durationMs,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(errorMsg);

    if (!dryRun) {
      upsertUniverseScan({
        scanId,
        mode,
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalNasdaq: 0,
        afterBlacklist: 0,
        l2Matches: 0,
        l3Classified: 0,
        afterHardFilter: 0,
        afterCompliance: 0,
        aiCore: 0,
        aiAdjacent: 0,
        nonCore: 0,
        unknown: 0,
        errorMessage: errorMsg,
      });
    }

    const durationMs = Date.now() - startTime;
    return {
      scanId,
      mode,
      stats: buildStats(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      poolBreakdown: { core: 0, adjacent: 0, nonCore: 0, unknown: 0 },
      chainDistribution: [],
      completedAt: new Date().toISOString(),
      durationMs,
      errors,
    };
  }
}

interface ScanSummaryInput {
  scanId: string;
  mode: ScanMode;
  totalNasdaq: number;
  afterBlacklist: number;
  l2Matches: number;
  l3Classified: number;
  afterHardFilter: number;
  afterCompliance: number;
  aiCore: number;
  aiAdjacent: number;
  nonCore: number;
  unknown: number;
  diffAdded: number;
  diffRemoved: number;
}

function printScanSummary(input: ScanSummaryInput): void {
  const { aiCore, aiAdjacent, nonCore, unknown } = input;
  const total = aiCore + aiAdjacent + nonCore + unknown || 1;
  const pct = (n: number) => `(${(n / total * 100).toFixed(1)}%)`;

  console.log('═══════════════════════════════════════════════');
  console.log(`  📊 Universe Scan Complete: ${input.scanId}`);
  console.log('═══════════════════════════════════════════════');
  console.log(`  📥 Nasdaq 下载:          ${input.totalNasdaq.toLocaleString()} 只股票`);
  console.log(`  🚫 黑名单过滤后:         ${input.afterBlacklist.toLocaleString()} 只`);
  console.log(`  🔍 L2 关键词命中:        ${input.l2Matches.toLocaleString()} 只`);
  console.log(`  🤖 L3 AI分类完成:        ${input.l3Classified.toLocaleString()} 只`);
  console.log('───────────────────────────────────────────────');
  console.log(`  ⭐ AI Core (核心):        ${aiCore.toLocaleString()} ${pct(aiCore)}`);
  console.log(`  🔗 AI Adjacent (相邻):   ${aiAdjacent.toLocaleString()} ${pct(aiAdjacent)}`);
  console.log(`  ❌ Non-core (蹭概念):     ${nonCore.toLocaleString()} ${pct(nonCore)}`);
  console.log(`  ❓ Unknown (未分类):      ${unknown.toLocaleString()} ${pct(unknown)}`);
  if (input.mode === 'incremental') {
    console.log('───────────────────────────────────────────────');
    console.log(`  +${input.diffAdded} 新上市  |  -${input.diffRemoved} 已移除`);
  }
  console.log('═══════════════════════════════════════════════');
}
