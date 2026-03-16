import OpenAI from 'openai';
import { LLMError } from '@equitylens/core';
import { MODEL_REGISTRY, DEFAULT_MODEL, type ModelKey } from './model-config.js';

export class LlmClient {
  private client: OpenAI;
  private modelKey: ModelKey;

  constructor(modelKey: ModelKey = DEFAULT_MODEL, apiKey?: string) {
    const key = apiKey || process.env.OPENROUTER_API_KEY || '';
    if (!key) {
      throw new LLMError('OPENROUTER_API_KEY not configured', modelKey);
    }

    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: key,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/equitylens',
        'X-Title': 'EquityLens',
      },
    });
    this.modelKey = modelKey;
  }

  async chat(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<{
    content: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const model = MODEL_REGISTRY[this.modelKey];
    if (!model) {
      throw new LLMError(`Unknown model: ${this.modelKey}`, this.modelKey);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: model.id,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? model.maxOutput,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new LLMError('Empty response from LLM', this.modelKey, true);
      }

      return {
        content: choice.message.content,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof LLMError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      throw new LLMError(`LLM request failed: ${msg}`, this.modelKey, true);
    }
  }

  getModelInfo() {
    return MODEL_REGISTRY[this.modelKey];
  }
}
