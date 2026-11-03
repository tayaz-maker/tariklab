# Boardworld 6.0 independent endurance and save evidence

The final integrated matrix passed **19/19 tests, zero failures/skips**: 18 complete 365-day lives and one 730-day stress life. This is focused acceptance evidence, not a claim that all release gates passed. The exact runtime/controller/harness hashes and every day-30/90/180/365 checkpoint (plus 540/730) are in [BOARDWORLD_6_ENDURANCE.json](./BOARDWORLD_6_ENDURANCE.json). The raw task-workspace report and log are `work/bw6-gold-final.json` and `work/bw6-gold-final.log`.

## What was exercised

All three origins (newcomer, graduate, restart), three strategies (career, social, entrepreneur) and two seeds (2026, 91373) use actual public actions. Lower-skill entrepreneurs earn repair training, savings and tools through work before giving notice and leaving employment. No clock, skill, cash or state patches are used. The tests validate every action and input immutability, replay the same actions on a shadow state, reload the shadow every 37 turns and compare the complete state after every action. Compact checkpoint saves preserve the full state, including original histories and RNG.

The policies do real work and promotions, household chores and joint bills, meetings, freelance deliveries, capital/stock purchases and customer service. Delayed systemic consequences remain active after the opening content: completed effects are immediately retried and must fail atomically. Bounded population, secondary identities, offers, feed and history, nonnegative stock/capital and autonomous NPC job/home/contact activity are checked throughout.

## Annual results

Maintenance and strategic columns count classified game actions; they are not human click counts. NPC offers, received reports and autonomous contacts are separate counters in the JSON. All annual checkpoints retained health ≥ 50, housing arrears 0 and cash + bank > 1,000. Annual action totals were 2470–3711; compact final saves were 261708–303245 bytes. Wall times are intentionally excluded from the table: this is correctness testing, not a serial performance benchmark.

| Origin   | Strategy     |  Seed | Actions | Strategic | Maintenance | Delayed finishes | Meetings | Bank / debt TL | Compact bytes |
| -------- | ------------ | ----: | ------: | --------: | ----------: | ---------------: | -------: | -------------: | ------------: |
| newcomer | career       |  2026 |    2519 |       232 |        2089 |               49 |       37 |     544960 / 0 |        268828 |
| newcomer | career       | 91373 |    2516 |       230 |        2092 |               55 |       35 |     534546 / 0 |        268844 |
| newcomer | social       |  2026 |    3649 |       305 |        1234 |               46 |      113 |     389090 / 0 |        297620 |
| newcomer | social       | 91373 |    3697 |       319 |        1227 |               52 |      126 |     389244 / 0 |        301805 |
| newcomer | entrepreneur |  2026 |    3643 |       283 |        1888 |               41 |       35 |     363452 / 0 |        282169 |
| newcomer | entrepreneur | 91373 |    3633 |       288 |        1868 |               45 |       34 |     359146 / 0 |        280787 |
| graduate | career       |  2026 |    2470 |       219 |        2066 |               48 |       20 |     545417 / 0 |        261708 |
| graduate | career       | 91373 |    2538 |       237 |        2096 |               55 |       37 |     535575 / 0 |        271041 |
| graduate | social       |  2026 |    3649 |       326 |        1218 |               51 |      130 |     392487 / 0 |        301112 |
| graduate | social       | 91373 |    3633 |       321 |        1226 |               54 |      123 |     393087 / 0 |        303245 |
| graduate | entrepreneur |  2026 |    3622 |       284 |        1871 |               41 |       26 |     364081 / 0 |        276177 |
| graduate | entrepreneur | 91373 |    3673 |       292 |        1900 |               42 |       38 |     369559 / 0 |        284083 |
| restart  | career       |  2026 |    2549 |       250 |        2102 |               54 |       37 |  535613 / 7367 |        270757 |
| restart  | career       | 91373 |    2531 |       249 |        2087 |               60 |       35 |  530402 / 7367 |        270975 |
| restart  | social       |  2026 |    3625 |       321 |        1233 |               46 |      108 | 392216 / 17114 |        300490 |
| restart  | social       | 91373 |    3671 |       336 |        1249 |               54 |      122 | 389374 / 17114 |        303152 |
| restart  | entrepreneur |  2026 |    3711 |       276 |        1925 |               52 |       32 |  357821 / 7942 |        269965 |
| restart  | entrepreneur | 91373 |    3671 |       301 |        1887 |               48 |       33 |  349027 / 7367 |        282678 |

The 730-day restart/career/91373 run completed **5064 legal actions**, 118 delayed finishes and 5786 autonomous NPC contacts. Its final compact save was **284214 bytes**, housing arrears 0, bank 1,118,282 TL and debt 763 TL. Days 540 and 730 also preserve full compact round-trips and continued delayed decisions.

## Separate save and batch regressions

The genuine v5 fixture capture used the frozen released `78ec4ee339051840037e48e80f4b07518d5a1424` modules and original controller: six full legal years produced 25 envelopes and six public-action traces, without state patches. Three fresh origins, progressed 30/90/180/365-day states and active project/calendar/enterprise/household/causal/invitation/knowledge examples are bound by [v5-provenance.json](../../scripts/fixtures/boardworld/v5-provenance.json). The old writer is preserved verbatim except its documented import retarget.

The focused save gate passed **123/123** (110 retained legacy-save cases, 11 new v5/v6 cases and 2 codec cases). It verifies pure/idempotent migration, every old field/history/RNG, immediate protected promotion, exact immutable archive bytes, authentic stale-v5 writes, canonical backup precedence, quota/silent-write failures, malformed envelopes/dictionaries, mutable-load isolation and smaller mature saves. The newer paired save-byte/timing artifact is a separate measurement; do not infer timings from this endurance run.

Two additional independent batch tests passed **2/2**. Real starting decisions/hiring/shift actions prepare their states. Routine work/wait/sleep and post-shift cook/rest are replayed as individual public actions. Every authoritative field—including ledger, contracts, NPC plans/knowledge and PRNG—must match. The only differences are the explicitly asserted summary revision/log and batch stop/trace diagnostics. The existing payment-boundary cases remain unchanged.

## Findings and limits

The first candidate run exposed an actual day-58 free-contact/calendar-reschedule invariant, which was fixed and permanently covered before the matrix passed. A later privacy audit removed a legacy support fallback that read undisclosed cash. The earlier 19-pass candidate imported the pre-privacy graph and is not counted as final evidence; the reported final run includes the integrated privacy fix and its source hashes still match.

These policies are deliberate scripted paths, not human playtests. In particular, restart paths retain debt while accumulating large bank balances because they do not prioritize principal repayment. This is visible in the table and is a balancing/player-choice question, not proof of optimal finance. The finite matrix cannot cover all player histories. Browser accessibility/localization, full repository checks, payload budgets, fresh paired performance and exact production deployment remain separate release gates. Boardworld 6.0 is Gold preparation, not Gold certification.
