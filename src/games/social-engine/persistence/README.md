# SOCIAL ENGINE persistence contract

`SaveRepository` is the only IndexedDB writer. It uses database
`tariklab-social-engine`, database version 2, and world/envelope schema 4. These
are independent version axes. The version-1 database upgrade only adds stores;
it does not rewrite existing save bytes. No legacy game storage namespace is
read, migrated, cleared or written by this module.

## Snapshots and slots

Slots are `slot-1`, `slot-2`, `slot-3`, and `auto`. Saves capture a structured clone
when requested, validate the full world, serialize canonically and hash the UTF-8
payload with SHA-256. Crypto finishes before a transaction opens. One transaction
publishes the snapshot and slot pointer, retains the prior verified revision and
records migration or quarantine data. Local writes serialize; observed revision
and journal heads are compared again inside the transaction to reject stale tabs.
Manual slots always load their exact snapshot without advancing game time.

A corrupt current revision recovers the verified previous revision and preserves
its damaged source in quarantine. A future schema rejects loading, including when
a prior revision is valid. If both copies are invalid, loading fails explicitly.
Invalid imports cannot replace valid saves. Quota and transaction failures do not
advance the committed pointer. `lastRecovery` describes the actual recovery;
`lastJournalHandle` describes the last observed durable autosave tail.

Copy/export from auto includes its verified command tail. Intentional import/copy
into auto compares the observed journal head, materializes the prior replayed world
as the rollback revision, replaces the snapshot and clears its tail atomically.
The original tail is also retained in bounded quarantine. The UI must stop/drain
its live coordinator before intentional replacement. A stale observed tail rejects
the operation. Delete checks the observed revision and journal head and removes
only the selected slot; deleting auto also removes its own tail.

## Schema migration

The frozen v1 format is the first internal compatibility fixture, not a previously
released production format. v1→v2 reconstructs opening balances by reversing the
matched ledger and adds empty notices. The authentic frozen v2 predates lifecycle
state; v2→v3 adds housing, leases and zero-opening household/deposit accounts and
reconciles title backreferences from authoritative ownership IDs. It invents no
unknown family history. The authentic frozen v3 retains its known relationships.
v3→v4 initializes LifeV2, mobility, social/justice, progression, economy and mission
reservation state without fabricating past commands, events, sales or attendance.
Only absent zero-opening financial accounts are added. Full invariants run after
migration. Source envelopes remain byte-identical in `migrationJournal`, with
explicit chains [1,2,3,4], [2,3,4] or [3,4] and stable retry keys.

## Bounded durable command replay

Only auto uses the separate `commandJournal` and `journalMeta` stores. Each session
has an epoch and monotonically increasing operation cursor outside WorldState.
The shared worker/main-thread runtime emits exact authoritative operations:
`TICK` with consumed commands and resulting tick, `APPLY_WHILE_PAUSED`, and
`PAUSE_CONTROL` with the actual movement/throttle reset. Valid retirement ticks
may keep the previous clock value; replay verifies the resulting clock exactly.

A baseline hash binds the snapshot revision, payload checksum, epoch, cursor and
tick. Each canonical batch hash binds its payload, prior hash and sequence range.
Appending a batch and advancing the durable cursor is one transaction. Repeating
an acknowledged identical batch is idempotent; a different batch at the same
cursor conflicts. Begin/checkpoint compare both revision and full tail identity.
A checkpoint publishes a new baseline and prunes the covered tail atomically.
The caller may discard queued operations only when its checkpoint cursor covers
them and must rebase later batches onto the returned handle.

Replay is pure and bounded: at most 600 operations, 2 MiB of journal payload,
128 operations or 64 KiB in one batch, and 200 commands in one operation. A damaged
suffix is quarantined and only a checksum-, sequence- and invariant-valid prefix
is replayed. Incompatible tails after baseline corruption/migration are preserved
in quarantine and not applied to a different world. Quarantine retains eight
entries; migration history retains sixteen. These are deliberate storage bounds,
not a promise of an unlimited archival event log.

Runtime batches flush at ten operations or one second and at pause/snapshot
boundaries. Only successful IndexedDB transaction completion is acknowledged as
durable. Up to one second of unacknowledged operations can be lost on abrupt
termination; browser/storage failure can extend that window and must be disclosed
by the live coordinator. Plain `save('auto')` rejects when a journal is active:
use `checkpointJournal(handle,state,point)`. There is no offline catch-up.

Public journal API:

```ts
inspectJournal(): Promise<JournalHandle | null>
beginJournal('auto', state, point, expected): Promise<JournalHandle>
appendJournal(handle, batch): Promise<JournalHandle>
checkpointJournal(handle, state, point): Promise<JournalHandle>
```

## Reproducible verification

```sh
node --experimental-strip-types --test src/games/social-engine/tests/persistence.test.ts src/games/social-engine/tests/persistence-journal.test.ts
node scripts/social-engine/persistence-browser.mjs
```

The browser runner uses its own ephemeral loopback server and isolated Playwright
context, never the user's browser profile or a production origin. Fault injection
is test-only and not imported by the application. Current candidate evidence is
under `artifacts/social-engine/persistence-browser/`; results name the bundle hash
and distinguish the base Git commit from uncommitted candidate source. Root UI
journal integration and final published-build evidence are separate gates.

## Candidate 6 / schema 7 compatibility boundary

The save database remains `tariklab-social-engine`; version 3 closes predecessor connections
and prevents candidate 5 (database version 2) from reopening and mutating upgraded slots.
Existing stores and slot IDs are retained. Schema 7 / rules 7 identifies the changed traffic rules.

`historical/candidate5` contains byte-for-byte TypeScript sources from the real `f14e13f`
release, with its complete deterministic dependencies and SHA-256 manifest. These are immutable
compatibility code, not a second evolving simulation. `v6-auto-with-tail.json.gz` was produced
using that runtime, including 40 tick operations, MOVE and a paused SET_TIME_SPEED command.
Regenerate explicitly with `node --experimental-strip-types scripts/social-engine/generate-schema6-fixture.ts`;
normal tests never regenerate historical evidence.

On schema 6 autosave load, verify the original envelope and journal hash chain, replay on the
original schema 6 world using the frozen engine, verify invariants and final tick, then migrate
and atomically promote the result. Migration provenance retains the original envelope, meta,
and complete stored tail. The original revision remains the previous revision. Incompatible
schema 6 history fails without modifying slots, journals, quarantine, or migration provenance;
it is never silently replayed with new traffic rules or repaired to a shorter divergent history.

If the newly migrated baseline later corrupts while the predecessor is still its rollback
revision, recovery replays that predecessor's archived journal. The replay must match the
original migration's target snapshot SHA-256 before promotion. Missing, corrupt, or truncated
archives fail without writing any record; recovery cannot silently drop an acknowledged tail.
