# TARIKLAB — CARD ART RECOVERY HANDOFF (2026-10-19)

**STATUS: PARTIAL — 651/900 production images verified in user-held archive; NOT uploaded to GitHub. Do not mark card release DONE.**

## Canonical inventory and resume
- 900 canonical card IDs: DARBE-H! 300, VETO-H! 300, GETT-OH! 300.
- User-provided `TARIKLAB-PRODUCTION-651.zip`: 651 WebP (DARBE 300, VETO 216, GETT 135) plus `manifest.json`.
- Reported SHA-256 of original production ZIP: `92805a84f9ada3372853eb819ae7014b9cd518c1ed3a9fc367005e93d53244e8`; verify the actual uploaded bytes before use.
- 249 card images remain: VETO 84 and GETT 165.
- Existing old WebP 430, approved pilots 6, 215 additional verified images; repaired defects DRB-008, SND-101, RCN-044. Preserve all confirmed artwork.
- Partial batch 012: SND-189 and SND-190 raw outputs reportedly preserved; third raw output unidentified. None of these is counted among 651. Check hashes and ID before producing them again.
- Legacy original source PNGs for 430 older WebPs unavailable. Never invent or regenerate them just to satisfy an archive completeness claim.

## Files required for restart (USER HELD; NOT IN GITHUB)
1. `TARIKLAB-PRODUCTION-651.zip` — 651 optimized WebPs + manifest, approximately 20.7 MB.
2. `TARIKLAB-RESUME-RECEIPT.json` — package hashes/counts.
3. `TARIKLAB-BATCH-012-PARTIAL-SAFE.zip` — three raw outputs, requires ID reconciliation.
4. `TARIKLAB-RESUME-DELTA-651.zip` and `TARIKLAB-SOURCE-ARCHIVE.zip` — original PNG sources; may require user to upload again.
5. Prior checkpoint and card metadata/reference images when available.

## Visual standards
- DARBE-H!: navy, charcoal, matte brass, warm night light, civilian bureaucracy.
- VETO-H!: election atmosphere, daylight, cream, dark green.
- GETT-OH!: neighborhood night, amber, rain, teahouse.
- Canonical card IDs and metadata are authoritative. No text, ATK/DEF, UI, or invented symbols baked into illustration.
- Existing images must never be overwritten without per-ID verified selection and fallback.

## Safe GitHub integration plan
1. Independently validate ZIP CRC, manifest ID uniqueness, file hash, dimensions, and runtime card metadata.
2. Compare against repository's existing 300 VETO + 300 GETT WebPs and 300 DARBE SVGs. Do not interpret existing alternate art as missing cards.
3. Create a **separate** card-art branch; add optimized WebPs only, not PNG archives or checkpoint ZIPs. Keep source archives outside repository.
4. Fix DARBE custom card face to respect release marker and portrait aspect ratio; keep SVG fallback. Verify responsive display and save compatibility.
5. Test build, card ID mapping, browser smoke, and production assets. Merge only with passing required checks.
6. Keep card production separate from CI optimization PR #170 and from unrelated game changes.
7. Preserve old art and original source data for rollback. Avoid Git history rewrites and force pushes.

## Other roadmap
- CI optimization #170 requires check review; do not assume merged.
- After secure art checkpoint: CI and site size optimization; TC SIM and HANEDANIAN comic-style map illustration when scheduled; other game QA, PWA/offline, production acceptance.
- User performs physical-device QA.
- Anatomy Atlas is explicitly **deferred until all other TarikLab work is finished**, not in active roadmap.

## Critical warning
This GitHub document is **not** a backup of the binary images. Until the production/source ZIPs are uploaded to durable storage, keep independent copies of them. A GitHub commit of this handoff does not mean the 651 art files were committed.

## Resume gate
Start with user-provided ZIPs and compare SHA-256, then reconcile partial batch 012. Never regenerate a confirmed ID. Report `READY / MISSING / AMBIGUOUS` and stop if files are inaccessible.
