# Active catalogue and duel audit — 2026-10-21

Base: 007ce1e310e6ce8feee49154fae18769d03928b6. Branch: audit/catalog-duel-quality.
Evidence root (local): work/catalog-duel-evidence, with sibling work/catalog-*.log, work/duel-*.log and work/master-*.log.
No PR created or merged by this agent. Production evidence belongs to the parent's release workflow.

## Completed evidence

- Existing source/Vite responsive suite: twelve assigned active routes plus portal, TR/EN, fourteen viewport sizes, 1020 layout/interaction checks, zero errors. Wave1 source save suite: 24/24 TR/EN/PL ×390/1280. Wave1 decision suite: 42/42 including real apartment repairs/follow-ups and DEVLET treasury/terminal/save invariants.
- Duel source browser: 144 viewport checks, 24 deterministic UI scenarios and four Polish art/save/reload cases PASS. Existing art/manifest/transport tests verify all 600 cards and two backgrounds; no images changed. Stress: 500 matches/theme, 1000 total, no stuck/first-turn-end/deck-out. VETO max31 turns, GETT max36.
- Focused duel/classic/Wave1 unit set: 278/280 first pass; two HTTP tests failed only with sandbox listen EPERM. Their existing test file reran with allowed localhost access:3/3 PASS. No guard changed. Additional next-wave/chess/long-game set136/136, Peg13/13.
- Actual Peg browser: TR/EN/PL ×390/1280, 25 legal UI jumps to terminal, undo and best-score reload6/6 PASS, before and after the presentation fix. Peg stores the best result, not a resumable match; no save feature added.
- Narrow fixes: Peg result-grade/note/status/best-score copy leaked Turkish into EN/PL; translate canonical values at the render boundary. Apartment phase and authored resident traits/interests leaked Turkish into EN/PL; scoped display map now covers them, plus the observed stuck-lift incident/family. Canonical narrative, state, mechanics and saves remain unchanged. Other unreviewed narrative is not claimed fully translated.
- React Cete Polish cete.* dictionary lacked initial/create/save/age/basic-tab entries and fell back to Turkish. Authored Polish entries added. Real initial label → character creation → gameplay tab, TR/EN/PL ×390/1280:6/6 PASS.
- Postfix presentation tests17/17, existing i18n guards31/31, targeted ESLint, TypeScript noEmit and diff whitespace PASS. Actual desktop/mobile after screenshots inspected.

## Pending release/handoff

- `scripts/master-production-browser.mjs` is a new full active-catalogue gate. Default uses all current live routes dynamically; `--games` is explicitly targeted diagnostic mode and cannot print the full MASTER_PRODUCTION_PASS marker.
- Arguments: `--base <origin> --label <safe-label> --expected-root <accepted-build-public-root>`. RUNNER_TEMP controls screenshots; PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH may point to Chrome. External hosts additionally require BROWSER_ALLOW_EXTERNAL_HOST=1. Use GITHUB_SHA for accepted release metadata; that metadata alone is not exact-main proof. It hashes actual same-origin static responses against accepted build bytes.
- Full gate checks TR/EN/PL ×390/1280 and real TR/PL390 offline wrapper reloads separately. It records language selection/document language, a Cete authored critical label, visible game content, asset hashes/errors/overflow and per-frame worker/controller/registration/cache/request-failure diagnostics. It does not certify every narrative sentence's translation.
- Local built dry-run uncovered a harness race: wrapper can load before iframe navigates from about:blank. Fixed by polling actual embedded body, then resolving the game frame. Direct static pages must not be mistaken for child iframes; fixed. Redirect responses have no body and are excluded from body-hash reads; final200 assets remain checked. These final harness changes have syntax/lint checks but the final full matrix has NOT run.
- HANEDANIAN package preparation uses real new-game controls and waits for its authored package-ready status in TR/EN/PL; root-worker readiness alone is insufficient. Separate campaign agent already has its own real offline proof. Do not infer a product failure from the earlier generic iframe timeout.
- Racon and Peg representative fresh-wrapper diagnostics on the pre-fix build showed no root controller, no registrations and no caches. TC agent owns the minimal shared existing-root-worker registration/cache-closure fix. Do not duplicate or overwrite that work. Full/master offline result remains PENDING until integrated built/two-host acceptance runs.
- Production duel duplicate was stopped once the parent confirmed the mandatory workflow already runs it. No independent production PASS asserted here.
- PR112 is an open historical draft ten-card DARBE proof, depending on the retired DARBE files; do not merge/revive it. Parent was notified for closure; this agent did not close it.
- Update the shared WEB_APP_SYNC_LEDGER during integration (parent owns it), then run exact-head required CI and accepted-build two-host proof before release.
