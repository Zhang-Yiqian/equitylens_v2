import { describe, it, expect } from 'vitest';
import { MVP_TICKERS, MVP_TICKER_SET } from '../constants/tickers.js';
import type { TickerInfo } from '../constants/tickers.js';

describe('MVP_TICKERS', () => {
  it('has exactly 10 entries', () => {
    expect(MVP_TICKERS).toHaveLength(10);
  });

  it('each ticker has required fields (ticker, name, sector, node)', () => {
    for (const entry of MVP_TICKERS) {
      expect(entry).toHaveProperty('ticker');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('sector');
      expect(entry).toHaveProperty('node');
      expect(typeof entry.ticker).toBe('string');
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.sector).toBe('string');
      expect(typeof entry.node).toBe('string');
      expect(entry.ticker.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it('tickers are unique', () => {
    const tickers = MVP_TICKERS.map(t => t.ticker);
    expect(new Set(tickers).size).toBe(tickers.length);
  });

  it('contains expected AI/semiconductor tickers', () => {
    const tickers = MVP_TICKERS.map(t => t.ticker);
    expect(tickers).toContain('NVDA');
    expect(tickers).toContain('AMD');
    expect(tickers).toContain('AVGO');
    expect(tickers).toContain('MSFT');
    expect(tickers).toContain('GOOGL');
    expect(tickers).toContain('AMZN');
    expect(tickers).toContain('PLTR');
    expect(tickers).toContain('SMCI');
    expect(tickers).toContain('VRT');
    expect(tickers).toContain('MU');
  });
});

describe('MVP_TICKER_SET', () => {
  it('is a Set with 10 entries', () => {
    expect(MVP_TICKER_SET).toBeInstanceOf(Set);
    expect(MVP_TICKER_SET.size).toBe(10);
  });

  it('contains NVDA', () => {
    expect(MVP_TICKER_SET.has('NVDA')).toBe(true);
  });

  it('contains PLTR', () => {
    expect(MVP_TICKER_SET.has('PLTR')).toBe(true);
  });

  it('does not contain non-MVP tickers', () => {
    expect(MVP_TICKER_SET.has('AAPL')).toBe(false);
    expect(MVP_TICKER_SET.has('TSLA')).toBe(false);
    expect(MVP_TICKER_SET.has('')).toBe(false);
  });

  it('is consistent with MVP_TICKERS array', () => {
    for (const entry of MVP_TICKERS) {
      expect(MVP_TICKER_SET.has(entry.ticker)).toBe(true);
    }
  });
});
