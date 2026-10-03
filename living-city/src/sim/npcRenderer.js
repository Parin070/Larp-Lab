import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { createRNG } from '../core/rng.js';
import { createNPCSchedule, evaluateNPCPosition } from './npc.js';

const NPC_COLORS = [
  0x34495e, 0x2c3e50, 0x7f8c8d, 0x16a085,
  0x27ae60, 0x2980b9, 0x8e44ad, 0xd35400
];

export function createNPCRenderer(worldSeed, bus, count = 100) {
  const rng = createRNG(worldSeed + 99999);

  // 1. Build composite low-poly character geometry (body + head)
  const bodyGeom = new THREE.BoxGeometry(0.5, 1.1, 0.3);
  bodyGeom.translate(0, 0.55, 0);

  const headGeom = new THREE.BoxGeometry(0.3, 0.35, 0.3);
  headGeom.translate(0, 1.25, 0);

  const characterGeometry = BufferGeometryUtils.mergeGeometries([bodyGeom, headGeom], false);
  bodyGeom.dispose();
  headGeom.dispose();

  const characterMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
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
    const colorHex = rng.choice(NPC_COLORS);
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
