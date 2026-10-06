# Learning from Living City

A comprehensive technical and pedagogical guide to building a high-performance, deterministic browser 3D low-poly city and arcade sandbox game from scratch. Every subsystem explained: what it does, the core mathematical technique, why this approach was chosen, exact code references, and how to build it yourself.

---

## Table of Contents

1. [Seeded PRNG (mulberry32) and Why Determinism Matters](#1-seeded-prng-mulberry32-and-why-determinism-matters)
2. [Chunk Streaming, Static Geometry Merging, and Street Micro-Props](#2-chunk-streaming-static-geometry-merging-and-street-micro-props)
3. [InstancedMesh, Draw Call Budgeting, and Vertex-Colored Geometry Merging](#3-instancedmesh-draw-call-budgeting-and-vertex-colored-geometry-merging)
4. [The Window Shader Patch (onBeforeCompile, World-Space Tiling, instanceMatrix)](#4-the-window-shader-patch-onbeforecompile-world-space-tiling-instancematrix)
5. [Day/Night Cycle, Tropical Sky Palette, and ACES Filmic Tone Mapping](#5-daynight-cycle-tropical-sky-palette-and-aces-filmic-tone-mapping)
6. [Camera and Input Handling (Fly Camera, e.code, Stuck-Key Fix, Pointer Lock)](#6-camera-and-input-handling-fly-camera-ecode-stuck-key-fix-pointer-lock)
7. [Walk Mode, Gravity, and Spatial AABB Collision Resolution](#7-walk-mode-gravity-and-spatial-aabb-collision-resolution)
8. [BSP Interior Generation, Micro-Props, Multi-Point Lighting, and Scene Disposal](#8-bsp-interior-generation-micro-props-multi-point-lighting-and-scene-disposal)
9. [Road Graph, Arcade Traffic, and Composite Low-Poly NPC Simulation](#9-road-graph-arcade-traffic-and-composite-low-poly-npc-simulation)
10. [Search Index and IndexedDB Persistence](#10-search-index-and-indexeddb-persistence)
11. [Event Bus and System Decoupling](#11-event-bus-and-system-decoupling)
12. [Testing: What the Tests Prove and How Determinism is Tested in Node Without WebGL](#12-testing-what-the-tests-prove-and-how-determinism-is-tested-in-node-without-webgl)
13. [How the AI Worked on This (CLAUDE.md, Planning Gates, and Phase Governance)](#13-how-the-ai-worked-on-this-claudemd-planning-gates-and-phase-governance)
14. [Bugs We Hit and What They Taught (Post-Mortem Database)](#14-bugs-we-hit-and-what-they-taught-post-mortem-database)
15. [Prompting Lessons for Agentic Software Engineering](#15-prompting-lessons-for-agentic-software-engineering)
16. [Open-Source 3D Asset Ecosystems & Web Game Design Patterns](#16-open-source-3d-asset-ecosystems--web-game-design-patterns)
17. [The Road to a Low-Poly Sandbox Game: Phased Evolution Roadmap](#17-the-road-to-a-low-poly-sandbox-game-phased-evolution-roadmap)
18. [Web Game Security, Privacy, and Repository Hygiene](#18-web-game-security-privacy-and-repository-hygiene)
19. [Learning Path: Modern 3D Web Game Engineering Curriculum](#19-learning-path-modern-3d-web-game-engineering-curriculum)
20. [Glossary of Procedural Generation and 3D Game Engine Terminology](#20-glossary-of-procedural-generation-and-3d-game-engine-terminology)

---

## 1. Seeded PRNG (mulberry32) and Why Determinism Matters

### 1. What it does, in plain language
Generates random-looking numbers from an initial number or text called a **seed**. When given the same seed, it produces the exact same sequence of numbers every single time. Standard `Math.random()` is completely forbidden in this project.

### 2. The core technique or concept
In JavaScript, `Math.random()` pulls from system entropy (unpredictable hardware noise). A **pseudorandom number generator (PRNG)** is an algorithmic math formula: you give it an internal integer state, and each step mathematically scrambles that integer to output a float between `0.0` and `1.0`. **Determinism** means: `Seed + Code = Exact Same Result`. If player A and player B load seed `12345`, every building height, color, door position, tree placement, and NPC route is identical without transferring gigabytes of world geometry over the network.

### 3. Where it lives
- `src/core/rng.js` — `createRNG(seed)`, `hashString(str)`
- `src/world/chunk.js:12` — `generateChunkData(worldSeed, cx, cz)` (creates unique seeded RNG per chunk)
- `tests/determinism.test.js` — Vitest suite validating that city generation hashes match across runs

### 4. The key code idea
From `src/core/rng.js:12-20`:

```js
export function createRNG(seed = 12345) {
  let state = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);

  function next() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
```

- **Line 13:** If the seed is a string, hash it to a 32-bit integer via `hashString`. `>>> 0` ensures it is an unsigned 32-bit integer.
- **Line 15:** `next()` advances the internal state and returns a float in `[0, 1)`.
- **Line 16:** Adds the golden ratio constant `0x6D2B79F5` and forces 32-bit integer addition with `| 0`.
- **Lines 17-18:** Uses `Math.imul` (C-like 32-bit integer multiplication) and XOR shifts (`^`, `>>>`) to scramble bits (the avalanche effect).
- **Line 19:** Shifts unsigned and divides by `2^32` (`4294967296`) to normalize to `[0.0, 1.0)`.

### 5. Why this approach and not the obvious one
- **Avoids non-determinism:** `Math.random()` makes save files huge because you'd have to save every building coordinate instead of just saving the seed.
- **Zero dependencies:** External npm libraries (like `seedrandom`) add bundle weight and setup overhead; Mulberry32 is 8 lines of pure bitwise arithmetic.
- **High performance:** Runs millions of times per second with zero object allocation during iteration.

### 6. What to study
- **MDN Web Docs:** `Math.imul()`, Bitwise shift operators (`>>>`, `|`, `^`).
- **Topics to search:** "Mulberry32 PRNG", "Pseudorandom number generator determinism", "FNV-1a 32-bit hash algorithm".

### 7. Try it yourself
- **Hand exercise:** Implement a small function `rollDice(seed, count, sides)` using Mulberry32 that rolls `count` dice with `sides` faces and verify calling it twice with seed `42` yields the exact same roll array.
- **AI prompt:**
  > "Write a zero-dependency JavaScript module `rng.js` implementing a seeded PRNG using the Mulberry32 algorithm. It should support string or numeric seeds, `next()` returning [0, 1), `nextInt(min, max)`, and `choice(array)`. Include a simple string hashing function (FNV-1a or polynomial) to convert string seeds to 32-bit integers."

---

## 2. Chunk Streaming, Static Geometry Merging, and Street Micro-Props

### 1. What it does, in plain language
Divides the infinite city into a grid of 576m × 576m square tiles called **chunks** (each containing 8 × 8 = 64 building blocks). As the player moves, new chunks ahead are generated and loaded into the 3D scene, while distant chunks behind the player are deleted to keep memory usage low and frame rates at a smooth 60 FPS. Every chunk merges roads, dashed centerlines, crosswalks, sidewalks, lush grass lawns, low-poly pine trees, street lamps, and fire hydrants into a single mesh costing only 1 draw call.

### 2. The core technique or concept
- **Spatial Partitioning (Chunks):** Instead of generating a single massive city model that crashes mobile/laptop GPUs, the world is sliced into local coordinates `(cx, cz)`.
- **Pure Data Generator:** The function `generateChunkData` calculates building positions, heights, colors, addresses, and door locations as plain JavaScript objects without touching Three.js, WebGL, or the DOM.
- **Static Geometry Merging with Vertex Colors:** Instead of adding hundreds of individual Three.js meshes for road asphalt, white zebra stripes, yellow dashed lane dividers, raised concrete sidewalks, lawn slabs, multi-tiered green tree foliage, street lamps, and red fire hydrants, each piece has its RGB color assigned to its vertices using `colorGeom(geom, hex)`. All parts are then baked into a single `BufferGeometry` via `BufferGeometryUtils.mergeGeometries()`.
- **Independent Seed Hashing:** Each chunk's seed is computed by hashing `chunk_${worldSeed}_${cx}_${cz}`. This means chunk `(5, 2)` generates the exact same buildings whether the player walks there immediately or teleports there after visiting 100 other chunks.
- **Time-Sliced Action Queue:** Loading 25 chunks in a single frame causes a noticeable stutter (jank). The `chunkManager` queues loads and unloads, processing at most 1 chunk per animation frame.

### 3. Where it lives
- `src/world/chunk.js` — `generateChunkData(worldSeed, cx, cz)`, `createChunkMeshes(...)`, `CHUNK_SIZE = 576`, `CHUNK_CELLS = 8`
- `src/world/chunkManager.js` — `createChunkManager(...)`, `planChunkUpdates()`, `processQueue()`, shared `staticMaterial` with `vertexColors: true`

### 4. The key code idea
From `src/world/chunk.js:142-182`:

```js
// Assign RGB vertex colors to geometry before merging
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

// Merge asphalt, road markings, lawns, trees, and props into 1 static mesh
const mergedStatic = BufferGeometryUtils.mergeGeometries(staticGeometries, false);
const staticMesh = new THREE.Mesh(mergedStatic, sharedStaticMaterial);
```

- **Lines 142-152:** Iterates through all vertices in a geometry and assigns an RGB `Float32Array` attribute named `'color'`.
- **Lines 179-180:** Merges hundreds of distinct static elements (roads, trees, hydrants) into one unified geometry.
- **Line 181:** Renders the combined geometry using a single `MeshLambertMaterial({ vertexColors: true })` — reducing 200+ draw calls per chunk to exactly 1 draw call!

### 5. Why this approach and not the obvious one
- **Avoids sequential seed drift:** If chunks used one global RNG stream, visiting chunk A then B would produce different results than visiting chunk B then A. Chunk-hashed seeding eliminates sequence dependence.
- **Eliminates draw call bottlenecks:** Rendering trees, hydrants, sidewalks, and road markings as separate meshes would create 5,000+ draw calls and drop frame rates to <5 FPS. Merging geometries with vertex colors costs 1 draw call per chunk.
- **Prevents frame drops:** Processing at most 1 chunk per frame via `processQueue()` guarantees the main render loop stays under the 16.6ms budget.

### 6. What to study
- **Three.js Manual:** `BufferGeometryUtils.mergeGeometries`, `BufferAttribute`, Vertex Colors.
- **Articles / Topics to search:** "Infinite voxel / procedural terrain chunk streaming architecture", "Time-slicing expensive computations in requestAnimationFrame".

### 7. Try it yourself
- **Hand exercise:** Write a function `worldToChunk(x, z, chunkSize)` that converts arbitrary floating point world positions (including negative numbers) into integer chunk coordinates `(cx, cz)`.
- **AI prompt:**
  > "Create a 2D chunk streaming manager in vanilla JavaScript. Given a player position (x, y), chunk dimension (576 units), and load radius (2 chunks), maintain a Set of active chunks. When the player crosses chunk boundaries, compute chunks to load and unload, push them into an action queue, and process at most one load/unload per call to `update()`."

---

## 3. InstancedMesh, Draw Call Budgeting, and Vertex-Colored Geometry Merging

### 1. What it does, in plain language
Renders thousands of skyscrapers, dozens of detailed vehicles, and hordes of streetwear NPCs at a locked 60 FPS. Instead of creating thousands of separate 3D objects, `InstancedMesh` batches all instances of a model into a single GPU draw call. Multi-part models (characters with heads, sunglasses, baseball caps, shirts, jeans, and sneakers) are constructed from multiple boxes, merged into a single geometry with vertex colors, and then instanced.

### 2. The core technique or concept
A **draw call** is a command from JavaScript to the GPU: "draw this geometry with this material." Each draw call has overhead (state binding, uniform uploads, validation). Modern integrated GPUs start slowing down around 200-300 draw calls per frame.

**InstancedMesh** tells the GPU: "here is one geometry and one material, but draw it N times with different transforms (position, rotation, scale) and per-instance colors."

**The White Base-Color Multiplication Trick:**
When using `MeshLambertMaterial({ vertexColors: true })` with `InstancedMesh`, Three.js calculates the final surface color as:
$$\text{Final Color} = \text{Vertex Color} \times \text{Instance Color} \times \text{Material Color}$$
To allow cars and NPC shirts to be dynamically tinted with vibrant colors while letting sunglasses, baseball caps, skin tones, sneakers, headlights, and taillights keep their exact colors:
- Parts that should be dynamically tinted (car chassis, NPC torso/shirt) are assigned pure white vertex colors (`0xffffff`). Since multiplying by 1.0 preserves the color, `instancedMesh.setColorAt(i, shirtColor)` tints the shirt cleanly.
- Parts with fixed colors (e.g. skin `0xfcd34d`, black sunglasses `0x09090b`, denim jeans `0x1e3a8a`, red sneakers `0xdc2626`) are given their explicit vertex colors. When multiplied by the instance tint, they retain their distinct stylized appearance.

### 3. Where it lives
- `src/sim/npcRenderer.js:37-133` — Composite humanoid model geometry merging and instancing
- `src/sim/traffic.js:37-126` — Composite vehicle geometry merging and instancing
- `src/world/chunk.js:77-107` — Skyscraper building instancing (64 buildings per chunk)

### 4. The key code idea
From `src/sim/npcRenderer.js:37-124`:

```js
const parts = [];

// Torso / Shirt (tints with instance color)
const torso = new THREE.BoxGeometry(0.52, 0.65, 0.32);
torso.translate(0, 0.95, 0);
colorGeom(torso, 0xffffff); // White base for clean instance multiplication
parts.push(torso);

// Head (Stylized cartoon skin tone)
const head = new THREE.BoxGeometry(0.38, 0.38, 0.38);
head.translate(0, 1.45, 0);
colorGeom(head, 0xfcd34d);
parts.push(head);

// Sunglasses & Cap
const glasses = new THREE.BoxGeometry(0.40, 0.12, 0.10);
glasses.translate(0, 1.48, 0.18);
colorGeom(glasses, 0x09090b);
parts.push(glasses);

// Denim Jeans & Chunky Red Sneakers with White Soles
// ... (additional parts pushed to array)

const characterGeometry = BufferGeometryUtils.mergeGeometries(parts, false);
parts.forEach(p => p.dispose());

const characterMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const instancedMesh = new THREE.InstancedMesh(characterGeometry, characterMaterial, count);
```

- **Lines 40-44:** Assigns white base vertex color to the torso so that instance color tinting works.
- **Lines 46-56:** Creates skin head, dark shades, and backward cap with explicit vertex colors.
- **Lines 121-122:** Bakes all 14 body parts into a single `BufferGeometry` and disposes of intermediate sub-geometries.
- **Lines 124-125:** Creates a single `InstancedMesh` capable of rendering 100+ fully detailed humanoid NPCs in exactly 1 draw call!

### 5. Why this approach and not the obvious one
- **Zero draw-call explosion:** Rendering 80 NPCs with 14 separate meshes each would equal $80 \times 14 = 1,120$ draw calls per frame, crashing browser performance. Merging into an `InstancedMesh` reduces 1,120 draw calls to 1.
- **Memory efficiency:** One shared `characterGeometry` uses ~4 KB of VRAM, instanced across the scene.
- **No skeletal animation overhead:** Uses stylized low-poly composite boxes, avoiding expensive CPU-side matrix palette skinning.

### 6. What to study
- **Three.js Docs:** `InstancedMesh`, `Matrix4.compose()`, `setColorAt()`, `BufferGeometryUtils.mergeGeometries`.
- **Topics to search:** "GPU instancing in WebGL", "Vertex color multiplication in Three.js materials", "Draw call batching patterns".

### 7. Try it yourself
- **Hand exercise:** Write a small script that creates a table from 5 boxes (1 tabletop + 4 legs), colors the tabletop white and legs black via vertex colors, merges them, and creates an `InstancedMesh` of 50 tables with random tabletop colors.
- **AI prompt:**
  > "Show how to create a multi-part composite low-poly vehicle model in Three.js (chassis, cabin, tinted windshield, headlights, taillights, 4 wheels with hubcaps) using BoxGeometry and BufferGeometryUtils.mergeGeometries with per-vertex colors. Explain how setting the chassis vertex color to white allows dynamic paint tinting via `instancedMesh.setColorAt()`."

---

## 4. The Window Shader Patch (onBeforeCompile, World-Space Tiling, instanceMatrix)

### 1. What it does, in plain language
Draws glowing window grids across thousands of skyscraper instances at night. The windows tile cleanly every 4 meters regardless of how tall or wide each building is, without stretching textures or adding extra geometry. In addition, buildings are rendered with an expanded 12-color vibrant streetwear/sandbox palette.

### 2. The core technique or concept
- **Shader:** A small, fast program written in GLSL (OpenGL Shading Language) executed directly on GPU cores. Vertex shaders calculate 3D corner coordinates; fragment shaders calculate the color of each pixel.
- **`onBeforeCompile`:** A Three.js hook that allows modifying standard built-in shaders (like `MeshLambertMaterial`) by replacing GLSL code blocks before Three.js compiles them to GPU machine code.
- **World-Space Tiling:** Standard UV mapping maps `[0, 1]` across a geometry. When a 1m cube is scaled to 50m × 60m × 50m, standard UVs stretch by 60×. World-space tiling computes UVs from absolute 3D world coordinates (`vWorldPosition / 4.0`), ensuring window panes are always exactly 4m × 4m on every building.
- **`instanceMatrix` in Vertex Shader:** Because buildings use `InstancedMesh`, the vertex shader must multiply vertex coordinates by `instanceMatrix` to extract the true world-space position and un-skew the normals.
- **Dynamic Emissive Uniform:** During daytime `uNightIntensity` is `0.0` (windows dark); at dusk it smoothly transitions to `1.0` (windows emit warm yellow glow).
- **Framed Window Canvas Texture:** A procedural 64×64 canvas texture draws a deep slate window frame dividing four crisp white panes.

### 3. Where it lives
- `src/world/city.js:10-24` — `PALETTE` 12-color vibrant sandbox array
- `src/world/city.js:27-116` — `createBuildingMaterial()`, `createWindowTexture()`, `material.onBeforeCompile`

### 4. The key code idea
From `src/world/city.js:96-111`:

```glsl
#include <emissivemap_fragment>
// Only apply window emissive to side walls (abs(normal.y) <= 0.5)
float isWall = step(abs(vWorldNormal.y), 0.5);
float wallCoord = abs(vWorldNormal.x) > 0.5 ? vWorldPosition.z : vWorldPosition.x;
vec2 winUV = vec2(wallCoord / 4.0, vWorldPosition.y / 4.0);
vec4 winColor = texture2D(uWindowTexture, winUV);
totalEmissiveRadiance = emissive * winColor.rgb * isWall * uNightIntensity;
```

- **Line 97:** `step(abs(vWorldNormal.y), 0.5)` returns `1.0` for vertical walls and `0.0` for horizontal roofs and floors, preventing windows from rendering on rooftops.
- **Line 98:** Selects either world `Z` or `X` coordinate depending on which direction the wall faces.
- **Line 99:** Divides world coordinates by 4.0 meters so that 1 window texture repeats every 4 world units.
- **Line 100:** Samples the 64×64 window canvas texture at the calculated world UV.
- **Line 101:** Multiplies base emissive color (`0xffe599` warm yellow) by texture brightness, wall mask, and night intensity uniform.

### 5. Why this approach and not the obvious one
- **Avoids texture stretching:** Scaling geometry with standard UVs creates distorted, blurry windows. World-space projection guarantees uniform window scale everywhere.
- **Avoids separate window meshes:** Adding 20,000 separate window quad meshes would destroy frame rates.
- **Retains built-in Three.js lighting:** Writing a completely custom `RawShaderMaterial` would require manually writing Lambert lighting, fog, and shadows. `onBeforeCompile` gives the best of both worlds: Three.js's standard lighting pipeline plus custom window emission.

### 6. What to study
- **The Book of Shaders** (Patricio Gonzalez Vivo & Jen Lowe) — chapters on coordinates, patterns, and uniforms.
- **Three.js Docs:** `Material.onBeforeCompile`, `WebGLProgram`, custom uniforms.
- **Topics to search:** "Triplanar mapping / world space UVs in GLSL", "Three.js onBeforeCompile modify standard shader".

### 7. Try it yourself
- **Hand exercise:** Write a GLSL fragment snippet that uses `mod(vWorldPosition.y, 2.0)` to shade horizontal stripes on any 3D object without using mesh UVs.
- **AI prompt:**
  > "Show how to modify Three.js MeshLambertMaterial using `onBeforeCompile` in JavaScript. Inject custom GLSL to compute UVs from world position `(vWorldPosition.xz / 5.0)` and apply a procedural stripe pattern to the emissive output based on a `uTime` uniform."

---

## 5. Day/Night Cycle, Tropical Sky Palette, and ACES Filmic Tone Mapping

### 1. What it does, in plain language
Simulates a continuous 24-hour day/night cycle that lasts 10 real-world minutes. It moves the sun across the sky, transitions the sky through a vibrant 7-keyframe tropical color gradient (deep midnight navy, dawn purple, golden sunrise, noon tropical cyan, sunset coral peach, and dusk violet), and dynamically shifts ambient ground-bounce lighting.

### 2. The core technique or concept
- **Normalized Simulation Time:** Time is stored as a single float `time` in `[0.0, 1.0)`, where `0.0` = midnight, `0.25` = dawn (sunrise), `0.5` = noon, and `0.75` = dusk (sunset).
- **Sun Orbit (Trigonometry):** The sun's 3D position is calculated on a circle using `(Math.cos(angle) * 500, Math.sin(angle) * 500, 0)`. When `sin(angle) > 0`, the sun is above the horizon.
- **ACES Filmic Tone Mapping (`renderer.toneMapping = THREE.ACESFilmicToneMapping`):** Configured with exposure `1.15` in `src/core/renderer.js`. ACES Filmic tone mapping maps high dynamic range lighting into standard sRGB displays with smooth highlight rolloff and rich contrast, giving low-poly cartoon cities an eye-popping, vibrant aesthetic without clipping to flat white.
- **Dynamic Hemisphere Ambient Ground Bounce:** At midday, `HemisphereLight` emits sky blue from above (`0x90e0ef`) and lush lawn green bounce from below (`0x52b788`). At dusk/dawn, it shifts to warm sunrise orange and violet ground bounce. At night, it maintains a high-visibility slate floor (`0.40` intensity) so city streets remain readable.

### 3. Where it lives
- `src/core/renderer.js:14-16` — `ACESFilmicToneMapping` and `toneMappingExposure = 1.15`
- `src/sim/time.js` — `createTimeController()`, `getSkyColor(time)`, `updateLighting(...)`, `getWindowIntensity(time)`
- `src/main.js` — Day/night cycle animation loop integration

### 4. The key code idea
From `src/sim/time.js:52-60, 94-110`:

```js
// Sky color keyframes (Dude Theft Wars vibrant arcade sky)
const skyColors = [
  { time: 0.0, color: new THREE.Color(0x0d1326) },   // midnight (deep navy)
  { time: 0.22, color: new THREE.Color(0x481b5c) },  // early dawn purple
  { time: 0.28, color: new THREE.Color(0xff8844) },  // golden sunrise
  { time: 0.5, color: new THREE.Color(0x38bdf8) },   // noon (tropical cyan sky)
  { time: 0.72, color: new THREE.Color(0xff6b81) },  // sunset coral peach
  { time: 0.80, color: new THREE.Color(0x341f5c) },  // dusk violet
  { time: 1.0, color: new THREE.Color(0x0d1326) }    // midnight
];

// Dynamic hemisphere ground bounce
if (isNight) {
  hemisphereLight.color.setHex(0x1e272e);
  hemisphereLight.groundColor.setHex(0x0c1017);
  hemisphereLight.intensity = 0.40; // High night visibility
} else if (sunElevation < 0.3) {
  hemisphereLight.color.setHex(0xff8844);
  hemisphereLight.groundColor.setHex(0x574b90);
  hemisphereLight.intensity = 0.65;
} else {
  // Day: Vibrant sky blue + lush lawn green ground bounce
  hemisphereLight.color.setHex(0x90e0ef);
  hemisphereLight.groundColor.setHex(0x52b788);
  hemisphereLight.intensity = 0.80;
}
```

- **Lines 52-60:** 7 distinct color keyframes interpolated via `Color.lerpColors()`.
- **Lines 94-110:** Adapts ambient environment lighting across 3 distinct phases, creating realistic ground bounce light without expensive real-time global illumination shaders.

### 5. Why this approach and not the obvious one
- **Avoids hard color snaps:** Discrete `if (night)` checks cause jarring pops. Smooth trigonometric angles and lerping create seamless transitions.
- **Avoids unplayable pitch black:** In real cities without street lamps, nights are pitch black. A calibrated `HemisphereLight` baseline ensures gameplay visibility while preserving nighttime mood.
- **Cinematic contrast:** Standard linear tone mapping produces washed-out colors; ACES Filmic brings out saturated streetwear tones and crisp shadows.

### 6. What to study
- **Three.js Docs:** `DirectionalLight`, `HemisphereLight`, `ACESFilmicToneMapping`, `Color.lerpColors()`.
- **Topics to search:** "Day-night cycle math in game engines", "Tone mapping curves in WebGL", "Hemisphere ambient bounce lighting".

### 7. Try it yourself
- **Hand exercise:** Write a `smoothstep(min, max, value)` function in pure JS and test its output at `value = min`, `value = (min+max)/2`, and `value = max`.
- **AI prompt:**
  > "Create a day/night cycle module in Three.js with ACES Filmic tone mapping. It should animate a DirectionalLight sun along an orbital arc, interpolate sky background across 6 colorful keyframes (dawn, sunrise, tropical noon cyan, coral sunset, dusk violet, midnight navy), and adjust HemisphereLight ground reflection colors."

---

## 6. Camera and Input Handling (Fly Camera, e.code, Stuck-Key Fix, Pointer Lock)

### 1. What it does, in plain language
Allows the player to look around freely with the mouse and fly through the 3D city using WASD, Space (fly up), C (fly down), and Shift (boost speed). It captures the mouse cursor so it never leaves the screen, and prevents keys from getting stuck down when tabbing away or opening developer tools.

### 2. The core technique or concept
- **Pointer Lock API:** Calling `canvas.requestPointerLock()` hides the mouse cursor and delivers raw relative motion deltas (`movementX`, `movementY`) directly to the game without the cursor stopping at the edge of the monitor.
- **Euler Angles (`rotation.order = 'YXZ'`):** Camera rotation must apply Yaw (horizontal turn around world Y axis) before Pitch (looking up/down around local X axis). Without explicit `'YXZ'` order, pitch and yaw interfere with each other, causing the camera to uncomfortably tilt sideways.
- **Pitch Clamping:** The vertical look angle is clamped to `±1.55` radians (~89 degrees) to prevent the camera from flipping upside down at the zenith/nadir.
- **`e.code` vs `e.key`:** Standard `e.key` changes between `'w'` and `'W'` if Shift or CapsLock is pressed, and changes on AZERTY/Dvorak keyboards. `e.code === 'KeyW'` detects the physical hardware key location regardless of layout or modifier keys.
- **Stuck-Key Bug & Prevention:** If a player holds `W` and presses `Alt+Tab` or `Escape`, the browser loses focus and never fires the corresponding `keyup` event. When the player returns, they are permanently walking forward. Adding listeners to `window.addEventListener('blur', resetKeys)` and `document.addEventListener('pointerlockchange', ...)` ensures all key states are flushed the instant focus is lost.

### 3. Where it lives
- `src/core/input.js` — `createInput(canvas)`, `resetKeys()`, `onPointerLockChange()`, `consumeMouse()`
- `src/core/camera.js` — `createCamera()`, `updateCamera(camera, input, deltaTime)`

### 4. The key code idea
From `src/core/input.js:20-28, 65-68, 76`:

```js
const resetKeys = () => {
  keys.w = false;
  keys.a = false;
  keys.s = false;
  keys.d = false;
  keys.shift = false;
  keys.space = false;
  keys.c = false;
};

const onPointerLockChange = () => {
  mouse.locked = document.pointerLockElement === canvas;
  if (!mouse.locked) resetKeys();
};

window.addEventListener('blur', resetKeys);
```

- **Lines 20-28:** Explicitly clears all active directional flags to `false`.
- **Lines 65-68:** When pointer lock is exited (e.g., user presses Escape), immediately wipes held keys so movement halts.
- **Line 76:** Listens for browser window focus loss (`blur`) and flushes keys instantly.

### 5. Why this approach and not the obvious one
- **Avoids layout bugs:** Using `e.key` breaks controls for international players on European/French AZERTY keyboards. `e.code` guarantees WASD ergonomics everywhere.
- **Avoids stuck navigation:** Standard tutorials omit `blur` handling, causing the classic stuck-key bug in 90% of web games.
- **Decoupled input polling:** Accumulating mouse motion in `input.js` and clearing it atomically via `consumeMouse()` prevents frame-rate-dependent mouse sensitivity spikes.

### 6. What to study
- **MDN Web Docs:** "Pointer Lock API", "KeyboardEvent: code property", "Window: blur event".
- **Three.js Docs:** `Euler`, `PerspectiveCamera`, `Quaternion.applyQuaternion()`.
- **Topics to search:** "Euler angle gimbal lock and rotation order in 3D engines", "FPS mouse look camera in Three.js".

### 7. Try it yourself
- **Hand exercise:** Add `window.addEventListener('blur', () => console.log('Focus lost!'))` to a web page and verify it fires when clicking outside the tab or switching apps.
- **AI prompt:**
  > "Create a robust first-person fly camera controller for Three.js in vanilla JavaScript. Use the Pointer Lock API for mouse look with pitch clamped to ±89° and rotation order 'YXZ'. Use KeyboardEvent.code for WASD movement relative to camera yaw and Space/C for world-space altitude. Implement full stuck-key protection using blur and pointerlockchange events."

---

## 7. Walk Mode, Gravity, and Spatial AABB Collision Resolution

### 1. What it does, in plain language
When the player toggles walk mode (press `V`), gravity pulls them to ground level, they can jump, and they collide with building walls instead of flying through them. The collision system checks the 9 buildings immediately surrounding the player (a 3×3 grid) and prevents horizontal motion that would clip through walls.

### 2. The core technique or concept
- **AABB (Axis-Aligned Bounding Box):** Each building is represented as a rectangular box with `minX, maxX, minY, maxY, minZ, maxZ` bounds. The player is a 0.4m-radius cylinder that is 1.7m tall.
- **Spatial Query Optimization:** Instead of testing collision against 3,200 buildings per frame, the system computes which 72m×72m grid cell the player is standing in, then queries only the 9 buildings in that cell and its 8 neighbors.
- **Axis-Separated Resolution:** Horizontal movement is split into `X` and `Z` components. First resolve all X-axis collisions, then resolve all Z-axis collisions using the updated X position. This prevents corner-catching artifacts where sliding along a wall incorrectly stops vertical motion.
- **Collision Caching:** Calling `generateChunkData()` 60 times per second for 9 cells is wasteful. A least-recently-used (LRU) cache stores the last 50 generated chunks so repeated lookups return the cached data instantly.

### 3. Where it lives
- `src/core/physics.js` — `resolveCollision(...)`, `getNearbyBuildingAABBs(...)`, `chunkDataCache`
- `src/core/player.js:95-101` — Calls collision resolver with player position and desired velocity

### 4. The key code idea
From `src/core/physics.js:71-99`:

```js
export function resolveCollision(worldSeed, currentPos, desiredMove, radius = 0.4, height = 1.7) {
  const aabbs = getNearbyBuildingAABBs(worldSeed, currentPos.x, currentPos.z);
  let newX = currentPos.x + desiredMove.x;
  let newZ = currentPos.z + desiredMove.z;

  // 1. Resolve X axis
  for (let i = 0; i < aabbs.length; i++) {
    const box = aabbs[i];
    if (currentPos.y < box.maxY && currentPos.y + height > box.minY) {
      if (currentPos.z + radius > box.minZ && currentPos.z - radius < box.maxZ) {
        // Moving +X into box
        if (desiredMove.x > 0 && newX + radius > box.minX && currentPos.x + radius <= box.minX + 0.5) {
          newX = box.minX - radius;
        }
```

- **Line 72:** Fetches only the 9 buildings closest to the player via spatial hash lookup.
- **Line 73-74:** Computes the intended new position if movement were unconstrained.
- **Lines 77-78:** For each building, checks if the player's vertical bounds overlap the building's vertical bounds.
- **Line 79:** Checks if the player's Z extent overlaps the building's Z extent (2D rectangle test before applying X collision).
- **Lines 81-83:** If moving right (`desiredMove.x > 0`) and the new position would penetrate the building's left face, clamp `newX` to stop at the wall surface minus the player's radius.

### 5. Why this approach and not the obvious one
- **Avoids O(N) scaling disaster:** Testing 3,200 buildings every frame at 60 FPS = 192,000 collision checks per second, crushing mobile CPUs. The 3×3 spatial query reduces it to ~540 checks per second.
- **Avoids corner snagging:** Resolving both axes simultaneously causes the player to get stuck on building corners. Sequential axis-separated resolution lets the player slide smoothly along walls.
- **Avoids redundant generation:** Without caching, continuous movement re-generates the same chunk data hundreds of times. The LRU cache turns `O(chunks × frames)` into `O(unique chunks loaded)`.

### 6. What to study
- **Topics to search:** "AABB collision detection 3D", "Swept AABB vs discrete collision", "Spatial hashing for collision optimization".
- **Game Programming Patterns (Robert Nystrom):** Chapter on "Spatial Partition".

### 7. Try it yourself
- **Hand exercise:** Draw two 2D AABBs on graph paper and write out the boolean condition that detects whether they overlap on both axes.
- **AI prompt:**
  > "Write a 2D AABB collision resolver in JavaScript. Given a player position (x, y), desired velocity (dx, dy), player radius, and an array of rectangular obstacles with minX/maxX/minY/maxY, return the resolved position after sliding along walls. Resolve X-axis collisions first, then Z-axis using the updated X."

---

## 8. BSP Interior Generation, Micro-Props, Multi-Point Lighting, and Scene Disposal

### 1. What it does, in plain language
Allows the player to walk up to any building door and press `E` to step inside a rich, procedurally generated floor plan (lobbies, offices, meeting rooms, break rooms, server rooms). The interior features room-specific flooring, wall trims, door frame casings, ceiling light fixtures, and detailed furniture (desks with glowing cyan screens, ergonomic blue chairs, potted plants, mahogany boardroom tables with whiteboards, server rack towers with LED indicators and conduit trays, break room kitchen counters with sinks and fridges, lounge sofas with flat-screen TVs, and glowing emerald exit doors). When exiting, all assets are completely disposed of from GPU memory.

### 2. The core technique or concept
- **BSP (Binary Space Partitioning):** A recursive tree algorithm that takes a 40m × 40m bounding box and splits it into two smaller rectangles (alternating horizontal and vertical cuts between 40% and 60% of the dimension) down to 4 levels, generating realistic interconnected rooms.
- **Room-Type Flooring & Trims:** Distinct floor materials per room (polished parquet oak for lobby, royal blue carpet for offices, wine burgundy for meeting rooms, white ceramic tile for break rooms, anti-static dark slate for server rooms). Dark slate baseboard trims line every wall.
- **Doorway Cutouts, Lintels & Casings:** Partition walls feature a 2.0m doorway gap, horizontal lintel box overhead (2.4m clearance), and dark casing trim around all three edges.
- **Comprehensive AABB Prop Colliders:** Every desk, conference table, server rack, kitchen counter, refrigerator, and sofa registers its exact bounding box in `wallAABBs`, preventing the player from walking through furniture.
- **Multi-Point Lighting:** Central `PointLight` (1.5 intensity, 45m range) plus 4 corner fill `PointLight`s (0.8 intensity, 25m range) ensure sub-rooms are brightly illuminated without dark corners.
- **2-Draw-Call Interior Geometry Merging:** All architectural structures (floors, walls, baseboards, lintels, ceiling panels) merge into `structureMesh` with vertex colors (Draw call 1). All furniture and props merge into `propsMesh` with vertex colors (Draw call 2).
- **Zero-Leak Scene Swap & Disposal:** WebGL GPU buffers (VRAM) are not automatically garbage collected. Calling `geometry.dispose()`, `material.dispose()`, and removing point lights on exit prevents memory leaks.

### 3. Where it lives
- `src/interiors/bsp.js` — `createBSPTree(seed, width, depth, minRoomSize, maxDepth)`
- `src/interiors/interiorGenerator.js` — `generateInterior(buildingSeed)` (geometry merging, prop placement, wall & prop AABBs)
- `src/interiors/interiorScene.js` — `createInteriorScene(building)`, `dispose()`, multi-point lighting
- `src/main.js` — `KeyE` interaction listener swapping between exterior and interior scenes

### 4. The key code idea
From `src/interiors/interiorGenerator.js:273-352`:

```js
if (room.type === 'office') {
  // Desk Tabletop + Metallic Legs
  const deskTop = new THREE.BoxGeometry(1.8, 0.08, 0.9);
  deskTop.translate(rx, 0.74, rz);
  colorGeom(deskTop, 0x92400e); // Oak wood
  propsGeometries.push(deskTop);

  // Monitor Stand + Glowing Cyan Glass Screen
  const screenGlass = new THREE.BoxGeometry(0.64, 0.36, 0.02);
  screenGlass.translate(rx, 1.05, rz - 0.08);
  colorGeom(screenGlass, 0x38bdf8); // Bright cyan screen
  propsGeometries.push(screenGlass);

  // Ergonomic Blue Chair & Potted Office Plant
  // ...

  // Register exact AABB bounding box to prevent player clipping
  wallAABBs.push({
    minX: rx - 0.95, maxX: rx + 0.95,
    minZ: rz - 0.5, maxZ: rz + 0.5,
    minY: 0, maxY: 0.85
  });
}
```

- **Lines 275-279:** Builds desk components with warm wood vertex colors.
- **Lines 300-318:** Builds low-poly computer monitors with glowing cyan screens.
- **Lines 297-298:** Automatically calculates and registers the 3D AABB bounding box in `wallAABBs` so that the player controller's sliding physics collides with the desk.

### 5. Why this approach and not the obvious one
- **Avoids memory bloat:** Pre-generating 3,200 building interiors would eat gigabytes of RAM. Generating on-demand from `building.seed` takes <2 milliseconds only when the door is opened.
- **Prevents WebGL out-of-memory crashes:** Without rigorous `.dispose()` on exit, visiting 20 buildings leaks dozens of megabytes of GPU buffers until WebGL loses context and crashes.
- **Draw call optimization:** Geometry merging guarantees interior rendering costs only 2 draw calls.

### 6. What to study
- **Red Blob Games / RogueBasement:** "Dungeon Generation with Binary Space Partitioning (BSP)".
- **Three.js Manual:** "How to dispose of objects", `BufferGeometryUtils.mergeGeometries`.
- **Topics to search:** "WebGL memory management and disposal in Three.js", "Procedural architecture generation algorithms".

### 7. Try it yourself
- **Hand exercise:** Draw a 40×40 square on grid paper. Apply two vertical and two horizontal BSP splits and assign room types to each leaf cell.
- **AI prompt:**
  > "Write a JavaScript procedural room generator using Binary Space Partitioning (BSP). Given a building seed, width (40), depth (40), and max depth (4), recursively subdivide the floor plan into rooms. Return leaf rooms with dimensions, room types ('office', 'server_room', 'meeting_room', 'break_room'), doorway coordinates, and an array of 2D bounding boxes for all walls and furniture props."

---

## 9. Road Graph, Arcade Traffic, and Composite Low-Poly NPC Simulation

### 1. What it does, in plain language
Animates 64 composite low-poly cars driving along roads and 80 humanoid pedestrians walking between home and work buildings. Cars feature multi-part bodies with headlights, taillights, bumpers, rubber tires, and hubcaps. NPCs sport streetwear shirts, sunglasses, backward baseball caps, denim jeans, and chunky sneakers. NPCs follow closed-form daily schedules: commuting at 7 AM, working indoors until noon, eating lunch outside, returning to work, commuting home at 5:30 PM, and evening leisure walks. Indoor NPCs are culled without memory allocation.

### 2. The core technique or concept
- **Implicit Road Graph:** Roads aren't stored as data structures. The graph is computed on-the-fly: every intersection is at grid coordinate `(gx * 72m, gz * 72m)`, and each intersection has exactly 4 cardinal neighbor intersections.
- **Lane Offset Positioning:** Cars drive 2 meters to the right of the road centerline. `getLanePosition()` computes the perpendicular normal vector to the driving direction and applies a lateral offset.
- **Traffic Recycling:** When a car exits the player's 12-cell radius, it is teleported to a new random intersection near the player instead of being destroyed and recreated.
- **Closed-Form NPC Evaluation:** Instead of updating 80 NPC state machines every frame with pathfinding, `evaluateNPCPosition(npc, time)` is a pure function: given simulation time `t`, it calculates the exact `(x, z)` coordinate and state (`'home'`, `'work'`, `'commute_work'`, `'lunch'`) using math (linear interpolation between home and work positions during commute windows, circular path during lunch).
- **Near/Far Culling:** NPCs indoors are scaled to `(0, 0, 0)` and translated to `y = -100`, making them invisible without removing them from the `InstancedMesh`.

### 3. Where it lives
- `src/world/roadGraph.js` — `getNearestIntersection()`, `getLanePosition()`, `getNextIntersection()`
- `src/sim/traffic.js` — `createTrafficSystem(worldSeed, maxCars)`, car recycling loop, composite vehicle model
- `src/sim/npc.js` — `createNPCSchedule(npcSeed, worldSeed)`, `evaluateNPCPosition(npc, time)`
- `src/sim/npcRenderer.js` — `createNPCRenderer(...)`, composite humanoid character model, `InstancedMesh` update

### 4. The key code idea
From `src/sim/npc.js:52-62`:

```js
if (t < HOME_END || t >= LEISURE_END) {
  state = 'home';
  isOutdoor = false;
  x = npc.home.x;
  z = npc.home.z;
} else if (t < COMMUTE1_END) {
  state = 'commute_work';
  isOutdoor = true;
  const progress = (t - HOME_END) / (COMMUTE1_END - HOME_END);
  x = npc.home.x + (npc.work.x - npc.home.x) * progress;
  z = npc.home.z + (npc.work.z - npc.home.z) * progress;
```

- **Lines 52-56:** Between midnight and 7 AM (or after 10 PM), the NPC is at home and invisible (`isOutdoor = false`).
- **Lines 57-62:** Between 7:00 and 8:30 AM, the NPC is outdoors commuting. `progress` linearly interpolates from `0.0` (at home) to `1.0` (arrived at work).
- **Lines 61-62:** NPC world position is computed as `lerp(home, work, progress)`.

### 5. Why this approach and not the obvious one
- **Avoids A* pathfinding overhead:** Running 80 A* pathfinding queries per frame for pedestrians on a 72m grid road network would consume 15+ milliseconds per frame. Closed-form evaluation runs in microseconds.
- **Eliminates traffic jam logic:** Real traffic simulation with car-following models, lane merging, and collision avoidance is computationally expensive. Random intersection turns with recycling fakes believable traffic without physics.
- **Avoids loading 80 interior scenes:** Instead of rendering indoor NPCs inside building interiors (which aren't loaded), the system simply hides them.

### 6. What to study
- **Topics to search:** "Procedural NPC schedules and closed-form animation", "Traffic simulation without physics (arcade vs. realistic)", "Lane offset calculation using perpendicular normals".
- **Red Blob Games:** "Interpolation tricks for animation".

### 7. Try it yourself
- **Hand exercise:** Write a pure function `getNPCPosition(timeOfDay)` that returns `'home'` before 8 AM, linearly interpolates between home `(0, 0)` and work `(100, 50)` from 8-9 AM, and returns `'work'` after 9 AM.
- **AI prompt:**
  > "Create a closed-form NPC daily schedule evaluator in JavaScript. Given a normalized simulation time `t` in [0, 1) (0 = midnight), home coordinates, and work coordinates, return an object with state ('home', 'commute_work', 'work', 'lunch', 'commute_home', 'leisure'), position (x, z), and visibility flag. Commute from 7-8:30 AM and 5:30-7 PM with linear interpolation. Lunch 12-1 PM walking in a circle around the work building."

---

## 10. Search Index and IndexedDB Persistence

### 1. What it does, in plain language
Allows the player to press `K` or `/` to open a search modal, type a building address like "150 Ave 3", see matching results, and either set a glowing waypoint beacon or teleport instantly to that building. The game state (player position, simulation time, world seed) auto-saves to the browser's local disk every 30 seconds.

### 2. The core technique or concept
- **On-Demand Search (No Prebuilt Index):** Instead of pre-generating and storing all 64,000 buildings in memory, `searchBuildings()` calls `generateChunkData()` on-the-fly for chunks within a 3-chunk radius (~450 buildings) and filters by substring match.
- **IndexedDB (Structured Browser Storage):** IndexedDB is an asynchronous key-value database built into all modern browsers. Unlike `localStorage` (5 MB limit, synchronous, string-only), IndexedDB supports gigabytes of structured JSON objects and runs database queries on a background thread without blocking rendering.
- **In-Memory Fallback for Tests:** When running in Node.js (Vitest tests), `globalThis.indexedDB` is `undefined`. The `db.js` module detects this and silently falls back to a `Map()` in RAM, ensuring save/load tests pass without needing jsdom or fake-indexeddb polyfills.
- **Delta Compression (Future-Ready Architecture):** The save schema includes a `deltas` array field for storing only changes from the procedural base (e.g., "building `b_5_3_2_1` destroyed"). Currently unused, but designed in from the start for modifiable/destructible cities in later phases.

### 3. Where it lives
- `src/world/searchIndex.js` — `searchBuildings(worldSeed, query, searchRadius)`
- `src/save/db.js` — `setItem(key, value)`, `getItem(key)`, `removeItem(key)` with IndexedDB + in-memory fallback
- `src/save/saveManager.js` — `saveGameState(...)`, `loadGameState()`, `clearGameState()`
- `src/main.js` — Auto-save timer (every 30 seconds)

### 4. The key code idea
From `src/save/db.js:36-50`:

```js
export async function setItem(key, value) {
  const db = await openDB();
  if (!db) {
    memoryStore.set(key, JSON.parse(JSON.stringify(value)));
    return true;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
```

- **Line 37:** Attempts to open IndexedDB connection asynchronously.
- **Lines 38-41:** If `db` is `null` (Node.js environment), writes to an in-memory `Map` instead.
- **Lines 43-50:** Wraps IndexedDB's callback-based API in a modern `Promise` for `async/await` compatibility.
- **Line 45:** Opens a read-write transaction on the `'saves'` object store.
- **Line 47:** `store.put(value, key)` writes the JavaScript object directly (no `JSON.stringify` needed).

### 5. Why this approach and not the obvious one
- **Avoids localStorage quota errors:** `localStorage.setItem()` throws `QuotaExceededError` after 5-10 MB. IndexedDB handles hundreds of megabytes without issue.
- **Search performance:** Pre-building an index of 64,000 buildings costs 50+ MB of RAM. On-demand generation of 450 buildings takes 5 milliseconds and uses zero persistent memory.
- **Test compatibility:** Mocking IndexedDB in Node.js test runners is fragile. The in-memory fallback makes save/load tests trivial.

### 6. What to study
- **MDN Web Docs:** "IndexedDB API", "Using IndexedDB", "IDBObjectStore.put()".
- **Topics to search:** "localStorage vs IndexedDB comparison", "Async storage patterns in JavaScript".

### 7. Try it yourself
- **Hand exercise:** Open Chrome DevTools → Application tab → IndexedDB, and manually inspect the `living_city_db` database after saving the game.
- **AI prompt:**
  > "Write a zero-dependency IndexedDB wrapper in JavaScript with `async` functions `setItem(key, value)`, `getItem(key)`, and `removeItem(key)`. Detect when IndexedDB is unavailable (Node.js, old browsers) and fall back to an in-memory Map. Wrap IndexedDB callbacks in Promises for modern async/await syntax."

---

## 11. Event Bus and System Decoupling

### 1. What it does, in plain language
Acts as the central communication network for the entire game. Whenever anything noteworthy happens (the hour changes, chunks stream in, a player enters a building door, an NPC transitions from commute to work), an event is broadcast to all interested listeners without coupling systems together.

### 2. The core technique or concept
- **Publish-Subscribe (Pub/Sub):** Systems emit events without knowing who is listening. For example, `npcRenderer.js` doesn't know about UI components; it simply emits `npc_state_changed`, and any interested UI, audio, or analytics component receives it.
- **Strict Normalized Schema:** Every event conforms to `{ t, type, actorId, locationId, data }`. The timestamp `t` uses deterministic simulation time (`timeController.getTime()`), not `Date.now()`.
- **Wildcard Subscriptions (`'*'`):** The event bus allows subscribing to `'*'`, allowing diagnostic loggers to capture every event across all systems with a single listener.

### 3. Where it lives
- `src/events/bus.js` — `createEventBus(getTime)`
- `src/events/eventTypes.js` — String constants for all event types (`DOOR_ENTERED`, `CHUNK_LOADED`, `NPC_STATE_CHANGED`, etc.)

### 4. The key code idea
From `src/events/bus.js:20-30`:

```js
emit(type, detail = {}) {
  const event = {
    t: detail.t ?? getTime(),
    type,
    actorId: detail.actorId ?? null,
    locationId: detail.locationId ?? null,
    data: detail.data ?? {}
  };
  listeners.get(type)?.forEach(cb => cb(event));
  listeners.get('*')?.forEach(cb => cb(event));
}
```

- **Lines 21-27:** Automatically injects simulation time `t` and guarantees consistent object schema with fallback defaults.
- **Line 28:** Invokes all handlers registered specifically for `type`.
- **Line 29:** Invokes all wildcard (`'*'`) handlers.

### 5. Why this approach and not the obvious one
- **Eliminates spaghetti coupling:** Without an event bus, systems would directly import and call each other's UI update functions, creating tightly coupled, untestable code.
- **Enables deterministic forensics:** Using simulation time `t` instead of real wall-clock time ensures event logs can be replayed or evaluated in headless test environments.

### 6. What to study
- **Refactoring Guru:** "Observer Pattern / Publish-Subscribe".
- **Topics to search:** "Event-driven game architecture", "Decoupling systems with a central event bus".

### 7. Try it yourself
- **Hand exercise:** Write a minimal event bus in 15 lines of JavaScript with `.on()`, `.off()`, and `.emit()`, including a wildcard `'*'` listener.
- **AI prompt:**
  > "Create a publish-subscribe EventBus in vanilla JavaScript. Allow passing a timestamp generator function `getTime` in the constructor. Support emitting typed events with schema `{ t, type, actorId, locationId, data }`. Add support for a wildcard '*' listener that receives all events."

---

## 12. Testing: What the Tests Prove and How Determinism is Tested in Node Without WebGL

### 1. What it does, in plain language
Runs automated test suites in the terminal using Vitest (a fast Node.js test runner). The tests verify that the seeded RNG produces identical output across runs, that chunk generation is load-order independent, that collision resolvers prevent clipping through walls, and that IndexedDB persistence round-trips cleanly. Tests run in pure Node.js without requiring a browser, WebGL context, or DOM.

### 2. The core technique or concept
- **Unit Testing Pure Functions:** Functions like `generateChunkData()`, `createRNG()`, and `evaluateNPCPosition()` accept inputs and return plain JavaScript objects without touching the DOM, canvas, or Three.js renderer. These can be imported into Node.js and tested directly.
- **Determinism Hashing:** To verify that `generateChunkData(12345, 0, 0)` always produces the same 64 buildings, the test serializes the output array to JSON and hashes it using the FNV-1a algorithm. Two runs with the same seed must produce identical hashes.
- **Load-Order Independence Test:** Generates chunk `(5, 5)` then `(-2, 4)`, then in the reverse order `(-2, 4)` then `(5, 5)`. Asserts that the chunk `(5, 5)` data is byte-identical regardless of which order chunks were visited, proving chunk-hashed seeding works.
- **Headless Three.js (Geometry Only):** Three.js math utilities (`Matrix4`, `Vector3`, `BoxGeometry`) work in Node.js without WebGL. Tests create geometries and materials to verify no exceptions are thrown, then immediately `.dispose()` them.
- **Vitest (`npm test`):** Vitest automatically discovers all `*.test.js` files, runs them in parallel, and reports pass/fail.

### 3. Where it lives
- `tests/determinism.test.js` — Verifies same seed = same city hash, palette index bounds
- `tests/chunk.test.js` — Load-order independence, building count validation, mesh creation
- `tests/rng.test.js` — PRNG sequence determinism, `nextInt`/`nextFloat` ranges, `fork()` independence
- `tests/collision.test.js`, `tests/interiors.test.js`, `tests/npc.test.js`, `tests/search.test.js`, `tests/save.test.js`, `tests/bus.test.js`, `tests/time.test.js`

### 4. The key code idea
From `tests/determinism.test.js:6-27`:

```js
function hashCityData(data) {
  const str = JSON.stringify(data);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

test('same seed produces exact same city layout hash', () => {
  const rng1 = createRNG(12345);
  const city1 = generateCityData(rng1, 20);
  const hash1 = hashCityData(city1);

  const rng2 = createRNG(12345);
  const city2 = generateCityData(rng2, 20);
  const hash2 = hashCityData(city2);

  expect(hash1).toBe(hash2);
  expect(city1).toEqual(city2);
});
```

- **Lines 6-14:** Implements FNV-1a 32-bit hash: XORs each character code, multiplies by a prime constant, and returns a hexadecimal string. This creates an 8-character fingerprint of the entire city layout.
- **Lines 17-19:** Generates a 20×20 grid of buildings (400 total) from seed `12345` and hashes the resulting array.
- **Lines 21-23:** Repeats the process with the same seed.
- **Lines 25-26:** Asserts that both the hashes and deep object equality match exactly.

### 5. Why this approach and not the obvious one
- **Avoids browser automation overhead:** Tools like Puppeteer launch full Chrome instances, adding 5+ seconds of startup time per test run. Vitest runs in milliseconds.
- **Catches regressions early:** Without tests, refactoring the RNG or chunk generator could silently break determinism and go unnoticed.
- **No WebGL mocking needed:** Separating pure data generators (`generateChunkData`) from rendering (`createChunkMeshes`) means 90% of the logic is testable in Node.js without canvas polyfills.

### 6. What to study
- **Vitest Docs:** "Getting Started", "API Reference", "Expectations (expect)".
- **Topics to search:** "Unit testing pure functions in JavaScript", "Test-driven development (TDD) basics", "FNV hash algorithm".

### 7. Try it yourself
- **Hand exercise:** Run `npm test` in the project terminal and observe all 10 test suites passing.
- **AI prompt:**
  > "Write a Vitest test suite for a seeded PRNG. Test that: (1) same seed produces identical 10-value sequences, (2) different seeds produce different sequences, (3) `nextInt(10, 20)` always returns integers in [10, 20], (4) `fork()` creates an independent RNG, and (5) state can be saved and restored with `getState()` and `setState()`."

---

## 13. How the AI Worked on This (CLAUDE.md, Planning Gates, and Phase Governance)

### 1. What it does, in plain language
Describes the structured software development workflow used to build the entire Living City project. Instead of asking the AI to "build a 3D city game" in one giant vague prompt, the project used a disciplined engineering process governed by `CLAUDE.md`, explicit phase milestones, upfront planning, and incremental git commits.

### 2. The core technique or concept
- **`CLAUDE.md` as System Architecture Contract:** A markdown file in the project root defining hard rules, performance budgets (draw calls < 200, frame time < 16ms), forbidden patterns (`Math.random()` forbidden), stack constraints (no physics engine, vanilla JS + Three.js + Vite), and coding conventions. The AI reads this file before every turn.
- **Plan-First Rule:** Before writing any code for a feature touching more than 2 files, the AI must explore the codebase, formulate an implementation plan, show it to the user, and wait for approval. This eliminates wasted code churn.
- **Verification Gates Before Commits:** Every feature was validated with `npm test` (unit tests pass) and `npm run build` (Vite production bundle compiles with zero errors) before committing.
- **One Feature Per Commit:** Git commits are small, focused, and descriptive.

### 3. Where it lives
- `CLAUDE.md` — Project definition, architectural rules, performance constraints, and phase checklist
- Git commit log (`git log --oneline`) — Linear progression of features and theme overhauls

---

## 14. Bugs We Hit and What They Taught (Post-Mortem Database)

### 1. Vertex Color Instance Tinting Conflict (Theme Overhaul)
**What happened:** When rendering humanoid NPCs with vertex colors and setting shirt colors via `instancedMesh.setColorAt(i, shirtColor)`, the shirt colors appeared dark, muddy, and distorted.
**Root cause:** Three.js multiplies `vertexColor * instanceColor`. If the shirt torso box had a gray or blue vertex color, multiplying it by red caused mathematical color crushing.
**The fix:** Assigned pure white vertex colors (`0xffffff`) to the torso and arms. Since multiplying by 1.0 preserves the multiplier, `setColorAt` tints the shirts cleanly.
**Lesson learned:** Any mesh part intended for dynamic instance tinting must have white vertex colors (`0xffffff`).

---

### 2. Building Color Palette Index Bounds (Theme Overhaul)
**What happened:** Expanding the building color palette from 6 colors to 12 vibrant tones caused `tests/determinism.test.js` to fail.
**Root cause:** The test suite had a hardcoded assertion `expect(b.colorIndex).toBeLessThan(6)` reflecting the old 6-color palette.
**The fix:** Updated the RNG generator to `rng.nextInt(0, PALETTE.length - 1)` and updated the test suite to assert `< PALETTE.length`.
**Lesson learned:** Always derive test assertions from exported data constants (`PALETTE.length`) rather than hardcoding magic numbers.

---

### 3. Interior Prop Collision Clipping (Phase 3 Overhaul)
**What happened:** After adding desks, conference tables, and server racks to BSP interiors, the player walked right through them like ghosts.
**Root cause:** The collision system originally only added BSP partition walls to `wallAABBs`. Furniture meshes had no collision bounding boxes.
**The fix:** Added automatic bounding box registration in `wallAABBs` for every desk, table, server rack, kitchen counter, fridge, and lounge sofa.
**Lesson learned:** Visual props and physical collision volumes must be generated together in the same procedural loop.

---

### 4. Dark Sub-Rooms in BSP Interiors (Phase 3 Overhaul)
**What happened:** Sub-rooms in the corners of 40m × 40m BSP interiors were completely black at runtime.
**Root cause:** A single central point light attenuated before reaching corner rooms through partition doorways.
**The fix:** Added 4 corner fill `PointLight`s (0.8 intensity, 25m radius) in `interiorScene.js` to brightly light all rooms.
**Lesson learned:** Complex partitioned interior spaces require multi-point fill lighting.

---

### 5. Stuck Keys on Alt+Tab (Phase 1)
**What happened:** Holding `W` and pressing `Alt+Tab` left the character permanently walking forward.
**Root cause:** The browser does not fire `keyup` events when window focus is lost.
**The fix:** Added `window.addEventListener('blur', resetKeys)` and `document.addEventListener('pointerlockchange', resetKeys)`.
**Lesson learned:** Always handle `blur` and focus loss defensively in game input systems.

---

## 15. Prompting Lessons for Agentic Software Engineering

1. **Start with constraints, not features:** State what is forbidden (no external physics engines, no `Math.random()`, draw calls < 200).
2. **Demand planning for multi-file changes:** Ask the AI to explore and plan before generating code.
3. **Provide real error messages and stack traces:** Paste exact error lines rather than saying "it doesn't work."
4. **Verify one system before moving to the next:** Run `npm test` and `npm run build` after each milestone.
5. **Specify output format and scope explicitly:** Ask for concise, modular code matching the surrounding style.
6. **Request verification steps in the prompt:** Embed test expectations into the prompt itself.
7. **Ask for trade-offs, not just solutions:** Evaluate CPU, memory, and draw call impacts before picking algorithms.

---

## 16. Open-Source 3D Asset Ecosystems & Web Game Design Patterns

To evolve from procedural geometry primitives to richer, high-fidelity sandbox worlds, modern web game development leverages curated open-source 3D asset hubs and UI design systems:

### 1. Curated 3D Asset Hubs
- **Poimandres Market ([market.pmndrs.rs](https://market.pmndrs.rs))**: A curated, web-optimized 3D asset library created by the Poimandres open-source collective (creators of React Three Fiber and Drei). Assets are formatted in lightweight GLTF/GLB with Draco/Meshopt compression and integrate with [gltf.pmndrs.rs](https://gltf.pmndrs.rs) and `gltfjsx` for pipeline optimization.
- **Kenney.nl ([kenney.nl](https://kenney.nl))**: The gold standard of public domain (CC0) low-poly modular 3D assets. Offers modular kits:
  - *City & Suburban Kit*: Roads, sidewalks, traffic lights, and modular multi-story buildings.
  - *Furniture & Interior Kit*: Sofas, desks, kitchen units, doors, and partition walls.
  - *Mini Market & Food Kit*: Shelves, cash registers, shopping carts, and packaged goods.
  - *Car & Vehicle Kit*: Modular low-poly cars matching standard 1m grid scales.
- **Poly Pizza ([poly.pizza](https://poly.pizza)) & Quaternius**: Extensive libraries of CC0 low-poly props, arcade weapons, food items, and animated character rigs.

### 2. Modern Web Game UI Inspiration (21st.dev, Dribbble & Behance)
- **21st.dev ([21st.dev](https://21st.dev))**: Modern UI component directory for sleek dark glassmorphism, glowing HUD indicators, minimal health bars, and interactive inventory cards.
- **Dribbble & Behance Trends**:
  - *Floating Micro-UIs*: Speech bubbles showing animated emoji pictograms above NPCs' heads (☕ for coffee break, 💼 for going to work, 💤 for sleeping, 😱 for panic).
  - *Diegetic Sun/Clock Dial*: Circular HUD dial showing current hour, sun elevation, and rush-hour traffic phases.
  - *Diorama / Tilt-Shift Aesthetics*: Warm pastel palettes, soft ambient bounce lighting, and high-visibility shadows.

### 3. Procedural vs Asset-Kit Architecture
In `living-city`, we bridge pure procedural code with asset kits through two pipelines:
1. **Procedural Geometry Assembly (`BufferGeometryUtils` + Vertex Colors)**: Zero-dependency runtime generation of city blocks, roads, trees, cars, and humanoid characters using box primitives.
2. **GLTF Instancing & Batching (`THREE.BatchedMesh` / `THREE.InstancedMesh`)**: For external GLTF asset packs (e.g. Kenney Furniture Kit), models are converted to shared geometries and batched into single draw calls.

---

## 17. The Road to a Low-Poly Sandbox Game: Phased Evolution Roadmap

To evolve `living-city` into a full-fledged low-poly arcade sandbox game inspired by *Dude Theft Wars*, the development is structured into 5 modular, architecturally isolated phases:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      SANDBOX EVOLUTION ROADMAP                         │
├────────────────────────────────────────────────────────────────────────┤
│ Phase A: Interactive Interiors & Loot Economy                          │
│  - Lootable cash drawers, safes, and ATMs with interaction prompts     │
│  - Vending machines and coffee makers granting temporary speed boosts  │
│  - Interactive furniture (sitting on chairs/sofas, toggling TV video)  │
│  - Integrated modular props from Kenney Furniture / Market Kit         │
├────────────────────────────────────────────────────────────────────────┤
│ Phase B: Player Movement, Combat & Ragdoll Simulation                  │
│  - Sprint (Shift), crouch (Ctrl), and slide movement physics           │
│  - Punch/kick arcade melee combat with comedic knockback impulses      │
│  - Cartoon ragdoll physics on vehicle collisions or high falls         │
│  - Hit particles, screen shake, and Web Audio sound effects            │
├────────────────────────────────────────────────────────────────────────┤
│ Phase C: Drivable Arcade Vehicles                                      │
│  - Seamless enter/exit vehicle state machine ('KeyF' / 'KeyE')         │
│  - Arcade raycast vehicle kinematics (acceleration, drift, steering)   │
│  - Headlights toggle, horn audio, and retro radio stations             │
│  - Dynamic car damage (smoke particles, bumper detachment)             │
├────────────────────────────────────────────────────────────────────────┤
│ Phase D: NPC Reactions & Escalating Wanted System                      │
│  - Reactive NPC AI: Wander, Panic/Flee, Cower, Curiosity gathering     │
│  - Floating Dribbble-style emoji speech bubbles (😱, ☕, 💼, 💤)       │
│  - 1-to-5 Star Wanted Level state machine                              │
│  - Police cruiser spawning and grid pursuit AI                         │
├────────────────────────────────────────────────────────────────────────┤
│ Phase E: Modern Micro-UI & Diegetic HUD                                │
│  - 21st.dev-inspired dark glassmorphism HUD (health bar, cash counter) │
│  - Circular diegetic day/night time dial with rush-hour indicators     │
│  - Real-time GPS mini-map / radar with waypoint beacons and NPC blips  │
│  - Weapon/Tool radial selection menu                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 18. Web Game Security, Privacy, and Repository Hygiene

Building client-side web games requires strict security and privacy practices to protect player data and repository integrity:

1. **Zero Plaintext Secrets**:
   - Never embed private API keys, database credentials, server tokens, or private secrets in client-side JavaScript or HTML. Client code is completely public.
2. **Hardened `.gitignore` Configuration**:
   - Always maintain a strict `.gitignore` covering `.env`, `.env.*`, `*.key`, `*.pem`, `*.cert`, `*.pfx`, `id_rsa*`, `credentials.json`, `token.json`, `auth.json`, `secret*.json`, `*.log`, and editor files.
3. **Save Data Integrity & Sanitization**:
   - When loading saved games from IndexedDB or JSON imports, strictly validate data schemas. Never pass raw save properties to `eval()` or unescaped `innerHTML`.
4. **Deterministic Storage**:
   - Save only seeds, player coordinates, and delta modifications. Never store bloated or sensitive runtime objects.

---

## 19. Learning Path: Modern 3D Web Game Engineering Curriculum

If you want to build a similar 3D procedural sandbox game from scratch:

1. **JavaScript ES6 Modules & Bitwise Math (1-2 days)**: `import`/`export`, Mulberry32 bitwise operators (`Math.imul`, `>>>`, `|`).
2. **Three.js Scene Graph & Math (1 week)**: `Scene`, `PerspectiveCamera`, `Matrix4`, `Vector3`, `Quaternion`, `Euler` (YXZ rotation order).
3. **Geometry Batching & Vertex Colors (3-5 days)**: `BufferGeometryUtils.mergeGeometries`, `BufferAttribute`, vertex color encoding, and instance tint multiplication.
4. **GPU Instancing & Draw Call Optimization (3-5 days)**: `InstancedMesh`, `setColorAt`, `setMatrixAt`, draw call profiling with `renderer.info`.
5. **GLSL Shaders & onBeforeCompile (1 week)**: Custom uniforms, world-space UV projection, emissive window tiling, tone mapping.
6. **Procedural Architecture & BSP Trees (3-5 days)**: Recursive space partitioning, doorway lintels, prop placement, AABB bounding box collision generation.
7. **Arcade Vehicle Kinematics & Closed-Form NPC Simulation (1 week)**: Raycast vehicle physics, lane offset mathematics, closed-form schedule evaluation.
8. **Open-Source Asset Pipelines (3-5 days)**: GLTF optimization with `gltf-transform`, Poimandres Market, Kenney CC0 kits.
9. **Event-Driven Architecture & Storage (2-3 days)**: Central pub/sub bus, IndexedDB async wrappers with Node fallbacks.
10. **Headless Unit & Determinism Testing with Vitest (2-3 days)**: Testing pure functions, FNV-1a hashing, zero-WebGL geometry tests.

---

## 20. Glossary of Procedural Generation and 3D Game Engine Terminology

**AABB (Axis-Aligned Bounding Box):** A rectangular 3D collision volume aligned with world axes, defined by `minX, maxX, minY, maxY, minZ, maxZ`.

**ACES Filmic Tone Mapping:** An industry-standard color transformation curve mapping high dynamic range lighting to display screens with smooth highlight rolloff and rich contrast.

**Binary Space Partitioning (BSP):** A recursive spatial subdivision algorithm that splits volumes into child rooms to generate procedural floor plans.

**BufferGeometryUtils.mergeGeometries:** A Three.js utility that combines multiple separate geometries into a single vertex buffer, eliminating draw call overhead.

**Chunk:** A square spatial partitioning tile (576m × 576m) containing 64 city blocks, loaded and unloaded based on player proximity.

**Closed-Form Evaluation:** Calculating an entity's exact position and state directly from a mathematical function of time $f(t)$ without simulating intermediate frames.

**Determinism:** The property that identical seeds and inputs produce the exact same byte-for-byte world.

**Diegetic UI:** User interface elements that exist naturally within the game world's fictional context (e.g. glowing exit signs, circular sun dials).

**Draw Call:** A GPU rendering command. High draw call counts cause CPU bottlenecks; instancing and geometry merging reduce draw calls.

**InstancedMesh:** A Three.js object rendering thousands of copies of a geometry in a single draw call with distinct transform matrices and colors.

**Micro-UI:** Minimalist UI indicators such as floating emoji speech bubbles above NPCs (e.g., ☕, 💼, 💤, 😱).

**Mulberry32:** A fast, high-quality 32-bit seeded pseudorandom number generator with a $2^{32}$ period.

**Pointer Lock API:** A browser API that locks and hides the mouse cursor to deliver continuous raw mouse movement deltas for FPS cameras.

**Poimandres (`pmndrs`):** An open-source 3D developer collective behind React Three Fiber, Drei, and Poimandres Market (`market.pmndrs.rs`).

**Vertex Colors:** RGB color attributes stored directly on each vertex in a `BufferGeometry`, allowing multi-colored models to render with a single material.

**World-Space Coordinates:** Absolute 3D positions in global scene coordinates, used for non-stretching procedural texture projection in shaders.
