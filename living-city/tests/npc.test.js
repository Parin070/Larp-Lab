import { describe, it, expect } from 'vitest';
import { generateChunkNPCs, evaluateNPCPosition, NPC_ACTIVITIES, createNPCSchedule } from '../src/sim/npc.js';
import { createNPCRenderer } from '../src/sim/npcRenderer.js';

describe('Per-Chunk Ambient Active NPCs & Kinematics', () => {
  const WORLD_SEED = 12345;

  it('generates deterministic active NPCs per chunk', () => {
    const npcsA = generateChunkNPCs(WORLD_SEED, 0, 0, 8);
    const npcsB = generateChunkNPCs(WORLD_SEED, 0, 0, 8);

    expect(npcsA.length).toBe(8);
    expect(npcsB.length).toBe(8);
    expect(npcsA).toEqual(npcsB);

    for (const npc of npcsA) {
      expect(npc.id).toBeDefined();
      expect(npc.activity).toBeDefined();
      expect(Object.values(NPC_ACTIVITIES)).toContain(npc.activity);
      expect(npc.colorHex).toBeTypeOf('number');
      expect(npc.name).toContain('Dude-');
    }
  });

  it('generates distinct deterministic NPCs across different chunks', () => {
    const chunkOrigin = generateChunkNPCs(WORLD_SEED, 0, 0, 8);
    const chunkEast = generateChunkNPCs(WORLD_SEED, 1, 0, 8);

    expect(chunkOrigin[0].id).not.toBe(chunkEast[0].id);
    expect(chunkOrigin[0].cellCenterX).not.toBe(chunkEast[0].cellCenterX);
  });

  it('evaluates closed-form 100% outdoor position, step bounce, heading, and articulated limbs', () => {
    const npcs = generateChunkNPCs(WORLD_SEED, 0, 0, 8);

    for (const npc of npcs) {
      for (const time of [0.0, 0.25, 0.5, 0.75, 1.0, 12.5]) {
        const pos = evaluateNPCPosition(npc, time);

        expect(pos.isOutdoor).toBe(true);
        expect(pos.y).toBeGreaterThanOrEqual(0.15); // Above ground on sidewalk
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.z)).toBe(true);
        expect(Number.isFinite(pos.heading)).toBe(true);
        expect(Number.isFinite(pos.roll)).toBe(true);
        expect(Number.isFinite(pos.armAngleL)).toBe(true);
        expect(Number.isFinite(pos.armAngleR)).toBe(true);
        expect(Number.isFinite(pos.legAngleL)).toBe(true);
        expect(Number.isFinite(pos.legAngleR)).toBe(true);
        expect(Number.isFinite(pos.headYaw)).toBe(true);
        expect(Number.isFinite(pos.headPitch)).toBe(true);

        // Verify limb rotations stay within realistic anatomical bounds (<= 60 degrees / 1.05 rad)
        expect(Math.abs(pos.armAngleL)).toBeLessThanOrEqual(1.05);
        expect(Math.abs(pos.armAngleR)).toBeLessThanOrEqual(1.05);
        expect(Math.abs(pos.legAngleL)).toBeLessThanOrEqual(1.05);
        expect(Math.abs(pos.legAngleR)).toBeLessThanOrEqual(1.05);
      }
    }
  });

  it('supports backward-compatible createNPCSchedule helper', () => {
    const sched = createNPCSchedule(777, WORLD_SEED);
    expect(sched.id).toBe('npc_777');
    const pos = evaluateNPCPosition(sched, 0.5);
    expect(pos.isOutdoor).toBe(true);
    expect(Number.isFinite(pos.x)).toBe(true);
  });

  it('renderer manages active chunk instances and nearby queries', () => {
    const renderer = createNPCRenderer(WORLD_SEED, null, 100);
    expect(renderer.mesh).toBeDefined();

    // Update with loaded chunks
    const mockLoadedChunks = new Map([
      ['0,0', { cx: 0, cz: 0 }],
      ['1,0', { cx: 1, cz: 0 }]
    ]);

    expect(() => {
      renderer.update(1.0, mockLoadedChunks);
    }).not.toThrow();

    // Query nearby NPC
    const firstNpcPos = evaluateNPCPosition(generateChunkNPCs(WORLD_SEED, 0, 0, 1)[0], 1.0);
    const nearby = renderer.getNearbyNPC({ x: firstNpcPos.x, z: firstNpcPos.z }, 5.0);
    expect(nearby).not.toBeNull();
    expect(nearby.name).toBeDefined();

    renderer.dispose();
  });
});
