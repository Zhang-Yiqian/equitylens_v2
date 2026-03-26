import { NextRequest, NextResponse } from 'next/server';
import { getUniverseScanById, getAllUniverseCache } from '@equitylens/store';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const scan = getUniverseScanById(id);
    if (!scan) {
      return NextResponse.json({ error: `Scan ${id} not found` }, { status: 404 });
    }

    const cache = getAllUniverseCache();

    // Filter cache to companies from this scan
    const companies = cache
      .filter(c => c.lastScanId === id || (c.aiStatus && c.lastScanId === id))
      .map(c => ({
        ticker: c.ticker,
        companyName: c.companyName,
        source: c.source,
        market: c.market,
        // L2
        l2Matched: Boolean(c.l2Matched),
        l2MatchedKeywords: c.l2MatchedKeywords ? JSON.parse(c.l2MatchedKeywords) : [],
        l2MatchedCategories: c.l2MatchedCategories ? JSON.parse(c.l2MatchedCategories) : [],
        // L3
        aiStatus: c.aiStatus ?? 'unknown',
        supplyChainTag: c.supplyChainTag ?? null,
        l3Confidence: c.l3Confidence,
        l3Reasoning: c.l3Reasoning,
        l3Evidence: c.l3Evidence,
        // Hard filter
        hardFilterPassed: c.hardFilterPassed === null ? null : Boolean(c.hardFilterPassed),
        marketCap: c.marketCap,
        price: c.price,
        avgDollarVolume30d: c.avgDollarVolume30d,
        ttmRevenue: c.ttmRevenue,
        // Compliance
        hasGoingConcern: c.hasGoingConcern === null ? null : Boolean(c.hasGoingConcern),
        hasAuditorResignation: c.hasAuditorResignation === null ? null : Boolean(c.hasAuditorResignation),
        lastScanId: c.lastScanId,
      }));

    return NextResponse.json({
      scan: {
        scanId: scan.scanId,
        mode: scan.mode,
        status: scan.status,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
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
        diffAdded: scan.diffAdded,
        diffRemoved: scan.diffRemoved,
        errorMessage: scan.errorMessage,
      },
      companies,
      total: companies.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
