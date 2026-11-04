# Private exact meal-membership experiment

Do not deploy this prototype as schema7. The integration owner must establish the schema8/rules boundary,
block old writers, replay and validate genuine old tails under their original rules, then call
`compactMealMemberships(ownedWorld)`. No codec/schema-upgrade hook is installed by this commit.
Frozen predecessor sources and historical fixture bytes remain untouched.

The authentic day180 captured world contains172,176 `meal:queue:<business>:n<NPC>:<tick>` transfer-set keys,
not the later `meal:v5:<business>:<tick>:n<NPC>` spelling. The index keeps these transaction families separate.
Both store exact `(business,tick,npc)` membership as sorted base36 integer pairs in1024-tick buckets.
Unrecognized IDs stay on the original generic exact bitmap path. Existing generic meal flags still reject
repeated transfers before migration; recognised flags convert only after every membership has been checked.

Independent utility gate:185,372 original memberships, no duplicates or missing IDs; reconstructing the
old addressing recovers all original normalised flags and preserves every unrelated flag. Migration is
idempotent. Known meal keys172,176→1,784; total flags177,801→7,409; canonical world12.75→4.35MB.
One-time Node conversion789ms, separate from subsequent save/load timings.

Economic gate:100 real ticks on the genuine captured world caused52 ordinary production food-service
transactions. The baseline and prototype entire worlds matched after independently expanding membership
representation. Validation/reconciliation passed. No accounts, stock, queues, movement, quests or other
state were patched to fabricate economic activity.

Corrected Firefox153 timing gate:20successive changed snapshots per arm, starting at authentic tick2592000;
52 genuine food-service transfers occurred inside that sequence. Every one of60durable loaded snapshots
matched its complete pre-save canonical SHA256; after every tick group the independent inverse prototype
world matched the entire baseline world. New and warm IndexedDB readers alternated, arm order alternated,
and no samples were removed. No unchanged-world or input-world cache is used.

- Baseline:median1515ms,p951679ms,max2497ms.
- Compact runtime index:median605ms,p95692ms,max708ms.
- Compact runtime plus bounded exact prior-envelope receipts:median494ms,p95609ms,max686ms.

The host was shared with coordinator suites/365-day tests. These are matched engineering observations,
not qualified reference-hardware proof or a release-gate PASS. The earlier wire-only experiment halved bytes
but remained above2s; the meaningful gain here comes from removing172k runtime map entries and their
repeated validation/serialisation work. Initial old-save migration overhead is disclosed separately.

Receipt reuse is separately committed. It attests only a successfully committed immutable prior envelope;
every payload/header field must match exactly, otherwise full verification runs. New saves still capture,
validate, encode and checksum the changing input world. Loads always perform full checks, including on the
same repository. Receipts are bounded to4slots/8MiB of transport and cleared on close. Existing single
atomic transaction, head/journal CAS, rollback and archive rules remain intact.

Local evidence files record all individual timings. Unit tests cover canonical boundaries, same-tick NPCs,
family/business/bucket separation, invalid inputs, lossless migration/inverse, duplicate debits and failed
conversion atomicity.32headless Chromium persistence checks (including exhaustive receipt field mutation
fallbacks and full load/new-reader verification) and28membership+persistence unit tests passed; services
suite also passed. Full browser matrices, schema8 archived replay and long-term rules verification remain
integration-owner work.
