import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { saveGameState, loadGameState, clearGameState } from '../src/save/saveManager.js';
import { createPlayer } from '../src/core/player.js';
import { createTimeController } from '../src/sim/time.js';

describe('Zero-Dependency Persistence (IndexedDB / Mock)', () => {
  const SEED = 12345;

  beforeEach(async () => {
    await clearGameState();
  });

  it('saves and loads player state, seed, and simulation time', async () => {
    const player = createPlayer(SEED, 'walk', new THREE.Vector3(12.5, 0, -45.2));
    const timeController = createTimeController();
    timeController.scrub(4); // Advance time

    const saved = await saveGameState(SEED, player, timeController, [{ type: 'custom_delta', id: 1 }]);
    expect(saved.worldSeed).toBe(SEED);
    expect(saved.player.x).toBe(12.5);
    expect(saved.player.z).toBe(-45.2);
    expect(saved.player.mode).toBe('walk');
    expect(saved.deltas.length).toBe(1);

    const loaded = await loadGameState();
    expect(loaded).toBeDefined();
    expect(loaded.worldSeed).toBe(SEED);
    expect(loaded.player.x).toBe(12.5);
    expect(loaded.player.z).toBe(-45.2);
    expect(loaded.player.mode).toBe('walk');
    expect(loaded.deltas.length).toBe(1);
  });

  it('clears saved state successfully', async () => {
    const player = createPlayer(SEED, 'fly', new THREE.Vector3(0, 50, 0));
    const time = createTimeController();
    await saveGameState(SEED, player, time);

    let loaded = await loadGameState();
    expect(loaded).not.toBeNull();

    await clearGameState();
    loaded = await loadGameState();
    expect(loaded).toBeNull();
  });
});
