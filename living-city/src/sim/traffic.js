import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { createRNG } from '../core/rng.js';
import { CELL_PITCH } from '../world/city.js';
import { getLanePosition, getNextIntersection } from '../world/roadGraph.js';

export const CAR_COLORS = [
  0xd90429, // Cherry Red
  0x2563eb, // Electric Blue
  0xffd166, // Sunshine Yellow / Taxi
  0x10b981, // Emerald Green
  0xf97316, // Sunset Orange
  0x8b5cf6, // Neon Purple
  0x1e293b, // Midnight Black
  0xf8fafc, // Pearl White
  0x06b6d4  // Aqua Cyan
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

export function createTrafficSystem(worldSeed, maxCars = 64) {
  const rng = createRNG(worldSeed + 54321);

  // 1. Build composite low-poly vehicle geometry
  const parts = [];

  // Main chassis
  const chassisGeom = new THREE.BoxGeometry(1.85, 0.55, 4.0);
  chassisGeom.translate(0, 0.45, 0);
  colorGeom(chassisGeom, 0xffffff); // Tints with instance color
  parts.push(chassisGeom);

  // Cabin
  const cabinGeom = new THREE.BoxGeometry(1.6, 0.6, 2.1);
  cabinGeom.translate(0, 1.0, -0.2);
  colorGeom(cabinGeom, 0xffffff); // Tints with instance color
  parts.push(cabinGeom);

  // Tinted Windshield (Front)
  const windshield = new THREE.BoxGeometry(1.52, 0.48, 0.1);
  windshield.translate(0, 0.98, 0.85);
  colorGeom(windshield, 0x1e293b);
  parts.push(windshield);

  // Tinted Rear Window
  const rearWindow = new THREE.BoxGeometry(1.52, 0.48, 0.1);
  rearWindow.translate(0, 0.98, -1.25);
  colorGeom(rearWindow, 0x1e293b);
  parts.push(rearWindow);

  // Front Headlights (Bright Yellow Glow)
  const headL = new THREE.BoxGeometry(0.35, 0.18, 0.1);
  headL.translate(-0.65, 0.52, 2.02);
  colorGeom(headL, 0xfffee0);
  parts.push(headL);

  const headR = new THREE.BoxGeometry(0.35, 0.18, 0.1);
  headR.translate(0.65, 0.52, 2.02);
  colorGeom(headR, 0xfffee0);
  parts.push(headR);

  // Rear Taillights (Ruby Red)
  const tailL = new THREE.BoxGeometry(0.35, 0.18, 0.1);
  tailL.translate(-0.65, 0.52, -2.02);
  colorGeom(tailL, 0xff0033);
  parts.push(tailL);

  const tailR = new THREE.BoxGeometry(0.35, 0.18, 0.1);
  tailR.translate(0.65, 0.52, -2.02);
  colorGeom(tailR, 0xff0033);
  parts.push(tailR);

  // Front & Rear Bumpers (Dark Slate)
  const frontBumper = new THREE.BoxGeometry(1.9, 0.22, 0.2);
  frontBumper.translate(0, 0.3, 2.02);
  colorGeom(frontBumper, 0x0f172a);
  parts.push(frontBumper);

  const rearBumper = new THREE.BoxGeometry(1.9, 0.22, 0.2);
  rearBumper.translate(0, 0.3, -2.02);
  colorGeom(rearBumper, 0x0f172a);
  parts.push(rearBumper);

  // 4 Low-Poly Chunky Wheels (Tires + Silver Hubcap Rims)
  const wheelPositions = [
    [-0.95, 0.32, 1.2],
    [0.95, 0.32, 1.2],
    [-0.95, 0.32, -1.2],
    [0.95, 0.32, -1.2]
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    // Black Rubber Tire
    const tire = new THREE.BoxGeometry(0.24, 0.64, 0.64);
    tire.translate(wx, wy, wz);
    colorGeom(tire, 0x0f172a);
    parts.push(tire);

    // Silver Hubcap Rim
    const rim = new THREE.BoxGeometry(0.04, 0.32, 0.32);
    const rimX = wx < 0 ? wx - 0.12 : wx + 0.12;
    rim.translate(rimX, wy, wz);
    colorGeom(rim, 0xe2e8f0);
    parts.push(rim);
  });

  const carGeometry = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());

  const carMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
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
