import { Command } from 'commander';
import type { FinancialSnapshot } from '@equitylens/core';
import { MVP_TICKER_SET, formatFinancialValue } from '@equitylens/core';
import {
  YahooClient, fetchYahooFinancials, matchCalendarQuarter,
  SecEdgarClient, fetchCompanyFacts, assembleFinancialData,
  DataCache, countNonNullFields,
} from '@equitylens/data';
import { formatFinancialTable } from '@equitylens/engine';
import { getDb, getAllFinancialSnapshots } from '@equitylens/store';

export const fetchCommand = new Command('fetch')
  .description('Fetch and cache financial data for a ticker')
  .argument('<ticker>', 'Stock ticker symbol')
  .option('-q, --quarter <number>', 'Fiscal quarter (1-4)', '4')
  .option('-y, --year <number>', 'Fiscal year', '2024')
  .option('--force-refresh', 'Bypass cache and re-fetch from APIs', false)
  .option('--all', 'Show all cached periods as a multi-quarter table (no fetch)', false)
  .action(async (ticker: string, options) => {
    ticker = ticker.toUpperCase();

    if (!MVP_TICKER_SET.has(ticker)) {
      console.warn(`⚠️  ${ticker} is not in the MVP ticker list, but proceeding anyway...`);
    }

    getDb();

    // ── --all mode: show full multi-quarter table from cache ─────────────────
    if (options.all) {
      const rows = getAllFinancialSnapshots(ticker);
      if (rows.length === 0) {
        console.log(`\n❌ 缓存中没有 ${ticker} 的数据，请先运行 analyze 或 fetch 获取数据。\n`);
        return;
      }

      const toSnapshot = (row: typeof rows[0]): FinancialSnapshot => ({
        ticker: row.ticker,
        year: row.year,
        quarter: row.quarter,
        revenue: row.revenue,
        netIncome: row.netIncome,
        grossMargin: row.grossMargin,
        operatingCashFlow: row.operatingCashFlow,
        freeCashFlow: row.freeCashFlow,
        rdExpense: row.rdExpense,
        sharesOutstanding: row.sharesOutstanding,
        totalAssets: row.totalAssets,
        totalLiabilities: row.totalLiabilities,
        eps: row.eps,
        marketCap: row.marketCap,
        peRatio: row.peRatio,
        revenueGrowthYoY: row.revenueGrowthYoY,
        grossMarginPct: row.grossMarginPct,
        fcfMarginPct: row.fcfMarginPct,
        deferredRevenue: row.deferredRevenue,
        rpo: row.rpo,
        source: row.source as 'sec' | 'yahoo' | 'merged',
        fetchedAt: row.fetchedAt,
      });

      // Split into quarters (q >= 1) and annuals (q === 0), newest first
      const quarters = rows.filter(r => r.quarter >= 1).map(toSnapshot);
      const annuals  = rows.filter(r => r.quarter === 0).map(toSnapshot);

      const current = quarters[0];
      const historical = quarters.slice(1);

      console.log(`\n📊 ${ticker} — 缓存财务数据 (${rows.length} 个期间)\n`);
      console.log(formatFinancialTable(current, historical, annuals));
      console.log(`\n数据来源: ${[...new Set(rows.map(r => r.source))].join(', ')}`);
      console.log(`最近更新: ${rows.map(r => `FY${r.year} Q${r.quarter === 0 ? '年度' : r.quarter}=${r.fetchedAt.slice(0, 10)}`).join('  ')}\n`);
      return;
    }

    // ── Single-period fetch mode ─────────────────────────────────────────────
    const year = parseInt(options.year);
    const quarter = parseInt(options.quarter);

    console.log(`\n🔍 Fetching data for ${ticker} FY${year} Q${quarter}...\n`);

    const cache = new DataCache();

    if (!options.forceRefresh) {
      const cached = cache.getFinancial(ticker, year, quarter);
      if (cached && countNonNullFields(cached) > 0) {
        console.log('📦 Using cached financial data\n');
        printFinancialSnapshot(cached);
        return;
      } else if (cached) {
        console.log('⚠️  Cached data has no valid financial values — re-fetching...');
      }
    }

    let secData: Awaited<ReturnType<typeof fetchCompanyFacts>> = null;
    try {
      console.log('📡 Fetching from SEC EDGAR...');
      const secClient = new SecEdgarClient();
      secData = await fetchCompanyFacts(secClient, ticker, year, quarter);
      console.log('  ✅ SEC EDGAR data retrieved');
    } catch (error) {
      console.log(`  ⚠️  SEC EDGAR failed: ${error instanceof Error ? error.message : error}`);
    }

    let yahooData: Awaited<ReturnType<typeof fetchYahooFinancials>>[0] | null = null;
    try {
      console.log('📡 Fetching from Yahoo Finance...');
      const yahooClient = new YahooClient();
      const yahooResults = await fetchYahooFinancials(yahooClient, ticker);
      yahooData = matchCalendarQuarter(yahooResults, year, quarter);
      if (yahooData?.income) {
        console.log(`  ✅ Yahoo Finance data retrieved (date: ${yahooData.income.date})`);
      } else {
        console.log('  ⚠️  Yahoo Finance: no matching period found');
      }
    } catch (error) {
      console.log(`  ⚠️  Yahoo Finance failed: ${error instanceof Error ? error.message : error}`);
    }

    const assembled = assembleFinancialData(ticker, year, quarter, secData, yahooData);
    cache.setFinancial(assembled);

    console.log('\n─── Financial Snapshot ───\n');
    printFinancialSnapshot(assembled);
  });

function printFinancialSnapshot(data: FinancialSnapshot) {
  const rows: [string, string][] = [
    ['Ticker / Period',    `${data.ticker}  FY${data.year} Q${data.quarter === 0 ? '年度' : data.quarter}`],
    ['Revenue',            formatFinancialValue(data.revenue)],
    ['Net Income',         formatFinancialValue(data.netIncome)],
    ['Gross Profit',       formatFinancialValue(data.grossMargin)],
    ['Gross Margin %',     data.grossMarginPct != null ? `${data.grossMarginPct.toFixed(1)}%` : '缺失'],
    ['Operating CF',       formatFinancialValue(data.operatingCashFlow)],
    ['Free Cash Flow',     formatFinancialValue(data.freeCashFlow)],
    ['FCF Margin %',       data.fcfMarginPct != null ? `${data.fcfMarginPct.toFixed(1)}%` : '缺失'],
    ['R&D Expense',        formatFinancialValue(data.rdExpense)],
    ['EPS (Diluted)',      data.eps != null ? `$${data.eps.toFixed(2)}` : '缺失'],
    ['Shares Outstanding', data.sharesOutstanding != null ? `${(data.sharesOutstanding / 1e6).toFixed(0)}M` : '缺失'],
    ['Total Assets',       formatFinancialValue(data.totalAssets)],
    ['Total Liabilities',  formatFinancialValue(data.totalLiabilities)],
    ['Deferred Revenue',   formatFinancialValue(data.deferredRevenue)],
    ['Market Cap',         formatFinancialValue(data.marketCap)],
    ['P/E Ratio',          data.peRatio != null ? `${data.peRatio.toFixed(1)}x` : '缺失'],
    ['Revenue YoY',        data.revenueGrowthYoY != null ? `${data.revenueGrowthYoY >= 0 ? '+' : ''}${data.revenueGrowthYoY.toFixed(1)}%` : '缺失'],
    ['Source',             data.source],
    ['Fetched At',         data.fetchedAt.slice(0, 19)],
  ];

  for (const [label, value] of rows) {
    console.log(`  ${label.padEnd(22)} ${value}`);
  }
}
