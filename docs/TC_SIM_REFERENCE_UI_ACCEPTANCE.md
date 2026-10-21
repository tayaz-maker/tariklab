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

## Direct district labels — added to the same UI PR

The city map now contains the only region selector: 8 Istanbul, 8 Ankara and 7 Izmir named HTML buttons over the unchanged WebP artwork. Number markers and the second region list are removed. Every label keeps the existing `data-location-select` ID, pressed state, keyboard activation and focus restoration. Selection still renders the original cost/housing information and uses the original rental and purchase handlers. Earlier Avcılar/Bayrampaşa/Batıkent saves keep their ID, current-home readout, quotes and holdings; they are not reset or silently changed to one of the 23 labels.

The illustrated images are perspective drawings, not georectified basemaps. Anchors were checked for relative direction and shoreline relationships against [İBB’s city map](https://sehirharitasiapi.ibb.gov.tr/), [Beşiktaş Municipality’s Bebek description](https://besiktas.bel.tr/kurumsal/mahalleler-ve-muhtarliklar/bebek/), [Ümraniye Municipality’s geography section](https://umraniye.bel.tr/wp-content/uploads/2025/01/stratejik-planlar_1445.pdf), [Ankara’s city guide](https://cbsbaskent.ankara.bel.tr/kent-rehberi/) and [Izmir’s municipal map](https://www.izmir.bel.tr/tr/buyuksehirsinirharitasi/125/212). This supports approximate relative placement, not a claim of surveyed coordinates or exact administrative boundaries.

Bebek’s geographic anchor moves from inland 51%/12% to the illustrated European shoreline at 61.5%/12%; Beşiktaş moves to 57%/34%. Ümraniye stays inland at 89%/37%, east of Üsküdar (72%/54%). Istanbul’s five European labels stay west of the Asian labels. Ankara retains Etimesgut west, Keçiören north, Mamak east and Çankaya south of the center. Izmir places Karşıyaka on the northern coast, Bornova inland northeast, Alsancak/Konak along the eastern shore, Buca inland southeast, and Göztepe/Balçova along the southern side.

At narrow container widths, label rectangles move to separate percentage positions and short leader lines preserve their original approximate anchors. The caption explicitly explains this. The image retains its 3:2 aspect ratio without cropping, stretching, artificial enlargement or horizontal scrolling. Labels are at least 44 × 44 px, names occupy at most two lines, and the selected label/leader uses gold. The same component and container rule apply to all cities; no duplicate mobile selector exists.

`tc-sim-2-regions-browser.mjs` now covers TR/EN/PL × 320/390/768/1280/1440. It selects all 23 names directly on the image (345 selections), checks each selected information panel and quote IDs, verifies every label stays within the image with no overlaps or text beyond two lines, and captures all 45 city views. Existing real purchase and all 23 move/reload cases remain; three earlier saved-region reloads verify compatibility without reintroducing the removed list.
