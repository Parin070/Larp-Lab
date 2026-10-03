import { CHUNK_SIZE, HALF_CHUNK, CELL_PITCH, generateChunkData } from '../world/chunk.js';
import { BUILDING_FOOTPRINT } from '../world/city.js';

// Cache recent chunk data for collision queries to avoid repeated allocations
const chunkDataCache = new Map();
const MAX_CACHE_SIZE = 50;

function getCachedChunkData(worldSeed, cx, cz) {
  const key = `${worldSeed}_${cx}_${cz}`;
  if (chunkDataCache.has(key)) {
    return chunkDataCache.get(key);
  }
  const data = generateChunkData(worldSeed, cx, cz);
  if (chunkDataCache.size >= MAX_CACHE_SIZE) {
    const firstKey = chunkDataCache.keys().next().value;
    chunkDataCache.delete(firstKey);
  }
  chunkDataCache.set(key, data);
  return data;
}

// Get the 3x3 neighboring building AABBs around a world position
export function getNearbyBuildingAABBs(worldSeed, x, z) {
  const aabbs = [];
  const halfFootprint = BUILDING_FOOTPRINT / 2;

  // Grid cell index: building is centered at gx * 72 + 36
  const centerGx = Math.floor(x / CELL_PITCH);
  const centerGz = Math.floor(z / CELL_PITCH);

  // Check 3x3 surrounding cells (max 9 buildings)
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const gx = centerGx + dx;
      const gz = centerGz + dz;

      const buildingCenterX = gx * CELL_PITCH + CELL_PITCH / 2;
      const buildingCenterZ = gz * CELL_PITCH + CELL_PITCH / 2;

      const cx = Math.floor((buildingCenterX + HALF_CHUNK) / CHUNK_SIZE);
      const cz = Math.floor((buildingCenterZ + HALF_CHUNK) / CHUNK_SIZE);

      const chunkData = getCachedChunkData(worldSeed, cx, cz);

      // Find building matching (buildingCenterX, buildingCenterZ)
      for (let i = 0; i < chunkData.length; i++) {
        const b = chunkData[i];
        if (Math.abs(b.x - buildingCenterX) < 1 && Math.abs(b.z - buildingCenterZ) < 1) {
          aabbs.push({
            id: b.id,
            x: b.x,
            z: b.z,
            height: b.height,
            minX: b.x - halfFootprint,
            maxX: b.x + halfFootprint,
            minY: 0,
            maxY: b.height,
            minZ: b.z - halfFootprint,
            maxZ: b.z + halfFootprint
          });
          break;
        }
      }
    }
  }

  return aabbs;
}

// Axis-separated sliding AABB collision resolver
export function resolveCollision(worldSeed, currentPos, desiredMove, radius = 0.4, height = 1.7) {
  const aabbs = getNearbyBuildingAABBs(worldSeed, currentPos.x, currentPos.z);
  let newX = currentPos.x + desiredMove.x;
  let newZ = currentPos.z + desiredMove.z;

  // 1. Resolve X axis
  for (let i = 0; i < aabbs.length; i++) {
    const box = aabbs[i];
    if (currentPos.y < box.maxY && currentPos.y + height > box.minY) {
      if (currentPos.z + radius > box.minZ && currentPos.z - radius < box.maxZ) {
        // Moving +X into box
        if (desiredMove.x > 0 && newX + radius > box.minX && currentPos.x + radius <= box.minX + 0.5) {
          newX = box.minX - radius;
        }
        // Moving -X into box
        else if (desiredMove.x < 0 && newX - radius < box.maxX && currentPos.x - radius >= box.maxX - 0.5) {
          newX = box.maxX + radius;
        }
        // Already intersecting / penetrating
        else if (newX + radius > box.minX && newX - radius < box.maxX) {
          if (Math.abs(newX - box.minX) < Math.abs(newX - box.maxX)) {
            newX = box.minX - radius;
          } else {
            newX = box.maxX + radius;
          }
        }
      }
    }
  }

  // 2. Resolve Z axis
  for (let i = 0; i < aabbs.length; i++) {
    const box = aabbs[i];
    if (currentPos.y < box.maxY && currentPos.y + height > box.minY) {
      if (newX + radius > box.minX && newX - radius < box.maxX) {
        // Moving +Z into box
        if (desiredMove.z > 0 && newZ + radius > box.minZ && currentPos.z + radius <= box.minZ + 0.5) {
          newZ = box.minZ - radius;
        }
        // Moving -Z into box
        else if (desiredMove.z < 0 && newZ - radius < box.maxZ && currentPos.z - radius >= box.maxZ - 0.5) {
          newZ = box.maxZ + radius;
        }
        // Already intersecting / penetrating
        else if (newZ + radius > box.minZ && newZ - radius < box.maxZ) {
          if (Math.abs(newZ - box.minZ) < Math.abs(newZ - box.maxZ)) {
            newZ = box.minZ - radius;
          } else {
            newZ = box.maxZ + radius;
          }
        }
      }
    }
  }

  return {
    x: newX,
    z: newZ
  };
}
