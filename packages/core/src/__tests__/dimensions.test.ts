import { describe, it, expect } from 'vitest';
import { DIMENSIONS, DIMENSION_MAP } from '../constants/dimensions.js';
import type { DimensionDef } from '../constants/dimensions.js';

describe('DIMENSIONS', () => {
  it('has exactly 12 entries', () => {
    expect(DIMENSIONS).toHaveLength(12);
  });

  it('each dimension has correct fields', () => {
    for (const dim of DIMENSIONS) {
      expect(dim).toHaveProperty('id');
      expect(dim).toHaveProperty('name');
      expect(dim).toHaveProperty('nameZh');
      expect(dim).toHaveProperty('category');
      expect(dim).toHaveProperty('categoryName');
      expect(dim).toHaveProperty('description');

      expect(typeof dim.id).toBe('string');
      expect(typeof dim.name).toBe('string');
      expect(typeof dim.nameZh).toBe('string');
      expect(typeof dim.category).toBe('string');
      expect(typeof dim.categoryName).toBe('string');
      expect(typeof dim.description).toBe('string');

      // ID format: letter + number (e.g., A1, B2, C3, D1)
      expect(dim.id).toMatch(/^[A-D][1-3]$/);
    }
  });

  it('has unique IDs', () => {
    const ids = DIMENSIONS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('category A has exactly 3 dimensions (A1, A2, A3)', () => {
    const catA = DIMENSIONS.filter(d => d.category === 'A');
    expect(catA).toHaveLength(3);
    expect(catA.map(d => d.id).sort()).toEqual(['A1', 'A2', 'A3']);
  });

  it('category B has exactly 3 dimensions (B1, B2, B3)', () => {
    const catB = DIMENSIONS.filter(d => d.category === 'B');
    expect(catB).toHaveLength(3);
    expect(catB.map(d => d.id).sort()).toEqual(['B1', 'B2', 'B3']);
  });

  it('category C has exactly 3 dimensions (C1, C2, C3)', () => {
    const catC = DIMENSIONS.filter(d => d.category === 'C');
    expect(catC).toHaveLength(3);
    expect(catC.map(d => d.id).sort()).toEqual(['C1', 'C2', 'C3']);
  });

  it('category D has exactly 3 dimensions (D1, D2, D3)', () => {
    const catD = DIMENSIONS.filter(d => d.category === 'D');
    expect(catD).toHaveLength(3);
    expect(catD.map(d => d.id).sort()).toEqual(['D1', 'D2', 'D3']);
  });

  it('all dimensions have non-empty descriptions', () => {
    for (const dim of DIMENSIONS) {
      expect(dim.description.length).toBeGreaterThan(10);
    }
  });

  it('all dimensions have Chinese names', () => {
    for (const dim of DIMENSIONS) {
      expect(dim.nameZh.length).toBeGreaterThan(0);
    }
  });

  it('category names are assigned correctly', () => {
    const catA = DIMENSIONS.filter(d => d.category === 'A');
    for (const dim of catA) {
      expect(dim.categoryName).toBe('Financial Leading Indicators');
    }

    const catB = DIMENSIONS.filter(d => d.category === 'B');
    for (const dim of catB) {
      expect(dim.categoryName).toBe('Hardware/Semiconductor');
    }

    const catC = DIMENSIONS.filter(d => d.category === 'C');
    for (const dim of catC) {
      expect(dim.categoryName).toBe('Software/SaaS');
    }

    const catD = DIMENSIONS.filter(d => d.category === 'D');
    for (const dim of catD) {
      expect(dim.categoryName).toBe('Sentiment & Game Theory');
    }
  });
});

describe('DIMENSION_MAP', () => {
  it('is a Map with 12 entries', () => {
    expect(DIMENSION_MAP).toBeInstanceOf(Map);
    expect(DIMENSION_MAP.size).toBe(12);
  });

  it('can look up dimension by ID', () => {
    const a1 = DIMENSION_MAP.get('A1');
    expect(a1).toBeDefined();
    expect(a1!.name).toBe('RPO/Deferred Revenue Surge');
    expect(a1!.category).toBe('A');
  });

  it('returns undefined for unknown ID', () => {
    expect(DIMENSION_MAP.get('Z9')).toBeUndefined();
    expect(DIMENSION_MAP.get('')).toBeUndefined();
  });

  it('all DIMENSIONS entries are in the map', () => {
    for (const dim of DIMENSIONS) {
      const found = DIMENSION_MAP.get(dim.id);
      expect(found).toBe(dim);
    }
  });
});
