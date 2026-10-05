import * as THREE from 'three';

// Time controller for day/night cycle
// time ∈ [0, 1): 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk

export const CYCLE_SPEED = 1 / 600; // 10 real minutes = 24h cycle

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function createTimeController(cycleSpeed = CYCLE_SPEED) {
  let time = 0.3; // Start at morning (bright)
  let lastHour = Math.floor(time * 24);
  let paused = false;

  return {
    getTime() {
      return time;
    },
    getHour() {
      return Math.floor(time * 24);
    },
    isPaused() {
      return paused;
    },
    togglePause() {
      paused = !paused;
    },
    scrub(hours) {
      time += hours / 24;
      if (time < 0) time += 1;
      if (time >= 1.0) time -= 1.0;
    },
    update(deltaTime, onHourChange) {
      if (paused) return;

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

// Sky color keyframes (Dude Theft Wars vibrant arcade sky)
const skyColors = [
  { time: 0.0, color: new THREE.Color(0x0d1326) },   // midnight (stylish deep cartoon blue)
  { time: 0.22, color: new THREE.Color(0x481b5c) },  // early dawn purple
  { time: 0.28, color: new THREE.Color(0xff8844) },  // golden sunrise
  { time: 0.5, color: new THREE.Color(0x38bdf8) },   // noon (vibrant tropical cyan sky)
  { time: 0.72, color: new THREE.Color(0xff6b81) },  // sunset coral peach
  { time: 0.80, color: new THREE.Color(0x341f5c) },  // dusk violet
  { time: 1.0, color: new THREE.Color(0x0d1326) }    // midnight
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
  directionalLight.color.setHex(0xfff8db);
  directionalLight.intensity = Math.max(0, Math.sin(angle)) * 1.35;

  // HemisphereLight with vibrant cartoon ambient reflections
  const sunElevation = Math.sin(angle);
  const isNight = sunElevation < 0;

  if (isNight) {
    hemisphereLight.color.setHex(0x1e272e); // Stylized deep cartoon night sky
    hemisphereLight.groundColor.setHex(0x0c1017);
    hemisphereLight.intensity = 0.40; // High night visibility
  } else if (sunElevation < 0.3) {
    // Dawn/Dusk
    hemisphereLight.color.setHex(0xff8844);
    hemisphereLight.groundColor.setHex(0x574b90);
    hemisphereLight.intensity = 0.65;
  } else {
    // Day: Vibrant sky blue + lush lawn green ground bounce
    hemisphereLight.color.setHex(0x90e0ef);
    hemisphereLight.groundColor.setHex(0x52b788);
    hemisphereLight.intensity = 0.80;
  }
}

export function getWindowIntensity(time) {
  // Smoothstep window emissive based on sun elevation
  const angle = (time - 0.25) * Math.PI * 2;
  const sunElevation = Math.sin(angle);

  // Smoothstep from -0.1 to 0.2: fade windows in at dusk, out at dawn
  const nightWeight = 1.0 - smoothstep(-0.1, 0.2, sunElevation);

  return nightWeight * 0.85;
}
