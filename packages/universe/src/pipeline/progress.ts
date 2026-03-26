import type { FunnelStats, ChainDistribution, SupplyChainTag } from '@equitylens/core';

const TAG_LABELS: Record<SupplyChainTag, string> = {
  gpu_accelerators: 'GPU/加速器',
  storage: '存储',
  optical_modules: '光模块',
  semiconductors: '半导体',
  eda_ip: 'EDA/IP',
  servers_oem: '服务器/OEM',
  data_center: '数据中心',
  cloud: '云服务',
  llm_platforms: '大模型平台',
  ai_saas: 'AI SaaS',
  networking: '网络设备',
  power_thermal: '电力/散热',
  materials: '材料',
  capital_formation: '资本服务',
  software_dev: '软件开发',
  none: '未分类',
};

const BAR_WIDTH = 30;

function bar(count: number, total: number): string {
  if (total === 0) return '░'.repeat(BAR_WIDTH);
  const filled = Math.round((count / total) * BAR_WIDTH);
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
}

/**
 * Print the funnel progress with a visual bar chart.
 */
export function printProgress(
  stage: 'L1' | 'L2' | 'L3' | 'hard' | 'compliance',
  count: number,
  total: number,
): void {
  const pct = total > 0 ? ((count / total) * 100).toFixed(2) : '0.00';
  const barStr = bar(count, total);
  console.log(`  ${barStr}  ${count.toLocaleString()} / ${total.toLocaleString()} (${pct}%)  [${stage}]`);
}

/**
 * Print a full funnel table showing counts at each stage.
 */
export function printFunnelTable(stats: FunnelStats): void {
  console.log('\n┌─────────────────────────────────────────────┐');
  console.log('│          全市场 AI 标的漏斗统计              │');
  console.log('├───────────────────────┬─────────┬───────────┤');
  console.log('│ 阶段                   │  数量    │  累计通过率 │');
  console.log('├───────────────────────┼─────────┼───────────┤');

  const stages = [
    ['📥 Nasdaq 下载', stats.totalNasdaq],
    ['🚫 ETF/基金过滤', stats.afterBlacklist],
    ['🔍 L2 关键词命中', stats.l2Matches],
    ['🤖 L3 AI 纯度分类', stats.l3Classified],
    ['⭐ AI Core 最终池', stats.aiCore],
    ['🔗 AI Adjacent', stats.aiAdjacent],
    ['❌ Non-core', stats.nonCore],
    ['⚠️ API 失败', stats.l3ApiFailed],
  ] as const;

  const total = stats.totalNasdaq || 1;
  for (const [label, count] of stages) {
    const pct = ((count / total) * 100).toFixed(2).padStart(7);
    console.log(`│ ${label.padEnd(22)} │ ${String(count).padStart(7)} │ ${pct}%   │`);
  }

  console.log('└───────────────────────┴─────────┴───────────┘');
}

/**
 * Print supply chain distribution breakdown.
 */
export function printChainDistribution(distribution: ChainDistribution[]): void {
  if (distribution.length === 0) {
    console.log('\n  (暂无供应链接链分布数据)');
    return;
  }

  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  console.log('\n┌──────────────────────────────────────────────────────┐');
  console.log('│           AI 产业链分布 (AI Core 公司)                 │');
  console.log('├────────────────────────┬─────────┬─────────────────────┤');
  console.log('│ 产业链节点               │  数量   │ 分布图               │');
  console.log('├────────────────────────┼─────────┼─────────────────────┤');

  for (const { tag, count, tickers } of distribution) {
    const label = (TAG_LABELS[tag] ?? tag).padEnd(22);
    const tickerList = tickers.slice(0, 5).join(', ');
    const overflow = tickers.length > 5 ? ` +${tickers.length - 5}` : '';
    const mini = bar(count, maxCount).slice(0, 16);
    console.log(`│ ${label} │ ${String(count).padStart(5)}  │ ${mini} ${pctStr(count, total)} │`);
    if (tickerList) {
      console.log(`│   ↳ ${(tickerList + overflow).slice(0, 48).padEnd(48)} │`);
    }
  }

  console.log('└────────────────────────┴─────────┴─────────────────────┘');
}

function pctStr(count: number, total: number): string {
  return total > 0 ? `${(count / total * 100).toFixed(1).padStart(5)}%` : '  0.0%';
}

/**
 * Print L2 category breakdown.
 */
export function printL2CategoryBreakdown(
  l2Results: Array<{ matchedCategories: string[] }>,
): void {
  const counts = new Map<string, number>();
  for (const r of l2Results) {
    for (const cat of r.matchedCategories) {
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return;

  console.log('\n┌─────────────────────────────────────────────┐');
  console.log('│       L2 关键词类别命中分布                   │');
  console.log('├────────────────────────┬─────────┬──────────┤');
  console.log('│ 类别                    │  命中数  │ 占比     │');
  console.log('├────────────────────────┼─────────┼──────────┤');

  const total = sorted.reduce((s, [, c]) => s + c, 0);
  for (const [cat, count] of sorted) {
    const label = cat.padEnd(22);
    const pct = ((count / total) * 100).toFixed(1);
    console.log(`│ ${label} │ ${String(count).padStart(5)}  │ ${pct.padStart(6)}% │`);
  }
  console.log('└────────────────────────┴─────────┴──────────┘');
}
