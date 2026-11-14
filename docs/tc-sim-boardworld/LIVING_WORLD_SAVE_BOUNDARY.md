# Living-world save compatibility boundary

The state remains schema 7. Authentic v7 saves without `expansion.districts` or
`expansion.underworld` retain their exact original dictionary envelope and load
without initializing either domain. Gold v6 storage and concurrency are unchanged.

Once either optional domain is materialized by gameplay, export uses
`tc-sim-boardworld-living-dictionary-1`. This is a reader capability boundary using
the existing bounded dictionary codec, checksum and state validation. Released
readers reject the new format instead of advancing time while ignoring new domains.
New readers reject living domains disguised inside the old envelope.

Canonical browser slots become `tariklab.boardworld.v7.living` and `.living.backup`.
They remain inside the existing IndexedDB head, Web Lock and global generation
transaction. Promotion atomically writes the new pair, retaining the legacy v7
pair. No new database, localStorage mirror, independent clock or save authority is
introduced. New clients always prefer the new pair when either slot exists,
including empty/corrupt slots; they never silently resume an older legacy branch.
An explicit older-file import remains in the selected canonical branch.

A completely cached old client can continue its legacy branch. Its transaction
preserves unknown head slots, so it cannot replace the canonical living world.
Its global generation increment still invalidates a new client's stale token;
reloading selects the same living world. CAS also compares the selected slot key.

Verification includes focused promotion/conflict/rollback tests, authentic
released v6/v7 fixture byte preservation and a two-page browser negative control
using the actual released `7ded3aa8` packed runtime with real IndexedDB/Web Locks.
The negative control intentionally injects an unknown domain to isolate the
protocol; it is not evidence for a gameplay journey. Integrated gameplay, reload
and replay are verified separately after domain integration.

The integrated runtime also passes that browser isolation sequence with domains
created by real game actions (no diagnostic namespace injection). The source
regression test exercises the actual day hook, new envelope, round-trip equality,
downgrade rejection and corrupt canonical-slot precedence. Ordinary-life,
succession and intercity journeys additionally exercise genuine domain data over
1,351 game days with periodic deterministic reload/replay.
