import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { createRNG, hashString } from '../core/rng.js';
import { PALETTE, BUILDING_FOOTPRINT } from './city.js';

export const CHUNK_CELLS = 8;
export const CELL_PITCH = 72;
export const CHUNK_SIZE = CHUNK_CELLS * CELL_PITCH; // 576m
export const HALF_CHUNK = CHUNK_SIZE / 2;           // 288m
export const ROAD_WIDTH = 12;                       // 12m wide street
export const BLOCK_SIZE = 60;                       // 60m block

// Helper to assign RGB vertex colors to a geometry
function colorGeom(geom, hex) {
  const c = new THREE.Color(hex);
  const count = geom.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geom;
}

// Pure data generator for a chunk — Node and WebGL compatible
export function generateChunkData(worldSeed, cx, cz) {
  const chunkSeed = hashString(`chunk_${worldSeed}_${cx}_${cz}`);
  const rng = createRNG(chunkSeed);
  const buildings = [];

  const BUILDING_TYPES = ['commercial', 'residential', 'office', 'highrise', 'diner'];

  for (let lz = 0; lz < CHUNK_CELLS; lz++) {
    for (let lx = 0; lx < CHUNK_CELLS; lx++) {
      const x = cx * CHUNK_SIZE - HALF_CHUNK + lx * CELL_PITCH + CELL_PITCH / 2;
      const z = cz * CHUNK_SIZE - HALF_CHUNK + lz * CELL_PITCH + CELL_PITCH / 2;
      const height = rng.nextFloat(12, 65);
      const colorIndex = rng.nextInt(0, PALETTE.length - 1);
      const buildingSeed = rng.nextInt(0, 0x7fffffff);
      const type = BUILDING_TYPES[rng.nextInt(0, BUILDING_TYPES.length - 1)];

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
        type,
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

// Create chunk 3D meshes (1 InstancedMesh for buildings, 1 merged static mesh with vertex colors)
export function createChunkMeshes(chunkData, cx, cz, sharedBuildingMaterial, sharedStaticMaterial, sharedBoxGeometry) {
  const totalCount = chunkData.length;

  // 1. InstancedMesh for 64 buildings
  const buildingMesh = new THREE.InstancedMesh(
    sharedBoxGeometry,
    sharedBuildingMaterial,
    totalCount
  );

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

  // 2. Merged static mesh for roads, markings, crosswalks, sidewalks, lawns, props, trees, and door portals
  const geometriesToMerge = [];
  const chunkRng = createRNG(hashString(`static_${cx}_${cz}`));

  // Asphalt base road plane (dark slate)
  const roadGeom = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);
  roadGeom.rotateX(-Math.PI / 2);
  roadGeom.translate(cx * CHUNK_SIZE, -0.05, cz * CHUNK_SIZE);
  colorGeom(roadGeom, 0x242830);
  geometriesToMerge.push(roadGeom);

  // Road markings and Crosswalks
  const minChunkX = cx * CHUNK_SIZE - HALF_CHUNK;
  const minChunkZ = cz * CHUNK_SIZE - HALF_CHUNK;

  for (let l = 0; l <= CHUNK_CELLS; l++) {
    const rx = minChunkX + l * CELL_PITCH;
    const rz = minChunkZ + l * CELL_PITCH;

    // Road dashed yellow centerline along Z
    for (let seg = 0; seg < CHUNK_SIZE; seg += 6) {
      const markZ = new THREE.BoxGeometry(0.35, 0.04, 3.2);
      markZ.translate(rx, 0.02, minChunkZ + seg + 1.6);
      colorGeom(markZ, 0xffd166);
      geometriesToMerge.push(markZ);
    }

    // Road dashed yellow centerline along X
    for (let seg = 0; seg < CHUNK_SIZE; seg += 6) {
      const markX = new THREE.BoxGeometry(3.2, 0.04, 0.35);
      markX.translate(minChunkX + seg + 1.6, 0.02, rz);
      colorGeom(markX, 0xffd166);
      geometriesToMerge.push(markX);
    }

    // Zebra Crossings at intersections
    for (let k = 0; k <= CHUNK_CELLS; k++) {
      const ix = minChunkX + k * CELL_PITCH;
      const iz = minChunkZ + l * CELL_PITCH;

      // 4 crosswalk sets per intersection
      const offsets = [
        { dx: 0, dz: 6, rot: 0 },
        { dx: 0, dz: -6, rot: 0 },
        { dx: 6, dz: 0, rot: Math.PI / 2 },
        { dx: -6, dz: 0, rot: Math.PI / 2 }
      ];

      offsets.forEach(({ dx, dz, rot }) => {
        for (let s = -3.5; s <= 3.5; s += 1.2) {
          const stripe = new THREE.BoxGeometry(0.6, 0.04, 3.2);
          if (rot !== 0) stripe.rotateY(rot);
          if (rot === 0) {
            stripe.translate(ix + s, 0.03, iz + dz);
          } else {
            stripe.translate(ix + dx, 0.03, iz + s);
          }
          colorGeom(stripe, 0xf8f9fa);
          geometriesToMerge.push(stripe);
        }
      });
    }
  }

  // Building lots, sidewalks, lawns, street props, trees, and door portals
  chunkData.forEach((b) => {
    const lotRng = createRNG(b.seed);

    // 1. Concrete sidewalk perimeter (raised 0.15m)
    const sidewalkGeom = new THREE.BoxGeometry(BLOCK_SIZE, 0.15, BLOCK_SIZE);
    sidewalkGeom.translate(b.x, 0.075, b.z);
    colorGeom(sidewalkGeom, 0xdcdde1);
    geometriesToMerge.push(sidewalkGeom);

    // 2. Lush green park / lawn slab
    const lawnGeom = new THREE.BoxGeometry(BUILDING_FOOTPRINT + 4, 0.18, BUILDING_FOOTPRINT + 4);
    lawnGeom.translate(b.x, 0.09, b.z);
    colorGeom(lawnGeom, 0x48bb78);
    geometriesToMerge.push(lawnGeom);

    // 3. Paved walkway path connecting sidewalk to door
    let walkW = 4.0;
    let walkD = 4.0;
    let wx = b.door.x;
    let wz = b.door.z;
    if (b.door.facing === 'south' || b.door.facing === 'north') {
      walkW = 3.6;
      walkD = (BLOCK_SIZE - BUILDING_FOOTPRINT) / 2 + 1;
      wz = b.door.facing === 'south' ? b.door.z + walkD / 2 - 0.5 : b.door.z - walkD / 2 + 0.5;
    } else {
      walkD = 3.6;
      walkW = (BLOCK_SIZE - BUILDING_FOOTPRINT) / 2 + 1;
      wx = b.door.facing === 'east' ? b.door.x + walkW / 2 - 0.5 : b.door.x - walkW / 2 + 0.5;
    }
    const walkGeom = new THREE.BoxGeometry(walkW, 0.2, walkD);
    walkGeom.translate(wx, 0.1, wz);
    colorGeom(walkGeom, 0xe2e8f0);
    geometriesToMerge.push(walkGeom);

    // 4. Roof parapet / top architectural cornice on building
    const roofGeom = new THREE.BoxGeometry(BUILDING_FOOTPRINT + 1.2, 0.8, BUILDING_FOOTPRINT + 1.2);
    roofGeom.translate(b.x, b.height + 0.4, b.z);
    colorGeom(roofGeom, 0x1e293b);
    geometriesToMerge.push(roofGeom);

    // 5. Stylized High-Visibility Door Portal
    const isEW = b.door.facing === 'east' || b.door.facing === 'west';

    // Outer door surround frame
    const frameGeom = new THREE.BoxGeometry(3.6, 4.2, 0.6);
    if (isEW) frameGeom.rotateY(Math.PI / 2);
    frameGeom.translate(b.door.x, 2.1, b.door.z);
    colorGeom(frameGeom, 0x0f172a);
    geometriesToMerge.push(frameGeom);

    // Door leaf inside frame
    const doorLeaf = new THREE.BoxGeometry(2.8, 3.8, 0.3);
    if (isEW) doorLeaf.rotateY(Math.PI / 2);
    doorLeaf.translate(b.door.x, 1.9, b.door.z);
    colorGeom(doorLeaf, 0x2563eb);
    geometriesToMerge.push(doorLeaf);

    // Overhead canopy awning over door
    const awningGeom = new THREE.BoxGeometry(4.2, 0.4, 2.0);
    if (isEW) awningGeom.rotateY(Math.PI / 2);
    const aOffX = b.door.facing === 'east' ? 0.8 : b.door.facing === 'west' ? -0.8 : 0;
    const aOffZ = b.door.facing === 'south' ? 0.8 : b.door.facing === 'north' ? -0.8 : 0;
    awningGeom.translate(b.door.x + aOffX, 4.3, b.door.z + aOffZ);
    colorGeom(awningGeom, 0xef4444);
    geometriesToMerge.push(awningGeom);

    // Illuminated welcome entrance pad on ground
    const padGeom = new THREE.BoxGeometry(3.0, 0.22, 2.0);
    if (isEW) padGeom.rotateY(Math.PI / 2);
    padGeom.translate(b.door.x + aOffX * 0.7, 0.11, b.door.z + aOffZ * 0.7);
    colorGeom(padGeom, 0x10b981);
    geometriesToMerge.push(padGeom);

    // 6. Stylized Low-Poly Trees planted in lawn corners
    const treeCorners = [
      { tx: b.x - 24, tz: b.z - 24 },
      { tx: b.x + 24, tz: b.z - 24 },
      { tx: b.x - 24, tz: b.z + 24 },
      { tx: b.x + 24, tz: b.z + 24 }
    ];

    const chosenCorner = treeCorners[lotRng.nextInt(0, treeCorners.length - 1)];
    const trunkGeom = new THREE.BoxGeometry(0.6, 2.4, 0.6);
    trunkGeom.translate(chosenCorner.tx, 1.2, chosenCorner.tz);
    colorGeom(trunkGeom, 0x78350f);
    geometriesToMerge.push(trunkGeom);

    // Multifaceted foliage canopy
    const TREE_PALETTE = [0x22c55e, 0x16a34a, 0x10b981, 0x38bdf8, 0xf472b6];
    const foliageColor = TREE_PALETTE[lotRng.nextInt(0, TREE_PALETTE.length - 1)];

    const f1 = new THREE.BoxGeometry(3.0, 2.0, 3.0);
    f1.translate(chosenCorner.tx, 2.8, chosenCorner.tz);
    colorGeom(f1, foliageColor);
    geometriesToMerge.push(f1);

    const f2 = new THREE.BoxGeometry(2.0, 1.6, 2.0);
    f2.translate(chosenCorner.tx, 4.2, chosenCorner.tz);
    colorGeom(f2, foliageColor);
    geometriesToMerge.push(f2);

    // 7. Street Props on Sidewalk (Fire Hydrant, Mailbox, or Trash Bin)
    const propChoice = lotRng.nextInt(0, 3);
    const propX = b.x + (lotRng.next() > 0.5 ? 27 : -27);
    const propZ = b.z + (lotRng.next() > 0.5 ? 27 : -27);

    if (propChoice === 0) {
      // Fire Hydrant (Red cylinder/box + silver cap)
      const hydBody = new THREE.BoxGeometry(0.5, 0.9, 0.5);
      hydBody.translate(propX, 0.55, propZ);
      colorGeom(hydBody, 0xef4444);
      geometriesToMerge.push(hydBody);

      const hydCap = new THREE.BoxGeometry(0.3, 0.25, 0.3);
      hydCap.translate(propX, 1.05, propZ);
      colorGeom(hydCap, 0xfbbf24);
      geometriesToMerge.push(hydCap);
    } else if (propChoice === 1) {
      // Mailbox (Vibrant Blue drop box)
      const postStand = new THREE.BoxGeometry(0.2, 0.6, 0.2);
      postStand.translate(propX, 0.4, propZ);
      colorGeom(postStand, 0x334155);
      geometriesToMerge.push(postStand);

      const mailBox = new THREE.BoxGeometry(0.7, 0.8, 0.6);
      mailBox.translate(propX, 1.0, propZ);
      colorGeom(mailBox, 0x0284c7);
      geometriesToMerge.push(mailBox);
    } else if (propChoice === 2) {
      // Curbside Trash Bin (Yellow/Green container)
      const binBody = new THREE.BoxGeometry(0.65, 1.0, 0.65);
      binBody.translate(propX, 0.6, propZ);
      colorGeom(binBody, 0xfacc15);
      geometriesToMerge.push(binBody);

      const binLid = new THREE.BoxGeometry(0.75, 0.15, 0.75);
      binLid.translate(propX, 1.15, propZ);
      colorGeom(binLid, 0x1e293b);
      geometriesToMerge.push(binLid);
    } else {
      // Street Lamp Post
      const lampPole = new THREE.BoxGeometry(0.3, 5.0, 0.3);
      lampPole.translate(propX, 2.5, propZ);
      colorGeom(lampPole, 0x64748b);
      geometriesToMerge.push(lampPole);

      const lampArm = new THREE.BoxGeometry(1.2, 0.25, 0.3);
      lampArm.translate(propX + 0.5, 5.0, propZ);
      colorGeom(lampArm, 0x64748b);
      geometriesToMerge.push(lampArm);

      const lampHead = new THREE.BoxGeometry(0.5, 0.3, 0.4);
      lampHead.translate(propX + 1.0, 4.8, propZ);
      colorGeom(lampHead, 0xfef08a);
      geometriesToMerge.push(lampHead);
    }
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
