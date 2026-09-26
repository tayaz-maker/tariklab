# Astra Ultra — game-by-game run state

Updated: 2026-09-26 (UTC). Release monitoring belongs to Terra / Sol / Luna; this run does not poll CI, wait for merges/deployments or run unattended soaks.

## 1. HANEDANIAN — living relief atlas

- Branch: `astra/hanedanian-living-atlas`
- Base: merged #100, `dee186f7c437e2675765bebe7ffdeec9a271cf9c`.
- Published implementation SHA: `421443a18562b627985c6c3a19e5bd3f56c1f571` (subsequent checkpoint commits update this record only).
- Exact tested tree: `940e469faf15df9bcc809f84bea084cf2ad15ec6`, identical to local tested commit `c7f8fdd17e873e74d45eaac2e89dd487af8aa93e`. Shell HTTPS push lacked credentials, so the connected GitHub API published the identical tree; no source changes were introduced during publication.
- Release PR: opening from this branch after the checkpoint push; final link recorded in the handoff update.
- Status: **merge-ready checkpoint**; implementation, clean-build browser and real offline gates passed. CI/merge/production belong to the release agent.

### Material change

The existing seeded 49×49 Kuzey Işığı Rölyefi, cached atlas and optional Pixi terrain remain the foundation. Original procedural capitals, walled towns/forts, caravanserais, towers, ruins, quarries, mines, pastures and passes now change silhouette/detail across world, region and near zoom. Road wear, river cuts and real crossings are baked into static terrain. Ownership pennants and the active route remain separate live overlays; unseen route segments are dashed. Mobile hides incidental labels before the active destination.

The inspector explains actual road/rough-terrain travel, pass/inn effects, tower sight, visible hostile exposure and point contribution. An owned point can be reassigned to another eligible town using a five-influence courier: the source keeps its contribution until arrival; ownership/range/capacity are checked again on arrival; a recalled/failed courier refunds once after returning. Pending claims reserve the four-point capacity. Current and proposed marginal production make the old-town loss visible before confirmation.

Real regressions fixed: west/north road endpoint stubs; founder farm forecast; false threats from protected truces/vassals/peaceful couriers; point-slot overbooking; transfer watch-step registration; route details closing on each tick; fallback focus/initial renderer state; overlapping 320 px resource values. Known software WebGL devices now use the same atlas through Canvas after baseline and candidate both reproduced black stale terrain tiles under SwiftShader. Eligible hardware keeps Pixi.

### Changed files

- Map/runtime: `public/games/hanedanian/{map.js,map-pixi.js,map-factory.js,map-dom.js,app.js,index.html,style.css,sw.js}`.
- Rules/decision explanation: `public/games/hanedanian/{engine.js,mapintel.js,orders.js}`.
- Regression proof: `scripts/{hanedanian-logistics.test.mjs,hanedanian-map-relief.test.mjs,hanedanian-map-pixi.test.mjs,hanedanian-ui.test.mjs,hanedanian-ultra-browser.mjs,hanedanian-browser.mjs}`.
- Provenance/continuity: `docs/ip/ASSET_REGISTER.csv` (A023), `docs/WEB_APP_SYNC_LEDGER.md`, this file.

### Save, provenance and fallback contract

- Existing HANEDANIAN schema 1 and storage keys are unchanged. Optional courier metadata is validated. Old saves/ordinary pending claims and courier save/reload are covered by tests.
- Original code geometry only. No imported artwork, real map/person/brand/logo, new runtime dependency, music, sound, autoplay or vibration. Existing pinned Pixi dependency is retained.
- Canvas starts immediately. Pixi swaps in only on eligible WebGL. Failed/unsupported/software GL stays on Canvas. Real context loss replaces the failed Pixi renderer while preserving state/camera/selection. Async initialization, reset and destruction release canvases/textures.
- “Defter” offers an SVG/DOM surface using the same selection, inspector and order flow; lack of Canvas selects it automatically. It includes arbitrary tile coordinates, nearby places, keyboard controls and focus preservation, and is included in the atomic offline package.

### Local proof

- Baseline HANEDANIAN: 109/109 tests passed.
- Full `npm test`: 1,629 passed, zero failed, one existing optional stress test skipped. This full run preceded the final software-device classifier; the final classifier and all HANEDANIAN changes subsequently passed **129/129** focused tests.
- Clean `npm run build`, `npm run typecheck`: passed. `npm run lint`: zero errors, 59 existing warnings.
- Clean output/source parity: all 18 HANEDANIAN files checked; 17 byte-identical, `sw.js` differs only by the intended generated package-version hash. Incremental build had retained stale static files; final browser proof uses the verified clean output.
- Baseline browser: six desktop/mobile Pixi/Canvas scenarios, 90 recorded checks. Candidate before software guard: nine Pixi/Canvas/DOM scenarios, 132 checks, including actual Pixi context-loss recovery. SwiftShader visuals failed despite functional success; those runs are not claimed as successful GPU visual proof.
- Final clean-build browser: **9/9 scenarios, 141 recorded checks, zero failures** at 1440/390/320, across automatic software-device Canvas, forced no-WebGL Canvas and forced no-Canvas SVG/DOM. Campaign start, real build/scout actions, selected orders, zoom bands, pan, layers, resize, five screens, save/reload and new-world reset passed. Root visually inspected desktop decision, 320 atlas and 390 DOM screenshots; no black terrain rectangle or mobile resource overlap.
- Existing real offline/touch/save suite: **20 recorded checks, zero browser/console errors**, `HANEDANIAN_SOAK_MS=0`. Real queues, scout, claim, founding expedition, touch pan/pinch, native history and save/reload passed at 1280/1920/360/390. Real Service Worker + IndexedDB offline reload/edit, failed uncached request with networking disabled, previous-autosave corruption recovery, invalid import and reconnect all passed. Evidence: `/workspace/screenshots/hanedanian/results.json`.

| Forced Canvas viewport | Baseline first interaction | Candidate first interaction | Baseline median CPU draw | Candidate median CPU draw |
| --- | ---: | ---: | ---: | ---: |
| 1440 | 311.2 ms | 279.3 ms | 7.5 ms | 5.6 ms |
| 390 | 305.5 ms | 225.4 ms | 7.2 ms | 4.6 ms |
| 320 | 208.8 ms | 230.7 ms | 4.4 ms | 3.7 ms |

Automatic software fallback first interaction: 301.1 / 413.3 / 251.5 ms and median CPU draw 6.8 / 7.2 / 4.5 ms (1440 / 390 / 320). DOM first interaction: 253.8 / 181.5 / 170.4 ms. These are bounded measurements on this runner, not FPS or universal speed claims; 320 forced-Canvas startup is slightly slower than baseline.

Reproduction: `node --test scripts/hanedanian-*.test.mjs`; `node scripts/hanedanian-ultra-browser.mjs --serve .output/public --label final --expect-renderer canvas` on confirmed software WebGL (omit `--expect-renderer canvas` on a hardware runner so actual Pixi is required). Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when using a locally supplied Chromium. JSON/screenshots for this session: `/workspace/screenshots/hanedanian-ultra/{baseline,head,final}`; durable measured results are recorded above.

### Open limitations and release ownership

- This runner exposes SwiftShader, not a physical GPU. The final default renderer must be Canvas with an explicit `software` reason; physical-GPU Pixi visual quality requires the release smoke. Hidden renderer names remain eligible rather than assuming hardware failure.
- Browser timings measure CPU draw/submission time, not GPU latency or FPS. Compare Canvas to Canvas; one bounded machine run is not a universal performance claim.
- No schema migration, platform/workflow change, PR #101 edit, TC SIM historical-branch duplication or Novella work is included.
- Terra / Sol / Luna: run the required checks against the actual PR head. At this base these are `ci / build`, `ci / campaign-browser`, and `ci / campaign-balance`; honor current branch protection if #101 changes the job layout. Merge only when required checks are green. Do not fold unrelated fixes into this checkpoint.
- Production routes: `/oyna/hanedanian` and `/games/hanedanian/index.html`. Smoke 1440/390/320: start → world/region/near → select road/point → inspect route and ownership → build/scout → reassign a point to a second town → save/reload/continue → Defter tile/order flow → return to atlas → resize/menu/reset. Confirm one active renderer, no overflow, unchanged save, silence, and physical-GPU Pixi/context-loss fallback. Reproduce any failure narrowly and send it back for a small follow-up checkpoint.

## Next game / boundaries

TC SIM is next in sequence. After the HANEDANIAN handoff, check Luna's historical-start PR/merge result once and open a clean discovery worktree. Do not duplicate or modify Luna's branch; implementation/audit of the historical start depends on that handoff result. Preserve `tc-sim-save`. PR #101 remains Terra's responsibility. Novella remains **LATER**.
