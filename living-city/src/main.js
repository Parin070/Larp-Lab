import * as THREE from 'three';
import { createRenderer, setupResize } from './core/renderer.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { createPlayer } from './core/player.js';
import { startLoop } from './core/loop.js';
import { createEventBus } from './events/bus.js';
import { createChunkManager } from './world/chunkManager.js';
import { generateChunkData } from './world/chunk.js';
import { createTrafficSystem } from './sim/traffic.js';
import { createNPCRenderer } from './sim/npcRenderer.js';
import { createWaypointMarker } from './world/waypoint.js';
import { createInteriorScene } from './interiors/interiorScene.js';
import { createInteractionPrompt } from './ui/interactionPrompt.js';
import { createSearchModal } from './ui/searchModal.js';
import { saveGameState, loadGameState } from './save/saveManager.js';
import { createTimeController, getSkyColor, updateLighting, getWindowIntensity } from './sim/time.js';
import { createDebugOverlay } from './ui/debug.js';
import { createHUD } from './ui/hud.js';
import { createAudio } from './core/audio.js';
import { createQuestManager } from './sim/questManager.js';
import { createQuestRenderer } from './sim/questRenderer.js';
import { createDialogueModal } from './ui/dialogueModal.js';

// Bootstrap the application
const SEED = 12345;

// Audio Synthesizer (0 external network assets)
const audio = createAudio();

// Core systems
const renderer = createRenderer();
const exteriorScene = new THREE.Scene();
const camera = createCamera(75, window.innerWidth / window.innerHeight);

// Player controller (starts at street level in walk mode, toggle with 'V')
const player = createPlayer(SEED, 'walk', new THREE.Vector3(10, 0, 10));

// Interior state
let activeInterior = null;
const savedExteriorPos = new THREE.Vector3();

// Event bus with simulation time
const timeController = createTimeController();
const bus = createEventBus(() => timeController.getTime());

// Chunk streaming world (infinite, load radius 2 = 5x5 = 25 chunks)
const chunkManager = createChunkManager(SEED, exteriorScene, bus, 2);
chunkManager.init(0, 0);

bus.emit('world_initialized', { data: { seed: SEED, loadRadius: 2 } });

// Traffic, NPCs, and Waypoint Marker
const traffic = createTrafficSystem(SEED, 64);
exteriorScene.add(traffic.mesh);

const npcs = createNPCRenderer(SEED, bus, chunkManager, 400);
exteriorScene.add(npcs.mesh);

const waypoint = createWaypointMarker();
exteriorScene.add(waypoint.group);

// Quest System & In-World Givers / Props
const questManager = createQuestManager(SEED, bus, audio);
const questRenderer = createQuestRenderer(questManager);
exteriorScene.add(questRenderer.group);

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
exteriorScene.add(directionalLight);

const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x4a4a4a, 0.5);
exteriorScene.add(hemisphereLight);

// Input, HUD, and Modals
const input = createInput(renderer.domElement);
const debugOverlay = createDebugOverlay(renderer);
const interactionPrompt = createInteractionPrompt();
const hud = createHUD(renderer.domElement, bus);
const dialogueModal = createDialogueModal(audio);

// Wire Quest Events to Waypoints and HUD Banners
bus.on('quest_started', (e) => {
  const stage = e.data.stage;
  if (stage && stage.target) {
    waypoint.setTarget(stage.target, stage.text);
  }
});

bus.on('quest_progress', (e) => {
  const stage = e.data.stage;
  if (stage && stage.target) {
    waypoint.setTarget(stage.target, stage.text);
  }
});

bus.on('quest_completed', (e) => {
  waypoint.clear();
  hud.showBanner('🎉 MISSION COMPLETED! 🎉', `+$${e.data.reward.cash} CASH • +${e.data.reward.rep} DUDE REP`);
});

bus.on('quest_failed', (e) => {
  waypoint.clear();
  hud.showBanner('❌ MISSION FAILED', e.data.reason || 'Time expired');
});

// Load saved state on boot if available
loadGameState().then(savedState => {
  if (savedState && savedState.questData) {
    questManager.deserialize(savedState.questData);
  }
});

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
    let offsetX = 0;
    let offsetZ = 0;
    if (building.door.facing === 'south') offsetZ = 1.2;
    else if (building.door.facing === 'north') offsetZ = -1.2;
    else if (building.door.facing === 'east') offsetX = 1.2;
    else if (building.door.facing === 'west') offsetX = -1.2;

    player.teleport(new THREE.Vector3(building.door.x + offsetX, 0, building.door.z + offsetZ), camera);
    waypoint.setTarget({ x: building.door.x, z: building.door.z }, building.address);
    bus.emit('player_teleport', {
      actorId: 'player',
      locationId: building.id,
      data: { x: building.door.x, z: building.door.z, address: building.address }
    });
  }
);

// Find nearby door in exterior world (checks 3x3 neighbor cells)
function findNearbyExteriorDoor(pos, maxDist = 3.8) {
  const cellPitch = 72;
  const centerGx = Math.floor(pos.x / cellPitch);
  const centerGz = Math.floor(pos.z / cellPitch);

  let closestBuilding = null;
  let minDist = maxDist;

  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const gx = centerGx + dx;
      const gz = centerGz + dz;
      const buildingCenterX = gx * cellPitch + cellPitch / 2;
      const buildingCenterZ = gz * cellPitch + cellPitch / 2;

      const cx = Math.floor((buildingCenterX + 288) / 576);
      const cz = Math.floor((buildingCenterZ + 288) / 576);

      const chunkData = generateChunkData(SEED, cx, cz);
      for (let i = 0; i < chunkData.length; i++) {
        const b = chunkData[i];
        const dist = Math.hypot(pos.x - b.door.x, pos.z - b.door.z);
        if (dist <= minDist) {
          minDist = dist;
          closestBuilding = b;
        }
      }
    }
  }
  return closestBuilding;
}

// Ambient NPC Greetings
const AMBIENT_GREETINGS = [
  "Yo Dude! What's good?",
  "Love the sneakers, bro!",
  "Big city, big dreams Dude!",
  "Hey! Watch out for crazy drivers!",
  "Nice day for a walk in the city!",
  "Check out the pizza place down the block!",
  "Yo! Ever tried flying around with 'V'?",
  "Dude Theft Wars vibes all day!"
];

// Mode & Interaction Key handlers
input.onKeyPress('KeyV', () => {
  if (activeInterior || searchModal.isOpen() || dialogueModal.isOpen()) return;
  const newMode = player.toggleMode(camera);
  bus.emit('player_mode_changed', { data: { mode: newMode } });
});

input.onKeyPress('KeyK', () => {
  if (activeInterior || dialogueModal.isOpen()) return;
  searchModal.toggle();
});

input.onKeyPress('Slash', (e) => {
  if (activeInterior || dialogueModal.isOpen()) return;
  e.preventDefault();
  searchModal.toggle();
});

input.onKeyPress('Escape', () => {
  if (dialogueModal.isOpen()) {
    dialogueModal.decline();
  }
});

input.onKeyPress('KeyE', () => {
  if (searchModal.isOpen()) return;

  // 1. Dialogue Modal active -> Accept
  if (dialogueModal.isOpen()) {
    dialogueModal.accept();
    return;
  }

  // 2. Interior exit
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
    return;
  }

  // 3. Exterior interactive checks (Quest objectives & Quest Givers)
  const nearbyQuestInteractive = questRenderer.getNearbyInteractive(player.getPosition());
  if (nearbyQuestInteractive) {
    if (nearbyQuestInteractive.type === 'quest_objective') {
      questManager.advanceStage();
      interactionPrompt.hide();
      return;
    }

    if (nearbyQuestInteractive.type === 'quest_giver_available') {
      dialogueModal.open(
        nearbyQuestInteractive.quest,
        (acceptedQuest) => {
          questManager.acceptQuest(acceptedQuest);
          dialogueModal.close();
        },
        () => {
          dialogueModal.close();
        }
      );
      interactionPrompt.hide();
      return;
    }
  }

  // 4. Exterior Ambient NPCs
  const nearbyNPC = npcs.getNearbyNPC(player.getPosition(), 2.8);
  if (nearbyNPC) {
    audio.playVoiceBeep();
    const hash = Math.abs(parseInt(nearbyNPC.id.replace(/\D/g, ''), 10) || 0);
    const greeting = AMBIENT_GREETINGS[hash % AMBIENT_GREETINGS.length];
    hud.showBanner(`💬 ${nearbyNPC.name}`, greeting);
    bus.emit('npc_talked', {
      actorId: nearbyNPC.id,
      data: { name: nearbyNPC.name, x: nearbyNPC.x, z: nearbyNPC.z, activity: nearbyNPC.activity }
    });
    return;
  }

  // 5. Exterior Building Doors
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
let animTime = 0;

startLoop(
  (deltaTime) => {
    animTime += deltaTime;
    // Update time and emit hour change events
    timeController.update(deltaTime, (hour) => {
      bus.emit('time_changed', { data: { hour } });
    });

    const time = timeController.getTime();

    // Auto-save timer
    saveTimer += deltaTime;
    if (saveTimer > 30) {
      saveTimer = 0;
      saveGameState(SEED, player, timeController, questManager);
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

    // Update player and camera kinematics (pause input movement if modal is open)
    if (!searchModal.isOpen() && !dialogueModal.isOpen()) {
      player.update(camera, input, deltaTime, activeInterior);
    }

    // Update exterior simulation (traffic, NPCs, quest renderer, quest manager, waypoint)
    if (!activeInterior) {
      traffic.update(deltaTime, player.getPosition());
      npcs.update(animTime, chunkManager.getLoadedChunks(), player.getPosition());
      questManager.update(deltaTime);
      questRenderer.update(time, deltaTime);
      waypoint.update(time);
      chunkManager.update(player.getPosition());
    }

    // Interaction prompt update
    if (dialogueModal.isOpen()) {
      interactionPrompt.hide();
    } else if (activeInterior) {
      if (activeInterior.isNearExit(player.getPosition())) {
        interactionPrompt.show('Press [E] to Exit Building');
      } else {
        interactionPrompt.hide();
      }
    } else if (player.getMode() === 'walk' && !searchModal.isOpen()) {
      const nearbyQuestInteractive = questRenderer.getNearbyInteractive(player.getPosition());
      if (nearbyQuestInteractive) {
        interactionPrompt.show(nearbyQuestInteractive.prompt);
      } else {
        const nearbyNPC = npcs.getNearbyNPC(player.getPosition(), 2.8);
        if (nearbyNPC) {
          interactionPrompt.show(`Press [E] to Talk to ${nearbyNPC.name}`);
        } else {
          const nearbyBuilding = findNearbyExteriorDoor(player.getPosition());
          if (nearbyBuilding) {
            interactionPrompt.show(`Press [E] to Enter ${nearbyBuilding.address}`);
          } else {
            interactionPrompt.hide();
          }
        }
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

    // Update debug overlay and HUD
    hud.update(time, player.getMode(), input.keys.shift, !!activeInterior, questManager);
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
console.log(`Living City: Dude Theft Wars Edition
Seed: ${SEED}
Chunk Size: 576m (8x8 cells)
Controls:
  E: Interact / Talk to Quest Givers (❗) / Pick up / Enter Doors
  Esc: Close Dialogue Modal
  V: Toggle Walk / Fly mode
  K or /: Open Building Search & Waypoint modal
  WASD: Move, Shift: Run / Boost
  Space: Jump (Walk mode) / Up (Fly mode)
  P: Pause time, [ / ]: Scrub time
  F3: Full HUD, F4: Telemetry`);
