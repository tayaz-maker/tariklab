# Boardworld Deep Society 3

Baseline: `d2c1810da439dd831fff07992c1c278788a64a4c`, fetched from `origin/main` on 2026-11-15. Integration branch: `feature/boardworld-deep-society-3`.

## Previous release

PRs #262 and #263 were already merged. Exact-main CI runs 43696000266, 43696000267 and 43696000269 succeeded. Cloudflare native main Git build `06a2e481-ebab-4d27-9910-ecd7dcfd105c` showed Ready, Worker `2d024696`, 100% traffic. Both production origins matched all 48 expected Boardworld assets each (96/96). This verifies the preceding release, not Deep Society 3 publication.

## Playability audit

The unchanged baseline browser journey ran against an isolated archive. A fresh character visited all 31 districts, used transport and purchased meals, earned a local wage, signed a Gaziemir lease, enrolled in a Balçova course and reloaded the save. TR/EN/PL, mobile and keyboard checks passed. This journey did not sign a lease or buy property in every district.

Existing district/economy tests separately verify a funded employer and finite property in every district, actual local employment/lease actions, services and business ownership. Gold's three Istanbul districts retain their original NPC systems; the other 28 use bounded regional residents. Background population remains aggregate.

Three bottlenecks addressed:

1. Uniform regional career/relocation thresholds: stable identity and generation traits now alter funded training, employment and relocation decisions; financial pressure changes goals.
2. Weak leadership/territorial consequences: factions, ambition, legitimacy, desertion, leadership changes and selected policies affect existing rosters, accounts and operations. Outreach, maintenance, rivalry and withdrawal use finite funds and leave bounded reasons.
3. Opaque relationship consequences: contextual stories connect real meetings, household and enterprise decisions to memory and later opportunities. The existing four primary navigation areas remain.

## Integration and persistence

Gold's engine and the existing family, economy and legal authorities remain authoritative. New society/story domains use `expansion.deepSociety = 3`, retaining `livingWorld = 2` geography and lazy loading.

Exports declare `tc-sim-boardworld-living-world-3-dictionary-1`; canonical saves use `tariklab.boardworld.v7.living-world-3`. The original envelope is validated before deterministic migration. Promotion preserves prior slots using the existing IndexedDB generation and Web Lock protocol. Native released-LW2 browser checks verify stale rejection and that refreshed old clients cannot overwrite the new slot. Downgraded envelopes and missing domains are rejected.

Traits and histories are bounded. Organization identities remain fixed. Succession preserves accounts and estates while personal memberships/liability remain personal. Views do not advance simulation. Verdicts require the actual stock-loss source and a distinct direct witness at the incident time. The UI distinguishes report, investigation, allegation review and finding; rumor is not a conviction.

## Evidence classification

New resolver journeys start from fresh games and use ordinary actions: autonomous paid career training, desertion and return, paid outreach and rivalry, player promotion/leadership/policy changes and social choices. These are not initialized as rich leaders or established friends.

Prepared controls remain distinct: malformed saves, released envelopes, interruption boundaries and rare family/business conditions. The paired 2,160-day economy/organization simulation represents 72 compressed 30-day game years and checks deterministic replay, bounded records, estates, debt, territorial turnover and legal outcomes. It is not a player journey.

## Release gates

The original 730-test inventory, Gold/emergent endurance lives, stale/legacy/concurrency checks and continuous natural-generation browser journey remain mandatory. New tests and story browser checks are additive. No assertion, required check, package ceiling or Cloudflare guard was relaxed. Gzip ceilings: Gold 301,836; initial TR 205,874; expansion 96,000; combined 400,000 bytes.

Final package, CI, merge and production evidence must be recorded after verification.
