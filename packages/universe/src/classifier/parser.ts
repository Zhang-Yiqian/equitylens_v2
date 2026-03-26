import { z } from 'zod';
import type { L3Classification, AIStatus, SupplyChainTag } from '@equitylens/core';

const SUPPLY_CHAIN_TAGS: SupplyChainTag[] = [
  'gpu_accelerators', 'storage', 'optical_modules', 'semiconductors', 'eda_ip',
  'servers_oem', 'data_center', 'cloud', 'llm_platforms', 'ai_saas',
  'networking', 'power_thermal', 'materials', 'capital_formation', 'software_dev', 'none',
];

const L3ResultSchema = z.object({
  ticker: z.string().toUpperCase(),
  // Accept any ai_status; invalid values default to 'unknown'
  ai_status: z.string(),
  // Accept any string for supply_chain_tag; invalid values get normalized below
  supply_chain_tag: z.string(),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string().min(1),
  evidence: z.string().min(1),
});

const L3BatchResponseSchema = z.object({
  results: z.array(L3ResultSchema),
});

function stripMarkdownJson(text: string): string {
  // Remove common markdown code block wrappers
  let cleaned = text.trim();
  // Remove ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/, '');
  return cleaned.trim();
}

/**
 * Parse L3 Gemini JSON response into typed L3Classification objects.
 * Handles markdown code blocks and malformed JSON gracefully.
 */
export function parseL3Response(
  rawContent: string,
  modelId: string,
): Array<L3Classification & { ticker: string }> {
  const cleaned = stripMarkdownJson(rawContent);

  let parsed: z.infer<typeof L3BatchResponseSchema>;
  try {
    parsed = L3BatchResponseSchema.parse(JSON.parse(cleaned));
  } catch (parseError) {
    // Try to extract just the JSON array/object portion
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      try {
        parsed = L3BatchResponseSchema.parse(JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1)));
      } catch {
        throw new Error(`Failed to parse L3 response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. Raw: ${cleaned.slice(0, 200)}`);
      }
    } else {
      throw new Error(`No JSON object found in L3 response: ${cleaned.slice(0, 200)}`);
    }
  }

  const now = new Date().toISOString();
  const VALID_AI_STATUSES: AIStatus[] = ['core', 'adjacent', 'non_core', 'unknown'];

  return parsed.results.map(r => ({
    ticker: r.ticker.toUpperCase(),
    companyName: '', // filled by caller
    // Normalize ai_status: invalid values default to 'unknown'
    aiStatus: (VALID_AI_STATUSES.includes(r.ai_status as AIStatus)
      ? r.ai_status
      : 'unknown') as AIStatus,
    // Normalize supply_chain_tag: invalid values map to 'none'
    supplyChainTag: (SUPPLY_CHAIN_TAGS.includes(r.supply_chain_tag as SupplyChainTag)
      ? r.supply_chain_tag
      : 'none') as SupplyChainTag,
    confidence: r.confidence,
    reasoning: r.reasoning,
    evidence: r.evidence,
    modelId,
    analyzedAt: now,
  }));
}
