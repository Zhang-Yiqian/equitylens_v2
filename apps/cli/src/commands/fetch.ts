import { Command } from 'commander';
import type { FinancialSnapshot } from '@equitylens/core';
import { MVP_TICKER_SET, formatFinancialValue } from '@equitylens/core';
import {
  YahooClient, fetchYahooFinancials, matchCalendarQuarter,
  SecEdgarClient, fetchCompanyFacts, assembleFinancialData,
  DataCache, countNonNullFields, fetch10KData, fetch10QData, fetchRecent10QData,
  FinancialDataModule,
  DeterministicSnapshotEvaluator,
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
  .option('--harness', 'Enable harness mode with deterministic validation and retry (EQUITYLENS_HARNESS_MODE)', false)
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
      const useHarness = options.harness || process.env['EQUITYLENS_HARNESS_MODE'] === 'true';

      if (useHarness) {
        // ── Harness mode: use FinancialDataModule ─────────────────────────────
        console.log(`\n🔧 Harness mode enabled\n`);
        const module = new FinancialDataModule({
          harnessEnabled: true,
          forceRefresh: options.forceRefresh,
          minValidFields: 14, // 核心财务字段（deferredRevenue 等季报不披露，容忍缺失）
        });

        const result = await module.run(
          [ticker],
          CURRENT_YEAR - historyYears,
          CURRENT_YEAR - 1,
          {
            forceRefresh: options.forceRefresh,
            onProgress: (item, evalResult) => {
              const status = evalResult.ok ? '✅' : '⚠️';
              const score = evalResult.metadata?.score ?? '?';
              const fields = evalResult.metadata?.nonNullCount ?? 0;
              process.stdout.write(`  FY${item.year} Q${item.quarter} ${status} (score=${score}, fields=${fields})\n`);
              if (evalResult.warnings.length > 0) {
                for (const w of evalResult.warnings) {
                  process.stdout.write(`    ⚡ ${w}\n`);
                }
              }
              if (!evalResult.ok) {
                for (const e of evalResult.errors) {
                  process.stdout.write(`    ❌ ${e}\n`);
                }
              }
            },
          },
        );

        console.log(`\n✅ Harness fetch complete:\n`);
        console.log(`   Passed:  ${result.stats.passed}`);
        console.log(`   Failed:  ${result.stats.failed}`);
        console.log(`   Retried: ${result.stats.retried}`);
        console.log(`   Total:   ${result.stats.total}`);
        console.log(`   Time:    ${result.stats.durationMs}ms\n`);

        // Still fetch filing sections in harness mode
        await fetchFilingSections(ticker, CURRENT_YEAR, CURRENT_YEAR - 1);
        return;
      }

      // ── Legacy mode: direct fetch without harness ─────────────────────────────
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

        // Fetch SEC + Yahoo (with structured error logging instead of silent catch)
        let secData = null;
        try {
          secData = await fetchCompanyFacts(secClient, ticker, year, quarter);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`⚠️  SEC failed: ${msg}`);
        }

        let yahooData: Awaited<ReturnType<typeof fetchYahooFinancials>>[0] | null = null;
        try {
          const yahooResults = await fetchYahooFinancials(yahooClient, ticker);
          yahooData = matchCalendarQuarter(yahooResults, year, quarter);
        } catch {
          /* non-critical, skip */
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

      // Fetch filing sections
      await fetchFilingSections(ticker, CURRENT_YEAR, CURRENT_YEAR - 1);
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

    // Fetch filing sections
    await fetchFilingSections(ticker, year, year);

    console.log('\n─── Financial Snapshot ───\n');
    printFinancialSnapshot(assembled);
  });

/**
 * Fetch and store 10-K and 10-Q filing sections for a ticker.
 * Used by both history and single-period fetch modes.
 */
async function fetchFilingSections(ticker: string, fromYear: number, toYear: number): Promise<void> {
  console.log('📜 Fetching latest 10-K filing sections...');
  const secClient = new SecEdgarClient();
  const sections = await fetch10KData(secClient, ticker);
  if (sections) {
    const filingYear = sections.filingDate ? parseInt(sections.filingDate.slice(0, 4), 10) : toYear;
    upsertTenKCache({
      ticker,
      filingType: sections.filingType ?? '10-K',
      year: filingYear,
      filingDate: sections.filingDate ?? `${filingYear}-12-31`,
      documentUrl: sections.documentUrl ?? '',
      item1Business: sections.item1Business ?? null,
      item1ARiskFactors: sections.item1ARiskFactors ?? null,
      item6SelectedFinData: sections.item6SelectedFinData ?? null,
      item7MdAndA: sections.item7MdAndA ?? null,
      item7AFactors: sections.item7AFactors ?? null,
      item8Financials: sections.item8Financials ?? null,
      item9Controls: sections.item9Controls ?? null,
      item2Properties: sections.item2Properties ?? null,
      item3Legal: sections.item3Legal ?? null,
      item4Mine: sections.item4Mine ?? null,
      item5Market: sections.item5Market ?? null,
      item10Directors: sections.item10Directors ?? null,
      item11Compensation: sections.item11Compensation ?? null,
      item12Security: sections.item12Security ?? null,
      item13Relationships: sections.item13Relationships ?? null,
      item14Principal: sections.item14Principal ?? null,
      extractedGuidance: sections.extractedGuidance ?? null,
      fetchedAt: new Date().toISOString(),
    } as Parameters<typeof upsertTenKCache>[0]);
    console.log(`✅ 10-K (FY${filingYear}) sections stored\n`);
  } else {
    console.log('⚠️  Could not fetch 10-K sections\n');
  }

  // Fetch recent 10-Q filing sections (up to 4 most recent distinct filings)
  console.log('📜 Fetching recent 10-Q filing sections...');
  let qFetched = 0;
  try {
    const recent10Qs = await fetchRecent10QData(secClient, ticker, 4);
    for (const qSections of recent10Qs) {
      if (!qSections.filingDate) continue;
      const qFilingYear = parseInt(qSections.filingDate.slice(0, 4), 10);
      const qMonth = parseInt(qSections.filingDate.slice(5, 7), 10);
      let qQuarter = 0;
      if (qMonth >= 1 && qMonth <= 3) qQuarter = 1;
      else if (qMonth >= 4 && qMonth <= 6) qQuarter = 2;
      else if (qMonth >= 7 && qMonth <= 9) qQuarter = 3;
      else qQuarter = 4;

      process.stdout.write(`  FY${qFilingYear} Q${qQuarter} 10-Q (${qSections.filingDate})... `);
      try {
        upsertTenKCache({
          ticker,
          filingType: '10-Q',
          year: qFilingYear,
          quarter: qQuarter,
          filingDate: qSections.filingDate,
          documentUrl: qSections.documentUrl ?? '',
          item1Business: qSections.item1Business ?? null,
          item1ARiskFactors: qSections.item1ARiskFactors ?? null,
          item6SelectedFinData: qSections.item6SelectedFinData ?? null,
          item7MdAndA: qSections.item2MdAndA ?? qSections.item7MdAndA ?? null,
          item7AFactors: qSections.item7AFactors ?? null,
          item8Financials: qSections.item8Financials ?? null,
          item9Controls: qSections.item9Controls ?? null,
          item2Properties: qSections.item2Properties ?? null,
          item3Legal: qSections.item3Legal ?? null,
          item4Mine: qSections.item4Mine ?? null,
          item5Market: qSections.item5Market ?? null,
          item1Financials: qSections.item1Financials ?? null,
          item2MdAndA: qSections.item2MdAndA ?? qSections.item7MdAndA ?? null,
          item3Defaults: qSections.item3Defaults ?? null,
          item4Controls: qSections.item4Controls ?? null,
          extractedGuidance: qSections.extractedGuidance ? JSON.stringify(qSections.extractedGuidance) : null,
          fetchedAt: new Date().toISOString(),
        } as Parameters<typeof upsertTenKCache>[0]);
        console.log('✅');
        qFetched++;
      } catch (err) {
        console.log(`⚠️  upsert error: ${err instanceof Error ? err.message : err}`);
      }
      await new Promise(r => setTimeout(r, 250));
    }
  } catch (err) {
    console.log(`⚠️  10-Q fetch error: ${err instanceof Error ? err.message : err}`);
  }
  console.log(`\n✅ ${qFetched} 10-Q sections stored\n`);
}

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
