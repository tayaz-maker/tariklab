# TarikLab — Polish (PL) game coverage

PL is offered on the site toggle. This file records, per game, what a Polish
reader actually sees. The machine-readable copy lives in
`docs/INTERACTIVE_LANGUAGE_I18N_COVERAGE.json` (`pl`, `plNote`).

## Rule

- **Interface only.** Polish covers static interface text: shell, menus, save
  slots, navigation, primary buttons, section and help headings. Story, event,
  card, report and help body text is not translated.
- **Honest fallback.** Anything without Polish is shown in **English**, never
  the Turkish source. The shared layer (`public/i18n/tlab-i18n.js`) resolves a
  string as: authored Polish → English → source. Games that pick strings in
  code use `contentLang()` / `localize()` from the same layer, or their own
  `reader === "pl"` switch.
- **Before this change** 17 of 18 games showed Turkish to a Polish reader,
  with only a few shared words in Polish. Only Son 100 Gün fell back to
  English.

## Per game

| Game | PL state | Polish | English fallback |
|---|---|---|---|
| Çete Savaşları | interface | Bottom tabs, shared `common.*` labels | Panels, events, help |
| HANEDANIAN | interface | Title, menu, save actions, time/map controls, layers | Map events, orders, reports |
| Racon Manager | interface | Shell, menu screens, slots, help headings, network-map orders | Story, events, street text |
| TC SIM | interface | Shell, slots, week-plan headings, decision chips, desk labels | Events, people, help |
| Son Mahalle Bükücü | interface | Shell, slots, match length, opponents, seat modes | Board and card text |
| Labirent | interface | Shell, move buttons, new maze/solve, difficulty, help headings | Help body |
| Tek Taş | interface | Shell, undo/hint/reset, help headings | Status line, help body |
| Satranç | interface | Shell, modes, colour choice, controls, help headings | Square names, help body |
| Amiral Battı | interface | Shell, modes, difficulty, placement buttons, help headings | Ship names, cell labels |
| Apartman | interface | Menu, slots, desk headings, week/meeting actions, help headings | Issues, residents, help body |
| Kayıp Telefon | interface | Menu, slots, notebook tabs, final decision, help headings | Messages, findings, endings |
| Son 100 Gün | interface | Every interface label | Scenario, situations, journal, endings |
| TC SIM: DEVLET | interface | Menu, slots, section nav, month actions, map panel headings and chain steps | Policies, reports, dossiers |
| SON KÖY MANAGER | interface | Menu, slots, header stats, section nav, plan headings, help headings | Requests, people, reports |
| VETO-H! / GETT-OH! / DARBE-H! | interface | Shared duel table: menu, phases, actions, zones, settings, file names | Cards, theme copy, help, analysis |
| İHTİLÂL | interface | Desk labels, stats, decision buttons | Hints, endings, basin names |
| JITEM: Derin Ağ | english-fallback | — | Vendored runtime; `/oyna` sends English to PL readers. The standalone `/games` URL keeps the game's own TR/EN switch. |

## Measured

Local build, start screen, 1280 px. Count of words containing Turkish-only
letters (ç ğ ı ö ş ü):

| Game | PL before | PL after | EN (reference) |
|---|---|---|---|
| hanedanian | 32 | 3 | 3 |
| racon | 18 | 8 | 8 |
| tc-sim | 18 | 13 | 15 |
| bukucu | 20 | 7 | 7 |
| labirent | 21 | 5 | 5 |
| peg-solitaire | 21 | 6 | 6 |
| satranc | 24 | 7 | 7 |
| amiral-batti | 23 | 14 | 14 |
| apartman | 14 | 0 | 0 |
| kayip-telefon | 10 | 0 | 0 |
| son-100-gun | 1 | 1 | 1 |
| son-kasaba | 14 | 1 | 1 |
| tc-sim-devlet | 10 | 0 | 0 |
| veto-h / gett-oh / darbe-h | 15 / 14 / 14 | 0 | 0 |
| ihtilal | 16 | 1 | 1 |
| jitem-derin-ag (standalone URL) | 57 | 57 | 57 |

PL is never worse than EN. What remains is existing EN coverage gaps (the same
Turkish words show in EN mode) and proper names. Those gaps are not closed
here.

## Not done

- No Polish story, event, card or help body text.
- No review by a native Polish speaker. The translations are the author's own
  and should be reviewed before PL is promoted.
