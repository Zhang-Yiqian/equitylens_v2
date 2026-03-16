import { describe, it, expect } from 'vitest';
import { validateEvidence } from '../validator.js';
import type { InflectionAnalysis } from '@equitylens/core';

// --- Source text for validation ---

const FINANCIAL_TEXT = `
Revenue: $39,331,000,000
Net Income: $22,091,000,000
Gross Margin: 73.5%
Operating Cash Flow: $16,632,000,000
Free Cash Flow: $15,540,000,000
R&D Expense: $3,430,000,000
EPS: $0.89
Deferred Revenue: $764,000,000
`;

function makeAnalysis(overrides?: Partial<InflectionAnalysis>): InflectionAnalysis {
  return {
    ticker: 'NVDA',
    year: 2025,
    quarter: 4,
    modelId: 'gemini-2.5-pro',
    promptVersion: 'v1.0',
    verdict: 'Conviction Buy',
    verdictConfidence: 85,
    thesisSummary: 'Strong AI infrastructure demand.',
    dimensions: [
      {
        id: 'A1',
        name: 'RPO/Deferred Revenue Surge',
        category: 'A',
        signal: 'bullish',
        confidence: 90,
        summary: 'Strong deferred revenue growth.',
        evidence: [
          { quote: 'Deferred Revenue: $764,000,000', source: 'financial' },
        ],
      },
      {
        id: 'B2',
        name: 'Hyperscaler CAPEX Lock-in',
        category: 'B',
        signal: 'bullish',
        confidence: 95,
        summary: 'Record data center revenue.',
        evidence: [
          { quote: 'Revenue: $39,331,000,000', source: 'financial' },
        ],
      },
    ],
    catalysts: [
      {
        description: 'Strong free cash flow generation',
        timeline: '3-6 months',
        evidence: [
          { quote: 'Free Cash Flow: $15,540,000,000', source: 'financial' },
        ],
        probability: 'high',
      },
    ],
    risks: [
      {
        description: 'High R&D spend',
        severity: 'medium',
        evidence: [
          { quote: 'R&D Expense: $3,430,000,000', source: 'financial' },
        ],
      },
    ],
    trackingMetrics: [
      { metric: 'DC Revenue', currentValue: '$35.1B', targetValue: '>$38B', nextCheckDate: '2025-05-28' },
    ],
    tokenUsage: { promptTokens: 50000, completionTokens: 8000, totalTokens: 58000 },
    analyzedAt: '2025-03-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('validateEvidence', () => {
  it('verifies exact quote match', () => {
    const analysis = makeAnalysis();
    const result = validateEvidence(analysis, FINANCIAL_TEXT);

    // All quotes from makeAnalysis exist verbatim in the source texts
    expect(result.verifiedCount).toBeGreaterThan(0);
    expect(result.failedCount).toBe(0);
    expect(result.isValid).toBe(true);
  });

  it('verifies fuzzy match (>70% words match)', () => {
    // Slightly altered quote - most significant words still present
    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'A1',
          name: 'RPO/Deferred Revenue Surge',
          category: 'A',
          signal: 'bullish',
          confidence: 90,
          summary: 'Deferred revenue growth.',
          evidence: [
            {
              quote: 'Deferred Revenue reached approximately $764,000,000 in the period',
              source: 'financial',
            },
          ],
        },
      ],
    });

    const result = validateEvidence(analysis, FINANCIAL_TEXT);

    // Key words (deferred, revenue, $764,000,000) match
    expect(result.isValid).toBe(true);
  });

  it('marks fabricated quote as failed', () => {
    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'A1',
          name: 'RPO/Deferred Revenue Surge',
          category: 'A',
          signal: 'bullish',
          confidence: 90,
          summary: 'Made up data.',
          evidence: [
            {
              quote: 'The company announced a breakthrough quantum computing partnership with SpaceX for lunar infrastructure deployment',
              source: 'financial',
            },
          ],
        },
      ],
      catalysts: [],
      risks: [],
    });

    const result = validateEvidence(analysis, FINANCIAL_TEXT);

    expect(result.failedCount).toBeGreaterThan(0);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0].dimensionId).toBe('A1');
  });

  it('auto-passes short quotes (<10 chars)', () => {
    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'A1',
          name: 'RPO/Deferred Revenue Surge',
          category: 'A',
          signal: 'bullish',
          confidence: 90,
          summary: 'Short ref.',
          evidence: [
            { quote: '$764M', source: 'financial' },
          ],
        },
      ],
      catalysts: [],
      risks: [],
    });

    const result = validateEvidence(analysis, FINANCIAL_TEXT);

    expect(result.verifiedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.isValid).toBe(true);
  });

  it('skipped dimensions are not counted', () => {
    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'C1',
          name: 'Customer ROI Validation',
          category: 'C',
          signal: 'skipped',
          confidence: 0,
          summary: 'Not applicable.',
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
      ],
      catalysts: [],
      risks: [],
    });

    const result = validateEvidence(analysis, FINANCIAL_TEXT);

    expect(result.skippedCount).toBe(2);
    expect(result.totalEvidence).toBe(0);
  });

  it('anti-hallucination: analysis with many fake quotes → isValid=false when >20% fail', () => {
    // 5 total evidence items: 4 fake, 1 real = 80% fail rate → should be invalid
    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'A1',
          name: 'RPO/Deferred Revenue Surge',
          category: 'A',
          signal: 'bullish',
          confidence: 90,
          summary: 'Fabricated.',
          evidence: [
            { quote: 'We have completely disrupted the autonomous vehicle market with revolutionary technology', source: 'financial' },
            { quote: 'Our quantum computing division generated extraordinary returns beyond expectations', source: 'financial' },
          ],
        },
        {
          id: 'B1',
          name: 'Supply Chain Bottleneck Resolution',
          category: 'B',
          signal: 'bullish',
          confidence: 80,
          summary: 'Fabricated evidence.',
          evidence: [
            { quote: 'The biotech synergy initiative created unprecedented shareholder value through mergers', source: 'financial' },
            { quote: 'We secured exclusive contracts with every major telecommunications provider globally', source: 'financial' },
          ],
        },
      ],
      catalysts: [
        {
          description: 'Real catalyst',
          timeline: '3 months',
          evidence: [
            { quote: 'Free Cash Flow: $15,540,000,000', source: 'financial' },
          ],
          probability: 'high',
        },
      ],
      risks: [],
    });

    const result = validateEvidence(analysis, FINANCIAL_TEXT);

    expect(result.totalEvidence).toBe(5);
    expect(result.failedCount).toBe(4);
    expect(result.verifiedCount).toBe(1);
    // 4/5 = 80% fail rate, which is > 20% threshold
    expect(result.isValid).toBe(false);
  });

  it('isValid=true when failure rate is below 20%', () => {
    // 5 real quotes, 1 fake = 1/6 ≈ 16.7% fail rate → should still be valid
    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'A1',
          name: 'RPO/Deferred Revenue Surge',
          category: 'A',
          signal: 'bullish',
          confidence: 90,
          summary: 'Strong.',
          evidence: [
            { quote: 'Deferred Revenue: $764,000,000', source: 'financial' },
            { quote: 'Revenue: $39,331,000,000', source: 'financial' },
          ],
        },
        {
          id: 'B1',
          name: 'Supply Chain Bottleneck Resolution',
          category: 'B',
          signal: 'bullish',
          confidence: 80,
          summary: 'Good.',
          evidence: [
            { quote: 'Net Income: $22,091,000,000', source: 'financial' },
            { quote: 'Free Cash Flow: $15,540,000,000', source: 'financial' },
          ],
        },
      ],
      catalysts: [
        {
          description: 'Growth',
          timeline: '3 months',
          evidence: [
            { quote: 'Operating Cash Flow: $16,632,000,000', source: 'financial' },
          ],
          probability: 'high',
        },
      ],
      risks: [
        {
          description: 'Fake risk',
          severity: 'low',
          evidence: [
            { quote: 'The extraterrestrial mining division showed volatile performance metrics', source: 'financial' },
          ],
        },
      ],
    });

    const result = validateEvidence(analysis, FINANCIAL_TEXT);

    expect(result.totalEvidence).toBe(6);
    expect(result.failedCount).toBe(1);
    // 1/6 ≈ 16.7% < 20% → valid
    expect(result.isValid).toBe(true);
  });

  it('verifies Chinese evidence with number extraction against markdown table', () => {
    // Simulate the real scenario: LLM sees markdown table, outputs Chinese with embedded numbers
    const markdownSource = `| Metric | Current | Prior Period | Change |
|--------|---------|-------------|--------|
| Revenue | $39.33B | N/A | N/A |
| Net Income | $22.09B | N/A | N/A |
| Gross Margin % | 73.5% | N/A | N/A |
| Free Cash Flow | $15.54B | N/A | N/A |
| EPS (Diluted) | $0.89 | N/A | N/A |`;

    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'A1',
          name: 'RPO/Deferred Revenue Surge',
          category: 'A',
          signal: 'bullish',
          confidence: 90,
          summary: 'Strong financials.',
          evidence: [
            { quote: '营收达$39.33B，净利润$22.09B，显示强劲增长', source: 'financial' },
          ],
        },
      ],
      catalysts: [],
      risks: [],
    });

    const result = validateEvidence(analysis, markdownSource);
    expect(result.verifiedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it('verifies mixed Chinese-English evidence with numbers', () => {
    const markdownSource = `| Metric | Current | Prior Period | Change |
|--------|---------|-------------|--------|
| Revenue | $39.33B | $30.04B | +30.9% |
| Gross Margin % | 73.5% | 70.1% | +4.8% |
| Free Cash Flow | $15.54B | N/A | N/A |`;

    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'B2',
          name: 'Hyperscaler CAPEX Lock-in',
          category: 'B',
          signal: 'bullish',
          confidence: 95,
          summary: 'Revenue growth strong.',
          evidence: [
            { quote: 'Revenue同比增长30.9%至$39.33B，毛利率维持73.5%高位', source: 'financial' },
          ],
        },
      ],
      catalysts: [],
      risks: [],
    });

    const result = validateEvidence(analysis, markdownSource);
    expect(result.verifiedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it('rejects Chinese evidence with fabricated numbers (anti-hallucination)', () => {
    const markdownSource = `| Metric | Current | Prior Period | Change |
|--------|---------|-------------|--------|
| Revenue | $39.33B | N/A | N/A |
| Net Income | $22.09B | N/A | N/A |`;

    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'A1',
          name: 'RPO/Deferred Revenue Surge',
          category: 'A',
          signal: 'bullish',
          confidence: 90,
          summary: 'Fabricated.',
          evidence: [
            { quote: '营收突破$85.7B，净利润达$50.2B，远超市场预期', source: 'financial' },
          ],
        },
      ],
      catalysts: [],
      risks: [],
    });

    const result = validateEvidence(analysis, markdownSource);
    expect(result.failedCount).toBe(1);
    expect(result.verifiedCount).toBe(0);
  });

  it('verifies English quote directly from markdown table source', () => {
    const markdownSource = `| Metric | Current | Prior Period | Change |
|--------|---------|-------------|--------|
| Revenue | $39.33B | $30.04B | +30.9% |
| Free Cash Flow | $15.54B | N/A | N/A |
| EPS (Diluted) | $0.89 | $0.68 | +30.9% |`;

    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'A1',
          name: 'RPO/Deferred Revenue Surge',
          category: 'A',
          signal: 'bullish',
          confidence: 90,
          summary: 'EPS growth.',
          evidence: [
            { quote: 'EPS (Diluted) | $0.89 | $0.68 | +30.9%', source: 'financial' },
          ],
        },
      ],
      catalysts: [],
      risks: [],
    });

    const result = validateEvidence(analysis, markdownSource);
    expect(result.verifiedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it('handles financial-only evidence validation', () => {
    const analysis = makeAnalysis({
      dimensions: [
        {
          id: 'A1',
          name: 'RPO/Deferred Revenue Surge',
          category: 'A',
          signal: 'bullish',
          confidence: 90,
          summary: 'Financial evidence only.',
          evidence: [
            { quote: 'Revenue: $39,331,000,000', source: 'financial' },
          ],
        },
      ],
      catalysts: [],
      risks: [],
    });

    const result = validateEvidence(analysis, FINANCIAL_TEXT);

    // The financial quote should still match from FINANCIAL_TEXT
    expect(result.verifiedCount).toBe(1);
    expect(result.isValid).toBe(true);
  });
});
