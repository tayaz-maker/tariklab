# TarikLab — Polish (PL) game coverage

PL is offered on the site toggle. This file records, per game, what a Polish
reader actually sees. The machine-readable copy lives in
`docs/INTERACTIVE_LANGUAGE_I18N_COVERAGE.json` (`pl`, `plNote`).

## Rule

- **Interface.** Polish covers static interface text through the shared layer
  (`public/i18n/tlab-i18n.js`): shell, menus, save slots, navigation, primary
  buttons, section and help headings.
- **Game text (`pl: "body"`).** Story, event, card, report and help text is
  translated on screen by `public/i18n/pl-body.js`. Games keep rendering their
  English content for Polish readers; when the language is `pl`, the layer
  loads `/i18n/pl/<game>.json` and swaps each text node for its Polish
  translation: whole text first, then `" · "` parts, then patterns such as
  `Draw {0} cards` (`{0#}` matches a number only). Game state and saves never
  change; switching language restores the original text.
- **Turkish-only text.** A few games still show Turkish in English mode (the
  Apartman event chains, the Bükücü log, some HANEDANIAN and TC SIM panels).
  Their Polish entries are keyed by the Turkish source, so Polish readers get
  Polish there too, not Turkish.
- **Honest fallback.** Anything without Polish stays in English (or in the
  language it is shown in for English readers). Proper names (people,
  districts, places) keep their spelling.
- **Offline.** HANEDANIAN's offline package does not cache the layer; offline
  it shows English text with the Polish interface, as before.

## How the dictionaries are built

- `scripts/pl/extract-en.mjs` collects the English strings each game can show
  (`scripts/pl/games.json` lists the source files per game).
- `scripts/pl/translations/*.json` hold the Polish text by string id.
- `scripts/pl/screen/*.json` add on-screen text the extractor cannot see
  (composed lines, Turkish-only text), keyed by the displayed text.
- `node scripts/pl/build.mjs` writes `public/i18n/pl/<game>.json` and
  `scripts/pl/coverage.json`.
- `scripts/pl-body.test.mjs` checks the loader tag on every covered game, that
  dictionaries hold Polish (no Turkish words, no `$n`, placeholders kept) and
  that the runtime translates sample lines.

## Per game

| Game | PL state | Polish | Not Polish |
|---|---|---|---|
| Çete Savaşları | interface | Bottom tabs, shared `common.*` labels | Panels, events, help (English) |
| HANEDANIAN | body | Interface, onboarding, panels, army, regional development, reports | Dynasty and place names |
| Racon Manager | body | Interface, story, events, orders, street text | Names |
| TC SIM | body | Interface, events, people, finance panels, help | Personal names |
| Son Mahalle Bükücü | body | Interface, cards, log, trade and auction lines | District names |
| Labirent / Tek Taş / Satranç / Amiral Battı | body | Interface, status lines, help body, piece and ship names | — |
| Apartman | body | Interface, issues, event chains, residents, help | Resident names |
| Kayıp Telefon | body | Interface, messages, findings, theories, endings | Names |
| Son 100 Gün | body | Interface, scenario, situations, journal, endings | — |
| TC SIM: DEVLET | body | Interface, policies, reports, dossiers | Person and place names |
| SON KÖY MANAGER | body | Interface, requests, people, reports | Names |
| VETO-H! / GETT-OH! / DARBE-H! | body | Duel table, card text, series names, theme copy, help, analysis | District names (GETT-OH!) |
| İHTİLÂL | body | Interface, hints, endings, basin text | Game title |
| Kıyı Eşiği | body | Route copy | — |
| JITEM: Derin Ağ | english-fallback | — | Vendored runtime; `/oyna` sends English to PL readers. The standalone `/games` URL keeps the game's own TR/EN switch. |

## Measured

Two measurements. Build-time coverage is from `scripts/pl/build.mjs`
(`scripts/pl/coverage.json`): how many of the extracted English strings each
game can show have a Polish translation (`screen` is the count of on-screen
supplements layered in from `scripts/pl/screen/*.json`).

| Game | Extracted strings | Translated | On-screen supplements |
|---|---|---|---|
| hanedanian | 233 | 225 | 184 |
| racon | 2308 | 2291 | 97 |
| tc-sim | 3662 | 3592 | 273 |
| bukucu | 2305 | 2291 | 304 |
| labirent | 2305 | 2291 | 40 |
| peg-solitaire | 2306 | 2291 | 42 |
| satranc | 2310 | 2291 | 106 |
| amiral-batti | 2306 | 2291 | 53 |
| apartman | 4135 | 4094 | 718 |
| kayip-telefon | 4122 | 4081 | 59 |
| son-100-gun | 770 | 741 | 43 |
| tc-sim-devlet | 4746 | 4691 | 54 |
| son-kasaba | 3000 | 2957 | 30 |
| veto-h | 1158 | 1127 | 188 |
| gett-oh | 1113 | 1080 | 188 |
| ihtilal | 46 | 42 | 25 |
| darbe-h | 1001 | 970 | 201 |
| esik | 33 | 33 | 31 |

The extractor over-counts (many games share the same English string pool via
the depth-framework layer, so `strings` includes text that game never shows);
`translated` tracks it 1:1, so the ratio understates real coverage. What
matters is on-screen: `scripts/pl-body.test.mjs` runs the real runtime
translator against sample lines per game, and separately, browser capture
(`localStorage.tariklab.language = "pl"`, walking the live DOM) confirms what
a Polish reader actually sees on the start screen, before (production, prior
build) vs. after (this change) for all 18 games:

| Game | Lines on screen (before / after) | Lines in Polish (before → after) | Non-Polish prose lines (before → after) |
|---|---|---|---|
| hanedanian | 375 / 414 | 11 → 238 | 219 → 8 |
| racon | 122 / 122 | 13 → 59 | 59 → 1 |
| tc-sim | 357 / 357 | 19 → 167 | 166 → 9 |
| bukucu | 250 / 242 | 5 → 55 | 107 → 23 |
| labirent | 141 / 140 | 11 → 30 | 26 → 0 |
| peg-solitaire | 82 / 82 | 7 → 65 | 59 → 0 |
| satranc | 175 / 174 | 15 → 78 | 53 → 1 |
| amiral-batti | 262 / 262 | 14 → 37 | 26 → 0 |
| apartman | 52 / 39 | 7 → 23 | 22 → 0 |
| kayip-telefon | 370 / 336 | 16 → 167 | 166 → 9 |
| son-100-gun | 211 / 305 | 54 → 160 | 68 → 12 |
| tc-sim-devlet | 37 / 37 | 6 → 21 | 15 → 0 |
| son-kasaba | 495 / 495 | 33 → 228 | 161 → 9 |
| veto-h | 252 / 249 | 12 → 134 | 107 → 2 |
| gett-oh | 266 / 262 | 13 → 128 | 113 → 4 |
| ihtilal | 202 / 202 | 95 → 111 | 13 → 2 |
| darbe-h | 255 / 252 | 12 → 132 | 94 → 0 |
| esik | 189 / 190 | 0 → 30 | 98 → 0 |

Every game moved: more Polish lines, fewer non-Polish prose lines. Some
non-zero "after" counts remain in longer games (kayip-telefon, son-100-gun,
son-kasaba, tc-sim, bukucu): these are single-shot start-screen captures, so
they include Turkish-only proper names the checker's word list flags as
non-Polish, and, for son-100-gun, a scenario intro that varies by random
seed each capture. `apartman` and `tc-sim-devlet` above are the menu screen
only, matching the production baseline; a deeper capture that plays past the
setup screen (start button pressed, ~30s into a campaign) shows apartman at
272 on-screen lines with 0 English/Turkish-looking, and tc-sim-devlet at 481
lines with 1.

Not a formal sample: single capture per game per side, one viewport pair
(1280×900 desktop + 390×844 mobile combined), one random seed where the game
is seeded. It shows direction and scale, not a guarantee that no string is
ever missed deep in a long campaign.

## Not done

- Çete Savaşları and JITEM: Derin Ağ have no Polish game text.
- No review by a native Polish speaker. The translations are the author's own
  and should be reviewed before PL is promoted.
- Text reached only deep in a campaign may still show English where a line was
  composed in a way the patterns do not cover. It never shows Turkish unless
  English readers see Turkish there too.
