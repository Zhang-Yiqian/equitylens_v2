import { NextResponse } from 'next/server';
import { getLatestCompletedScan, getAllUniverseCache } from '@equitylens/store';
import type { ChainDistribution, SupplyChainTag } from '@equitylens/core';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const scan = getLatestCompletedScan();
    if (!scan) {
      return NextResponse.json({
        error: 'No completed scan found',
        funnelStats: null,
        poolBreakdown: null,
        chainDistribution: [],
      });
    }

    const cache = getAllUniverseCache();

    // Build pool breakdown from cache
    const poolBreakdown = {
      core: cache.filter(c => c.aiStatus === 'core').length,
      adjacent: cache.filter(c => c.aiStatus === 'adjacent').length,
      nonCore: cache.filter(c => c.aiStatus === 'non_core').length,
      unknown: cache.filter(c => !c.aiStatus || c.aiStatus === 'unknown').length,
    };

    // Build supply chain distribution
    const chainMap = new Map<SupplyChainTag, Set<string>>();
    for (const entry of cache) {
      if (entry.aiStatus === 'core' && entry.supplyChainTag) {
        const tag = entry.supplyChainTag as SupplyChainTag;
        if (!chainMap.has(tag)) chainMap.set(tag, new Set());
        chainMap.get(tag)!.add(entry.ticker);
      }
    }

    const chainDistribution: ChainDistribution[] = [...chainMap.entries()]
      .map(([tag, tickers]) => ({ tag, count: tickers.size, tickers: [...tickers] }))
      .sort((a, b) => b.count - a.count);

    const funnelStats = {
      totalNasdaq: scan.totalNasdaq,
      afterBlacklist: scan.afterBlacklist,
      l2Matches: scan.l2Matches,
      l3Classified: scan.l3Classified,
      afterHardFilter: scan.afterHardFilter,
      afterCompliance: scan.afterCompliance,
      aiCore: scan.aiCore,
      aiAdjacent: scan.aiAdjacent,
      nonCore: scan.nonCore,
      unknown: scan.unknown,
    };

    return NextResponse.json({
      scanId: scan.scanId,
      mode: scan.mode,
      status: scan.status,
      completedAt: scan.completedAt,
      startedAt: scan.startedAt,
      funnelStats,
      poolBreakdown,
      chainDistribution,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
