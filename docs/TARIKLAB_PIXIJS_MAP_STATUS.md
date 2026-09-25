# TarikLab — PixiJS map modernization status

Source plan: `TARIKLAB_PIXIJS_MAP_MODERNIZATION.md` (owner-supplied). Each game's map
renderer is converted in its own PR, in the plan's order. A row is DONE only with a
merge SHA and production evidence.

## License standard

Only MIT/ISC/BSD/Apache-2.0 code, officially-sourced recorded-provenance CC0
assets, or TarikLab's own procedural output. PixiJS is MIT. No CDN, no remote
font, no remote asset, no audio.

- `pixi.js` is pinned exact (no `^`/`~`) in `package.json`.
- The browser-facing file is a **byte-identical copy** of the official prebuilt
  `node_modules/pixi.js/dist/pixi.min.mjs`, vendored (not built by our own
  bundler) at `public/vendor/pixi/pixi-<version>.min.mjs`, so nothing about
  PixiJS's own module graph or extension-registration side effects is at risk
  of being subtly broken by a custom tree-shake. `scripts/pixi-vendor.test.mjs`
  enforces the byte-identity and the version pin every run.
- `docs/ip/client-packages.json` lists `pixi.js`; `docs/ip/THIRD_PARTY_NOTICES.md`
  carries its full MIT license text (regenerate with
  `node scripts/ip/third-party-notices.mjs` after any version bump).
- `public/credits.html` and its English/Polish translations
  (`public/i18n/tlab-i18n.js`) name PixiJS as the map render infrastructure and
  report the exact package/license count; `scripts/pixi-vendor.test.mjs` keeps
  that text in sync with `THIRD_PARTY_NOTICES.md` so a future dependency bump
  cannot silently go stale.
- PixiJS's own upstream build bundles code from several of its own npm
  dependencies into the single vendored file. Checked at time of vendoring
  (`node_modules/<pkg>/package.json`): `@pixi/colord` MIT, `@types/earcut`
  MIT, `@webgpu/types` BSD-3-Clause, `@xmldom/xmldom` MIT, `earcut` ISC,
  `eventemitter3` MIT, `gifuct-js` MIT, `ismobilejs` MIT, `parse-svg-path`
  MIT, `tiny-lru` BSD-3-Clause — all within the allowed set, none GPL/AGPL/NC/ND.

## Shared foundation (`public/games/shared/pixi-adapter.js`)

- `supportsPixi()` — capability check (WebGL2/WebGL context creation), fully
  dependency-injected so it is unit-tested under Node without a browser.
- `loadPixi()` — memoized dynamic `import()` of the vendored module; never
  throws, resolves to `null` on failure so callers fall back cleanly.
- `mountPixiScene()` — creates the `PIXI.Application`, mounts its canvas,
  stops the ticker immediately (`autoStart: false`) — these are decision-map
  scenes, not animation loops, so a frame is drawn only when the caller's
  `update()` runs after a real state change — and pauses/resumes the ticker
  around `visibilitychange` for any future scene that does animate.
- `prefersReducedMotion()` — exposed for a future animated scene to skip
  transitions; Kıyı Eşiği's map has none to skip.

Renderer never touches game state: every game's `data -> render model ->
scene` boundary is a small pure function (e.g. `map-model.js`) that both the
PixiJS scene and the existing fallback renderer consume identically.

## Per-game status

| Game | Status | PR | main SHA | Notes |
|---|---|---|---|---|
| **0. Foundation + Kıyı Eşiği proof** | DONE | [#98](https://github.com/tayaz-maker/cete-savaslari/pull/98) | `a46ce8b6ea4a6e28930b904948cdecd0eef015de` | See below. |
| 1. HANEDANIAN | IN PROGRESS | (this PR) | — | See below. |
| 2. Racon Manager | NOT STARTED | — | — | Fictional neighbourhood/network map. |
| 3. TC SIM: DEVLET | NOT STARTED | — | — | Seven abstract regions + external-relations map; clickable regions, capacity/risk overlay. |
| 4. TC SIM | NOT STARTED | — | — | Only if the game genuinely needs a spatial surface; not automatic. |
| 5. JITEM: Derin Ağ | NOT STARTED | — | — | Upstream `jitem-derin-ag` repo first (clean PR there), then a separate TarikLab vendor-sync PR. Save key `jitem-derin-ag-v3` / schema 5 untouched. |
| 6. Other candidates | NOT STARTED | — | — | Only where a real spatial decision surface helps; list/panel games are not converted. |

### 0. Foundation + Kıyı Eşiği — DONE

Merged as [PR #98](https://github.com/tayaz-maker/cete-savaslari/pull/98), main SHA
`a46ce8b6ea4a6e28930b904948cdecd0eef015de`.

Kıyı Eşiği is the plan's own choice of smallest independent map surface: 7
nodes, 8 links, no animation, a self-contained `sim.js` with no dependency on
any other game.

Files:

- `public/games/shared/pixi-adapter.js` — the adapter described above.
- `public/vendor/pixi/pixi-8.21.0.min.mjs` — vendored PixiJS 8.21.0, MIT,
  sha256 `2f69e90f5b1980e6ea244bacfb3fa1eb457e16ddcb0a602b694642658956f2ef`
  (matches `node_modules/pixi.js/dist/pixi.min.mjs` byte-for-byte). Minified:
  828,971 bytes; gzip: 233,008 bytes. Lazily loaded only when the Kıyı Eşiği
  play/report screen actually opens — not on the portal, not on any other
  game.
- `public/games/esik/map-model.js` — `buildMapRenderModel(state)`, the pure
  data → render-model function both renderers consume.
- `public/games/esik/map-pixi.js` — the PixiJS scene: same visual language as
  the existing SVG map (node box colours, dashed water/slope strokes, the
  twin highlight line on an active link).
- `public/games/esik/app.js` — `mapSvg()` now consumes the same render model;
  a persistent map slot picks PixiJS when `supportsPixi()` passes and falls
  back to the existing SVG renderer otherwise, or if PixiJS fails to
  load/init for any reason. The SVG map is shown immediately while PixiJS
  loads (no blank frame), then swapped in place once ready — the WebGL
  context is created once per session, not once per move.

Mechanics, story, save key (`tariklab.kiyi-esigi.v1`) and schema: unchanged.
`scripts/esik.test.mjs`'s existing 4 tests still pass unmodified, plus a new
render-model determinism/coverage test.

Fallback: forcing `supportsPixi()` to fail (no WebGL) leaves the exact
pre-existing SVG map, unreduced — no visitor is excluded.

Tests added this PR: `scripts/pixi-adapter.test.mjs` (9),
`scripts/pixi-vendor.test.mjs` (8), plus 1 new case in `scripts/esik.test.mjs`.

**Browser QA (local, real Playwright/Chromium, static server over `public/`):**

| Scenario | Renderer | Console errors | Horizontal overflow |
|---|---|---|---|
| Desktop 1440×900 | pixi (canvas mounted) | 0 | none |
| Mobile 390×844 | pixi (canvas mounted) | 0 | none |
| Forced no-WebGL (canvas.getContext patched to return null) | svg (fallback) | 0 | none |
| Move → localStorage save → page reload | — | 0 | — |

Save/reload: a move's effect on `tariklab.kiyi-esigi.v1` (period, resource,
line, log) survives a full page reload byte-for-byte; reload returns to the
menu screen exactly as before this change (unrelated to this PR — the app
has never auto-resumed on load).

Visual parity: node box borders now dash with the same per-node water/slope
pattern as the SVG renderer (fixed during this PR's QA — the first draft only
dashed a short segment instead of the whole outline); screenshots compared
side by side, no perceptible difference beyond WebGL vs. vector
antialiasing.

**Performance (median of 5 runs, headless Chromium, cold context each run):**

| Measurement | Result |
|---|---|
| First paint, WebGL forced off (pre-existing SVG-only baseline) | 102.5 ms |
| First paint, PixiJS path enabled | 106.8 ms |
| Delta vs. baseline | **+4.3 ms** (noise-level; SVG placeholder paints first, capability probe deferred past two animation frames) |
| PixiJS canvas swap-in, after first paint (async, non-blocking) | 337.8 ms median |

The capability probe (`supportsPixi()`, which creates a real WebGL context)
was originally called synchronously in the same tick as appending the SVG
placeholder; that held the main thread and delayed the browser's first paint
by ~270 ms even though the SVG node was already in the DOM. Fixed by
deferring the probe-and-mount past two `requestAnimationFrame` callbacks,
which guarantees a paint has already happened. This is documented here
because the same pattern must be followed by every later game's adapter
usage — do not call `supportsPixi()` or `mountPixiScene()` synchronously on
the critical render path.

**Gates:** `npm test` (all suites, 1589/1589), `npm run typecheck` (0
errors), `npm run lint` (0 errors, 58 warnings -- 50 pre-existing baseline
plus 8 unrelated to this PR, spread across the repo; none from the files
this PR touches), `npm run build` (production build succeeds). `eslint.config.mjs` now
excludes `public/vendor/**` (minified vendored code is not source to lint,
same treatment as the existing JITEM assets exclusion). `scripts/silence.test.mjs`
carries a narrow, count-verified exemption for the vendored PixiJS file's
own unused VideoSource (video-texture) feature referencing the DOM
`autoplay` attribute name in its source -- paired with a new test asserting
no TarikLab game ever calls that PixiJS feature.

**Production verification (real Playwright/Chromium against
`https://tariklab.tayaz29.workers.dev`, main SHA `a46ce8b6ea4a6e28930b904948cdecd0eef015de`):**

| Check | Result |
|---|---|
| `/`, `/oyna/esik`, `/games/esik/index.html` | HTTP 200, content renders, 0 console errors |
| `public/games/shared/pixi-adapter.js`, `public/games/esik/map-model.js`, `public/games/esik/map-pixi.js`, `public/vendor/pixi/pixi-8.21.0.min.mjs` | all served, HTTP 200 |
| Desktop 1280×900, Kıyı Eşiği play screen | `data-renderer="pixi"`, canvas mounted, 0 console errors |
| Mobile 390×844, Kıyı Eşiği play screen | `data-renderer="pixi"`, canvas mounted, no horizontal overflow, 0 console errors |
| Polish mode (`localStorage.tariklab.language = "pl"`), Kıyı Eşiği play screen | `data-renderer="pixi"`, canvas mounted, Polish body text rendered (`/i18n/pl-body.js` overlay), 0 console errors |
| Polish-mode portal home | loads, "20 gier dostępnych", 0 console errors |

The PixiJS canvas is confirmed rendering in production, not just in the
pre-merge branch preview, in Turkish, English and Polish modes, at both
desktop and 390 px.

### 1. HANEDANIAN (this PR)

HANEDANIAN's map (`public/games/hanedanian/map.js`, `StrategyMap`) is a
1600-line, already highly-tuned Canvas 2D renderer: a time-sliced procedural
terrain-atlas painter (bezier river beds, canopy masses, contour engraving,
mountain-chain tracing -- `atlasJob`/`atlasSteps` and friends) whose output
is cached per zoom mode and blitted once per `draw()`, plus a large set of
hand-drawn vector overlays (borders, settlements, POIs, armies, threats,
region labels, minimap, compass, scale bar). That overlay system is exactly
the kind of hard-won, artistically-tuned code the plan's "renderer-only,
never rewrite" rule exists to protect -- reimplementing all of it in PixiJS
Graphics would be a large, high-regression-risk rewrite for a system that
was already fast (invalidate()-gated, not a continuous loop) and already
followed the plan's own "static layer cached/render-textured" pattern for
its terrain bitmap.

So instead of a rewrite, this PR does the narrowest thing that is still a
real PixiJS integration with a real, measured benefit: the terrain-atlas
*generation* algorithm is untouched (100% inherited, not duplicated), and
only how that finished bitmap reaches the screen changes.

**Architecture:**

- `public/games/hanedanian/map.js` -- three small, behaviour-preserving
  refactors, verified against its full existing test suite before anything
  else was built on top of them:
  1. `this.ctx = options.context || canvas.getContext('2d', { alpha: false });`
     -- an optional injected context (still opaque by default for every
     existing caller).
  2. `clearCanvas(ctx)` extracted from the top of `draw()` (was three inline
     lines) so a subclass can leave the canvas transparent instead of
     opaque-filling it.
  3. `paintTerrainLayer(ctx, cache, ox, oy, scale)` extracted from the
     `ctx.drawImage(cache, ...)` call so a subclass can render that same
     cache bitmap a different way.
  Nothing else in the file changed -- same atlas generation, same overlay
  drawing, same camera/gesture/keyboard/save wiring.
- `public/games/hanedanian/map-pixi.js` -- `StrategyMapPixi extends
  StrategyMap`. It overrides only `clearCanvas` (transparent), `resize`,
  `resetTerrainCaches` and `paintTerrainLayer` (uploads the *same* cache
  canvas `ensureTerrainCache()` already produced as a `PIXI.Sprite`
  texture, one texture per distinct cache object, reused across pans/zooms
  rather than re-uploaded every frame). Every camera, pointer, pinch,
  keyboard, selection and accessibility method is inherited unchanged.
- `public/games/hanedanian/map-factory.js` -- `createMap()` mounts the
  plain `StrategyMap` synchronously first (identical to today, fully
  interactive immediately), then -- deferred past two animation frames,
  same perf-safe pattern as Step 0 -- probes `supportsPixi()` and, only if
  it passes, mounts a second, WebGL terrain canvas (`map-pixi.js`) stacked
  under a *new* overlay canvas (a canvas's 2D context options lock in on
  first `getContext()` call, so the transparent-context overlay needs a
  fresh element), transfers the camera/selection/layers/guide state the
  player already has, and swaps. `app.js` now imports `createMap`/
  `MAP_LAYERS` from `map-factory.js` instead of `map.js` directly; nothing
  else in `app.js` changed.
- `public/games/hanedanian/style.css` -- `.map-workspace.has-pixi-terrain`
  positions the two stacked canvases; inert (no effect at all) unless the
  swap actually happens, so the default single-canvas layout is untouched
  when Pixi never mounts.
- `public/games/hanedanian/sw.js` -- `map-pixi.js`/`map-factory.js` added
  to the offline package's `FILES` list (both are hard runtime
  dependencies now, online or offline). `scripts/hanedanian-offline.test.mjs`
  gained `pixi-adapter.js` as an `optionalShared` dependency (same
  treatment as `/i18n/pl-body.js`): offline, its dynamic import fails,
  `loadPixi()` resolves to `null`, and `map-factory.js` keeps the Canvas 2D
  `StrategyMap` that already ships in the package.
- `public/games/shared/pixi-adapter.js` -- `mountPixiScene()` gained an
  optional `antialias` parameter (default `true`, so Kıyı Eşiği's existing
  Graphics-based scene is unaffected). HANEDANIAN's terrain scene passes
  `antialias: false`: it is one opaque Sprite with no Graphics edges to
  smooth, and turning MSAA off measurably cut its render cost (below).

Fallback: forcing `supportsPixi()` to fail leaves the exact pre-existing
`StrategyMap` -- terrain, overlays, camera, saves, everything -- unreduced.

**Two real bugs found and fixed during this PR's own QA (not left for
someone else to find):**

1. `app.js` calls `map.resize()` directly (rail-panel toggle, window
   resize) -- the first version of `map-factory.js`'s wrapper didn't proxy
   it, so campaign start threw `map.resize is not a function` in a visible
   error toast on every load once Pixi was enabled. Fixed by adding
   `resize` to the wrapper's proxied method set.
2. A pre-existing, unconditional CSS rule (`#world-map { background:
   #18231b; }`, meant to avoid a blank flash before the Canvas 2D
   renderer's first opaque draw) gave the *overlay* canvas its own opaque
   background. That's invisible in the single-canvas case (the canvas
   always draws fully over its own background anyway), but once the
   overlay became a second, transparent canvas stacked over the WebGL
   terrain layer, that CSS background painted solid over the terrain
   canvas regardless of the 2D context's own alpha -- the map still
   worked (every overlay element drew correctly on top) but the terrain
   looked flat, with all canopy/contour/relief detail hidden underneath an
   opaque near-black fill. Caught by comparing screenshots against the
   Canvas 2D fallback with a **fixed world seed** (the first, unfixed-seed
   comparison was misleading -- different random terrain naturally looks
   different near the capital) and by isolating the terrain canvas alone
   (temporarily hiding the overlay) to confirm the sprite itself painted
   correctly. Fixed by scoping the background rule off under
   `.map-workspace.has-pixi-terrain`.

**Browser QA (real Playwright/Chromium, local dev server, fixed world seed
for visual comparisons):**

| Scenario | Renderer | Console errors | Notes |
|---|---|---|---|
| Desktop 1400×900 | pixi (terrain canvas + overlay canvas) | 0 | Canopy/contour/relief detail matches the Canvas 2D fallback for the same seed. |
| Desktop, WebGL forced unavailable | Canvas 2D fallback only | 0 | No `.map-terrain-host`, no `has-pixi-terrain` class. |
| Mobile 390×844 | pixi | 0 | No horizontal overflow. |
| Move camera → localStorage save → full page reload | pixi (re-mounts cleanly) | 0 | Save data present after reload; Pixi swap happens again on the fresh load. |

**Performance (median of 6 interleaved trials each, headless
Chromium/SwiftShader software rendering -- see caveat below):**

| Measurement | Canvas 2D only | PixiJS enabled | Delta |
|---|---|---|---|
| First paint (`map-workspace` present) | 38.1 ms | 36.2 ms | noise-level |
| Per-draw render cost during a pan gesture (`this.lastRenderMs`, the game's own instrumentation) | 5.6 ms median | 0.9 ms median | **~6× faster**, not a regression |

The per-draw number is read directly from `StrategyMap`'s own
`canvas.dataset.renderMs` (set at the end of every `draw()` call for both
renderers), over 20 real drag frames per trial, 6 trials per condition run
interleaved (fallback, pixi, fallback, pixi, ...) so warm-up/GC/CPU
contention drift affects both conditions equally. An earlier, cruder
measurement (wall-clock time around a whole multi-step drag gesture) showed
Pixi *slower*; that number turned out to be dominated by Playwright's
synthetic-input dispatch overhead, not actual rendering -- the per-draw
number above, read from the game's own timing, is the trustworthy one, and
it matches the expected result: blitting a large (≈3300×3300px near-mode)
cached bitmap is cheaper as a GPU sprite transform than as a repeated
CPU-bound `ctx.drawImage` bilinear scale. Caveat: this ran in headless
Chromium's software (SwiftShader) WebGL rasterizer, not a real GPU --
absolute numbers do not transfer directly to real hardware, but there is no
mechanism by which software-rendered WebGL would be *unrepresentatively
fast* relative to Canvas 2D, so the direction of the result (Pixi cheaper
per draw) is not an artifact of the test environment.

**Gates:** `npm test` (1545/1546, one pre-existing opt-in `DARBE_H_CLOSURE`
suite skipped by design, same as every other run in this repo) +
54/54 TypeScript suite, `npm run typecheck` (0 errors), `npm run lint`
(0 errors, 58 warnings -- unchanged baseline), `npm run build` (succeeds).
`scripts/hanedanian-*.test.mjs` (104 tests, including 9 new PixiJS-specific
unit tests in `scripts/hanedanian-map-pixi.test.mjs`) all pass; the map.js
refactor was verified against the full existing suite before
`map-pixi.js`/`map-factory.js` were built on top of it.

**Production-build verification:** `npm run build` output
(`.output/public`) was served with a plain static file server (bypassing
this sandbox's local Cloudflare Workers preview, which fails to start on
an unrelated, pre-existing issue -- `previewAuthSecret` calling
`crypto.randomBytes` at module scope trips Workers' "no async I/O in
global scope" restriction under this container's `wrangler`/workerd
version; `git log` shows that file already has one dedicated fix commit
for local-preview startup, so this is an environment quirk, not something
this PR touched) and re-run through the same browser QA: PixiJS terrain
mounts, 0 console errors, save/reload works, on the *built* client bundle
containing `map-pixi.js`/`map-factory.js` -- not just the dev server.

## Bitmiş sayılma koşulu (per game, per the plan)

- Opens offline/fallback without changing game data.
- License record visible (this file + THIRD_PARTY_NOTICES.md + credits.html).
- No standalone game asset used (only the vendored PixiJS code itself).
- Understandable at desktop and 390 px.
- No render-performance regression from the prior version.
