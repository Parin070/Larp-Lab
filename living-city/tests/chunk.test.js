import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateChunkData, createChunkMeshes, CHUNK_SIZE, CHUNK_CELLS, CELL_PITCH } from '../src/world/chunk.js';
import { createBuildingMaterial } from '../src/world/city.js';

describe('Chunk Generation and Determinism', () => {
  const SEED = 42;

  it('generates 64 buildings per chunk', () => {
    const data = generateChunkData(SEED, 0, 0);
    expect(data.length).toBe(CHUNK_CELLS * CHUNK_CELLS);
    expect(data[0].id).toBe('b_0_0_0_0');
  });

  it('is strictly deterministic: same seed and coords produce identical results', () => {
    const dataA = generateChunkData(SEED, 2, -3);
    const dataB = generateChunkData(SEED, 2, -3);

    expect(dataA).toEqual(dataB);
  });

  it('is load-order independent', () => {
    // Generate chunk A, then B
    const run1A = generateChunkData(SEED, 5, 5);
    const run1B = generateChunkData(SEED, -2, 4);

    // Generate chunk B, then A
    const run2B = generateChunkData(SEED, -2, 4);
    const run2A = generateChunkData(SEED, 5, 5);

    expect(run1A).toEqual(run2A);
    expect(run1B).toEqual(run2B);
  });

  it('places doors on ground level facing one of 4 cardinal directions', () => {
    const data = generateChunkData(SEED, 0, 0);
    const validFacings = ['south', 'north', 'east', 'west'];

    data.forEach((b) => {
      expect(validFacings).toContain(b.door.facing);
      expect(b.door.y).toBe(0);
      expect(b.height).toBeGreaterThanOrEqual(12);
      expect(b.height).toBeLessThanOrEqual(65);
    });
  });

  it('creates valid 3D meshes with bounding spheres for frustum culling', () => {
    const data = generateChunkData(SEED, 1, 2);
    const boxGeom = new THREE.BoxGeometry(1, 1, 1);
    const bMat = createBuildingMaterial();
    const sMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

    const chunk = createChunkMeshes(data, 1, 2, bMat, sMat, boxGeom);

    expect(chunk.buildingMesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(chunk.buildingMesh.count).toBe(64);
    expect(chunk.buildingMesh.boundingSphere).toBeDefined();
    expect(chunk.buildingMesh.boundingSphere.radius).toBeGreaterThan(0);

    expect(chunk.staticMesh).toBeInstanceOf(THREE.Mesh);
    expect(chunk.staticMesh.geometry).toBeDefined();

    // Verify cleanup
    chunk.dispose();
    boxGeom.dispose();
    bMat.dispose();
    sMat.dispose();
  });
});
