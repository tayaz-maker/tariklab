# Boardworld 7.0 concurrent save protocol

Scope: PR #254's `27f2e01370e5854ba436633c7ab9d9ac8b15a4ba`, on independent
`fix/boardworld-7-concurrent-save`, targeting `feature/boardworld-7-gold`.
This is a save-safety fix, not Gold release acceptance or production deployment.

**Revision 3 supersedes revisions 1 and 2.** Revision 2 preserved the Gold winner
but still gated every recovery slot on the primary being changed/unseen, so a known
primary could hide a divergent backup. Every compatibility slot is now examined
independently, and real EN/PL manual-save notice/HUD regressions are required.

**Revision 2 superseded the first delivery.** Independent released6 stale-tab review
proved the original `seen`/automatic-rollback inference unsafe. The previous 281
passing cases were incomplete coverage, not evidence that old-tab safety held.
The unchanged independent runner is now a required CI gate; see the revision-2
verification and retained red/green reports below.

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
- `seen/recovery` retains validated divergent copies, deduplicated by exact bytes.
  Every primary, backup and original-archive slot is independently scanned. Neither
  a known primary, identical primary nor corrupt primary can suppress the other
  slots. Previous identity entries remain compatible but are no longer read or
  written; no hash/history classification grants permission or skips preservation.
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
- Once an authoritative head exists, a valid different compatibility primary is
  **never automatically adopted**. Unknown valid primary/backup/archive bytes are
  durably preserved before repairing the compatibility mirror. Loads retain the
  complete Gold winner and its generation. Users can download preserved copies
  from the Save menu and explicitly choose one through the existing file-import
  flow; that import uses the same retained-token CAS and backup rules.
- If a recovery archive cannot commit, a load returns the previously read durable
  state in export-only mode with a null write token. It cannot fall back to the
  foreign localStorage fork. Existing healthy-backup/legacy recovery order remains.

No save envelope/schema, simulation, existing locale index, dependency or unrelated
game changes. Four recovery messages are appended in TR/EN/PL without reordering
existing keys.
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
the exact released6 runtime before returning to Gold, preserving the automatic
Gold winner and then selecting the preserved rollback via an explicit import. It
also tests native aborts
before/after successful puts, compatibility-copy failure/repair, denied storage,
primary/backup/archive recovery and unavailable Web Locks/IndexedDB.

Three early test-harness timeouts are retained as `harness-timeout-*.json`: initial
dynamic module loads in background test pages stalled. Preparation now foregrounds
those pages; the actual competing writes remain concurrent behind the held lock.
`first-recovery-failure.json` retains 23 passing cases followed by an overly broad
rollback-recognition path restoring compatibility bytes instead of the required
healthy authoritative backup. The product path was restricted to healthy native
primaries and the original backup assertion retained.

### Historical first delivery (superseded)

The counts and commit below precede the independent stale-released6 failure and
are retained as historical measurements. They do not establish current acceptance.

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

## Released6 regression and revision-2 correction

The unchanged independent `scripts/boardworld-legacy-tab-browser.mjs` is copied
from Gold commit `117854655fc08f70ff7e0b49f59abc3d787d7b56`, SHA-256
`9ecb44de1bd68a876b747dab73740fadb9ebd0fdcee5d7e5d53384bfccea5f0d`.
It loads the entire exact released6 module graph and retains `v6-fresh-newcomer`
in an old tab. Gold saves `event:welcome:work`; the old tab then really saves
`event:welcome:learn`. A genuinely fresh Gold tab must return the complete Gold
winner while the old fork stays exactly exportable. There is no IDB-layout
assertion or substituted current writer in that runner.

The first product (`71006639`, identical product bytes at `5a0721dc`) fails this
test: a previously unseen stale fork is still a valid v6 envelope, and every load
passed `acceptExternal=true`. Removing that inference is the product correction.
A warning to close old tabs was not an acceptable substitute for winner safety.

Revision 2 keeps the durable head, preserves foreign copies and provides an explicit
menu download/file import path. All 18 migration/rollback fixtures additionally
assert unchanged automatic state and generation before the explicit import. The
new UI case verifies recovery-write quota abort, persistence across reload, exact
download, no adoption on download, real file selection/import/reload, and the
previous Gold winner retained as backup. Existing same-revision writer tests,
abort assertions and backup-recovery expectations are retained.

The shallow-checkout CI now fetches the immutable released6 SHA before either
archive-based runner, and runs the independent stale-tab gate in addition to all
previous transaction/race gates. No integration or production action is performed.

### Historical revision-2 delivery (superseded)

The following 292 cases missed the known-primary/divergent-backup sequence and the
real manual-save combined-notice translation. They are retained as historical
coverage, not final safety acceptance.

Tested product/harness commit: `ec9fa4a3fec3b920e391eb5c41edb283a94a4c61`, tree
`2ed766e6f52a4ccb9920b52cddc3a3b0fc8afe3d`. Subsequent delivery commits contain
only documentation/raw evidence. [Revision-2 manifest](recovery/concurrent-save/revision2/verification.json)
records commands, source/built hashes and the exact input identity.

| Revision-2 local validation | Passed | Failed |
| --- | ---: | ---: |
| Save/migration/codec/packing/i18n Node tests | 147 | 0 |
| Native/frozen-cache built browser races | 50 + 20 | 0 |
| Source/built transaction and explicit recovery cases | 28 + 28 | 0 |
| Stale/import/export-only UI | 5 | 0 |
| Responsive play/save/reload/recovery viewports | 3 | 0 |
| Exact released6 rollback fixtures | 9 | 0 |
| Unchanged independent released6 source/built regression | 1 + 1 | 0 |
| **Total automated cases** | **292** | **0** |

Build/typecheck pass, zero skipped cases. Gzip remains within unchanged budgets:
195,540 initial TR / 301,669 all-language bytes, limits 205,874 / 301,836.
The recovery menu was visually inspected at 1280 and 390 px; both dialog and page
have zero horizontal overflow. The UI case also checks the exact recovered file,
explicit import/reload and original winner as the rolling backup.

The independent red/green reports use the same unchanged runner and exact released6
graph. Before the correction, returned state matched the stale fork. Afterward,
both source and production-built return SHA-256
`68796095b0ad8db3402a60fa6d0f6985f82ecfcfdc0dac2f62899238e027204d`, the complete
Gold winner. The divergent old fork
`63fae65c685e928a928e50dc6300023d3fbafce3e290244cce02ca5bba4b3be0` remains
exactly exportable. The independent runner asserts public state behavior and is
not coupled to the IndexedDB record layout.

All 70 queued current-client races still produce one success and one explicit
conflict. The added foreign-copy preservation never grants overwrite permission,
changes the durable head on load, or bypasses token checking during explicit import.
No merge, production deployment, other-game or Social Engine work occurred.
Integrated Gold performance/full acceptance and PR CI are the integration owner's
remaining gates, not claims made by this local save-only verification.

## Revision-3 independent-slot preservation

A real released6 writer can save divergent B, then re-save previously committed A.
Immediately before Gold reload, B is the valid localStorage backup. Revision 2
skipped its entire capture loop because primary A was known. Mirror repair then
erased B even though the Gold winner itself was preserved. The independently
reported sequence is reproduced by `boardworld-legacy-slot-browser.mjs` against
frozen `ec9fa4a3` without substituting the old writer.

Revision 3 removes the primary/history gate completely. Every valid divergent
primary, backup and original copy is captured independently before mirror repair.
Exact-byte deduplication avoids duplicate downloads; current canonical bytes and
immutable originals retain their established rules. The unused hash classification
and new identity writes are removed; the existing IndexedDB schema stays compatible.
No automatic adoption or CAS bypass is added.

The new gate covers known, identical and corrupt primaries, a different valid
original archive with the same primary, and actual EN/PL manual-save toast/HUD.
Two real old writes place B in the backup before each relevant check; tests then
assert complete Gold winner, exact preserved copy, immutable original, unchanged
load generation and stable recovery on reload. Both language cases also discover
a new old-client backup during a real UI manual save and retain that exact copy.

The combined success+recovery message previously leaked Turkish in EN/PL because
sentence splitting lost the full two-sentence warning key. A combined message key
is appended at the end of all three catalogs; existing keys/indices remain intact.
No generic translation behavior or existing notice is weakened.

The retained pre-fix report and final source/built measurements are recorded in
`recovery/concurrent-save/revision3/verification.json`. This revision remains for
independent integration review; local save verification does not accept Gold or
authorize merge/deploy.

## Remaining boundaries

- Old released6/pre-fix code can still write its localStorage compatibility slot.
  It cannot replace the authoritative Gold head. Divergent validated copies are
  preserved for explicit recovery/import, including after a fresh Gold reload.
- Intentional rollback continuation now requires explicit file selection/import;
  an unmarked legacy save cannot prove user intent. All original envelopes,
  exports, immutable archives and released6 reader/writer compatibility remain.
- The recovery-copy store grows with distinct forks; no new identity ledger entries are written. Quota or
  transaction failures fail closed; the last commit and exportable data remain.
- A compatibility-copy failure can temporarily leave released6 with an older copy;
  Gold repairs the mirror after preserving foreign bytes. The IDB head is authoritative.
- Browser data deletion/eviction and separate origins remain browser-storage limits.
  Automated Chrome coverage is not physical Safari/Firefox acceptance.
- Gold's integrated performance/full-release gates remain separate. No main merge,
  production deployment, Social Engine branch or other-game change is part of this fix.
