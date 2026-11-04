# SOCIAL ENGINE — TECHNICAL_SPEC.md

Version 1.0 | 2026-11-03 | Proposed, pending source audit

## Mandatory prerequisite
Before implementation, inspect the current TarikLab repository and the TC SIM, TC SIM Boardworld and Racon Manager source, dependencies, routes, state models, saves, assets, tests and deployment. Record commit SHA, baseline tests, dependency graph, existing framework, bundler, renderer, and reusable components in `docs/social-engine/REPO_AUDIT.md`. This document is a proposed specification, NOT a claim that current code has been inspected. Reuse only audited, licensed, stable utilities behind isolated interfaces. Never change or break existing games, their routes or their save data. New route `/oyna/social-engine` and isolated IndexedDB namespace. Feature flag disabled until acceptance.

## 1. Repository and integration
Default: independent `src/games/social-engine` module in existing monorepo, lazy-loaded route, scoped CSS and assets. Adapt actual paths after audit. Alternative: separate repo/microfrontend, only if current build architecture requires stronger isolation. Avoid shared mutable state, global input listeners, cross-game imports and untested shared refactors. Regression tests for all three existing games are a release gate.

## 2. Rendering choice
Provisional **PixiJS**, compatible version determined from lockfile and proof of concept, for GPU sprite batching, atlas support and custom isometric depth. **Phaser** alternative if existing repo uses it and identical-scene benchmark shows lower integration risk. **Three.js** only if true 3D becomes necessary; **Canvas2D** fallback only for limited scenes. Compare startup gzip, frame p95, memory, implementation complexity and context loss behavior on identical 100-visible-agent benchmark. No final engine decision before PoC.

## 3. Modular TypeScript
Strict TypeScript, ESM, typed public contracts and dependency injection. `domain` is pure and never imports DOM, Pixi or storage. `simulation` owns clock, PRNG and event ordering. `rendering` consumes read-only projections. `persistence` serializes and validates. `ui` owns HTML HUD. `app` wires modules. Enforce import boundaries in CI. Avoid ECS framework unless profiling proves its value; consider structure-of-arrays for hot NPC data.

## 4. Simulation and rendering
Fixed-step 10 Hz simulation (`SIM_STEP_MS=100`), seeded PRNG, integer tick and deterministic ordering. 60 Hz render uses interpolation; `requestAnimationFrame` never advances authoritative time. Cap catch-up to five ticks per visual frame, then controlled slow mode and warning. Tab-hidden policy defaults to pause. Separate CPU timers for sim tick, render, UI and IPC. No state mutation in render callbacks.

## 5. Isometric coordinates and camera
World coordinates in consistent logical units. Projection `screenX=(x-y)*tileWidth/2`; `screenY=(x+y)*tileHeight/2-z*heightScale`. Inverse transform and picking tested. Proposed 64×32 display tile, camera translation/zoom/DPR matrices, zoom 0.75–1.75 after usability test. Stable depth sort by `x+y`, layer and ID; occluder fading, frustum culling and chunk unload.

## 6. Map, collisions and pedestrian navigation
Chunked 32×32 logical tile map, separate ground, sidewalk, collision, navigation, building entrance and decorative layers. Tiled export or versioned custom JSON. Static polygon collisions with spatial hash; moving agent swept circle. Pedestrian graph with doors/crosswalks, local A*, hierarchical routing across chunks, route cache invalidation, no diagonal corner cutting, local avoidance, unreachable-destination fallback. Pathfinding requests rate-limited; never run full A* every frame.

## 7. Vehicles and traffic
Separate directed vehicle lane graph: turns, signals, intersections, parking and speed limits. Lane following, junction reservations and bounded local car-following. Sidewalk and roadway graphs connect only at defined crossings/transit portals. Offscreen traffic coarse-scheduled. Test disconnected lanes, deadlocks, crossings, reroutes and pedestrian safety. Active traffic count depends on measured performance.

## 8. NPC AI and timers
100 high-fidelity nearby active NPC target; 1,000 background NPCs retain full identities and economic/social state but use coarse updates. Tier A: 10 Hz nearby movement; Tier B: 1 Hz district behavior; Tier C: event-based remote updates. Priority queue indexed by tick and stable entity ID, not per-NPC JS intervals. Utility AI + FSM with cooldown, hysteresis and bounded decision evaluations. Daily sleep/work/travel/shop/social schedules, local knowledge and bounded event memory. Reconcile coarse updates deterministically.

## 9. Web Workers
Dedicated module Worker owns simulation, main thread owns Pixi, input, HUD and audio. Versioned command and delta messages; batch updates, structured clone initially, transferable ArrayBuffers only if profiling supports. SharedArrayBuffer requires deliberate cross-origin isolation and is not a default. Worker crash pauses simulation, retains last valid snapshot and offers safe restart. Main-thread fallback uses lower NPC fidelity. Measure worker CPU and IPC separately.

## 10. State management
Three distinct states: authoritative `SimulationState`, derived `RenderProjection`, transient `UIState`. Validated commands applied at tick boundaries; command IDs ensure idempotency. UI uses existing audited framework store, not a new state dependency by default. Rendering receives bounded deltas rather than full state copies each frame. Pause and resume semantics explicit.

## 11. IndexedDB saves
Database `tariklab-social-engine`; stores `slots`, `revisions`, `migrationJournal`. Envelope fields: `schemaVersion`, `gameVersion`, `slotId`, `revisionId`, `worldSeed`, `tick`, `createdAt`, `encoding`, `byteLength`, `sha256`, `payload`. Snapshot at tick boundary, checksum, write new revision in atomic transaction, validate then update active pointer. Preserve at least one previous verified revision. Autosave debounce, manual save, import/export, quota errors, interrupted write and corruption recovery. Never overwrite last good revision with invalid data.

## 12. Schema versioning
Pure sequential migrations `vN → vN+1` with golden fixtures and runtime validators. Migrate a copy, check IDs, relationship links, ownership and money totals, commit only after validation. Failure leaves source bytes untouched. Reject unsupported future schemas without silent downgrade. Do not touch TC SIM/Boardworld/Racon Manager save formats.

## 13. Atlas and asset pipeline
Only original or properly licensed redistributable assets. Maintain `ASSET_LICENSES.md` with creator, source, license, attribution and modification history. Consistent isometric pivot, scale, lighting and shadows. Separate terrain/buildings/people/vehicles/UI atlases and load per district. WebP vs PNG tested for quality and decode; atlas padding/extrusion prevents bleeding. Start with 2048px maximum texture and verify hardware; check duplicates, orphans, oversized files and missing licenses in CI. Unload unused textures and use placeholders for missing optional art.

## 14. Audio
Web Audio API with gesture unlock, music/ambience/effects/UI gain buses, mute and per-category volume. Lazy music loading, capped simultaneous sources, distance attenuation only if needed. Game remains fully playable muted. Subtitle/text equivalent for critical audio. No unlicensed music or effects.

## 15. UI and accessibility
HTML semantic HUD and menus, visible focus, remappable keyboard actions, readable contrast, scalable UI, reduced motion and non-color-only alerts. Defaults: WASD move, Shift sprint, E interact, M map, I inventory, Esc pause. Disable gameplay hotkeys while text fields have focus. Test keyboard-only, 1280×720, 1920×1080 and 200% browser zoom. Document limits of screen reader access to real-time canvas action.

## 16. Missions
Versioned data-driven mission FSM with prerequisites, triggers, rewards, deadlines, failure/retry. Domain events such as `NpcMet`, `JobCompleted`, `ItemDelivered` and `CrimeReported`, never renderer events. Idempotent reward transaction IDs, persisted mission cursor and graph validation against unreachable nodes and missing references. Original content and separately localized strings.

## 17. Economy and society
Bounded interfaces for households, businesses, jobs, inventory, housing, relationships, memory, knowledge and event ledger. Money stored as integer minor units, validated transfers and deterministic rounding. Wages, rent, consumption, production, unemployment and stock update on scheduled ticks. Coarse background NPC simulation must preserve accounting invariants and causal consistency. Living Society Engine connects through domain contracts, never UI/render imports.

## 18. Errors and recovery
| Error | Policy |
|---|---|
| Asset missing | Placeholder, bounded retry |
| Navigation unreachable | Idle or nearest reachable destination |
| Worker failure | Pause, retain valid snapshot, safe restart |
| Save corruption | Verify and offer previous good revision |
| Quota exceeded | Preserve in-memory state, offer export |
| Domain invariant failure | Halt authoritative tick, log diagnostic |
| WebGL context loss | Pause, attempt restore, safe exit |
| Production regression | Disable game feature flag or rollback deployment |

Typed error codes, bounded logs, no raw personal data in diagnostics, opt-in telemetry.

## 19. Test architecture
Unit: projection/inverse, PRNG, scheduler, collision, navigation, ledger, missions. Property-based: unique IDs, ownership, money invariants, save round-trip. Determinism: replay fixed seeds and compare state hashes at 1/7/30/365 simulated days. Load: 100 active plus 1,000 background NPCs. Persistence: checksum, interrupted transaction, quota, migration, corrupted revision, import/export. Browser E2E: launch, move, interact, mission, save/load, pause/resume, tab hidden, worker crash, context loss, keyboard HUD. Full existing-game regression is mandatory.

## 20. GitHub / Cloudflare CI-CD
Feature branch → draft PR → lockfile install → typecheck → lint/import boundaries → unit/property → deterministic simulation → migration/save → asset/license validation → production build/bundle budget → Playwright smoke → existing-games regression → Cloudflare preview. Verify existing Cloudflare Pages/Workers configuration from audit, do not assume deployment type. Immutable content-hashed assets, short-lived HTML/manifest, route-level code splitting. Production promotion requires verified acceptance and authorization. Smoke test deployed URL, record SHA/build ID, maintain rollback and flag-off procedure. CI success alone is not proof of healthy production.

## Performance budgets (provisional, not measured)
| Metric | Initial acceptance budget | Measurement |
|---|---|---|
| Desktop frame | 60 FPS target; p95 ≤16.7 ms | 5-minute dense-scene trace |
| Low-end frame | ≥30 FPS; p95 ≤33.3 ms | Integrated GPU, 1280×720, DPR 1 |
| Simulation | 10 Hz; tick p95 ≤4 ms, p99 ≤8 ms | Worker CPU timer, 100+1000 NPC |
| Render + UI main-thread | p95 ≤10 ms/frame | Browser performance trace |
| IPC/projection | p95 ≤2 ms/update | Worker roundtrip/delta instrumentation |
| JS heap | ≤256 MiB target at first district | Chrome heap after 10-minute soak |
| Total browser process memory | ≤600 MiB target, device-dependent | Browser process metric where available |
| Initial route JS | ≤250 KiB gzip incremental | Bundler stats, exclude shared cached vendor explicitly |
| Initial playable assets | ≤3 MiB compressed transfer target | Cold cache network trace |
| First district on-demand assets | ≤12 MiB compressed transfer target | Manifest sum and cold cache trace |
| Save round-trip | p95 ≤1 s for representative save | 20 saves, warm and cold load |
| Long run | 30-minute soak without sustained heap growth | Heap trend + event loop stalls |

Budgets are **hypotheses** until tested. Log OS, CPU/GPU, browser, DPR, viewport, commit SHA, scenario, cold/warm cache, sample count and p50/p95/p99. Keep simulation and rendering traces separate. GPU memory often cannot be measured accurately in web APIs: report estimates, not invented readings. If targets fail, reduce visual density or simulation fidelity by explicit tiering, not by silently deleting world state.

## Proposed folder structure (subject to audit)
```text
src/games/social-engine/
  index.ts
  app/
  domain/{npc,economy,society,missions,world}/
  simulation/{clock,scheduler,systems,prng}/
  worker/{entry,protocol}/
  navigation/{pedestrian,vehicle}/
  rendering/{camera,tiles,sprites,atlas}/
  input/
  ui/
  audio/
  persistence/{db,codec,migrations,validation}/
  telemetry/
  tests/{unit,integration,e2e,fixtures,benchmarks}/
public/games/social-engine/
docs/social-engine/{TECHNICAL_SPEC,REPO_AUDIT,PERFORMANCE_BASELINE,ASSET_LICENSES,RELEASE_CHECKLIST}.md
```

## API contracts (illustrative)
```ts
type Command =
  | { v: 1; id: string; type: 'MOVE_TO'; entityId: string; x: number; y: number }
  | { v: 1; id: string; type: 'INTERACT'; actorId: string; targetId: string }
  | { v: 1; id: string; type: 'PAUSE'; paused: boolean };
type WorkerRequest =
  | { v: 1; type: 'INIT'; seed: number; save?: Uint8Array }
  | { v: 1; type: 'COMMANDS'; commands: Command[] }
  | { v: 1; type: 'SNAPSHOT_REQUEST'; requestId: string };
type WorkerResponse =
  | { v: 1; type: 'READY'; tick: number }
  | { v: 1; type: 'DELTA'; tick: number; entities: EntityProjection[] }
  | { v: 1; type: 'SNAPSHOT'; requestId: string; tick: number; data: Uint8Array }
  | { v: 1; type: 'ERROR'; code: string; recoverable: boolean };
type EntityProjection = { id: string; x: number; y: number; z: number; facing: number; animation: string };
interface SimulationEngine { initialize(seed: number): void; enqueue(command: Command): void; step(): void; snapshot(): Uint8Array; }
interface SaveRepository { commit(slotId: string, data: Uint8Array): Promise<string>; loadVerified(slotId: string): Promise<Uint8Array>; }
```
Validate messages at runtime; unknown protocol versions fail safely. Commands processed on tick boundary, duplicates ignored. Domain events and save bytes are versioned separately from IPC.

## Risk register
| Risk | Severity | Mitigation / gate |
|---|---|---|
| Unverified existing repo architecture | Critical | Audit and baseline before implementation |
| Existing games regress | Critical | Isolated route/storage + full regression CI |
| NPC scale degrades FPS | High | Fidelity tiers, fixed budgets, worker benchmarks |
| Save corruption/migration loss | Critical | Checksums, atomic revisions, golden fixtures |
| Worker IPC overhead | Medium | Delta batching and measured fallback |
| Browser GPU/texture limits | High | Atlas tiers, culling, context-loss test |
| Traffic/pathfinding deadlocks | High | Graph validation, deterministic replay |
| License violation | Critical | Asset provenance gate in CI |
| Oversized bundle | High | Route split, dependency audit, gzip budgets |
| Cloudflare cache mismatch | High | Hashed assets, preview smoke, rollback |
| Scope creep | High | Vertical slice acceptance before expansion |

## Development sequence and gates
1. **Audit:** source/reuse matrix, baseline tests, build, asset licenses, deployment mapping. Gate: no unverified assumptions.
2. **Technical spike:** PixiJS vs audited alternative, isometric transform, 100-agent rendering, actual size/FPS measurements. Gate: select engine.
3. **Vertical slice:** one walkable block, camera, input, collision, pathfinding, 10 NPC, enterable building, basic HUD. Gate: stable 60/30 FPS profiles.
4. **Deterministic core:** worker, tick, 100 active + 1,000 background, utility AI, scheduling and replay tests. Gate: simulation budgets and hashes.
5. **Living Society:** household, jobs, business, money ledger, relationships, memory and economy. Gate: invariant tests and multi-day replay.
6. **Traffic and missions:** lane graph, crossings, vehicles, mission FSM, reward idempotency. Gate: no route deadlocks in test scenarios.
7. **Persistence:** IndexedDB revision commits, migrations, export/import and fault injection. Gate: no loss of last-good save.
8. **Content and polish:** licensed atlases, animation, audio, accessible HUD, district lazy loading. Gate: asset/license/bundle budgets.
9. **Production hardening:** 30-minute soak, browser matrix, CI, existing game regression, Cloudflare preview and rollback rehearsal. Gate: explicit release checklist.
10. **Controlled production:** flag on, deployed smoke test, SHA verification, performance monitoring and rollback readiness. Gate: production acceptance recorded.

**Definition of done:** Not a screenshot or a green build alone. Reproducible deterministic simulation, validated saves/migrations, licensed assets, measured budgets, passing existing-game regressions, verified deployed route, and documented rollback are all required.
