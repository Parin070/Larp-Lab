import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { createRNG, hashString } from '../core/rng.js';
import { PALETTE, BUILDING_FOOTPRINT } from './city.js';

export const CHUNK_CELLS = 8;
export const CELL_PITCH = 72;
export const CHUNK_SIZE = CHUNK_CELLS * CELL_PITCH; // 576m
export const HALF_CHUNK = CHUNK_SIZE / 2;           // 288m

// Pure data generator for a chunk — Node and WebGL compatible
export function generateChunkData(worldSeed, cx, cz) {
  const chunkSeed = hashString(`chunk_${worldSeed}_${cx}_${cz}`);
  const rng = createRNG(chunkSeed);
  const buildings = [];

  for (let lz = 0; lz < CHUNK_CELLS; lz++) {
    for (let lx = 0; lx < CHUNK_CELLS; lx++) {
      const x = cx * CHUNK_SIZE - HALF_CHUNK + lx * CELL_PITCH + CELL_PITCH / 2;
      const z = cz * CHUNK_SIZE - HALF_CHUNK + lz * CELL_PITCH + CELL_PITCH / 2;
      const height = rng.nextFloat(12, 65);
      const colorIndex = rng.nextInt(0, PALETTE.length - 1);
      const buildingSeed = rng.nextInt(0, 0x7fffffff);

      // Determine door side (0: South, 1: North, 2: East, 3: West)
      const doorSide = rng.nextInt(0, 3);
      let doorX = x;
      let doorZ = z;
      let facing = 'south';

      if (doorSide === 0) {
        doorZ = z + BUILDING_FOOTPRINT / 2;
        facing = 'south';
      } else if (doorSide === 1) {
        doorZ = z - BUILDING_FOOTPRINT / 2;
        facing = 'north';
      } else if (doorSide === 2) {
        doorX = x + BUILDING_FOOTPRINT / 2;
        facing = 'east';
      } else {
        doorX = x - BUILDING_FOOTPRINT / 2;
        facing = 'west';
      }

      const buildingId = `b_${cx}_${cz}_${lx}_${lz}`;
      const address = `${Math.abs(cx * 8 + lx) * 10 + 100} Ave ${Math.abs(cz * 8 + lz) + 1}`;

      buildings.push({
        id: buildingId,
        address,
        cx,
        cz,
        lx,
        lz,
        x: Math.round(x * 1000) / 1000,
        z: Math.round(z * 1000) / 1000,
        height: Math.round(height * 1000) / 1000,
        colorIndex,
        seed: buildingSeed,
        door: {
          x: Math.round(doorX * 1000) / 1000,
          y: 0,
          z: Math.round(doorZ * 1000) / 1000,
          facing
        }
      });
    }
  }

  return buildings;
}

// Create chunk 3D meshes (1 InstancedMesh for buildings, 1 merged static mesh for ground/roads/doors)
export function createChunkMeshes(chunkData, cx, cz, sharedBuildingMaterial, sharedStaticMaterial, sharedBoxGeometry) {
  const totalCount = chunkData.length;

  // 1. InstancedMesh for 64 buildings
  const buildingMesh = new THREE.InstancedMesh(
    sharedBoxGeometry,
    sharedBuildingMaterial,
    totalCount
  );

  // Set explicit bounding sphere covering full chunk area and height for frustum culling
  buildingMesh.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(cx * CHUNK_SIZE, 35, cz * CHUNK_SIZE),
    420
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  chunkData.forEach((b, i) => {
    position.set(b.x, b.height / 2, b.z);
    scale.set(BUILDING_FOOTPRINT, b.height, BUILDING_FOOTPRINT);
    matrix.compose(position, rotation, scale);
    buildingMesh.setMatrixAt(i, matrix);

    color.setHex(PALETTE[b.colorIndex]);
    buildingMesh.setColorAt(i, color);
  });

  buildingMesh.instanceMatrix.needsUpdate = true;
  if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;

  // 2. Merged static mesh for roads, ground slabs, and door markers
  const geometriesToMerge = [];

  // Road plane for chunk
  const roadGeom = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);
  roadGeom.rotateX(-Math.PI / 2);
  roadGeom.translate(cx * CHUNK_SIZE, -0.5, cz * CHUNK_SIZE);
  geometriesToMerge.push(roadGeom);

  // Ground slabs and door frames for each building
  chunkData.forEach((b) => {
    // Plaza / ground slab
    const slabGeom = new THREE.BoxGeometry(BUILDING_FOOTPRINT + 4, 0.5, BUILDING_FOOTPRINT + 4);
    slabGeom.translate(b.x, -0.25, b.z);
    geometriesToMerge.push(slabGeom);

    // Door indicator marker
    const doorGeom = new THREE.BoxGeometry(3, 3.5, 0.4);
    if (b.door.facing === 'east' || b.door.facing === 'west') {
      doorGeom.rotateY(Math.PI / 2);
    }
    doorGeom.translate(b.door.x, 1.75, b.door.z);
    geometriesToMerge.push(doorGeom);
  });

  const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometriesToMerge, false);

  // Clean up unmerged temporary geometries
  geometriesToMerge.forEach((g) => g.dispose());

  const staticMesh = new THREE.Mesh(mergedGeometry, sharedStaticMaterial);

  return {
    cx,
    cz,
    buildingMesh,
    staticMesh,
    data: chunkData,
    dispose() {
      if (buildingMesh.parent) buildingMesh.parent.remove(buildingMesh);
      if (staticMesh.parent) staticMesh.parent.remove(staticMesh);
      mergedGeometry.dispose();
      buildingMesh.dispose();
    }
  };
}
