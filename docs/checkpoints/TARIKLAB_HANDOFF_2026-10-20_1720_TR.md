# TarikLab checkpoint — 2026-10-20 17:20 Europe/Istanbul

User requested save and report; pause new releases after this checkpoint.

## Canonical release state
- #207 squash merged: 7c0643c65aa376fc292786b0303feb56a8082ec1. Main CI 39430886505 PASS. Archive production QA 39431588007 PASS on www and Workers; each 78 hashes and six browser cases. Source/archive and ten save keys retained. JITEM ADAPT complete; do not repeat.
- #208 save repair squash merged: current canonical main 9c77510add7b9d44b6e628f80f87d60217a097c1. PR checks PASS before merge. Main CI 39435358096 still in progress at checkpoint. Production QA 39435758323 PASS on both origins: eight hashes, 24 gameplay/save/storage-fault cases and 24 portal cases per origin. SON KOY, SON 100 GUN, KAYIP TELEFON, AMIRAL BATTI released.
- #209 decision repair OPEN. Current head ee9297e3cc23bbcaf433d77c1e1cc2848daf46a0. Dedicated acceptance 39437407237 PASS; general CI 39437407260 in progress. Do not merge until all required current-head checks PASS and previous main verification completes. Prior CI failure was an authorized source fingerprint change; expected hash updated, no gate removed or skipped. Local 159 tests, 42 source and 42 built Chromium cases passed.
- #131 reviewed and closed without merge (conflicting older TC SIM UI rewrite). #112 remains frozen, do not merge.

## Prepared branches, not releases
- sol/kiyi-archive-20261020: 70a67b4bcd9249279220537d0da2a31bdc2bf887. Local 59 catalogue tests, 31 focused tests and six coast plus six IHTILAL archive browser cases PASS. Before opening PR, reconcile onto post-Wave1 main, create/read back archive/kiyi-esigi-pre-retirement-20261020, finalize manifest reference/status. Source and recovery records preserved.
- sol/racon-economy-region-20261020: 01164a5c17f7d6d93dc54fad0c43420055bd2deb. A economy/seal preparation. 110 tests; six source and six built region cases; existing 60 source/60 built checks and longrun PASS.
- sol/racon-crew-police-20261020: 0c4679ccfd1224204d8e35f1d9a4ea90af4a5096. B crew/police preparation. 121 tests, 18 source/18 built browser cases, existing 60+60 quality and 47 map checks PASS. Existing v1 save loads pre-repair engine with equivalent serialized progress.
- This checkpoint branch sol/racon-language-longrun-20261020 contains unfinished C rendering-only localization and investor/high-risk longrun policies. Extended longrun completed with determinism PASS. C locale/browser and full regression validation NOT complete; do not release based on this checkpoint. No coefficients/save format changed. No new mechanics or art.

## Archive continuity
Immutable IHTILAL manifest remains unchanged. A separate strict continuity record permits only subsequently edited Racon index.html, retaining original source hash/ref and strict current hash. Preserve this test plus the Kiyi archive changes when reconciling.

## Exact next steps
1. Verify #208 main CI final result and #209 current-head required checks/status. Merge #209 only all PASS, then verify new main and both production origins with real Chromium.
2. Reconcile/finalize Kiyi archive, PR/CI/merge/production acceptance.
3. Integrate Racon A then B then validated C as separate narrow PRs, each with main/production evidence.
4. Reconcile remaining master-roadmap defects against current code; no rewrites of working games. Cards, anatomy and performance optimization deferred.

Vercel API access is 403 in this environment; production evidence above is actual deployed host QA plus GitHub deployment status, not an invented Vercel API READY. Git push lacks credentials; commits/branches written through GitHub connector. Keep max three development PRs. Never merge FAIL/PENDING.
