import { Command } from 'commander';
import type { FinancialSnapshot } from '@equitylens/core';
import { MVP_TICKER_SET, formatFinancialValue } from '@equitylens/core';
import {
  YahooClient, fetchYahooFinancials, matchCalendarQuarter,
  SecEdgarClient, fetchCompanyFacts, assembleFinancialData,
  DataCache, countNonNullFields, fetch10KData, fetch10QData,
} from '@equitylens/data';
import { formatFinancialTable } from '@equitylens/data';
import { getDb, getAllFinancialSnapshots, upsertTenKCache } from '@equitylens/store';

const CURRENT_YEAR = new Date().getFullYear();

export const fetchCommand = new Command('fetch')
  .description('Fetch and cache financial data for a ticker')
  .argument('<ticker>', 'Stock ticker symbol')
  .option('-q, --quarter <number>', 'Fiscal quarter (1-4, 0=annual)', '4')
  .option('-y, --year <number>', 'Fiscal year', String(CURRENT_YEAR - 1))
  .option('--history <years>', 'Fetch N years of history (1y=4q, 2y=8q, 3y=12q + annuals)', '0')
  .option('--force-refresh', 'Bypass cache and re-fetch from APIs', true)
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
        source: row.source as 'sec' | 'yahoo' | 'merged',
        fetchedAt: row.fetchedAt,
        fieldSources: row.fieldSources ? JSON.parse(row.fieldSources) : null,
        // Income Statement
        revenue: row.revenue,
        costOfRevenue: row.costOfRevenue,
        grossMargin: row.grossMargin,
        operatingExpenses: row.operatingExpenses,
        sgaExpense: row.sgaExpense,
        rdExpense: row.rdExpense,
        sbcExpense: row.sbcExpense,
        otherIncomeExpense: row.otherIncomeExpense,
        depreciationAndAmortization: row.depreciationAndAmortization,
        operatingIncome: row.operatingIncome,
        interestExpense: row.interestExpense,
        interestIncome: row.interestIncome,
        pretaxIncome: row.pretaxIncome,
        incomeTaxExpense: row.incomeTaxExpense,
        discontinuedOperations: row.discontinuedOperations,
        netIncome: row.netIncome,
        // EPS & Shares
        epsBasic: row.epsBasic,
        epsDiluted: row.epsDiluted ?? row.eps,
        weightedAverageSharesBasic: row.weightedAverageSharesBasic,
        weightedAverageSharesDiluted: row.weightedAverageSharesDiluted,
        dividendsPerShare: row.dividendsPerShare,
        // Balance Sheet
        totalCash: row.totalCash,
        shortTermInvestments: row.shortTermInvestments,
        accountsReceivable: row.accountsReceivable,
        inventory: row.inventory,
        totalCurrentAssets: row.totalCurrentAssets,
        goodwill: row.goodwill,
        intangibleAssets: row.intangibleAssets,
        ppneNet: row.ppneNet,
        totalAssets: row.totalAssets,
        totalCurrentLiabilities: row.totalCurrentLiabilities,
        operatingLeaseLiability: row.operatingLeaseLiability,
        longTermDebt: row.longTermDebt,
        totalDebt: row.totalDebt,
        totalLiabilities: row.totalLiabilities,
        retainedEarnings: row.retainedEarnings,
        totalStockholdersEquity: row.totalStockholdersEquity,
        sharesOutstanding: row.sharesOutstanding,
        // Cash Flow
        operatingCashFlow: row.operatingCashFlow,
        capitalExpenditure: row.capitalExpenditure,
        freeCashFlow: row.freeCashFlow,
        sbcInCashFlow: row.sbcInCashFlow,
        shareRepurchases: row.shareRepurchases,
        dividendsPaid: row.dividendsPaid,
        debtIssuance: row.debtIssuance,
        debtRepayment: row.debtRepayment,
        workingCapitalChange: row.workingCapitalChange,
        acquisitionRelatedCash: row.acquisitionRelatedCash,
        // Deferred Revenue / RPO
        deferredRevenue: row.deferredRevenue,
        rpo: row.rpo,
        // Equity / Comprehensive
        accountsPayable: row.accountsPayable,
        accumulatedOtherComprehensiveIncome: row.accumulatedOtherComprehensiveIncome,
        additionalPaidInCapital: row.additionalPaidInCapital,
        treasuryStock: row.treasuryStock,
        preferredStock: row.preferredStock,
        minorityInterest: row.minorityInterest,
        comprehensiveIncome: row.comprehensiveIncome,
        netIncomeAttributableToNoncontrolling: row.netIncomeAttributableToNoncontrolling,
        proceedsFromStockOptions: row.proceedsFromStockOptions,
        excessTaxBenefit: row.excessTaxBenefit,
        // Market
        marketCap: row.marketCap,
        peRatio: row.peRatio,
        // Supplementary
        grossMarginPct: row.grossMarginPct,
        fcfMarginPct: row.fcfMarginPct,
        revenueGrowthYoY: row.revenueGrowthYoY,
        // Derived (null for --all display)
        operatingMarginPct: null,
        netMarginPct: null,
        ebitdaMarginPct: null,
        rdIntensityPct: null,
        sbcIntensityPct: null,
        sgaToGrossProfitPct: null,
        effectiveTaxRate: null,
        bookValuePerShare: null,
        ocfPerShare: null,
        fcfPerShare: null,
        ocfpsGrowthYoY: null,
        fcfpsGrowthYoY: null,
        debtToEquity: null,
        debtToEbitda: null,
        netDebt: null,
        netDebtToEbitda: null,
        interestCoverage: null,
        currentRatio: null,
        quickRatio: null,
        cashRatio: null,
        assetTurnover: null,
        roa: null,
        roe: null,
        roic: null,
        ownersEarnings: null,
        capexToOcfPct: null,
        fcfToNetIncomePct: null,
        netWorkingCapital: null,
        dso: null,
        dio: null,
        dpo: null,
        cashConversionCycle: null,
        inventoryTurnover: null,
        netIncomeGrowthYoY: null,
        operatingIncomeGrowthYoY: null,
        fcfGrowthYoY: null,
        odfGrowthYoY: null,
        assetGrowthYoY: null,
        equityGrowthYoY: null,
        earningsYield: null,
        fcfYield: null,
        dividendYield: null,
        buybackYield: null,
        totalShareholderYield: null,
        retainedEarningsToMarketValue: null,
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

    // ── --history mode: fetch N years of all quarters + annuals ───────────────
    const historyYears = parseInt(options.history);
    if (historyYears > 0) {
      const quarters = [1, 2, 3, 4] as const;
      const periods: Array<{ year: number; quarter: number }> = [];

      // Build period list: FY(current-1) down to FY(current-historyYears)
      // Include both quarterly (Q1-Q4) and annual (Q0 / 10-K) reports
      for (let y = CURRENT_YEAR - 1; y >= CURRENT_YEAR - historyYears + 1; y--) {
        periods.push({ year: y, quarter: 0 }); // annual 10-K first
        for (const q of quarters) periods.push({ year: y, quarter: q });
      }

      const cache = new DataCache();
      const secClient = new SecEdgarClient();
      const yahooClient = new YahooClient();
      let fetched = 0;
      let skipped = 0;
      let failed = 0;

      console.log(`\n📜 Fetching ${historyYears}y history for ${ticker} — ${periods.length} quarters...\n`);

      for (const { year, quarter } of periods) {
        process.stdout.write(`  FY${year} Q${quarter}... `);

        // Check cache
        if (!options.forceRefresh) {
          const cached = cache.getFinancial(ticker, year, quarter);
          if (cached && countNonNullFields(cached) >= 5) {
            console.log('📦 cached');
            skipped++;
            continue;
          }
        }

        // Fetch SEC + Yahoo
        let secData = null;
        try {
          secData = await fetchCompanyFacts(secClient, ticker, year, quarter);
        } catch {
          /* skip */
        }

        let yahooData: Awaited<ReturnType<typeof fetchYahooFinancials>>[0] | null = null;
        try {
          const yahooResults = await fetchYahooFinancials(yahooClient, ticker);
          yahooData = matchCalendarQuarter(yahooResults, year, quarter);
        } catch {
          /* skip */
        }

        const assembled = assembleFinancialData(ticker, year, quarter, secData, yahooData);
        const filled = countNonNullFields(assembled);

        if (filled > 0) {
          cache.setFinancial(assembled);
          fetched++;
          console.log(`✅ (${filled} fields)`);
        } else {
          failed++;
          console.log(`⚠️  no data`);
        }

        // Respectful rate-limit pause between SEC requests
        await new Promise(r => setTimeout(r, 250));
      }

      console.log(`\n✅ History fetch complete: ${fetched} fetched, ${skipped} cached, ${failed} no data\n`);

      // ── Fetch 10-K filing sections (latest only, once per ticker) ───────────
      console.log('📜 Fetching latest 10-K filing sections...');
      const secClient2 = new SecEdgarClient();
      const sections = await fetch10KData(secClient2, ticker);
      if (sections) {
        const filingYear = sections.filingDate ? parseInt(sections.filingDate.slice(0, 4), 10) : CURRENT_YEAR - 1;
        upsertTenKCache({
          ticker,
          filingType: sections.filingType ?? '10-K',
          year: filingYear,
          filingDate: sections.filingDate ?? `${filingYear}-12-31`,
          documentUrl: sections.documentUrl ?? '',
          item1Business: sections.item1 ?? null,
          item1ARiskFactors: sections.item1A ?? null,
          item6SelectedFinData: sections.item6 ?? null,
          item7MdAndA: sections.item7 ?? null,
          item7AFactors: sections.item7A ?? null,
          item8Financials: sections.item8 ?? null,
          item9Controls: sections.item9Controls ?? null,
          item2Properties: sections.item2 ?? null,
          item3Legal: sections.item3 ?? null,
          item4Mine: sections.item4 ?? null,
          item5Market: sections.item5 ?? null,
          item10Directors: sections.item10 ?? null,
          item11Compensation: sections.item11 ?? null,
          item12Security: sections.item12 ?? null,
          item13Relationships: sections.item13 ?? null,
          item14Principal: sections.item14 ?? null,
          extractedGuidance: sections.extractedGuidance ? JSON.stringify(sections.extractedGuidance) : null,
          fetchedAt: new Date().toISOString(),
        } as Parameters<typeof upsertTenKCache>[0]);
        console.log(`✅ 10-K (FY${filingYear}) sections stored\n`);
      } else {
        console.log('⚠️  Could not fetch 10-K sections\n');
      }

      // ── Fetch recent 10-Q filing sections ─────────────────────────────────
      console.log('📜 Fetching recent 10-Q filing sections...');
      const recent10QYears = [CURRENT_YEAR - 1, CURRENT_YEAR - 2];
      let qFetched = 0;
      for (const qy of recent10QYears) {
        for (const q of [1, 2, 3, 4] as const) {
          process.stdout.write(`  FY${qy} Q${q} 10-Q... `);
          try {
            const qSections = await fetch10QData(secClient2, ticker);
            if (qSections && qSections.filingDate) {
              const qFilingYear = parseInt(qSections.filingDate.slice(0, 4), 10);
              upsertTenKCache({
                ticker,
                filingType: '10-Q',
                year: qFilingYear,
                filingDate: qSections.filingDate,
                documentUrl: qSections.documentUrl ?? '',
                item1Business: qSections.item1 ?? null,
                item1ARiskFactors: qSections.item1A ?? null,
                item6SelectedFinData: qSections.item6 ?? null,
                item7MdAndA: qSections.item7 ?? qSections.item2 ?? null,
                item7AFactors: qSections.item7A ?? null,
                item8Financials: qSections.item8 ?? null,
                item9Controls: qSections.item9Controls ?? null,
                item2Properties: qSections.item2 ?? null,
                item3Legal: qSections.item3 ?? null,
                item4Mine: qSections.item4 ?? null,
                item5Market: qSections.item5 ?? null,
                item1Financials: qSections.item1Financials ?? null,
                item2MdAndA: qSections.item2MdAndA ?? null,
                item3Defaults: qSections.item3Defaults ?? null,
                item4Controls: qSections.item4Controls ?? null,
                extractedGuidance: qSections.extractedGuidance ? JSON.stringify(qSections.extractedGuidance) : null,
                fetchedAt: new Date().toISOString(),
              } as Parameters<typeof upsertTenKCache>[0]);
              console.log(`✅ (${qSections.filingDate})`);
              qFetched++;
            } else {
              console.log('⚠️  no filing found');
            }
          } catch (err) {
            console.log(`⚠️  error: ${err instanceof Error ? err.message : err}`);
          }
          await new Promise(r => setTimeout(r, 250));
        }
      }
      console.log(`\n✅ ${qFetched} 10-Q sections stored\n`);

      return;
    }

    // ── Single-period fetch mode ─────────────────────────────────────────────
    const year = parseInt(options.year);
    const quarter = parseInt(options.quarter);

    console.log(`\n🔍 Fetching data for ${ticker} FY${year} Q${quarter}...\n`);

    const cache = new DataCache();

    if (!options.forceRefresh) {
      const cached = cache.getFinancial(ticker, year, quarter);
      if (cached && countNonNullFields(cached) >= 5) {
        console.log('📦 Using cached financial data\n');
        printFinancialSnapshot(cached);
        return;
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

    // ── Also fetch and store latest 10-K filing sections ─────────────────────
    console.log('\n📜 Fetching latest 10-K filing sections...');
    const secClient2 = new SecEdgarClient();
    const sections = await fetch10KData(secClient2, ticker);
    if (sections) {
      const filingYear = sections.filingDate ? parseInt(sections.filingDate.slice(0, 4), 10) : year;
      upsertTenKCache({
        ticker,
        filingType: sections.filingType ?? '10-K',
        year: filingYear,
        filingDate: sections.filingDate ?? `${filingYear}-12-31`,
        documentUrl: sections.documentUrl ?? '',
        item1Business: sections.item1 ?? null,
        item1ARiskFactors: sections.item1A ?? null,
        item6SelectedFinData: sections.item6 ?? null,
        item7MdAndA: sections.item7 ?? null,
        item7AFactors: sections.item7A ?? null,
        item8Financials: sections.item8 ?? null,
        item9Controls: sections.item9A ?? null,
        item2Properties: sections.item2 ?? null,
        item3Legal: sections.item3 ?? null,
        item4Mine: sections.item4 ?? null,
        item5Market: sections.item5 ?? null,
        item10Directors: sections.item10 ?? null,
        item11Compensation: sections.item11 ?? null,
        item12Security: sections.item12 ?? null,
        item13Relationships: sections.item13 ?? null,
        item14Principal: sections.item14 ?? null,
        extractedGuidance: sections.extractedGuidance ?? null,
        fetchedAt: new Date().toISOString(),
      } as Parameters<typeof upsertTenKCache>[0]);
      console.log(`✅ 10-K (FY${filingYear}) sections stored\n`);
    } else {
      console.log('⚠️  Could not fetch 10-K sections\n');
    }

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
    ['EPS (Diluted)',      data.epsDiluted != null ? `$${data.epsDiluted.toFixed(2)}` : '缺失'],
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
