export interface ModelConfig {
  id: string;
  contextWindow: number;
  maxOutput: number;
  pricing: { input: number; output: number }; // per 1M tokens
}

export const MODEL_REGISTRY = {
  'gemini-3-flash-preview': {
    id: 'google/gemini-3-flash-preview',
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { input: 0.50, output: 3.00 },
  },
  'gemini-3.1-flash-lite-preview': {
    id: 'google/gemini-3.1-flash-lite-preview',
    contextWindow: 100_000,
    maxOutput: 16_384,
    pricing: { input: 0.10, output: 0.40 },
  },
  'gemini-2.5-pro': {
    id: 'google/gemini-2.5-pro-preview-03-25',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    pricing: { input: 1.25, output: 10 },
  },
  'gemini-3.1-pro': {
    id: 'google/gemini-3.1-pro-preview',
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    pricing: { input: 2, output: 12 },
  },
  'claude-sonnet': {
    id: 'anthropic/claude-sonnet-4',
    contextWindow: 200_000,
    maxOutput: 16_384,
    pricing: { input: 3, output: 15 },
  },
  'gpt-4o': {
    id: 'openai/gpt-4o',
    contextWindow: 128_000,
    maxOutput: 16_384,
    pricing: { input: 2.5, output: 10 },
  },
  'gpt-5.4': {
    id: 'openai/gpt-5.4',
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    pricing: { input: 2.5, output: 15 },
  },
} as const satisfies Record<string, ModelConfig>;

export type ModelKey = keyof typeof MODEL_REGISTRY;

export const DEFAULT_MODEL: ModelKey = 'gemini-3-flash-preview';

export function isValidModel(key: string): key is ModelKey {
  return key in MODEL_REGISTRY;
}
