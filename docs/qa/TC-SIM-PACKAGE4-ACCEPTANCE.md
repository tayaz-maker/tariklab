# TC SIM Package 4 acceptance preparation

Canonical base: d980a14. This is preparation, not canonical Package 4 acceptance or DONE. Release order: #199 work fuel → #200 insurance allowance → district visibility, with current-head required CI and reconciliation after each merge.

| Goal | Existing or prepared evidence | Gate / boundary |
|---|---|---|
| Rent, sector demand, commute, moving and mother visits | Existing41/41 city tests; locations/quarters/life | Preserve, do not rebuild |
| Ankara/İzmir and map coordinates | Two existing pins each; existing map tests | Keep zoom/pan/click/navigation |
| Observed work fuel | #199;135 targeted +17 long-game on reconciled source | Actual four work weeks + fixed reserve equal existing budget; no duplicate public fare |
| Insurance premium accounting | #200;143 targeted +17 long-game | Within existing reserve; claims/indemnity/real policy coverage NOT implemented |
| Voluntary illicit visibility by district | Independent district branch;204 targeted +17 long-game | Real Chromium TR/EN/PL1280/390, explanations and reload required; not a crime-rate model |
| Weekly time and energy | Existing life, education, work-recovery and decision-budget tests | No new micro-management or free decisions |
| Life history and goals | Existing memories/yearbook/life-depth; existing depth acceptance | Reuse bounded chronological records and derived goals |
| Saves / finance | V5/V6, SAVE_VERSION6, long finance timelines | No duplicate effects, integer TL and debt/asset conservation |
| Physical-device QA | UNKNOWN | User-owned |

Final canonical acceptance must run after the prepared runtime changes merge, with production www/Workers and actual Chromium PASS. Do not substitute branch-local tests for canonical acceptance. New art, cards, Atlas and site asset optimization are not part of these changes.

## Combined preparation checkpoint after #199 release

Canonical #199 main14e50edd00eff73d479bc936844a92e0845d6129 has the exact previously tested fuel source treea6b3f7957efc9f9f1118301abc8cf1e8327cba7d. #200 was retargeted/reconciled to it without changing source treefb3232e21c2e715c146685a4741e37165b7dd285; fresh143/143 +17/17 PASS. New head309b6b58bdd62a9c8597b81f6bad5ed06b4a7cfb still requires current CI.

An isolated integration combines #200 and #201, preserving both browser matrices and every ledger section; frozen hash was recomputed over the full unchanged62-source inventory. **273/273 targeted and17/17 actual long-game PASS**, including V5/V6, work/custody/stall, observed fuel, insurance accounting, monthly cash, district visibility and25 game years. Browser syntax PASS. This checkpoint is not merged, not an actual Chromium result for the combined tree, and not Package4 canonical closure. No new development PR was opened for integration.
