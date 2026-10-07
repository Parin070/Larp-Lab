import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { generateChunkNPCs, evaluateNPCPosition, NPC_SHIRT_COLORS } from './npc.js';

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

export function createNPCRenderer(worldSeed, bus, countOrChunkManager = 200, maybeCount = 200) {
  let chunkManager = null;
  let maxCount = 200;

  if (typeof countOrChunkManager === 'number') {
    maxCount = countOrChunkManager;
  } else if (countOrChunkManager && typeof countOrChunkManager.getLoadedChunks === 'function') {
    chunkManager = countOrChunkManager;
    if (typeof maybeCount === 'number') maxCount = maybeCount;
  }

  // 1. Build composite low-poly "Dude Theft Wars" character geometry
  const parts = [];

  // Torso / Hoodie (tints with instance color)
  const torso = new THREE.BoxGeometry(0.52, 0.65, 0.32);
  torso.translate(0, 0.95, 0);
  colorGeom(torso, 0xffffff); // White base so instance color tints it
  parts.push(torso);

  // Front Hoodie Pocket
  const pocket = new THREE.BoxGeometry(0.36, 0.22, 0.04);
  pocket.translate(0, 0.82, 0.17);
  colorGeom(pocket, 0xf1f5f9);
  parts.push(pocket);

  // Head (Warm cartoon skin tone)
  const head = new THREE.BoxGeometry(0.38, 0.38, 0.38);
  head.translate(0, 1.45, 0);
  colorGeom(head, 0xfcd34d);
  parts.push(head);

  // Cool Dark Sunglasses / Shades
  const glasses = new THREE.BoxGeometry(0.40, 0.12, 0.10);
  glasses.translate(0, 1.48, 0.18);
  colorGeom(glasses, 0x09090b);
  parts.push(glasses);

  // Backward Baseball Cap (Red dome + dark visor behind)
  const cap = new THREE.BoxGeometry(0.40, 0.14, 0.42);
  cap.translate(0, 1.66, -0.02);
  colorGeom(cap, 0xef4444);
  parts.push(cap);

  const capVisor = new THREE.BoxGeometry(0.36, 0.04, 0.20);
  capVisor.translate(0, 1.61, -0.30);
  colorGeom(capVisor, 0x1e293b);
  parts.push(capVisor);

  // Arms (Left & Right)
  const armL = new THREE.BoxGeometry(0.14, 0.55, 0.16);
  armL.translate(-0.35, 0.95, 0);
  colorGeom(armL, 0xffffff);
  parts.push(armL);

  const handL = new THREE.BoxGeometry(0.12, 0.12, 0.14);
  handL.translate(-0.35, 0.62, 0);
  colorGeom(handL, 0xfcd34d);
  parts.push(handL);

  const armR = new THREE.BoxGeometry(0.14, 0.55, 0.16);
  armR.translate(0.35, 0.95, 0);
  colorGeom(armR, 0xffffff);
  parts.push(armR);

  const handR = new THREE.BoxGeometry(0.12, 0.12, 0.14);
  handR.translate(0.35, 0.62, 0);
  colorGeom(handR, 0xfcd34d);
  parts.push(handR);

  // Legs & Denim Jeans
  const legL = new THREE.BoxGeometry(0.20, 0.55, 0.22);
  legL.translate(-0.15, 0.40, 0);
  colorGeom(legL, 0x1e3a8a);
  parts.push(legL);

  const legR = new THREE.BoxGeometry(0.20, 0.55, 0.22);
  legR.translate(0.15, 0.40, 0);
  colorGeom(legR, 0x1e3a8a);
  parts.push(legR);

  // Chunky Low-Poly Sneakers with White Outsoles
  const shoeL = new THREE.BoxGeometry(0.22, 0.14, 0.32);
  shoeL.translate(-0.15, 0.08, 0.04);
  colorGeom(shoeL, 0xdc2626);
  parts.push(shoeL);

  const soleL = new THREE.BoxGeometry(0.24, 0.05, 0.34);
  soleL.translate(-0.15, 0.025, 0.04);
  colorGeom(soleL, 0xffffff);
  parts.push(soleL);

  const shoeR = new THREE.BoxGeometry(0.22, 0.14, 0.32);
  shoeR.translate(0.15, 0.08, 0.04);
  colorGeom(shoeR, 0xdc2626);
  parts.push(shoeR);

  const soleR = new THREE.BoxGeometry(0.24, 0.05, 0.34);
  soleR.translate(0.15, 0.025, 0.04);
  colorGeom(soleR, 0xffffff);
  parts.push(soleR);

  const characterGeometry = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());

  const characterMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const instancedMesh = new THREE.InstancedMesh(characterGeometry, characterMaterial, maxCount);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  // Cache deterministic chunk NPCs: "cx,cz" -> NPC[]
  const chunkCache = new Map();
  // Array of active evaluated NPCs for queries/interactions
  let currentActiveNPCs = [];

  function getNPCsForChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (!chunkCache.has(key)) {
      chunkCache.set(key, generateChunkNPCs(worldSeed, cx, cz, 8));
    }
    return chunkCache.get(key);
  }

  return {
    mesh: instancedMesh,
    update(simTime, loadedChunksOrPlayerPos = null, maybePlayerPos = null) {
      let activeChunks = [];

      // Determine active chunks to pull NPCs from
      if (loadedChunksOrPlayerPos instanceof Map) {
        activeChunks = Array.from(loadedChunksOrPlayerPos.values());
      } else if (chunkManager && typeof chunkManager.getLoadedChunks === 'function') {
        activeChunks = Array.from(chunkManager.getLoadedChunks().values());
      } else if (loadedChunksOrPlayerPos && typeof loadedChunksOrPlayerPos.x === 'number') {
        // Player position passed
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
        // Default 3x3 surrounding origin
        for (let cz = -1; cz <= 1; cz++) {
          for (let cx = -1; cx <= 1; cx++) {
            activeChunks.push({ cx, cz });
          }
        }
      }

      // Collect all candidate NPCs
      const candidates = [];
      for (let i = 0; i < activeChunks.length; i++) {
        const c = activeChunks[i];
        const npcs = getNPCsForChunk(c.cx, c.cz);
        for (let j = 0; j < npcs.length; j++) {
          candidates.push(npcs[j]);
        }
      }

      // Evaluate and assign matrices to instanced mesh
      const renderCount = Math.min(candidates.length, maxCount);
      currentActiveNPCs = [];

      for (let i = 0; i < renderCount; i++) {
        const npc = candidates[i];
        const evalPos = evaluateNPCPosition(npc, simTime);

        position.set(evalPos.x, evalPos.y, evalPos.z);
        rotation.set(0, evalPos.heading, evalPos.roll);
        quaternion.setFromEuler(rotation);
        scale.set(1, 1, 1);

        matrix.compose(position, quaternion, scale);
        instancedMesh.setMatrixAt(i, matrix);

        color.setHex(npc.colorHex);
        instancedMesh.setColorAt(i, color);

        currentActiveNPCs.push({
          id: npc.id,
          name: npc.name,
          activity: npc.activity,
          x: evalPos.x,
          y: evalPos.y,
          z: evalPos.z
        });
      }

      // Hide excess instances underground
      for (let i = renderCount; i < maxCount; i++) {
        position.set(0, -100, 0);
        scale.set(0, 0, 0);
        matrix.compose(position, quaternion, scale);
        instancedMesh.setMatrixAt(i, matrix);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
      }
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
      if (instancedMesh.parent) instancedMesh.parent.remove(instancedMesh);
      characterGeometry.dispose();
      characterMaterial.dispose();
      instancedMesh.dispose();
      chunkCache.clear();
      currentActiveNPCs = [];
    }
  };
}
