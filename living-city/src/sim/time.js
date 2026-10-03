import * as THREE from 'three';

// Time controller for day/night cycle
// time ∈ [0, 1): 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk

export function createTimeController(cycleSpeed = 1 / 120) {
  let time = 0.3; // Start at morning (bright)
  let lastHour = Math.floor(time * 24);

  return {
    getTime() {
      return time;
    },
    getHour() {
      return Math.floor(time * 24);
    },
    update(deltaTime, onHourChange) {
      time += deltaTime * cycleSpeed;
      if (time >= 1.0) time -= 1.0;

      const currentHour = Math.floor(time * 24);
      if (currentHour !== lastHour && onHourChange) {
        onHourChange(currentHour);
        lastHour = currentHour;
      }
    }
  };
}

// Sky color keyframes
const skyColors = [
  { time: 0.0, color: new THREE.Color(0x0a0a1a) },   // midnight
  { time: 0.25, color: new THREE.Color(0xff8844) },  // dawn
  { time: 0.5, color: new THREE.Color(0x87ceeb) },   // noon
  { time: 0.75, color: new THREE.Color(0xff6633) },  // dusk
  { time: 1.0, color: new THREE.Color(0x0a0a1a) }    // midnight
];

function lerpColor(a, b, t) {
  return new THREE.Color().lerpColors(a, b, t);
}

export function getSkyColor(time) {
  for (let i = 0; i < skyColors.length - 1; i++) {
    const keyA = skyColors[i];
    const keyB = skyColors[i + 1];

    if (time >= keyA.time && time <= keyB.time) {
      const t = (time - keyA.time) / (keyB.time - keyA.time);
      return lerpColor(keyA.color, keyB.color, t);
    }
  }
  return skyColors[0].color;
}

export function updateLighting(time, directionalLight, hemisphereLight) {
  // Sun angle: dawn at horizon (0.25), noon at top (0.5)
  const angle = (time - 0.25) * Math.PI * 2;

  directionalLight.position.set(
    Math.cos(angle) * 500,
    Math.sin(angle) * 500,
    0
  );
  directionalLight.intensity = Math.max(0, Math.sin(angle));

  // HemisphereLight for ambient lighting
  const isNight = time < 0.25 || time > 0.75;
  if (isNight) {
    hemisphereLight.color.setHex(0x1a1a2e); // Dark blue sky
    hemisphereLight.groundColor.setHex(0x0a0a1a);
    hemisphereLight.intensity = 0.2;
  } else {
    hemisphereLight.color.setHex(0x87ceeb); // Day sky
    hemisphereLight.groundColor.setHex(0x4a4a4a);
    hemisphereLight.intensity = 0.5;
  }
}

export function getWindowIntensity(time) {
  const isNight = time < 0.25 || time > 0.75;
  return isNight ? 0.8 : 0.0;
}
