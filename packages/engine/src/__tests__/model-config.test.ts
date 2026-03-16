import { describe, it, expect } from 'vitest';
import { MODEL_REGISTRY, DEFAULT_MODEL, isValidModel } from '../model-config.js';
import type { ModelKey } from '../model-config.js';

describe('MODEL_REGISTRY', () => {
  it('has gemini-2.5-pro', () => {
    expect(MODEL_REGISTRY).toHaveProperty('gemini-2.5-pro');
  });

  it('has claude-sonnet', () => {
    expect(MODEL_REGISTRY).toHaveProperty('claude-sonnet');
  });

  it('has gpt-4o', () => {
    expect(MODEL_REGISTRY).toHaveProperty('gpt-4o');
  });

  it('has gemini-3.1-pro', () => {
    expect(MODEL_REGISTRY).toHaveProperty('gemini-3.1-pro');
  });

  it('has gpt-5.4', () => {
    expect(MODEL_REGISTRY).toHaveProperty('gpt-5.4');
  });

  it('each model has required fields (id, contextWindow, maxOutput, pricing)', () => {
    for (const [key, config] of Object.entries(MODEL_REGISTRY)) {
      expect(config).toHaveProperty('id');
      expect(config).toHaveProperty('contextWindow');
      expect(config).toHaveProperty('maxOutput');
      expect(config).toHaveProperty('pricing');

      expect(typeof config.id).toBe('string');
      expect(typeof config.contextWindow).toBe('number');
      expect(typeof config.maxOutput).toBe('number');
      expect(typeof config.pricing).toBe('object');
      expect(typeof config.pricing.input).toBe('number');
      expect(typeof config.pricing.output).toBe('number');

      // Sanity checks
      expect(config.contextWindow).toBeGreaterThan(0);
      expect(config.maxOutput).toBeGreaterThan(0);
      expect(config.pricing.input).toBeGreaterThan(0);
      expect(config.pricing.output).toBeGreaterThan(0);
    }
  });

  it('gemini-2.5-pro has 1M context window', () => {
    expect(MODEL_REGISTRY['gemini-2.5-pro'].contextWindow).toBe(1_000_000);
  });

  it('model IDs follow provider/model-name format', () => {
    expect(MODEL_REGISTRY['gemini-2.5-pro'].id).toBe('google/gemini-2.5-pro-preview-03-25');
    expect(MODEL_REGISTRY['gemini-3.1-pro'].id).toBe('google/gemini-3.1-pro-preview');
    expect(MODEL_REGISTRY['claude-sonnet'].id).toBe('anthropic/claude-sonnet-4');
    expect(MODEL_REGISTRY['gpt-4o'].id).toBe('openai/gpt-4o');
    expect(MODEL_REGISTRY['gpt-5.4'].id).toBe('openai/gpt-5.4');
  });

  it('pricing is in per-million-tokens format', () => {
    const gemini = MODEL_REGISTRY['gemini-2.5-pro'];
    expect(gemini.pricing.input).toBe(1.25);
    expect(gemini.pricing.output).toBe(10);
  });
});

describe('DEFAULT_MODEL', () => {
  it('is gemini-3.1-pro', () => {
    expect(DEFAULT_MODEL).toBe('gemini-3.1-pro');
  });

  it('exists in MODEL_REGISTRY', () => {
    expect(MODEL_REGISTRY).toHaveProperty(DEFAULT_MODEL);
  });
});

describe('isValidModel', () => {
  it('returns true for gemini-2.5-pro', () => {
    expect(isValidModel('gemini-2.5-pro')).toBe(true);
  });

  it('returns true for claude-sonnet', () => {
    expect(isValidModel('claude-sonnet')).toBe(true);
  });

  it('returns true for gpt-4o', () => {
    expect(isValidModel('gpt-4o')).toBe(true);
  });

  it('returns true for gemini-3.1-pro', () => {
    expect(isValidModel('gemini-3.1-pro')).toBe(true);
  });

  it('returns true for gpt-5.4', () => {
    expect(isValidModel('gpt-5.4')).toBe(true);
  });

  it('returns false for nonexistent model', () => {
    expect(isValidModel('nonexistent')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidModel('')).toBe(false);
  });

  it('returns false for similar but incorrect model names', () => {
    expect(isValidModel('gemini-2.5')).toBe(false);
    expect(isValidModel('claude-opus')).toBe(false);
    expect(isValidModel('gpt-4')).toBe(false);
    expect(isValidModel('GPT-4O')).toBe(false); // case sensitive
  });
});
