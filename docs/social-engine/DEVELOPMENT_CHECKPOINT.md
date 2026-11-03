# SOCIAL ENGINE — repository audit and execution checkpoint

Date: 2026-11-03
Base main commit: `d695119186cad42c079a911a60c372f201b3b64b`
Branch: `feature/social-engine-foundation-20261103`
Status: AUDIT ONLY. No playable implementation, tests, PR, or deployment claimed.

## Verified architecture
- Vite, React, TypeScript, TanStack Router, PixiJS 8.21.0, Playwright are installed in package.json.
- Existing isolated static game directories: `public/games/tc-sim`, `public/games/tc-sim-boardworld`, `public/games/racon`.
- Boardworld includes `engine.mjs`, `persistence.mjs`, `save-codec.mjs`, `daily-flow.mjs`, `life-systems.mjs`.
- Racon includes `map-model.js`, `map-view.js`, `network.js`.
- Existing workflows include `ci.yml`, `ci-full-regression.yml`, `cloudflare-production.yml` and game-specific quality checks.

## Required input gaps
The exact named files VISUAL_STYLE.png, GAME_UI.png, WORLD_MAP.png, CHARACTER_REFERENCE.png, WORLD_ASSETS.png, GAME_DESIGN.md, SOCIETY_ENGINE.md, TECHNICAL_SPEC.md, ACCEPTANCE_TESTS.md were not present under those names in the recursive main tree at audit time. Search other branches or provide them before final art/content acceptance. Do not pretend chat-generated references are committed assets.

## Decisions
1. Create isolated `public/games/social-engine/` game assets/modules and register a dedicated `/oyna/social-engine` route through existing routing conventions after inspecting `src/lib/games.ts` and router.
2. Separate deterministic simulation (fixed-step, seeded RNG, serializable state) from rendering/input.
3. Use existing PixiJS dependency when compatible with current asset/build delivery; do not copy existing games wholesale.
4. Preserve TC SIM, Boardworld and Racon files and existing save namespaces.
5. Initial target: 100 active / 1000 background citizens, contingent on browser measurements.
6. Do not merge/deploy before functional acceptance, regression and performance evidence.

## Next executable steps
1. Read AGENTS.md, AGENTS.project.md, src/lib/games.ts, relevant route, CI and existing game modules.
2. Locate or import required references and write a traceable acceptance matrix.
3. Implement world, movement, NPC interaction and persistent state in isolated modules.
4. Integrate economy/social/crime/vehicles/missions incrementally with automated tests.
5. Run full CI, browser smoke, soak tests and measured performance; create PR only after meaningful implementation.

## Evidence not yet collected
No FPS, heap, bundle, simulation timings, regression results, live URL verification or CI results. These must be measured, not estimated.
