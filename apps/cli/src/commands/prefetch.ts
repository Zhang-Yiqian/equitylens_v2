import { Command } from 'commander';
import { fetchNasdaqUniverse, isBlacklisted, isWhitelisted } from '@equitylens/universe';
import { getTenKCache, upsertTenKCache } from '@equitylens/store';
import { YahooClient, fetchYahooDescription } from '@equitylens/data';

export const prefetchCommand = new Command('prefetch')
  .description('预填充公司描述缓存（从 Yahoo Finance 拉取业务描述并存入本地数据库）')
  .option('--max <number>', '最多处理 N 个 ticker（用于测试）', (v) => parseInt(v))
  .option('--dry-run', '只显示需要抓取的 ticker 数量，不实际抓取', false)
  .option('--verbose', '显示详细进度', false)
  .option('--tickers <path>', '指定一个 .txt 文件，每行一个 ticker', (v) => v)
  .action(async (options) => {
    const verbose = Boolean((options as Record<string, unknown>).verbose);
    const dryRun = Boolean((options as Record<string, unknown>).dryRun);
    const max = (options as Record<string, unknown>).max as number | undefined;
    const tickersFile = (options as Record<string, unknown>).tickers as string | undefined;

    // Step 1: Get ticker list
    if (verbose) console.log('\n📥 Step 1: Loading ticker list…');
    let allTickers: string[] = [];

    if (tickersFile) {
      const fs = await import('node:fs');
      const content = fs.readFileSync(tickersFile, 'utf8');
      allTickers = content.split('\n').map(l => l.trim()).filter(Boolean);
      if (verbose) console.log(`  Loaded ${allTickers.length} tickers from ${tickersFile}`);
    } else {
      const rows = await fetchNasdaqUniverse({});
      allTickers = rows
        .filter(r => !isBlacklisted(r.companyName))
        .filter(r => !isWhitelisted(r.symbol))
        .map(r => r.symbol);
      if (verbose) console.log(`  Nasdaq universe: ${rows.length} tickers`);
    }

    // Apply max limit for dry run
    if (max !== undefined) {
      allTickers = allTickers.slice(0, max);
      if (verbose) console.log(`  Limited to first ${max} tickers`);
    }

    // Step 2: Check cache — filter out already-cached tickers
    if (verbose) console.log('\n📊 Step 2: Checking existing cache…');
    const toFetch: string[] = [];
    let cachedCount = 0;

    for (const t of allTickers) {
      const cached = getTenKCache(t);
      if (cached?.item1Business) {
        cachedCount++;
      } else {
        toFetch.push(t);
      }
    }

    if (verbose) {
      console.log(`  Already cached: ${cachedCount}`);
      console.log(`  Need to fetch: ${toFetch.length}`);
    }

    if (dryRun) {
      console.log(`\n🔍 Dry run — would fetch ${toFetch.length} tickers from Yahoo Finance`);
      return;
    }

    if (toFetch.length === 0) {
      console.log('\n✅ All tickers already cached. Nothing to do.');
      return;
    }

    // Step 3: Fetch from Yahoo Finance with concurrency
    if (verbose) {
      console.log(`\n📡 Step 3: Fetching business descriptions from Yahoo Finance…`);
      console.log(`   Source: Yahoo Finance quoteSummary.summaryProfile.longBusinessSummary`);
      console.log(`   Concurrency: 5 | ~200ms per ticker`);
    }

    const CONCURRENCY = 5;
    const client = new YahooClient();
    let done = 0;
    let errors = 0;
    let fetched = 0;
    const t0 = Date.now();

    for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
      const batch = toFetch.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async (ticker) => {
          const desc = await fetchYahooDescription(client, ticker);
          if (!desc) return null;
          return { ticker, desc };
        }),
      );

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled' && r.value) {
          upsertTenKCache({
            ticker: r.value.ticker,
            item1Business: r.value.desc,
            filingDate: new Date().toISOString(),
            documentUrl: '',
            fetchedAt: new Date().toISOString(),
          });
          fetched++;
        } else {
          errors++;
        }
        done++;
      }

      if (verbose) {
        const pct = ((done / toFetch.length) * 100).toFixed(1);
        const elapsed = Date.now() - t0;
        const rate = done / (elapsed / 1000);
        const eta = rate > 0 ? Math.ceil((toFetch.length - done) / rate / 60) : '?';
        process.stdout.write(
          `\r   [${pct.padStart(5)}%] ${done}/${toFetch.length} | ` +
          `Fetched: ${fetched} | Errors: ${errors} | ` +
          `${rate.toFixed(1)}/s | ETA: ${eta}min   `
        );
      }

      // Yahoo Finance rate limit: polite delay between batches
      if (i + CONCURRENCY < toFetch.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    const elapsed = Date.now() - t0;
    console.log(`\n\n✅ Prefetch complete`);
    console.log(`   Fetched: ${fetched}/${toFetch.length} tickers`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Time: ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`   Rate: ${(fetched / (elapsed / 1000)).toFixed(1)} tickers/sec`);
  });
