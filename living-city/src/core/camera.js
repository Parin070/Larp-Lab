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

  // Movement
  const velocity = new THREE.Vector3();

  if (input.keys.w) velocity.z -= 1;
  if (input.keys.s) velocity.z += 1;
  if (input.keys.a) velocity.x -= 1;
  if (input.keys.d) velocity.x += 1;
  if (input.keys.space) velocity.y += 1;
  if (input.keys.c) velocity.y -= 1;

  if (velocity.length() > 0) {
    velocity.normalize();
    velocity.multiplyScalar(speed * deltaTime);

    // Transform velocity to camera space
    velocity.applyQuaternion(camera.quaternion);
    camera.position.add(velocity);
  }
}
