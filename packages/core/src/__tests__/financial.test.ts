import { describe, it, expect } from 'vitest';
import { formatFinancialValue } from '../types/financial.js';

describe('formatFinancialValue', () => {
  it('returns 缺失 for null', () => {
    expect(formatFinancialValue(null)).toBe('缺失');
  });

  it('returns $0 for zero', () => {
    expect(formatFinancialValue(0)).toBe('$0');
  });

  it('formats billions correctly', () => {
    expect(formatFinancialValue(1_500_000_000)).toBe('$1.50B');
  });

  it('formats millions correctly', () => {
    expect(formatFinancialValue(250_000_000)).toBe('$250.00M');
  });

  it('formats small numbers with commas', () => {
    expect(formatFinancialValue(12345)).toBe('$12,345');
  });

  it('formats negative billions correctly', () => {
    expect(formatFinancialValue(-2_000_000_000)).toBe('$-2.00B');
  });

  it('formats exactly 1 billion', () => {
    expect(formatFinancialValue(1_000_000_000)).toBe('$1.00B');
  });

  it('formats exactly 1 million', () => {
    expect(formatFinancialValue(1_000_000)).toBe('$1.00M');
  });

  it('formats negative millions correctly', () => {
    expect(formatFinancialValue(-500_000_000)).toBe('$-500.00M');
  });

  it('formats values just under 1 million as plain numbers', () => {
    expect(formatFinancialValue(999_999)).toBe('$999,999');
  });
});
