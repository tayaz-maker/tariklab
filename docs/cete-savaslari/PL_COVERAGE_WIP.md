# Çete Savaşları — Polish coverage audit (work in progress)

The AST inventory collected string candidates across `src/components/game/` and `src/game/`. It includes identifiers, CSS and non-player text, so it is not a count of player-facing strings. This matrix is not a completion certificate. Catalog counts below refer to authored fields in the current source; character names and brands are retained where appropriate. PASS requires full behavior and language acceptance, not only matching IDs.

| Group / source | Known catalog fields | Present PL / remaining | Evidence | Status |
| --- | ---: | --- | --- | --- |
| Starting districts: `data.ts`, `create-character.tsx` | 8 descriptions/perks | 8 authored; proper names retained | ID coverage test; full starting flow not tested on this revision | NOT_VERIFIED |
| Shop: `data.ts`, `shop-panel.tsx` | 56 names/descriptions | 56 authored; brands retained | ID coverage; source Chromium all 28 items at 390/1280; purchase outcomes not covered | NOT_VERIFIED |
| Jobs: `data.ts`, `jobs-panel.tsx` | 28 names/descriptions + 3 tier names | 31 authored | ID coverage; source Chromium 14 jobs at 390/1280; gameplay outcomes not covered | NOT_VERIFIED |
| Contracts: `data.ts`, `jobs-panel.tsx` | 14 descriptions | 14 authored; NPC names retained | ID coverage; runtime switching not fully checked | NOT_VERIFIED |
| Property, assets and corners: `data.ts`, `estate-panel.tsx` | 36 name/description fields | 36 authored | ID coverage; source Chromium 12 properties at 390/1280; bank/investment transactions not covered | NOT_VERIFIED |
| Street and crew: `street-panel.tsx`, `data.ts` | Not yet fully counted | Static PL authored; dynamic and persisted messages remain | Source Chromium initial view at 390/1280 | NOT_VERIFIED |
| Life and relationships: `life-panel.tsx`, `data.ts` | Not yet fully counted | PL screen copy authored; dynamic outcomes remain | Source Chromium initial view at 390/1280 | NOT_VERIFIED |
| Outcome card: `outcome-moment.tsx`, `outcome-moment.ts` | Not yet fully counted | PL rendering authored | Typecheck and existing game tests; PL outcome not browser-verified | NOT_VERIFIED |
| Character, HUD, saves, account, help, tutorial and offline: `src/components/game/` | Not yet fully counted | Profile, save and HUD PL copy expanded; remaining fallback audit needed | Earlier PR checks only; not accepted for current head | NOT_VERIFIED |
| Events, notifications and logs: `events.ts`, `clock.ts`, `store.ts`, `log-feed.tsx` | Not yet fully counted | Some canonical log patterns now have PL display translations; unmatched dynamic and historic messages still show their original text | Source inspection | FAIL |
| TR/EN, full save/reload, offline and build parity | Not applicable | Final matrix outstanding | Current source catalog checks are insufficient | NOT_VERIFIED |

No native-speaker linguistic review has been performed. Numbers above are explicit catalog fields, not a claim of all player-facing text or zero remaining fallbacks.
