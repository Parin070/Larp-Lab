import * as THREE from 'three';

// City grid constants
export const GRID_SIZE = 20;         // 20x20 blocks
export const BLOCK_SIZE = 64;        // 64m chunk/block size
export const ROAD_WIDTH = 8;         // 8m road width
export const CELL_PITCH = BLOCK_SIZE + ROAD_WIDTH; // 72m
export const BUILDING_FOOTPRINT = 50; // 50m building size, centered in block

// Building color palette (muted urban colors)
const PALETTE = [
  0xd9d9d9, // Light concrete
  0xa8a8a8, // Medium gray
  0x708090, // Slate gray
  0xb0c4de, // Light steel blue
  0x8b7d6b, // Sandstone
  0x696969  // Dim gray
];

// Create window grid texture for emissive glow
function createWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 64, 64);

  // Draw 4x4 grid of lit windows
  ctx.fillStyle = '#ffe599'; // Warm incandescent glow
  for (let y = 8; y < 64; y += 16) {
    for (let x = 8; x < 64; x += 16) {
      ctx.fillRect(x, y, 8, 8);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 8); // Repeat across building faces

  return texture;
}

// Generate pure data for determinism testing (Node-compatible)
export function generateCityData(rng, gridSize = GRID_SIZE) {
  const buildings = [];
  const offset = (gridSize * CELL_PITCH) / 2;

  for (let gridZ = 0; gridZ < gridSize; gridZ++) {
    for (let gridX = 0; gridX < gridSize; gridX++) {
      const x = gridX * CELL_PITCH - offset + CELL_PITCH / 2;
      const z = gridZ * CELL_PITCH - offset + CELL_PITCH / 2;
      const height = rng.nextFloat(10, 60);
      const colorIndex = rng.nextInt(0, PALETTE.length - 1);

      buildings.push({
        x: Math.round(x * 1000) / 1000,
        z: Math.round(z * 1000) / 1000,
        height: Math.round(height * 1000) / 1000,
        colorIndex
      });
    }
  }

  return buildings;
}

export function generateCity(rng, gridSize = GRID_SIZE) {
  const buildingData = generateCityData(rng, gridSize);
  const totalCount = buildingData.length;

  // 1. Buildings InstancedMesh
  const windowTexture = createWindowTexture();
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissiveMap: windowTexture,
    emissive: new THREE.Color(0xffe599),
    emissiveIntensity: 0
  });

  const buildingMesh = new THREE.InstancedMesh(
    buildingGeometry,
    buildingMaterial,
    totalCount
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  buildingData.forEach((b, i) => {
    position.set(b.x, b.height / 2, b.z);
    scale.set(BUILDING_FOOTPRINT, b.height, BUILDING_FOOTPRINT);
    matrix.compose(position, rotation, scale);
    buildingMesh.setMatrixAt(i, matrix);

    color.setHex(PALETTE[b.colorIndex]);
    buildingMesh.setColorAt(i, color);
  });

  buildingMesh.instanceMatrix.needsUpdate = true;
  if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;

  // 2. Ground/Plaza tiles InstancedMesh
  const groundGeometry = new THREE.BoxGeometry(BUILDING_FOOTPRINT + 4, 0.5, BUILDING_FOOTPRINT + 4);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const groundMesh = new THREE.InstancedMesh(
    groundGeometry,
    groundMaterial,
    totalCount
  );

  buildingData.forEach((b, i) => {
    position.set(b.x, -0.25, b.z);
    scale.set(1, 1, 1);
    matrix.compose(position, rotation, scale);
    groundMesh.setMatrixAt(i, matrix);
  });

  groundMesh.instanceMatrix.needsUpdate = true;

  // 3. Road grid plane
  const totalWidth = gridSize * CELL_PITCH;
  const roadGeometry = new THREE.PlaneGeometry(totalWidth, totalWidth);
  const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.y = -0.5;

  return {
    meshes: {
      buildings: buildingMesh,
      ground: groundMesh,
      roads: roadMesh
    },
    buildingMaterial,
    data: buildingData,
    dispose() {
      buildingGeometry.dispose();
      buildingMaterial.dispose();
      windowTexture.dispose();
      groundGeometry.dispose();
      groundMaterial.dispose();
      roadGeometry.dispose();
      roadMaterial.dispose();
    }
  };
}
