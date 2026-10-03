import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getNearbyBuildingAABBs, resolveCollision } from '../src/core/physics.js';
import { createPlayer } from '../src/core/player.js';

describe('AABB Collision and Physics', () => {
  const SEED = 12345;

  it('queries only the local 3x3 cell neighborhood (max 9 AABBs)', () => {
    const aabbs = getNearbyBuildingAABBs(SEED, 0, 0);
    expect(aabbs.length).toBeGreaterThan(0);
    expect(aabbs.length).toBeLessThanOrEqual(9);

    aabbs.forEach((box) => {
      expect(box.minX).toBeLessThan(box.maxX);
      expect(box.minZ).toBeLessThan(box.maxZ);
      expect(box.maxY).toBeGreaterThan(box.minY);
    });
  });

  it('blocks player from penetrating building wall', () => {
    const aabbs = getNearbyBuildingAABBs(SEED, 0, 0);
    const targetBox = aabbs[0];

    // Position player just outside the minX face
    const radius = 0.4;
    const startX = targetBox.minX - radius - 0.1;
    const centerZ = (targetBox.minZ + targetBox.maxZ) / 2;
    const startPos = { x: startX, y: 0, z: centerZ };

    // Try to move 2m into the building (+X)
    const desiredMove = { x: 2.0, z: 0 };
    const resolved = resolveCollision(SEED, startPos, desiredMove, radius);

    // Player should be stopped at the boundary (minX - radius)
    expect(resolved.x).toBeCloseTo(targetBox.minX - radius, 2);
    expect(resolved.z).toBeCloseTo(centerZ, 2);
  });

  it('allows sliding along building wall when moving diagonally', () => {
    const aabbs = getNearbyBuildingAABBs(SEED, 0, 0);
    const targetBox = aabbs[0];

    const radius = 0.4;
    const startX = targetBox.minX - radius - 0.05;
    const centerZ = (targetBox.minZ + targetBox.maxZ) / 2;
    const startPos = { x: startX, y: 0, z: centerZ };

    // Move diagonally: +X (into wall) and +Z (along wall)
    const desiredMove = { x: 1.0, z: 1.5 };
    const resolved = resolveCollision(SEED, startPos, desiredMove, radius);

    // X should be clamped to wall, Z should move freely
    expect(resolved.x).toBeCloseTo(targetBox.minX - radius, 2);
    expect(resolved.z).toBeCloseTo(centerZ + 1.5, 2);
  });

  it('toggles player mode and handles gravity in walk mode', () => {
    const player = createPlayer(SEED, 'walk', new THREE.Vector3(0, 10, 0));
    expect(player.getMode()).toBe('walk');

    const camera = new THREE.PerspectiveCamera();
    const mockInput = {
      keys: { w: false, a: false, s: false, d: false, shift: false, space: false, c: false },
      consumeMouse: () => ({ dx: 0, dy: 0 })
    };

    // Update with dt=0.5s -> should fall under gravity (GRAVITY=20)
    player.update(camera, mockInput, 0.1);
    expect(player.getPosition().y).toBeLessThan(10);

    // Run multiple steps until grounded at y=0
    for (let i = 0; i < 20; i++) {
      player.update(camera, mockInput, 0.1);
    }
    expect(player.getPosition().y).toBe(0);
    expect(player.isGrounded()).toBe(true);

    // Toggle mode to fly
    player.toggleMode(camera);
    expect(player.getMode()).toBe('fly');
  });
});
