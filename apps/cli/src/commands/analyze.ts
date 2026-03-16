import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FinancialSnapshot } from '@equitylens/core';
import { MVP_TICKER_SET } from '@equitylens/core';
import {
  YahooClient, fetchYahooFinancials, matchCalendarQuarter,
  SecEdgarClient, fetchRawCompanyFacts, extractFinancialFromFacts,
  assembleFinancialData, computeYoYGrowth, DataCache, countNonNullFields,
} from '@equitylens/data';
import {
  LlmClient, buildPromptMessages, formatFinancialTable,
  parseAnalysisResponse, validateEvidence, DEFAULT_MODEL, isValidModel, PROMPT_VERSION,
} from '@equitylens/engine';
import { renderMarkdownReport } from '@equitylens/report';
import { getDb, saveAnalysis, saveReport } from '@equitylens/store';

export const analyzeCommand = new Command('analyze')
  .description('Full pipeline: fetch data → LLM analysis → generate report')
  .argument('<ticker>', 'Stock ticker symbol')
  .option('-q, --quarter <number>', 'Fiscal quarter (1-4)', '4')
  .option('-y, --year <number>', 'Fiscal year (default: current year - 1)')
  .option('-m, --model <key>', 'LLM model key', DEFAULT_MODEL)
  .option('-o, --output <dir>', 'Report output directory', './reports')
  .option('--force-refresh', 'Bypass cache and re-fetch from APIs', false)
  .option('--json', 'Output raw JSON instead of Markdown', false)
  .action(async (ticker: string, options) => {
    ticker = ticker.toUpperCase();
    const year = parseInt(options.year ?? String(new Date().getFullYear() - 1));
    const quarter = parseInt(options.quarter);
    const modelKey = options.model;

    if (!isValidModel(modelKey)) {
      console.error(`❌ Unknown model: ${modelKey}. Available: gemini-3.1-pro, gemini-2.5-pro, gpt-5.4, gpt-4o, claude-sonnet`);
      process.exit(1);
    }

    const missingKeys: string[] = [];
    if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY.startsWith('sk-or-your')) {
      missingKeys.push('OPENROUTER_API_KEY (register at https://openrouter.ai/)');
    }
    if (!process.env.SEC_EDGAR_USER_AGENT || process.env.SEC_EDGAR_USER_AGENT.includes('YourName')) {
      missingKeys.push('SEC_EDGAR_USER_AGENT (e.g. "Your Name your@email.com")');
    }
    if (missingKeys.length > 0) {
      console.error('\n❌ Missing required configuration in .env:\n');
      for (const k of missingKeys) console.error(`   • ${k}`);
      console.error('\nCopy .env.example to .env and fill in your API keys.\n');
      process.exit(1);
    }

    if (!MVP_TICKER_SET.has(ticker)) {
      console.warn(`⚠️  ${ticker} is not in the MVP ticker list, but proceeding anyway...`);
    }

    console.log(`\n🔬 EquityLens Inflection Analysis: ${ticker} FY${year} Q${quarter}`);
    console.log(`   Model: ${modelKey}\n`);

    getDb();
    const cache = new DataCache();

    // ── Step 1: Fetch Financial Data ───────────────────────────────────────────
    // Targets: 8 quarters (current year all 4 + prior year all 4) + 2 annual (FY current, FY prior)
    console.log('─── Step 1/4: Fetching Financial Data ───');

    // Build the list of all (year, quarter) pairs we need
    // Quarterly: all 4 quarters in 'year' and in 'year-1', ordered newest first
    const quarterTargets: Array<{ y: number; q: number }> = [];
    for (let q = 4; q >= 1; q--) quarterTargets.push({ y: year, q });
    for (let q = 4; q >= 1; q--) quarterTargets.push({ y: year - 1, q });

    // Annual: FY current year (q=0) and FY prior year (q=0)
    const annualTargets: Array<{ y: number; q: number }> = [
      { y: year, q: 0 },
      { y: year - 1, q: 0 },
    ];

    // Check which periods we can serve from cache
    const cachedQuarters = new Map<string, FinancialSnapshot>();
    const cachedAnnuals = new Map<string, FinancialSnapshot>();

    if (!options.forceRefresh) {
      for (const { y, q } of quarterTargets) {
        const cached = cache.getFinancial(ticker, y, q);
        if (cached && countNonNullFields(cached) > 0) cachedQuarters.set(`${y}Q${q}`, cached);
      }
      for (const { y, q } of annualTargets) {
        const cached = cache.getFinancial(ticker, y, q);
        if (cached && countNonNullFields(cached) > 0) cachedAnnuals.set(`${y}Q${q}`, cached);
      }
    }

    const allCachedQCount = [...quarterTargets.filter(({ y, q }) => cachedQuarters.has(`${y}Q${q}`))].length;
    const allCachedACount = [...annualTargets.filter(({ y, q }) => cachedAnnuals.has(`${y}Q${q}`))].length;

    // Decide if we need an API fetch. Always fetch if any quarter/annual is missing.
    const needsFetch = allCachedQCount < quarterTargets.length || allCachedACount < annualTargets.length;

    // Raw fetched data (reused for all periods)
    let rawFacts: Awaited<ReturnType<typeof fetchRawCompanyFacts>> = null;
    let yahooResults: Awaited<ReturnType<typeof fetchYahooFinancials>> = [];

    if (needsFetch) {
      try {
        console.log('  📡 Fetching SEC EDGAR (全历史单次请求)...');
        const secClient = new SecEdgarClient();
        rawFacts = await fetchRawCompanyFacts(secClient, ticker);
        if (rawFacts) {
          console.log('  ✅ SEC EDGAR raw facts fetched');
        } else {
          console.log('  ⚠️  SEC EDGAR: CIK lookup failed');
        }
      } catch (e) {
        console.log(`  ⚠️  SEC EDGAR: ${e instanceof Error ? e.message : e}`);
      }

      try {
        console.log('  📡 Fetching Yahoo Finance (8季度单次请求)...');
        const yahooClient = new YahooClient();
        yahooResults = await fetchYahooFinancials(yahooClient, ticker);
        console.log(`  ✅ Yahoo Finance: ${yahooResults.length} 季度记录`);
      } catch (e) {
        console.log(`  ⚠️  Yahoo Finance: ${e instanceof Error ? e.message : e}`);
      }
    } else {
      console.log(`  📦 全部 ${quarterTargets.length} 个季度 + ${annualTargets.length} 个年度均来自缓存`);
    }

    // ── Assemble all quarters ────────────────────────────────────────────────
    const assembledQuarters = new Map<string, FinancialSnapshot>();

    for (const { y, q } of quarterTargets) {
      const key = `${y}Q${q}`;
      if (cachedQuarters.has(key)) {
        assembledQuarters.set(key, cachedQuarters.get(key)!);
        continue;
      }

      const secData = rawFacts ? extractFinancialFromFacts(rawFacts, ticker, y, q) : null;
      const yahooData = matchCalendarQuarter(yahooResults, y, q);
      const assembled = assembleFinancialData(ticker, y, q, secData, yahooData);

      if (countNonNullFields(assembled) > 0) {
        cache.setFinancial(assembled);
        assembledQuarters.set(key, assembled);
      }
    }

    // ── Assemble annual periods (SEC only — Yahoo timeseries is quarterly) ────
    const assembledAnnuals = new Map<string, FinancialSnapshot>();

    for (const { y, q } of annualTargets) {
      const key = `${y}Q${q}`;
      if (cachedAnnuals.has(key)) {
        assembledAnnuals.set(key, cachedAnnuals.get(key)!);
        continue;
      }

      const secData = rawFacts ? extractFinancialFromFacts(rawFacts, ticker, y, q) : null;
      if (secData && countNonNullFields(secData) > 0) {
        const assembled = assembleFinancialData(ticker, y, q, secData, null);
        cache.setFinancial(assembled);
        assembledAnnuals.set(key, assembled);
      }
    }

    // ── Validate that we have current quarter ────────────────────────────────
    const currentKey = `${year}Q${quarter}`;
    const financial = assembledQuarters.get(currentKey);

    if (!financial) {
      console.error(`\n❌ 财务数据获取失败: ${ticker} FY${year} Q${quarter} 无任何有效数据`);
      console.error('   可能原因:');
      console.error(`   1. 该公司使用非日历财年 (例如 Micron 财年结束于8月)`);
      console.error(`   2. 查询期间的数据尚未发布`);
      console.error(`   3. SEC EDGAR 或 Yahoo Finance API 暂时不可用`);
      console.error('   解决方案:');
      console.error(`   • 使用 --force-refresh 强制重新获取`);
      console.error(`   • 调整 --year / --quarter 匹配公司实际财季\n`);
      process.exit(1);
    }

    // ── Build ordered arrays for LLM ─────────────────────────────────────────
    // historicalQuarters: the other 7 quarters besides current, newest first
    const historicalQuarters: FinancialSnapshot[] = quarterTargets
      .filter(({ y, q }) => !(y === year && q === quarter))
      .map(({ y, q }) => assembledQuarters.get(`${y}Q${q}`))
      .filter((s): s is FinancialSnapshot => s !== undefined);

    const annualSnapshots: FinancialSnapshot[] = annualTargets
      .map(({ y, q }) => assembledAnnuals.get(`${y}Q${q}`))
      .filter((s): s is FinancialSnapshot => s !== undefined);

    // ── Compute YoY revenue growth on current quarter ─────────────────────────
    const sameQPriorYear = assembledQuarters.get(`${year - 1}Q${quarter}`);
    if (sameQPriorYear) {
      const yoyGrowth = computeYoYGrowth(financial, sameQPriorYear);
      if (yoyGrowth !== null) {
        financial.revenueGrowthYoY = yoyGrowth;
      }
    }

    // ── Log summary ──────────────────────────────────────────────────────────
    const qAvailable = quarterTargets.filter(({ y, q }) => assembledQuarters.has(`${y}Q${q}`)).length;
    const aAvailable = annualTargets.filter(({ y, q }) => assembledAnnuals.has(`${y}Q${q}`)).length;
    console.log(`  ✅ 季度数据: ${qAvailable}/8 个季度已就绪`);
    console.log(`  ✅ 年度数据: ${aAvailable}/2 个年度已就绪`);
    if (financial.revenueGrowthYoY !== null && financial.revenueGrowthYoY !== undefined) {
      const g = financial.revenueGrowthYoY;
      console.log(`  📊 YoY Revenue Growth (Q${quarter} ${year} vs ${year - 1}): ${g >= 0 ? '+' : ''}${g.toFixed(1)}%`);
    }

    // Step 2: LLM Analysis
    console.log('\n─── Step 2/4: Running LLM Analysis ───');
    console.log(`  🤖 Sending to ${modelKey} via OpenRouter...`);

    const llmClient = new LlmClient(modelKey);
    const messages = buildPromptMessages(financial, historicalQuarters, annualSnapshots);

    const startTime = Date.now();
    const llmResponse = await llmClient.chat(messages);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`  ✅ Response received (${elapsed}s, ${llmResponse.usage.totalTokens.toLocaleString()} tokens)`);

    // Step 3: Parse & Validate
    console.log('\n─── Step 3/4: Parsing & Validating ───');

    const analysis = parseAnalysisResponse(
      llmResponse.content,
      ticker,
      year,
      quarter,
      modelKey,
      PROMPT_VERSION,
      llmResponse.usage,
    );
    console.log(`  ✅ Parsed: ${analysis.verdict} (confidence: ${analysis.verdictConfidence}/100)`);

    const financialText = formatFinancialTable(financial, historicalQuarters, annualSnapshots);
    const validation = validateEvidence(analysis, financialText);
    console.log(`  🔍 Evidence validation: ${validation.verifiedCount}/${validation.totalEvidence} verified`);
    if (validation.failedCount > 0) {
      console.log(`  ⚠️  ${validation.failedCount} unverified citation(s)`);
    }

    saveAnalysis({
      ticker,
      year,
      quarter,
      promptVersion: PROMPT_VERSION,
      modelId: modelKey,
      verdict: analysis.verdict,
      verdictConfidence: analysis.verdictConfidence,
      thesisSummary: analysis.thesisSummary,
      dimensionsJson: JSON.stringify(analysis.dimensions),
      catalystsJson: JSON.stringify(analysis.catalysts),
      risksJson: JSON.stringify(analysis.risks),
      trackingMetricsJson: JSON.stringify(analysis.trackingMetrics),
      rawLlmOutput: llmResponse.content,
      promptTokens: llmResponse.usage.promptTokens,
      completionTokens: llmResponse.usage.completionTokens,
      totalTokens: llmResponse.usage.totalTokens,
      analyzedAt: analysis.analyzedAt,
    });

    // Step 4: Generate Report
    console.log('\n─── Step 4/4: Generating Report ───');

    if (options.json) {
      const jsonPath = join(options.output, `${ticker}_${year}Q${quarter}_${now()}.json`);
      ensureDir(options.output);
      writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
      console.log(`  📄 JSON report: ${jsonPath}`);
    } else {
      const markdown = renderMarkdownReport(analysis, financial, validation);
      const mdPath = join(options.output, `${ticker}_${year}Q${quarter}_${now()}.md`);
      ensureDir(options.output);
      writeFileSync(mdPath, markdown);
      console.log(`  📄 Markdown report: ${mdPath}`);

      saveReport({
        ticker,
        year,
        quarter,
        markdownContent: markdown,
        filePath: mdPath,
        generatedAt: new Date().toISOString(),
      });
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`  ${analysis.verdict} — ${ticker} FY${year} Q${quarter}`);
    console.log(`  Confidence: ${analysis.verdictConfidence}/100`);
    console.log(`  Catalysts: ${analysis.catalysts.length} | Risks: ${analysis.risks.length}`);
    console.log(`  Evidence: ${validation.verifiedCount}/${validation.totalEvidence} verified`);
    console.log('═══════════════════════════════════════\n');
  });

function now(): string {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
