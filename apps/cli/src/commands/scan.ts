import { Command } from 'commander';
import { runScan, retryFailedL3, printFunnelTable, printChainDistribution } from '@equitylens/universe';
import type { ScanMode } from '@equitylens/core';

export const scanCommand = new Command('scan')
  .description('全市场 AI 标的漏斗扫描 — L1下载 → L2关键词 → L3 AI纯度分类 → 硬性门槛 → 合规熔断')
  .option('--full', '全量扫描（默认）', false)
  .option('--incremental', '增量刷新（只处理新增/变更 ticker）', false)
  .option('--retry-failed', '仅重试上次扫描中 L3 API 失败的 ticker（不走 L1/L2）', false)
  .option('--dry-run', '跳过 L3 Gemini 调用和数据库写入', false)
  .option('--skip-l3', '跳过 L3 Gemini AI 纯度分类', false)
  .option('--no-skip-hard', '不禁过滤硬性市场门槛（默认跳过）')
  .option('--no-skip-compliance', '不禁过滤合规熔断检查（默认跳过）')
  .option('--l2-only', '只做 L2 关键词匹配（快速预览）', false)
  .option('--max-l3 <number>', '限制 L3 处理前 N 家公司（用于测试）', (v) => parseInt(v))
  .option('--no-cache', '强制重新下载 Nasdaq 数据', false)
  .option('--ai-core-list <path>', '本地 .txt 文件（每行一个 ticker）作为 AI Core 池补充来源', (v) => v)
  .option('--no-l3-for-list', '对 --ai-core-list 中的 ticker 跳过 L3 分类，直接标记为 core', false)
  .option('-v, --verbose', '显示每步详细进度', false)
  .option('-q, --quiet', '静默模式（只显示最终结果）', false)
  .action(async (options) => {
    const opts = options as Record<string, unknown>;

    // ── Retry-failed mode ──────────────────────────────────────────────────────
    if (opts.retryFailed) {
      console.log('\n🔄 EquityLens — L3 失败重试模式\n');
      const result = await retryFailedL3({ verbose: Boolean(opts.verbose) });
      console.log(`\n✅ Retry complete — Updated: ${result.updated} | Still failed: ${result.stillFailed}\n`);
      if (result.errors.length > 0) {
        for (const err of result.errors) console.error(`   • ${err}`);
        process.exit(1);
      }
      return;
    }

    // Determine mode
    let mode: ScanMode = 'full';
    if (opts.incremental) mode = 'incremental';
    if (opts.dryRun) mode = 'dry_run';

    const verbose = Boolean(opts.verbose);
    const quiet = Boolean(opts.quiet);

    if (!verbose && !quiet) {
      console.log('\n🔬 EquityLens — 全市场 AI 标的漏斗扫描');
      console.log(`   模式: ${mode} | L2-Only: ${opts.l2Only} | SkipL3: ${opts.skipL3}`);
    }

    // Check for required env vars if L3 or compliance is needed
    const skipL3 = Boolean(opts.skipL3);
    const skipCompliance = Boolean(opts.skipCompliance);

    if (!skipL3 || !skipCompliance) {
      const missingKeys: string[] = [];
      if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY.startsWith('sk-or-your')) {
        missingKeys.push('OPENROUTER_API_KEY (register at https://openrouter.ai/)');
      }
      if (!skipCompliance) {
        if (!process.env.SEC_EDGAR_USER_AGENT || process.env.SEC_EDGAR_USER_AGENT.includes('YourName')) {
          missingKeys.push('SEC_EDGAR_USER_AGENT (e.g. "Your Name your@email.com")');
        }
      }
      if (missingKeys.length > 0) {
        console.error('\n❌ Missing required configuration in .env:\n');
        for (const k of missingKeys) console.error(`   • ${k}`);
        console.error('\nCopy .env.example to .env and fill in your API keys.\n');
        process.exit(1);
      }
    }

    const result = await runScan({
      mode,
      dryRun: Boolean(opts.dryRun),
      skipL3,
      skipHardFilter: Boolean(opts.skipHard),
      skipCompliance,
      l2Only: Boolean(opts.l2Only),
      maxL3: opts.maxL3 as number | undefined,
      noCache: Boolean(opts.noCache),
      verbose,
      signal: undefined,
      aiCoreListFile: opts.aiCoreList as string | undefined,
      noL3ForList: Boolean(opts.noL3ForList),
    });

    // Print summary
    if (!quiet) {
      console.log('\n');
      printFunnelTable(result.stats);

      if (result.chainDistribution.length > 0) {
        printChainDistribution(result.chainDistribution);
      }

      if (result.errors.length > 0) {
        console.error('\n⚠️  Errors encountered:');
        for (const err of result.errors) {
          console.error(`   • ${err}`);
        }
      }
    }

    console.log(`\n✅ Scan ${result.scanId} complete — ${result.stats.aiCore} AI Core | ${result.stats.aiAdjacent} Adjacent | ${result.durationMs}ms\n`);

    if (result.errors.length > 0) {
      process.exit(1);
    }
  });
