import { describe, it, expect } from 'vitest';
import { createNPCSchedule, evaluateNPCPosition } from '../src/sim/npc.js';

describe('NPC Schedules and Far-Field Evaluation', () => {
  const WORLD_SEED = 12345;
  const NPC_SEED = 777;

  it('generates deterministic schedule from seed', () => {
    const schedA = createNPCSchedule(NPC_SEED, WORLD_SEED);
    const schedB = createNPCSchedule(NPC_SEED, WORLD_SEED);

    expect(schedA).toEqual(schedB);
    expect(schedA.home).toBeDefined();
    expect(schedA.work).toBeDefined();
  });

  it('evaluates closed-form position accurately based on time of day', () => {
    const sched = createNPCSchedule(NPC_SEED, WORLD_SEED);

    // Midnight (0.0): Home, indoor
    const midnight = evaluateNPCPosition(sched, 0.0);
    expect(midnight.state).toBe('home');
    expect(midnight.isOutdoor).toBe(false);
    expect(midnight.x).toBeCloseTo(sched.home.x, 1);
    expect(midnight.z).toBeCloseTo(sched.home.z, 1);

    // Morning Commute (08:00 = 8/24 = 0.333): Commuting to work, outdoor
    const commute1 = evaluateNPCPosition(sched, 8 / 24);
    expect(commute1.state).toBe('commute_work');
    expect(commute1.isOutdoor).toBe(true);

    // Afternoon Work (14:00 = 14/24 = 0.583): Work, indoor
    const work = evaluateNPCPosition(sched, 14 / 24);
    expect(work.state).toBe('work');
    expect(work.isOutdoor).toBe(false);
    expect(work.x).toBeCloseTo(sched.work.x, 1);
    expect(work.z).toBeCloseTo(sched.work.z, 1);

    // Evening Commute (18:00 = 18/24 = 0.75): Commuting home, outdoor
    const commute2 = evaluateNPCPosition(sched, 18 / 24);
    expect(commute2.state).toBe('commute_home');
    expect(commute2.isOutdoor).toBe(true);
  });

  it('is purely mathematical and does not require WebGL', () => {
    const sched = createNPCSchedule(54321, WORLD_SEED);
    const pos = evaluateNPCPosition(sched, 0.5);
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.z).toBe('number');
  });
});
