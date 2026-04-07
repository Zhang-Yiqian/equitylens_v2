/**
 * LLM-powered probabilistic evaluator for classification and scoring tasks.
 *
 * Uses a lightweight LLM call to assess:
 * - Whether a classification result is confident and evidence-backed
 * - Whether a scoring result has consistent reasoning
 * - Whether data is "suspicious" in ways that deterministic rules can't catch
 *
 * Phase 3: only active when EQUITYLENS_HARNESS_EVALUATOR_AGENT=true
 */

import type { HarnessContext } from '../context/context.js';
import type { Evaluator } from '../runner/types.js';
import { passEval, failEval } from '../runner/types.js';

// ─── LLM Evaluator types ───────────────────────────────────────────────────────

export interface LLMClassificationItem {
  ticker: string;
  nodeName?: string;
  classificationResult?: string;
  confidenceScore?: number;
  evidence?: string[];
  rawResponse?: string;
}

export interface LLMScoringItem {
  ticker: string;
  perspective: 'personal' | 'buffett' | 'munger';
  score?: number;
  verdict?: string;
  reasons?: string[];
  rawResponse?: string;
}

export interface LLMClassificationMetadata {
  evaluatorScore: number;
  evaluatorReasoning: string;
  hasEvidence: boolean;
  isConsistent: boolean;
  suggestedVerdict: 'accept' | 'retry' | 'reject';
}

export interface LLMScoringMetadata {
  evaluatorScore: number;
  reasoning: string;
  verdict: 'accept' | 'retry' | 'reject';
}

export interface LLMClassificationEvaluatorConfig {
  /** Minimum confidence score for acceptance (0-100). Default: 70 */
  minConfidence?: number;
  /** Whether to require evidence for each classification. Default: true */
  requireEvidence?: boolean;
  /** Provider for LLM calls */
  provider?: 'anthropic' | 'openai' | 'local';
  /** Model to use */
  model?: string;
}

const DEFAULT_CLASSIFICATION_CONFIG: Required<LLMClassificationEvaluatorConfig> = {
  minConfidence: 70,
  requireEvidence: true,
  provider: 'anthropic',
  model: 'claude-3-haiku-4',
};

// ─── Classification evaluator ─────────────────────────────────────────────────

/**
 * LLM-powered evaluator for L3 classification results.
 * Checks: confidence, evidence quality, result consistency.
 */
export class LLMClassificationEvaluator implements Evaluator<LLMClassificationItem, LLMClassificationMetadata> {
  private readonly config: Required<LLMClassificationEvaluatorConfig>;

  constructor(config: LLMClassificationEvaluatorConfig = {}) {
    this.config = { ...DEFAULT_CLASSIFICATION_CONFIG, ...config };
  }

  async evaluate(
    item: LLMClassificationItem,
    ctx: HarnessContext,
  ): Promise<{
    ok: boolean;
    canRetry: boolean;
    errors: string[];
    warnings: string[];
    metadata: LLMClassificationMetadata;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if evaluator agent is enabled
    if (!ctx.config.evaluatorAgentEnabled) {
      return {
        ok: true,
        canRetry: false,
        errors: [],
        warnings: ['evaluator_agent disabled, skipping LLM evaluation'],
        metadata: {
          evaluatorScore: 100,
          evaluatorReasoning: 'Agent disabled',
          hasEvidence: true,
          isConsistent: true,
          suggestedVerdict: 'accept',
        },
      };
    }

    // Run LLM evaluation
    const evalResult = await this.runLLMEvaluation(item, ctx);

    // Determine acceptance
    let suggestedVerdict: 'accept' | 'retry' | 'reject' = 'accept';
    let canRetry = false;

    if (evalResult.confidence < this.config.minConfidence) {
      errors.push(
        `LLM evaluator confidence ${evalResult.confidence.toFixed(0)} < ${this.config.minConfidence}`,
      );
      suggestedVerdict = 'reject';
    }

    if (this.config.requireEvidence && !evalResult.hasEvidence) {
      errors.push('No supporting evidence found for classification');
      suggestedVerdict = 'reject';
      canRetry = true;
    }

    if (!evalResult.isConsistent) {
      errors.push('Classification result inconsistent with evidence');
      canRetry = true;
      if (suggestedVerdict === 'accept') suggestedVerdict = 'retry';
    }

    const ok = errors.length === 0;

    return {
      ok,
      canRetry,
      errors,
      warnings,
      metadata: {
        evaluatorScore: evalResult.confidence,
        evaluatorReasoning: evalResult.reasoning,
        hasEvidence: evalResult.hasEvidence,
        isConsistent: evalResult.isConsistent,
        suggestedVerdict,
      },
    };
  }

  private async runLLMEvaluation(
    item: LLMClassificationItem,
    _ctx: HarnessContext,
  ): Promise<{ confidence: number; reasoning: string; hasEvidence: boolean; isConsistent: boolean }> {
    // Prompt the LLM to evaluate the classification
    const prompt = this.buildEvaluationPrompt(item);

    try {
      // Use the generic LLM call
      const response = await this.callLLM(prompt, _ctx);
      return this.parseEvaluationResponse(response);
    } catch (err) {
      // Fallback: conservative scoring
      return {
        confidence: 50,
        reasoning: `LLM evaluation failed: ${String(err)}. Conservative score applied.`,
        hasEvidence: (item.evidence?.length ?? 0) > 0,
        isConsistent: true,
      };
    }
  }

  private buildEvaluationPrompt(item: LLMClassificationItem): string {
    return `You are evaluating a stock industry classification result for ${item.ticker}.

Classification: ${item.classificationResult ?? 'N/A'}
Confidence: ${item.confidenceScore ?? 'N/A'}/100
Evidence: ${item.evidence?.join('; ') ?? 'None provided'}
Raw LLM Response: ${item.rawResponse?.slice(0, 500) ?? 'N/A'}

Evaluate this classification on:
1. **Confidence** (0-100): Does the confidence score match the evidence quality?
2. **Evidence** (yes/no): Are there specific keyword or data citations supporting this?
3. **Consistency** (yes/no): Is the classification consistent with the evidence?

Respond with a JSON object:
{
  "confidence": <0-100>,
  "reasoning": "<brief explanation>",
  "hasEvidence": <true/false>,
  "isConsistent": <true/false>
}

Only output the JSON object, nothing else.`;
  }

  private async callLLM(prompt: string, ctx: HarnessContext): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (globalThis as any).process?.env as Record<string, string | undefined> | undefined;
    const apiKey = env?.['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await ((globalThis as any).fetch as (input: string, init?: any) => Promise<any>)('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text}`);
    }

    const json = await response.json() as { content?: Array<{ text?: string }> };
    const text = json.content?.[0]?.text ?? '';
    ctx.telemetry.debug('llm_evaluator.response', { length: text.length });
    return text;
  }

  private parseEvaluationResponse(response: string): {
    confidence: number;
    reasoning: string;
    hasEvidence: boolean;
    isConsistent: boolean;
  } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        confidence: Number(parsed.confidence) || 50,
        reasoning: String(parsed.reasoning ?? ''),
        hasEvidence: Boolean(parsed.hasEvidence),
        isConsistent: Boolean(parsed.isConsistent),
      };
    } catch {
      // Try simpler parsing as fallback
      const confMatch = response.match(/"confidence"\s*:\s*(\d+)/);
      const evMatch = response.match(/"hasEvidence"\s*:\s*(true|false)/);
      const consMatch = response.match(/"isConsistent"\s*:\s*(true|false)/);

      return {
        confidence: confMatch ? parseInt(confMatch[1], 10) : 50,
        reasoning: 'Could not parse full LLM response',
        hasEvidence: evMatch ? evMatch[1] === 'true' : false,
        isConsistent: consMatch ? consMatch[1] === 'true' : true,
      };
    }
  }
}

// ─── Scoring evaluator ────────────────────────────────────────────────────────

/**
 * LLM-powered evaluator for scoring results.
 * Validates that the score is consistent with the reasons and verdict.
 */
export class LLMScoringEvaluator implements Evaluator<LLMScoringItem, LLMScoringMetadata> {
  async evaluate(
    item: LLMScoringItem,
    ctx: HarnessContext,
  ): Promise<{
    ok: boolean;
    canRetry: boolean;
    errors: string[];
    warnings: string[];
    metadata: LLMScoringMetadata;
  }> {
    if (!ctx.config.evaluatorAgentEnabled) {
      return {
        ok: true,
        canRetry: false,
        errors: [],
        warnings: [],
        metadata: { evaluatorScore: 100, reasoning: 'Agent disabled', verdict: 'accept' },
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Simple consistency check without LLM call (to avoid excessive API costs)
    let score = 80;
    let reasoning = '';
    let verdict: 'accept' | 'retry' | 'reject' = 'accept';

    // Score consistency: reason count vs score
    const reasonCount = item.reasons?.length ?? 0;
    if (reasonCount < 3 && item.score !== undefined && item.score > 60) {
      warnings.push(`High score (${item.score}) but only ${reasonCount} reasons provided`);
      score -= 10;
    }

    // Verdict consistency
    if (item.verdict && item.score !== undefined) {
      const expectedVerdict = item.score >= 60 ? 'Buy' : item.score >= 40 ? 'Watch' : 'Avoid';
      if (!item.verdict.includes(expectedVerdict.split('/')[0] ?? '')) {
        warnings.push(`Verdict "${item.verdict}" inconsistent with score ${item.score}`);
        verdict = 'retry';
        score -= 15;
      }
    }

    if (score < 60) verdict = 'reject';
    if (errors.length > 0) verdict = 'reject';

    return {
      ok: errors.length === 0,
      canRetry: verdict === 'retry',
      errors,
      warnings,
      metadata: { evaluatorScore: score, reasoning, verdict },
    };
  }
}
