import * as THREE from 'three';

export function createWaypointMarker() {
  const group = new THREE.Group();
  group.visible = false;

  // Glowing vertical beacon cylinder
  const pillarGeom = new THREE.CylinderGeometry(0.6, 0.6, 120, 16);
  pillarGeom.translate(0, 60, 0);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.65
  });
  const pillarMesh = new THREE.Mesh(pillarGeom, pillarMat);
  group.add(pillarMesh);

  // Floating diamond marker at top
  const diamondGeom = new THREE.OctahedronGeometry(2.0);
  const diamondMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
  const diamondMesh = new THREE.Mesh(diamondGeom, diamondMat);
  diamondMesh.position.y = 8;
  group.add(diamondMesh);

  let currentTarget = null;

  return {
    group,
    setTarget(pos, label = '') {
      currentTarget = { ...pos, label };
      group.position.set(pos.x, 0, pos.z);
      group.visible = true;
    },
    clear() {
      currentTarget = null;
      group.visible = false;
    },
    getTarget() {
      return currentTarget;
    },
    update(time) {
      if (!group.visible) return;
      diamondMesh.position.y = 8 + Math.sin(time * 24 * Math.PI * 2) * 1.0;
      diamondMesh.rotation.y += 0.03;
    },
    dispose() {
      pillarGeom.dispose();
      pillarMat.dispose();
      diamondGeom.dispose();
      diamondMat.dispose();
    }
  };
}
