import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { createBSPTree } from './bsp.js';
import { createRNG } from '../core/rng.js';

export const INTERIOR_WIDTH = 40;
export const INTERIOR_DEPTH = 40;
export const CEILING_HEIGHT = 3.4;
export const WALL_THICKNESS = 0.3;

// Helper to assign RGB vertex colors to a geometry
function colorGeom(geom, hex) {
  const c = new THREE.Color(hex);
  const count = geom.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geom;
}

// Helper to build a detailed, low-poly humanoid occupant for interior rooms
function addInteriorHuman(propsGeometries, x, y, z, yaw, options = {}) {
  const shirtColor = options.shirtColor || 0x2563eb;
  const hairColor = options.hairColor || 0xef4444;
  const skinColor = options.skinColor || 0xfcd34d;
  const pantsColor = options.pantsColor || 0x1e3a8a;
  const isSeated = !!options.isSeated;

  const parts = [];

  // Head (skull)
  const head = new THREE.BoxGeometry(0.36, 0.36, 0.36);
  head.translate(0, isSeated ? 1.15 : 1.45, 0);
  colorGeom(head, skinColor);
  parts.push(head);

  // Left & Right Eyes + Pupils
  const eyeL = new THREE.BoxGeometry(0.08, 0.08, 0.02);
  eyeL.translate(-0.09, isSeated ? 1.19 : 1.49, 0.185);
  colorGeom(eyeL, 0xffffff);
  parts.push(eyeL);

  const pupilL = new THREE.BoxGeometry(0.04, 0.04, 0.025);
  pupilL.translate(-0.09, isSeated ? 1.19 : 1.49, 0.19);
  colorGeom(pupilL, 0x0f172a);
  parts.push(pupilL);

  const eyeR = new THREE.BoxGeometry(0.08, 0.08, 0.02);
  eyeR.translate(0.09, isSeated ? 1.19 : 1.49, 0.185);
  colorGeom(eyeR, 0xffffff);
  parts.push(eyeR);

  const pupilR = new THREE.BoxGeometry(0.04, 0.04, 0.025);
  pupilR.translate(0.09, isSeated ? 1.19 : 1.49, 0.19);
  colorGeom(pupilR, 0x0f172a);
  parts.push(pupilR);

  // Eyebrows
  const browL = new THREE.BoxGeometry(0.09, 0.03, 0.02);
  browL.translate(-0.09, isSeated ? 1.26 : 1.56, 0.19);
  colorGeom(browL, 0x451a03);
  parts.push(browL);

  const browR = new THREE.BoxGeometry(0.09, 0.03, 0.02);
  browR.translate(0.09, isSeated ? 1.26 : 1.56, 0.19);
  colorGeom(browR, 0x451a03);
  parts.push(browR);

  // Nose & Mouth
  const nose = new THREE.BoxGeometry(0.05, 0.07, 0.03);
  nose.translate(0, isSeated ? 1.14 : 1.44, 0.19);
  colorGeom(nose, 0xf59e0b);
  parts.push(nose);

  const mouth = new THREE.BoxGeometry(0.12, 0.03, 0.02);
  mouth.translate(0, isSeated ? 1.05 : 1.35, 0.185);
  colorGeom(mouth, 0xd97706);
  parts.push(mouth);

  // Hair / Backward Cap
  const hair = new THREE.BoxGeometry(0.38, 0.14, 0.38);
  hair.translate(0, isSeated ? 1.31 : 1.61, -0.01);
  colorGeom(hair, hairColor);
  parts.push(hair);

  // Torso / Shirt
  const torso = new THREE.BoxGeometry(0.48, 0.58, 0.28);
  torso.translate(0, isSeated ? 0.72 : 0.95, 0);
  colorGeom(torso, shirtColor);
  parts.push(torso);

  // Arms & Hands
  if (isSeated) {
    const armL = new THREE.BoxGeometry(0.14, 0.14, 0.40);
    armL.translate(-0.30, 0.78, 0.20);
    colorGeom(armL, shirtColor);
    parts.push(armL);

    const handL = new THREE.BoxGeometry(0.12, 0.08, 0.12);
    handL.translate(-0.30, 0.76, 0.44);
    colorGeom(handL, skinColor);
    parts.push(handL);

    const armR = new THREE.BoxGeometry(0.14, 0.14, 0.40);
    armR.translate(0.30, 0.78, 0.20);
    colorGeom(armR, shirtColor);
    parts.push(armR);

    const handR = new THREE.BoxGeometry(0.12, 0.08, 0.12);
    handR.translate(0.30, 0.76, 0.44);
    colorGeom(handR, skinColor);
    parts.push(handR);

    // Seated Legs (Thighs forward, calves down)
    const thighL = new THREE.BoxGeometry(0.18, 0.18, 0.38);
    thighL.translate(-0.13, 0.46, 0.20);
    colorGeom(thighL, pantsColor);
    parts.push(thighL);

    const calfL = new THREE.BoxGeometry(0.16, 0.36, 0.16);
    calfL.translate(-0.13, 0.22, 0.38);
    colorGeom(calfL, pantsColor);
    parts.push(calfL);

    const shoeL = new THREE.BoxGeometry(0.18, 0.10, 0.26);
    shoeL.translate(-0.13, 0.05, 0.42);
    colorGeom(shoeL, 0xdc2626);
    parts.push(shoeL);

    const thighR = new THREE.BoxGeometry(0.18, 0.18, 0.38);
    thighR.translate(0.13, 0.46, 0.20);
    colorGeom(thighR, pantsColor);
    parts.push(thighR);

    const calfR = new THREE.BoxGeometry(0.16, 0.36, 0.16);
    calfR.translate(0.13, 0.22, 0.38);
    colorGeom(calfR, pantsColor);
    parts.push(calfR);

    const shoeR = new THREE.BoxGeometry(0.18, 0.10, 0.26);
    shoeR.translate(0.13, 0.05, 0.42);
    colorGeom(shoeR, 0xdc2626);
    parts.push(shoeR);
  } else {
    // Standing Arms
    const armL = new THREE.BoxGeometry(0.14, 0.52, 0.14);
    armL.translate(-0.31, 0.88, 0);
    colorGeom(armL, shirtColor);
    parts.push(armL);

    const handL = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    handL.translate(-0.31, 0.56, 0);
    colorGeom(handL, skinColor);
    parts.push(handL);

    const armR = new THREE.BoxGeometry(0.14, 0.52, 0.14);
    armR.translate(0.31, 0.88, 0);
    colorGeom(armR, shirtColor);
    parts.push(armR);

    const handR = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    handR.translate(0.31, 0.56, 0);
    colorGeom(handR, skinColor);
    parts.push(handR);

    // Standing Legs
    const legL = new THREE.BoxGeometry(0.18, 0.56, 0.18);
    legL.translate(-0.13, 0.38, 0);
    colorGeom(legL, pantsColor);
    parts.push(legL);

    const shoeL = new THREE.BoxGeometry(0.18, 0.10, 0.26);
    shoeL.translate(-0.13, 0.05, 0.04);
    colorGeom(shoeL, 0xdc2626);
    parts.push(shoeL);

    const legR = new THREE.BoxGeometry(0.18, 0.56, 0.18);
    legR.translate(0.13, 0.38, 0);
    colorGeom(legR, pantsColor);
    parts.push(legR);

    const shoeR = new THREE.BoxGeometry(0.18, 0.10, 0.26);
    shoeR.translate(0.13, 0.05, 0.04);
    colorGeom(shoeR, 0xdc2626);
    parts.push(shoeR);
  }

  const mergedHuman = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());

  if (yaw !== 0) {
    mergedHuman.rotateY(yaw);
  }
  mergedHuman.translate(x, y, z);
  propsGeometries.push(mergedHuman);
}

export function generateInterior(buildingSeed) {
  const rng = createRNG(buildingSeed);
  const bsp = createBSPTree(buildingSeed, INTERIOR_WIDTH, INTERIOR_DEPTH);

  const structureGeometries = [];
  const propsGeometries = [];
  const wallAABBs = [];

  const halfW = INTERIOR_WIDTH / 2;
  const halfD = INTERIOR_DEPTH / 2;

  // 1. Room Floors & Ceilings (Colored per room type for high contrast)
  const FLOOR_COLORS = {
    lobby: 0xc49a6c,        // Warm polished parquet oak
    office: 0x2563eb,       // Vibrant blue commercial carpet
    meeting_room: 0x991b1b, // Executive wine burgundy carpet
    break_room: 0xf1f5f9,   // Crisp white ceramic tile
    server_room: 0x0f172a,  // High-tech anti-static dark slate
    utility: 0x475569       // Steel gray industrial floor
  };

  bsp.leaves.forEach((room) => {
    const rx = room.x + room.w / 2;
    const rz = room.z + room.d / 2;
    const floorColor = FLOOR_COLORS[room.type] || 0xd97706;

    // Floor tile for this room
    const roomFloor = new THREE.BoxGeometry(room.w, 0.2, room.d);
    roomFloor.translate(rx, -0.1, rz);
    colorGeom(roomFloor, floorColor);
    structureGeometries.push(roomFloor);

    // Ceiling tile (clean bright off-white)
    const roomCeiling = new THREE.BoxGeometry(room.w, 0.2, room.d);
    roomCeiling.translate(rx, CEILING_HEIGHT + 0.1, rz);
    colorGeom(roomCeiling, 0xf8fafc);
    structureGeometries.push(roomCeiling);

    // Ceiling recessed light fixture panel in center of room
    const lightFixture = new THREE.BoxGeometry(Math.min(2.4, room.w - 2), 0.08, Math.min(1.4, room.d - 2));
    lightFixture.translate(rx, CEILING_HEIGHT - 0.04, rz);
    colorGeom(lightFixture, 0xfef08a); // Warm light glow
    structureGeometries.push(lightFixture);
  });

  // 2. Perimeter Outer Walls (Warm pastel wall with dark baseboard)
  const WALL_COLOR = 0xf5ebe0;       // Warm cream pastel wall
  const BASEBOARD_COLOR = 0x1e293b;  // Dark slate baseboard trim
  const BASEBOARD_H = 0.2;

  // North wall
  const northWall = new THREE.BoxGeometry(INTERIOR_WIDTH, CEILING_HEIGHT, WALL_THICKNESS);
  northWall.translate(0, CEILING_HEIGHT / 2, -halfD);
  colorGeom(northWall, WALL_COLOR);
  structureGeometries.push(northWall);

  const northBase = new THREE.BoxGeometry(INTERIOR_WIDTH, BASEBOARD_H, WALL_THICKNESS + 0.04);
  northBase.translate(0, BASEBOARD_H / 2, -halfD);
  colorGeom(northBase, BASEBOARD_COLOR);
  structureGeometries.push(northBase);

  wallAABBs.push({ minX: -halfW, maxX: halfW, minZ: -halfD - 0.2, maxZ: -halfD + 0.2, minY: 0, maxY: CEILING_HEIGHT });

  // South wall (with main entrance door opening at center z = halfD)
  const southWallL = new THREE.BoxGeometry((INTERIOR_WIDTH - 3.0) / 2, CEILING_HEIGHT, WALL_THICKNESS);
  southWallL.translate(-halfW + (INTERIOR_WIDTH - 3.0) / 4, CEILING_HEIGHT / 2, halfD);
  colorGeom(southWallL, WALL_COLOR);
  structureGeometries.push(southWallL);

  const southWallR = new THREE.BoxGeometry((INTERIOR_WIDTH - 3.0) / 2, CEILING_HEIGHT, WALL_THICKNESS);
  southWallR.translate(halfW - (INTERIOR_WIDTH - 3.0) / 4, CEILING_HEIGHT / 2, halfD);
  colorGeom(southWallR, WALL_COLOR);
  structureGeometries.push(southWallR);

  const southWallLintel = new THREE.BoxGeometry(3.0, CEILING_HEIGHT - 2.6, WALL_THICKNESS);
  southWallLintel.translate(0, 2.6 + (CEILING_HEIGHT - 2.6) / 2, halfD);
  colorGeom(southWallLintel, WALL_COLOR);
  structureGeometries.push(southWallLintel);

  // South baseboards
  const southBaseL = new THREE.BoxGeometry((INTERIOR_WIDTH - 3.0) / 2, BASEBOARD_H, WALL_THICKNESS + 0.04);
  southBaseL.translate(-halfW + (INTERIOR_WIDTH - 3.0) / 4, BASEBOARD_H / 2, halfD);
  colorGeom(southBaseL, BASEBOARD_COLOR);
  structureGeometries.push(southBaseL);

  const southBaseR = new THREE.BoxGeometry((INTERIOR_WIDTH - 3.0) / 2, BASEBOARD_H, WALL_THICKNESS + 0.04);
  southBaseR.translate(halfW - (INTERIOR_WIDTH - 3.0) / 4, BASEBOARD_H / 2, halfD);
  colorGeom(southBaseR, BASEBOARD_COLOR);
  structureGeometries.push(southBaseR);

  // East wall
  const eastWall = new THREE.BoxGeometry(WALL_THICKNESS, CEILING_HEIGHT, INTERIOR_DEPTH);
  eastWall.translate(halfW, CEILING_HEIGHT / 2, 0);
  colorGeom(eastWall, WALL_COLOR);
  structureGeometries.push(eastWall);

  const eastBase = new THREE.BoxGeometry(WALL_THICKNESS + 0.04, BASEBOARD_H, INTERIOR_DEPTH);
  eastBase.translate(halfW, BASEBOARD_H / 2, 0);
  colorGeom(eastBase, BASEBOARD_COLOR);
  structureGeometries.push(eastBase);

  wallAABBs.push({ minX: halfW - 0.2, maxX: halfW + 0.2, minZ: -halfD, maxZ: halfD, minY: 0, maxY: CEILING_HEIGHT });

  // West wall
  const westWall = new THREE.BoxGeometry(WALL_THICKNESS, CEILING_HEIGHT, INTERIOR_DEPTH);
  westWall.translate(-halfW, CEILING_HEIGHT / 2, 0);
  colorGeom(westWall, WALL_COLOR);
  structureGeometries.push(westWall);

  const westBase = new THREE.BoxGeometry(WALL_THICKNESS + 0.04, BASEBOARD_H, INTERIOR_DEPTH);
  westBase.translate(-halfW, BASEBOARD_H / 2, 0);
  colorGeom(westBase, BASEBOARD_COLOR);
  structureGeometries.push(westBase);

  wallAABBs.push({ minX: -halfW - 0.2, maxX: -halfW + 0.2, minZ: -halfD, maxZ: halfD, minY: 0, maxY: CEILING_HEIGHT });

  // 3. Partition Walls with Doorways from BSP hierarchy
  const PARTITION_COLOR = 0xe2ece9;  // Soft mint/sage interior wall
  const DOOR_FRAME_COLOR = 0x0f172a; // Dark frame casing around doorway

  function buildPartitionWalls(node) {
    if (node.children && node.children.length === 2) {
      const [childA, childB] = node.children;
      const doorway = childA.doorway;

      if (doorway) {
        if (doorway.orientation === 'vertical') {
          const splitX = doorway.x;
          const totalLen = node.d;
          const doorLen = 2.0;
          const segLen = (totalLen - doorLen) / 2;

          // Wall segment 1
          const seg1 = new THREE.BoxGeometry(WALL_THICKNESS, CEILING_HEIGHT, segLen);
          seg1.translate(splitX, CEILING_HEIGHT / 2, node.z + segLen / 2);
          colorGeom(seg1, PARTITION_COLOR);
          structureGeometries.push(seg1);

          const base1 = new THREE.BoxGeometry(WALL_THICKNESS + 0.04, BASEBOARD_H, segLen);
          base1.translate(splitX, BASEBOARD_H / 2, node.z + segLen / 2);
          colorGeom(base1, BASEBOARD_COLOR);
          structureGeometries.push(base1);

          wallAABBs.push({ minX: splitX - 0.2, maxX: splitX + 0.2, minZ: node.z, maxZ: node.z + segLen, minY: 0, maxY: CEILING_HEIGHT });

          // Wall segment 2
          const seg2 = new THREE.BoxGeometry(WALL_THICKNESS, CEILING_HEIGHT, segLen);
          seg2.translate(splitX, CEILING_HEIGHT / 2, node.z + segLen + doorLen + segLen / 2);
          colorGeom(seg2, PARTITION_COLOR);
          structureGeometries.push(seg2);

          const base2 = new THREE.BoxGeometry(WALL_THICKNESS + 0.04, BASEBOARD_H, segLen);
          base2.translate(splitX, BASEBOARD_H / 2, node.z + segLen + doorLen + segLen / 2);
          colorGeom(base2, BASEBOARD_COLOR);
          structureGeometries.push(base2);

          wallAABBs.push({ minX: splitX - 0.2, maxX: splitX + 0.2, minZ: node.z + segLen + doorLen, maxZ: node.z + totalLen, minY: 0, maxY: CEILING_HEIGHT });

          // Top Lintel above doorway
          const lintel = new THREE.BoxGeometry(WALL_THICKNESS, CEILING_HEIGHT - 2.4, doorLen);
          lintel.translate(splitX, 2.4 + (CEILING_HEIGHT - 2.4) / 2, node.z + segLen + doorLen / 2);
          colorGeom(lintel, PARTITION_COLOR);
          structureGeometries.push(lintel);

          // Door frame casing (top and sides)
          const frameTop = new THREE.BoxGeometry(WALL_THICKNESS + 0.06, 0.15, doorLen);
          frameTop.translate(splitX, 2.35, node.z + segLen + doorLen / 2);
          colorGeom(frameTop, DOOR_FRAME_COLOR);
          structureGeometries.push(frameTop);

          const frameSideL = new THREE.BoxGeometry(WALL_THICKNESS + 0.06, 2.4, 0.12);
          frameSideL.translate(splitX, 1.2, node.z + segLen + 0.06);
          colorGeom(frameSideL, DOOR_FRAME_COLOR);
          structureGeometries.push(frameSideL);

          const frameSideR = new THREE.BoxGeometry(WALL_THICKNESS + 0.06, 2.4, 0.12);
          frameSideR.translate(splitX, 1.2, node.z + segLen + doorLen - 0.06);
          colorGeom(frameSideR, DOOR_FRAME_COLOR);
          structureGeometries.push(frameSideR);
        } else {
          const splitZ = doorway.z;
          const totalLen = node.w;
          const doorLen = 2.0;
          const segLen = (totalLen - doorLen) / 2;

          // Wall segment 1
          const seg1 = new THREE.BoxGeometry(segLen, CEILING_HEIGHT, WALL_THICKNESS);
          seg1.translate(node.x + segLen / 2, CEILING_HEIGHT / 2, splitZ);
          colorGeom(seg1, PARTITION_COLOR);
          structureGeometries.push(seg1);

          const base1 = new THREE.BoxGeometry(segLen, BASEBOARD_H, WALL_THICKNESS + 0.04);
          base1.translate(node.x + segLen / 2, BASEBOARD_H / 2, splitZ);
          colorGeom(base1, BASEBOARD_COLOR);
          structureGeometries.push(base1);

          wallAABBs.push({ minX: node.x, maxX: node.x + segLen, minZ: splitZ - 0.2, maxZ: splitZ + 0.2, minY: 0, maxY: CEILING_HEIGHT });

          // Wall segment 2
          const seg2 = new THREE.BoxGeometry(segLen, CEILING_HEIGHT, WALL_THICKNESS);
          seg2.translate(node.x + segLen + doorLen + segLen / 2, CEILING_HEIGHT / 2, splitZ);
          colorGeom(seg2, PARTITION_COLOR);
          structureGeometries.push(seg2);

          const base2 = new THREE.BoxGeometry(segLen, BASEBOARD_H, WALL_THICKNESS + 0.04);
          base2.translate(node.x + segLen + doorLen + segLen / 2, BASEBOARD_H / 2, splitZ);
          colorGeom(base2, BASEBOARD_COLOR);
          structureGeometries.push(base2);

          wallAABBs.push({ minX: node.x + segLen + doorLen, maxX: node.x + totalLen, minZ: splitZ - 0.2, maxZ: splitZ + 0.2, minY: 0, maxY: CEILING_HEIGHT });

          // Top Lintel above doorway
          const lintel = new THREE.BoxGeometry(doorLen, CEILING_HEIGHT - 2.4, WALL_THICKNESS);
          lintel.translate(node.x + segLen + doorLen / 2, 2.4 + (CEILING_HEIGHT - 2.4) / 2, splitZ);
          colorGeom(lintel, PARTITION_COLOR);
          structureGeometries.push(lintel);

          // Door frame casing (top and sides)
          const frameTop = new THREE.BoxGeometry(doorLen, 0.15, WALL_THICKNESS + 0.06);
          frameTop.translate(node.x + segLen + doorLen / 2, 2.35, splitZ);
          colorGeom(frameTop, DOOR_FRAME_COLOR);
          structureGeometries.push(frameTop);

          const frameSideL = new THREE.BoxGeometry(0.12, 2.4, WALL_THICKNESS + 0.06);
          frameSideL.translate(node.x + segLen + 0.06, 1.2, splitZ);
          colorGeom(frameSideL, DOOR_FRAME_COLOR);
          structureGeometries.push(frameSideL);

          const frameSideR = new THREE.BoxGeometry(0.12, 2.4, WALL_THICKNESS + 0.06);
          frameSideR.translate(node.x + segLen + doorLen - 0.06, 1.2, splitZ);
          colorGeom(frameSideR, DOOR_FRAME_COLOR);
          structureGeometries.push(frameSideR);
        }
      }

      buildPartitionWalls(childA);
      buildPartitionWalls(childB);
    }
  }

  buildPartitionWalls(bsp.root);

  // 4. Procedural Room Props & Furniture (Stylized Low-Poly Models)
  bsp.leaves.forEach((room) => {
    const rx = room.x + room.w / 2;
    const rz = room.z + room.d / 2;
    const roomRng = createRNG(buildingSeed + Math.round(rx * 100 + rz));

    if (room.type === 'office') {
      // 1. Desk Tabletop + Metallic Legs
      const deskTop = new THREE.BoxGeometry(1.8, 0.08, 0.9);
      deskTop.translate(rx, 0.74, rz);
      colorGeom(deskTop, 0x92400e); // Warm oak wood
      propsGeometries.push(deskTop);

      const legOffsets = [
        [-0.8, -0.35], [0.8, -0.35],
        [-0.8, 0.35], [0.8, 0.35]
      ];
      legOffsets.forEach(([dx, dz]) => {
        const leg = new THREE.BoxGeometry(0.08, 0.7, 0.08);
        leg.translate(rx + dx, 0.35, rz + dz);
        colorGeom(leg, 0x1e293b);
        propsGeometries.push(leg);
      });

      // Modesty panel
      const panel = new THREE.BoxGeometry(1.6, 0.45, 0.04);
      panel.translate(rx, 0.45, rz - 0.35);
      colorGeom(panel, 0x78350f);
      propsGeometries.push(panel);

      wallAABBs.push({ minX: rx - 0.95, maxX: rx + 0.95, minZ: rz - 0.5, maxZ: rz + 0.5, minY: 0, maxY: 0.85 });

      // 2. Computer Monitor & Stand
      const standBase = new THREE.BoxGeometry(0.25, 0.02, 0.2);
      standBase.translate(rx, 0.79, rz - 0.1);
      colorGeom(standBase, 0x0f172a);
      propsGeometries.push(standBase);

      const standPole = new THREE.BoxGeometry(0.06, 0.25, 0.06);
      standPole.translate(rx, 0.9, rz - 0.1);
      colorGeom(standPole, 0x0f172a);
      propsGeometries.push(standPole);

      const screenFrame = new THREE.BoxGeometry(0.7, 0.42, 0.04);
      screenFrame.translate(rx, 1.05, rz - 0.1);
      colorGeom(screenFrame, 0x020617);
      propsGeometries.push(screenFrame);

      const screenGlass = new THREE.BoxGeometry(0.64, 0.36, 0.02);
      screenGlass.translate(rx, 1.05, rz - 0.08);
      colorGeom(screenGlass, 0x38bdf8); // Glowing bright cyan screen
      propsGeometries.push(screenGlass);

      // Keyboard & Mouse
      const keyboard = new THREE.BoxGeometry(0.45, 0.02, 0.15);
      keyboard.translate(rx, 0.79, rz + 0.15);
      colorGeom(keyboard, 0x334155);
      propsGeometries.push(keyboard);

      // 3. Ergonomic Office Chair
      const chairSeat = new THREE.BoxGeometry(0.5, 0.08, 0.45);
      chairSeat.translate(rx, 0.46, rz + 0.7);
      colorGeom(chairSeat, 0x2563eb); // Royal blue cushion
      propsGeometries.push(chairSeat);

      const chairBack = new THREE.BoxGeometry(0.46, 0.5, 0.08);
      chairBack.translate(rx, 0.72, rz + 0.9);
      colorGeom(chairBack, 0x1d4ed8);
      propsGeometries.push(chairBack);

      const chairPole = new THREE.BoxGeometry(0.08, 0.4, 0.08);
      chairPole.translate(rx, 0.2, rz + 0.7);
      colorGeom(chairPole, 0x0f172a);
      propsGeometries.push(chairPole);

      // 4. Potted Office Plant in corner
      const pot = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      pot.translate(rx - room.w / 2 + 0.8, 0.2, rz - room.d / 2 + 0.8);
      colorGeom(pot, 0xea580c); // Terracotta pot
      propsGeometries.push(pot);

      const plant = new THREE.BoxGeometry(0.6, 0.7, 0.6);
      plant.translate(rx - room.w / 2 + 0.8, 0.65, rz - room.d / 2 + 0.8);
      colorGeom(plant, 0x22c55e); // Lush green leaves
      propsGeometries.push(plant);

      // 5. Seated Office Worker at Computer Desk
      addInteriorHuman(propsGeometries, rx, 0, rz + 0.7, Math.PI, {
        isSeated: true,
        shirtColor: 0x2563eb,
        hairColor: 0x451a03,
        skinColor: 0xfcd34d
      });

    } else if (room.type === 'meeting_room') {
      // 1. Large Boardroom Conference Table
      const tableW = Math.min(3.6, room.w - 3);
      const tableD = Math.min(1.8, room.d - 3);

      const tableTop = new THREE.BoxGeometry(tableW, 0.1, tableD);
      tableTop.translate(rx, 0.74, rz);
      colorGeom(tableTop, 0x78350f); // Mahogany wood
      propsGeometries.push(tableTop);

      const ped1 = new THREE.BoxGeometry(0.4, 0.7, 0.8);
      ped1.translate(rx - tableW / 4, 0.35, rz);
      colorGeom(ped1, 0x1e293b);
      propsGeometries.push(ped1);

      const ped2 = new THREE.BoxGeometry(0.4, 0.7, 0.8);
      ped2.translate(rx + tableW / 4, 0.35, rz);
      colorGeom(ped2, 0x1e293b);
      propsGeometries.push(ped2);

      wallAABBs.push({ minX: rx - tableW / 2 - 0.1, maxX: rx + tableW / 2 + 0.1, minZ: rz - tableD / 2 - 0.1, maxZ: rz + tableD / 2 + 0.1, minY: 0, maxY: 0.85 });

      // 2. Executive Conference Chairs around table
      const chairOffsets = [
        [0, -tableD / 2 - 0.4], [0, tableD / 2 + 0.4],
        [-tableW / 3, -tableD / 2 - 0.4], [-tableW / 3, tableD / 2 + 0.4],
        [tableW / 3, -tableD / 2 - 0.4], [tableW / 3, tableD / 2 + 0.4]
      ];

      chairOffsets.forEach(([cx, cz]) => {
        const cSeat = new THREE.BoxGeometry(0.45, 0.08, 0.45);
        cSeat.translate(rx + cx, 0.45, rz + cz);
        colorGeom(cSeat, 0x1e293b);
        propsGeometries.push(cSeat);

        const cBack = new THREE.BoxGeometry(0.45, 0.45, 0.08);
        const bz = cz < 0 ? -0.2 : 0.2;
        cBack.translate(rx + cx, 0.68, rz + cz + bz);
        colorGeom(cBack, 0x0f172a);
        propsGeometries.push(cBack);
      });

      // 3. Wall Whiteboard
      const wbFrame = new THREE.BoxGeometry(2.4, 1.2, 0.06);
      wbFrame.translate(rx, 1.8, rz - room.d / 2 + 0.1);
      colorGeom(wbFrame, 0x0f172a);
      propsGeometries.push(wbFrame);

      const wbSurface = new THREE.BoxGeometry(2.2, 1.05, 0.02);
      wbSurface.translate(rx, 1.8, rz - room.d / 2 + 0.13);
      colorGeom(wbSurface, 0xffffff);
      propsGeometries.push(wbSurface);

      // 4. Meeting Attendees seated at table
      addInteriorHuman(propsGeometries, rx - tableW / 3, 0, rz - tableD / 2 - 0.35, 0, {
        isSeated: true,
        shirtColor: 0x10b981, // Emerald green shirt
        hairColor: 0xd97706,
        skinColor: 0xfde047
      });

      addInteriorHuman(propsGeometries, rx + tableW / 3, 0, rz + tableD / 2 + 0.35, Math.PI, {
        isSeated: true,
        shirtColor: 0xec4899, // Pink shirt
        hairColor: 0x1e293b,
        skinColor: 0xfcd34d
      });

    } else if (room.type === 'server_room') {
      // 1. High-Tech Server Rack Towers
      const rack1 = new THREE.BoxGeometry(1.0, 2.4, 1.0);
      rack1.translate(rx - 1.2, 1.2, rz);
      colorGeom(rack1, 0x0f172a); // Deep black chassis
      propsGeometries.push(rack1);

      // Server rack LED status lights
      const leds1 = new THREE.BoxGeometry(0.8, 2.0, 0.04);
      leds1.translate(rx - 1.2, 1.2, rz + 0.51);
      colorGeom(leds1, 0x10b981); // Bright emerald LEDs
      propsGeometries.push(leds1);

      wallAABBs.push({ minX: rx - 1.8, maxX: rx - 0.6, minZ: rz - 0.6, maxZ: rz + 0.6, minY: 0, maxY: 2.4 });

      const rack2 = new THREE.BoxGeometry(1.0, 2.4, 1.0);
      rack2.translate(rx + 1.2, 1.2, rz);
      colorGeom(rack2, 0x0f172a);
      propsGeometries.push(rack2);

      const leds2 = new THREE.BoxGeometry(0.8, 2.0, 0.04);
      leds2.translate(rx + 1.2, 1.2, rz + 0.51);
      colorGeom(leds2, 0x06b6d4); // Cyan LEDs
      propsGeometries.push(leds2);

      wallAABBs.push({ minX: rx + 0.6, maxX: rx + 1.8, minZ: rz - 0.6, maxZ: rz + 0.6, minY: 0, maxY: 2.4 });

      // Overhead yellow cable conduit tray
      const tray = new THREE.BoxGeometry(3.6, 0.15, 0.4);
      tray.translate(rx, 2.8, rz);
      colorGeom(tray, 0xf59e0b); // Warning yellow conduit
      propsGeometries.push(tray);

      // 2. IT Cyber Analyst / Engineer standing and checking the server racks
      addInteriorHuman(propsGeometries, rx, 0, rz, Math.PI / 2, {
        isSeated: false,
        shirtColor: 0x8b5cf6, // Cyber purple hoodie
        hairColor: 0x0f172a,
        skinColor: 0xfcd34d
      });

    } else if (room.type === 'break_room') {
      // 1. Kitchen Countertop with Sink
      const counterBase = new THREE.BoxGeometry(2.4, 0.85, 0.8);
      counterBase.translate(rx - 0.6, 0.425, rz - room.d / 2 + 0.6);
      colorGeom(counterBase, 0x1e293b);
      propsGeometries.push(counterBase);

      const counterTop = new THREE.BoxGeometry(2.5, 0.08, 0.85);
      counterTop.translate(rx - 0.6, 0.88, rz - room.d / 2 + 0.6);
      colorGeom(counterTop, 0xf8fafc); // White polished stone
      propsGeometries.push(counterTop);

      const sink = new THREE.BoxGeometry(0.6, 0.02, 0.4);
      sink.translate(rx - 0.6, 0.93, rz - room.d / 2 + 0.6);
      colorGeom(sink, 0x94a3b8); // Stainless steel sink
      propsGeometries.push(sink);

      wallAABBs.push({ minX: rx - 1.9, maxX: rx + 0.7, minZ: rz - room.d / 2 + 0.1, maxZ: rz - room.d / 2 + 1.1, minY: 0, maxY: 0.95 });

      // 2. Refrigerator
      const fridge = new THREE.BoxGeometry(0.9, 1.9, 0.85);
      fridge.translate(rx + 1.2, 0.95, rz - room.d / 2 + 0.6);
      colorGeom(fridge, 0xe2e8f0);
      propsGeometries.push(fridge);

      const fridgeHandle = new THREE.BoxGeometry(0.06, 0.6, 0.06);
      fridgeHandle.translate(rx + 0.85, 1.0, rz - room.d / 2 + 1.05);
      colorGeom(fridgeHandle, 0x0f172a);
      propsGeometries.push(fridgeHandle);

      wallAABBs.push({ minX: rx + 0.7, maxX: rx + 1.7, minZ: rz - room.d / 2 + 0.1, maxZ: rz - room.d / 2 + 1.1, minY: 0, maxY: 1.9 });

      // 3. Dining Table + Chairs
      const diningTable = new THREE.BoxGeometry(1.4, 0.75, 1.0);
      diningTable.translate(rx, 0.375, rz + 0.8);
      colorGeom(diningTable, 0xd97706);
      propsGeometries.push(diningTable);

      const c1 = new THREE.BoxGeometry(0.4, 0.45, 0.4);
      c1.translate(rx - 1.0, 0.225, rz + 0.8);
      colorGeom(c1, 0xef4444);
      propsGeometries.push(c1);

      const c2 = new THREE.BoxGeometry(0.4, 0.45, 0.4);
      c2.translate(rx + 1.0, 0.225, rz + 0.8);
      colorGeom(c2, 0xef4444);
      propsGeometries.push(c2);

      wallAABBs.push({ minX: rx - 0.8, maxX: rx + 0.8, minZ: rz + 0.2, maxZ: rz + 1.4, minY: 0, maxY: 0.8 });

      // 4. Citizens in Break Room
      addInteriorHuman(propsGeometries, rx - 0.6, 0, rz - room.d / 2 + 1.3, 0, {
        isSeated: false,
        shirtColor: 0xf59e0b, // Amber yellow shirt
        hairColor: 0xef4444,
        skinColor: 0xfcd34d
      });

      addInteriorHuman(propsGeometries, rx + 1.0, 0, rz + 0.8, -Math.PI / 2, {
        isSeated: true,
        shirtColor: 0x06b6d4, // Cyan shirt
        hairColor: 0x451a03,
        skinColor: 0xfde047
      });

    } else {
      // Lobby / Lounge / Living Room
      // 1. Plush Red Lounge Couch / Sofa
      const sofaBase = new THREE.BoxGeometry(2.2, 0.35, 0.9);
      sofaBase.translate(rx, 0.175, rz - 0.8);
      colorGeom(sofaBase, 0xd97706); // Wood frame
      propsGeometries.push(sofaBase);

      const sofaCushions = new THREE.BoxGeometry(2.0, 0.2, 0.8);
      sofaCushions.translate(rx, 0.42, rz - 0.8);
      colorGeom(sofaCushions, 0xef4444); // Vibrant cherry red cushions
      propsGeometries.push(sofaCushions);

      const sofaBack = new THREE.BoxGeometry(2.2, 0.55, 0.25);
      sofaBack.translate(rx, 0.65, rz - 1.15);
      colorGeom(sofaBack, 0xdc2626);
      propsGeometries.push(sofaBack);

      const sofaArmL = new THREE.BoxGeometry(0.2, 0.45, 0.9);
      sofaArmL.translate(rx - 1.05, 0.55, rz - 0.8);
      colorGeom(sofaArmL, 0xdc2626);
      propsGeometries.push(sofaArmL);

      const sofaArmR = new THREE.BoxGeometry(0.2, 0.45, 0.9);
      sofaArmR.translate(rx + 1.05, 0.55, rz - 0.8);
      colorGeom(sofaArmR, 0xdc2626);
      propsGeometries.push(sofaArmR);

      wallAABBs.push({ minX: rx - 1.2, maxX: rx + 1.2, minZ: rz - 1.4, maxZ: rz - 0.3, minY: 0, maxY: 0.9 });

      // Seated citizen relaxing on couch
      addInteriorHuman(propsGeometries, rx - 0.4, 0, rz - 0.7, 0, {
        isSeated: true,
        shirtColor: 0x10b981, // Emerald green shirt
        hairColor: 0x7c2d12,
        skinColor: 0xfcd34d
      });

      // 2. Coffee Table
      const coffeeTable = new THREE.BoxGeometry(1.2, 0.35, 0.6);
      coffeeTable.translate(rx, 0.175, rz + 0.1);
      colorGeom(coffeeTable, 0x78350f);
      propsGeometries.push(coffeeTable);

      // 3. Flat Screen TV & Media Console
      const tvStand = new THREE.BoxGeometry(2.0, 0.45, 0.5);
      tvStand.translate(rx, 0.225, rz + 1.6);
      colorGeom(tvStand, 0x1e293b);
      propsGeometries.push(tvStand);

      const tvBezel = new THREE.BoxGeometry(1.6, 0.9, 0.06);
      tvBezel.translate(rx, 1.0, rz + 1.6);
      colorGeom(tvBezel, 0x020617);
      propsGeometries.push(tvBezel);

      const tvScreen = new THREE.BoxGeometry(1.5, 0.8, 0.02);
      tvScreen.translate(rx, 1.0, rz + 1.56);
      colorGeom(tvScreen, 0x38bdf8); // Glowing bright screen
      propsGeometries.push(tvScreen);

      wallAABBs.push({ minX: rx - 1.1, maxX: rx + 1.1, minZ: rz + 1.3, maxZ: rz + 1.9, minY: 0, maxY: 1.5 });
    }
  });

  // 5. High-Visibility Exit Door & Emergency Exit Sign in the Lobby
  const exitDoorMarker = new THREE.BoxGeometry(2.4, 2.6, 0.15);
  exitDoorMarker.translate(0, 1.3, halfD - 0.08);
  colorGeom(exitDoorMarker, 0x10b981); // Glowing Emerald Exit Door
  propsGeometries.push(exitDoorMarker);

  // Overhead EXIT Sign
  const exitSignBox = new THREE.BoxGeometry(0.9, 0.35, 0.2);
  exitSignBox.translate(0, 2.8, halfD - 0.2);
  colorGeom(exitSignBox, 0x22c55e);
  propsGeometries.push(exitSignBox);

  // Merge geometries with vertex colors
  const mergedStructure = BufferGeometryUtils.mergeGeometries(structureGeometries, false);
  const mergedProps = propsGeometries.length > 0 ? BufferGeometryUtils.mergeGeometries(propsGeometries, false) : new THREE.BufferGeometry();

  structureGeometries.forEach((g) => g.dispose());
  propsGeometries.forEach((g) => g.dispose());

  const structureMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const propsMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

  const structureMesh = new THREE.Mesh(mergedStructure, structureMaterial);
  const propsMesh = new THREE.Mesh(mergedProps, propsMaterial);

  return {
    meshes: [structureMesh, propsMesh],
    exitDoor: { x: 0, y: 0, z: halfD - 1.0 },
    spawnPos: { x: 0, y: 0, z: halfD - 2.5 },
    wallAABBs,
    dispose() {
      mergedStructure.dispose();
      mergedProps.dispose();
      structureMaterial.dispose();
      propsMaterial.dispose();
    }
  };
}
