import * as THREE from 'three';
import { updateCamera } from './camera.js';
import { resolveCollision } from './physics.js';

export const EYE_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.4;
export const WALK_SPEED = 6.0;
export const RUN_SPEED = 14.0;
export const GRAVITY = 20.0;
export const JUMP_FORCE = 7.5;

export function createPlayer(worldSeed, initialMode = 'fly', initialPos = new THREE.Vector3(0, 100, 0)) {
  let mode = initialMode; // 'fly' | 'walk'
  const position = initialPos.clone();
  const velocity = new THREE.Vector3(0, 0, 0);
  let isGrounded = false;

  return {
    getMode() {
      return mode;
    },
    getPosition() {
      return position;
    },
    isGrounded() {
      return isGrounded;
    },
    setMode(newMode, camera) {
      if (mode === newMode) return;
      mode = newMode;
      velocity.set(0, 0, 0);
      if (mode === 'walk') {
        // Clamp to ground level on switch
        if (position.y > 0 && position.y < 10) {
          position.y = 0;
          isGrounded = true;
        }
        if (camera) {
          camera.position.set(position.x, position.y + EYE_HEIGHT, position.z);
        }
      }
    },
    toggleMode(camera) {
      this.setMode(mode === 'fly' ? 'walk' : 'fly', camera);
      return mode;
    },
    teleport(newPos, camera) {
      position.copy(newPos);
      velocity.set(0, 0, 0);
      if (mode === 'walk') {
        position.y = Math.max(0, position.y);
        isGrounded = position.y === 0;
        if (camera) {
          camera.position.set(position.x, position.y + EYE_HEIGHT, position.z);
        }
      } else if (camera) {
        camera.position.copy(position);
      }
    },
    update(camera, input, deltaTime) {
      if (mode === 'fly') {
        updateCamera(camera, input, deltaTime);
        position.copy(camera.position);
        return;
      }

      // Walk Mode
      const speed = input.keys.shift ? RUN_SPEED : WALK_SPEED;

      // Mouse look update (yaw and pitch)
      const mouseDelta = input.consumeMouse();
      const sensitivity = 0.002;
      const PITCH_LIMIT = 1.55;

      camera.rotation.y -= mouseDelta.dx * sensitivity;
      camera.rotation.x -= mouseDelta.dy * sensitivity;
      camera.rotation.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, camera.rotation.x));

      // Calculate horizontal movement from camera yaw
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y);

      const moveDir = new THREE.Vector3();
      if (input.keys.w) moveDir.add(forward);
      if (input.keys.s) moveDir.sub(forward);
      if (input.keys.d) moveDir.add(right);
      if (input.keys.a) moveDir.sub(right);

      const desiredMove = { x: 0, z: 0 };
      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        desiredMove.x = moveDir.x * speed * deltaTime;
        desiredMove.z = moveDir.z * speed * deltaTime;
      }

      // Resolve AABB collision with 3x3 local buildings
      const resolved = resolveCollision(worldSeed, position, desiredMove, PLAYER_RADIUS, EYE_HEIGHT);
      position.x = resolved.x;
      position.z = resolved.z;

      // Vertical kinematics & jump
      if (input.keys.space && isGrounded) {
        velocity.y = JUMP_FORCE;
        isGrounded = false;
      }

      velocity.y -= GRAVITY * deltaTime;
      position.y += velocity.y * deltaTime;

      if (position.y <= 0) {
        position.y = 0;
        velocity.y = 0;
        isGrounded = true;
      }

      // Sync camera to eye position
      camera.position.set(position.x, position.y + EYE_HEIGHT, position.z);
    }
  };
}
