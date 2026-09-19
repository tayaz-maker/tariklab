# HANEDANIAN — design freeze, 2026-09-19

Source: user-supplied `TARIKLAB_ASTRA_HANEDANIAN_IHTILAL_UPGRADE(1).md` in full.
Canonical repository verified through GitHub and Vercel: `tayaz-maker/tariklab`
(renamed from `cete-savaslari`). `tariklab-app` is the paused native repository.
Baseline: `9e747ebf6de55cfb0eb526d0c56b63e4320259cf`; parent is the supplied
`e091644e70f5d257adb96591d0690d065416b701`. Branch: `astra/hanedanian-ihtilal-upgrade`.

## Audit and reuse

Existing HANEDAN is a 2,401-line standalone gang/generational game, with draft,
weekly raids, personnel, localStorage slots and a seven-tab interface. It has no
strategic terrain, settlement economy or travel simulation to extend. Retain the
portal/iframe integration, offline infrastructure and legacy game as a recovery
surface; replace the active experience with an independently testable strategy
engine. Preserve every legacy key and original runtime at
`/games/hanedan/legacy.html`. Do not pretend that gang saves map into settlements.
Old saves remain playable/exportable there; new campaign creation is explicit.

## Product and visual contract

You lead a dynasty: improve a settlement, scout terrain, choose resource and
route advantages, establish new settlements, then win through dominion, wealth
or political influence. Map is the primary workspace. Use original warm stone,
parchment, sage terrain and restrained terracotta accents. No borrowed assets,
names, progression/combat tables, screens or text. Audio remains disabled.

Desktop: left settlement/campaign rail, central map, right selected-tile/action
inspector; collapsible side rail, top economy/time. Mobile: central map, five
tabs, safe-area-aware bottom tile sheet, 44px controls. Near/region/world zoom,
pointer-capture pan, anchored pinch/wheel zoom, drag-vs-tap suppression, hover,
keyboard selection, no full-map DOM.

## Architecture

Native ES modules under `public/games/hanedanian/`, no server-dependent gameplay:

- `data.js`: original terrain, resource, building, unit and objective values.
- `world.js`: seeded coherent 49×49 world; separate simulation RNG stream.
- `engine.js`: one-minute deterministic ticks, guarded commands, economy,
  construction, expansion, armies, combat, scouts, eight scheduled AI dynasties,
  trade/diplomacy, dynasty growth and campaign.
- `map.js`: viewport-culled Canvas2D renderer and input adapter; no game rules.
- `save.js`: validated, checksummed, versioned IndexedDB transactions; automatic,
  previous and manual slots; export/import, explicit recovery and failure state.
- `app.js`, `index.html`, `style.css`: semantic controls and rendering adapters.

Default clock paused; 1×/4×/12× controls; critical reports auto-pause. Hidden or
closed app does not simulate attacks or accrue punitive absence. No wall-clock
catch-up. Campaign duration is a balance target, not a measured claim.

## Shared state/API contract

`schemaVersion=1`, `playerId`, `time` (game minutes), `paused`, `speed`, `world`,
`settlements`, `factions`, `armies`, `reports`, `intel`, `dynasty`, `campaign`,
`settings`. World has flat row-major `tiles` with x/y/terrain/optional POI.
Settlements own food/wood/stone/iron, buildings, troops and queues. Influence is
a political resource, not the fifth generic production meter. Scouting creates
timestamped snapshots; unexplored opponents do not expose their actual garrison.

Engine public API: `createGame`, `advance`, `dispatch`, `validateState` plus
read-only rates/cost/travel/campaign/knowledge helpers. Failed commands must not
mutate state. Map takes state and emits tile-selection/view callbacks. Storage
snapshots at call time and serializes writes.

## Work sequence and gates

1. Audit/design freeze (this record); preserve baseline sweep fixes.
2. Core and small two-AI vertical slice tests.
3. Full map/AI/POI/progression and interface integration.
4. Persistence and explicit offline shell; no network game dependencies.
5. Determinism, illegal command, economy, queues, travel/combat/scout/AI,
   corruption/recovery/migration tests; existing site regressions, lint, TS, build.
6. Desktop 1280×720/1920×1080 and mobile 360px/touch smoke, 20+ minutes of
   mobile gameplay, actual offline reload/save/reconnect and production QA.

Do not substitute HTTP or VM tests for a browser gate. At audit time the managed
browser failed to create/list tabs (CDP refresh timeouts); record a blocked gate
honestly if unavailable later. No passing QA claims without corresponding runs.

İHTİLAL is independently audited and updated in `docs/ihtilal/`; initial code
diagnosis is UX/feedback, preserving its existing engine and saves. Other games
receive only evidence-backed P0/P1 work; no speculative mechanics churn.

## User addendum — İHTİLAL engine authority

The user explicitly reconfirmed during implementation that İHTİLAL's existing
engine may be replaced if needed and that they did not like the current game.
Preservation is a preference for proven good pieces, not a requirement to keep a
weak core. Reassess meaningful decisions and the first five minutes after clarity
changes; redesign mechanics/core-loop where demonstrated shortcomings remain.

## Release-candidate pacing amendment

The stockpile/trade-volume route is superseded by consumptive regional progression.
Nine geographic regions differ in terrain, strategic points and neighboring AI;
players choose at least six suitable regions rather than occupying fixed coordinates.
All routes need developed settlements, three specializations and five genuine
cross-region supply links. Regional investments require progressively stronger
infrastructure, intelligence and held strategic points; each consumes equal local
and imported resources. Standing supply uses normal paid caravans and travel times.

- Economy: eight settlements, six mature economic regions, market network, influence,
  then six regional finale deliveries.
- Dominion: developed military regions, fourteen strategic points, three distinct
  major battlefield victories, sustainable army strength, influence and finale.
- Politics: developed political regions, diplomacy, at least three vassals,
  influence and finale; vassal strategic presence counts for political control.

Founding costs rise with administrative breadth, including pending founders.
Specialization trades resource output or unlocks a regional path. Demobilization
reduces upkeep without refunding recruitment. Existing building timers and 12× stay
unchanged. Additive campaign metadata keeps original version-1 saves loadable;
legacy HANEDAN remains separate and unchanged.

`CAMPAIGN_BALANCE_REPORT.json` records 20 deterministic seeds × three routes and
60 additional idle/expansion/circular-trade policies. Measured 1× completion ranges:
economy 10.83–14.23h, dominion 11.27–15.50h, politics 13.37–20.90h. The 12× equivalents
are one twelfth of these values and exclude human decisions and pauses. No claim
of a measured 10–20h human playtest is made. One political outlier exceeds the target
by 0.9h. No-route investment policies could not substitute stockpiles for progression.
