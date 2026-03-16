import { z } from 'zod';
import type { CrossValidationAnalysis, DimensionAnalysis, Catalyst, Risk } from '@equitylens/core';
import { LLMError } from '@equitylens/core';

const EvidenceSchema = z.object({
  quote: z.string(),
  source: z.enum(['financial', 'transcript', '10k', 'news']).default('financial'),
  context: z.string().optional(),
});

const CrossDimensionSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['A', 'B', 'C']),
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

const CrossValidationResponseSchema = z.object({
  verdict: z.enum(['Buy', 'Watch', 'Avoid']),
  conclusion: z.string(),
  landscapeAnalysis: z.string(),
  riskWarning: z.string(),
  dimensions: z.array(CrossDimensionSchema),
  catalysts: z.array(CatalystSchema),
  risks: z.array(RiskSchema),
});

export function parseCrossValidationResponse(
  rawContent: string,
  ticker: string,
  year: number,
  quarter: number,
  modelId: string,
  promptVersion: string,
  usage: { promptTokens: number; completionTokens: number; totalTokens: number },
): CrossValidationAnalysis {
  const jsonStr = extractJson(rawContent);

  const parsed = CrossValidationResponseSchema.safeParse(JSON.parse(jsonStr));
  if (!parsed.success) {
    throw new LLMError(
      `Failed to parse cross-validation response: ${parsed.error.message}`,
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
    conclusion: data.conclusion,
    landscapeAnalysis: data.landscapeAnalysis,
    riskWarning: data.riskWarning,
    dimensions: data.dimensions as DimensionAnalysis[],
    catalysts: data.catalysts as Catalyst[],
    risks: data.risks as Risk[],
    tokenUsage: usage,
    analyzedAt: new Date().toISOString(),
  };
}

function extractJson(raw: string): string {
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return raw.substring(firstBrace, lastBrace + 1);
    }

    throw new LLMError('Could not extract JSON from cross-validation response', 'unknown');
  }
}
