# TarikLab Luna — TC SIM Historical Starts (PR A)

## Scope

This change adds a historical life-simulation core for TC SIM only: the existing **Günümüz** path, a fixed **18 April 1999** path, and a seed-selected **1980s** path. Historical runs end on **1 January 2026**. The `tc-sim-save` compatibility key remains unchanged and existing saves without a scenario continue to load as `present_day`.

## Runtime model

`public/games/tc-sim/js/historical-scenarios.js` owns the immutable scenario packs, deterministic seed normalization, seeded eighties cohort selection, event cursor, choice effects, delayed echoes, and terminal summary. Seed choice uses a small integer xorshift transform and a fixed candidate list; there is no wall-clock or `Math.random()` input after game creation. Event order is pack-authored and stable. A resolved choice records its id, event, game-scale effect, and due week in the scenario state, so reloads do not reroll or reorder outcomes.

Historical state is additive under `world.scenario`; current-era saves retain the pre-existing world shape. `createNewGame()` sets the requested historical calendar fields, while existing migration normalizes a missing/unknown era to `present_day`. The established save key, version, primary slot, backup slot and legacy migration flow remain the persistence boundary. Tests load an old-shaped record through the actual `tc-sim-save` key and assert present-day compatibility.

## Content and evidence

Each factual event has its own institutional citation id in the event data and exposes its source link on the event card. The source register is [`docs/sources/TC_SIM_HISTORICAL_STARTS.md`](../docs/sources/TC_SIM_HISTORICAL_STARTS.md). Cards without citation ids are identified in the UI as fictional life decisions, without an asserted historical event. The narrative avoids political parties/people, propaganda, logos, brands, archival images and audio. Numeric choice effects operate only on existing game axes and are not historical economic measurements.

The 1999 and 1980s packs provide dated decision beats through 2025. Each has six daily-life choices (work, study, save, family/social support, mobility and rest), immediate and one-year delayed effects. Effects still pending on the end date are reconciled into the 2026 life outcome. The game calendar compresses time; it is not a day-by-day reconstruction.

## UI and responsive QA

The start form preserves the old option and adds fixed/seeded choices plus a seed preview. Historical cards render source links or a clear fiction label; the completed run shows decisions, delayed effects and life-system outcomes. Source URLs wrap on narrow screens. The new Chromium browser runner (`scripts/tc-sim-historical-browser.mjs`) is wired into CI at 1440, 390 and 320 CSS pixels for all three starts, including a choice, persistence reload and terminal screen for each historical pack. CI uploads screenshots and a JSON check record.

## Guardrails

- This PR changes the TC SIM era/scenario integration, its documentation/tests, and the CI step needed for browser verification.
- Do not include DEVLET #100, Pixi CI infrastructure, or JITEM work in this change.
- No database/schema changes or third-party visual/audio assets are required.
- The merge gate is the complete repository CI plus the dedicated historical browser check. Merge and production verification must wait for the green result.

## Verification record

Updated during PR preparation. Record full `npm test`, typecheck/lint/build, CI run and browser artifact outcome here before merge.
