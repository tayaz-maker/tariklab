# Boardworld 5.0 baseline audit and risk register

This is the independently reproduced 4.0 starting point, not a 5.0 release claim. The immutable snapshot is main `c2e7f352d471b819c6d955b6ff106aaf3b26226c`, tree `6a83d1a4c14503e6bee5ef4a2421e2f35b80b745`. A fresh public-site read matched all 24 game assets (761,300 bytes) to that exact tree before implementation. The real production 4.0 browser suite passed at 1440/390/320, including actual travel, routine preferences, household escrow/exit, secondary contacts, causal events, save/reload, authentic v3 migration and stale-v3/current-v4 tab interleavings. Console/network error lists were empty; desktop and mobile screenshots were visually reviewed. A separate fresh production core suite also passed actual jobs/shifts/travel/save/import/recovery at all three widths and the original TC SIM save/reload smoke test.

The clean snapshot reproduced **2,748/2,748 tests** (2,687 JS +61 TS, no failures/skips), production build and typecheck. Lint remains **0 errors /62 inherited warnings**. Test time was 239.794 seconds JS plus0.476 seconds TS. A build permission-review timeout was resolved by running the same build under the ordinary workspace sandbox; no guard or source change was needed. Evidence is in [BOARDWORLD_5_BASELINE.json](BOARDWORLD_5_BASELINE.json).

## Real long-life traces

Six legal lives use the released 4.0 policy, career/social/entrepreneur × seeds2026/91373, from the indebted restart. The independent capture never patches state or balances. Every result is strictly valid, each 30/90/180/365-day checkpoint round-trips exactly, and the full repository suite separately replays these lives after export/import. Twenty authentic v4 envelopes cover all three fresh origins, the three strategies at days31/91/181/366, and active calendar/project/enterprise/household/deferred-causal states. Provenance pins all source hashes, envelope bytes, six action traces and the original v4 persistence writer.

| 365-day strategy | Resolver commands | Maintenance-class commands | Classified major choices | Bank / outstanding debt | Completed goals             |
| ---------------- | ----------------: | -------------------------: | -----------------------: | ----------------------- | --------------------------- |
| Career           |         2423–2436 |                  2079–2095 |                      191 | 531227–534821 /7226 TL  | Foundation, mastery         |
| Social           |         3558–3644 |                  1207–1214 |                  284–285 | 393521–395157 /17114 TL | Foundation, social circle   |
| Enterprise       |         3522–3533 |                  2001–2046 |                      170 | 310351–332950 /7942 TL  | None in this frozen policy |

All six end with health100 and no rent arrears. These counts are resolver invocations, not measured human gestures. The classifier includes ordinary work/food/sleep/travel/practice as maintenance; it does not prove those actions should be removed. Zero-gain practice and full-needs rest were absent. Social traces contain1463–1562 calls/talks without immediate affinity/trust change; those may still reveal knowledge or affect commitments, so they are not automatically classified as waste.

All paths can afford to repay debt well before year end but their frozen policy never selects full repayment or an installment agreement. Career/enterprise accept some actual causal principal payments, whereas social debt compounds at the existing3% monthly rate. This exposes a weak decision prompt and a blocked financial-security goal, not proof of conjured income. Preserve the player's choice and existing interest ledger; expose a reviewable repayment opportunity rather than silently paying debt. Existing earned wages, business stock/labor costs and rent remain authoritative.

## Routine friction and fair comparison

The matched workload is a plain retail/restart life using the same seeds and explicitly choosing `meal=frugal` plus `autoWithdraw=true`. Weekly automation already exists in4.0. Do not attribute it to5.0 or compare a5routine against a4manual life.

| 365-day measure                                         | 4.0 explicit frugal/withdraw | 4.0 default preferences |
| ------------------------------------------------------- | ---------------------------: | ----------------------: |
| Total outer commands                                    |                      333–334 |                 865–897 |
| Manual maintenance commands                             |                           14 |                 226–238 |
| Routine-control commands                                |                      150–151 |                 472–492 |
| Other setup/decision commands                           |                          169 |                     167 |
| Actual zero-time routine stops                          |                           14 |                 226–238 |
| Internal routine actions                                |                    2004–2009 |               1733–1745 |
| All meal/cash stops, including runs that advanced first |                            0 |                 343–360 |

Configured runs preserve108 consequential-event stops,8–9 story stops and24 financial-boundary stops. Fourteen stops advance no time: two missed-shift warnings on day8 and one sleep boundary per month. Each monthly boundary generates a first advancing stop and a second zero-time attempt; the player then explicitly sleeps. Bank funds are sufficient and rent arrears are zero, but existing debt interest changes the balance and the broad financial guard pauses. This is a candidate for an explicit, bounded contractual-settlement preference with funds/budget checks, not permission to remove financial consent.

The primary matched avoidable-command denominator is disclosed as **14 manual maintenance recoveries +14 redundant zero-time retries =28**. Necessary card/story/lease/debt/relationship decisions and productive routine controls are separate. A25% improvement requires at least7 fewer commands in this defined set while preserving meaningful choices. An optional saved horizon may reduce resume controls but must be reported in its own category. Default cash-poor stops cannot be credited as a5improvement merely by selecting a preference that4already had.

A separate real UI audit found disabled-weekday retries advance no time but increment revision repeatedly; the stopping panel lacks a direct repair control while weekday preferences are far below. Meaningful blockers need stable keys, disabled unchanged retry and a relevant direct action. Player-disabled days must not be re-enabled automatically.

## Matched performance and save cost

The same installed Chrome and frozen production-static build ran the existing Living flow three times serially, with all other agent test/build/browser work stopped. Counts are20/39/20 synchronous handler samples at1440/390/320. Reported p95 is the median of the three per-run p95s; paint/network are excluded. Local FCP is separate and is not an internet or low-end-device claim.

| Width | Fresh4.0 handler p95 | 5.0 +10% target | Local FCP median |
| ----- | -------------------: | --------------: | ---------------: |
| 1440  |               17.5ms |         19.25ms |             60ms |
| 390   |               18.2ms |         20.02ms |             40ms |
| 320   |               17.3ms |         19.03ms |             36ms |

Historical4release15.x-ms values are not reused as this turn's baseline. Current runtime gzip is206279 bytes; the +15% target is237220 bytes. Node profiles separately measure31samples after3warmups per API at day1/31/91/181/366. At day366 the maximum per-life p95 is2.96ms resolving an action,1.41ms for calendar view and14.88ms saving. Save/export validation is therefore a measured cost worth reviewing after5state exists. Any optimization may cache only exact immutable-envelope validation metadata, not mutable parsed states or revision-only trust; corruption/quota/readback checks must remain.

Final performance-harness saves are248429–294912 bytes; fixture names produce slightly different lengths, explicitly retained in provenance. Every record limit still holds. These bounded365-day observations do not prove an infinite-time size bound, so5must test caps and longer/adversarial histories as well as its final checkpoint sizes. Retained heap includes traces/checkpoints rather than representing peak application memory.

## Risk register and required proof

| Risk                                                   | Existing evidence / required5proof                                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stale released4 tab overwrites upgraded progress       | Separate canonical5slot; read-only4primary/backup; immutable4original before promotion; actual frozen1/2/3/4writer interleavings and browser storage events.                   |
| Migration rewrites old knowledge, contracts or rewards | Strict original-schema/checksum validation; compare all old fields; add only society/flow neutral defaults; unchanged time/RNG/money; idempotent reload.                       |
| Cached validation accepts corrupted storage            | Re-read storage each call; exact-byte bounded cache only if measured necessary; valid-checksum malformed replacement, silent writes and quota failures tested.                 |
| Automation conceals consent or loops                   | Stable blocker keys/direct recovery; explicit financial preference; no automatic new debt, lease, relationship or story choice; classify actual zero-time attempts separately. |
| High bank plus debt mistaken for an exploit            | Trace earned money and interest; show explicit repayment consequences; no forced payoff or invented funds.                                                                     |
| NPC society leaks private facts or double-pays         | Sourced delayed learned snapshots, bounded queues/edges/cooldowns, real-wallet transfers, interrupted appointments and replay idempotency tests.                               |
| More society detail exceeds performance/save budgets   | Same-device matched workloads, separate API costs, bounded histories/actor counts, raw/gzip initial versus total locale payload disclosed.                                     |
| Localization falsely claimed complete                  | Baseline game is Turkish; portal EN/PL did not translate game. Audit selected-language controls/content and formatting; mark immutable untranslated original records honestly. |

Known presentation defects include raw `balanced`, long decimal output and concatenated `ve60 gün` in some existing views. Locale changes must never mutate simulation, saved original prose or another game. All5new interface text requires TR/EN/PL coverage; any remaining legacy gaps must be enumerated rather than hidden behind a translated shell.
