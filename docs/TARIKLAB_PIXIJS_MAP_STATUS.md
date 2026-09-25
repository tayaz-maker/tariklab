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
| **0. Foundation + Kıyı Eşiği proof** | IN PROGRESS | (this PR) | — | See below. |
| 1. HANEDANIAN | NOT STARTED | — | — | 49×49 atlas cache/blit/overlay; performance-critical, separate PR per plan. |
| 2. Racon Manager | NOT STARTED | — | — | Fictional neighbourhood/network map. |
| 3. TC SIM: DEVLET | NOT STARTED | — | — | Seven abstract regions + external-relations map; clickable regions, capacity/risk overlay. |
| 4. TC SIM | NOT STARTED | — | — | Only if the game genuinely needs a spatial surface; not automatic. |
| 5. JITEM: Derin Ağ | NOT STARTED | — | — | Upstream `jitem-derin-ag` repo first (clean PR there), then a separate TarikLab vendor-sync PR. Save key `jitem-derin-ag-v3` / schema 5 untouched. |
| 6. Other candidates | NOT STARTED | — | — | Only where a real spatial decision surface helps; list/panel games are not converted. |

### 0. Foundation + Kıyı Eşiği (this PR)

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

PRODUCTION_PLACEHOLDER

## Bitmiş sayılma koşulu (per game, per the plan)

- Opens offline/fallback without changing game data.
- License record visible (this file + THIRD_PARTY_NOTICES.md + credits.html).
- No standalone game asset used (only the vendored PixiJS code itself).
- Understandable at desktop and 390 px.
- No render-performance regression from the prior version.
