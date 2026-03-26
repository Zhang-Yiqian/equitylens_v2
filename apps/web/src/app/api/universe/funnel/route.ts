import { NextResponse } from 'next/server';
import { getLatestCompletedScan, getAllUniverseCache } from '@equitylens/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const scan = getLatestCompletedScan();
    if (!scan) {
      return NextResponse.json({
        error: 'No completed scan found',
        scanId: null,
        completedAt: null,
        funnelStats: null,
        buckets: [],
      });
    }

    const allCache = getAllUniverseCache();
    // Only include entries from this scan
    const cache = allCache.filter(e => e.lastScanId === scan.scanId);

    const funnelStats = {
      totalNasdaq: scan.totalNasdaq,
      afterBlacklist: scan.afterBlacklist,
      l2Matches: scan.l2Matches,
      l3Classified: scan.l3Classified,
      aiCore: scan.aiCore,
      aiAdjacent: scan.aiAdjacent,
      nonCore: scan.nonCore,
      unknown: scan.unknown,
      l3ApiFailed: 0, // computed from cache below
    };

    type BucketEntry = {
      ticker: string;
      companyName: string;
      aiStatus: string | null;
      supplyChainTag: string | null;
      l3Confidence: number | null;
      l3Reasoning: string | null;
      l3Evidence: string | null;
      l2MatchedKeywords: string[];
      l2MatchedCategories: string[];
      /** True if this company's L3 result came from an API failure fallback */
      l3ApiFailed?: boolean;
      failReasons: string[];
      passReasons: string[];
    };

    const parseJsonArray = (val: unknown): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try { return JSON.parse(val as string); } catch { return []; }
    };

    const bucketMap: Record<number, BucketEntry[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    let apiFailedCount = 0;

    for (const entry of cache) {
      const keywords = parseJsonArray(entry.l2MatchedKeywords);
      const categories = parseJsonArray(entry.l2MatchedCategories);
      const aiStatus = entry.aiStatus ?? null;
      const isApiFailed = entry.l3ApiFailed === 1;
      const isAiCore = aiStatus === 'core' || aiStatus === 'adjacent';

      const failReasons: string[] = [];
      const passReasons: string[] = [];

      // Build pass reasons
      for (const kw of keywords) passReasons.push(`关键词: ${kw}`);
      for (const cat of categories) passReasons.push(`分类: ${cat}`);
      if (entry.l3Confidence != null) passReasons.push(`置信度 ${entry.l3Confidence}`);

      const bucket: BucketEntry = {
        ticker: entry.ticker,
        companyName: entry.companyName,
        aiStatus,
        supplyChainTag: entry.supplyChainTag ?? null,
        l3Confidence: entry.l3Confidence ?? null,
        l3Reasoning: entry.l3Reasoning ?? null,
        l3Evidence: (entry as any).l3Evidence ?? null,
        l2MatchedKeywords: keywords,
        l2MatchedCategories: categories,
        l3ApiFailed: isApiFailed || undefined,
        failReasons,
        passReasons,
      };

      // Bucket assignment (5 buckets)
      if (isApiFailed) {
        // Bucket 4: L3 API failures — batch failed after all retries
        bucketMap[4].push(bucket);
        apiFailedCount++;
      } else if (isAiCore) {
        // Bucket 0: Final Pool — L3 classified as core or adjacent
        bucketMap[0].push(bucket);
      } else if (aiStatus === 'non_core' || aiStatus === 'unknown') {
        // Bucket 1: L3 classified but non_core or unknown
        bucketMap[1].push(bucket);
      } else if (entry.l2Matched === 1 && !aiStatus) {
        // Bucket 2: L2 matched but L3 pending
        bucketMap[2].push(bucket);
      } else {
        // Bucket 3: Raw NASDAQ — passed blacklist but L2 didn't match
        bucketMap[3].push(bucket);
      }
    }

    funnelStats.l3ApiFailed = apiFailedCount;

    const buckets = [
      {
        bucket: 0,
        label: '最终候选池',
        labelEn: 'Final Pool',
        description: 'L3 AI 分类为核心或关联',
        color: 'emerald',
        entries: bucketMap[0],
        subGroups: {
          core: bucketMap[0].filter(e => e.aiStatus === 'core'),
          adjacent: bucketMap[0].filter(e => e.aiStatus === 'adjacent'),
          non_core: bucketMap[0].filter(e => e.aiStatus === 'non_core'),
          unknown: bucketMap[0].filter(e => e.aiStatus === 'unknown' || e.aiStatus === null),
        },
      },
      {
        bucket: 1,
        label: 'L3 非核心',
        labelEn: 'L3 Non-Core',
        description: 'L3 AI 分类为 non_core 或 unknown',
        color: 'amber',
        entries: bucketMap[1],
      },
      {
        bucket: 2,
        label: 'L3 分类中',
        labelEn: 'L3 Pending',
        description: 'L2 关键词匹配，AI 分类待进行',
        color: 'blue',
        entries: bucketMap[2],
      },
      {
        bucket: 3,
        label: 'L2 未命中',
        labelEn: 'L2 Failed',
        description: '通过黑名单过滤，L2 关键词未匹配',
        color: 'slate',
        entries: bucketMap[3],
      },
      {
        bucket: 4,
        label: 'API 失败',
        labelEn: 'API Failed',
        description: 'L3 API 调用失败（已重试 2 次），需重新扫描',
        color: 'red',
        entries: bucketMap[4],
      },
    ];

    return NextResponse.json({
      scanId: scan.scanId,
      mode: scan.mode,
      completedAt: scan.completedAt,
      startedAt: scan.startedAt,
      funnelStats,
      buckets,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
