import { setItem, getItem, removeItem } from './db.js';

export const SAVE_KEY = 'living_city_quicksave';

export async function saveGameState(worldSeed, player, timeController, questManagerOrDeltas = null, maybeDeltas = []) {
  const playerPos = player.getPosition();
  let questData = null;
  let deltas = [];

  if (Array.isArray(questManagerOrDeltas)) {
    deltas = questManagerOrDeltas;
  } else if (questManagerOrDeltas && typeof questManagerOrDeltas.serialize === 'function') {
    questData = questManagerOrDeltas.serialize();
    if (Array.isArray(maybeDeltas)) {
      deltas = maybeDeltas;
    }
  }

  const state = {
    version: 2,
    worldSeed,
    player: {
      x: Math.round(playerPos.x * 100) / 100,
      y: Math.round(playerPos.y * 100) / 100,
      z: Math.round(playerPos.z * 100) / 100,
      mode: player.getMode()
    },
    simTime: timeController.getTime(),
    questData,
    timestamp: typeof Date !== 'undefined' ? Date.now() : 0,
    deltas
  };

  await setItem(SAVE_KEY, state);
  return state;
}

export async function loadGameState() {
  const state = await getItem(SAVE_KEY);
  return state;
}

export async function clearGameState() {
  await removeItem(SAVE_KEY);
}

