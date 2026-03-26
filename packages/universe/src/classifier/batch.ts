import type OpenAI from 'openai';
import { LlmClient, isValidModel, type ModelKey } from '@equitylens/engine';
import { L3_SYSTEM_PROMPT, buildL3UserMessage } from './l3-prompt.js';
import { parseL3Response } from './parser.js';
import type { L2MatchResult, L3Classification, SupplyChainTag } from '@equitylens/core';

const BATCH_SIZE = 50;

export interface L3BatchOptions {
  modelKey?: string;
  batchSize?: number;
  signal?: AbortSignal;
  verbose?: boolean;
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Batch-process L2 match results through L3 Gemini classification.
 * Uses gemini-3-flash-preview by default for cost efficiency.
 */
export async function classifyL3(
  l2Results: L2MatchResult[],
  options: L3BatchOptions = {},
): Promise<L3Classification[]> {
  const {
    modelKey = 'gemini-3-flash-preview',
    batchSize = BATCH_SIZE,
    signal,
    verbose = false,
    onProgress,
  } = options;

  if (l2Results.length === 0) return [];

  const resolvedModel: ModelKey = isValidModel(modelKey) ? modelKey : 'gemini-3-flash-preview';
  const llmClient = new LlmClient(resolvedModel);
  const results: L3Classification[] = [];
  let totalTokens = 0;

  // Build a ticker→companyName map for later lookup
  const tickerNameMap = new Map<string, string>();
  for (const r of l2Results) {
    tickerNameMap.set(r.ticker, r.companyName);
  }

  const batches: L2MatchResult[][] = [];
  for (let i = 0; i < l2Results.length; i += batchSize) {
    batches.push(l2Results.slice(i, i + batchSize));
  }

  if (verbose) {
    console.log(`\n🔬 L3 Gemini Classification: ${l2Results.length} companies → ${batches.length} batches (${batchSize}/batch)`);
  }

  for (let i = 0; i < batches.length; i++) {
    if (signal?.aborted) {
      if (verbose) console.log(`\n⚠️  L3 batch processing aborted at batch ${i + 1}`);
      break;
    }

    const batch = batches[i];
    const batchNum = i + 1;

    if (verbose) {
      process.stdout.write(`  Batch ${batchNum}/${batches.length} (${batch.length} companies)... `);
    }

    const parsed = await classifyBatchWithRetry(batch, llmClient, resolvedModel, signal, verbose, batchNum);

    if (parsed.length > 0 && parsed[0].l3ApiFailed) {
      // Batch had API failures — all results in this batch are fallbacks
      totalTokens += 0;
    } else {
      // Count tokens from successful response
      const successItem = parsed.find(p => !p.l3ApiFailed);
      if (successItem) {
        // We don't have token usage from fallback responses; token count comes from the
        // successful API call that populated these results before retry was needed.
        // For retry batches, the token count is approximate.
      }
    }

    // Merge with company name from original batch
    for (const item of parsed) {
      item.companyName = tickerNameMap.get(item.ticker) ?? '';
    }

    results.push(...parsed);

    const apiFailedCount = parsed.filter(p => p.l3ApiFailed).length;
    if (verbose) {
      const successCount = parsed.length - apiFailedCount;
      console.log(`✅ (${successCount} success, ${apiFailedCount} API failures)`);
    }

    if (onProgress) onProgress(results.length, l2Results.length);
  }

  if (verbose) {
    const apiFailedTotal = results.filter(p => p.l3ApiFailed).length;
    console.log(`\n✅ L3 classification complete: ${results.length}/${l2Results.length} classified (${apiFailedTotal} API failures after retry)`);
  }

  return results;
}

const MAX_RETRIES = 2;

async function classifyBatchWithRetry(
  batch: L2MatchResult[],
  llmClient: LlmClient,
  modelKey: string,
  signal: AbortSignal | undefined,
  verbose: boolean,
  batchNum: number,
): Promise<L3Classification[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) break;

    try {
      const userMessage = buildL3UserMessage(batch);
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: L3_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ];

      const response = await llmClient.chat(messages, {
        temperature: 0.1,
        maxTokens: 8192,
      });

      const parsed = parseL3Response(response.content, modelKey);

      // Check if any result has the parse-error marker in reasoning
      const hasParseError = parsed.some(p =>
        p.reasoning.startsWith('[PARSE_ERROR]') || p.reasoning.startsWith('[API_ERROR]')
      );

      if (hasParseError && attempt < MAX_RETRIES) {
        if (verbose) {
          console.log(`⚠️  Batch ${batchNum} attempt ${attempt} had parse errors, retrying...`);
        }
        lastError = new Error('Partial parse failure');
        continue;
      }

      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (verbose && attempt < MAX_RETRIES) {
        console.log(`⚠️  Batch ${batchNum} attempt ${attempt} failed: ${lastError.message}, retrying...`);
      }
    }
  }

  // All retries exhausted — mark all as api_failed
  if (verbose) {
    console.log(`❌ Batch ${batchNum} failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  return batch.map(item => ({
    ticker: item.ticker,
    companyName: '',
    aiStatus: 'api_failed' as const,
    supplyChainTag: 'none' as SupplyChainTag,
    confidence: 0,
    reasoning: `[API_ERROR] L3 分类失败（已重试 ${MAX_RETRIES} 次）: ${lastError?.message ?? 'Unknown error'}`,
    evidence: '',
    modelId: modelKey,
    analyzedAt: new Date().toISOString(),
    l3ApiFailed: true,
  }));
}
