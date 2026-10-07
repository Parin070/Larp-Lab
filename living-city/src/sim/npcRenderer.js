import * as THREE from 'three';
import { generateChunkNPCs, evaluateNPCPosition } from './npc.js';
import {
  createHeadGeometry,
  createTorsoGeometry,
  createArmGeometry,
  createLegGeometry
} from './npcModel.js';

export function createNPCRenderer(worldSeed, bus, countOrChunkManager = 400, maybeCount = 400) {
  let chunkManager = null;
  let maxCount = 400;

  if (typeof countOrChunkManager === 'number') {
    maxCount = countOrChunkManager;
  } else if (countOrChunkManager && typeof countOrChunkManager.getLoadedChunks === 'function') {
    chunkManager = countOrChunkManager;
    if (typeof maybeCount === 'number') maxCount = maybeCount;
  }

  // 1. Create 6 Articulated Low-Poly Part Geometries
  const headGeom = createHeadGeometry();
  const torsoGeom = createTorsoGeometry();
  const armLGeom = createArmGeometry(true);
  const armRGeom = createArmGeometry(false);
  const legLGeom = createLegGeometry(true);
  const legRGeom = createLegGeometry(false);

  // Shared vertex-color material (supports instanceColor for shirts/hoodies)
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });

  const headMesh = new THREE.InstancedMesh(headGeom, material, maxCount);
  const torsoMesh = new THREE.InstancedMesh(torsoGeom, material, maxCount);
  const armLMesh = new THREE.InstancedMesh(armLGeom, material, maxCount);
  const armRMesh = new THREE.InstancedMesh(armRGeom, material, maxCount);
  const legLMesh = new THREE.InstancedMesh(legLGeom, material, maxCount);
  const legRMesh = new THREE.InstancedMesh(legRGeom, material, maxCount);

  const group = new THREE.Group();
  group.add(headMesh);
  group.add(torsoMesh);
  group.add(armLMesh);
  group.add(armRMesh);
  group.add(legLMesh);
  group.add(legRMesh);

  // Pre-allocated matrix math objects (zero GC overhead in 60 FPS loop)
  const rootPos = new THREE.Vector3();
  const rootEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const rootQuat = new THREE.Quaternion();

  const partPos = new THREE.Vector3();
  const partEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const partQuat = new THREE.Quaternion();
  const partMatrix = new THREE.Matrix4();
  const scaleOne = new THREE.Vector3(1, 1, 1);
  const scaleZero = new THREE.Vector3(0, 0, 0);

  const localOffset = new THREE.Vector3();
  const color = new THREE.Color();
  const whiteColor = new THREE.Color(0xffffff);

  // Cache deterministic chunk NPCs: "cx,cz" -> NPC[]
  const chunkCache = new Map();
  let currentActiveNPCs = [];

  function getNPCsForChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (!chunkCache.has(key)) {
      chunkCache.set(key, generateChunkNPCs(worldSeed, cx, cz, 24));
    }
    return chunkCache.get(key);
  }

  function setPartTransform(mesh, index, parentPos, parentQuat, offsetX, offsetY, offsetZ, rotX = 0, rotY = 0, rotZ = 0) {
    localOffset.set(offsetX, offsetY, offsetZ);
    localOffset.applyQuaternion(parentQuat);
    partPos.copy(parentPos).add(localOffset);

    partEuler.set(rotX, rotY, rotZ, 'YXZ');
    partQuat.setFromEuler(partEuler);
    partQuat.premultiply(parentQuat);

    partMatrix.compose(partPos, partQuat, scaleOne);
    mesh.setMatrixAt(index, partMatrix);
  }

  function hideInstance(mesh, index) {
    partPos.set(0, -100, 0);
    partMatrix.compose(partPos, rootQuat, scaleZero);
    mesh.setMatrixAt(index, partMatrix);
  }

  return {
    mesh: group,
    group,
    update(animTimeOrSimTime, loadedChunksOrPlayerPos = null, maybePlayerPos = null) {
      const animTime = typeof animTimeOrSimTime === 'number' ? animTimeOrSimTime : 0;
      let activeChunks = [];
      let playerPos = null;

      if (maybePlayerPos && typeof maybePlayerPos.x === 'number') {
        playerPos = maybePlayerPos;
      }

      // Determine active chunks to pull NPCs from
      if (loadedChunksOrPlayerPos instanceof Map) {
        activeChunks = Array.from(loadedChunksOrPlayerPos.values());
      } else if (chunkManager && typeof chunkManager.getLoadedChunks === 'function') {
        activeChunks = Array.from(chunkManager.getLoadedChunks().values());
      } else if (loadedChunksOrPlayerPos && typeof loadedChunksOrPlayerPos.x === 'number') {
        playerPos = loadedChunksOrPlayerPos;
        const px = loadedChunksOrPlayerPos.x;
        const pz = loadedChunksOrPlayerPos.z;
        const centerCx = Math.floor((px + 288) / 576);
        const centerCz = Math.floor((pz + 288) / 576);
        for (let dz = -2; dz <= 2; dz++) {
          for (let dx = -2; dx <= 2; dx++) {
            activeChunks.push({ cx: centerCx + dx, cz: centerCz + dz });
          }
        }
      } else {
        for (let cz = -1; cz <= 1; cz++) {
          for (let cx = -1; cx <= 1; cx++) {
            activeChunks.push({ cx, cz });
          }
        }
      }

      // Collect candidate NPCs
      const candidates = [];
      for (let i = 0; i < activeChunks.length; i++) {
        const c = activeChunks[i];
        const npcs = getNPCsForChunk(c.cx, c.cz);
        for (let j = 0; j < npcs.length; j++) {
          candidates.push(npcs[j]);
        }
      }

      // Prioritize closest NPCs to player
      if (playerPos) {
        candidates.sort((a, b) => {
          const da = (a.cellCenterX - playerPos.x) ** 2 + (a.cellCenterZ - playerPos.z) ** 2;
          const db = (b.cellCenterX - playerPos.x) ** 2 + (b.cellCenterZ - playerPos.z) ** 2;
          return da - db;
        });
      }

      const renderCount = Math.min(candidates.length, maxCount);
      currentActiveNPCs = [];

      for (let i = 0; i < renderCount; i++) {
        const npc = candidates[i];
        const evalPos = evaluateNPCPosition(npc, animTime);

        rootPos.set(evalPos.x, evalPos.y, evalPos.z);
        rootEuler.set(0, evalPos.heading, evalPos.roll);
        rootQuat.setFromEuler(rootEuler);

        // 1. Torso (Pivot at waist/center)
        setPartTransform(torsoMesh, i, rootPos, rootQuat, 0, 0.95, 0, 0, 0, 0);

        // 2. Head (Pivot at neck base)
        setPartTransform(headMesh, i, rootPos, rootQuat, 0, 1.45, 0, evalPos.headPitch, evalPos.headYaw, 0);

        // 3. Left Arm (Pivot at left shoulder)
        setPartTransform(armLMesh, i, rootPos, rootQuat, -0.30, 1.22, 0, evalPos.armAngleL, 0, 0.05);

        // 4. Right Arm (Pivot at right shoulder)
        setPartTransform(armRMesh, i, rootPos, rootQuat, 0.30, 1.22, 0, evalPos.armAngleR, 0, -0.05);

        // 5. Left Leg (Pivot at left hip)
        setPartTransform(legLMesh, i, rootPos, rootQuat, -0.13, 0.68, 0, evalPos.legAngleL, 0, 0);

        // 6. Right Leg (Pivot at right hip)
        setPartTransform(legRMesh, i, rootPos, rootQuat, 0.13, 0.68, 0, evalPos.legAngleR, 0, 0);

        // Tint shirt/hoodie and arm sleeves with instance color
        color.setHex(npc.colorHex);
        torsoMesh.setColorAt(i, color);
        armLMesh.setColorAt(i, color);
        armRMesh.setColorAt(i, color);

        // Neutral instance color for head and legs (vertex colors will show)
        headMesh.setColorAt(i, whiteColor);
        legLMesh.setColorAt(i, whiteColor);
        legRMesh.setColorAt(i, whiteColor);

        currentActiveNPCs.push({
          id: npc.id,
          name: npc.name,
          activity: npc.activity,
          x: evalPos.x,
          y: evalPos.y,
          z: evalPos.z
        });
      }

      // Hide excess instances
      for (let i = renderCount; i < maxCount; i++) {
        hideInstance(headMesh, i);
        hideInstance(torsoMesh, i);
        hideInstance(armLMesh, i);
        hideInstance(armRMesh, i);
        hideInstance(legLMesh, i);
        hideInstance(legRMesh, i);
      }

      // Flag instance matrices and colors for GPU upload
      headMesh.instanceMatrix.needsUpdate = true;
      torsoMesh.instanceMatrix.needsUpdate = true;
      armLMesh.instanceMatrix.needsUpdate = true;
      armRMesh.instanceMatrix.needsUpdate = true;
      legLMesh.instanceMatrix.needsUpdate = true;
      legRMesh.instanceMatrix.needsUpdate = true;

      if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;
      if (torsoMesh.instanceColor) torsoMesh.instanceColor.needsUpdate = true;
      if (armLMesh.instanceColor) armLMesh.instanceColor.needsUpdate = true;
      if (armRMesh.instanceColor) armRMesh.instanceColor.needsUpdate = true;
      if (legLMesh.instanceColor) legLMesh.instanceColor.needsUpdate = true;
      if (legRMesh.instanceColor) legRMesh.instanceColor.needsUpdate = true;
    },
    getNearbyNPC(playerPos, maxDist = 2.8) {
      if (!playerPos || currentActiveNPCs.length === 0) return null;
      let closest = null;
      let minDistSq = maxDist * maxDist;

      for (let i = 0; i < currentActiveNPCs.length; i++) {
        const npc = currentActiveNPCs[i];
        const dx = playerPos.x - npc.x;
        const dz = playerPos.z - npc.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          closest = {
            ...npc,
            dist: Math.sqrt(dSq)
          };
        }
      }
      return closest;
    },
    dispose() {
      if (group.parent) group.parent.remove(group);
      headGeom.dispose();
      torsoGeom.dispose();
      armLGeom.dispose();
      armRGeom.dispose();
      legLGeom.dispose();
      legRGeom.dispose();
      material.dispose();
      headMesh.dispose();
      torsoMesh.dispose();
      armLMesh.dispose();
      armRMesh.dispose();
      legLMesh.dispose();
      legRMesh.dispose();
      chunkCache.clear();
      currentActiveNPCs = [];
    }
  };
}
