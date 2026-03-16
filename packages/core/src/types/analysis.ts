export type Verdict = 'Conviction Buy' | 'Watch' | 'Avoid';

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
  source: 'financial' | 'transcript';
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
