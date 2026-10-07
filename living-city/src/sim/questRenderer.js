import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

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

// Low-poly Dude Theft Wars Character Mesh for Quest Giver
function createDudeGiverMesh(shirtHex = 0xff0054, hatHex = 0xfee440) {
  const parts = [];

  // Torso
  const torso = new THREE.BoxGeometry(0.56, 0.68, 0.34);
  torso.translate(0, 0.96, 0);
  colorGeom(torso, shirtHex);
  parts.push(torso);

  // Head
  const head = new THREE.BoxGeometry(0.40, 0.40, 0.40);
  head.translate(0, 1.48, 0);
  colorGeom(head, 0xfcd34d);
  parts.push(head);

  // Sunglasses
  const shades = new THREE.BoxGeometry(0.42, 0.12, 0.12);
  shades.translate(0, 1.50, 0.18);
  colorGeom(shades, 0x09090b);
  parts.push(shades);

  // Cool Hat / Cap
  const cap = new THREE.BoxGeometry(0.44, 0.16, 0.44);
  cap.translate(0, 1.70, 0);
  colorGeom(cap, hatHex);
  parts.push(cap);

  const visor = new THREE.BoxGeometry(0.38, 0.04, 0.22);
  visor.translate(0, 1.64, 0.30);
  colorGeom(visor, 0x1e293b);
  parts.push(visor);

  // Legs & Jeans
  const legs = new THREE.BoxGeometry(0.46, 0.58, 0.24);
  legs.translate(0, 0.38, 0);
  colorGeom(legs, 0x1e3a8a);
  parts.push(legs);

  // Shoes
  const shoes = new THREE.BoxGeometry(0.50, 0.14, 0.34);
  shoes.translate(0, 0.07, 0.04);
  colorGeom(shoes, 0xdc2626);
  parts.push(shoes);

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(merged, mat);
}

// 3D Low-Poly Exclamation Mark (❗)
function createExclamationIcon() {
  const group = new THREE.Group();

  const barGeom = new THREE.BoxGeometry(0.18, 0.65, 0.18);
  barGeom.translate(0, 0.45, 0);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const barMesh = new THREE.Mesh(barGeom, barMat);
  group.add(barMesh);

  const dotGeom = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  dotGeom.translate(0, 0.05, 0);
  const dotMesh = new THREE.Mesh(dotGeom, barMat);
  group.add(dotMesh);

  return { group, barGeom, dotGeom, barMat };
}

// 3D Low-Poly Pizza Box Collectable
function createPizzaBoxMesh() {
  const parts = [];

  const box = new THREE.BoxGeometry(0.7, 0.12, 0.7);
  box.translate(0, 0.06, 0);
  colorGeom(box, 0xfafafa);
  parts.push(box);

  const logo = new THREE.BoxGeometry(0.4, 0.02, 0.4);
  logo.translate(0, 0.13, 0);
  colorGeom(logo, 0xef4444);
  parts.push(logo);

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(merged, mat);
}

// 3D Low-Poly Neon Briefcase Collectable
function createBriefcaseMesh() {
  const parts = [];

  const caseBody = new THREE.BoxGeometry(0.65, 0.45, 0.22);
  caseBody.translate(0, 0.22, 0);
  colorGeom(caseBody, 0x18181b);
  parts.push(caseBody);

  const neonStripe = new THREE.BoxGeometry(0.67, 0.08, 0.24);
  neonStripe.translate(0, 0.22, 0);
  colorGeom(neonStripe, 0x00f5d4);
  parts.push(neonStripe);

  const handle = new THREE.BoxGeometry(0.24, 0.14, 0.06);
  handle.translate(0, 0.48, 0);
  colorGeom(handle, 0xfacc15);
  parts.push(handle);

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(merged, mat);
}

// 3D Low-Poly Hacker Disc / Terminal Collectable
function createHackerDiscMesh() {
  const parts = [];

  const base = new THREE.CylinderGeometry(0.35, 0.35, 0.10, 8);
  base.translate(0, 0.05, 0);
  colorGeom(base, 0x8338ec);
  parts.push(base);

  const core = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 8);
  core.translate(0, 0.07, 0);
  colorGeom(core, 0x00ffcc);
  parts.push(core);

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(merged, mat);
}

export function createQuestRenderer(questManager) {
  const group = new THREE.Group();
  const quests = questManager.getQuests();

  const giverEntities = [];
  const shirtColors = [0xff007f, 0x00f5d4, 0x70e000, 0xfee440, 0x3a86ff, 0xfb5607];

  // 1. Instantiate Quest Giver NPCs with overhead floating icons
  quests.forEach((quest, i) => {
    const giverGroup = new THREE.Group();
    giverGroup.position.set(quest.giver.pos.x, 0, quest.giver.pos.z);

    const shirtColor = shirtColors[i % shirtColors.length];
    const characterMesh = createDudeGiverMesh(shirtColor, 0xef4444);
    giverGroup.add(characterMesh);

    // Floating Exclamation Icon
    const icon = createExclamationIcon();
    icon.group.position.set(0, 2.3, 0);
    giverGroup.add(icon.group);

    group.add(giverGroup);

    giverEntities.push({
      quest,
      group: giverGroup,
      icon,
      characterMesh
    });
  });

  // 2. Active Quest Prop
  const activePropGroup = new THREE.Group();
  activePropGroup.visible = false;
  group.add(activePropGroup);

  const pizzaMesh = createPizzaBoxMesh();
  const briefcaseMesh = createBriefcaseMesh();
  const hackerDiscMesh = createHackerDiscMesh();

  activePropGroup.add(pizzaMesh);
  activePropGroup.add(briefcaseMesh);
  activePropGroup.add(hackerDiscMesh);

  return {
    group,

    getNearbyInteractive(playerPos, maxDist = 3.5) {
      const activeQuest = questManager.getActiveQuest();
      const currentStage = questManager.getCurrentStage();

      // Check active quest objective stage prop/target first
      if (activeQuest && currentStage) {
        const dist = Math.hypot(playerPos.x - currentStage.target.x, playerPos.z - currentStage.target.z);
        if (dist <= (currentStage.radius || maxDist)) {
          return {
            type: 'quest_objective',
            quest: activeQuest,
            stage: currentStage,
            distance: dist,
            prompt: currentStage.prompt
          };
        }
      }

      // Check nearby quest givers
      for (let i = 0; i < giverEntities.length; i++) {
        const entity = giverEntities[i];
        const dist = Math.hypot(playerPos.x - entity.quest.giver.pos.x, playerPos.z - entity.quest.giver.pos.z);
        if (dist <= maxDist) {
          const isCompleted = questManager.isCompleted(entity.quest.id);
          const isCurrentActive = activeQuest && activeQuest.id === entity.quest.id;

          if (isCurrentActive) {
            return {
              type: 'quest_giver_active',
              quest: entity.quest,
              giver: entity.quest.giver,
              distance: dist,
              prompt: `Press [E] to Check in with ${entity.quest.giver.name}`
            };
          } else if (!isCompleted && !activeQuest) {
            return {
              type: 'quest_giver_available',
              quest: entity.quest,
              giver: entity.quest.giver,
              distance: dist,
              prompt: `Press [E] to Talk to ${entity.quest.giver.name} (${entity.quest.title})`
            };
          }
        }
      }

      return null;
    },

    update(time, deltaTime) {
      const activeQuest = questManager.getActiveQuest();
      const currentStage = questManager.getCurrentStage();

      // Update quest givers' overhead floating icons
      giverEntities.forEach((entity) => {
        const isCompleted = questManager.isCompleted(entity.quest.id);
        const isCurrentActive = activeQuest && activeQuest.id === entity.quest.id;

        if (isCompleted) {
          entity.icon.group.visible = false;
        } else if (isCurrentActive) {
          entity.icon.group.visible = true;
          entity.icon.barMat.color.setHex(0x38bdf8); // Cyan for active
        } else if (activeQuest) {
          entity.icon.group.visible = false; // Hide other givers when on a quest
        } else {
          entity.icon.group.visible = true;
          entity.icon.barMat.color.setHex(0xfacc15); // Yellow for available
        }

        if (entity.icon.group.visible) {
          entity.icon.group.position.y = 2.3 + Math.sin(time * 30 + entity.quest.seed) * 0.15;
          entity.icon.group.rotation.y += deltaTime * 2.0;
        }
      });

      // Update active quest prop in world
      if (activeQuest && currentStage && currentStage.prop) {
        activePropGroup.visible = true;
        activePropGroup.position.set(currentStage.target.x, 0.4 + Math.sin(time * 25) * 0.15, currentStage.target.z);
        activePropGroup.rotation.y += deltaTime * 2.5;

        pizzaMesh.visible = currentStage.prop === 'pizza_box';
        briefcaseMesh.visible = currentStage.prop === 'neon_briefcase';
        hackerDiscMesh.visible = currentStage.prop === 'hacker_disc';
      } else {
        activePropGroup.visible = false;
      }
    },

    dispose() {
      if (group.parent) group.parent.remove(group);
      giverEntities.forEach(e => {
        e.characterMesh.geometry.dispose();
        e.characterMesh.material.dispose();
        e.icon.barGeom.dispose();
        e.icon.dotGeom.dispose();
        e.icon.barMat.dispose();
      });
      pizzaMesh.geometry.dispose();
      pizzaMesh.material.dispose();
      briefcaseMesh.geometry.dispose();
      briefcaseMesh.material.dispose();
      hackerDiscMesh.geometry.dispose();
      hackerDiscMesh.material.dispose();
    }
  };
}
