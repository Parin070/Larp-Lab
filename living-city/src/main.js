import * as THREE from 'three';
import { createRenderer, setupResize } from './core/renderer.js';
import { createCamera, updateCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { startLoop } from './core/loop.js';
import { createRNG } from './core/rng.js';
import { createEventBus } from './events/bus.js';
import { generateCity } from './world/city.js';
import { createTimeController, getSkyColor, updateLighting, getWindowIntensity } from './sim/time.js';
import { createDebugOverlay } from './ui/debug.js';

// Bootstrap the application
const SEED = 12345;

// Core systems
const renderer = createRenderer();
const scene = new THREE.Scene();
const camera = createCamera(75, window.innerWidth / window.innerHeight);

// Event bus with simulation time
const timeController = createTimeController();
const bus = createEventBus(() => timeController.getTime());

// RNG and world generation
const rng = createRNG(SEED);
const city = generateCity(rng, 20);

scene.add(city.meshes.buildings);
scene.add(city.meshes.ground);
scene.add(city.meshes.roads);

bus.emit('city_generated', { data: { seed: SEED, buildings: city.data.length } });

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
scene.add(directionalLight);

const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x4a4a4a, 0.5);
scene.add(hemisphereLight);

// Input and UI
const input = createInput(renderer.domElement);
const debugOverlay = createDebugOverlay(renderer);

// Time control handlers
input.onKeyPress('KeyP', () => timeController.togglePause());
input.onKeyPress('BracketLeft', () => timeController.scrub(-1));
input.onKeyPress('BracketRight', () => timeController.scrub(1));

// Resize handling
const cleanupResize = setupResize(renderer, camera);

// Track camera cell for sparse events
let lastCameraCell = { x: 0, z: 0 };

function getCameraCell(pos) {
  const CELL_SIZE = 64;
  return {
    x: Math.floor(pos.x / CELL_SIZE),
    z: Math.floor(pos.z / CELL_SIZE)
  };
}

// Game loop
startLoop(
  (deltaTime) => {
    // Update time and emit hour change events
    timeController.update(deltaTime, (hour) => {
      bus.emit('time_changed', { data: { hour } });
    });

    const time = timeController.getTime();

    // Update sky and lighting
    scene.background = getSkyColor(time);
    updateLighting(time, directionalLight, hemisphereLight);

    // Update building window glow
    const windowIntensity = getWindowIntensity(time);
    if (city.buildingMaterial.userData.nightIntensity) {
      city.buildingMaterial.userData.nightIntensity.value = windowIntensity;
    } else {
      city.buildingMaterial.emissiveIntensity = windowIntensity;
    }

    // Update camera
    updateCamera(camera, input, deltaTime);

    // Emit camera_moved only on cell change
    const currentCell = getCameraCell(camera.position);
    if (currentCell.x !== lastCameraCell.x || currentCell.z !== lastCameraCell.z) {
      bus.emit('camera_moved', {
        locationId: `${currentCell.x},${currentCell.z}`,
        data: { x: camera.position.x, y: camera.position.y, z: camera.position.z }
      });
      lastCameraCell = currentCell;
    }

    // Update debug overlay
    debugOverlay.update(deltaTime, time, camera.position, {
      isPaused: timeController.isPaused()
    });
  },
  () => {
    renderer.render(scene, camera);
  }
);

// Log startup
console.log(`Living City - Phase 1
Seed: ${SEED}
Buildings: ${city.data.length}
Press F3 to toggle debug overlay
Click to lock mouse, WASD to move, Shift to boost, Space/C to fly`);
