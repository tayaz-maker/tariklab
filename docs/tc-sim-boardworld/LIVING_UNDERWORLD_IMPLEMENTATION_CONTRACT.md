# Living Cities and Underworld implementation boundary

This is the current implementation contract, approved by the user's November 14
budget override. Historical recovery documents retain their measurements, but
the active limits are Gold 301836, initial Turkish 205874, expansion 96000 and
combined 400000 gzip bytes, counting every shipped file. Expansion remains
optional and deferred and shares one Gold engine. This contract describes work
in progress, not a delivery claim.

## Ownership and persistence

Astra owns `expansion.mjs`, existing economy/institution adapters, integration
tests and release integration. Sol owns `expansion-underworld.mjs` and its focused
tests. Terra owns `expansion-districts.mjs`, `expansion-living-ui.mjs`,
`expansion-world.mjs`, `expansion-ui.mjs`, app wiring and district/UI tests.
No overlapping source edits without an explicit handoff.

Save version stays 7. `expansion.districts` and `expansion.underworld` are optional
validated namespaces, absent from initial creation and authentic legacy imports.
Views derive their absent defaults without mutation or RNG. Only a successful
cloned action or existing authoritative day tick may materialize them. No new
clock, resolver, save authority, engine instance or global initial import.
Unknown or inconsistent references, over-limit records, negative funds/stock,
dead active actors and invalid timestamps must fail validation.

Once either optional domain exists, persistence uses capability envelope
`tc-sim-boardworld-living-dictionary-1` and canonical slots
`tariklab.boardworld.v7.living` / `.backup` inside the existing transaction head,
Web Lock and generation comparison. The first such save preserves legacy v7
slots as a separate older branch. A new slot's presence takes precedence even
when empty or corrupt, preventing silent fallback to an older world. Old cached
clients reject the new export envelope and preserve unknown new slots; their
global generation advance invalidates a newer client's stale write token. Old
v7 saves without these domains retain their exact initial bytes and slot format.

## Place boundary

The catalog preserves `kadikoy`, `besiktas`, `sisli`, and adds
`ankara:kizilay`, `ankara:cankaya`, `izmir:konak`, `izmir:bornova`.
The first district in each new region is its derived legacy arrival hub. Existing
regional lots retain their IDs and map room/studio/apartment deterministically
to local districts; they remain the sole title/lease authority.

`expansion-districts.mjs` exports:

- `getPlace(s)` -> `{ regionId, districtId, venueId }`; Gold place fields remain
  authoritative only within İstanbul.
- `getDistrictSimulation(s, districtId)` -> bounded public/internal numeric
  `{ demand, rentPressure, foodStock, materialStock, jobOpenings, serviceDelay,
security, influence }`. Demand, rent and job indices have baseline 100;
  food/material stocks are finite counts, service delay is minutes, and
  security/influence are 0–100. The district rent/demand projection includes the
  existing regional index exactly once and applies local and organization deltas.
- `districtActions(s, api)`, `adaptDistrictActions(s, actions, api)`,
  `afterDistrictAction(s, id, before, api, action)`, `tickDistricts(s, api)`,
  `validateDistricts(s)`, `districtView(s)`.
- `localizeDistrictText(text, language)` and a district/venue catalog exposed
  as named exports for stable lookups, with original names and no raw-ID display.

New local actions use `district:*`. They quote and execute the same travel cost,
minutes, opening hours, capacity, player status and calendar constraints. Local
travel records arrival after elapsed time; it must not write foreign district
IDs into Gold `s.location`. Intercity `world:move:*` preserves existing IDs and
clears/changes expansion place only at the shared completion hook. Jobs use real
employer money, contracts and earned advancement. Venues link real housing,
trade, institutional and social actions; labels alone do not count as services.

## Organization and law boundary

`expansion-underworld.mjs` exports:

- `underworldActions(s, api)`, `adaptUnderworldActions(s, actions, api)`,
  `afterUnderworldAction(s, id, before, api, action)`, `tickUnderworld(s, api)`,
  `validateUnderworld(s)`, `underworldView(s)`.
- `nextUnderworldAt(s)` and `reconcileUnderworldTime(s, api)` expose task
  deadlines to the existing engine boundary calculation. Manual actions, care
  and fast-forward settle one expiry at its exact due minute plus one.
- `localizeUnderworldText(text, language)` and
  `underworldDistrictModifiers(s, districtId)` ->
  `{ demand, rentPressure, jobOpenings, serviceDelay, security, influence }`;
  additive deltas default 0, influence 0–100.

New actions use `underworld:*`. The coordinator installs `api.getPlace`,
`api.getDistrictSimulation`, and `api.underworldDistrictModifiers`. Districts may
import the underworld modifier projection; underworld uses only the injected
place/district adapters and never imports districts or the engine. This one-way
dependency avoids an alternate engine and dependency cycles. Economy adapters
may import the district projection and canonical lot mapping.

Organizations have stable named bounded actors, leaders, hierarchy, recruitment,
membership, task/trust/promotion/leadership/exit, finite resources, loyalty,
disputes and relationships. Their deterministic daily decisions run in all three
cities regardless of player location, changing influence and real local terms.
The player can negotiate and retain outstanding obligations after leaving.

Incidents link actual action, actor, place and effective minute. Witnesses need
real co-presence or authentic records; rumor, suspicion and proved findings are
different states. Investigations and legal decisions follow disclosed evidence
thresholds and review dates; weak cases can acquit. One case decision applies
costs/restrictions once. Public projections expose discovered evidence only.
On death, memberships terminate and personal sanctions stay attributed to the
deceased. Estate-payable documented debt may remain; heirs never inherit guilt,
criminal record, trust or rank. Bounded active records are never silently evicted.

## Coordinator order and acceptance

Day hooks retain existing economy/institution/family/region behavior, then run
district and underworld hooks once per day. Death reconciliation runs even when
the player cannot act. Post-action district completion precedes the institution
work consequence so unsuccessful shifts cannot create an illness work penalty;
underworld completion/succession follows. The engine uses the resulting completion
message after elapsed time, including interrupted journeys. New actions cannot finalize
after death. New adapters run after existing regional filtering; allowed new
prefixes must survive that filter. Action previews and public views stay pure.

Focused tests cover real resolver loops, exact legacy initial bytes, validation,
finite funds/stock, duplicate rejection, no dead completion, offscreen autonomy,
evidence visibility, inheritance attribution and save/replay equality. Prepared
rare-branch fixtures are explicitly labeled and never substitute for journeys
A–I. Production packing runs per meaningful integrated batch. One complete final
candidate then gets required CI, one PR/protected merge and the existing
Cloudflare Git deployment; subjective extended acceptance remains with the user.
