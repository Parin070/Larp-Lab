import { describe, it, expect } from 'vitest';
import { createTimeController, getWindowIntensity, getSkyColor, CYCLE_SPEED } from '../src/sim/time.js';

describe('timeController and lighting', () => {
  it('initializes at morning (0.3) and has CYCLE_SPEED = 1/600', () => {
    const time = createTimeController();
    expect(time.getTime()).toBeCloseTo(0.3, 4);
    expect(time.getHour()).toBe(7); // 0.3 * 24 = 7.2
    expect(CYCLE_SPEED).toBeCloseTo(1 / 600, 6);
  });

  it('scrubs time backward and forward correctly', () => {
    const time = createTimeController();
    time.scrub(1); // +1 hour = +1/24
    expect(time.getTime()).toBeCloseTo(0.3 + 1 / 24, 4);
    time.scrub(-2); // -2 hours
    expect(time.getTime()).toBeCloseTo(0.3 - 1 / 24, 4);
  });

  it('toggles pause and respects pause in update', () => {
    const time = createTimeController();
    expect(time.isPaused()).toBe(false);
    time.togglePause();
    expect(time.isPaused()).toBe(true);

    const initial = time.getTime();
    time.update(10);
    expect(time.getTime()).toBe(initial);

    time.togglePause();
    expect(time.isPaused()).toBe(false);
    time.update(1);
    expect(time.getTime()).toBeGreaterThan(initial);
  });

  it('calculates smooth window emissive intensity', () => {
    // Noon: sun is at zenith (sin(angle)=1 > 0.2), windows off (0)
    const noonIntensity = getWindowIntensity(0.5);
    expect(noonIntensity).toBeCloseTo(0, 2);

    // Midnight: sun is below horizon (sin(angle)=-1 < -0.1), windows full on (~0.85)
    const midnightIntensity = getWindowIntensity(0.0);
    expect(midnightIntensity).toBeCloseTo(0.85, 2);

    // Smooth transition at dawn (0.25)
    const dawnIntensity = getWindowIntensity(0.25);
    expect(dawnIntensity).toBeGreaterThan(0);
    expect(dawnIntensity).toBeLessThan(0.85);
  });

  it('returns valid sky colors throughout the day', () => {
    const noonColor = getSkyColor(0.5);
    expect(noonColor).toBeDefined();
    expect(noonColor.r).toBeGreaterThan(0);

    const midnightColor = getSkyColor(0.0);
    expect(midnightColor).toBeDefined();
    expect(midnightColor.r).toBeLessThan(noonColor.r);
  });
});
