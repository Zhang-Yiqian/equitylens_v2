import { describe, it, expect } from 'vitest';
import { parseAnalysisResponse } from '../response-parser.js';
import { LLMError } from '@equitylens/core';

// --- Valid mock response data ---

const VALID_RESPONSE = {
  verdict: 'Conviction Buy' as const,
  verdictConfidence: 85,
  thesisSummary: 'NVIDIA remains the dominant AI infrastructure provider with strong revenue acceleration.',
  dimensions: [
    {
      id: 'A1',
      name: 'RPO/Deferred Revenue Surge',
      category: 'A' as const,
      signal: 'bullish' as const,
      confidence: 90,
      summary: 'Deferred revenue increased 30% QoQ driven by data center demand.',
      evidence: [
        { quote: 'Deferred revenue grew to $764M from $580M last quarter', source: 'financial' as const },
      ],
    },
    {
      id: 'A2',
      name: 'FCF Conversion Inflection',
      category: 'A' as const,
      signal: 'bullish' as const,
      confidence: 88,
      summary: 'FCF margin expanded to 39.5% from 32% a year ago.',
      evidence: [
        { quote: 'Free cash flow was $15.5 billion, representing 39% FCF margin', source: 'financial' as const },
      ],
    },
    {
      id: 'A3',
      name: 'Gross Margin Step-up',
      category: 'A' as const,
      signal: 'neutral' as const,
      confidence: 60,
      summary: 'Gross margins stable around 73-74%, no step change yet.',
      evidence: [],
    },
    {
      id: 'B1',
      name: 'Supply Chain Bottleneck Resolution',
      category: 'B' as const,
      signal: 'bullish' as const,
      confidence: 75,
      summary: 'CoWoS capacity constraints easing with new TSMC allocations.',
      evidence: [
        { quote: 'We are seeing improved supply from our manufacturing partners', source: 'transcript' as const },
      ],
    },
    {
      id: 'B2',
      name: 'Hyperscaler CAPEX Lock-in',
      category: 'B' as const,
      signal: 'bullish' as const,
      confidence: 95,
      summary: 'All major hyperscalers increasing AI CAPEX significantly.',
      evidence: [
        { quote: 'Our data center revenue was a record $35.1 billion', source: 'transcript' as const },
      ],
    },
    {
      id: 'B3',
      name: 'ASP/Unit Value Uplift',
      category: 'B' as const,
      signal: 'bullish' as const,
      confidence: 85,
      summary: 'Blackwell pricing 2-3x higher than Hopper platforms.',
      evidence: [],
    },
    {
      id: 'C1',
      name: 'Customer ROI Validation',
      category: 'C' as const,
      signal: 'skipped' as const,
      confidence: 0,
      summary: 'Not directly applicable to NVIDIA hardware business.',
      evidence: [],
    },
    {
      id: 'C2',
      name: 'Compute Economics Inflection',
      category: 'C' as const,
      signal: 'bullish' as const,
      confidence: 80,
      summary: 'Blackwell architecture offers 4x inference throughput improvement.',
      evidence: [],
    },
    {
      id: 'C3',
      name: 'Legacy Business Cannibalization Defense',
      category: 'C' as const,
      signal: 'skipped' as const,
      confidence: 0,
      summary: 'Not applicable - AI is additive to NVIDIA revenue.',
      evidence: [],
    },
    {
      id: 'D1',
      name: 'Management Defensive Evasion',
      category: 'D' as const,
      signal: 'neutral' as const,
      confidence: 65,
      summary: 'Management was forthcoming on most topics.',
      evidence: [],
    },
    {
      id: 'D2',
      name: 'Guidance Unusual Confidence',
      category: 'D' as const,
      signal: 'bullish' as const,
      confidence: 90,
      summary: 'Unusually specific guidance with strong conviction on Blackwell ramp.',
      evidence: [
        { quote: 'We expect data center revenue to grow sequentially in every quarter of fiscal 2026', source: 'transcript' as const },
      ],
    },
    {
      id: 'D3',
      name: 'Analyst Tone Reversal',
      category: 'D' as const,
      signal: 'bullish' as const,
      confidence: 70,
      summary: 'Previously cautious analysts now raising price targets aggressively.',
      evidence: [],
    },
  ],
  catalysts: [
    {
      description: 'Blackwell full ramp in Q2-Q3 FY2026',
      timeline: '3-6 months',
      evidence: [
        { quote: 'Blackwell production is ramping and demand is staggering', source: 'transcript' as const },
      ],
      probability: 'high' as const,
    },
  ],
  risks: [
    {
      description: 'Potential export restrictions tightening for China market',
      severity: 'medium' as const,
      evidence: [
        { quote: 'China data center revenue was a significant portion in prior quarters', source: 'financial' as const },
      ],
    },
  ],
  trackingMetrics: [
    {
      metric: 'Data Center Revenue',
      currentValue: '$35.1B',
      targetValue: '>$38B',
      nextCheckDate: '2025-05-28',
    },
  ],
};

const USAGE = { promptTokens: 50000, completionTokens: 8000, totalTokens: 58000 };

describe('parseAnalysisResponse', () => {
  it('parses valid JSON correctly', () => {
    const rawJson = JSON.stringify(VALID_RESPONSE);

    const result = parseAnalysisResponse(rawJson, 'NVDA', 2025, 4, 'gemini-2.5-pro', 'v1.0', USAGE);

    expect(result.ticker).toBe('NVDA');
    expect(result.year).toBe(2025);
    expect(result.quarter).toBe(4);
    expect(result.modelId).toBe('gemini-2.5-pro');
    expect(result.promptVersion).toBe('v1.0');
    expect(result.verdict).toBe('Conviction Buy');
    expect(result.verdictConfidence).toBe(85);
    expect(result.dimensions).toHaveLength(12);
    expect(result.catalysts).toHaveLength(1);
    expect(result.risks).toHaveLength(1);
    expect(result.trackingMetrics).toHaveLength(1);
    expect(result.tokenUsage).toEqual(USAGE);
    expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('extracts JSON from code blocks', () => {
    const rawWithCodeBlock = '```json\n' + JSON.stringify(VALID_RESPONSE) + '\n```';

    const result = parseAnalysisResponse(rawWithCodeBlock, 'NVDA', 2025, 4, 'gemini-2.5-pro', 'v1.0', USAGE);

    expect(result.verdict).toBe('Conviction Buy');
    expect(result.dimensions).toHaveLength(12);
  });

  it('extracts JSON with extra text via brace matching', () => {
    const rawWithText = 'Here is my analysis:\n\n' + JSON.stringify(VALID_RESPONSE) + '\n\nI hope this helps!';

    const result = parseAnalysisResponse(rawWithText, 'NVDA', 2025, 4, 'gemini-2.5-pro', 'v1.0', USAGE);

    expect(result.verdict).toBe('Conviction Buy');
  });

  it('throws LLMError for completely invalid JSON', () => {
    const badJson = 'This is not JSON at all, just random text without braces.';

    expect(() => {
      parseAnalysisResponse(badJson, 'NVDA', 2025, 4, 'gemini-2.5-pro', 'v1.0', USAGE);
    }).toThrow(LLMError);
  });

  it('throws LLMError for malformed JSON', () => {
    const malformed = '{ "verdict": "Conviction Buy", broken }';

    expect(() => {
      parseAnalysisResponse(malformed, 'NVDA', 2025, 4, 'gemini-2.5-pro', 'v1.0', USAGE);
    }).toThrow();
  });

  it('throws for missing required fields', () => {
    const incomplete = JSON.stringify({
      verdict: 'Conviction Buy',
      // Missing verdictConfidence, thesisSummary, dimensions, etc.
    });

    expect(() => {
      parseAnalysisResponse(incomplete, 'NVDA', 2025, 4, 'gemini-2.5-pro', 'v1.0', USAGE);
    }).toThrow(LLMError);
  });

  it('throws for invalid verdict value', () => {
    const invalidVerdict = JSON.stringify({
      ...VALID_RESPONSE,
      verdict: 'Strong Buy', // Not one of the 3 allowed values
    });

    expect(() => {
      parseAnalysisResponse(invalidVerdict, 'NVDA', 2025, 4, 'gemini-2.5-pro', 'v1.0', USAGE);
    }).toThrow(LLMError);
  });

  it('verdict must be one of 3 values: Conviction Buy, Watch, Avoid', () => {
    for (const verdict of ['Conviction Buy', 'Watch', 'Avoid'] as const) {
      const response = JSON.stringify({ ...VALID_RESPONSE, verdict });
      const result = parseAnalysisResponse(response, 'NVDA', 2025, 4, 'gemini-2.5-pro', 'v1.0', USAGE);
      expect(result.verdict).toBe(verdict);
    }
  });

  it('throws for confidence out of range', () => {
    const outOfRange = JSON.stringify({
      ...VALID_RESPONSE,
      verdictConfidence: 150,
    });

    expect(() => {
      parseAnalysisResponse(outOfRange, 'NVDA', 2025, 4, 'gemini-2.5-pro', 'v1.0', USAGE);
    }).toThrow(LLMError);
  });

  it('preserves all evidence from dimensions', () => {
    const rawJson = JSON.stringify(VALID_RESPONSE);
    const result = parseAnalysisResponse(rawJson, 'NVDA', 2025, 4, 'gemini-2.5-pro', 'v1.0', USAGE);

    const a1 = result.dimensions.find(d => d.id === 'A1');
    expect(a1).toBeDefined();
    expect(a1!.evidence).toHaveLength(1);
    expect(a1!.evidence[0].quote).toContain('Deferred revenue');
    expect(a1!.evidence[0].source).toBe('financial');
  });
});
