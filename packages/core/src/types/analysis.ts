export type Verdict = 'Conviction Buy' | 'Watch' | 'Avoid';
export type CrossVerdict = 'Buy' | 'Watch' | 'Avoid';

export interface DimensionAnalysis {
  id: string;
  name: string;
  category: 'A' | 'B' | 'C' | 'D';
  signal: 'bullish' | 'bearish' | 'neutral' | 'skipped';
  confidence: number; // 0-100
  summary: string;
  evidence: Evidence[];
}

export interface Evidence {
  quote: string;
  source: 'financial' | 'transcript' | '10k' | 'news';
  context?: string;
}

export interface Catalyst {
  description: string;
  timeline: string;
  evidence: Evidence[];
  probability: 'high' | 'medium' | 'low';
}

export interface Risk {
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence: Evidence[];
}

export interface TrackingMetric {
  metric: string;
  currentValue: string;
  targetValue: string;
  nextCheckDate: string;
}

export interface InflectionAnalysis {
  ticker: string;
  year: number;
  quarter: number;
  modelId: string;
  promptVersion: string;
  verdict: Verdict;
  verdictConfidence: number;
  thesisSummary: string;
  dimensions: DimensionAnalysis[];
  catalysts: Catalyst[];
  risks: Risk[];
  trackingMetrics: TrackingMetric[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  analyzedAt: string;
}

/**
 * Cross-validation analysis result (8-dimension, three-section report).
 * Replaces InflectionAnalysis for the new cross-validation-v1 prompt.
 */
export interface CrossValidationAnalysis {
  ticker: string;
  year: number;
  quarter: number;
  modelId: string;
  promptVersion: string;
  verdict: CrossVerdict;
  // Three-section narrative report
  conclusion: string;         // 综合结论
  landscapeAnalysis: string;  // 10-K 竞争格局分析
  riskWarning: string;        // 核心风险提示
  // 8 dimensions across 3 categories (A, B, C)
  dimensions: DimensionAnalysis[];
  catalysts: Catalyst[];
  risks: Risk[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  analyzedAt: string;
}
