# Stable map bases — separate performance checkpoint

The player sees the same state, selection and forecast without rebuilding unchanged basin/street artwork. This PR changes only İHTİLÂL and Racon render work; no model formula, save key/schema, content, asset or dependency changes.

| Surface | Previous work | New work |
| --- | --- | --- |
| İHTİLÂL | Every preview rebuilt SVG and all Pixi geometry. | Keyed basin base remains mounted; selection and route/plan controls update separately. |
| Racon | Every model rebuilt SVG/buttons, resized the framebuffer and repainted all geometry. | Keyed links/blocks/state marks are retained; selection and plan overlays update independently; unchanged dimensions skip resize. |
| Both | Explicit updates could draw in a hidden document. | Keep the latest model while hidden and flush once on visibility return. |
| Both | Full device pixel ratio without a memory guard. | ≤2 GB reported device memory or >2,000,000 backing pixels chooses the same-model SVG before WebGL/import; context loss also disposes the scene. |

Geometry remains original code from the existing games. No raster, downloaded texture, new asset or continuing ticker. No texture cache is introduced. Both renderers remove their visibility/context-loss listeners and observers; late asynchronous mounts are destroyed if the surface has already closed. Asset/reference inventory is in `MAP_PERFORMANCE_ASSET_AUDIT.md`; no asset deletion is justified by this change.

Verification: `map-static-cache.test.mjs` runs actual renderer sources with instrumented DOM/GPU boundaries (14 cases). Combined targeted outcome/map tests: 38/38. Production build passes; the sole lint error (an empty startup catch in the new measurement script) was corrected and all changed JavaScript passes ESLint; 59 existing warnings remain. Browser evidence remains a gate, not a claimed pass: 1440/390/320, actual decisions/save/reload, paired map screenshots, real context loss/cleanup, low-memory and DPR-budget fallback, and 12 real selection updates observing removed base marks and median synchronous render cost.

Before is exact Wave 1 head `53534e2f9526ad80ce296952c212fa44aaa0ada1`. Existing `wave1-outcome/performance-comparison.md` records bytes/requests, first readable render, map-entry cost and selection redraw work. Separate `map-route-costs/route-comparison.md` compares all 20 live routes and portal at 1440/390/320 using fresh built-browser contexts, including service-worker request costs. The portal must fetch no game assets/store/Pixi. Frame/GPU completion time is not inferred from synchronous JavaScript timing.

Production remains blocked until every CI gate passes and the exact merged modules are verified on both hosts. Later performance scope: portal language split, conditional language overlays and optional cloud-sync imports require their own measured PRs. Referenced historical screenshots stay in the repo.

| Source size (uncompressed) | Before | After |
| --- | ---: | ---: |
| İHTİLÂL renderer | 9,880 B | 12,852 B |
| Racon renderer | 11,399 B | 18,741 B |

The code is larger because retained layers and cleanup are explicit. This is a redraw optimization, not a claimed transfer reduction. Actual compressed route costs remain in the browser comparison gate.


## A2 release rebase — 2026-10-05

The #110 Workers reload blocker is closed by #113 merge `375b83752df3d5e16c960797cf99634af0405d31`: run37256148798/job111593543370 passed exact-worker production smoke on www and Workers at1440/390/320, with two real saved-game reloads per case and zero console/page/HTTP/network/overflow errors. Artifact11322886877 retains the proof. #111 is now rebased onto that main. Both historical sync-ledger sections were retained during the documentation-only conflict. Map implementation bytes are unchanged from the previous green head2011a59.

Fresh local acceptance:68 targeted cache/traffic/deadline/surface/offline/redirect tests, targeted lint and production build PASS. Fresh remote CI and the new merge's two-host production evidence remain required. The only extra verification housekeeping corrects the old transport-only phrase in the minimized redirect fixture's report and splits hosted evidence by provider, because the combined33.77MB artifact exceeded the32MiB transfer limit. No test assertion, timeout, route, renderer budget or success criterion is relaxed.
