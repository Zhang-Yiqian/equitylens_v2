import { Command } from 'commander';
import { MVP_TICKERS } from '@equitylens/core';
import { DEFAULT_MODEL } from '@equitylens/engine';

export const batchCommand = new Command('batch')
  .description('Run inflection analysis on all 10 MVP tickers')
  .option('-q, --quarter <number>', 'Fiscal quarter (1-4)', '4')
  .option('-y, --year <number>', 'Fiscal year', '2024')
  .option('-m, --model <key>', 'LLM model key', DEFAULT_MODEL)
  .option('-o, --output <dir>', 'Report output directory', './reports')
  .option('--force-refresh', 'Bypass cache', false)
  .action(async (options) => {
    console.log('\n🚀 EquityLens Batch Analysis');
    console.log(`   Tickers: ${MVP_TICKERS.length} | Period: FY${options.year} Q${options.quarter} | Model: ${options.model}\n`);

    const results: Array<{ ticker: string; status: string; verdict?: string }> = [];

    for (let i = 0; i < MVP_TICKERS.length; i++) {
      const { ticker } = MVP_TICKERS[i];
      console.log(`\n[${ i + 1}/${MVP_TICKERS.length}] Processing ${ticker}...`);

      try {
        // Dynamically import and run analyze command logic
        const { analyzeCommand } = await import('./analyze.js');
        await analyzeCommand.parseAsync([
          ticker,
          '-q', options.quarter,
          '-y', options.year,
          '-m', options.model,
          '-o', options.output,
          ...(options.forceRefresh ? ['--force-refresh'] : []),
        ], { from: 'user' });
        results.push({ ticker, status: '✅', verdict: 'completed' });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ ${ticker} failed: ${msg}`);
        results.push({ ticker, status: '❌', verdict: msg.substring(0, 50) });
      }
    }

    // Summary
    console.log('\n═══ Batch Summary ═══\n');
    for (const r of results) {
      console.log(`  ${r.status} ${r.ticker.padEnd(7)} ${r.verdict || ''}`);
    }
    const successCount = results.filter(r => r.status === '✅').length;
    console.log(`\n  Total: ${successCount}/${results.length} successful\n`);
  });
