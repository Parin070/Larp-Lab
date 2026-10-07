import { createRNG } from '../core/rng.js';
import { CELL_PITCH } from '../world/city.js';

export const NPC_ACTIVITIES = {
  SIDEWALK_WALK: 'walk',
  JOGGER: 'jog',
  CORNER_CHAT_PAIR: 'chat',
  CROSSWALK_CROSSING: 'cross',
  CHILL_PLAZA: 'chill'
};

export const NPC_SHIRT_COLORS = [
  0xff007f, // Neon Pink
  0x00f5d4, // Tropical Cyan
  0x70e000, // Electric Lime
  0xfee440, // Sunshine Yellow
  0xff0054, // Sports Crimson
  0x3a86ff, // Royal Blue
  0xfb5607, // Sunset Orange
  0x8338ec, // Purple Violet
  0xf8fafc, // Crisp White
  0x18181b  // Dark Streetwear
];

export function hashChunkCoords(seed, cx, cz) {
  let h = seed ^ 0x811c9dc5;
  h = Math.imul(h ^ (cx + 5000), 0x01000193);
  h = Math.imul(h ^ (cz + 5000), 0x01000193);
  return Math.abs(h);
}

// Generate deterministic active ambient NPCs for a specific chunk (cx, cz)
export function generateChunkNPCs(worldSeed, cx, cz, count = 8) {
  const chunkSeed = hashChunkCoords(worldSeed, cx, cz);
  const rng = createRNG(chunkSeed);
  const npcs = [];

  const CHUNK_SIZE = 576;
  const HALF_CHUNK = 288;
  const minChunkX = cx * CHUNK_SIZE - HALF_CHUNK;
  const minChunkZ = cz * CHUNK_SIZE - HALF_CHUNK;

  for (let i = 0; i < count; i++) {
    const npcSeed = rng.nextInt(1000, 999999);
    const nRng = createRNG(npcSeed);

    // Pick building lot inside chunk (8x8 grid)
    const lx = nRng.nextInt(0, 7);
    const lz = nRng.nextInt(0, 7);
    const cellCenterX = minChunkX + lx * CELL_PITCH + CELL_PITCH / 2;
    const cellCenterZ = minChunkZ + lz * CELL_PITCH + CELL_PITCH / 2;

    const activityRoll = nRng.nextFloat();
    let activity = NPC_ACTIVITIES.SIDEWALK_WALK;
    let speed = 2.2; // m/s
    let partnerOffset = 0;

    if (activityRoll < 0.50) {
      activity = NPC_ACTIVITIES.SIDEWALK_WALK;
      speed = nRng.nextFloat(1.8, 2.6);
    } else if (activityRoll < 0.70) {
      activity = NPC_ACTIVITIES.JOGGER;
      speed = nRng.nextFloat(3.8, 4.8);
    } else if (activityRoll < 0.85) {
      activity = NPC_ACTIVITIES.CORNER_CHAT_PAIR;
      speed = 0;
      partnerOffset = (i % 2 === 0) ? -0.8 : 0.8;
    } else if (activityRoll < 0.95) {
      activity = NPC_ACTIVITIES.CROSSWALK_CROSSING;
      speed = nRng.nextFloat(1.6, 2.2);
    } else {
      activity = NPC_ACTIVITIES.CHILL_PLAZA;
      speed = 0;
    }

    const colorHex = nRng.choice(NPC_SHIRT_COLORS);
    const startOffset = nRng.nextFloat(0, 224);
    const clockwise = nRng.nextFloat() > 0.5;

    npcs.push({
      id: `npc_${cx}_${cz}_${i}`,
      seed: npcSeed,
      cx,
      cz,
      activity,
      cellCenterX,
      cellCenterZ,
      speed,
      startOffset,
      clockwise,
      partnerOffset,
      colorHex,
      name: `Dude-${Math.abs(npcSeed % 10000)}`
    });
  }

  return npcs;
}

// Continuous closed-form evaluation: returns position, heading yaw, roll sway, and step bounce
export function evaluateNPCPosition(npc, simTime, animTime = simTime * 600) {
  const SIDEWALK_RADIUS = 28; // Distance from cell center to sidewalk center line
  const SIDEWALK_PERIMETER = 4 * (2 * SIDEWALK_RADIUS); // 224 meters
  const SIDEWALK_ELEVATION = 0.15;

  let x = npc.cellCenterX;
  let z = npc.cellCenterZ;
  let y = SIDEWALK_ELEVATION;
  let heading = 0;
  let roll = 0;

  switch (npc.activity) {
    case NPC_ACTIVITIES.SIDEWALK_WALK:
    case NPC_ACTIVITIES.JOGGER: {
      const isJogger = npc.activity === NPC_ACTIVITIES.JOGGER;
      const effectiveSpeed = npc.speed * (npc.clockwise ? 1 : -1);
      const totalDist = ((npc.startOffset + animTime * effectiveSpeed) % SIDEWALK_PERIMETER + SIDEWALK_PERIMETER) % SIDEWALK_PERIMETER;

      const segLen = SIDEWALK_RADIUS * 2; // 56m
      const segIndex = Math.floor(totalDist / segLen);
      const s = totalDist - segIndex * segLen; // [0, 56)

      const R = SIDEWALK_RADIUS;

      if (npc.clockwise) {
        // Clockwise: North edge (W->E) -> East edge (N->S) -> South edge (E->W) -> West edge (S->N)
        if (segIndex === 0) {
          x = npc.cellCenterX - R + s;
          z = npc.cellCenterZ - R;
          heading = Math.PI / 2;
        } else if (segIndex === 1) {
          x = npc.cellCenterX + R;
          z = npc.cellCenterZ - R + s;
          heading = 0;
        } else if (segIndex === 2) {
          x = npc.cellCenterX + R - s;
          z = npc.cellCenterZ + R;
          heading = -Math.PI / 2;
        } else {
          x = npc.cellCenterX - R;
          z = npc.cellCenterZ + R - s;
          heading = Math.PI;
        }
      } else {
        // Counter-clockwise
        if (segIndex === 0) {
          x = npc.cellCenterX + R - s;
          z = npc.cellCenterZ - R;
          heading = -Math.PI / 2;
        } else if (segIndex === 1) {
          x = npc.cellCenterX - R;
          z = npc.cellCenterZ - R + s;
          heading = 0;
        } else if (segIndex === 2) {
          x = npc.cellCenterX - R + s;
          z = npc.cellCenterZ + R;
          heading = Math.PI / 2;
        } else {
          x = npc.cellCenterX + R;
          z = npc.cellCenterZ + R - s;
          heading = Math.PI;
        }
      }

      // Step bounce & swagger roll
      const stepFreq = isJogger ? 10.0 : 6.5;
      const bounceHeight = isJogger ? 0.16 : 0.09;
      const stepPhase = animTime * stepFreq;

      y = SIDEWALK_ELEVATION + Math.abs(Math.sin(stepPhase)) * bounceHeight;
      roll = Math.sin(stepPhase) * (isJogger ? 0.10 : 0.06);
      break;
    }

    case NPC_ACTIVITIES.CORNER_CHAT_PAIR: {
      const cornerX = npc.cellCenterX + 28;
      const cornerZ = npc.cellCenterZ + 28;
      x = cornerX + npc.partnerOffset * 0.7;
      z = cornerZ;

      // Face each other
      heading = (npc.partnerOffset < 0) ? Math.PI / 2 : -Math.PI / 2;

      // Conversational nodding and subtle weight shift
      const chatPhase = animTime * 2.5 + npc.seed;
      y = SIDEWALK_ELEVATION + Math.abs(Math.sin(chatPhase)) * 0.02;
      heading += Math.sin(chatPhase * 0.5) * 0.12;
      break;
    }

    case NPC_ACTIVITIES.CROSSWALK_CROSSING: {
      // Cross intersection between adjacent blocks
      const crossDist = 12.0; // 12m road width
      const cycle = ((animTime * npc.speed + npc.startOffset) % (crossDist * 2) + crossDist * 2) % (crossDist * 2);
      const isForward = cycle < crossDist;
      const s = isForward ? cycle : crossDist * 2 - cycle;

      x = npc.cellCenterX + 28 + s;
      z = npc.cellCenterZ + 28;
      heading = isForward ? Math.PI / 2 : -Math.PI / 2;

      const stepPhase = animTime * 6.0;
      y = SIDEWALK_ELEVATION + Math.abs(Math.sin(stepPhase)) * 0.08;
      roll = Math.sin(stepPhase) * 0.05;
      break;
    }

    case NPC_ACTIVITIES.CHILL_PLAZA:
    default: {
      x = npc.cellCenterX;
      z = npc.cellCenterZ + 28;
      const lookPhase = animTime * 1.2 + npc.seed;
      heading = Math.PI + Math.sin(lookPhase) * 0.5;
      y = SIDEWALK_ELEVATION;
      break;
    }
  }

  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    z: Math.round(z * 100) / 100,
    heading,
    roll,
    state: npc.activity,
    isOutdoor: true
  };
}

// Backward-compatible schedule generator for unit tests
export function createNPCSchedule(npcSeed, worldSeed) {
  const rng = createRNG(npcSeed);
  const homeGx = rng.nextInt(-10, 10);
  const homeGz = rng.nextInt(-10, 10);
  const home = {
    x: homeGx * CELL_PITCH + CELL_PITCH / 2,
    z: homeGz * CELL_PITCH + CELL_PITCH / 2
  };

  return {
    id: `npc_${npcSeed}`,
    name: `Citizen-${Math.abs(npcSeed % 10000)}`,
    seed: npcSeed,
    home,
    work: home,
    activity: NPC_ACTIVITIES.SIDEWALK_WALK,
    cellCenterX: home.x,
    cellCenterZ: home.z,
    speed: 2.2,
    startOffset: 0,
    clockwise: true,
    partnerOffset: 0
  };
}
