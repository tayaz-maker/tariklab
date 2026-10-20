# JITEM release checkpoint — 20 October 2026

JITEM #26 and TarikLab #205 are squash merged. Do not reapply or merge them again.

| Repository | Canonical main | Reviewed/tested head | Gate |
|---|---|---|---|
| jitem-derin-ag | `37c5416e7a49b2ecc998f0d1071a7484d6e508c0` | `2657665d6a5574ffb6ae106bb5db054e6453fa05` | 288/288, lint/typecheck/build; 7 atlas + 8 product + 12 support Chromium PASS, run 39414832356 |
| tariklab | `cfa6d8c25652b33093ecc8734e6e8ae262d98dfe` | `418b859abc4ddfaf57224b1a1079f33c4e7ba833` | All current-head checks PASS before merge, run 39415805136; 2245 tests pass, zero failures, one pre-existing skipped test |

Candidate and canonical trees are identical for each release. Only JITEM generated runtime.js changed; SOURCE.json receipt, integration pin and docs accompany it. No game UI, source catalogue, schema/key, archive removal or foreign-system transplant.

## Production acceptance

- www Vercel deployment `dpl_CdXxz9U5oMd9aX1Ap8gzTKXgGvaH`: READY, production, canonical SHA and www alias confirmed through Vercel API.
- www full manifest: 31/31 SHA-256 matches. Runtime: `cab531fa229d9050171a7f8e3fda9034a0b9b3a089bbb63903d7cea97d1a6453`.
- www real Chromium: 12 relationship-memory + 12 stale/valid support + 8 product = 32 PASS, run 39416117487 attempt 2, artifact 12261129789. Capacity/source-exact resource/next-period/reload: 4 PASS, run 39418135120, artifact 12262920538. TR/EN, phone/desktop. Screenshots visually reviewed.
- Workers main build PASS: `c30aa7b5-d59f-4689-94f9-98c9d6bf0dba`. Real Workers origin source/runtime/CSS available at 200 from GitHub runner. index.html is a same-origin 307 alias to `/games/jitem-derin-ag/`; canonical directory HTML hash matches. 12 memory + 12 support + 8 product = 32 Chromium PASS, run 39418137917, artifact 12263265195. Direct HTTP static requests from the local work environment still return 403; that observation is distinct from verified runner/browser game regression. No protection changed.
- Shared memory-proof artifact footer has stale www/Workers wording; the origin field, Workers workflow destinations and actual 32 result rows establish executed Workers scope. Final evidence JSON records this explicitly.
- Physical device acceptance remains with the user.

Full manifest and live hash rows: `JITEM_RELEASE_MANIFEST_2026-10-20.json`, `JITEM_RELEASE_EVIDENCE_2026-10-20.json`.

## Main CI and next action

Post-merge main CI 39417501337 was still in progress at the latest record; do not describe it as PASS. It is a new run on an identical reviewed tree and includes main-only production checks. No further merge was made while pending. Recheck its final result when continuing; investigate any real failure without weakening tests.

Independent inventory/plan remains on `prep/archive-inventory-20261020`, now reconciled with this canonical main. Kiyi Esigi and IHTILAL remain live, including Resources links. Racon mechanics/files inventoried. No retirement ref, removal, transfer or save reset was performed. Open pre-existing development PRs remain #131 and #112; the limit of three was preserved.

Astra's new handoff has not been received/accepted in this execution. Existing old transfer-gate docs are not that approval. Next implementation gate: accept the handoff against the canonical SHAs, specify exact nonoverlapping files and behavioural acceptance, then start a separate scoped change. Do not touch Astra branches. Physical acceptance belongs to the user.
