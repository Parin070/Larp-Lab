import { CELL_PITCH } from './city.js';

// Road network: roads are located at boundaries between 72m cells
// Intersections occur at (gx * 72, gz * 72)
export function getNearestIntersection(x, z) {
  const gx = Math.round(x / CELL_PITCH);
  const gz = Math.round(z / CELL_PITCH);
  return {
    gx,
    gz,
    x: gx * CELL_PITCH,
    z: gz * CELL_PITCH
  };
}

export function getLanePosition(gx, gz, targetGx, targetGz, progress, laneOffset = 2.0) {
  const startX = gx * CELL_PITCH;
  const startZ = gz * CELL_PITCH;
  const endX = targetGx * CELL_PITCH;
  const endZ = targetGz * CELL_PITCH;

  const dx = endX - startX;
  const dz = endZ - startZ;
  const len = Math.hypot(dx, dz) || 1;

  // Normal vector pointing right of movement direction
  const nx = -dz / len;
  const nz = dx / len;

  const curX = startX + dx * progress + nx * laneOffset;
  const curZ = startZ + dz * progress + nz * laneOffset;

  const angle = Math.atan2(dx, dz);

  return {
    x: curX,
    z: curZ,
    angle
  };
}

export function getNextIntersection(gx, gz, fromGx, fromGz, rng) {
  // Available cardinal neighbors excluding immediate U-turn if possible
  const neighbors = [
    { gx: gx + 1, gz: gz },
    { gx: gx - 1, gz: gz },
    { gx: gx, gz: gz + 1 },
    { gx: gx, gz: gz - 1 }
  ];

  const forwardNeighbors = neighbors.filter((n) => n.gx !== fromGx || n.gz !== fromGz);
  const choices = forwardNeighbors.length > 0 ? forwardNeighbors : neighbors;

  return rng.choice(choices);
}
