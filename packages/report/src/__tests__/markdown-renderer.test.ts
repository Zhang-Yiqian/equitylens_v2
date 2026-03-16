import { describe, it, expect } from 'vitest';
import { renderMarkdownReport } from '../markdown-renderer.js';
import type { InflectionAnalysis, FinancialSnapshot } from '@equitylens/core';

// --- Mock data ---

const MOCK_ANALYSIS: InflectionAnalysis = {
  ticker: 'NVDA',
  year: 2025,
  quarter: 4,
  modelId: 'gemini-2.5-pro',
  promptVersion: 'v1.0',
  verdict: 'Conviction Buy',
  verdictConfidence: 85,
  thesisSummary: 'NVIDIA remains the dominant AI infrastructure provider with accelerating data center revenue.',
  dimensions: [
    {
      id: 'A1',
      name: 'RPO/Deferred Revenue Surge',
      category: 'A',
      signal: 'bullish',
      confidence: 90,
      summary: 'Deferred revenue increased 30% QoQ driven by data center demand.',
      evidence: [
        { quote: 'Deferred revenue grew to $764M from $580M last quarter', source: 'financial' },
      ],
    },
    {
      id: 'A2',
      name: 'FCF Conversion Inflection',
      category: 'A',
      signal: 'bullish',
      confidence: 88,
      summary: 'FCF margin expanded significantly.',
      evidence: [
        { quote: 'Free cash flow was $15.5 billion', source: 'financial' },
      ],
    },
    {
      id: 'A3',
      name: 'Gross Margin Step-up',
      category: 'A',
      signal: 'neutral',
      confidence: 60,
      summary: 'Gross margins stable around 73-74%.',
      evidence: [],
    },
    {
      id: 'B1',
      name: 'Supply Chain Bottleneck Resolution',
      category: 'B',
      signal: 'bullish',
      confidence: 75,
      summary: 'CoWoS capacity constraints easing.',
      evidence: [
        { quote: 'Improved supply from manufacturing partners', source: 'transcript' },
      ],
    },
    {
      id: 'B2',
      name: 'Hyperscaler CAPEX Lock-in',
      category: 'B',
      signal: 'bullish',
      confidence: 95,
      summary: 'All major hyperscalers increasing AI CAPEX.',
      evidence: [],
    },
    {
      id: 'B3',
      name: 'ASP/Unit Value Uplift',
      category: 'B',
      signal: 'bullish',
      confidence: 85,
      summary: 'Blackwell pricing 2-3x higher than Hopper.',
      evidence: [],
    },
    {
      id: 'C1',
      name: 'Customer ROI Validation',
      category: 'C',
      signal: 'skipped',
      confidence: 0,
      summary: 'Not directly applicable.',
      evidence: [],
    },
    {
      id: 'C2',
      name: 'Compute Economics Inflection',
      category: 'C',
      signal: 'bullish',
      confidence: 80,
      summary: 'Blackwell offers 4x inference throughput improvement.',
      evidence: [],
    },
    {
      id: 'C3',
      name: 'Legacy Business Cannibalization Defense',
      category: 'C',
      signal: 'skipped',
      confidence: 0,
      summary: 'Not applicable.',
      evidence: [],
    },
    {
      id: 'D1',
      name: 'Management Defensive Evasion',
      category: 'D',
      signal: 'neutral',
      confidence: 65,
      summary: 'Management was forthcoming.',
      evidence: [],
    },
    {
      id: 'D2',
      name: 'Guidance Unusual Confidence',
      category: 'D',
      signal: 'bullish',
      confidence: 90,
      summary: 'Unusually specific guidance.',
      evidence: [
        { quote: 'We expect data center revenue to grow sequentially', source: 'transcript' },
      ],
    },
    {
      id: 'D3',
      name: 'Analyst Tone Reversal',
      category: 'D',
      signal: 'bullish',
      confidence: 70,
      summary: 'Previously cautious analysts raising targets.',
      evidence: [],
    },
  ],
  catalysts: [
    {
      description: 'Blackwell full ramp in Q2-Q3 FY2026',
      timeline: '3-6 months',
      evidence: [
        { quote: 'Blackwell production is ramping and demand is staggering', source: 'transcript' },
      ],
      probability: 'high',
    },
    {
      description: 'Sovereign AI infrastructure buildout',
      timeline: '6-12 months',
      evidence: [],
      probability: 'medium',
    },
  ],
  risks: [
    {
      description: 'China export restrictions tightening',
      severity: 'medium',
      evidence: [
        { quote: 'China revenue was significant in prior quarters', source: 'financial' },
      ],
    },
    {
      description: 'Gross margin compression during Blackwell ramp',
      severity: 'low',
      evidence: [],
    },
  ],
  trackingMetrics: [
    {
      metric: 'Data Center Revenue',
      currentValue: '$35.1B',
      targetValue: '>$38B',
      nextCheckDate: '2025-05-28',
    },
    {
      metric: 'Gross Margin',
      currentValue: '73.5%',
      targetValue: '>73%',
      nextCheckDate: '2025-05-28',
    },
  ],
  tokenUsage: { promptTokens: 50000, completionTokens: 8000, totalTokens: 58000 },
  analyzedAt: '2025-03-14T00:00:00.000Z',
};

const MOCK_FINANCIAL: FinancialSnapshot = {
  ticker: 'NVDA',
  year: 2025,
  quarter: 4,
  revenue: 39_331_000_000,
  netIncome: 22_091_000_000,
  grossMargin: 28_918_000_000,
  operatingCashFlow: 16_632_000_000,
  freeCashFlow: 15_540_000_000,
  rdExpense: 3_430_000_000,
  sharesOutstanding: 24_600_000_000,
  totalAssets: 111_601_000_000,
  totalLiabilities: 30_882_000_000,
  eps: 0.89,
  marketCap: 3_200_000_000_000,
  peRatio: 55.2,
  revenueGrowthYoY: null,
  grossMarginPct: 73.5,
  fcfMarginPct: 39.5,
  deferredRevenue: 764_000_000,
  rpo: 2_500_000_000,
  source: 'merged',
  fetchedAt: '2025-03-14T00:00:00.000Z',
};

describe('renderMarkdownReport', () => {
  it('output contains ticker in header', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('# NVDA Inflection Analysis Report');
  });

  it('output contains verdict "Conviction Buy"', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('Conviction Buy');
  });

  it('output contains verdict "Watch" when applicable', () => {
    const watchAnalysis = { ...MOCK_ANALYSIS, verdict: 'Watch' as const };
    const output = renderMarkdownReport(watchAnalysis, MOCK_FINANCIAL);
    expect(output).toContain('Watch');
  });

  it('output contains verdict "Avoid" when applicable', () => {
    const avoidAnalysis = { ...MOCK_ANALYSIS, verdict: 'Avoid' as const };
    const output = renderMarkdownReport(avoidAnalysis, MOCK_FINANCIAL);
    expect(output).toContain('Avoid');
  });

  it('output contains all 12 dimension IDs (A1 through D3)', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    const dimensionIds = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3'];
    for (const id of dimensionIds) {
      expect(output).toContain(id);
    }
  });

  it('output contains catalysts section', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('## Catalysts');
    expect(output).toContain('Blackwell full ramp in Q2-Q3 FY2026');
    expect(output).toContain('Sovereign AI infrastructure buildout');
  });

  it('output contains risks section', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('## Risks');
    expect(output).toContain('China export restrictions tightening');
    expect(output).toContain('Gross margin compression during Blackwell ramp');
  });

  it('output contains tracking metrics table', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('## Tracking Metrics');
    expect(output).toContain('| Metric | Current | Target | Check Date |');
    expect(output).toContain('Data Center Revenue');
    expect(output).toContain('$35.1B');
    expect(output).toContain('>$38B');
    expect(output).toContain('2025-05-28');
  });

  it('output contains evidence validation summary when provided', () => {
    const validationSummary = {
      verifiedCount: 8,
      totalEvidence: 10,
      failedCount: 2,
    };

    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL, validationSummary);

    expect(output).toContain('## Evidence Validation');
    expect(output).toContain('**Total evidence citations**: 10');
    expect(output).toContain('**Verified**: 8 (80%)');
    expect(output).toContain('**Unverified**: 2');
  });

  it('output does not contain evidence validation section when not provided', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).not.toContain('## Evidence Validation');
  });

  it('financial values formatted correctly in the report', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);

    // Revenue: $39.33B
    expect(output).toContain('$39.33B');
    // Net Income: $22.09B
    expect(output).toContain('$22.09B');
    // FCF: $15.54B
    expect(output).toContain('$15.54B');
    // R&D: $3.43B
    expect(output).toContain('$3.43B');
    // Market Cap: $3200.00B
    expect(output).toContain('$3200.00B');
    // Deferred Revenue: $764.00M
    expect(output).toContain('$764.00M');
    // Gross Margin Pct: 73.5%
    expect(output).toContain('73.5%');
    // EPS
    expect(output).toContain('$0.89');
    // P/E Ratio
    expect(output).toContain('55.2x');
  });

  it('output contains model ID and prompt version', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('gemini-2.5-pro');
    expect(output).toContain('v1.0');
  });

  it('output contains thesis summary as blockquote', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('> NVIDIA remains the dominant AI infrastructure provider');
  });

  it('output contains token usage information', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('50,000 input');
    expect(output).toContain('8,000 output');
    expect(output).toContain('58,000 total');
  });

  it('output contains signal summary table', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('### Signal Summary');
    expect(output).toContain('| Dimension | Signal | Confidence |');
  });

  it('output contains EquityLens footer', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('Report generated by EquityLens v2');
  });

  it('output contains Financial Snapshot section header', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('## Financial Snapshot (Hard Truth)');
  });

  it('handles null financial values with 缺失', () => {
    const financialWithNulls: FinancialSnapshot = {
      ...MOCK_FINANCIAL,
      revenue: null,
      netIncome: null,
      grossMarginPct: null,
      eps: null,
      peRatio: null,
      deferredRevenue: null,
    };

    const output = renderMarkdownReport(MOCK_ANALYSIS, financialWithNulls);
    // Should show 缺失 for null values
    expect(output).toContain('缺失');
  });

  it('evidence quotes are rendered in report', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('Deferred revenue grew to $764M from $580M last quarter');
    expect(output).toContain('Blackwell production is ramping and demand is staggering');
  });

  it('dimension categories have correct section headers', () => {
    const output = renderMarkdownReport(MOCK_ANALYSIS, MOCK_FINANCIAL);
    expect(output).toContain('[A] Financial Leading Indicators');
    expect(output).toContain('[B] Hardware/Semiconductor');
    expect(output).toContain('[C] Software/SaaS');
    expect(output).toContain('[D] Sentiment & Game Theory');
  });
});
