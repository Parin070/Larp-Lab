import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { createRNG } from '../core/rng.js';
import { createNPCSchedule, evaluateNPCPosition } from './npc.js';

export const NPC_SHIRT_COLORS = [
  0xff007f, // Neon Pink
  0x00f5d4, // Tropical Cyan
  0x70e000, // Electric Lime
  0xfee440, // Sunshine Yellow
  0xff0054, // Sports Crimson
  0x3a86ff, // Royal Blue
  0xfb5607, // Sunset Orange
  0x8338ec, // Purple Violet
  0xf8fafc, // Crisp White
  0x18181b  // Dark Streetwear
];

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

export function createNPCRenderer(worldSeed, bus, count = 100) {
  const rng = createRNG(worldSeed + 99999);

  // 1. Build composite low-poly "Dude Theft Wars" character geometry
  const parts = [];

  // Torso / Shirt (tints with instance color)
  const torso = new THREE.BoxGeometry(0.52, 0.65, 0.32);
  torso.translate(0, 0.95, 0);
  colorGeom(torso, 0xffffff); // White base so instance color tints it
  parts.push(torso);

  // Head (Skin tone)
  const head = new THREE.BoxGeometry(0.38, 0.38, 0.38);
  head.translate(0, 1.45, 0);
  colorGeom(head, 0xfcd34d); // Stylized warm cartoon skin tone
  parts.push(head);

  // Cool Dark Sunglasses / Shades
  const glasses = new THREE.BoxGeometry(0.40, 0.12, 0.10);
  glasses.translate(0, 1.48, 0.18);
  colorGeom(glasses, 0x09090b); // Deep black shades
  parts.push(glasses);

  // Backward Baseball Cap (Red/Blue sporty cap)
  const cap = new THREE.BoxGeometry(0.40, 0.14, 0.42);
  cap.translate(0, 1.66, -0.02);
  colorGeom(cap, 0xef4444); // Red cap
  parts.push(cap);

  const capVisor = new THREE.BoxGeometry(0.36, 0.04, 0.20);
  capVisor.translate(0, 1.61, -0.30); // Backward visor
  colorGeom(capVisor, 0x1e293b);
  parts.push(capVisor);

  // Arms (Left & Right)
  const armL = new THREE.BoxGeometry(0.14, 0.55, 0.16);
  armL.translate(-0.35, 0.95, 0);
  colorGeom(armL, 0xffffff); // Tints with shirt color
  parts.push(armL);

  const handL = new THREE.BoxGeometry(0.12, 0.12, 0.14);
  handL.translate(-0.35, 0.62, 0);
  colorGeom(handL, 0xfcd34d); // Skin tone hands
  parts.push(handL);

  const armR = new THREE.BoxGeometry(0.14, 0.55, 0.16);
  armR.translate(0.35, 0.95, 0);
  colorGeom(armR, 0xffffff); // Tints with shirt color
  parts.push(armR);

  const handR = new THREE.BoxGeometry(0.12, 0.12, 0.14);
  handR.translate(0.35, 0.62, 0);
  colorGeom(handR, 0xfcd34d); // Skin tone hands
  parts.push(handR);

  // Legs & Denim Jeans (Dark Indigo)
  const legL = new THREE.BoxGeometry(0.20, 0.55, 0.22);
  legL.translate(-0.15, 0.40, 0);
  colorGeom(legL, 0x1e3a8a); // Denim blue
  parts.push(legL);

  const legR = new THREE.BoxGeometry(0.20, 0.55, 0.22);
  legR.translate(0.15, 0.40, 0);
  colorGeom(legR, 0x1e3a8a); // Denim blue
  parts.push(legR);

  // Chunky Low-Poly Sneakers with White Outsoles
  const shoeL = new THREE.BoxGeometry(0.22, 0.14, 0.32);
  shoeL.translate(-0.15, 0.08, 0.04);
  colorGeom(shoeL, 0xdc2626); // Red sneaker uppers
  parts.push(shoeL);

  const soleL = new THREE.BoxGeometry(0.24, 0.05, 0.34);
  soleL.translate(-0.15, 0.025, 0.04);
  colorGeom(soleL, 0xffffff); // Crisp white sole
  parts.push(soleL);

  const shoeR = new THREE.BoxGeometry(0.22, 0.14, 0.32);
  shoeR.translate(0.15, 0.08, 0.04);
  colorGeom(shoeR, 0xdc2626); // Red sneaker uppers
  parts.push(shoeR);

  const soleR = new THREE.BoxGeometry(0.24, 0.05, 0.34);
  soleR.translate(0.15, 0.025, 0.04);
  colorGeom(soleR, 0xffffff); // Crisp white sole
  parts.push(soleR);

  const characterGeometry = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());

  const characterMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const instancedMesh = new THREE.InstancedMesh(characterGeometry, characterMaterial, count);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  // 2. Initialize NPC records
  const npcs = [];
  for (let i = 0; i < count; i++) {
    const npcSeed = rng.nextInt(1000, 999999);
    const schedule = createNPCSchedule(npcSeed, worldSeed);
    const colorHex = rng.choice(NPC_SHIRT_COLORS);
    color.setHex(colorHex);
    instancedMesh.setColorAt(i, color);

    npcs.push({
      schedule,
      lastState: null
    });
  }

  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
  instancedMesh.instanceMatrix.needsUpdate = true;

  return {
    mesh: instancedMesh,
    update(simTime) {
      npcs.forEach((npc, i) => {
        const evalPos = evaluateNPCPosition(npc.schedule, simTime);

        // Emit state change event if transitioning between schedule blocks
        if (npc.lastState !== evalPos.state) {
          if (bus && npc.lastState !== null) {
            bus.emit('npc_state_changed', {
              actorId: npc.schedule.id,
              data: {
                from: npc.lastState,
                to: evalPos.state,
                x: evalPos.x,
                z: evalPos.z
              }
            });
          }
          npc.lastState = evalPos.state;
        }

        if (evalPos.isOutdoor) {
          position.set(evalPos.x, 0, evalPos.z);
          scale.set(1, 1, 1);
        } else {
          // Hide indoors
          position.set(0, -100, 0);
          scale.set(0, 0, 0);
        }

        matrix.compose(position, rotation, scale);
        instancedMesh.setMatrixAt(i, matrix);
      });

      instancedMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      if (instancedMesh.parent) instancedMesh.parent.remove(instancedMesh);
      characterGeometry.dispose();
      characterMaterial.dispose();
      instancedMesh.dispose();
    }
  };
}
