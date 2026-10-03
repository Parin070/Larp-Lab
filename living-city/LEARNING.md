# Learning from Living City

A guide to building a deterministic browser 3D city from scratch. Every system explained: what it does, why this approach, how to build it yourself.

## Table of Contents

1. [Seeded PRNG (mulberry32) and Why Determinism Matters](#1-seeded-prng-mulberry32-and-why-determinism-matters)
2. [Chunk Streaming and the Pure Chunk Generator](#2-chunk-streaming-and-the-pure-chunk-generator)
3. [InstancedMesh and Draw Call Budgeting](#3-instancedmesh-and-draw-call-budgeting)
4. [The Window Shader Patch (onBeforeCompile, World-Space Tiling, instanceMatrix)](#4-the-window-shader-patch-onbeforecompile-world-space-tiling-instancematrix)
5. [Day/Night Cycle (Sun Angle, Smoothstep, Hemisphere Light)](#5-daynight-cycle-sun-angle-smoothstep-hemisphere-light)
6. [Camera and Input Handling (Fly Camera, e.code, Stuck-Key Fix, Pointer Lock)](#6-camera-and-input-handling-fly-camera-ecode-stuck-key-fix-pointer-lock)
7. [Walk Mode and AABB Collision Against Neighboring Cells](#7-walk-mode-and-aabb-collision-against-neighboring-cells)
8. [BSP Interior Generation and the Separate Interior Scene with Disposal](#8-bsp-interior-generation-and-the-separate-interior-scene-with-disposal)
9. [Road Graph, Traffic, and the Near/Far NPC Simulation](#9-road-graph-traffic-and-the-nearfar-npc-simulation)
10. [Search Index and IndexedDB Persistence](#10-search-index-and-indexeddb-persistence)
11. [Event Bus and Event Log](#11-event-bus-and-event-log)
12. [Testing: What the Tests Prove and How Determinism is Tested in Node Without WebGL](#12-testing-what-the-tests-prove-and-how-determinism-is-tested-in-node-without-webgl)
13. [How the AI Worked on This](#13-how-the-ai-worked-on-this)
14. [Bugs We Hit and What They Taught](#14-bugs-we-hit-and-what-they-taught)
15. [Prompting Lessons](#15-prompting-lessons)
16. [Learning Path](#16-learning-path)
17. [Glossary](#17-glossary)

---

## 1. Seeded PRNG (mulberry32) and Why Determinism Matters

### 1. What it does, in plain language
Generates random-looking numbers from an initial number or text called a **seed**. When given the same seed, it produces the exact same sequence of numbers every single time. Standard `Math.random()` is completely forbidden in this project.

### 2. The core technique or concept
In JavaScript, `Math.random()` pulls from system entropy (unpredictable hardware noise). A **pseudorandom number generator (PRNG)** is an algorithmic math formula: you give it an internal integer state, and each step mathematically scrambles that integer to output a float between `0.0` and `1.0`. **Determinism** means: `Seed + Code = Exact Same Result`. If player A and player B load seed `12345`, every building height, color, door position, and NPC route is identical without transferring gigabytes of world geometry over the network.

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

## 2. Chunk Streaming and the Pure Chunk Generator

### 1. What it does, in plain language
Divides the infinite city into a grid of 576m × 576m square tiles called **chunks** (each containing 8 × 8 = 64 building blocks). As the player moves, new chunks ahead are generated and loaded into the 3D scene, while distant chunks behind the player are deleted to keep memory usage low and frame rates at a smooth 60 FPS.

### 2. The core technique or concept
- **Spatial Partitioning (Chunks):** Instead of generating a single massive city model that crashes mobile/laptop GPUs, the world is sliced into local coordinates `(cx, cz)`.
- **Pure Data Generator:** The function `generateChunkData` calculates building positions, heights, colors, addresses, and door locations as plain JavaScript objects without touching Three.js, WebGL, or the DOM.
- **Independent Seed Hashing:** Each chunk's seed is computed by hashing `chunk_${worldSeed}_${cx}_${cz}`. This means chunk `(5, 2)` generates the exact same buildings whether the player walks there immediately or teleports there after visiting 100 other chunks.
- **Time-Sliced Action Queue:** Loading 25 chunks in a single frame causes a noticeable stutter (jank). The `chunkManager` queues loads and unloads, processing at most 1 chunk per animation frame.

### 3. Where it lives
- `src/world/chunk.js` — `generateChunkData(worldSeed, cx, cz)`, `createChunkMeshes(...)`, `CHUNK_SIZE = 576`, `CHUNK_CELLS = 8`
- `src/world/chunkManager.js` — `createChunkManager(...)`, `planChunkUpdates()`, `processQueue()`

### 4. The key code idea
From `src/world/chunk.js:11-21`:

```js
export function generateChunkData(worldSeed, cx, cz) {
  const chunkSeed = hashString(`chunk_${worldSeed}_${cx}_${cz}`);
  const rng = createRNG(chunkSeed);
  const buildings = [];

  for (let lz = 0; lz < CHUNK_CELLS; lz++) {
    for (let lx = 0; lx < CHUNK_CELLS; lx++) {
      const x = cx * CHUNK_SIZE - HALF_CHUNK + lx * CELL_PITCH + CELL_PITCH / 2;
      const z = cz * CHUNK_SIZE - HALF_CHUNK + lz * CELL_PITCH + CELL_PITCH / 2;
      const height = rng.nextFloat(12, 65);
```

- **Line 12:** Computes a unique 32-bit seed string incorporating the world seed and chunk coordinate `(cx, cz)`.
- **Line 13:** Instantiates an isolated PRNG stream for this chunk only.
- **Lines 17-18:** Loops through an 8 × 8 cell grid in chunk-local space `(lx, lz)`.
- **Lines 19-20:** Translates local grid indices into continuous world space coordinates `(x, z)` offset from chunk center.
- **Line 21:** Pulls random building height in `[12m, 65m]` deterministically.

### 5. Why this approach and not the obvious one
- **Avoids sequential seed drift:** If chunks used one global RNG stream, visiting chunk A then B would produce different results than visiting chunk B then A. Chunk-hashed seeding eliminates sequence dependence.
- **Decouples simulation from graphics:** Separating pure data generation from Three.js mesh creation allows fast headless testing in Vitest (Node.js) without needing WebGL canvas mocks.
- **Prevents frame drops:** Processing at most 1 chunk per frame via `processQueue()` guarantees the main render loop stays under the 16.6ms budget.

### 6. What to study
- **Red Blob Games:** "Introduction to Spatial Hashing and Grids".
- **Articles / Topics to search:** "Infinite voxel / procedural terrain chunk streaming architecture", "Time-slicing expensive computations in requestAnimationFrame".

### 7. Try it yourself
- **Hand exercise:** Write a function `worldToChunk(x, z, chunkSize)` that converts arbitrary floating point world positions (including negative numbers) into integer chunk coordinates `(cx, cz)`.
- **AI prompt:**
  > "Create a 2D chunk streaming manager in vanilla JavaScript. Given a player position (x, y), chunk dimension (576 units), and load radius (2 chunks), maintain a Set of active chunks. When the player crosses chunk boundaries, compute chunks to load and unload, push them into an action queue, and process at most one load/unload per call to `update()`."

---

## 3. InstancedMesh and Draw Call Budgeting

### 1. What it does, in plain language
Renders thousands of identical buildings as a single combined mesh instead of individual objects. Without instancing, drawing 3,200 buildings (50 chunks × 64 buildings each) would trigger 3,200 GPU draw calls per frame and drop the frame rate to 10 FPS. With `InstancedMesh`, it becomes 50 draw calls total (1 per chunk).

### 2. The core technique or concept
A **draw call** is a command from JavaScript to the GPU: "draw this geometry with this material." Each draw call has overhead (state binding, uniform uploads, validation). Modern integrated GPUs start slowing down around 200-300 draw calls per frame.

**InstancedMesh** tells the GPU: "here is one box geometry and one material, but draw it 64 times with different transforms (position, rotation, scale) and colors." The GPU processes all 64 buildings in parallel with a single draw call. The transforms are packed into a matrix array (`instanceMatrix`) and the per-building colors are stored in an `instanceColor` attribute.

**Shared Resources:** Instead of creating 50 separate box geometries and 50 separate materials (one per chunk), this project creates a single `BoxGeometry(1, 1, 1)` and a single `MeshLambertMaterial` at startup, then reuses them across all chunks.

### 3. Where it lives
- `src/world/chunk.js:77-107` — `createChunkMeshes()` creates one `InstancedMesh` with 64 building instances per chunk
- `src/world/chunkManager.js:9-14` — Shared geometry and materials declared once, reused for all chunks

### 4. The key code idea
From `src/world/chunk.js:77-107`:

```js
const buildingMesh = new THREE.InstancedMesh(
  sharedBoxGeometry,
  sharedBuildingMaterial,
  totalCount
);

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();

chunkData.forEach((b, i) => {
  position.set(b.x, b.height / 2, b.z);
  scale.set(BUILDING_FOOTPRINT, b.height, BUILDING_FOOTPRINT);
  matrix.compose(position, rotation, scale);
  buildingMesh.setMatrixAt(i, matrix);
```

- **Lines 78-82:** Constructs an `InstancedMesh` that holds `totalCount` (64) copies of the same box, sharing one geometry and material.
- **Lines 90-93:** Reusable Three.js math objects (allocate once, update in loop to avoid garbage collection).
- **Line 97:** Sets instance `i`'s position to `(x, height/2, z)` — center vertically since box pivot is at origin.
- **Line 98:** Non-uniform scale: 50m wide (X), variable height (Y), 50m deep (Z).
- **Lines 99-100:** Bakes position + rotation + scale into a single 4×4 transformation matrix and uploads it to instance slot `i`.

### 5. Why this approach and not the obvious one
- **Avoids per-object overhead:** Creating 64 individual `Mesh` objects per chunk would mean 64 separate draw calls, 64 frustum culling checks, and 64 JavaScript objects in the scene graph.
- **GPU-friendly parallelism:** Modern GPUs have thousands of cores. Instancing lets them process all 64 buildings concurrently in a single shader dispatch.
- **Memory efficiency:** One shared `BoxGeometry` (36 vertices, 12 triangles) uses ~1 KB of VRAM. Without sharing, 3,200 geometries would use ~3.2 MB of redundant data.

### 6. What to study
- **Three.js Docs:** `InstancedMesh`, `Matrix4.compose()`, `BufferAttribute` (for instanceMatrix).
- **Topics to search:** "GPU instancing explained", "draw call optimization in WebGL", "frustum culling in 3D engines".

### 7. Try it yourself
- **Hand exercise:** Write a Three.js scene with a single `InstancedMesh` containing 100 cubes arranged in a 10×10 grid. Set different colors per instance using `setColorAt()`.
- **AI prompt:**
  > "Create a Three.js demo with an InstancedMesh rendering 500 boxes in a grid. Each box should have a random height between 5 and 50 units and a random color. Use a single BoxGeometry and MeshLambertMaterial shared across all instances. Include a camera and one directional light."

---

## 4. The Window Shader Patch (onBeforeCompile, World-Space Tiling, instanceMatrix)

### 1. What it does, in plain language
Draws glowing window grids across thousands of skyscraper instances at night. The windows tile cleanly every 4 meters regardless of how tall or wide each building is, without stretching textures or adding extra geometry.

### 2. The core technique or concept
- **Shader:** A small, fast program written in GLSL (OpenGL Shading Language) executed directly on GPU cores. Vertex shaders calculate 3D corner coordinates; fragment shaders calculate the color of each pixel.
- **`onBeforeCompile`:** A Three.js hook that allows modifying standard built-in shaders (like `MeshLambertMaterial`) by replacing GLSL code blocks before Three.js compiles them to GPU machine code.
- **World-Space Tiling:** Standard UV mapping maps `[0, 1]` across a geometry. When a 1m cube is scaled to 50m × 60m × 50m, standard UVs stretch by 60×. World-space tiling computes UVs from absolute 3D world coordinates (`vWorldPosition / 4.0`), ensuring window panes are always exactly 4m × 4m on every building.
- **`instanceMatrix` in Vertex Shader:** Because buildings use `InstancedMesh`, the vertex shader must multiply vertex coordinates by `instanceMatrix` to extract the true world-space position and un-skew the normals.
- **Dynamic Emissive Uniform:** During daytime `uNightIntensity` is `0.0` (windows dark); at dusk it smoothly transitions to `1.0` (windows emit warm yellow glow).

### 3. Where it lives
- `src/world/city.js:47-107` — `createBuildingMaterial()`, `createWindowTexture()`, `material.onBeforeCompile`

### 4. The key code idea
From `src/world/city.js:96-102`:

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
- **Line 100:** Samples the 32×32 window canvas texture at the calculated world UV.
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

## 5. Day/Night Cycle (Sun Angle, Smoothstep, Hemisphere Light)

### 1. What it does, in plain language
Simulates a continuous 24-hour day/night cycle that lasts 10 real-world minutes. It moves the sun across the sky, changes sky color from dawn orange to noon blue to dusk red to midnight navy, dims directional sunlight at night, and smoothly turns on glowing building windows.

### 2. The core technique or concept
- **Normalized Simulation Time:** Time is stored as a single float `time` in `[0.0, 1.0)`, where `0.0` = midnight, `0.25` = dawn (sunrise), `0.5` = noon, and `0.75` = dusk (sunset).
- **Sun Orbit (Trigonometry):** The sun's 3D position is calculated on a circle using `(Math.cos(angle) * 500, Math.sin(angle) * 500, 0)`. When `sin(angle) > 0`, the sun is above the horizon.
- **Color Keyframe Interpolation (Lerp):** Sky color is calculated by linearly interpolating between keyframe colors (`lerpColors`) based on current time.
- **Smoothstep Window Transition:** To avoid a jarring instantaneous snap when building lights turn on, `smoothstep(edge0, edge1, sunElevation)` provides an S-curve easing function between daylight and nighttime.
- **HemisphereLight Baseline:** At night, pitch-black darkness makes buildings invisible and ruins gameplay. A `HemisphereLight` provides two-color ambient illumination (dark blue from the sky, dark slate from the ground) with an intensity floor of `0.35` so building silhouettes and street geometry remain readable.

### 3. Where it lives
- `src/sim/time.js` — `createTimeController()`, `getSkyColor(time)`, `updateLighting(...)`, `getWindowIntensity(time)`
- `src/main.js:194-220` — Calls time updates and syncs sky background and window material uniforms in render loop

### 4. The key code idea
From `src/sim/time.js:77-87`:

```js
export function updateLighting(time, directionalLight, hemisphereLight) {
  // Sun angle: dawn at horizon (0.25), noon at top (0.5)
  const angle = (time - 0.25) * Math.PI * 2;

  directionalLight.position.set(
    Math.cos(angle) * 500,
    Math.sin(angle) * 500,
    0
  );
  directionalLight.intensity = Math.max(0, Math.sin(angle));
```

- **Line 79:** Converts normalized time `[0, 1)` into radians, offset by `0.25` so angle `0` corresponds to dawn at the horizon.
- **Lines 81-85:** Positions the directional sunlight 500 meters away along the orbital arc in the XY plane.
- **Line 86:** `Math.sin(angle)` gives sunlight elevation. `Math.max(0, ...)` turns off direct sunlight completely once the sun sinks below the horizon.

### 5. Why this approach and not the obvious one
- **Avoids hard color snaps:** Discrete `if (night) { light = 0 }` causes noticeable visual popping. Trigonometric angles and smoothstep create cinema-quality gradual transitions.
- **Avoids unplayable pitch black:** In reality, cities without lights are pitch black. Using a calibrated `HemisphereLight(skyColor, groundColor)` preserves depth perception and contrast without needing dozens of expensive point lights.
- **Zero physics overhead:** No complex atmospheric scattering shaders; just math-driven Three.js lights and background color interpolation.

### 6. What to study
- **Three.js Docs:** `DirectionalLight`, `HemisphereLight`, `Color.lerpColors()`.
- **The Book of Shaders:** Chapter on "Algorithmic drawing — Shaping functions" (`smoothstep`).
- **Topics to search:** "Celestials and day-night cycle math in game engines", "Hermite interpolation / smoothstep formula".

### 7. Try it yourself
- **Hand exercise:** Write a `smoothstep(min, max, value)` function in pure JS and test its output at `value = min`, `value = (min+max)/2`, and `value = max`.
- **AI prompt:**
  > "Create a day/night cycle module in Three.js. It should track normalized time [0, 1), animate a DirectionalLight along an arc, update scene background color across 4 keyframes (midnight, dawn, noon, dusk), adjust HemisphereLight ground and sky colors, and return a smoothstep window intensity float."

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

## 7. Walk Mode and AABB Collision Against Neighboring Cells

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

## 8. BSP Interior Generation and the Separate Interior Scene with Disposal

### 1. What it does, in plain language
Allows the player to walk up to any building door and press `E` to step inside a procedurally generated floor plan (lobbies, offices, meeting rooms, server racks). When the player leaves, the entire interior and its 3D assets are completely destroyed and freed from GPU memory to prevent memory leaks.

### 2. The core technique or concept
- **BSP (Binary Space Partitioning):** A recursive tree algorithm that takes a 40m × 40m bounding box and splits it into two smaller rectangles (alternating horizontal and vertical cuts between 40% and 60% of the dimension). This recursion repeats down to 4 levels, generating realistic floor plans with interconnected rooms.
- **Doorway Cutouts & Lintels:** When a wall splits two rooms, the generator places two wall segments with a 2.0m gap between them and adds a horizontal lintel box above the doorway (at 2.2m height) so the player can walk through.
- **Geometry Merging:** Creating separate Three.js meshes for every wall segment, lintel, desk, chair, and server rack would create 60+ draw calls. `BufferGeometryUtils.mergeGeometries()` bakes all architectural walls into a single `structureMesh` and all furniture into a single `propsMesh`, keeping interior draw calls to 2.
- **Isolated Scene Swap:** The interior runs in its own `THREE.Scene` with its own ambient and point lights. The main render loop simply points `renderer.render()` to the interior scene while inside, stopping exterior chunk updates.
- **GPU Resource Disposal:** WebGL GPU buffers (VRAM) are not automatically reclaimed by JavaScript's garbage collector. Calling `geometry.dispose()` and `material.dispose()` is strictly required whenever unloading an interior.

### 3. Where it lives
- `src/interiors/bsp.js` — `createBSPTree(seed, width, depth, minRoomSize, maxDepth)`
- `src/interiors/interiorGenerator.js` — `generateInterior(buildingSeed)` (geometry creation, prop placement, wall AABBs)
- `src/interiors/interiorScene.js` — `createInteriorScene(building)`, `dispose()`
- `src/main.js:139-170` — `KeyE` interaction listener swapping between exterior and interior scenes

### 4. The key code idea
From `src/interiors/bsp.js:20-40`:

```js
function splitNode(node, currentDepth) {
  if (currentDepth >= maxDepth) return;

  // Decide split direction (horizontal or vertical)
  const canSplitV = node.w >= minRoomSize * 2;
  const canSplitH = node.d >= minRoomSize * 2;

  if (!canSplitV && !canSplitH) return;

  let splitVertical = node.w > node.d ? true : rng.next() > 0.5;

  if (splitVertical) {
    const splitRatio = rng.nextFloat(0.4, 0.6);
    const splitW = Math.round(node.w * splitRatio);
    const childA = { x: node.x, z: node.z, w: splitW, d: node.d, ... };
    const childB = { x: node.x + splitW, z: node.z, w: node.w - splitW, d: node.d, ... };
```

- **Lines 21-25:** Base recursion guard: stops splitting when `maxDepth` is reached or if the room is too small to split.
- **Line 27:** Heuristic split decision: prioritizes cutting along the longer dimension to keep room proportions balanced.
- **Line 30:** Uses the building's seeded RNG to pick a split point between 40% and 60%.
- **Lines 32-34:** Subdivides the parent rectangle into two child nodes `childA` and `childB` and continues splitting recursively.

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
  > "Write a JavaScript procedural room generator using Binary Space Partitioning (BSP). Given a building seed, width (40), depth (40), and max depth (4), recursively subdivide the floor plan into rooms. Return leaf rooms with dimensions, room types ('office', 'server_room', 'meeting_room'), doorway coordinates between adjacent rooms, and an array of 2D bounding boxes for all walls."

---

## 9. Road Graph, Traffic, and the Near/Far NPC Simulation

### 1. What it does, in plain language
Animates 64 cars driving along roads and 80 pedestrians walking between home and work buildings. Cars travel along a procedural road grid, turning at intersections. NPCs follow daily schedules: commuting at 7 AM, working indoors until noon, eating lunch outside, returning to work, commuting home at 5:30 PM, and evening leisure walks before midnight. NPCs that are indoors become invisible; outdoor NPCs are rendered as low-poly capsule characters.

### 2. The core technique or concept
- **Implicit Road Graph:** Roads aren't stored as data structures. The graph is computed on-the-fly: every intersection is at grid coordinate `(gx * 72m, gz * 72m)`, and each intersection has exactly 4 cardinal neighbor intersections.
- **Lane Offset Positioning:** Cars drive 2 meters to the right of the road centerline. `getLanePosition()` computes the perpendicular normal vector to the driving direction and applies a lateral offset.
- **Traffic Recycling:** When a car exits the player's 12-cell radius, it is teleported to a new random intersection near the player instead of being destroyed and recreated.
- **Closed-Form NPC Evaluation:** Instead of updating 80 NPC state machines every frame with pathfinding, `evaluateNPCPosition(npc, time)` is a pure function: given simulation time `t`, it calculates the exact `(x, z)` coordinate and state (`'home'`, `'work'`, `'commute_work'`, `'lunch'`) using math (linear interpolation between home and work positions during commute windows, circular path during lunch).
- **Near/Far Culling:** NPCs indoors are scaled to `(0, 0, 0)` and translated to `y = -100`, making them invisible without removing them from the `InstancedMesh`.

### 3. Where it lives
- `src/world/roadGraph.js` — `getNearestIntersection()`, `getLanePosition()`, `getNextIntersection()`
- `src/sim/traffic.js` — `createTrafficSystem(worldSeed, maxCars)`, car recycling loop
- `src/sim/npc.js` — `createNPCSchedule(npcSeed, worldSeed)`, `evaluateNPCPosition(npc, time)`
- `src/sim/npcRenderer.js` — `createNPCRenderer(...)`, merged body + head geometry, `InstancedMesh` update

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
- `src/main.js:176-208` — Auto-save timer (every 30 seconds)

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

## 11. Event Bus and Event Log

### 1. What it does, in plain language
Acts as the central communication network for the entire game. Whenever anything noteworthy happens (the hour changes, chunks stream in, a player enters a building door, an NPC transitions from commute to work), an event is broadcast. The system maintains a live circular buffer of the 500 most recent events, and pressing `L` opens an in-game event stream panel to inspect and filter events in real time.

### 2. The core technique or concept
- **Publish-Subscribe (Pub/Sub):** Systems emit events without knowing who is listening. For example, `npcRenderer.js` doesn't know about `eventViewer.js`; it simply emits `npc_state_changed`, and any interested UI, audio, or analytics component receives it.
- **Strict Normalized Schema:** Every event conforms to `{ t, type, actorId, locationId, data }`. The timestamp `t` uses deterministic simulation time (`timeController.getTime()`), not `Date.now()`.
- **Wildcard Subscriptions (`'*'`):** The event bus allows subscribing to `'*'`, allowing the `eventLog` to capture every event across all systems with a single listener.
- **Circular Buffer (Ring Buffer):** The event log caps history at 500 entries. When `buffer.length > capacity`, `buffer.shift()` evicts the oldest entry, guaranteeing constant-bounded memory regardless of how long the game runs.
- **Sparse Event Throttling:** High-frequency events (like player position) are throttled to prevent log spam. `camera_moved` only fires when the player crosses a 64m grid boundary rather than on every frame.

### 3. Where it lives
- `src/events/bus.js` — `createEventBus(getTime)`
- `src/events/eventLog.js` — `createEventLog(bus, capacity = 500)`
- `src/events/eventTypes.js` — String constants for all event types (`DOOR_ENTERED`, `CHUNK_LOADED`, etc.)
- `src/ui/eventViewer.js` — `createEventViewer(eventLog)`
- `src/main.js:38-41, 135-138, 253-261` — Event bus wiring, log viewer toggle (`KeyL`), and throttled event emissions

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
- **Line 29:** Invokes all wildcard (`'*'`) handlers, routing every event into the log buffer.

### 5. Why this approach and not the obvious one
- **Eliminates spaghetti coupling:** Without an event bus, systems would directly import and call each other's UI update functions, creating tightly coupled, untestable code.
- **Enables deterministic forensics:** Using simulation time `t` instead of real wall-clock time ensures event logs can be replayed or evaluated in headless test environments.
- **Prevents memory leaks:** The circular buffer ensures the game can run for hours without the event log consuming increasing amounts of RAM.

### 6. What to study
- **Refactoring Guru:** "Observer Pattern / Publish-Subscribe".
- **Topics to search:** "Event-driven game architecture", "Circular ring buffer in JavaScript", "Decoupling systems with a central event bus".

### 7. Try it yourself
- **Hand exercise:** Write a minimal event bus in 15 lines of JavaScript with `.on()`, `.off()`, and `.emit()`, including a wildcard `'*'` listener.
- **AI prompt:**
  > "Create a publish-subscribe EventBus in vanilla JavaScript. Allow passing a timestamp generator function `getTime` in the constructor. Support emitting typed events with schema `{ t, type, actorId, locationId, data }`. Add support for a wildcard '*' listener that receives all events. Create an EventLog class that records the last 500 events in a circular buffer with methods `filterByType` and `filterByActor`."

---

## 12. Testing: What the Tests Prove and How Determinism is Tested in Node Without WebGL

### 1. What it does, in plain language
Runs automated test suites in the terminal using Vitest (a fast Node.js test runner). The tests verify that the seeded RNG produces identical output across runs, that chunk generation is load-order independent, that collision resolvers prevent clipping through walls, and that the event log correctly filters and buffers events. Tests run in pure Node.js without requiring a browser, WebGL context, or DOM.

### 2. The core technique or concept
- **Unit Testing Pure Functions:** Functions like `generateChunkData()`, `createRNG()`, and `evaluateNPCPosition()` accept inputs and return plain JavaScript objects without touching the DOM, canvas, or Three.js renderer. These can be imported into Node.js and tested directly.
- **Determinism Hashing:** To verify that `generateChunkData(12345, 0, 0)` always produces the same 64 buildings, the test serializes the output array to JSON and hashes it using the FNV-1a algorithm. Two runs with the same seed must produce identical hashes.
- **Load-Order Independence Test:** Generates chunk `(5, 5)` then `(-2, 4)`, then in the reverse order `(-2, 4)` then `(5, 5)`. Asserts that the chunk `(5, 5)` data is byte-identical regardless of which order chunks were visited, proving chunk-hashed seeding works.
- **Headless Three.js (Geometry Only):** Three.js math utilities (`Matrix4`, `Vector3`, `BoxGeometry`) work in Node.js without WebGL. Tests create geometries and materials to verify no exceptions are thrown, then immediately `.dispose()` them.
- **Vitest (`npm test`):** Vitest automatically discovers all `*.test.js` files, runs them in parallel, and reports pass/fail. It supports ES module imports natively, making it ideal for modern JavaScript projects.

### 3. Where it lives
- `tests/determinism.test.js` — Verifies same seed = same city hash, different seeds = different hashes
- `tests/chunk.test.js` — Load-order independence, building count validation, mesh creation
- `tests/rng.test.js` — PRNG sequence determinism, `nextInt`/`nextFloat` ranges, `fork()` independence
- `tests/eventLog.test.js` — Circular buffer eviction, type/actor filtering
- `tests/collision.test.js`, `tests/interiors.test.js`, `tests/npc.test.js`, `tests/search.test.js`, `tests/save.test.js` — Additional system-level tests

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

- **Lines 6-14:** Implements FNV-1a 32-bit hash: XORs each character code, multiplies by a prime constant, and returns a hexadecimal string. This creates a 8-character fingerprint of the entire city layout.
- **Lines 17-19:** Generates a 20×20 grid of buildings (400 total) from seed `12345` and hashes the resulting array.
- **Lines 21-23:** Repeats the process with the same seed.
- **Lines 25-26:** Asserts that both the hashes and deep object equality match exactly.

### 5. Why this approach and not the obvious one
- **Avoids browser automation overhead:** Tools like Puppeteer or Playwright launch full Chrome instances, adding 5+ seconds of startup time per test run. Vitest runs in milliseconds.
- **Catches regressions early:** Without tests, refactoring the RNG or chunk generator could silently break determinism and go unnoticed until players report "my friend's seed doesn't match mine."
- **No WebGL mocking needed:** Separating pure data generators (`generateChunkData`) from rendering (`createChunkMeshes`) means 90% of the logic is testable in Node.js without canvas polyfills.

### 6. What to study
- **Vitest Docs:** "Getting Started", "API Reference", "Expectations (expect)".
- **Topics to search:** "Unit testing pure functions in JavaScript", "Test-driven development (TDD) basics", "FNV hash algorithm".

### 7. Try it yourself
- **Hand exercise:** Run `npm test` in the project terminal and observe which tests pass. Modify `src/core/rng.js` line 16 to `state = (state + 0x12345678)` (wrong constant) and watch the determinism tests fail.
- **AI prompt:**
  > "Write a Vitest test suite for a seeded PRNG. Test that: (1) same seed produces identical 10-value sequences, (2) different seeds produce different sequences, (3) `nextInt(10, 20)` always returns integers in [10, 20], (4) `fork()` creates an independent RNG, and (5) state can be saved and restored with `getState()` and `setState()`."

---

## 13. How the AI Worked on This

### 1. What it does, in plain language
Describes the structured software development workflow used to build the entire Living City project. Instead of asking the AI to "build a 3D city game" in one giant vague prompt (which always results in broken, unmaintainable code), the project used a disciplined engineering process governed by `CLAUDE.md`, explicit phase milestones, upfront planning, and incremental git commits.

### 2. The core technique or concept
- **`CLAUDE.md` as System Architecture Contract:** A markdown file in the project root that defines the hard rules, performance budgets (draw calls < 200, frame time < 16ms), forbidden patterns (`Math.random()` forbidden), stack constraints (no physics engine, vanilla JS + Three.js + Vite), and coding conventions. The AI reads this file before every turn.
- **Plan-First Rule:** Before writing any code for a feature touching more than 2 files, the AI must explore the codebase, formulate an implementation plan, show it to the user, and wait for approval. This eliminates wasted code churn and architectural misalignments.
- **Milestone-Based Phasing:** The project was divided into 6 distinct, sequential phases:
  - *Phase 1:* Flat grid city, instanced boxes, day/night cycle, free camera.
  - *Phase 2:* Chunk streaming, seeded procedural generation, 60 FPS verification.
  - *Phase 3:* Enterable buildings, procedural BSP room generator, scene disposal.
  - *Phase 4:* NPC schedules, road graph, traffic simulation.
  - *Phase 5:* Search modal, waypoint beacons, IndexedDB persistence.
  - *Phase 6:* Event bus, circular event log buffer, in-game SIEM stream viewer.
- **Verification Gates Before Commits:** Every feature was validated with `npm test` (unit tests pass) and `npm run build` (Vite production bundle compiles with zero errors) before committing.
- **One Feature Per Commit:** Git commits are small, focused, and descriptive (`milestoneX: describe feature`). This makes debugging regressions trivial using `git bisect`.

### 3. Where it lives
- `CLAUDE.md` — Project definition, architectural rules, performance constraints, and phase checklist
- Git commit log (`git log --oneline`) — Linear progression from Milestone 1 through Milestone 6

### 4. The key code idea
From `CLAUDE.md`:

```markdown
## Hard rules
- Never use `Math.random()`. Use seeded PRNG (mulberry32) from `src/core/rng.js`.
- Same seed = same world. Sim must be deterministic.
- Every system emits events via event bus. Schema: `{ t, type, actorId, locationId, data }`.
- Use InstancedMesh for repeated objects. Merge static geometry per chunk.
- Dispose geometry, materials, textures on unload. Interiors fully disposed on exit.
- Chunk size 64m. Load radius 3. Unload outside.
- Draw calls < 200, Frame time < 16ms on integrated GPU laptop.
```

- Every rule in `CLAUDE.md` directly eliminates a specific class of software defect:
  - *Seed rule* prevents non-deterministic world discrepancies.
  - *Instancing & merge rule* prevents draw call explosions that drop framerates.
  - *Disposal rule* prevents WebGL memory leaks that crash browsers.
  - *Perf budget* establishes a measurable threshold verified via the F3/F4 debug overlay.

### 5. Why this approach and not the obvious one
- **Prevents context hallucination:** LLMs given huge, open-ended tasks invent unnecessary dependencies (e.g. pulling in Cannon.js or Ammo.js physics engines) and produce bloated, incoherent architectures.
- **Prevents scope creep:** Working one phase at a time keeps prompt contexts focused on solving one isolated problem cleanly.
- **Guarantees code quality:** Requiring automated tests and production builds before committing ensures the codebase is always in a working, deployable state.

### 6. What to study
- **Anthropic Documentation:** "Claude Code best practices", "CLAUDE.md project memory and instructions".
- **Topics to search:** "Agentic coding workflows", "Test-driven development with AI assistants", "Incremental software engineering".

### 7. Try it yourself
- **Hand exercise:** Write a 20-line `CLAUDE.md` file for a small project of your own. Define stack constraints, 3 hard rules, commands, and a 3-phase roadmap.
- **AI prompt:**
  > "Create a CLAUDE.md file for a procedural browser game. Include sections for Stack, Commands, Architecture, Hard Rules (e.g., no external physics engines, deterministic PRNG only, draw calls < 150), and a 4-milestone roadmap."

---

## 14. Bugs We Hit and What They Taught

### Stuck keys (Phase 1)
**What happened:** Player held `W` to walk forward, pressed `Alt+Tab` to switch windows, returned to the game tab, and the character was permanently stuck walking forward even though no keys were pressed.

**Root cause:** When the browser window loses focus, `keyup` events are never fired. The `keys.w` flag remained `true` forever.

**The fix:** Added `window.addEventListener('blur', resetKeys)` and `document.addEventListener('pointerlockchange', () => { if (!locked) resetKeys() })` to explicitly flush all key states when focus is lost.

**Lesson learned:** Always assume external interruptions (Alt+Tab, Escape, DevTools opening) can break input state. Guard against them defensively.

---

### Material groups blowing the draw call budget (Phase 2)
**What happened:** After implementing chunked city generation, the F3 debug overlay reported 1,800+ draw calls and framerates dropped to 12 FPS. The target was <200 draw calls.

**Root cause:** Early code created separate `MeshLambertMaterial` instances per chunk. With 25 loaded chunks and 3 material groups per chunk (buildings, roads, ground slabs), that was 75 materials × multiple geometry batches = massive overhead.

**The fix:** Refactored to shared singleton materials: one `sharedBuildingMaterial`, one `sharedStaticMaterial`, and one `sharedBoxGeometry` reused across all chunks. Reduced draw calls from 1,800 to ~50.

**Lesson learned:** GPU state changes (binding new materials) are more expensive than raw triangle throughput. Reuse materials aggressively.

---

### One building per chunk instead of 64 (Phase 2)
**What happened:** After implementing chunk-hashed seeding, every chunk generated only 1 building instead of the intended 8×8 grid (64 buildings). The city looked like a sparse ghost town.

**Root cause:** The chunk generator loop was written as `for (let lz = 0; lz < CHUNK_SIZE; lz++)` instead of `for (let lz = 0; lz < CHUNK_CELLS; lz++)`. `CHUNK_SIZE = 576` (meters), but `CHUNK_CELLS = 8` (grid count).

**The fix:** Changed loop bounds to `CHUNK_CELLS` (8) and verified the expected building count with a test: `expect(data.length).toBe(CHUNK_CELLS * CHUNK_CELLS)`.

**Lesson learned:** Semantic variable names prevent off-by-one errors. Write unit tests that validate expected data sizes.

---

### Window texture stretching (Phase 2)
**What happened:** Building windows were blurry and stretched, with one giant window pane covering an entire 60-meter-tall skyscraper face.

**Root cause:** The window texture was mapped using standard mesh UVs, which are normalized `[0, 1]` coordinates. When the box geometry was scaled to `(50, 60, 50)`, the UVs stretched proportionally.

**The fix:** Switched from UV-space mapping to world-space projection in the fragment shader: `vec2 winUV = vec2(vWorldPosition.x / 4.0, vWorldPosition.y / 4.0)`. Windows now tile every 4 meters regardless of building scale.

**Lesson learned:** For procedural tiling patterns, world-space coordinates are more robust than UV coordinates on scaled geometry.

---

### Hard emissive flicker (Phase 2)
**What happened:** At sunset, building windows instantly snapped from pitch black to full brightness in a single frame, creating a jarring visual pop.

**Root cause:** The original code used a hard threshold: `const nightIntensity = sunElevation < 0 ? 1.0 : 0.0;`.

**The fix:** Replaced the hard `if` with a `smoothstep(-0.1, 0.2, sunElevation)` easing curve, creating a smooth 5-minute dawn/dusk transition.

**Lesson learned:** Hard binary switches create noticeable visual artifacts. Use easing functions (`smoothstep`, `lerp`) for time-based transitions.

---

## 15. Prompting Lessons

### 1. Start with constraints, not features
**Bad prompt:** "Build a 3D city game in the browser."

**Good prompt:** "Create a deterministic procedural 3D city using Three.js, vanilla JavaScript, and Vite. No external physics engines. Chunk streaming with a 60 FPS budget on integrated GPUs. Use a seeded PRNG (mulberry32) instead of Math.random(). Start with Phase 1: flat grid city with instanced buildings and day/night cycle."

**Why it works:** Constraints eliminate entire classes of wrong solutions before the AI writes a single line of code.

---

### 2. Demand planning for multi-file changes
**Bad workflow:** "Add BSP interior generation" → AI immediately writes 300 lines of code that doesn't integrate with existing door interaction logic.

**Good workflow:** "Before implementing BSP interiors, read the existing door interaction code in `main.js` and the player controller in `player.js`. Show me a plan for how the interior scene will integrate with the existing enter/exit flow. Wait for my approval before writing code."

**Why it works:** Forces the AI to explore and understand existing architecture before making changes, preventing orphaned or conflicting code.

---

### 3. Provide real error messages and stack traces
**Bad prompt:** "The interiors aren't working."

**Good prompt:** "I'm getting `TypeError: Cannot read property 'dispose' of undefined` at `interiorScene.js:59` when exiting a building. Here's the relevant code: [paste the function]. The error started after I added props geometry merging. What's the root cause?"

**Why it works:** Concrete error messages let the AI pinpoint the exact failure point instead of guessing.

---

### 4. Verify one system before moving to the next
**Bad workflow:** Implement seeded RNG, chunk streaming, instancing, shaders, collision, and interiors all in one session, then try to debug 6 tangled systems simultaneously.

**Good workflow:** "Implement seeded RNG. Write a test that verifies same seed = same sequence. Run `npm test` and confirm it passes. Commit with message 'feat: add mulberry32 seeded PRNG'." Then move to the next feature.

**Why it works:** Each subsystem is validated in isolation before integration. Bugs are caught early when their cause is obvious.

---

### 5. Specify output format and scope explicitly
**Bad prompt:** "Explain how chunk streaming works."

**Good prompt:** "Explain chunk streaming in 3 short paragraphs: (1) what it is in plain language, (2) the key code pattern (quote 10 lines from `chunkManager.js`), (3) why it's needed instead of loading everything at once."

**Why it works:** Prevents meandering, overly verbose responses. You get exactly the information you need in a scannable format.

---

### 6. Request verification steps in the prompt
**Bad prompt:** "Add collision detection."

**Good prompt:** "Add AABB collision detection for walk mode against nearby buildings. After implementation, create a test in `tests/collision.test.js` that verifies a player at `(0, 0)` moving toward a building at `(10, 0)` stops at the building's edge. Run `npm test` and confirm the test passes."

**Why it works:** Embeds verification into the task itself. The AI knows the feature isn't done until the test passes.

---

### 7. Provide context: show what you already tried
**Bad prompt:** "Fix the window shader."

**Good prompt:** "The window emissive shader isn't working. I tried changing `uNightIntensity` to `1.0` manually in the fragment shader, and the windows stayed dark. I confirmed the uniform is being set in `city.js:217`. I suspect the issue is in how `vWorldPosition` is calculated for instanced meshes. Here's the vertex shader code: [paste]."

**Why it works:** Eliminates suggestions the user has already tried. Focuses the AI on the actual problem area.

---

### 8. Ask for trade-offs, not just solutions
**Bad prompt:** "How should I implement NPC pathfinding?"

**Good prompt:** "I need NPCs to walk between home and work buildings. Option 1: A* pathfinding on the road grid (accurate but expensive). Option 2: Closed-form linear interpolation based on schedule time (cheap but simplistic). What are the trade-offs, and which would you recommend for 80 NPCs at 60 FPS?"

**Why it works:** Prompts the AI to think critically about performance, complexity, and project constraints rather than defaulting to the most sophisticated algorithm.

---

## 16. Learning Path

If you want to rebuild this from scratch or create a similar project, here's the recommended study order:

### 1. JavaScript ES6 Modules (1-2 days)
- `import`/`export`, default vs named exports
- Why: The entire project uses ES modules; you can't follow the code without understanding them.

### 2. Three.js Basics (1 week)
- Scene, Camera, Renderer, Mesh, Geometry, Material
- PerspectiveCamera and basic orbit controls
- Lambert and Basic materials
- `requestAnimationFrame` loop
- Why: These are the building blocks. Every 3D engine uses this scene graph model.

### 3. Three.js Geometry and Materials (3-5 days)
- BoxGeometry, PlaneGeometry, BufferGeometry
- MeshLambertMaterial, vertex colors, emissive properties
- Lights: DirectionalLight, HemisphereLight, AmbientLight
- Why: You need to understand how geometry data flows from CPU to GPU.

### 4. Instancing (2-3 days)
- `InstancedMesh`, `setMatrixAt`, `setColorAt`
- Matrix4 transforms (position, rotation, scale)
- Why instancing (draw call reduction, GPU parallelism)
- Why: Instancing is the single most important performance optimization in the project.

### 5. Shaders Basics (1 week)
- Vertex vs fragment shaders
- GLSL syntax (vec3, uniforms, varyings)
- `material.onBeforeCompile` hook
- World-space vs UV-space coordinates
- Why: Custom shaders unlock effects impossible with standard materials (world-space window tiling).

### 6. Procedural Generation (3-5 days)
- Seeded PRNGs (Mulberry32 or similar)
- Determinism: same seed = same output
- Why `Math.random()` is forbidden in procedural games
- Why: Determinism is the foundation of the entire architecture.

### 7. Simple Physics (AABB Collision) (2-3 days)
- Axis-aligned bounding boxes
- Separating axis theorem (2D case)
- Axis-separated collision resolution (resolve X, then Z)
- Why: You don't need a full physics engine for walking around a city.

### 8. Binary Space Partitioning (BSP) (2-3 days)
- Recursive spatial subdivision
- How BSP generates floor plans
- Why: Understanding BSP unlocks procedural dungeons, buildings, and level design.

### 9. Event-Driven Architecture (2 days)
- Publish-subscribe pattern
- Decoupling systems with a central event bus
- Why: Prevents spaghetti imports and makes systems testable in isolation.

### 10. IndexedDB and Browser Storage (1-2 days)
- Difference between localStorage, sessionStorage, and IndexedDB
- Wrapping IndexedDB in Promises
- Why: Save/load systems need structured async storage.

### 11. Testing with Vitest (2-3 days)
- Writing unit tests for pure functions
- `expect()`, `.toBe()`, `.toEqual()`
- Why: Determinism is meaningless if you don't test it.

### 12. Performance Profiling (2 days)
- Chrome DevTools Performance tab
- Three.js `renderer.info` (draw calls, triangles)
- Understanding frame time budgets (16.6ms = 60 FPS)
- Why: You can't optimize what you don't measure.

---

**Total Time Estimate:** 6-8 weeks of focused evening/weekend learning, assuming 1-2 hours per day. Experienced JavaScript developers can move faster; beginners should take it slow and build small test projects at each stage.

---

## 17. Glossary

**AABB (Axis-Aligned Bounding Box):** A rectangular collision volume aligned with world X/Y/Z axes (no rotation), defined by `minX, maxX, minY, maxY, minZ, maxZ`.

**Binary Space Partitioning (BSP):** A recursive tree algorithm that divides a 2D or 3D space into progressively smaller rectangular regions.

**Chunk:** A fixed-size square tile (576m × 576m in this project) containing 64 city blocks. Used for spatial partitioning and streaming.

**Closed-Form Evaluation:** Computing a result directly from inputs using a mathematical formula, rather than iterating through intermediate simulation steps.

**Determinism:** The property that running the same code with the same inputs always produces the exact same output.

**Draw Call:** A single GPU command to render geometry with a specific material. Each draw call has CPU/GPU overhead.

**Emissive:** A material property that makes a surface glow as if emitting light, independent of scene lighting.

**Fragment Shader:** A GPU program that calculates the final color of each pixel on a rendered surface.

**Frustum Culling:** The GPU automatically skips rendering objects outside the camera's view cone (frustum).

**GLSL (OpenGL Shading Language):** The C-like language used to write vertex and fragment shaders for WebGL/Three.js.

**GPU (Graphics Processing Unit):** Specialized hardware with thousands of parallel cores optimized for rendering 3D graphics.

**IndexedDB:** A browser-native asynchronous key-value database supporting gigabytes of structured data storage.

**InstancedMesh:** A Three.js optimization that renders many copies of the same geometry with different transforms in a single draw call.

**Lerp (Linear Interpolation):** Blending between two values: `lerp(a, b, t) = a + (a - b) * t`.

**Material:** Defines the visual appearance of a 3D surface (color, shininess, texture, emissive glow).

**Mesh:** A 3D object combining geometry (shape) and material (appearance).

**Pointer Lock:** A browser API that hides the mouse cursor and delivers raw relative motion for first-person camera controls.

**PRNG (Pseudorandom Number Generator):** An algorithm that generates deterministic random-looking numbers from a seed.

**Scene Graph:** A tree hierarchy of 3D objects (meshes, lights, cameras) in a Three.js scene.

**Seed:** An initial integer or string input to a PRNG that determines its entire output sequence.

**Smoothstep:** An S-curve easing function: `smoothstep(edge0, edge1, x) = t² × (3 - 2t)` where `t = clamp((x - edge0) / (edge1 - edge0), 0, 1)`.

**Spatial Partitioning:** Dividing a world into grid cells or regions to optimize collision detection and rendering.

**Time-Slicing:** Spreading expensive computations across multiple frames to maintain 60 FPS.

**Uniform (Shader Uniform):** A global variable passed from JavaScript to a GPU shader, constant across all vertices/pixels in one draw call.

**Vertex Shader:** A GPU program that calculates the 3D screen position of each vertex in a mesh.

**WebGL (Web Graphics Library):** Browser API for hardware-accelerated 3D graphics using the GPU.

**World-Space Coordinates:** Absolute 3D positions in the global scene, as opposed to local object coordinates or UV texture coordinates.

---
