# HANEDANIAN production quality — 2026-10-08

Baseline: origin/main and Vercel production READY both `74e414e991b789735b428ff0e50def21cb042cbb` (#147). Preserve TC SIM #145, JITEM #146 and Çete #147. Canonical standalone runtime `/games/hanedanian/`; no legacy game, native, audio, shared engine or portal changes.

## Audit

| Status | Evidence |
| --- | --- |
| DONE | Local resources, paid construction/recruitment, terrain production/defence/travel, POI attachment, region projects and consumptive cross-region supply affect strategy. |
| DONE | AI builds, recruits, expands, scouts, reinforces threatened towns, offers truces and recalls losing attacks. Three campaign routes have distinct spatial and military/political conditions. |
| PARTIAL | Permanent dynasty abilities work but their actual bonuses and XP costs were hidden. Recurring heir decisions had no cost/outcome preview and appeared after a long campaign checklist. |
| MISSING | Full family tree, aging/death and generational succession are not in the existing design. Ruler/heir names and a generation field are not a functioning succession simulation. No new family engine added; screen now describes this boundary honestly. |
| BROKEN | With an empty garrison, starvation charged expedition upkeep but removed no soldier while reporting a loss. Captured origins could leave displaced expedition upkeep unassigned. |

## Changes

- Apply the existing one-soldier starvation loss to expedition troops when the home garrison is empty; preserve deterministic tick/save behavior and critical pause. Captured outpost expeditions draw upkeep from their surviving founding capital without changing their route/ETA.
- Empty scouting parties cannot produce intelligence; empty attackers cannot inflict minimum defender casualties.
- Place pending heir decisions first. Show all three costs, outcomes, 80-game-hour recurrence, resource tradeoffs and affordability; use saved heir name instead of hardcoded Umay.
- Show current and next permanent bonuses for all five abilities, actual XP prices, cap and disabled unaffordable spending. Keep the existing parchment/card palette and 44px controls; stack decisions on mobile.
- No save schema/slot/envelope change. Existing build plugin hashes runtime changes into the atomic service-worker package automatically.

## Verification

- Baseline: 141 tests passed. Expanded targeted suite includes expedition starvation, capture supply reassignment, atomic/repeated heir decisions, persistent ability effect, UI cost gating and decision placement.
- Three seeds × wealth/dominion/dynasty: 9 completed campaigns; 9 idle/expansion/circular-trade counterexamples, no exploit victory. Local simulated 1x completion ranges: wealth 10.93–12.97 h, dominion 11.27–14.03 h, dynasty 14.67–18.47 h. These are deterministic simulated runs, not human playtime claims.
- Local typecheck/build PASS. Dedicated `hanedanian-quality` gate reruns targeted tests, long runs and build on the exact PR head.
- Real Chromium matrix: 320/360/390/430/1440, five sections, reachable 44px decisions, all three heir choices, permanent upgrade, autosave/reload, map keyboard selection and paid build. Screenshots/results uploaded by the gate; release result is recorded in the PR.

## Boundaries

No new succession system or broad visual rewrite. Physical-device touch/GPU and live visual/gameplay acceptance remain with the user. Stop after merge, READY and technical smoke.
