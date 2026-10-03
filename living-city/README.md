# Living City

A browser-based procedurally generated low-poly 3D city that runs at 60fps on integrated laptop GPUs. Built to look like a large open-world game using aggressive optimization instead of heavy assets.

<!-- TODO: Add screenshot or demo GIF here -->

## Why This Exists

I'm building a fully procedural city environment that a normal laptop can open in a browser and explore at 60fps. No massive asset downloads, no backend server, no physics engine—just seeded generation, instanced rendering, and a performance budget under 200 draw calls.

This is part of **Larp Lab**, my collection of experiments built with free tools to learn how modern stacks fit together. This project specifically explores how to direct an AI coding agent on a non-trivial architecture with hard constraints.

## Why It's Vibecoded

The code in this project was written by an AI coding agent (Claude Code, routed through OmniRoute) and directed by me through prompts, architectural plans, and review sessions.

**This is a deliberate choice.** The point is not to hand-type every line—it's to practice specification, architecture, review, and verification. The skill being practiced is how to keep an AI agent on track through a multi-phase project with performance constraints and deterministic simulation requirements.

### What Keeps It From Being Random Output

1. **CLAUDE.md with hard rules**: Never use `Math.random()`, seeded RNG only, deterministic simulation, event bus for every system, dispose geometry/materials on unload, specific draw call budget, chunk streaming constraints.

2. **Plan-first workflow**: For any task touching more than 2 files, I required a written plan that I approved before implementation. Plans caught architecture mistakes (material groups would have blown the draw call budget, initial collision design looped over all buildings instead of local cells).

3. **Automated tests**: 43 tests across 11 suites verify determinism (same seed = same hash), chunk load-order independence, collision resolution, save/load round-trips, NPC schedule evaluation, and event log filtering.

4. **Manual playtesting that caught real bugs**:
   - Camera falling through the map with no keys held → stuck key state bug from `e.key` changing with Shift/CapsLock, fixed by switching to `e.code` and adding blur/pointer-lock-exit reset.
   - Window textures stretching on tall buildings → `onBeforeCompile` shader wasn't transforming via `instanceMatrix`, fixed by adding proper world-space position calculation.
   - Initial plan would have used material groups for windows vs roofs → would have cost 6× draw calls per mesh, caught in plan review and replaced with single-material shader patching.

5. **Small commits**: 42 commits for 6 milestones, one file at a time, with `git status` and `git diff --stat` before each commit.

### What I Learned About Vibecoding

1. **AI-generated summaries need independent verification.** After context compaction, the agent's summary claimed features existed that weren't built yet. I had to read actual file state rather than trust the summary.

2. **Constraints in CLAUDE.md prevent drift.** The "never use Math.random()" and "same seed = same world" rules were enforced automatically because they were written down. The agent caught itself when I tried to use `Date.now()` in tests.

3. **Plans catch architecture mistakes before they cost time.** Requiring a written plan for multi-file changes surfaced the material-group draw call explosion and the all-buildings collision loop before any code was written.

4. **Tests are the guardrail for determinism.** Without automated tests, I wouldn't have caught chunk load-order dependence or hash instability across Node vs browser.

5. **The agent doesn't know what it doesn't know.** When BSP generation failed silently, it didn't debug—it confidently rewrote the same broken logic. I had to step in and trace the algorithm manually.

### Limits

I did not write every line of code in this project. The AI wrote implementation files, tests, and build configuration under my direction. This README does not imply otherwise.

## How It Works

### Architecture

```
src/
├── core/           # Game loop, camera, input, player kinematics, AABB physics
├── world/          # Chunk streaming, city layout, roads, search index, waypoint
├── interiors/      # BSP floorplan generator, interior scene, props
├── sim/            # Time/day-night cycle, NPC schedules, traffic simulation
├── events/         # Event bus, event log, structured event envelope
├── save/           # Zero-dependency IndexedDB wrapper and save manager
└── ui/             # HUD overlays (F3/F4 debug, search modal, event viewer)

tests/              # 43 tests: determinism, collision, interiors, NPCs, save/load, events
```

### Deterministic Generation

World generation is a **pure mathematical function**: `generateChunkData(worldSeed, cx, cz)` returns plain JavaScript objects with no THREE.js dependencies. Same seed + same coordinates = same buildings, every time, regardless of load order. This runs in Node for tests and in the browser for rendering.

Determinism is enforced by:
- 32-bit mulberry32 PRNG seeded from `hashString(worldSeed + chunkCoords)`
- All procedural choices (building height, color, door placement, interior layout, NPC schedules, traffic paths) derived from seeded RNG state
- Automated tests hashing output and verifying load-order independence

### Chunk Streaming

- **Chunk size**: 8×8 cells = 576m × 576m
- **Load radius**: 2 (5×5 grid = 25 chunks active)
- **Streaming queue**: Max 1 chunk build or dispose per frame to prevent hitches
- **Per-chunk meshes**:
  - 1 `InstancedMesh` for 64 buildings (shared material)
  - 1 merged static `Mesh` for roads, ground slabs, door markers
- **Disposal**: Full geometry/material/texture cleanup when chunks leave the load radius

### Rendering & Draw Calls

**Instanced rendering** keeps draw calls low:
- Buildings: 1 draw call per chunk × 25 chunks = **25 draw calls**
- Ground/roads: 1 draw call per chunk × 25 chunks = **25 draw calls**
- Traffic: **1 draw call** (64 cars, `InstancedMesh`)
- NPCs: **1 draw call** (80 citizens, `InstancedMesh`)
- Waypoint beacon: **1 draw call**

**Total exterior scene: ~53 draw calls** (frustum culling reduces visible calls to ~23–33)

**Window shader**: Shared `MeshLambertMaterial` patched with `onBeforeCompile`. Computes world position via `modelMatrix * instanceMatrix * position`, tiles 4m floor windows in world space, zeroes emissive on roofs (`abs(worldNormal.y) > 0.5`), fades intensity with smoothstep of sun elevation. Zero extra draw calls.

### Walk Mode & Collision

- `V` toggles between free-fly camera and walking mode
- Walk mode: eye height 1.7m, radius 0.4m, gravity 20 m/s², jump 7.5 m/s
- **Collision optimization**: Axis-separated AABB sliding against the **3×3 neighboring cells** only (max 9 buildings tested). Grid math determines which cell the player is in, queries building data for those 9 cells via the pure layout function, no iteration over all loaded geometry.

### Interiors

- Press `E` near a ground-floor door (walk mode only)
- **Procedural floorplan**: 2D BSP tree subdivides building footprint into Lobby, Office, Meeting Room, Break Room, Server Room with 2m doorways
- **Separate scene**: Interior geometry built on enter, rendered in a dedicated `THREE.Scene` with point lighting, fully disposed on exit
- **Props**: Low-poly desks, chairs, monitors, conference tables, server racks placed procedurally based on room type
- Exit door returns player to saved exterior position

### NPCs & Traffic

**Dual-layer NPC simulation**:
- **Far NPCs** (outside active radius): Position computed in **closed-form** from daily schedule + simulation time. No physics, no updates, zero overhead.
- **Near NPCs** (within ~2 chunks): Full kinematic simulation, rendered via 1 shared `InstancedMesh`, emit state-change events.

**Daily schedule**: Home (midnight–7am) → Commute → Work (8:30am–5:30pm, with 12–1pm lunch walk) → Commute → Leisure (7–10pm) → Home

**Traffic**: 64 cars following the road graph network (lanes at 72m grid boundaries), deterministic movement, 1 `InstancedMesh` = 1 draw call.

### Search & Persistence

- **Building search**: Press `K` or `/` to open modal, fuzzy search by address or building ID, set waypoint beacon or instant teleport
- **Waypoint beacon**: Glowing 120m vertical cylinder marker with floating diamond, animated rotation and bob
- **IndexedDB persistence**: Native browser storage (zero dependencies), saves **seed + player position/mode + simulation time + deltas only**. Never saves the full world. Auto-saves every 30 seconds.

### Event Bus & Event Log

Every system emits structured events:

```javascript
{ t, type, actorId, locationId, data }
```

- `t`: Deterministic simulation time (not `Date.now()`)
- `type`: `'time_changed'`, `'door_entered'`, `'npc_state_changed'`, etc.
- `actorId`: `'player'`, `'npc_12345'`, or `'system'`
- `locationId`: Chunk key, building ID, or `'world'`
- `data`: Event-specific payload

**Event log**: Circular buffer (last 500 events), in-game viewer (`L` key) with type filters and actor search. This exists as the foundation for a future SOC-style SIEM dashboard and CTF forensics layer.

### Diagram

```
Player Input → Player Controller → Physics (AABB) → Camera Update
                      ↓
             Chunk Manager (streaming queue)
                      ↓
           Exterior Scene ← Traffic ← NPC Renderer
                      ↓
              Event Bus (structured events)
                      ↓
               Event Log (circular buffer)
                      ↓
           UI (Debug, Search, Event Viewer)
```

## Run It Locally

Requires Node.js (tested on v20+, likely works on v18+).

```bash
npm install
npm run dev      # Development server at http://localhost:5173
npm test         # Run 43 automated tests
npm run build    # Production build to dist/
```

## Controls

| Key | Action |
|-----|--------|
| `WASD` | Move (camera-relative horizontal in fly, walk plane in walk mode) |
| `Shift` | Run (walk mode) / Boost (fly mode) |
| `Space` | Jump (walk mode) / Fly up (fly mode) |
| `C` | Fly down (fly mode only) |
| `V` | Toggle walk / fly mode |
| `E` | Enter / exit building door (walk mode, when near door) |
| `K` or `/` | Open building search & waypoint modal |
| `L` | Toggle event stream log viewer |
| `P` | Pause simulation time |
| `[` | Scrub time backward 1 hour |
| `]` | Scrub time forward 1 hour |
| `F3` | Toggle full debug HUD (FPS, draw calls, triangles, geometries, textures, chunks, position, time, controls) |
| `F4` | Toggle quick telemetry overlay (draw calls, triangles, geometries, textures, loaded chunks, FPS) |
| Click canvas | Lock pointer for mouse look |

## Performance Budget

| Metric | Budget | Measured |
|--------|--------|----------|
| Draw calls | < 200 | **53 max** (~23–33 visible after frustum culling) |
| Frame time | < 16ms (60fps) | Target (not measured; visual playtesting confirms 60fps on integrated GPU) |
| Triangles | — | ~64,500 |
| Textures in VRAM | — | **1** (shared window canvas texture) |
| Geometry/texture counts while flying | Must stay flat | **Flat** (verified via F3 overlay during extended flight) |

Press `F3` or `F4` in-game to see real-time `renderer.info` metrics.

## Roadmap

### Built (Phases 1–6 Foundation Complete)

- ✅ Infinite procedural city with deterministic chunk streaming
- ✅ Day/night cycle with smooth window emissive and calibrated lighting
- ✅ Fly camera and walk mode with gravity/jump/collision
- ✅ Enterable buildings with procedural BSP interiors
- ✅ Road network, traffic simulation, NPC daily schedules
- ✅ Building search, waypoint markers, instant teleport
- ✅ Native IndexedDB persistence (seed + player state + deltas)
- ✅ Structured event stream and in-game log viewer

### Planned (Not Yet Built)

**Visual Pass**
- Distance fog and sky gradient
- Tone mapping and color grading
- Building color variety per district
- Sidewalks and crosswalks

**Prop Layer**
- Street lamps (instanced)
- Trees and benches (instanced)
- Signs and awnings per building type

**Vehicle & Character Models**
- Replace box cars with low-poly vehicles (instanced)
- Low-poly NPC character models with cheap animation cycles

**Building Variety**
- Modular facades (commercial, residential, industrial)
- Building type signage
- Multi-floor staircases in interiors

**Interior Prop Upgrade**
- Richer furniture library
- Room-specific detail props (filing cabinets, bookshelves, water coolers)

**Asset Pipeline**
- Source CC0 packs: Kenney, Quaternius, KayKit
- glTF with meshopt compression
- Optional: open-source image-to-3D tools (TripoSR, Rodin, etc.) with Blender cleanup
- Rules: one art style, tight triangle budgets, shared materials

**Security Layer (Phase 6 Expansion)**
- SOC-style dashboard fed by the event stream
- Seeded CTF incidents: insider data theft, badge cloning, tailgating, unauthorized access
- Forensics via door logs, CCTV timestamps, NPC witness statements
- AI features: anomaly detection on city event logs, LLM-driven NPC dialogue for investigations

## Known Issues

1. **Vite bundle size warning**: Three.js brings the production bundle to ~575kB uncompressed (~147kB gzip). Can be code-split with dynamic `import()` if needed.

2. **Door placement on corner buildings**: Doors currently select one of four cardinal walls. Corner buildings at chunk boundaries may place doors on secondary faces.

3. **Single-floor interiors**: Interior generator creates ground-floor floorplans only. Multi-story buildings with staircases planned but not implemented.

4. **No asset attribution UI**: Current build has no texture credits screen. When CC0 packs are added, attribution will be shown in a dedicated in-game panel.

## Credits & License

Built with:
- [Three.js](https://threejs.org/) (3D rendering)
- [Vite](https://vite.dev/) (build tool)
- [Vitest](https://vitest.dev/) (testing)

AI-assisted development with [Claude Code](https://claude.ai/claude-code), directed and verified by me.

See the [Larp-Lab repository LICENSE](../../LICENSE) for licensing terms.
