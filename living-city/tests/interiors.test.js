import { describe, it, expect } from 'vitest';
import { createBSPTree } from '../src/interiors/bsp.js';
import { generateInterior, INTERIOR_WIDTH, INTERIOR_DEPTH, CEILING_HEIGHT } from '../src/interiors/interiorGenerator.js';
import { createInteriorScene } from '../src/interiors/interiorScene.js';

describe('Interior Generation and BSP', () => {
  const SEED = 987654;

  it('generates deterministic BSP tree from seed', () => {
    const bspA = createBSPTree(SEED, 40, 40);
    const bspB = createBSPTree(SEED, 40, 40);

    expect(bspA.leaves.length).toBe(bspB.leaves.length);
    expect(bspA.leaves[0]).toEqual(bspB.leaves[0]);
  });

  it('creates valid leaf rooms with types and doorways', () => {
    const bsp = createBSPTree(SEED, 40, 40);

    expect(bsp.leaves.length).toBeGreaterThan(0);
    bsp.leaves.forEach((leaf) => {
      expect(leaf.type).toBeDefined();
      expect(leaf.w).toBeGreaterThan(0);
      expect(leaf.d).toBeGreaterThan(0);
    });
  });

  it('generates complete interior geometry with exit door', () => {
    const interior = generateInterior(SEED);

    expect(interior.meshes.length).toBe(2);
    expect(interior.exitDoor).toBeDefined();
    expect(interior.spawnPos).toBeDefined();
    expect(interior.wallAABBs.length).toBeGreaterThan(0);

    // Verify spawn position is near exit
    expect(Math.abs(interior.spawnPos.z - interior.exitDoor.z)).toBeLessThan(2);

    interior.dispose();
  });

  it('creates interior scene with collision and exit detection', () => {
    const building = { id: 'b_0_0_0_0', seed: SEED, x: 0, z: 0, height: 30 };
    const interiorScene = createInteriorScene(building);

    expect(interiorScene.scene).toBeDefined();
    expect(interiorScene.building).toBe(building);

    // Test exit proximity
    const nearExit = interiorScene.isNearExit({ x: 0, y: 0, z: interiorScene.exitDoor.z });
    expect(nearExit).toBe(true);

    const farFromExit = interiorScene.isNearExit({ x: -15, y: 0, z: -15 });
    expect(farFromExit).toBe(false);

    // Test collision resolver
    const resolved = interiorScene.resolveCollision(
      { x: 0, y: 0, z: 0 },
      { x: 100, z: 100 },
      0.4
    );
    expect(resolved.x).toBeLessThan(100);
    expect(resolved.z).toBeLessThan(100);

    interiorScene.dispose();
  });
});
