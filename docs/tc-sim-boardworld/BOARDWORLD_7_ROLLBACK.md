# Boardworld 7.0 safe rollback

Status: **Integrated-fix compatibility and full acceptance PENDING; production rollback NOT RUN.** Historical candidate12b519c evidence is retained below and does not certify the new protocol or integration. This procedure is not a deployment or owner approval. A failed Gold gate prevents release. For a critical regression discovered after deployment, stop promotion and use the existing Cloudflare production service.

## Known recovery baseline

The verified 6.0 release is PR [#253](https://github.com/tayaz-maker/tariklab/pull/253), merge `d695119186cad42c079a911a60c372f201b3b64b`, tree `2350d4eb908d260fee1919e97ec27278c30bafb1`. Its recorded production Worker version is `6b776d41-937a-4ff7-ad84-dc611c676006` (build `630f71aa-f039-4cd3-b878-995a65dc8259`). These identifiers come from the verified 6.0 evidence and must be rechecked against Cloudflare before an incident action; they are not new 7.0 production verification.

Use the existing `tariklab` service at [Cloudflare production deployments](https://dash.cloudflare.com/1c23838a8ed57b3cabd47e117b6ebb62/workers/services/view/tariklab/production/deployments). Do not create another Worker, deploy hook or hosting project. The normal publication path remains the existing Git integration with `scripts/cloudflare-deploy.mjs` exact-main and successful-push-CI guards.

## Preserve player data first

7.0 retains schema 6 and the canonical keys `tariklab.boardworld.v6` and `tariklab.boardworld.v6.backup`. Keep every legacy primary/backup and immutable `tariklab.boardworld.vN.original-vN` archive (N=1–5), and the original TC SIM key `tariklab::tc-sim:1`. Also preserve the complete Gold IndexedDB database: its authoritative head, generation, save slots and quarantined recovery copies. Compatibility localStorage is not a substitute for that durable head. Never clear site storage or IndexedDB, delete recovery copies, rename slots, write a down-migrated state, replace archives or run a reset script as part of rollback.

Where the running client is usable, export the current life and download every relevant preserved recovery copy before reload; keep their bytes unchanged. An application rollback does not repair a damaged player save: retain the affected bytes and recover from a validated backup/import with an explicit notice. A browser reload can discard unsaved in-memory progress, so export that progress before asking a player to reload. Do not fall back silently to a new life.

Before release, test an isolated origin/context using copies: save a progressed Gold native-v6 life; preserve its export, all localStorage slots and Gold IndexedDB/quarantine; run the exact released6 reader against the compatibility copy; assert full-state equality, valid checksum/schema and unchanged original archives; exercise one valid action, save and reload. On returning to Gold, verify its authoritative winner remains unchanged and the divergent released6 continuation is preserved for recovery. Download that exact copy without changing the winner, then explicitly import the selected file; verify the continuation survives reload and the replaced Gold winner remains the backup. Repeat with a pending event and a migrated legacy life. Record exact commit/tree and results. Gold never automatically adopts a foreign old6 continuation over an existing durable head; a matching schema number alone is insufficient compatibility evidence.

## Production recovery

1. Record failing URL, deployed commit/version, console/network symptoms and a non-sensitive reproduction. Preserve the Gold asset manifest and deployment logs. Do not publish private player exports.
2. Reconfirm that the recorded 6.0 version is the known healthy version and that no binding/configuration change makes it incompatible. Select Cloudflare's existing-service rollback to that version if available. Confirm the target identity before applying it; do not guess a version or bypass a failed approval/protection.
3. Verify Ready and 100% production traffic on the intended version. Check both `https://www.tariklab.com/oyna/tc-sim-boardworld` and `https://tariklab.tayaz29.workers.dev/oyna/tc-sim-boardworld`, including actual game assets and expected baseline hashes, not just HTTP 200.
4. In isolated browser storage, verify native-v6 load/export/import/reload, exact legacy originals, stale-tab handling, pending-event resume and the original TC SIM route/save. Check TR/EN/PL and 320/390/1440 layouts. Record all outcomes and any rollback limitations.
5. Align Git with the recovery through a reviewed revert/fix PR and normal required CI. The deployment guard deliberately rejects publishing an arbitrary historical checkout; do not alter the guard or force-push main. If direct existing-version rollback is unavailable, use the normal revert PR/main-CI/Git integration route. Avoid unrelated commits that would immediately republish the defective release.
6. Record the incident version, rollback version/time, production asset checks, save compatibility results and unresolved defects. Reopen Gold acceptance; do not report Gold delivered while the release remains rolled back.

The 5.0 Worker is not the default rollback target: it does not read canonical v6 slots and could make current progress appear absent. Protecting the v6 bytes while presenting a legacy life is not successful recovery.

## Integrated protocol and pending checks

The candidate uses an authoritative IndexedDB head/generation committed atomically, with Web Locks ordering current-client operations. Before compatibility-mirror repair it independently preserves every valid divergent primary, backup and original slot. A known primary cannot suppress a foreign backup. Old6 continuations require explicit recovery-file import; load, mirror repair or downloading a copy must never silently select them. Aborted protected transactions must not report save success; unavailable protection remains validated load/export-only. Fresh integrated source/built rollback, race, recovery UI, complete regression and full-action timing gates remain pending.

The known6.0 rollback client predates this protocol. Exporting current progress and reloading/closing other old tabs remains useful safety advice, not a waiver of Gold's required coexistence tests. Two old6 writers can still collide with each other; Gold cannot recover bytes overwritten before it observed them. A rollback must retain Gold IndexedDB and quarantined copies for a later return. Legacy v1–v5 writers retain isolated keys. Do not claim that the rollback baseline has zero defects.

## Historical compatibility evidence — not integrated acceptance

On source `12b519c58b61e9de5074de5849e8a8c857f26646`, nine authentic fixtures (six native6 plus three legacy5 cases) passed Gold action → released6 import → valid released6 action/save/reload → Gold read with full-state equality and original/TC bytes preserved. A pending welcome event survived rollback before its released6 resolution. See `recovery/rollback.json`. That historical automatic-read behavior is superseded by the durable-head and explicit-import procedure above; it is not proof of current integrated compatibility. No production rollback was executed.
