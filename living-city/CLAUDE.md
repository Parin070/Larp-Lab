# Living City

Browser low-poly 3D city. Procedural. Enterable buildings, NPC schedules, day/night.
Later: SOC dashboard, CTF, forensics layer.
Target: normal laptop, open URL, 60fps. Static hosting only. No backend.

## Stack
- Vanilla JS + Three.js + Vite
- IndexedDB for save
- Vitest for tests
- No physics engine. No heavy deps. Ask before adding any dependency.

## Commands
- `npm run dev` dev server
- `npm run build` production build
- `npm test` run tests

## Architecture
- `src/core/` loop, renderer, camera, input
- `src/world/` chunks, roads, buildings, generation
- `src/interiors/` room generator, loaded on enter only
- `src/sim/` NPCs, schedules, traffic, time
- `src/events/` event bus
- `src/ui/` HUD, search, later SIEM dashboard
- `src/save/` IndexedDB persistence
- `tests/` determinism and unit tests

## Hard rules
- Never use `Math.random()`. Use seeded PRNG (mulberry32) from `src/core/rng.js`.
- Same seed = same world. Sim must be deterministic.
- Every system emits events via event bus. Schema: `{ t, type, actorId, locationId, data }`. Plain JSON.
- Use InstancedMesh for repeated objects. Merge static geometry per chunk.
- Dispose geometry, materials, textures on unload. Interiors fully disposed on exit.
- Chunk size 64m. Load radius 3. Unload outside.
- Collision: grid + AABB only.
- Far NPCs: no sim. Compute position from schedule + time.
- Save only seed + player state + deltas. Never full world.
- No shadows until phase 2 perf is solid. Use blob decals.

## Perf budget
- Draw calls < 200
- Frame time < 16ms on integrated GPU laptop
- Keep `renderer.info` overlay toggle (F3). Check after every feature.

## Phases
1. Flat grid city, instanced boxes, day/night, free camera
2. Chunk streaming, seeded generation, 60fps check
3. Enterable buildings, room generator
4. NPC schedules, road graph, traffic
5. Search, save/load
6. Event stream, SIEM dashboard, CTF incidents

Current phase: 6 (Phases 1-5 complete, Phase 6 event stream foundation complete)
Work one phase at a time. Do not start next phase without being told.
Commit after each working feature.

## Workflow
- Plan first for any task touching more than 2 files. Show plan, wait.
- Write test for determinism when adding generation code: same seed, same hash.
- Run `npm test` and `npm run build` before saying done.
- Keep files small. Split at ~300 lines.
- No comments explaining obvious code. Comment only why.
- Update "Current phase" line when phase done.