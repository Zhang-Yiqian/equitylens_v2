import 'dotenv/config';
import { Command } from 'commander';
import { listCommand } from './commands/list.js';
import { fetchCommand } from './commands/fetch.js';
import { analyzeCommand } from './commands/analyze.js';
import { batchCommand } from './commands/batch.js';

const program = new Command();

program
  .name('elens')
  .description('EquityLens v2 — AI Inflection Point Discovery for US Equities')
  .version('0.1.0');

program.addCommand(listCommand);
program.addCommand(fetchCommand);
program.addCommand(analyzeCommand);
program.addCommand(batchCommand);

program.parse();
