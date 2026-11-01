# Boardworld 4.0 independent acceptance

This record supplements [the measured 3.0 audit](BOARDWORLD_4_AUDIT.md) and [implementation contract](BOARDWORLD_4_CONTRACT.md). It separates engine actions, routine commands, observed interface interactions and browser handler timings. None is presented as another measurement.

## Authentic upgrade and recovery

`scripts/boardworld-save.test.mjs` has 78 cases. Eighteen authentic 3.0 envelopes were captured from unmodified production commit `5d22f86c462e22b6fd31793b5f2a81606d9f5603`: all three starts, three distinct lives at days 31/91/181/366, and active calendar/project/enterprise states. Provenance pins original modules, envelope bytes and complete legal action traces. The frozen 3.0 persistence writer differs only by its documented engine import path; a SHA 256 test verifies its exact released source.

Migration validates each old checksum and original schema before adding version 4 defaults. Tests compare every earned old field, clock, relationship, balance, obligation and history; repeat migration/import does not settle a day or grant a reward. Actual released writers 1/2/3 run against shared storage while version 4 makes progress. They cannot alter `tariklab.boardworld.v4` or its backup. Exact immutable originals remain in `.v1.original-v1`, `.v2.original-v2` and `.v3.original-v3`; older primary and rolling backup slots remain read-only. Legacy promotion happens on load, closing the window before the first player action. Corruption, primary/backup priority, explicit file imports, quota failures and silent failed writes are covered.

## Legal long lives and independent causal checks

`scripts/boardworld-emergent-acceptance.test.mjs` contains 14 independent cases. Six are complete 365-day lives, career/social/entrepreneur × seeds 2026/91373, starting from the indebted restart scenario. Existing acceptance retains all three origins, nine 90-day replay lives and six 180-day career lives. No endurance state, balance, skill, calendar, relationship or date is patched. A second state replays every accepted action; every 37 th action exports and imports that state before exact equality is checked. All actions preserve their input and every resulting state passes strict validation.

The new policies prioritize real appointments, earned shifts, deliveries and needs, then choose causal plans and their later follow-ups. They also renew leases, conduct contextual conversations and, in the social path, earn a consenting shared household. Checkpoints at 30/90/180/365 days require solvency, viable health, bounded records and at least two completed delayed follow-ups in every interval. Counting only a card opening or declining every card would not pass. Completed follow-ups are rejected if replayed. The enterprise path deliberately has six eligible families; an absent job or partner does not receive a fabricated employment or romance event.

The other eight cases test:

- A full next monthly rent and utilities settlement in an earned household, with automatic payment and with queued manual bills. The roommate pays the actual share once; the player pays exactly the remainder. Saving/reloading and manual payment cannot charge the roommate again.
- Actual warning → negotiation → final notice → forced lease loss, preserving debt, ending shared housing and refunding unused escrow once. Only the accumulated-arrears precursor is a focused fixture; warning dates and consequences advance through real actions. Safe housing retains recovery actions.
- Romance created through two actual dates and an explicit partnership, followed by another later date and the actual deferred follow-up deadline.
- A real move to Beşiktaş, genuine commuting to the existing Kadıköy employer and the actual deferred transport follow-up deadline.
- A focused illness precursor, paid clinical care and real recovery days; opening the planning card does not immediately cure illness.
- Default cash-poor automation stops without spending bank funds. One explicit auto-withdraw choice then executes a real conserved bank-to-cash transfer, grocery purchase and cooking; it does not create money.
- Six permanent secondary people earned through local visits, different jobs and real business services. A seventh qualifying encounter cannot exceed the cap or duplicate the 450 residents shared with the aggregate population.

Focused fixtures are explicitly labelled and are separate from the six fresh-start endurance lives. Isolating eligibility cooldowns in a targeted test never inserts an event, a completed follow-up or a payout. The root/simulation focused suites additionally cover every causal family and variant, shared-household choices, order transfers, deadlines, stale contracts, earned workload pay and NPC information boundaries.

## Comparison and interpretation

The production 3.0 baseline already had functional weekly automation:154–155 outer commands and 1840–1842 inner actions for a plain retail 365-day life. Comparing new automation against 2079 manual career actions would falsely attribute an existing capability to 4.0. The final comparison therefore retains the original routine workload and records default versus explicitly configured 4.0 policies separately. Additional meaningful causal decisions can increase outer commands; that is distinct from wasteful repeated recovery or capped practice.

The manual 3.0 career traces made 637–641 practice actions with no immediate skill gain and 77–100 rest actions with no immediate energy/stress/health gain. New legal 365-day checks reject both kinds of false progression. Social affinity/trust saturation alone is not labelled useless: a conversation can still reveal information, change commitments or teach a skill.

The completed independent matrix recorded the following 365-day outcomes. Final all-repository validation replays the same policies after source freeze; wall-clock timings from concurrent test runs are deliberately omitted here.

| Strategy   | Manual resolver actions, 3.0 → 4.0 | Completed deferred 4.0 follow-ups | 4.0 total major choices | 4.0 serialized save bytes |
| ---------- | ---------------------------------- | --------------------------------- | ----------------------- | ------------------------- |
| Career     | 2079–2085 → 2423–2436              | 55                                | 191                     | 248429–248437             |
| Social     | 3228–3286 → 3558–3644              | 59                                | 284–285                 | 293537–294912             |
| Enterprise | 3272–3276 → 3522–3533              | 44                                | 170                     | 248983–249085             |

All six ended with health 100 and no rent arrears. The major-choice classifier is explicit in `boardworld-emergent-scenarios.mjs`; counts are not subjective player ratings. More decisions also mean more manual commands, so this table is not advertised as fewer human clicks. The long scenarios completed 5–31 delayed follow-ups per checkpoint interval; the late-year intervals did not exhaust the game’s causal decisions.

A separate 365-day retail routine comparison used seeds 2026/91373. Original 3.0 used 154–155 outer commands, 1840–1842 inner routine actions and 20 zero-time routine stops. With two explicit settings (`meal=frugal`, `autoWithdraw=true`), 4.0 used 333–334 outer commands, 2004–2009 inner actions and 14 zero-time stops. It paused for 108 consequential event decisions, 8–9 story choices and 24 financial boundaries; it completed 312 shifts, stayed healthy and paid rent. There is **no claim that total inner actions decreased**. New choices and costs change the workload, so this is a gameplay/control comparison, not a CPU benchmark.

Default 4.0 deliberately does not withdraw automatically and requires the selected home-cooked meal. A bank-rich but cash-poor unconfigured trace therefore incurred 343–360 meal stops and 865–897 outer commands. The configured comparison had no meal/cash stop. The UI now explains the opt-in setup and the engine names the cash condition; conservative defaults remain explicit. Original 3.0 did **not** auto-withdraw: its free-meal fallback avoided that particular cash constraint.

A causal family is a finite authored rule with conditions, choices and deferred consequences. These are not unlimited unique story scripts or a language-model-generated narrative. The fixed 12 important people, up to 6 persistent secondary identities and conserved aggregate population are deliberately different levels of simulation. Prices, leases and disputes remain game abstractions.

## Final verification record

The frozen runtime passed **2748/2748 repository tests** (2687 JavaScript +61 TypeScript, 0 failures/skips), typecheck and production build. Lint has 0 errors and the same 62 pre-existing warnings. The production output contains 24 runtime assets, all byte-identical to source. The full suite includes 78 save tests, 57 preserved deep/living acceptance cases and 14 new independent cases. The old Living browser’s primary-intent-button selector was subsequently narrowed because the new contextual shortcut made the generic locator ambiguous; the identical workload then passed all three serial repetitions. No runtime or assertion was removed.

Final asset size is **761300 raw /206279 local-gzip bytes**, compared with 569636 /153937 in 3.0. This stays within the preferred 220 KB gzip budget. These are the game’s files, excluding the portal shell; gzip is computed locally rather than represented as an observed network transfer.

| Viewport | 3.0 median handlerp 95 | 4.0 median handlerp 95 | Change | 4.0 local FCP median |
| -------- | ---------------------- | ---------------------- | ------ | -------------------- |
| 1440     | 14.8 ms                | 15.7 ms                | +6.1%  | 52 ms                |
| 390      | 15.4 ms                | 15.9 ms                | +3.2%  | 48 ms                |
| 320      | 15.2 ms                | 15.9 ms                | +4.6%  | 48 ms                |

Both versions use the same installed Chrome, production-static serving and Living City flow, with 20/39/20 handler samples per run at 1440/390/320. Three repetitions run serially while other test/build/browser work is stopped. These are medians of each run’s p 95, not pooled percentiles. All widths remain below the preferred 20% regression threshold. Handler measurement excludes paint/network; local FCP is separate and is not an internet or low-end-mobile claim.

Six serial Node profiles use the same 365-day policies without the replay shadow. Whole-life times (including action selection, input immutability, strict validation and periodicGC) were career 10.22–10.40 s, social 17.19–17.27 s and enterprise 14.77–14.82 s. Corresponding 3.0 times were 4.84–4.92 s, 8.83–9.10 s and 7.57–7.60 s; new state and additional choices cost CPU, so no simulation speedup is claimed. Separate 31-sample API measurements after 3 warmups isolate the costs: at day 366 the maximum per-life p 95 was 0.50 ms for `getActions`, 1.02 ms for calendar view, 2.92 ms for an action resolver, 5.17 ms for export and 14.81 ms for saving. The storage benchmark uses an in-memory Map and does not measure browser disk/quota latency.

At 365 days, saves are 248429–294912 bytes, compared with 132227–169721 in 3.0. Final retained-heap deltas are 8.82–13.25 MiB versus 5.17–8.94 MiB; they include the action trace and up to five serialized checkpoints, and are not peak-memory figures. Every 30/90/180/365 checkpoint, all API distributions, source hashes, individual browser repetitions and the honest routine comparison are committed in [BOARDWORLD_4_RESULTS.json](BOARDWORLD_4_RESULTS.json). Bounded event/history/NPC records are asserted throughout the legal lives.

The information-boundary audit also verified that an undisclosed private workplace change leaves the complete public life view unchanged; direct conversation or real workplace observation updates the separate known-work fact. A near-cap fractional practice regression ensures an accepted learning action has visible bounded gain rather than rounding to zero.

These results establish tested local source and build quality. Exact-head GitHubPR/main checks, Cloudflare Ready/active-version allocation and actual `www` gameplay/asset smoke tests are separate release requirements, recorded in the delivery evidence after publication.
