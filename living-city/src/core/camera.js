import * as THREE from 'three';

const PITCH_LIMIT = 1.55; // ~89 degrees

export function createCamera(fov = 75, aspect = 1) {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 2000);
  camera.position.set(0, 100, 0);
  camera.rotation.order = 'YXZ'; // Yaw-Pitch-Roll order

  return camera;
}

export function updateCamera(camera, input, deltaTime) {
  const speed = input.keys.shift ? 150 : 50;

  // Mouse look
  const mouseDelta = input.consumeMouse();
  const sensitivity = 0.002;

  camera.rotation.y -= mouseDelta.dx * sensitivity;
  camera.rotation.x -= mouseDelta.dy * sensitivity;
  camera.rotation.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, camera.rotation.x));

  // Horizontal movement (camera-relative)
  const horizontalVelocity = new THREE.Vector3();

  if (input.keys.w) horizontalVelocity.z -= 1;
  if (input.keys.s) horizontalVelocity.z += 1;
  if (input.keys.a) horizontalVelocity.x -= 1;
  if (input.keys.d) horizontalVelocity.x += 1;

  if (horizontalVelocity.length() > 0) {
    horizontalVelocity.normalize();
    horizontalVelocity.multiplyScalar(speed * deltaTime);
    horizontalVelocity.applyQuaternion(camera.quaternion);
    camera.position.add(horizontalVelocity);
  }

  // Vertical movement (world-space Y axis, pitch-independent)
  let verticalVelocity = 0;
  if (input.keys.space) verticalVelocity += 1;
  if (input.keys.c) verticalVelocity -= 1;

  if (verticalVelocity !== 0) {
    camera.position.y += verticalVelocity * speed * deltaTime;
  }
}
