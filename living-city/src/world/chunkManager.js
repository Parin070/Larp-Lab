import * as THREE from 'three';
import { CHUNK_SIZE, HALF_CHUNK, generateChunkData, createChunkMeshes } from './chunk.js';
import { createBuildingMaterial } from './city.js';

export function createChunkManager(worldSeed, scene, bus, loadRadius = 2) {
  const loadedChunks = new Map(); // key: "cx,cz" -> chunkObject
  const pendingLoads = new Set(); // key: "cx,cz"
  const actionQueue = [];         // Array of { type: 'load'|'unload', cx, cz, key }

  // Shared GPU resources reused across all chunks
  const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sharedBuildingMaterial = createBuildingMaterial();
  const sharedStaticMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true
  });

  let lastPlayerChunkX = null;
  let lastPlayerChunkZ = null;

  function getChunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  function planChunkUpdates(centerCx, centerCz) {
    const requiredKeys = new Set();

    // 1. Determine desired chunks in (2 * radius + 1)^2 area
    for (let dz = -loadRadius; dz <= loadRadius; dz++) {
      for (let dx = -loadRadius; dx <= loadRadius; dx++) {
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        const key = getChunkKey(cx, cz);
        requiredKeys.add(key);

        if (!loadedChunks.has(key) && !pendingLoads.has(key)) {
          pendingLoads.add(key);
          actionQueue.push({ type: 'load', cx, cz, key });
        }
      }
    }

    // 2. Identify chunks to unload (outside radius + 1 buffer)
    const unloadThreshold = loadRadius + 1;
    for (const [key, chunk] of loadedChunks.entries()) {
      const dist = Math.max(Math.abs(chunk.cx - centerCx), Math.abs(chunk.cz - centerCz));
      if (dist > unloadThreshold) {
        if (!actionQueue.some((a) => a.key === key && a.type === 'unload')) {
          actionQueue.push({ type: 'unload', cx: chunk.cx, cz: chunk.cz, key });
        }
      }
    }

    // Sort load actions by distance to center so closest chunks build first
    actionQueue.sort((a, b) => {
      if (a.type === 'unload' && b.type !== 'unload') return -1;
      if (b.type === 'unload' && a.type !== 'unload') return 1;
      const distA = Math.hypot(a.cx - centerCx, a.cz - centerCz);
      const distB = Math.hypot(b.cx - centerCx, b.cz - centerCz);
      return distA - distB;
    });
  }

  function processQueue() {
    if (actionQueue.length === 0) return;

    // Process at most 1 chunk action per frame to maintain steady 60 FPS
    const action = actionQueue.shift();

    if (action.type === 'load') {
      pendingLoads.delete(action.key);
      if (loadedChunks.has(action.key)) return;

      const data = generateChunkData(worldSeed, action.cx, action.cz);
      const chunk = createChunkMeshes(
        data,
        action.cx,
        action.cz,
        sharedBuildingMaterial,
        sharedStaticMaterial,
        sharedBoxGeometry
      );

      scene.add(chunk.buildingMesh);
      scene.add(chunk.staticMesh);
      loadedChunks.set(action.key, chunk);

      if (bus) {
        bus.emit('chunk_loaded', {
          locationId: action.key,
          data: { cx: action.cx, cz: action.cz, buildings: data.length }
        });
      }
    } else if (action.type === 'unload') {
      const chunk = loadedChunks.get(action.key);
      if (!chunk) return;

      chunk.dispose();
      loadedChunks.delete(action.key);

      if (bus) {
        bus.emit('chunk_unloaded', {
          locationId: action.key,
          data: { cx: action.cx, cz: action.cz }
        });
      }
    }
  }

  // Initial synchronous build of local chunks around spawn
  function init(initialCx = 0, initialCz = 0) {
    planChunkUpdates(initialCx, initialCz);
    // Pre-populate immediate 3x3 so player never spawns in a void
    while (loadedChunks.size < 9 && actionQueue.length > 0) {
      processQueue();
    }
  }

  return {
    getLoadedChunkCount() {
      return loadedChunks.size;
    },
    getLoadedChunks() {
      return loadedChunks;
    },
    getBuildingMaterial() {
      return sharedBuildingMaterial;
    },
    init,
    update(cameraPos) {
      const cx = Math.floor((cameraPos.x + HALF_CHUNK) / CHUNK_SIZE);
      const cz = Math.floor((cameraPos.z + HALF_CHUNK) / CHUNK_SIZE);

      if (cx !== lastPlayerChunkX || cz !== lastPlayerChunkZ) {
        lastPlayerChunkX = cx;
        lastPlayerChunkZ = cz;
        planChunkUpdates(cx, cz);
      }

      processQueue();
    },
    getChunk(cx, cz) {
      return loadedChunks.get(getChunkKey(cx, cz));
    },
    dispose() {
      actionQueue.length = 0;
      pendingLoads.clear();
      for (const chunk of loadedChunks.values()) {
        chunk.dispose();
      }
      loadedChunks.clear();
      sharedBoxGeometry.dispose();
      sharedBuildingMaterial.dispose();
      sharedStaticMaterial.dispose();
    }
  };
}
