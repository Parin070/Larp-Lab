import * as THREE from 'three';
import { createRenderer, setupResize } from './core/renderer.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { createPlayer } from './core/player.js';
import { startLoop } from './core/loop.js';
import { createEventBus } from './events/bus.js';
import { createEventLog } from './events/eventLog.js';
import { createChunkManager } from './world/chunkManager.js';
import { generateChunkData } from './world/chunk.js';
import { createTrafficSystem } from './sim/traffic.js';
import { createNPCRenderer } from './sim/npcRenderer.js';
import { createWaypointMarker } from './world/waypoint.js';
import { createInteriorScene } from './interiors/interiorScene.js';
import { createInteractionPrompt } from './ui/interactionPrompt.js';
import { createSearchModal } from './ui/searchModal.js';
import { createEventViewer } from './ui/eventViewer.js';
import { saveGameState, loadGameState } from './save/saveManager.js';
import { createTimeController, getSkyColor, updateLighting, getWindowIntensity } from './sim/time.js';
import { createDebugOverlay } from './ui/debug.js';

// Bootstrap the application
const SEED = 12345;

// Core systems
const renderer = createRenderer();
const exteriorScene = new THREE.Scene();
const camera = createCamera(75, window.innerWidth / window.innerHeight);

// Player controller (starts in fly mode at y=100m, toggle with 'V')
const player = createPlayer(SEED, 'fly', new THREE.Vector3(0, 100, 0));

// Interior state
let activeInterior = null;
let savedExteriorPos = new THREE.Vector3();

// Event bus with simulation time
const timeController = createTimeController();
const bus = createEventBus(() => timeController.getTime());
const eventLog = createEventLog(bus, 500);

// Chunk streaming world (infinite, load radius 2 = 5x5 = 25 chunks)
const chunkManager = createChunkManager(SEED, exteriorScene, bus, 2);
chunkManager.init(0, 0);

bus.emit('world_initialized', { data: { seed: SEED, loadRadius: 2 } });

// Traffic, NPCs, and Waypoint Marker
const traffic = createTrafficSystem(SEED, 64);
exteriorScene.add(traffic.mesh);

const npcs = createNPCRenderer(SEED, bus, 80);
exteriorScene.add(npcs.mesh);

const waypoint = createWaypointMarker();
exteriorScene.add(waypoint.group);

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
exteriorScene.add(directionalLight);

const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x4a4a4a, 0.5);
exteriorScene.add(hemisphereLight);

// Input and UI
const input = createInput(renderer.domElement);
const debugOverlay = createDebugOverlay(renderer);
const interactionPrompt = createInteractionPrompt();
const eventViewer = createEventViewer(eventLog);

// Search Modal
const searchModal = createSearchModal(
  SEED,
  (building) => {
    waypoint.setTarget({ x: building.door.x, z: building.door.z }, building.address);
    bus.emit('waypoint_set', {
      actorId: 'player',
      locationId: building.id,
      data: { x: building.door.x, z: building.door.z, address: building.address }
    });
  },
  (building) => {
    player.setMode('walk', camera);
    player.teleport(new THREE.Vector3(building.door.x, 0, building.door.z), camera);
    waypoint.setTarget({ x: building.door.x, z: building.door.z }, building.address);
    bus.emit('player_teleport', {
      actorId: 'player',
      locationId: building.id,
      data: { x: building.door.x, z: building.door.z, address: building.address }
    });
  }
);

// Find nearby door in exterior world
function findNearbyExteriorDoor(pos, maxDist = 3.5) {
  const cellPitch = 72;
  const gx = Math.floor(pos.x / cellPitch);
  const gz = Math.floor(pos.z / cellPitch);

  const buildingCenterX = gx * cellPitch + cellPitch / 2;
  const buildingCenterZ = gz * cellPitch + cellPitch / 2;

  const cx = Math.floor((buildingCenterX + 288) / 576);
  const cz = Math.floor((buildingCenterZ + 288) / 576);

  const chunkData = generateChunkData(SEED, cx, cz);
  for (let i = 0; i < chunkData.length; i++) {
    const b = chunkData[i];
    const dist = Math.hypot(pos.x - b.door.x, pos.z - b.door.z);
    if (dist <= maxDist) {
      return b;
    }
  }
  return null;
}

// Mode & Interaction Key handlers
input.onKeyPress('KeyV', () => {
  if (activeInterior || searchModal.isOpen()) return;
  const newMode = player.toggleMode(camera);
  bus.emit('player_mode_changed', { data: { mode: newMode } });
});

input.onKeyPress('KeyK', () => {
  if (activeInterior) return;
  searchModal.toggle();
});

input.onKeyPress('Slash', (e) => {
  if (activeInterior) return;
  e.preventDefault();
  searchModal.toggle();
});

input.onKeyPress('KeyL', () => {
  eventViewer.toggle();
});

input.onKeyPress('KeyE', () => {
  if (searchModal.isOpen()) return;

  if (activeInterior) {
    if (activeInterior.isNearExit(player.getPosition())) {
      const buildingId = activeInterior.building.id;
      bus.emit('door_exited', {
        actorId: 'player',
        locationId: buildingId,
        data: { buildingId }
      });
      activeInterior.dispose();
      activeInterior = null;
      interactionPrompt.hide();
      player.teleport(savedExteriorPos, camera);
    }
  } else {
    const nearbyBuilding = findNearbyExteriorDoor(player.getPosition());
    if (nearbyBuilding) {
      savedExteriorPos.copy(player.getPosition());
      bus.emit('door_entered', {
        actorId: 'player',
        locationId: nearbyBuilding.id,
        data: { buildingId: nearbyBuilding.id, seed: nearbyBuilding.seed }
      });
      activeInterior = createInteriorScene(nearbyBuilding);
      interactionPrompt.hide();
      player.setMode('walk', camera);
      player.teleport(new THREE.Vector3(activeInterior.spawnPos.x, 0, activeInterior.spawnPos.z), camera);
    }
  }
});

input.onKeyPress('KeyP', () => timeController.togglePause());
input.onKeyPress('BracketLeft', () => timeController.scrub(-1));
input.onKeyPress('BracketRight', () => timeController.scrub(1));

// Auto-save game state every 30 seconds
let saveTimer = 0;

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

    // Auto-save timer
    saveTimer += deltaTime;
    if (saveTimer > 30) {
      saveTimer = 0;
      saveGameState(SEED, player, timeController);
    }

    // Update sky and lighting
    exteriorScene.background = getSkyColor(time);
    updateLighting(time, directionalLight, hemisphereLight);

    // Update building window glow
    const windowIntensity = getWindowIntensity(time);
    const buildingMaterial = chunkManager.getBuildingMaterial();
    if (buildingMaterial.userData.nightIntensity) {
      buildingMaterial.userData.nightIntensity.value = windowIntensity;
    }

    // Update player and camera kinematics (pause input movement if search modal is open)
    if (!searchModal.isOpen()) {
      player.update(camera, input, deltaTime, activeInterior);
    }

    // Update exterior simulation (traffic, NPCs, waypoint beacon)
    if (!activeInterior) {
      traffic.update(deltaTime, player.getPosition());
      npcs.update(time);
      waypoint.update(time);
      chunkManager.update(player.getPosition());
    }

    // Interaction prompt update
    if (activeInterior) {
      if (activeInterior.isNearExit(player.getPosition())) {
        interactionPrompt.show('Press [E] to Exit Building');
      } else {
        interactionPrompt.hide();
      }
    } else if (player.getMode() === 'walk' && !searchModal.isOpen()) {
      const nearbyBuilding = findNearbyExteriorDoor(player.getPosition());
      if (nearbyBuilding) {
        interactionPrompt.show(`Press [E] to Enter ${nearbyBuilding.address}`);
      } else {
        interactionPrompt.hide();
      }
    } else {
      interactionPrompt.hide();
    }

    // Emit camera_moved only on cell change
    const currentCell = getCameraCell(player.getPosition());
    if (currentCell.x !== lastCameraCell.x || currentCell.z !== lastCameraCell.z) {
      bus.emit('camera_moved', {
        locationId: `${currentCell.x},${currentCell.z}`,
        data: { x: camera.position.x, y: camera.position.y, z: camera.position.z }
      });
      lastCameraCell = currentCell;
    }

    // Update debug overlay
    debugOverlay.update(deltaTime, time, player.getPosition(), {
      isPaused: timeController.isPaused(),
      loadedChunks: activeInterior ? 0 : chunkManager.getLoadedChunkCount(),
      playerMode: activeInterior ? 'INTERIOR' : player.getMode().toUpperCase()
    });
  },
  () => {
    renderer.render(activeInterior ? activeInterior.scene : exteriorScene, camera);
  }
);

// Log startup
console.log(`Living City - All Milestones Complete (Phases 1-6 Foundation)
Seed: ${SEED}
Chunk Size: 576m (8x8 cells)
Controls:
  V: Toggle Walk / Fly mode
  E: Enter / Exit building door
  K or /: Open Building Search & Waypoint modal
  L: Toggle Event Log Stream Viewer
  WASD: Move, Shift: Run / Boost
  Space: Jump (Walk mode) / Up (Fly mode)
  C: Down (Fly mode)
  P: Pause time, [ / ]: Scrub time
  F3: Full HUD, F4: Telemetry`);
