# Çete Savaşları — production quality, 2026-10-08

Baseline: origin/main and Vercel production READY at `501bc339145d1c49bdd79ce7567164a7699536ef` (#146). Canonical game source is this repository's `src/game` and `src/components/game`, not the project name on Vercel. TC SIM #145, JITEM #146 and all other games are excluded from this wave.

## Audit
- DONE: jobs and equipment gates, crew assignment timers, property and district income, revenge timers, seasons, three independent saves. Initial targeted tests 26/26 pass.
- PARTIAL: district cards lack opponent/defence information; crew role effects exist but availability is hidden. Rival pressure exists but was a flat random roll. Visual identity and outcome assets already exist and are retained.
- MISSING: no geographic/adjacency map or individual loyalty tree exists. Do not invent these in a repair wave. Existing local support / informant actions were unreachable from the district screen; expose them with costs and consequences.
- BROKEN: zero-cash rivals minted minimum loot; bounty collection could pay after a rejected attack; invalid bounty target could consume cash. Small fractional investment purchases rounded to zero cost; split trades could profit. District income display omitted police cuts. Away control decay rounded back to the same value. Recapturing tiny control losses repeated large threshold payouts. Help promised heat cooldown but clock never cooled it.

## Repair contract
- Preserve save version 15, legacy key, slots and canonical route.
- Cap loot to funds; validate bounty target and fresh knockout; finite investment quantities, ceil purchase / floor sale.
- District cash scales with control gained; threshold notes remain, repeat threshold cash removed.
- Preserve 0.05 away decay using two decimals. Attention cools by 0.5 per ten-minute game step.
- Rival pressure responds to local control, attention and pending revenge. Free lookout/gunman and equipped armour mitigate pressure (maximum 60%); busy specialists create a defence/operations tradeoff. Hospitalized opponents exert no pressure. Pressure losses appear in the log.
- District briefing shows actual income, pressure, opponents, home-only combat/job benefits, support and informant actions. Crew assignment/availability and betrayal risk are visible. Narrow cards/buttons wrap and share the existing surface/palette.

## Verification
35 targeted tests pass, including 50 seeded paired two-day strategy runs, existing 20,000-tick stability, exploit reproductions and schema-15 reload. Browser gate: TR/EN × 320/360/390/430/1024/1440; all seven tabs, real support action, reload, help geometry and screenshots. CI results are the release gate; visual/gameplay production acceptance belongs to the owner.

Limits: four district model, not geographic movement or a new organisation simulator. Existing passive bank compounding and open-ended progression remain; this is not exhaustive economy certification. Physical mobile Safari is not covered by Chromium.
