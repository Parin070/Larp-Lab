import * as THREE from 'three';
import { generateInterior } from './interiorGenerator.js';

export function createInteriorScene(building) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a24);

  // Interior lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const ceilingLight = new THREE.PointLight(0xfffaed, 1.2, 35);
  ceilingLight.position.set(0, 3.0, 0);
  scene.add(ceilingLight);

  const interior = generateInterior(building.seed);
  interior.meshes.forEach((m) => scene.add(m));

  return {
    scene,
    building,
    spawnPos: interior.spawnPos,
    exitDoor: interior.exitDoor,
    wallAABBs: interior.wallAABBs,
    isNearExit(playerPos, distance = 2.5) {
      const dx = playerPos.x - interior.exitDoor.x;
      const dz = playerPos.z - interior.exitDoor.z;
      return Math.hypot(dx, dz) <= distance;
    },
    resolveCollision(currentPos, desiredMove, radius = 0.4) {
      let newX = currentPos.x + desiredMove.x;
      let newZ = currentPos.z + desiredMove.z;

      for (let i = 0; i < interior.wallAABBs.length; i++) {
        const box = interior.wallAABBs[i];

        // X axis collision
        if (currentPos.z + radius > box.minZ && currentPos.z - radius < box.maxZ) {
          if (desiredMove.x > 0 && newX + radius > box.minX && currentPos.x + radius <= box.minX + 0.3) {
            newX = box.minX - radius;
          } else if (desiredMove.x < 0 && newX - radius < box.maxX && currentPos.x - radius >= box.maxX - 0.3) {
            newX = box.maxX + radius;
          }
        }

        // Z axis collision
        if (newX + radius > box.minX && newX - radius < box.maxX) {
          if (desiredMove.z > 0 && newZ + radius > box.minZ && currentPos.z + radius <= box.minZ + 0.3) {
            newZ = box.minZ - radius;
          } else if (desiredMove.z < 0 && newZ - radius < box.maxZ && currentPos.z - radius >= box.maxZ - 0.3) {
            newZ = box.maxZ + radius;
          }
        }
      }

      return { x: newX, z: newZ };
    },
    dispose() {
      interior.meshes.forEach((m) => {
        scene.remove(m);
      });
      interior.dispose();
      ambientLight.dispose();
      ceilingLight.dispose();
    }
  };
}
