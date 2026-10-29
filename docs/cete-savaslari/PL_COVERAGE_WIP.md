# Çete Savaşları — Polish coverage and acceptance evidence

The field counts below refer to the current authored catalog, not every possible player-facing sentence. Proper names and brands are retained. The terminology decisions are documented in `PL_TERMINOLOGY.md`.

| Area | Polish coverage and evidence |
| --- | --- |
| Neighborhoods | Eight current descriptions and perks; catalog ID checks. |
| Shop | 56 item names/descriptions; all 28 entries rendered at mobile and desktop widths. |
| Jobs and contracts | 31 mission/tier fields, 14 contracts and all 72 current job-result narratives; ID and value checks and a real job/reload flow. |
| Property and investments | 36 property, asset and corner name/description fields; all 12 properties rendered at both widths and real bank transfer/reload checked. |
| Street, crew, life, profile, clinic, season, HUD, saves and help | Polish screen copy and dynamic state labels; real Chromium initial and representative conditional states at mobile and desktop widths. |
| Logs and world events | Render-time translation leaves the stored Turkish source unchanged. Automated checks exercise 51 real operations repeatedly and 24,000 seeded world events; selected historic messages from reachable repository history are also covered. Unknown or externally modified historical messages remain unchanged instead of inventing a translation. |
| Outcomes | Existing Chromium outcome regression expanded to PL alongside TR/EN, including reload and narrow/mobile layouts. |
| Keys, interpolation and display | Current literal Çete translation keys and dynamic risk/rank keys checked; job result values retained; Polish money and decimal display tested. |
| Save, language and offline | Real browser bank transfer, named save/reload and TR→EN→PL switching; existing production Worker browser closure checks exercise service-worker offline reload and compare save hashes. |

The browser and generated-event checks cover the cases described above; they do not prove every possible combination of game state or every arbitrary historic/custom save. An independent native-speaker linguistic review has not been performed. Account copy is translated, but an account-screen browser flow has not been established as reachable in the current game shell. The intermittent earlier missing-`main` selector failure did not reproduce in the current quality matrix, so its original cause is not established.
