import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Helper to assign RGB vertex colors to a geometry
export function colorGeom(geom, hex) {
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

// 1. Articulated Head with Facial Features, Eyes, Eyebrows, Mouth & Hair/Hats
export function createHeadGeometry() {
  const parts = [];

  // Base head skull (skin tone)
  const head = new THREE.BoxGeometry(0.36, 0.36, 0.36);
  colorGeom(head, 0xfcd34d); // Cartoon skin tone
  parts.push(head);

  // Left & Right Ears
  const earL = new THREE.BoxGeometry(0.04, 0.10, 0.08);
  earL.translate(-0.19, 0, 0);
  colorGeom(earL, 0xf59e0b);
  parts.push(earL);

  const earR = new THREE.BoxGeometry(0.04, 0.10, 0.08);
  earR.translate(0.19, 0, 0);
  colorGeom(earR, 0xf59e0b);
  parts.push(earR);

  // Left Eye (White sclera + dark pupil)
  const eyeScleraL = new THREE.BoxGeometry(0.09, 0.08, 0.02);
  eyeScleraL.translate(-0.09, 0.04, 0.185);
  colorGeom(eyeScleraL, 0xffffff);
  parts.push(eyeScleraL);

  const eyePupilL = new THREE.BoxGeometry(0.045, 0.045, 0.025);
  eyePupilL.translate(-0.09, 0.04, 0.19);
  colorGeom(eyePupilL, 0x0f172a);
  parts.push(eyePupilL);

  // Right Eye
  const eyeScleraR = new THREE.BoxGeometry(0.09, 0.08, 0.02);
  eyeScleraR.translate(0.09, 0.04, 0.185);
  colorGeom(eyeScleraR, 0xffffff);
  parts.push(eyeScleraR);

  const eyePupilR = new THREE.BoxGeometry(0.045, 0.045, 0.025);
  eyePupilR.translate(0.09, 0.04, 0.19);
  colorGeom(eyePupilR, 0x0f172a);
  parts.push(eyePupilR);

  // Eyebrows
  const browL = new THREE.BoxGeometry(0.10, 0.03, 0.02);
  browL.translate(-0.09, 0.11, 0.19);
  colorGeom(browL, 0x451a03);
  parts.push(browL);

  const browR = new THREE.BoxGeometry(0.10, 0.03, 0.02);
  browR.translate(0.09, 0.11, 0.19);
  colorGeom(browR, 0x451a03);
  parts.push(browR);

  // Nose
  const nose = new THREE.BoxGeometry(0.05, 0.07, 0.04);
  nose.translate(0, -0.01, 0.19);
  colorGeom(nose, 0xf59e0b);
  parts.push(nose);

  // Smiling Mouth
  const mouth = new THREE.BoxGeometry(0.12, 0.03, 0.02);
  mouth.translate(0, -0.10, 0.185);
  colorGeom(mouth, 0xd97706);
  parts.push(mouth);

  // Hair / Backward Cap (Stylized Dude style)
  const hair = new THREE.BoxGeometry(0.38, 0.14, 0.40);
  hair.translate(0, 0.16, -0.01);
  colorGeom(hair, 0xef4444); // Crimson snapback
  parts.push(hair);

  const visor = new THREE.BoxGeometry(0.34, 0.03, 0.18);
  visor.translate(0, 0.11, -0.26);
  colorGeom(visor, 0x1e293b); // Dark visor
  parts.push(visor);

  const headGeom = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return headGeom;
}

// 2. Torso with Clothing, Collar, Pocket, Belt & Buckle
export function createTorsoGeometry() {
  const parts = [];

  // Main Torso / Hoodie (White base so instance color tints it)
  const torso = new THREE.BoxGeometry(0.48, 0.58, 0.28);
  colorGeom(torso, 0xffffff);
  parts.push(torso);

  // Neck
  const neck = new THREE.BoxGeometry(0.16, 0.10, 0.16);
  neck.translate(0, 0.32, 0);
  colorGeom(neck, 0xfcd34d);
  parts.push(neck);

  // Front Hoodie Pocket / Graphic
  const pocket = new THREE.BoxGeometry(0.34, 0.18, 0.04);
  pocket.translate(0, -0.08, 0.15);
  colorGeom(pocket, 0xf1f5f9);
  parts.push(pocket);

  // Waistband / Belt
  const belt = new THREE.BoxGeometry(0.49, 0.08, 0.29);
  belt.translate(0, -0.26, 0);
  colorGeom(belt, 0x1e293b);
  parts.push(belt);

  // Golden Belt Buckle
  const buckle = new THREE.BoxGeometry(0.10, 0.06, 0.03);
  buckle.translate(0, -0.26, 0.15);
  colorGeom(buckle, 0xfbbf24);
  parts.push(buckle);

  const torsoGeom = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return torsoGeom;
}

// 3. Articulated Arm (Pivoting from shoulder at 0, 0, 0)
export function createArmGeometry(isLeft = true) {
  const parts = [];
  const side = isLeft ? -1 : 1;

  // Shoulder sleeve (tints with shirt color)
  const sleeve = new THREE.BoxGeometry(0.14, 0.20, 0.14);
  sleeve.translate(0, -0.10, 0);
  colorGeom(sleeve, 0xffffff);
  parts.push(sleeve);

  // Forearm (skin tone)
  const forearm = new THREE.BoxGeometry(0.12, 0.22, 0.12);
  forearm.translate(0, -0.29, 0);
  colorGeom(forearm, 0xfcd34d);
  parts.push(forearm);

  // Hand (skin tone)
  const hand = new THREE.BoxGeometry(0.11, 0.11, 0.11);
  hand.translate(0, -0.44, 0);
  colorGeom(hand, 0xfcd34d);
  parts.push(hand);

  // Thumb
  const thumb = new THREE.BoxGeometry(0.04, 0.06, 0.05);
  thumb.translate(side * 0.06, -0.42, 0.03);
  colorGeom(thumb, 0xfcd34d);
  parts.push(thumb);

  const armGeom = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return armGeom;
}

// 4. Articulated Leg with Denim Jeans & Chunky Sneakers (Pivoting from hip at 0, 0, 0)
export function createLegGeometry(isLeft = true) {
  const parts = [];

  // Upper Thigh (Denim jeans)
  const thigh = new THREE.BoxGeometry(0.18, 0.28, 0.18);
  thigh.translate(0, -0.14, 0);
  colorGeom(thigh, 0x1e3a8a);
  parts.push(thigh);

  // Lower Calf (Denim jeans)
  const calf = new THREE.BoxGeometry(0.16, 0.26, 0.16);
  calf.translate(0, -0.39, 0);
  colorGeom(calf, 0x1e3a8a);
  parts.push(calf);

  // Sneaker Upper (Sporty red)
  const shoe = new THREE.BoxGeometry(0.18, 0.12, 0.28);
  shoe.translate(0, -0.56, 0.04);
  colorGeom(shoe, 0xdc2626);
  parts.push(shoe);

  // Sneaker Crisp White Sole
  const sole = new THREE.BoxGeometry(0.20, 0.05, 0.30);
  sole.translate(0, -0.62, 0.04);
  colorGeom(sole, 0xffffff);
  parts.push(sole);

  // White Laces Detail
  const laces = new THREE.BoxGeometry(0.10, 0.03, 0.10);
  laces.translate(0, -0.50, 0.06);
  colorGeom(laces, 0xffffff);
  parts.push(laces);

  const legGeom = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return legGeom;
}
