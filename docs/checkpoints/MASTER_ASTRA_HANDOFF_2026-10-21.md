# TarikLab — Astra continuation checkpoint — 2026-10-21

User requested SAVE, merge only what is safe, and report now. Stop new development and waiting loops. All mandatory exact-head CI/TC and exact-main release guards remain binding. Do not turn local or pending results into production PASS. Never touch Vercel, restore DARBE-H!/Anatomy Atlas, generate card art, change user saves or rewrite Git history. Maximum three active development PRs.

## Canonical main and production

- Main: `007ce1e310e6ce8feee49154fae18769d03928b6` (Racon C PR #213 merged).
- Exact-main push CI `39498157187` and TC `39498157142` PASS; Workers Build PASS.
- Cloudflare exact-main two-host and all post-release suites **PASS**: https://github.com/tayaz-maker/tariklab/actions/runs/39499739364 . Racon stage C includes original-byte hashes, anonymous auth, region/crew/police, TR/EN/PL×390/1280 and gameplay-preserving saves. Post-release Wave1, coast recovery, Çete, TC, campaign and both card games PASS. Racon C is closed; do not repeat these tests without a changed dependency.
- PR #112 (historical DARBE ten-card art draft) closed without merge. Its deleted-product assumptions must not return.

## Independent saved work

1. **Archive PR #219**: https://github.com/tayaz-maker/tariklab/pull/219 . Branch `codex/archive-bukucu`, latest remote head `a527d27b54b1377205fff62c60a47eeff9808f5c`. Not merged: exact-head CI/TC pending. Previous head63e77e7 unit(3) failed because duel-hotfix asserted17 HTML5 wrappers, while archiving Bükücü adds its wrapper to the preserved route inventory (18). Updated the exact guard to18; all six relevant tests PASS locally. New CI is the release gate, not the old failing/pending head. Local worktree `work/tariklab-archive`, local tip4eb41bb, remote tree must equal local tree7c1983c578437447efaf78aa7b944acb69159ae2.
   - Removes Bükücü from live catalog/Resources/sitemap; uses established archived wrapper. Live16, archived3. Original source, slots/legacy keys and existing archive runtimes remain byte-identical.
   - Immutable Git ref `archive/bukucu-pre-retirement-20261021` independently read back at007ce1e. Existing İHTİLÂL/Kıyı refs/manifests unchanged.
   - `archives/retired-games-2026-10-21.tar.xz`:77 files,5,018,304 source bytes→677,052 compressed bytes (86.51% reduction); full safe-path SHA-256 manifest and read-only verifier. Package outsidepublic/; original runtimes remain for archival save recovery. No claim that all original runtime files were removed from production.
   - Local55 catalog/archive/save tests+8 remaining catalog expectations+29 preservation/strategy tests+6 HTML5 guard tests PASS; typecheck/build/lint0errors PASS; built archive browser6/6 TR/EN/PL×390/1280 preserves six save keys.
   - When exact current head CI/TC and relevant checks PASS, merge safely, verify new-main CI/TC and Cloudflare exact-main two-host acceptance. Do not use archive-ref SHA as currentmain.

2. **Master quality checkpoint branch `codex/master-quality-closure`** (draft PR to accompany this checkpoint). Based on007ce1e, independent of219. Local worktree `work/tariklab-master-quality`.
   - TC source commit `aa8f4a8a2cb70bae7804d02939d51b5f3034df4b` integrated locally as43d7225: TC scoped EN/PL dashboard/date/profile/role/weekly/job-start presentation and six-cell real job-start/save/reload regression. State, economy, coefficients, art and saves unchanged.
   - TC evidence:222 unique domain tests,126 broad source browser cases, Istanbul/Ankara/Izmir×desktop/mobile,14 final language/offline-responsive tests, final dashboard6/6 PASS. See docs/tc-sim/FINAL_QUALITY_AUDIT_2026-10-21.md. Final integrated built/browser acceptance is PENDING. Check Polish generator source closure before regenerating dictionaries; current change includes the public TC dictionary and scoped runtime rows.
   - Catalog/duel commit `84430c1e66b728903471022f2fedf0bddad538ee` integrated as12a542a: observed Peg results/record and Apartman phase/trait/continuing-event presentation, basic Çete PL labels, meaningful regressions, master production browser script. See ACTIVE_CATALOG_DUEL_AUDIT_2026-10-21.md.
   - Existing evidence:1020 source layout/interaction checks; Wave1save24; decisions42; duel144 viewports+24 scenarios+PL4+1000 deterministic matches;600 exact card/ID/WebP/manifest checks; targeted unit sets and final Peg6/Apartman6/Çetecreation6 PASS. Board games preserve existing record-only/no-midgame-save contracts; do not invent new save features.
   - `scripts/master-production-browser.mjs` is a saved, unfinished release gate: final syntax/lint PASS; full post-fix matrix NOT run. Initial dry-run failures included harness mistakes (redirect bodies, frame-aboutblank/stale outer frame, directstatic Bükücü versus iframe) that were corrected; do not present its initial failure matrix as game defects or its unrun final matrix asPASS. Run against accepted exact-main build and both real hosts after fixing the confirmed offline gap below. It must separately validate supported critical language labels, not equate nonempty content with translation completeness.

3. **JITEM upstream PR #30**: https://github.com/tayaz-maker/jitem-derin-ag/pull/30 . Exact candidate head `696d14fd4dcf5b0d7e6da55e002086c2517a16ef`; canonical source remains `e1d5bf742d012ef9355f7d822fa31bc896cd7c8d` while CI pending. Run39501126952. No safe merge yet at checkpoint.
   - Fixes observed EN log and atlas labels in upstream presentation only. Exact-lock test308+targeted24, typecheck/build, product8+atlas7+save4 browser PASS. Generated runtime hash `687d785f05eb69153811815b41e7060b33d96e3d771a37b00047bcc4852e0ee3`; other29 generated assets (includingatlas-pixi) byte-identical. Never hand-edit compiled runtime.
   - Separate prepared portal checkpoint: local commit `481e02fcf7cd8916bd2705be250ebb9427b5196d`, work/campaign-jitem-quality, remote checkpoint branch `codex/jitem-locale-sync-checkpoint-20261021` (see final report for exactremoteSHA). SOURCE.candidateStatus explicitly upstream-ci-pending/do-not-release. This candidate is deliberately NOT integrated into the general quality branch or main.
   - Astra: require exact-head upstream CI PASS→merge with expectedhead→fetch merged canonicalSHA→regenerate embed using its own lock→update SOURCE/productidentity/integrationpin/receipt+ledger→portalPR required CI→mainCI/TC→two-host production. Preserve IHTİLÂL ADAPT archive history, schema5/savekey and atlas-pixi.

## Confirmed open blocker

Fresh-profile root offline registration is missing for Racon and Peg (no prior Çete/HANEDANIAN visit). In isolated007ce1e builtcontexts: registrations=[],controller absent, wrapper reload offline fails ERR_INTERNET_DISCONNECTED. Product fix is NOT implemented. See ROOT_OFFLINE_REGISTRATION_AUDIT_2026-10-21.md (source audit commit ef8a19767172e096eb5fb30e1674d43208bcc357, integrated8aeffe7); evidence work/offline-quality-baseline.log and scratch harness.

Investigate sharing the existing root service-worker registration lifecycle from src/components/game/offline-ready.tsx at portal root, without moving Çete UI/prefetch or introducing new infrastructure. Preserve all existing cache/save policies and HANEDANIAN's independent atomic package. HANEDANIAN own offline20/20 PASS; its generic wrapper timeout was a stale-frame harness issue, not a proven game failure. Missing optionalpl-body.js alone is not proof of broken Polish: HANEDANIAN has packaged ownPL i18n. Test actual language behavior before changing its package closure.

## Other verified scope and manual limits

- HANEDANIAN:9 campaign victories/9 exploit policies,30 width checks+20 touch/offline/IDB/save/backup browser cases PASS. JITEM canonical integration and29 unaffected generated assets preserved.
- Physical devices are user-owned acceptance. Real-user login/password recovery/SMTP were NOT run: no test account or authorized test mailbox supplied; no email sent. Anonymous production auth endpoint PASS. Do not fabricate account/SMTP success.
- Maincheckout has user/unowned untracked `.github/workflows/ci-full-regression 2.yml` and `cloudflare-production 2.yml`; left untouched. node_modules entries are local symlinks, not commit inputs.
- Evidence roots: work/archive-evidence, work/tc-quality-evidence, work/catalog-duel-evidence, work/campaign-jitem-evidence and siblingwork/*.log. Outputs include full local validation and this handoff. Retain worktrees until Astra has consumed them.

No complete master-program production closure is claimed. Save work, inspect fresh state at each checkpoint, progress independent work while CI runs, and keep at most three active PRs.
