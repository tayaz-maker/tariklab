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

MEASURED_TABLE

## Not done

- Çete Savaşları and JITEM: Derin Ağ have no Polish game text.
- No review by a native Polish speaker. The translations are the author's own
  and should be reviewed before PL is promoted.
- Text reached only deep in a campaign may still show English where a line was
  composed in a way the patterns do not cover. It never shows Turkish unless
  English readers see Turkish there too.
