import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FinancialSnapshot } from '@equitylens/core';
import { MVP_TICKER_SET } from '@equitylens/core';
import {
  YahooClient, fetchYahooFinancials, matchCalendarQuarter,
  SecEdgarClient, fetchRawCompanyFacts, extractFinancialFromFacts,
  assembleFinancialData, computeYoYGrowth, DataCache, countNonNullFields,
  fetchYahooNews, formatNewsForPrompt,
  fetch10KData, format10KForPrompt,
} from '@equitylens/data';
import {
  LlmClient, buildPromptMessages, buildCrossValidationMessages, formatFinancialTable,
  parseAnalysisResponse, parseCrossValidationResponse,
  validateEvidence, validateCrossEvidence,
  DEFAULT_MODEL, isValidModel, PROMPT_VERSION, CROSS_VALIDATION_PROMPT_VERSION,
} from '@equitylens/engine';
import { renderMarkdownReport, renderCrossValidationReport } from '@equitylens/report';
import {
  getDb, saveAnalysis, saveCrossValidationAnalysis, saveReport,
  saveNewsItems, upsertTenKCache, getNewsCache, getTenKCache,
} from '@equitylens/store';

export const analyzeCommand = new Command('analyze')
  .description('Full pipeline: fetch data → LLM analysis → generate report')
  .argument('<ticker>', 'Stock ticker symbol')
  .option('-q, --quarter <number>', 'Fiscal quarter (1-4)', '4')
  .option('-y, --year <number>', 'Fiscal year (default: current year - 1)')
  .option('-m, --model <key>', 'LLM model key', DEFAULT_MODEL)
  .option('-o, --output <dir>', 'Report output directory', './reports')
  .option('--force-refresh', 'Bypass cache and re-fetch from APIs', false)
  .option('--json', 'Output raw JSON instead of Markdown', false)
  .option('--legacy', 'Use legacy 12-dimension inflection analysis instead of cross-validation', false)
  .action(async (ticker: string, options) => {
    ticker = ticker.toUpperCase();
    const year = parseInt(options.year ?? String(new Date().getFullYear() - 1));
    const quarter = parseInt(options.quarter);
    const modelKey = options.model;
    const useLegacy = options.legacy as boolean;

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

    const modeLabel = useLegacy ? '12维度拐点分析 (Legacy)' : '8维度交叉验证分析';
    console.log(`\n🔬 EquityLens Analysis: ${ticker} FY${year} Q${quarter} — ${modeLabel}`);
    console.log(`   Model: ${modelKey}\n`);

    getDb();
    const cache = new DataCache();

    // ── Step 1: Fetch Financial Data ───────────────────────────────────────────
    console.log('─── Step 1/5: Fetching Financial Data ───');

    const quarterTargets: Array<{ y: number; q: number }> = [];
    for (let q = 4; q >= 1; q--) quarterTargets.push({ y: year, q });
    for (let q = 4; q >= 1; q--) quarterTargets.push({ y: year - 1, q });

    const annualTargets: Array<{ y: number; q: number }> = [
      { y: year, q: 0 },
      { y: year - 1, q: 0 },
    ];

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
    const needsFetch = allCachedQCount < quarterTargets.length || allCachedACount < annualTargets.length;

    let rawFacts: Awaited<ReturnType<typeof fetchRawCompanyFacts>> = null;
    let yahooResults: Awaited<ReturnType<typeof fetchYahooFinancials>> = [];
    const secClient = new SecEdgarClient();

    if (needsFetch) {
      try {
        console.log('  📡 Fetching SEC EDGAR (全历史单次请求)...');
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

    const assembledQuarters = new Map<string, FinancialSnapshot>();
    for (const { y, q } of quarterTargets) {
      const key = `${y}Q${q}`;
      if (cachedQuarters.has(key)) { assembledQuarters.set(key, cachedQuarters.get(key)!); continue; }
      const secData = rawFacts ? extractFinancialFromFacts(rawFacts, ticker, y, q) : null;
      const yahooData = matchCalendarQuarter(yahooResults, y, q);
      const assembled = assembleFinancialData(ticker, y, q, secData, yahooData);
      if (countNonNullFields(assembled) > 0) { cache.setFinancial(assembled); assembledQuarters.set(key, assembled); }
    }

    const assembledAnnuals = new Map<string, FinancialSnapshot>();
    for (const { y, q } of annualTargets) {
      const key = `${y}Q${q}`;
      if (cachedAnnuals.has(key)) { assembledAnnuals.set(key, cachedAnnuals.get(key)!); continue; }
      const secData = rawFacts ? extractFinancialFromFacts(rawFacts, ticker, y, q) : null;
      if (secData && countNonNullFields(secData) > 0) {
        const assembled = assembleFinancialData(ticker, y, q, secData, null);
        cache.setFinancial(assembled); assembledAnnuals.set(key, assembled);
      }
    }

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

    const historicalQuarters: FinancialSnapshot[] = quarterTargets
      .filter(({ y, q }) => !(y === year && q === quarter))
      .map(({ y, q }) => assembledQuarters.get(`${y}Q${q}`))
      .filter((s): s is FinancialSnapshot => s !== undefined);

    const annualSnapshots: FinancialSnapshot[] = annualTargets
      .map(({ y, q }) => assembledAnnuals.get(`${y}Q${q}`))
      .filter((s): s is FinancialSnapshot => s !== undefined);

    const sameQPriorYear = assembledQuarters.get(`${year - 1}Q${quarter}`);
    if (sameQPriorYear) {
      const yoyGrowth = computeYoYGrowth(financial, sameQPriorYear);
      if (yoyGrowth !== null) financial.revenueGrowthYoY = yoyGrowth;
    }

    const qAvailable = quarterTargets.filter(({ y, q }) => assembledQuarters.has(`${y}Q${q}`)).length;
    const aAvailable = annualTargets.filter(({ y, q }) => assembledAnnuals.has(`${y}Q${q}`)).length;
    console.log(`  ✅ 季度数据: ${qAvailable}/8 个季度已就绪`);
    console.log(`  ✅ 年度数据: ${aAvailable}/2 个年度已就绪`);
    if (financial.revenueGrowthYoY !== null && financial.revenueGrowthYoY !== undefined) {
      const g = financial.revenueGrowthYoY;
      console.log(`  📊 YoY Revenue Growth (Q${quarter} ${year} vs ${year - 1}): ${g >= 0 ? '+' : ''}${g.toFixed(1)}%`);
    }

    // ── Step 2: Fetch News & 10-K (cross-validation mode only) ────────────────
    let newsText = '暂无近期新闻数据';
    let tenKText = '暂无10-K年报数据';

    if (!useLegacy) {
      console.log('\n─── Step 2/5: Fetching News & 10-K Data ───');

      // News
      try {
        const cachedNews = getNewsCache(ticker);
        if (!options.forceRefresh && cachedNews.length > 0) {
          console.log(`  📦 新闻 (缓存): ${cachedNews.length} 条`);
          newsText = formatNewsForPrompt(cachedNews.map(n => ({
            title: n.title,
            publisher: n.publisher,
            link: n.link,
            publishedAt: n.publishedAt,
          })));
        } else {
          console.log('  📡 Fetching Yahoo Finance News...');
          const yahooClient = new YahooClient();
          const news = await fetchYahooNews(yahooClient, ticker, 20);
          if (news.length > 0) {
            saveNewsItems(ticker, news);
            newsText = formatNewsForPrompt(news);
            console.log(`  ✅ 新闻: ${news.length} 条`);
          } else {
            console.log('  ⚠️  新闻: 暂无数据');
          }
        }
      } catch (e) {
        console.log(`  ⚠️  新闻数据获取失败: ${e instanceof Error ? e.message : e}`);
      }

      // 10-K
      try {
        const cachedTenK = getTenKCache(ticker);
        if (!options.forceRefresh && cachedTenK) {
          console.log(`  📦 10-K (缓存): ${cachedTenK.filingDate}`);
          tenKText = format10KForPrompt({
            ticker,
            filingDate: cachedTenK.filingDate,
            documentUrl: cachedTenK.documentUrl,
            item1Business: cachedTenK.item1Business ?? null,
            item1ARiskFactors: cachedTenK.item1ARiskFactors ?? null,
          });
        } else {
          console.log('  📡 Fetching SEC 10-K...');
          const tenK = await fetch10KData(secClient, ticker);
          if (tenK) {
            upsertTenKCache({
              ticker,
              item1Business: tenK.item1Business,
              item1ARiskFactors: tenK.item1ARiskFactors,
              filingDate: tenK.filingDate,
              documentUrl: tenK.documentUrl,
              fetchedAt: new Date().toISOString(),
            });
            tenKText = format10KForPrompt(tenK);
            const item1Len = tenK.item1Business?.length ?? 0;
            const item1aLen = tenK.item1ARiskFactors?.length ?? 0;
            console.log(`  ✅ 10-K: ${tenK.filingDate} (Item1: ${item1Len} chars, Item1A: ${item1aLen} chars)`);
          } else {
            console.log('  ⚠️  10-K: 找不到10-K文件');
          }
        }
      } catch (e) {
        console.log(`  ⚠️  10-K数据获取失败: ${e instanceof Error ? e.message : e}`);
      }
    } else {
      console.log('\n─── Step 2/5: Skipped (legacy mode) ───');
    }

    // ── Step 3: LLM Analysis ──────────────────────────────────────────────────
    console.log('\n─── Step 3/5: Running LLM Analysis ───');
    console.log(`  🤖 Sending to ${modelKey} via OpenRouter...`);

    const llmClient = new LlmClient(modelKey);
    const messages = useLegacy
      ? buildPromptMessages(financial, historicalQuarters, annualSnapshots)
      : buildCrossValidationMessages(financial, historicalQuarters, annualSnapshots, tenKText, newsText);

    const startTime = Date.now();
    const llmResponse = await llmClient.chat(messages);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ✅ Response received (${elapsed}s, ${llmResponse.usage.totalTokens.toLocaleString()} tokens)`);

    // ── Step 4: Parse & Validate ──────────────────────────────────────────────
    console.log('\n─── Step 4/5: Parsing & Validating ───');

    const financialText = formatFinancialTable(financial, historicalQuarters, annualSnapshots);

    if (useLegacy) {
      const analysis = parseAnalysisResponse(
        llmResponse.content,
        ticker, year, quarter, modelKey, PROMPT_VERSION, llmResponse.usage,
      );
      console.log(`  ✅ Parsed: ${analysis.verdict} (confidence: ${analysis.verdictConfidence}/100)`);

      const validation = validateEvidence(analysis, financialText);
      console.log(`  🔍 Evidence validation: ${validation.verifiedCount}/${validation.totalEvidence} verified`);

      saveAnalysis({
        ticker, year, quarter,
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

      // Step 5: Generate Report
      console.log('\n─── Step 5/5: Generating Report ───');
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
        saveReport({ ticker, year, quarter, markdownContent: markdown, filePath: mdPath, generatedAt: new Date().toISOString() });
      }

      console.log('\n═══════════════════════════════════════');
      console.log(`  ${analysis.verdict} — ${ticker} FY${year} Q${quarter}`);
      console.log(`  Confidence: ${analysis.verdictConfidence}/100`);
      console.log(`  Catalysts: ${analysis.catalysts.length} | Risks: ${analysis.risks.length}`);
      console.log(`  Evidence: ${validation.verifiedCount}/${validation.totalEvidence} verified`);
      console.log('═══════════════════════════════════════\n');
    } else {
      // Cross-validation mode
      const analysis = parseCrossValidationResponse(
        llmResponse.content,
        ticker, year, quarter, modelKey, CROSS_VALIDATION_PROMPT_VERSION, llmResponse.usage,
      );
      console.log(`  ✅ Parsed: ${analysis.verdict}`);

      const validation = validateCrossEvidence(analysis, {
        financialText,
        tenKText,
        newsText,
      });
      console.log(`  🔍 Evidence validation: ${validation.verifiedCount}/${validation.totalEvidence} verified`);
      if (validation.failedCount > 0) {
        console.log(`  ⚠️  ${validation.failedCount} unverified citation(s)`);
      }

      saveCrossValidationAnalysis({
        ticker, year, quarter,
        promptVersion: CROSS_VALIDATION_PROMPT_VERSION,
        modelId: modelKey,
        verdict: analysis.verdict,
        verdictConfidence: 0, // Cross-validation doesn't use a numeric confidence
        thesisSummary: analysis.conclusion.slice(0, 500),
        dimensionsJson: JSON.stringify(analysis.dimensions),
        catalystsJson: JSON.stringify(analysis.catalysts),
        risksJson: JSON.stringify(analysis.risks),
        trackingMetricsJson: '[]',
        conclusion: analysis.conclusion,
        landscapeAnalysis: analysis.landscapeAnalysis,
        riskWarning: analysis.riskWarning,
        rawLlmOutput: llmResponse.content,
        promptTokens: llmResponse.usage.promptTokens,
        completionTokens: llmResponse.usage.completionTokens,
        totalTokens: llmResponse.usage.totalTokens,
        analyzedAt: analysis.analyzedAt,
      });

      // Step 5: Generate Report
      console.log('\n─── Step 5/5: Generating Report ───');
      if (options.json) {
        const jsonPath = join(options.output, `${ticker}_${year}Q${quarter}_cv_${now()}.json`);
        ensureDir(options.output);
        writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
        console.log(`  📄 JSON report: ${jsonPath}`);
      } else {
        const markdown = renderCrossValidationReport(analysis, financial, validation);
        const mdPath = join(options.output, `${ticker}_${year}Q${quarter}_cv_${now()}.md`);
        ensureDir(options.output);
        writeFileSync(mdPath, markdown);
        console.log(`  📄 Markdown report: ${mdPath}`);
        saveReport({ ticker, year, quarter, markdownContent: markdown, filePath: mdPath, generatedAt: new Date().toISOString() });
      }

      console.log('\n═══════════════════════════════════════');
      console.log(`  ${analysis.verdict} — ${ticker} FY${year} Q${quarter}`);
      console.log(`  8维度交叉验证 | Catalysts: ${analysis.catalysts.length} | Risks: ${analysis.risks.length}`);
      console.log(`  Evidence: ${validation.verifiedCount}/${validation.totalEvidence} verified`);
      console.log('═══════════════════════════════════════\n');
    }
  });

function now(): string {
  return new Date().toISOString().split('T')[0].replace(/-/g, '');
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
