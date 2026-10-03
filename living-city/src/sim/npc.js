import { createRNG } from '../core/rng.js';
import { CELL_PITCH } from '../world/city.js';

export function createNPCSchedule(npcSeed, worldSeed) {
  const rng = createRNG(npcSeed);

  // Pick deterministic home and work coordinates
  const homeGx = rng.nextInt(-10, 10);
  const homeGz = rng.nextInt(-10, 10);
  const workGx = homeGx + rng.nextInt(-6, 6);
  const workGz = homeGz + rng.nextInt(-6, 6);

  const home = {
    x: homeGx * CELL_PITCH + CELL_PITCH / 2,
    z: homeGz * CELL_PITCH + CELL_PITCH / 2
  };

  const work = {
    x: workGx * CELL_PITCH + CELL_PITCH / 2,
    z: workGz * CELL_PITCH + CELL_PITCH / 2
  };

  const name = `Citizen-${Math.abs(npcSeed % 10000)}`;

  return {
    id: `npc_${npcSeed}`,
    name,
    seed: npcSeed,
    home,
    work
  };
}

// Closed-form evaluation: returns exact position & state at any simulation time
export function evaluateNPCPosition(npc, time) {
  // Normalize time to [0, 1)
  const t = ((time % 1) + 1) % 1;

  const HOME_END = 7 / 24;       // 07:00
  const COMMUTE1_END = 8.5 / 24; // 08:30
  const LUNCH_START = 12 / 24;   // 12:00
  const LUNCH_END = 13 / 24;     // 13:00
  const WORK_END = 17.5 / 24;    // 17:30
  const COMMUTE2_END = 19 / 24;  // 19:00
  const LEISURE_END = 22 / 24;   // 22:00

  let state = 'home';
  let isOutdoor = false;
  let x = npc.home.x;
  let z = npc.home.z;

  if (t < HOME_END || t >= LEISURE_END) {
    state = 'home';
    isOutdoor = false;
    x = npc.home.x;
    z = npc.home.z;
  } else if (t < COMMUTE1_END) {
    state = 'commute_work';
    isOutdoor = true;
    const progress = (t - HOME_END) / (COMMUTE1_END - HOME_END);
    x = npc.home.x + (npc.work.x - npc.home.x) * progress;
    z = npc.home.z + (npc.work.z - npc.home.z) * progress;
  } else if (t < LUNCH_START || (t >= LUNCH_END && t < WORK_END)) {
    state = 'work';
    isOutdoor = false;
    x = npc.work.x;
    z = npc.work.z;
  } else if (t >= LUNCH_START && t < LUNCH_END) {
    state = 'lunch';
    isOutdoor = true;
    const lunchProgress = (t - LUNCH_START) / (LUNCH_END - LUNCH_START);
    // Walk along sidewalk near work building
    x = npc.work.x + Math.sin(lunchProgress * Math.PI * 2) * 15;
    z = npc.work.z + Math.cos(lunchProgress * Math.PI * 2) * 15;
  } else if (t < COMMUTE2_END) {
    state = 'commute_home';
    isOutdoor = true;
    const progress = (t - WORK_END) / (COMMUTE2_END - WORK_END);
    x = npc.work.x + (npc.home.x - npc.work.x) * progress;
    z = npc.work.z + (npc.home.z - npc.work.z) * progress;
  } else if (t < LEISURE_END) {
    state = 'leisure';
    isOutdoor = true;
    const leisureProgress = (t - COMMUTE2_END) / (LEISURE_END - COMMUTE2_END);
    x = npc.home.x + Math.sin(leisureProgress * Math.PI * 2) * 20;
    z = npc.home.z + Math.cos(leisureProgress * Math.PI * 2) * 20;
  }

  return {
    x: Math.round(x * 100) / 100,
    y: 0,
    z: Math.round(z * 100) / 100,
    state,
    isOutdoor
  };
}
