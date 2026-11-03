# Boardworld 7.0 concurrent save protocol

Scope: PR #254's `27f2e01370e5854ba436633c7ab9d9ac8b15a4ba`, on independent
`fix/boardworld-7-concurrent-save`, targeting `feature/boardworld-7-gold`.
This is a save-safety fix, not Gold release acceptance or production deployment.

## Reproduced cause

The old callback did re-read `localStorage` after acquiring the exclusive Web
Lock. That read was not necessarily a fresh persistent snapshot. Real independent
Chrome pages, with storage events suppressed and two verified pending writers
behind a third client's held lock, observed stale primary **and** backup bytes.
The second writer acquired only after the first had written, verified its own
write and released the lock, yet its comparisons still passed. A renderer's own
read-after-write check also passed; it did not establish cross-renderer freshness.

The original in-memory unit storage shared one Map between callbacks, so it
could not model this visibility failure. A passing individual browser run did not
establish the guarantee either.

Raw pre-fix traces in `recovery/concurrent-save/`:

| Reproduction | Passing races before failure | Failure |
| --- | ---: | --- |
| `baseline-natural.json` | 20 | Same action, two `ok: true` results |
| `baseline-equal-slots.json` | 2 | Same action after legitimate repeated manual save, two successes |
| `baseline-distinct.json` | 3 | `event:welcome:work` and `event:welcome:learn` both succeed; only the second survives |

Distinct-action failure: first writer acquired at `1793728834392.4`, wrote primary
checksum `a1f9c5d5`, and released at `1793728834395.7`. The second acquired at
`1793728834395.9` but read old checksum `d99f0da9`, wrote `4a462e1c`, and also
returned success. The final primary is `4a462e1c`; the backup is the common starting
state, not the lost first move. These checksums are compact trace labels; tests
compare complete tokens/states, including history and RNG, not checksum equality.

Byte-only tokens additionally cannot detect a successful no-op write when both
rolling slots were already identical. The new tests cover this explicitly.

The [Web Storage specification](https://html.spec.whatwg.org/multipage/webstorage.html)
does not supply a cross-agent-cluster locking contract. The
[Web Locks specification](https://www.w3.org/TR/web-locks/) orders participating
callbacks; it does not define a localStorage cache-flush barrier. This diagnosis
is based on the observed callback/read/write ordering, not an assumed browser
implementation detail.

## Product protocol

Every UI writer and migration load still takes the same origin-wide Web Lock.
Inside it, `browserTransaction` uses IndexedDB database
`tariklab.boardworld.v6.transactions`, version 1:

- `state/head` holds the authoritative slot bytes and a monotonic commit generation.
- `seen` holds SHA-256 identities of past canonical envelopes, permitting real
  released6 rollback writes to be recognized without mistaking a delayed, previously
  committed localStorage snapshot for an instruction to restore old progress.
- A readwrite transaction **re-reads the head after lock acquisition**, verifies
  the observed generation, then compares the caller's retained generation and
  exact primary/backup bytes. The generation is independent of simulation revision,
  so new lives, imports, equal-revision forks and identical manual saves remain safe.
- The existing validation, migration, immutable archive and healthy-backup rules
  execute against transaction-local slots. Primary, backup, archives and generation
  publish together. A rejection performs no authoritative write or mirror rotation.
- The commit point is the readwrite transaction's **`complete` event**, not a `put`
  request's success. Aborts, including after a successful `put`, never return
  `ok: true` or a new token. See the
  [IndexedDB atomic commit contract](https://www.w3.org/TR/IndexedDB/#transaction-construct).
- Only after commit are canonical/archive bytes copied to the unchanged v6
  localStorage slots for released6 readers/writers. Copy failure is reported as
  `mirrorFailed`; the authoritative save remains committed and a subsequent load
  repairs the copy. Inaccessible localStorage cannot hide a healthy authoritative save.
- An unknown valid native6 compatibility primary is accepted on a locked load as
  released6 rollback continuation, while a writer with an older token conflicts.
  Corrupt authoritative primaries retain the existing healthy-backup/legacy
  recovery priority rather than entering this rollback-continuation path.

No envelope/schema, simulation, locale index, dependency or unrelated game changes.
Raw IndexedDB is kept in this protocol module to avoid introducing a dependency
outside the requested save-only scope. The optional transaction adapter is for
isolated storage unit tests; the browser/default path has no nontransactional fallback.
The synchronous primitives remain for isolated fixture/compatibility tests and are
not called by the current UI.

UI action completion now includes `ok`, `saved` and `conflict`. A failed save
returns/announces failure, not the resolver's successful persistence result. The
losing move remains in memory and can be exported; it is not silently merged,
retried against a new token, discarded or allowed to overwrite the winner.

Without Web Locks, or if IndexedDB cannot be opened/committed, the UI remains
export-only. Legacy loads do not promote on that fallback path.

## Verification and retained failures

The concurrent browser harness checks two pending requests before release,
unchanged storage while held, independent equal starting tokens/revisions, one
success and one explicit conflict, fresh committed generation at the loser,
commit-before-success ordering, complete winner state, unchanged slots after a
rejected retry, and exportability of the losing move. It exercises same actions,
different actions and no-op manual saves, with both native cache behavior and an
additional deliberately frozen stale-cache control. There are no sleeps or relaxed
winner/conflict assertions. `--baseline` only permits the old protocol's absence
of a generation field when reproducing the red test; it keeps the one-winner assertion.

The transaction browser suite uses authentic v1–v6 fixtures in all three starting
scenarios, concurrent migration loads, and three actual actions/save/reloads through
the exact released6 runtime before returning to Gold. It also tests native aborts
before/after successful puts, compatibility-copy failure/repair, denied storage,
primary/backup/archive recovery and unavailable Web Locks/IndexedDB.

Three early test-harness timeouts are retained as `harness-timeout-*.json`: initial
dynamic module loads in background test pages stalled. Preparation now foregrounds
those pages; the actual competing writes remain concurrent behind the held lock.
`first-recovery-failure.json` retains 23 passing cases followed by an overly broad
rollback-recognition path restoring compatibility bytes instead of the required
healthy authoritative backup. The product path was restricted to healthy native
primaries and the original backup assertion retained.

Verified integration commit: `6c32508902726da2be89e775b789b4c892c1f59e`, tree
`fb524eb6d0ba15092658d3cc4383d42c7d4abb17`. Product code is unchanged from
`71006639cd876fb8c4a1061270d5fe0df8731851`; the second commit only foregrounds
initial public-module loading in the test harness. Final evidence commits change
documentation/reports only. Input identities, raw reports, SHA-256 hashes and
commands are in [verification.json](recovery/concurrent-save/verification.json).

| Final validation | Passed | Failed |
| --- | ---: | ---: |
| Save/migration/codec/packing Node tests | 140 | 0 |
| Natural-cache built browser races | 50 | 0 |
| Frozen-cache built browser races | 20 | 0 |
| Source transaction/migration/rollback/recovery cases | 27 | 0 |
| Built transaction/migration/rollback/recovery cases | 27 | 0 |
| Stale/import/UI/export-only cases | 5 | 0 |
| Real play/save/reload/export/recovery viewports | 3 | 0 |
| Exact released6 rollback fixtures | 9 | 0 |
| **Total automated cases** | **281** | **0** |

All 70 races produce 70 successful writers and 70 explicit rejected writers:
24 same-action, 24 different-action and 22 no-op races. Two pending requests are
verified in every race; no losing request publishes a head. The first distinct
built race starts at generation 6: winner commits generation 7 at
`1793729622890.6`, then reports success at `1793729622891.4`. Loser acquires at
`1793729622892.4`, re-reads generation 7, performs no head put and returns conflict.
The full winning state and unchanged rejected-retry token are asserted.

Build and typecheck pass. Packed gzip is 195,157 initial TR / 301,104 all-language
bytes, within unchanged 205,874 / 301,836 limits. Desktop/mobile captures were
inspected and the UI runners report no console/page exceptions. These are local
validation results; exact PR CI and integrated Gold performance acceptance remain
separate. Historical PR #254 blocker evidence is left intact.

## Remaining boundaries

- Already-open released6, pre-fix Gold or older JavaScript does not participate in the new protocol.
  Export and close/reload those sessions before continuing the same life in Gold.
  Controlled released6 rollback compatibility is covered, not arbitrary concurrent
  writes by old or manually modified clients.
- Restoring an envelope previously committed by Gold is indistinguishable from a
  stale cache; use explicit file import for an intentional restore to such a state.
- The SHA-256 identity ledger grows with distinct committed saves. Quota/transaction
  failure fails closed and leaves the previous commit and exportable state intact.
- A compatibility-copy failure can temporarily leave released6 with an older copy;
  reload in Gold to repair/export before rolling back. The IDB record is authoritative.
- Browser data deletion/eviction and separate origins remain browser-storage limits.
  Automated Chrome coverage is not physical Safari/Firefox acceptance.
- Gold's integrated performance/full-release gates remain separate. No main merge,
  production deployment, Social Engine branch or other-game change is part of this fix.
