import { test, expect } from 'vitest';
import { createRNG } from '../src/core/rng.js';

test('same seed produces same sequence', () => {
  const rng1 = createRNG(12345);
  const rng2 = createRNG(12345);

  const seq1 = Array.from({ length: 10 }, () => rng1.next());
  const seq2 = Array.from({ length: 10 }, () => rng2.next());

  expect(seq1).toEqual(seq2);
});

test('different seeds produce different sequences', () => {
  const rng1 = createRNG(12345);
  const rng2 = createRNG(99999);

  const val1 = rng1.next();
  const val2 = rng2.next();

  expect(val1).not.toBe(val2);
});

test('nextInt returns integers in range', () => {
  const rng = createRNG(42);

  for (let i = 0; i < 100; i++) {
    const val = rng.nextInt(10, 20);
    expect(val).toBeGreaterThanOrEqual(10);
    expect(val).toBeLessThanOrEqual(20);
    expect(Number.isInteger(val)).toBe(true);
  }
});

test('nextFloat returns floats in range', () => {
  const rng = createRNG(42);

  for (let i = 0; i < 100; i++) {
    const val = rng.nextFloat(5.0, 10.0);
    expect(val).toBeGreaterThanOrEqual(5.0);
    expect(val).toBeLessThan(10.0);
  }
});

test('fork creates independent RNG', () => {
  const parent = createRNG(12345);
  const child = parent.fork();

  const parentVal = parent.next();
  const childVal = child.next();

  expect(parentVal).not.toBe(childVal);
});

test('state can be saved and restored', () => {
  const rng = createRNG(12345);
  rng.next();
  rng.next();

  const state = rng.getState();
  const expected = rng.next();

  rng.setState(state);
  const actual = rng.next();

  expect(actual).toBe(expected);
});
