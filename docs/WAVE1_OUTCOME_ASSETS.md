# Wave 1 — decision traces and permanent state artwork

All new artwork is original code in this repository, authored for the existing games. No downloaded image, font, real map/person/brand, audio, video or third-party visual reference is used. Engine rules, content, random draws, save keys and save schemas are unchanged.

| Game | Screen inventory and intervention | State → artwork | Original source |
| --- | --- | --- | --- |
| HANEDANIAN | Existing relief/settlement artwork retained. Successful queue/departure replaces the order toast with a sealed receipt. Own settlements gain a small workshop progress plinth; selected-town and DOM directory explain it. | Actual spent resources/influence → receipt marks; committed due time → receipt; first queue job elapsed/total → plinth and accessible progress. Arrival is explicitly pending, never a guaranteed success. | `public/games/hanedanian/outcome-moment.js`, `app.js`, `map.js`, `map-dom.js`, `style.css` |
| İHTİLÂL | Existing inline feedback becomes a basin record on first decisions/period closures; ordinary decisions retain one compact paragraph. The two arbitrary contour lines are replaced. | Selected metric 0–100 → clipped fill level and surface trace; measured local/desk deltas and real queued/arrived waves → record. Echo closing and network opening timings remain distinct. | `public/games/ihtilal/outcome-moment.js`, `basin-map.js`, `solo-app.js`, `solo.css` |
| Racon | Existing completed-job summary retained. Accepted map commitments get an inline neighbourhood receipt. Three arbitrary strokes become labelled state marks. | Current trust/pressure → abstract door/light/stress marks; active order → commitment mark. Actual cost/clipped deltas and stored queue delays → receipt. All new street names use the fictional map dictionary. | `public/games/racon/outcome-moment.js`, `map-model.js`, `map-view.js`, `index.html` |

Only lifecycle is shared in `public/games/shared/outcome-runtime.js`: 2.2 seconds, close/Escape, focus/hover pause, static reduced motion, persistent polite announcement, bounded duplicate/burst suppression. Each game owns the model, words, composition and marks. No frame loop or new dependency. SVG/Pixi consume identical new geometry; HANEDANIAN's existing Canvas overlay is shared by its Pixi terrain surface. Mobile Racon has at most five marks per street (ten desktop); basin geometry is bounded to seven cells. Text and hit targets stay above marks.

HANEDANIAN caches the shared lifecycle as a required atomic offline dependency; its bytes participate in the package version hash. No cache/protection bypass is used.

## Evidence contract

`scripts/wave1-outcome-browser.mjs` captures each game at 1440/390/320, performs actual decisions, verifies measured deltas, pause/close/focus, reduced motion, save/reload without replay, resize, real context loss, cleanup and lightweight fallback. `before` serves the exact pre-wave game files from `b4ebc2babe7c754493d84421051c9531fc09215e`; `source` and `built` serve this PR. Same seeds and actions make the permanent map screenshots comparable. PR artifact `wave1-outcome/{before,source,built}/*-{before,after,map}.png` records both code versions and interaction states.

Main adds `wave1-outcome/{www,workers}` with exact SHA-256/source-byte equality for all four new presentation modules. Test result JSON and screenshots are evidence only after the corresponding run succeeds; pending CI is not production proof.
