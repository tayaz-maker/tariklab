# TC SIM reference UI acceptance

Reference: owner-supplied 1586 × 992 screenshot; browser chrome occupies the top 112 px. The game reference viewport is 1586 × 880.

The one TC SIM shell (`ui-shell.js` / `ui-shell.css`) supplies navigation, responsive drawer, toolbar, status, tokens and accessible focus behavior to all 16 existing views. Screen renderers retain their controls and original domain handlers. The portal suppresses its duplicate chrome only for `tc-sim`; the game's own TR/EN/PL switch works both embedded and standalone.

Reference landmarks (game coordinates): 258 px sidebar; 58 px brand header; toolbar bottom y=212; status bottom y=303; content x=284; historical strip y=321; first-steps card y=468; period-economy card y=728. Chromium candidate: 258 px sidebar, 58 px header, toolbar y=212, status y=304, content x=284, historical strip y=320, first-steps y=468, economy y=729. Amounts, date, character and decision counts are live save data, not image fixtures.

Navigation categories remember disclosure state in the existing presentation-only `tariklab.tc-sim.ui.v2` key. Desktop collapses to 64 px icons. At 820 px and below the drawer starts closed, overlays the content, contains keyboard focus and closes with Escape/backdrop or actual navigation. Search filters both primary and category links. Time, Goals, Saves and Help lead to existing controls/content, without adding gameplay.

## Reproducible checks

- `node scripts/tc-sim-reference-browser.mjs --serve public --out work/tc-reference --label source`
- `node scripts/tc-sim-reference-browser.mjs --serve .output/public --out work/tc-reference --label built`
- Both commands cover TR/EN/PL × 320/390/768/1280/1440/1920 × all 16 views, 288 transitions per build, plus collapse, drawer focus, Escape, search, remembered categories, help and exact saved-byte preservation. Each view has a viewport PNG and measured common header/toolbar/status/sidebar/content geometry.
- Existing banking, regions, job-outcome, preferences and mobile gameplay browser suites retain their real actions. Their navigation helper opens the actual drawer/category before clicking a destination. No hidden DOM clicks replace user interaction.
- Hosted use: `node scripts/tc-sim-reference-browser.mjs --base-url https://www.tariklab.com --expected-sha FULL_MAIN_SHA --out work/tc-reference --label www` (repeat for `https://tariklab.tayaz29.workers.dev`). It requires current main before and after acceptance, binds expected TC text assets to immutable Git blobs, and compares every deployed HTML/CSS/JS file before the full matrix. The existing Cloudflare production workflow remains a separate release gate.

The source and built runs, deterministic suite, lint/typecheck/build and production receipts are recorded in the task's evidence, not inferred from screenshots. No simulation, bank calculation, save schema, region definition or map asset is changed. Native stays paused; audio stays disabled.

Visual limits: Lucide outline icons are used in place of the reference's filled pictograms; raster background texture is represented by restrained CSS surface shading. Economy methodology disclosure and all existing game content remain accessible below the reference's visible portion.
