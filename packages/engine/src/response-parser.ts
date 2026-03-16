import { z } from 'zod';
import type { InflectionAnalysis, DimensionAnalysis, Catalyst, Risk, TrackingMetric } from '@equitylens/core';
import { LLMError } from '@equitylens/core';

const EvidenceSchema = z.object({
  quote: z.string(),
  source: z.enum(['transcript', 'financial']).default('financial'),
  context: z.string().optional(),
});

const DimensionSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['A', 'B', 'C', 'D']),
  signal: z.enum(['bullish', 'bearish', 'neutral', 'skipped']),
  confidence: z.number().min(0).max(100),
  summary: z.string(),
  evidence: z.array(EvidenceSchema).default([]),
});

const CatalystSchema = z.object({
  description: z.string(),
  timeline: z.string(),
  evidence: z.array(EvidenceSchema).default([]),
  probability: z.enum(['high', 'medium', 'low']),
});

const RiskSchema = z.object({
  description: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  evidence: z.array(EvidenceSchema).default([]),
});

const TrackingMetricSchema = z.object({
  metric: z.string(),
  currentValue: z.string(),
  targetValue: z.string(),
  nextCheckDate: z.string(),
});

const AnalysisResponseSchema = z.object({
  verdict: z.enum(['Conviction Buy', 'Watch', 'Avoid']),
  verdictConfidence: z.number().min(0).max(100),
  thesisSummary: z.string(),
  dimensions: z.array(DimensionSchema),
  catalysts: z.array(CatalystSchema),
  risks: z.array(RiskSchema),
  trackingMetrics: z.array(TrackingMetricSchema),
});

export function parseAnalysisResponse(
  rawContent: string,
  ticker: string,
  year: number,
  quarter: number,
  modelId: string,
  promptVersion: string,
  usage: { promptTokens: number; completionTokens: number; totalTokens: number },
): InflectionAnalysis {
  // Try to extract JSON from the response
  const jsonStr = extractJson(rawContent);

  const parsed = AnalysisResponseSchema.safeParse(JSON.parse(jsonStr));
  if (!parsed.success) {
    throw new LLMError(
      `Failed to parse LLM response: ${parsed.error.message}`,
      modelId,
    );
  }

  const data = parsed.data;

  return {
    ticker,
    year,
    quarter,
    modelId,
    promptVersion,
    verdict: data.verdict,
    verdictConfidence: data.verdictConfidence,
    thesisSummary: data.thesisSummary,
    dimensions: data.dimensions as DimensionAnalysis[],
    catalysts: data.catalysts as Catalyst[],
    risks: data.risks as Risk[],
    trackingMetrics: data.trackingMetrics as TrackingMetric[],
    tokenUsage: usage,
    analyzedAt: new Date().toISOString(),
  };
}

function extractJson(raw: string): string {
  // Try direct parse first
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    // Look for JSON in code blocks
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Look for first { to last }
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return raw.substring(firstBrace, lastBrace + 1);
    }

    throw new LLMError('Could not extract JSON from LLM response', 'unknown');
  }
}
