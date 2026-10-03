import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { createBSPTree } from './bsp.js';
import { createRNG } from '../core/rng.js';

export const INTERIOR_WIDTH = 40;
export const INTERIOR_DEPTH = 40;
export const CEILING_HEIGHT = 3.2;
export const WALL_THICKNESS = 0.3;

export function generateInterior(buildingSeed) {
  const rng = createRNG(buildingSeed);
  const bsp = createBSPTree(buildingSeed, INTERIOR_WIDTH, INTERIOR_DEPTH);

  const structureGeometries = [];
  const propsGeometries = [];
  const wallAABBs = [];

  // 1. Floor & Ceiling
  const floorGeom = new THREE.BoxGeometry(INTERIOR_WIDTH, 0.2, INTERIOR_DEPTH);
  floorGeom.translate(0, -0.1, 0);
  structureGeometries.push(floorGeom);

  const ceilingGeom = new THREE.BoxGeometry(INTERIOR_WIDTH, 0.2, INTERIOR_DEPTH);
  ceilingGeom.translate(0, CEILING_HEIGHT + 0.1, 0);
  structureGeometries.push(ceilingGeom);

  // 2. Perimeter Outer Walls
  const halfW = INTERIOR_WIDTH / 2;
  const halfD = INTERIOR_DEPTH / 2;

  // North wall
  const northWall = new THREE.BoxGeometry(INTERIOR_WIDTH, CEILING_HEIGHT, WALL_THICKNESS);
  northWall.translate(0, CEILING_HEIGHT / 2, -halfD);
  structureGeometries.push(northWall);
  wallAABBs.push({ minX: -halfW, maxX: halfW, minZ: -halfD - 0.2, maxZ: -halfD + 0.2, minY: 0, maxY: CEILING_HEIGHT });

  // South wall (with main entrance door opening at center z=halfD)
  const southWallL = new THREE.BoxGeometry((INTERIOR_WIDTH - 2.5) / 2, CEILING_HEIGHT, WALL_THICKNESS);
  southWallL.translate(-halfW + (INTERIOR_WIDTH - 2.5) / 4, CEILING_HEIGHT / 2, halfD);
  structureGeometries.push(southWallL);

  const southWallR = new THREE.BoxGeometry((INTERIOR_WIDTH - 2.5) / 2, CEILING_HEIGHT, WALL_THICKNESS);
  southWallR.translate(halfW - (INTERIOR_WIDTH - 2.5) / 4, CEILING_HEIGHT / 2, halfD);
  structureGeometries.push(southWallR);

  const southWallLintel = new THREE.BoxGeometry(2.5, CEILING_HEIGHT - 2.4, WALL_THICKNESS);
  southWallLintel.translate(0, 2.4 + (CEILING_HEIGHT - 2.4) / 2, halfD);
  structureGeometries.push(southWallLintel);

  // East wall
  const eastWall = new THREE.BoxGeometry(WALL_THICKNESS, CEILING_HEIGHT, INTERIOR_DEPTH);
  eastWall.translate(halfW, CEILING_HEIGHT / 2, 0);
  structureGeometries.push(eastWall);
  wallAABBs.push({ minX: halfW - 0.2, maxX: halfW + 0.2, minZ: -halfD, maxZ: halfD, minY: 0, maxY: CEILING_HEIGHT });

  // West wall
  const westWall = new THREE.BoxGeometry(WALL_THICKNESS, CEILING_HEIGHT, INTERIOR_DEPTH);
  westWall.translate(-halfW, CEILING_HEIGHT / 2, 0);
  structureGeometries.push(westWall);
  wallAABBs.push({ minX: -halfW - 0.2, maxX: -halfW + 0.2, minZ: -halfD, maxZ: halfD, minY: 0, maxY: CEILING_HEIGHT });

  // 3. Partition Walls with Doorways from BSP hierarchy
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
          structureGeometries.push(seg1);
          wallAABBs.push({ minX: splitX - 0.2, maxX: splitX + 0.2, minZ: node.z, maxZ: node.z + segLen, minY: 0, maxY: CEILING_HEIGHT });

          // Wall segment 2
          const seg2 = new THREE.BoxGeometry(WALL_THICKNESS, CEILING_HEIGHT, segLen);
          seg2.translate(splitX, CEILING_HEIGHT / 2, node.z + segLen + doorLen + segLen / 2);
          structureGeometries.push(seg2);
          wallAABBs.push({ minX: splitX - 0.2, maxX: splitX + 0.2, minZ: node.z + segLen + doorLen, maxZ: node.z + totalLen, minY: 0, maxY: CEILING_HEIGHT });

          // Lintel above door
          const lintel = new THREE.BoxGeometry(WALL_THICKNESS, CEILING_HEIGHT - 2.2, doorLen);
          lintel.translate(splitX, 2.2 + (CEILING_HEIGHT - 2.2) / 2, node.z + segLen + doorLen / 2);
          structureGeometries.push(lintel);
        } else {
          const splitZ = doorway.z;
          const totalLen = node.w;
          const doorLen = 2.0;
          const segLen = (totalLen - doorLen) / 2;

          // Wall segment 1
          const seg1 = new THREE.BoxGeometry(segLen, CEILING_HEIGHT, WALL_THICKNESS);
          seg1.translate(node.x + segLen / 2, CEILING_HEIGHT / 2, splitZ);
          structureGeometries.push(seg1);
          wallAABBs.push({ minX: node.x, maxX: node.x + segLen, minZ: splitZ - 0.2, maxZ: splitZ + 0.2, minY: 0, maxY: CEILING_HEIGHT });

          // Wall segment 2
          const seg2 = new THREE.BoxGeometry(segLen, CEILING_HEIGHT, WALL_THICKNESS);
          seg2.translate(node.x + segLen + doorLen + segLen / 2, CEILING_HEIGHT / 2, splitZ);
          structureGeometries.push(seg2);
          wallAABBs.push({ minX: node.x + segLen + doorLen, maxX: node.x + totalLen, minZ: splitZ - 0.2, maxZ: splitZ + 0.2, minY: 0, maxY: CEILING_HEIGHT });

          // Lintel above door
          const lintel = new THREE.BoxGeometry(doorLen, CEILING_HEIGHT - 2.2, WALL_THICKNESS);
          lintel.translate(node.x + segLen + doorLen / 2, 2.2 + (CEILING_HEIGHT - 2.2) / 2, splitZ);
          structureGeometries.push(lintel);
        }
      }

      buildPartitionWalls(childA);
      buildPartitionWalls(childB);
    }
  }

  buildPartitionWalls(bsp.root);

  // 4. Procedural Room Props
  bsp.leaves.forEach((room) => {
    const rx = room.x + room.w / 2;
    const rz = room.z + room.d / 2;

    if (room.type === 'office') {
      // Desk
      const desk = new THREE.BoxGeometry(1.6, 0.75, 0.8);
      desk.translate(rx, 0.375, rz);
      propsGeometries.push(desk);
      wallAABBs.push({ minX: rx - 0.8, maxX: rx + 0.8, minZ: rz - 0.4, maxZ: rz + 0.4, minY: 0, maxY: 0.8 });

      // Chair
      const chair = new THREE.BoxGeometry(0.5, 0.8, 0.5);
      chair.translate(rx, 0.4, rz + 0.6);
      propsGeometries.push(chair);

      // Monitor
      const monitor = new THREE.BoxGeometry(0.5, 0.35, 0.08);
      monitor.translate(rx, 0.75 + 0.175, rz);
      propsGeometries.push(monitor);
    } else if (room.type === 'meeting_room') {
      // Conference Table
      const table = new THREE.BoxGeometry(Math.min(3.2, room.w - 2), 0.75, Math.min(1.6, room.d - 2));
      table.translate(rx, 0.375, rz);
      propsGeometries.push(table);
      wallAABBs.push({ minX: rx - 1.6, maxX: rx + 1.6, minZ: rz - 0.8, maxZ: rz + 0.8, minY: 0, maxY: 0.8 });
    } else if (room.type === 'server_room') {
      // Server Racks
      const rack1 = new THREE.BoxGeometry(0.9, 2.2, 0.9);
      rack1.translate(rx - 1, 1.1, rz);
      propsGeometries.push(rack1);
      wallAABBs.push({ minX: rx - 1.45, maxX: rx - 0.55, minZ: rz - 0.45, maxZ: rz + 0.45, minY: 0, maxY: 2.2 });

      const rack2 = new THREE.BoxGeometry(0.9, 2.2, 0.9);
      rack2.translate(rx + 1, 1.1, rz);
      propsGeometries.push(rack2);
      wallAABBs.push({ minX: rx + 0.55, maxX: rx + 1.45, minZ: rz - 0.45, maxZ: rz + 0.45, minY: 0, maxY: 2.2 });
    }
  });

  // Exit door indicator in the lobby
  const exitDoorMarker = new THREE.BoxGeometry(2.0, 2.4, 0.15);
  exitDoorMarker.translate(0, 1.2, halfD - 0.1);
  propsGeometries.push(exitDoorMarker);

  // Merge geometries
  const mergedStructure = BufferGeometryUtils.mergeGeometries(structureGeometries, false);
  const mergedProps = propsGeometries.length > 0 ? BufferGeometryUtils.mergeGeometries(propsGeometries, false) : new THREE.BufferGeometry();

  structureGeometries.forEach((g) => g.dispose());
  propsGeometries.forEach((g) => g.dispose());

  const structureMaterial = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  const propsMaterial = new THREE.MeshLambertMaterial({ color: 0x667788 });

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
