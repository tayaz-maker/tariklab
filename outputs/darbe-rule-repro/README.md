# DRB-237–240 — bounded rule reproduction, 2026-10-05

**Result: NOT REPRODUCED in the valid engine fixtures below.** This does not close the user's separate P1 report, certify the browser UI or establish that every legacy save/state works. No gameplay, source card, shared engine or production asset was edited.

Baseline: `562831dba3b16be2a0bc8b2aec2e613eb1b80f45`.

Run from the repository root:

```sh
node --test outputs/darbe-rule-repro/repro.test.mjs
```

Observed result: **21/21 PASS**, including the baseline hash guard. `results.json` records the exact source/runtime effect mapping, fixture SHA256, starting state, legal special-summon and activation commands, resumable selection, final state and engine log. The four `DRB-xxx-fixture.json` files are genuine serialized, validator-accepted engine fixtures, not edited production saves. Production source hashes are checked against the baseline before execution and rechecked afterward.

| Card | On-field materials used | Printed and observed KP cost | Observed real engine result |
| --- | --- | ---: | --- |
| DRB-237 Telex Kurulu | DRB-005 Telex Kâtibi + DRB-006 Muhtıra Kâtibi | 900 | Special summon succeeds; selected opposing open support returns to its owner's hand |
| DRB-238 Zeyil Masası | DRB-007 Zeyil Kâtibi + DRB-008 Brifing Kâtibi | 1000 | Same expected effect observed |
| DRB-239 Arşiv Kurulu | DRB-009 Kabine Kâtibi + DRB-010 Arşiv Kâtibi | 1100 | Same expected effect observed |
| DRB-240 Yazı Heyeti | DRB-011 Tebligat Kâtibi + DRB-012 Meşruiyet Raportörü | 1200 | Same expected effect observed |

Starting conditions: seed 9; turn 3; main1; active player 0; 8000 KP; the requested fusion card in auxiliary; both named material cards face up in the player's unit slots; opponent's DRB-097 Ek Cetvel face up in support slot 0. `validateState` accepts the initial and final states. The fixture places these preconditions explicitly; it does not claim a complete naturally played match produced them.

Actual `legalActions` provides the special summon. Real `dispatch` consumes both field materials and places the fusion card. The card's activation is then listed legally; actual dispatch charges the printed amount and creates the target selection. Save/deserialize is exercised before special summon, after special summon and while target selection is pending. After restoration, a real `choose` command sends DRB-097 into the opponent's hand. No effects, catalog records or rules are mocked.

Negative controls for each of the four cards also pass:

- Materials only in hand do not offer the field-material special summon.
- A face-down opposing support returns `no-legal-target` and no activation action.
- One KP less than the printed cost returns `insufficient-points`.
- A second activation during the same turn returns `effect-used`.

The source text describes a once-per-turn activated effect. These four runtime records have an empty automatic `triggers` array and an explicit `costs → select → move` activation; the tested action resolves correctly. Reading `triggers: []` alone would therefore not prove a rule failure.

**Remaining B11 work:** retain the reported P1 as open/unconfirmed with this contrary engine evidence. Reproduce the failing browser interaction or exact affected saved state before proposing a fix. If a defect is found, it requires a separate narrowly scoped rules/UI PR with strong regression coverage; card-art work does not resolve it. This run contains no browser, production, AI-frequency or physical-device claim.

Only the reproduction source and result are versioned here. Running the command regenerates all four small serialized fixture files with the SHA256 values recorded in results.json. They contain synthetic test state, not user data.
