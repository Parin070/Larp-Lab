import { generateChunkData } from './chunk.js';

export function searchBuildings(worldSeed, query, searchRadius = 3) {
  if (!query || query.trim().length === 0) return [];

  const cleanQuery = query.toLowerCase().trim();
  const results = [];

  // Search across chunks in radius
  for (let cz = -searchRadius; cz <= searchRadius; cz++) {
    for (let cx = -searchRadius; cx <= searchRadius; cx++) {
      const chunkBuildings = generateChunkData(worldSeed, cx, cz);

      for (let i = 0; i < chunkBuildings.length; i++) {
        const b = chunkBuildings[i];
        const matchAddress = b.address.toLowerCase().includes(cleanQuery);
        const matchId = b.id.toLowerCase().includes(cleanQuery);

        if (matchAddress || matchId) {
          results.push({
            id: b.id,
            address: b.address,
            cx: b.cx,
            cz: b.cz,
            x: b.x,
            z: b.z,
            height: b.height,
            door: b.door
          });

          if (results.length >= 10) return results; // Return top 10 matches
        }
      }
    }
  }

  return results;
}
