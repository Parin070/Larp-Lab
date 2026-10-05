import * as THREE from 'three';

// City grid constants
export const GRID_SIZE = 20;         // 20x20 blocks
export const BLOCK_SIZE = 64;        // 64m chunk/block size
export const ROAD_WIDTH = 8;         // 8m road width
export const CELL_PITCH = BLOCK_SIZE + ROAD_WIDTH; // 72m
export const BUILDING_FOOTPRINT = 50; // 50m building size, centered in block

// Building color palette (Dude Theft Wars vibrant urban sandbox colors)
export const PALETTE = [
  0xfb8500, // Vibrant Orange
  0x219ebc, // Sky Blue
  0x06d6a0, // Mint Green
  0xef476f, // Coral Pink
  0xf8f9fa, // Crisp White
  0xd90429, // Cherry Red
  0x8338ec, // Vivid Purple
  0x2ec4b6, // Aqua Teal
  0xffbe0b, // Golden Yellow
  0x3a86ff, // Electric Blue
  0xe07a5f, // Terracotta
  0xffbe76  // Pastel Peach
];

// Create window grid texture for emissive glow
export function createWindowTexture() {
  if (typeof document === 'undefined') {
    return new THREE.Texture();
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#10172a'; // Deep slate frame
    ctx.fillRect(0, 0, 64, 64);
    // Draw crisp window panes with frame divider
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8, 8, 20, 20);
    ctx.fillRect(36, 8, 20, 20);
    ctx.fillRect(8, 36, 20, 20);
    ctx.fillRect(36, 36, 20, 20);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return texture;
}

// Single shared patched material for all buildings (1 draw call per mesh, 0 extra calls)
export function createBuildingMaterial(windowTexture = createWindowTexture()) {
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xffe599),
    emissiveIntensity: 1.0
  });

  material.userData.nightIntensity = { value: 0.0 };
  material.userData.windowTexture = { value: windowTexture };

  material.customProgramCacheKey = () => 'building_windows_shader_v1';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNightIntensity = material.userData.nightIntensity;
    shader.uniforms.uWindowTexture = material.userData.windowTexture;

    shader.vertexShader = `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${shader.vertexShader}
    `.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      #ifdef USE_INSTANCING
        vec4 customWPos = modelMatrix * (instanceMatrix * vec4(position, 1.0));
        mat3 instMat = mat3(instanceMatrix);
        vec3 scales = vec3(length(instMat[0]), length(instMat[1]), length(instMat[2]));
        vec3 instNormal = normal / max(scales, vec3(0.0001));
        vec3 customWNorm = normalize(mat3(modelMatrix) * (instMat * instNormal));
      #else
        vec4 customWPos = modelMatrix * vec4(position, 1.0);
        vec3 customWNorm = normalize(mat3(modelMatrix) * normal);
      #endif
      vWorldPosition = customWPos.xyz;
      vWorldNormal = customWNorm;
      `
    );

    shader.fragmentShader = `
      uniform float uNightIntensity;
      uniform sampler2D uWindowTexture;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${shader.fragmentShader}
    `.replace(
      '#include <emissivemap_fragment>',
      `
      #include <emissivemap_fragment>
      // Only apply window emissive to side walls (abs(normal.y) <= 0.5)
      float isWall = step(abs(vWorldNormal.y), 0.5);
      float wallCoord = abs(vWorldNormal.x) > 0.5 ? vWorldPosition.z : vWorldPosition.x;
      vec2 winUV = vec2(wallCoord / 4.0, vWorldPosition.y / 4.0);
      vec4 winColor = texture2D(uWindowTexture, winUV);
      totalEmissiveRadiance = emissive * winColor.rgb * isWall * uNightIntensity;
      `
    );
  };

  return material;
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

export function generateCity(rng, gridSize = GRID_SIZE, sharedBuildingMaterial = null) {
  const buildingData = generateCityData(rng, gridSize);
  const totalCount = buildingData.length;

  // 1. Buildings InstancedMesh
  const windowTexture = sharedBuildingMaterial ? sharedBuildingMaterial.userData.windowTexture.value : createWindowTexture();
  const buildingMaterial = sharedBuildingMaterial || createBuildingMaterial(windowTexture);
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);

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
      if (!sharedBuildingMaterial) {
        buildingMaterial.dispose();
        windowTexture.dispose();
      }
      groundGeometry.dispose();
      groundMaterial.dispose();
      roadGeometry.dispose();
      roadMaterial.dispose();
    }
  };
}
