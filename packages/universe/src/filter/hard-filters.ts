import { YahooClient } from '@equitylens/data';
import type { HardFilterResult } from '@equitylens/core';

const MIN_MARKET_CAP = 300_000_000;     // $300M
const MIN_AVG_DOLLAR_VOLUME = 2_000_000; // $2M (30-day avg)
const MIN_TTM_REVENUE = 10_000_000;     // $10M
const MIN_PRICE = 1.0;                  // $1

interface RawTimeSeriesRow {
  date: Date;
  periodType?: string;
  totalRevenue?: number | null;
}

/**
 * Apply hard market门槛 filters to a list of tickers.
 * Uses Yahoo Finance quote() for market data and fundamentalsTimeSeries() for revenue.
 */
export async function applyHardFilters(
  tickers: string[],
  options?: { signal?: AbortSignal; verbose?: boolean },
): Promise<HardFilterResult[]> {
  const results: HardFilterResult[] = [];

  if (options?.verbose) {
    console.log(`\n🔍 Hard Filters: checking ${tickers.length} tickers...`);
  }

  for (const ticker of tickers) {
    if (options?.signal?.aborted) break;

    const yahoo = new YahooClient();

    try {
      // Fetch quote and revenue in parallel
      const [quoteResult, revenueResult] = await Promise.allSettled([
        (async () => {
          yahoo.incrementRequestCount();
          return yahoo.module.quote(ticker) as Promise<Record<string, unknown>>;
        })(),
        (async () => {
          yahoo.incrementRequestCount();
          // Get the most recent quarterly revenue
          const ts = await yahoo.module.fundamentalsTimeSeries(ticker, {
            period1: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
            type: 'quarterly',
            module: 'all',
          }) as RawTimeSeriesRow[];
          return ts?.filter(r => r.periodType === '3M')
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, 4) ?? [];
        })(),
      ]);

      let marketCap: number | null = null;
      let price: number | null = null;
      let volume: number | null = null;
      let avgVolume: number | null = null;

      if (quoteResult.status === 'fulfilled') {
        const q = quoteResult.value;
        marketCap = (q.marketCap as number) ?? null;
        price = (q.regularMarketPrice as number) ?? (q.currentPrice as number) ?? null;
        volume = (q.regularMarketVolume as number) ?? null;
        avgVolume = (q.averageDailyVolume10Day as number) ?? (q.averageVolume as number) ?? null;
      }

      // Estimate 30-day average dollar volume
      let avgDollarVolume: number | null = null;
      if (price !== null && avgVolume !== null && avgVolume > 0) {
        avgDollarVolume = price * avgVolume;
      } else if (price !== null && volume !== null && volume > 0) {
        avgDollarVolume = price * volume;
      }

      // Compute TTM revenue from last 4 quarters
      let ttmRevenue: number | null = null;
      if (revenueResult.status === 'fulfilled') {
        const quarters = revenueResult.value as RawTimeSeriesRow[];
        const total = quarters
          .slice(0, 4)
          .reduce((sum, q) => sum + ((q.totalRevenue as number) ?? 0), 0);
        if (total > 0) ttmRevenue = total;
      }

      const passed =
        (marketCap === null || marketCap >= MIN_MARKET_CAP) &&
        (price === null || price >= MIN_PRICE) &&
        (avgDollarVolume === null || avgDollarVolume >= MIN_AVG_DOLLAR_VOLUME) &&
        (ttmRevenue === null || ttmRevenue >= MIN_TTM_REVENUE);

      const reasons: string[] = [];
      if (marketCap !== null && marketCap < MIN_MARKET_CAP) reasons.push(`市值 ${formatCompact(marketCap)} < $300M 门槛`);
      if (price !== null && price < MIN_PRICE) reasons.push(`股价 $${price.toFixed(2)} < $1 门槛`);
      if (avgDollarVolume !== null && avgDollarVolume < MIN_AVG_DOLLAR_VOLUME) reasons.push(`日均成交额 ${formatCompact(avgDollarVolume)} < $2M 门槛`);
      if (ttmRevenue !== null && ttmRevenue < MIN_TTM_REVENUE) reasons.push(`TTM营收 ${formatCompact(ttmRevenue)} < $10M 门槛`);

      results.push({
        ticker,
        passed,
        marketCap,
        price,
        avgDollarVolume30d: avgDollarVolume,
        ttmRevenue,
        reason: reasons.length > 0 ? reasons.join('; ') : undefined,
      });
    } catch (error) {
      // If Yahoo data fetch fails, mark as failed (conservative)
      results.push({
        ticker,
        passed: false,
        reason: `Yahoo Finance 数据获取失败: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  if (options?.verbose) {
    const passed = results.filter(r => r.passed).length;
    console.log(`  ✅ Hard filters: ${passed}/${results.length} passed`);
  }

  return results;
}

function formatCompact(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}
