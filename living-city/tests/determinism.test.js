import { test, expect } from 'vitest';
import { createRNG } from '../src/core/rng.js';
import { generateCityData } from '../src/world/city.js';

// Simple FNV-1a hash algorithm for data determinism
function hashCityData(data) {
  const str = JSON.stringify(data);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

test('same seed produces exact same city layout hash', () => {
  const rng1 = createRNG(12345);
  const city1 = generateCityData(rng1, 20);
  const hash1 = hashCityData(city1);

  const rng2 = createRNG(12345);
  const city2 = generateCityData(rng2, 20);
  const hash2 = hashCityData(city2);

  expect(hash1).toBe(hash2);
  expect(city1).toEqual(city2);
});

test('different seeds produce different city layout hashes', () => {
  const rng1 = createRNG(12345);
  const city1 = generateCityData(rng1, 20);
  const hash1 = hashCityData(city1);

  const rng2 = createRNG(99999);
  const city2 = generateCityData(rng2, 20);
  const hash2 = hashCityData(city2);

  expect(hash1).not.toBe(hash2);
});

test('city layout contains exactly 400 buildings for 20x20 grid', () => {
  const rng = createRNG(12345);
  const city = generateCityData(rng, 20);

  expect(city.length).toBe(400);
});

test('building data values are valid numbers within ranges', () => {
  const rng = createRNG(42);
  const city = generateCityData(rng, 10);

  for (const b of city) {
    expect(typeof b.x).toBe('number');
    expect(typeof b.z).toBe('number');
    expect(b.height).toBeGreaterThanOrEqual(10);
    expect(b.height).toBeLessThanOrEqual(60);
    expect(b.colorIndex).toBeGreaterThanOrEqual(0);
    expect(b.colorIndex).toBeLessThanOrEqual(5);
  }
});
