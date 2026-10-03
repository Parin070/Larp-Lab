import { describe, it, expect } from 'vitest';
import { searchBuildings } from '../src/world/searchIndex.js';

describe('Building Directory and Search Index', () => {
  const SEED = 12345;

  it('searches buildings by address substring', () => {
    const results = searchBuildings(SEED, 'Ave 1');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((b) => {
      expect(b.address.toLowerCase()).toContain('ave 1');
      expect(b.door).toBeDefined();
    });
  });

  it('searches buildings by id substring', () => {
    const results = searchBuildings(SEED, 'b_0_0');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((b) => {
      expect(b.id).toContain('b_0_0');
    });
  });

  it('returns empty array on empty query or no match', () => {
    expect(searchBuildings(SEED, '')).toEqual([]);
    expect(searchBuildings(SEED, '   ')).toEqual([]);
    expect(searchBuildings(SEED, 'non_existent_building_xyz_9999')).toEqual([]);
  });
});
