import { Command } from 'commander';
import { MVP_TICKERS } from '@equitylens/core';

export const listCommand = new Command('list')
  .description('List available MVP tickers')
  .action(() => {
    console.log('\n📋 EquityLens MVP Tickers (10 AI Industry Chain Companies)\n');
    console.log('  Ticker  │ Company                    │ Sector          │ Node');
    console.log('─────────┼────────────────────────────┼─────────────────┼──────────────────────────');

    for (const t of MVP_TICKERS) {
      const ticker = t.ticker.padEnd(7);
      const name = t.name.padEnd(26);
      const sector = t.sector.padEnd(15);
      console.log(`  ${ticker} │ ${name} │ ${sector} │ ${t.node}`);
    }

    console.log(`\nTotal: ${MVP_TICKERS.length} tickers\n`);
  });
