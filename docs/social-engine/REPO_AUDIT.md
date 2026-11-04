# SOCIAL ENGINE repository audit

Audit date: 2026-11-03. Repository: `tayaz-maker/tariklab`. Audited foundation SHA: `762c050ead437c99901332d10078817dfc375eb1`; base main SHA: `d695119186cad42c079a911a60c372f201b3b64b`. The foundation branch differs from that main only by `docs/social-engine/DEVELOPMENT_CHECKPOINT.md`. No playable SOCIAL ENGINE implementation existed at audit start.

The task uses its own directory and `feature/social-engine-development`. Working tree was clean at audit start. The latest user instruction forbids automatic merge, production deployment, production traffic changes, and modifying another agent's work. This audit made no changes to legacy game sources, shared configuration, branches, PRs, or deployments.

## Verified stack and routes

`package.json`, `package-lock.json`, `tsconfig.json`, and `vite.config.ts` establish React 19, TypeScript strict mode, Vite 8, TanStack Start/Router, Nitro, PixiJS **8.21.0**, Playwright, and Wrangler. Exact locked versions and source fingerprints are in `artifacts/social-engine/inventory.json`.

The existing game route `src/routes/oyna.$slug.tsx` is client-only and mounts `/games/{canonical}/index.html` in an iframe. `src/lib/games.ts` supplies `GAMES`, `HTML5_SLUGS`, aliases, and categories. Merely adding a public folder does not expose `/oyna/social-engine`: the generic route rejects unknown slugs. An independent exact route can lazy-load SOCIAL ENGINE without touching the generic route. Minimal catalogue integration may follow as an isolated integration change after checking current remote changes. Preserve all existing aliases and entries.

`src` and `server` are covered by strict TypeScript with `checkJs`; unbundled modules under `public` are not automatically typechecked. An isolated TypeScript game therefore needs an explicit build/typecheck path if delivered as public assets. Static public game assets are preserved by the existing Nitro build. The Boardworld post-build packer only targets `games/tc-sim-boardworld`; it must not be reused by altering its target.

## Legacy engine and save review

| Source | Audited behavior | SOCIAL ENGINE decision |
|---|---|---|
| `public/games/tc-sim/js/state.js`, `time.js`, `life.js` | Weekly adult life simulation, employment, transactions, relationships, validated state; save version 6 | Reuse design lessons about guarded actions and exact-once payments. Its week-driven state and units are incompatible with continuous movement and a balanced integer-kuruş ledger. No cross-game imports. |
| `public/games/tc-sim/js/save.js` | Three slots, primary/backup, pure version migrations, legacy slot import | Preserve every key. Adapt the last-good-revision and migration-before-write pattern to independent IndexedDB. Do not import normalization code. |
| `public/games/tc-sim-boardworld/engine.mjs` | Single gameplay writer, deterministic integer clock, seeded LCG, serializable game state; modular life/city/social systems | Strong reference for separating command execution from UI. Domain modules depend on Boardworld IDs and state shapes; no safe wholesale engine reuse. SOCIAL ENGINE requires its own authoritative fixed-step engine. |
| `public/games/tc-sim-boardworld/daily-flow.mjs` | Routine blockers, consent/settlement boundary, action outcomes | Reuse explicit validation and transaction-boundary concepts, not code coupled to Boardworld state. |
| `public/games/tc-sim-boardworld/life-systems.mjs`, `society-systems.mjs` | Employment/lease identity, secondary people, sparse relations, knowledge gating, invitation lifecycle | Reference causal social/economic linkage and stable contract IDs. These modules import Boardworld content and must remain isolated. |
| `public/games/tc-sim-boardworld/save-codec.mjs` | Pure lossless string dictionary codec; bounded depth/nodes, safe property decoding | Eligible algorithm reference if save size measurements justify compression. Do not import from another game or add compression before measuring. |
| `public/games/tc-sim-boardworld/persistence.mjs` | Validates old bytes before migration, prior-version backups, compact exports, recovery | Reference robust recovery semantics; current checksum/localStorage format does not satisfy new SHA-256/atomic IndexedDB specification. |
| `public/games/racon/network.js` | Pure rule projection through a small API; street orders have immediate, weekly and terminal effects | Reuse causal-action design; its global `RaconAg` and legacy state cannot be a SOCIAL ENGINE runtime dependency. |
| `public/games/racon/map-model.js`, `map-view.js` | Original schematic, pure projection, semantic fallback, lazy Pixi view | Rendering lifecycle and view/model separation are useful. This is not a navigable open-world map or vehicle lane graph. |
| `public/games/shared/pixi-adapter.js` | Same-origin lazy Pixi import, injectable capability checks, explicit destroy, visibility handling; stopped ticker | Existing vendor module can be reused without changes. Do not use the decision-map ticker as simulation time. Prefer a SOCIAL ENGINE-owned lifecycle for animated scenes. |
| `scripts/static-game-server.mjs` | Static test server with MIME types, explicit 404s, path containment | Eligible test-only helper; source/build smoke should exercise real emitted files. |

The review found no audited open-world pedestrian collision/navigation or vehicle lane engine suitable for direct reuse. New collision, map and lane data are required; concept images are not machine-readable navigation.

### Save namespaces that must remain untouched

- TC SIM: `tc-sim-save`, `tc-sim-save-backup`; `tariklab::tc-sim:{1,2,3}`, per-slot `:bak`, `:active`, and `:legacy-migrated`.
- Boardworld: `tariklab.boardworld.v6` and `.backup`; v1–v5 keys, backups and original migration archives.
- Racon: `racon_v1`, `racon_v1_bak`; `tariklab::racon:{1,2,3}`, per-slot `:bak`, `:active`, and `:legacy-migrated`.
- SOCIAL ENGINE: new IndexedDB database **`tariklab-social-engine`** only. No legacy save discovery, conversion, deletion or global storage clearing.

## Assets, licensing and audio

`LICENSE` reserves TLab rights. The user's explicit instruction authorizes evaluating and reusing this repository's code within TarikLab; it is not an external redistribution license. The existing official Pixi build is `public/vendor/pixi/pixi-8.21.0.min.mjs`; its MIT notice/provenance lives in `docs/ip/THIRD_PARTY_NOTICES.md` and `docs/TARIKLAB_PIXIJS_MAP_STATUS.md`, with vendor tests in `scripts/pixi-vendor.test.mjs`. Preserve the vendor bytes and notices.

The existing asset register is `docs/ip/ASSET_REGISTER.csv`. New art must have its own SOCIAL ENGINE manifest and provenance. None of the attached concept illustrations is an executable atlas or collision map. `AGENTS.project.md` says audio remains disabled and native/Godot work is paused; do not introduce audio or native work as a prerequisite. It also requires appending `docs/WEB_APP_SYNC_LEDGER.md` after meaningful website changes; perform that minimal shared-file edit during centralized integration, preserving any concurrent additions. Shared artwork parity uses `tayaz-maker/tariklab-content`; this audit has not verified that separate repository.

## CI and deployment

`vite.config.ts` explicitly selects Nitro **`cloudflare-module`**, while `wrangler.json` names Worker **`tariklab`** and custom domain **`www.tariklab.com`**. These source/config facts supersede stale generic Vercel prose in `AGENTS.md`; they do not prove current live deployment identity.

`scripts/cloudflare-deploy.mjs` requires full main SHA, latest successful exact-SHA `ci.yml` and `tc-job-start-outcome.yml` runs, and rechecks main immediately before Wrangler production publication. It rejects feature branches and identifies `wrangler versions upload` as the preview path. Do not invoke its production path under the current user lock. Provider deployment ID, actual alias, preview credentials and live SHA remain **UNVERIFIED** in this audit.

Existing CI coverage:

- `ci.yml`: PR/main build, strict typecheck, lint, browser regression and sharded unit tests.
- `ci-full-regression.yml`: scheduled/manual broad regression.
- `boardworld-quality.yml`: every PR/main, deterministic/save tests, build and five browser suites.
- `tc-job-start-outcome.yml`: PR/main protected TC SIM test/build/browser gate.
- `racon-quality.yml`: path-filtered; a SOCIAL ENGINE-only PR does not automatically trigger its complete suite. Run existing Racon tests explicitly for new-game acceptance.
- `cloudflare-production.yml`: explicitly dispatched verification of an expected published main SHA; it does not authorize publishing a feature branch.

`scripts/ci-changes.mjs` fails closed to full coverage for unknown paths including SOCIAL ENGINE. `scripts/ci-test-plan.mjs` always includes unowned top-level `scripts/*.test.mjs`. A new `scripts/social-engine-*.test.mjs` wrapper can join existing unit CI without weakening selectors or changing workflows. New browser/soak acceptance still needs its own reproducible runner and evidence.

## Executed baseline

Executed on the audited foundation SHA using Node v24.21.0 on the local macOS arm64 host:

```sh
node --test scripts/tc-sim-core.test.mjs scripts/tc-sim-core-integration.test.mjs scripts/boardworld-save.test.mjs scripts/boardworld-save-codec.test.mjs scripts/boardworld-payment-boundary.test.mjs scripts/racon-save-validation.test.mjs scripts/racon-network.test.mjs scripts/racon-map-consequences.test.mjs
```

Result: **199 PASS, 0 FAIL, 0 SKIP**, total runner duration **3247.931375 ms**. Evidence: `artifacts/social-engine/baseline/targeted-node-tests.tap`. This is a targeted baseline, not a claim of full legacy browser/regression acceptance. No new SOCIAL ENGINE acceptance IDs are passed by this run.

The inventory includes SHA-256 fingerprints of all files under TC SIM, Boardworld and Racon at audit start. Compare these after implementation to prove source preservation. Full build, real browser journeys, save namespace isolation from the new game, route-level gzip, memory/FPS, cross-browser and 365-day SOCIAL ENGINE tests remain pending; historical legacy measurements are not valid substitutes.
