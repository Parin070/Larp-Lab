import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { createRNG } from '../core/rng.js';
import { CELL_PITCH } from '../world/city.js';
import { getLanePosition, getNextIntersection } from '../world/roadGraph.js';

const CAR_COLORS = [
  0xd32f2f, // Red
  0x1976d2, // Blue
  0xfbc02d, // Yellow
  0x388e3c, // Green
  0x757575, // Silver
  0x212121, // Black
  0xffffff  // White
];

export function createTrafficSystem(worldSeed, maxCars = 64) {
  const rng = createRNG(worldSeed + 54321);

  // 1. Build composite low-poly car geometry (chassis + cabin)
  const chassisGeom = new THREE.BoxGeometry(1.8, 0.6, 4.0);
  chassisGeom.translate(0, 0.3, 0);

  const cabinGeom = new THREE.BoxGeometry(1.6, 0.6, 2.2);
  cabinGeom.translate(0, 0.9, -0.2);

  const carGeometry = BufferGeometryUtils.mergeGeometries([chassisGeom, cabinGeom], false);
  chassisGeom.dispose();
  cabinGeom.dispose();

  const carMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const instancedMesh = new THREE.InstancedMesh(carGeometry, carMaterial, maxCars);

  // Pre-allocate transformation objects
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const color = new THREE.Color();

  // 2. Initialize vehicles on grid
  const cars = [];
  for (let i = 0; i < maxCars; i++) {
    const gx = rng.nextInt(-10, 10);
    const gz = rng.nextInt(-10, 10);
    const dir = rng.nextInt(0, 3);
    const targetGx = dir === 0 ? gx + 1 : dir === 1 ? gx - 1 : gx;
    const targetGz = dir === 2 ? gz + 1 : dir === 3 ? gz - 1 : gz;

    const carRng = rng.fork();
    const colorHex = rng.choice(CAR_COLORS);
    color.setHex(colorHex);
    instancedMesh.setColorAt(i, color);

    cars.push({
      id: i,
      rng: carRng,
      currentGx: gx,
      currentGz: gz,
      fromGx: gx,
      fromGz: gz,
      targetGx,
      targetGz,
      progress: carRng.nextFloat(0, 1),
      speed: carRng.nextFloat(10, 16) // m/s
    });
  }

  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
  instancedMesh.instanceMatrix.needsUpdate = true;

  return {
    mesh: instancedMesh,
    update(deltaTime, playerPos) {
      // Reposition cars if too far from player
      const centerGx = Math.round(playerPos.x / CELL_PITCH);
      const centerGz = Math.round(playerPos.z / CELL_PITCH);

      cars.forEach((car, i) => {
        // Recycle car if outside active 20-block window
        if (Math.abs(car.currentGx - centerGx) > 12 || Math.abs(car.currentGz - centerGz) > 12) {
          car.currentGx = centerGx + car.rng.nextInt(-8, 8);
          car.currentGz = centerGz + car.rng.nextInt(-8, 8);
          car.fromGx = car.currentGx;
          car.fromGz = car.currentGz;
          const next = getNextIntersection(car.currentGx, car.currentGz, car.fromGx, car.fromGz, car.rng);
          car.targetGx = next.gx;
          car.targetGz = next.gz;
          car.progress = 0;
        }

        // Advance along lane
        car.progress += (car.speed * deltaTime) / CELL_PITCH;

        while (car.progress >= 1.0) {
          car.progress -= 1.0;
          car.fromGx = car.currentGx;
          car.fromGz = car.currentGz;
          car.currentGx = car.targetGx;
          car.currentGz = car.targetGz;

          const next = getNextIntersection(car.currentGx, car.currentGz, car.fromGx, car.fromGz, car.rng);
          car.targetGx = next.gx;
          car.targetGz = next.gz;
        }

        const lanePos = getLanePosition(car.currentGx, car.currentGz, car.targetGx, car.targetGz, car.progress);

        position.set(lanePos.x, 0.1, lanePos.z);
        rotation.set(0, lanePos.angle, 0);
        quaternion.setFromEuler(rotation);

        matrix.compose(position, quaternion, scale);
        instancedMesh.setMatrixAt(i, matrix);
      });

      instancedMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      if (instancedMesh.parent) instancedMesh.parent.remove(instancedMesh);
      carGeometry.dispose();
      carMaterial.dispose();
      instancedMesh.dispose();
    }
  };
}
