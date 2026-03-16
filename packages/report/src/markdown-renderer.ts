import type { InflectionAnalysis, FinancialSnapshot, Report } from '@equitylens/core';
import { formatFinancialValue, DIMENSIONS } from '@equitylens/core';

export function renderMarkdownReport(
  analysis: InflectionAnalysis,
  financial: FinancialSnapshot,
  validationSummary?: { verifiedCount: number; totalEvidence: number; failedCount: number },
): string {
  const lines: string[] = [];
  const now = new Date();

  // Header
  lines.push(`# ${analysis.ticker} Inflection Analysis Report`);
  lines.push(`**Period**: FY${analysis.year} Q${analysis.quarter} | **Generated**: ${now.toISOString().split('T')[0]} | **Model**: ${analysis.modelId}`);
  lines.push(`**Prompt Version**: ${analysis.promptVersion}`);
  lines.push('');

  // Verdict
  lines.push('---');
  lines.push('## Verdict');
  lines.push('');
  const verdictEmoji = analysis.verdict === 'Conviction Buy' ? '🟢' : analysis.verdict === 'Watch' ? '🟡' : '🔴';
  lines.push(`### ${verdictEmoji} ${analysis.verdict} (Confidence: ${analysis.verdictConfidence}/100)`);
  lines.push('');
  lines.push(`> ${analysis.thesisSummary}`);
  lines.push('');

  // Token Usage & Cost
  const modelCost = estimateCost(analysis.tokenUsage);
  lines.push(`*Token usage: ${analysis.tokenUsage.promptTokens.toLocaleString()} input + ${analysis.tokenUsage.completionTokens.toLocaleString()} output = ${analysis.tokenUsage.totalTokens.toLocaleString()} total (~$${modelCost})*`);
  lines.push('');

  // Financial Snapshot
  lines.push('---');
  lines.push('## Financial Snapshot (Hard Truth)');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Revenue | ${formatFinancialValue(financial.revenue)} |`);
  lines.push(`| Net Income | ${formatFinancialValue(financial.netIncome)} |`);
  lines.push(`| Gross Margin | ${financial.grossMarginPct !== null ? financial.grossMarginPct.toFixed(1) + '%' : '缺失'} |`);
  lines.push(`| Operating Cash Flow | ${formatFinancialValue(financial.operatingCashFlow)} |`);
  lines.push(`| Free Cash Flow | ${formatFinancialValue(financial.freeCashFlow)} |`);
  lines.push(`| FCF Margin | ${financial.fcfMarginPct !== null ? financial.fcfMarginPct.toFixed(1) + '%' : '缺失'} |`);
  lines.push(`| R&D Expense | ${formatFinancialValue(financial.rdExpense)} |`);
  lines.push(`| EPS (Diluted) | ${financial.eps !== null ? '$' + financial.eps.toFixed(2) : '缺失'} |`);
  lines.push(`| Market Cap | ${formatFinancialValue(financial.marketCap)} |`);
  lines.push(`| P/E Ratio | ${financial.peRatio !== null ? financial.peRatio.toFixed(1) + 'x' : '缺失'} |`);
  lines.push(`| Deferred Revenue | ${formatFinancialValue(financial.deferredRevenue)} |`);
  lines.push('');

  // 12 Dimensions
  lines.push('---');
  lines.push('## 12-Dimension Inflection Analysis');
  lines.push('');

  const categories = ['A', 'B', 'C', 'D'] as const;
  const categoryNames: Record<string, string> = {
    A: 'Financial Leading Indicators (财务先行指标)',
    B: 'Hardware/Semiconductor (硬件/半导体纵深)',
    C: 'Software/SaaS (软件/SaaS纵深)',
    D: 'Sentiment & Game Theory (情绪与博弈)',
  };

  for (const cat of categories) {
    const catDims = analysis.dimensions.filter(d => d.category === cat);
    if (catDims.length === 0) continue;

    lines.push(`### [${cat}] ${categoryNames[cat]}`);
    lines.push('');

    for (const dim of catDims) {
      const signalIcon = dim.signal === 'bullish' ? '📈'
        : dim.signal === 'bearish' ? '📉'
        : dim.signal === 'skipped' ? '⏭️'
        : '➡️';

      const dimDef = DIMENSIONS.find(d => d.id === dim.id);
      const nameZh = dimDef?.nameZh || '';

      lines.push(`#### ${dim.id}: ${dim.name} (${nameZh})`);
      lines.push(`**Signal**: ${signalIcon} ${dim.signal.toUpperCase()} | **Confidence**: ${dim.confidence}/100`);
      lines.push('');
      lines.push(dim.summary);
      lines.push('');

      if (dim.evidence.length > 0) {
        lines.push('**Evidence:**');
        for (const ev of dim.evidence) {
          lines.push(`- > "${ev.quote}" *(${ev.source})*`);
        }
        lines.push('');
      }
    }
  }

  // Signal Summary Table
  lines.push('### Signal Summary');
  lines.push('');
  lines.push('| Dimension | Signal | Confidence |');
  lines.push('|-----------|--------|------------|');
  for (const dim of analysis.dimensions) {
    const icon = dim.signal === 'bullish' ? '📈' : dim.signal === 'bearish' ? '📉' : dim.signal === 'skipped' ? '⏭️' : '➡️';
    lines.push(`| ${dim.id}: ${dim.name} | ${icon} ${dim.signal} | ${dim.confidence} |`);
  }
  lines.push('');

  // Catalysts
  lines.push('---');
  lines.push('## Catalysts');
  lines.push('');
  for (const cat of analysis.catalysts) {
    const probIcon = cat.probability === 'high' ? '🔥' : cat.probability === 'medium' ? '⚡' : '💡';
    lines.push(`### ${probIcon} ${cat.description}`);
    lines.push(`**Timeline**: ${cat.timeline} | **Probability**: ${cat.probability}`);
    lines.push('');
    if (cat.evidence.length > 0) {
      for (const ev of cat.evidence) {
        lines.push(`> "${ev.quote}" *(${ev.source})*`);
      }
      lines.push('');
    }
  }

  // Risks
  lines.push('---');
  lines.push('## Risks');
  lines.push('');
  for (const risk of analysis.risks) {
    const sevIcon = risk.severity === 'high' ? '🚨' : risk.severity === 'medium' ? '⚠️' : 'ℹ️';
    lines.push(`### ${sevIcon} ${risk.description}`);
    lines.push(`**Severity**: ${risk.severity}`);
    lines.push('');
    if (risk.evidence.length > 0) {
      for (const ev of risk.evidence) {
        lines.push(`> "${ev.quote}" *(${ev.source})*`);
      }
      lines.push('');
    }
  }

  // Tracking Metrics
  lines.push('---');
  lines.push('## Tracking Metrics (Next Quarter Checklist)');
  lines.push('');
  lines.push('| Metric | Current | Target | Check Date |');
  lines.push('|--------|---------|--------|------------|');
  for (const tm of analysis.trackingMetrics) {
    lines.push(`| ${tm.metric} | ${tm.currentValue} | ${tm.targetValue} | ${tm.nextCheckDate} |`);
  }
  lines.push('');

  // Validation
  if (validationSummary) {
    lines.push('---');
    lines.push('## Evidence Validation');
    lines.push('');
    const pct = validationSummary.totalEvidence > 0
      ? ((validationSummary.verifiedCount / validationSummary.totalEvidence) * 100).toFixed(0)
      : '0';
    lines.push(`- **Total evidence citations**: ${validationSummary.totalEvidence}`);
    lines.push(`- **Verified**: ${validationSummary.verifiedCount} (${pct}%)`);
    lines.push(`- **Unverified**: ${validationSummary.failedCount}`);
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`*Report generated by EquityLens v2 | ${now.toISOString()}*`);

  return lines.join('\n');
}

function estimateCost(usage: { promptTokens: number; completionTokens: number }): string {
  // Rough estimate using Gemini 2.5 Pro pricing
  const inputCost = (usage.promptTokens / 1_000_000) * 1.25;
  const outputCost = (usage.completionTokens / 1_000_000) * 10;
  return (inputCost + outputCost).toFixed(4);
}
