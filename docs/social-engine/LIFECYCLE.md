# Schema 4 lifecycle contract and verification

This module is part of the shared deterministic world. `simulation/life.ts` and `simulation/family.ts` have no
renderer, browser-storage, wall-clock or LLM dependency. All money changes use the
existing double-entry transfer ledger. The central command processor provides
persisted command identity deduplication, and the fixed minute boundary calls
`lifeMinute`. It is a release candidate, not evidence of production publication.

## Housing and property

Each of 276 starting households has one primary home, an occupancy record, a
capacity of four, an active lease and a separately identified zero-balance budget.
There are twelve real vacant registry entries: four two-person apartments, two
more affordable four-person apartments, and six larger-price alternatives. These
units share the game's Yuva interior representation; this is not a claim of 288
separately rendered apartment floorplans.

A three-hour reservation protects the destination before moving. Capacity,
occupancy, reservation ownership and available deposit money are checked again
at the move. The former residence is released only after the new residence is
assigned. Deposits are held in backed escrow accounts and refunded to their
original payer. A failed move preserves the old residence. Actual world location
does not teleport when a home address changes.

Weekly rent uses the household's contributed funds first and then its payer's
personal balance. Unpaid amounts remain lease-specific arrears, including after
a move or property purchase. The creditor is fixed in the lease, so buying the
title cannot erase old rent or redirect historical debt. Explicit repayments use
the same ledger. Deeds and person ownership backreferences are reciprocal.
Contributions are tracked per person; shared rent consumes them proportionally,
with deterministic integer remainder allocation. Withdrawal is limited to the
person's unused contribution.

A distressed NPC household can move only to an actual affordable vacancy with
adequate capacity and funded deposit. Monthly food-price changes adjust only
vacant, unreserved asking rents, at most two percent per review. Signed leases
are unchanged. There is no eviction, homelessness, mortgage or subletting feature.
Estate settlement is described below; it does not bypass existing lease creditors.

## Adult family decisions

Fresh worlds initialize a deterministic subset of existing NPC households as
adult families with reciprocal marriage-consent records and age-valid parentage.
Other households are shared homes. Migrations do not invent unknown family
history. Ancestry is acyclic, with no more than two parents and at least an
18-year age difference; close family relationships are excluded from romance.

Player dating and marriage need a nearby adult, the NPC's own relationship state,
no existing active partnership, sufficient trust/affection, and low fear and
resentment. Both directions of consent are persisted. Marriage checks home
capacity and moves the partner's membership and their funded budget share.
Separation revokes consent and returns to the prior household when capacity
allows. If no prior residence is available, the romantic bond still ends and
unused partner contributions return to the personal account; temporary shared
housing is represented honestly.

## Children, guardians and estates

LifeV2 retains the original 1,100 people, including exactly 100 local records.
Deaths preserve stable-ID tombstones rather than deleting references. At most
24 additional background children can be born; this is a bounded first-release
population model, not unrestricted demographic growth. Birth requires living
adult married parents aged 18–55, current reciprocal parenthood consent, a shared
household with a real free home-capacity slot and no birth for either parent in
the past year. Newborn accounts open at zero. Ancestry and guardian references
remain validated. Children have school/care routines and cannot work adult jobs,
commit adult crimes or enter romance. Daily care transfers actual food costs from
a funded guardian or municipal account and consumes available market stock.

A guardian must be a living adult or the municipal care institution. Every living
minor retains at least one valid guardian; deaths reassign orphaned care to the
municipality when no surviving guardian is available. Guardianship does not
silently teleport the child or overfill the guardian's home. Player requests use
explicit commands and meaningful eligibility; ambient births occur no more than
once per month among eligible consenting NPC couples. Ages advance from the
simulation calendar and children age by elapsed birth date. Natural elder deaths
are deterministic and limited to one per day; player death is not implemented.

Death ends adult work/driver roles, cancels active enrollment, widows partnerships
and revokes consent. Actor/target-dependent offered or active missions are closed,
funded escrow is refunded and related parcels are returned. Social membership and
leadership reconcile without deleting historical witness or memory IDs. Household
budget shares and eligible deposits move into a separately identified estate.
Contractual rent arrears and bank debt are paid before heirs. Collectible assets
block inheritance until a real funded buyer purchases them. If no assets remain,
unfunded debt closes as an explicit noncash creditor write-off; it cannot mint
money or become cash inheritance. Surviving adult executors hold property titles
while settlement is pending, including if an executor later dies. Residual cash
is split deterministically; a child's property is held by a guardian/executor with
its beneficiary recorded. Public custody handles estates without living heirs.
Every financial transfer uses the same double-entry ledger.

Autonomous new NPC marriages and NPC course enrollment remain absent. No claim
of arbitrary family-law coverage, player death, unlimited births or unrestricted
multi-generation growth is made.

## Education and recovery

Three courses are available at Ufuk Akademi: office skills (50 TL), pedagogy
(90 TL, academic skill at least 15) and technical craft (70 TL). Each requires
three distinct attended sessions of 30 game minutes. Enrollment transfers the
fee to the school business. The player must remain inside the school; leaving
records a missed session. Work, driving, informal practice and simultaneous
classes conflict. Three completed sessions create exactly one certificate.
Office and teaching job applications require their relevant certificates;
existing employment is grandfathered. Cancellation cannot manufacture a
certificate and does not refund a disclosed enrollment fee.

Recovery support at the clinic or solidarity center transfers 120 TL from the
finite municipality account. Eligibility requires a balance below 50 TL and
unemployment, health difficulty or rent arrears, with a three-day cooldown. It
cannot mint currency or silently cancel debt.

## Persistence and evidence

World schema5 contains LifeState version2. Frozen internal v1 and authentic v2/v3/v4
fixtures are retained byte-for-byte. Migration adds only missing typed state and
zero-opening accounts, preserves identities, family history, money and existing
missions, and runs full invariants. See
`docs/social-engine/RECORDS_AND_JOURNAL.md` for the current normalized record schema,
bounded durable command tail and explicit durability limits.

Historical schema4 module evidence (the same lifecycle suites are included in the current source-bound acceptance-unit.json run):

- 33 lifecycle/family tests pass: housing capacity, reservations, deposits, deeds,
  immutable creditor, shared funds, NPC moves, mutual adult consent, real course
  attendance, funded aid, birth eligibility, guardian reassignment, debt-first
  estates, executor death, target-dependent mission cancellation, invalid-state
  rejection, reload idempotence and deterministic daily demographic events.
- The daily demographic year test is not a replacement for the full fixed-tick
  365-day integrated soak; that gate is reported separately by the core runner.
- Schema4 codec/journal and real IndexedDB checks include actual v1/v2/v3 fixture
  migration, exact command replay, competing tabs, quota, aborted writes,
  corruption recovery and real tab closure. Their current counts and bundle hash
  are in `artifacts/social-engine/persistence-browser/results.json`.
- `artifacts/social-engine/baseline/life-v4-final.tap` records the final 33-test
  lifecycle run. Schema3 browser evidence is preserved under
  `artifacts/social-engine/schema3-checkpoint/` and is historical, not evidence of
  final schema4 UI behavior. Current family DOM testing is a separate QA runner.

These are candidate-source results. They do not assert a release commit, live
production verification, complete acceptance matrix or low-end hardware target.
