# Continuation checkpoint (2026-09-23, updated ~16:12 UTC)

This is a safe handoff point for any model or person continuing the work.

- Repository: `tayaz-maker/tariklab`. The local clone is named `cete-savaslari`.
- Production: https://tariklab.tayaz29.workers.dev. Cloudflare Workers Builds deploys it on every push to `main`.
- `origin/main` = `d4b2837066d1b5fee1c963a6dfaa29d57b39d6a4` (merge of #75, on top of another session's #80 HANEDANIAN relief merge `b911b1b`).

## Rules that still apply

- Merge only when every check on the PR head is green.
  - Use merge method "merge" with `expectedHeadSha` set.
  - After each merge, update the next PR's branch and wait for its CI (about 25 minutes).
  - **Right before merging, confirm the PR's CI base is still `origin/main`.** Other sessions also merge into `main`: #80 landed between #75's branch update and its merge. If `main` moved, update the branch again and wait for CI.
- Prove production after every merge:
  1. The merge commit's tree must equal the gated head's tree.
  2. Run `npm run build` on the merged `main`.
  3. Compare production with that build: the HTML asset refs must exist locally, and 7 key files must be byte-identical.
  4. Live smoke: desktop and 390 px, no console errors, no overflow.
- The PRs labelled `[DO NOT MERGE — IP gate]` must **not** be merged. They wait for:
  - written sign-off from Turkish IP/trademark counsel;
  - a public name cleared through a TÜRKPATENT search.
- TarikLab games are silent: no audio of any kind. Never name, list or imitate the reference apps.

## In-flight PRs (recorded merge order: #73 ✅ → #74 ✅ → #75 ✅ → #76)

| PR | Branch | Head SHA | Base | CI state at checkpoint | Next single step |
|---|---|---|---|---|---|
| #73 T monogram | `claude/t-monogram` | `b781b1c` | — | **MERGED** as `c8f8a75`. Production verified (tree identical to head, 0 missing, 7/7 identical, icons 200 and byte-identical, sw `cete-offline-v5`, live smoke OK). | — |
| #74 Son Köy command bar | `claude/son-koy-command` | `1006f82` | — | **MERGED** as `f874e40` after all 5 checks were green. Production verified: merge tree identical to head (`6b42cc5`), 0 missing, 7/7 identical, all 4 Son Köy files byte-identical, live smoke clean. The first desktop smoke hit a transient 502 on the main JS during the deploy switchover; the file returned 200 three times on recheck and the re-run smoke was clean. | — |
| #75 JITEM sync | `claude/jitem-sync-operations` | `f1ba095` | — | **MERGED** as `d4b2837` with all 5 checks green on base `f874e40`. The merge also contains #80 (merged by another session in between), so the merge tree ≠ head tree. The files are disjoint: #80 touched `hanedanian/map.js`, a test and a ledger doc; #75 touched only `jitem-derin-ag/*` and the jitem test. #80 was green on the same base. Local full gate on `d4b2837`: typecheck/lint/build pass; tests 1430 pass / 1 skipped, plus 54/54. Production: 0 missing, 7/7 identical. JITEM `SOURCE.json`, `index.html` (via the directory URL, since Cloudflare answers `/index.html` with a 307), `runtime.js` and `hanedanian/map.js` are byte-identical to the build. Live smoke clean on `/`, `/oyna/jitem-derin-ag`, `/games/jitem-derin-ag/?embed=1` and HANEDANIAN. `main` push CI on `d4b2837` not yet checked. | Check `main`'s CI run on `d4b2837`. |
| #76 DEVLET maps | `claude/devlet-maps` | `b9d8dd439948bb34af331d46306086024ebbe463` | `main` @ `d4b2837` (current) | At 16:10 UTC: campaign-balance ✅, Workers ✅, Vercel ✅; build and campaign-browser running on the new head | Merge when all checks are green on `b9d8dd4` **and** base = `origin/main`, with `expectedHeadSha`; then run the production proof. |

**Concurrency note (16:12 UTC).** A second agent ("Grok") is working the same queue.
- It pushed `b9d8dd4` to #76, which moves the map record lists out of a closed `<details>` table so the site-wide responsive test can click them, adds a test and re-pins the frozen hash. The change was reviewed and is in scope.
- It keeps its own live status in `docs/GROK_EXECUTION_QUEUE.md` on that branch. There it records `main` CI on `d4b2837` as green (run `35882278960`); not independently re-checked here.
- It marks the interactive novella as **LATER**: no new code, PR, merge or deploy this wave.
- Before any merge, check that file and the PR head so two agents do not race; `expectedHeadSha` prevents a double merge.

## Originality / legal wave (new work)

| PR | Branch | Head SHA | Base | Status | Next single step |
|---|---|---|---|---|---|
| #77 Wave 0 IP gate (`docs/ip/`) | `claude/ip-wave0` | `9e43e9601fdf42b216a712e6db23b3326877e563` | `main` @ `7fe82f9` | Docs and tests only. Local checks: eslint clean, `scripts/ip-register.test.mjs` 3/3 pass. The full gate also passed as part of #78's stack (1436 + 54 tests). PR CI is **all green** on `9e43e96` (build, campaign-browser, campaign-balance, Workers, Vercel). | May be merged after #76; it is IP evidence, not a new title. Update the branch first and re-check CI. |
| #78 Apartment slice (draft) | `claude/slice-apartment` | `28ee6cffd6745acf48647997e20baccd6a0e6dcb` | stacked on #77 | Full local gate on this SHA: typecheck/lint/build pass; tests 1436 pass / 1 skipped, plus 54/54. Sonnet adversarial review: Low; 2 Medium findings fixed. QA at 3 viewports. | **Do not merge** (IP gate). Nothing else is pending. |
| #79 Transit slice (draft) | `claude/slice-transit` | `b27b07c68691aa8a9adbcc62fbfca279bcc61c73` | stacked on #77 | Slice and IP tests 13/13. Sonnet review: all axes Low. QA at 3 viewports. **The full-repo gate was not run locally**; PR CI was running at checkpoint time (campaign-balance ✅, build and campaign-browser in progress). | **Do not merge** (IP gate). Confirm PR CI is green. |
| (no PR yet) Novella slice | `claude/slice-novella` | `4e960918ed3edd215bc319d18fc9c0f2dbcfa612` | stacked on #77 | WIP commit. 7 rules tests plus the IP tests pass (10/10), eslint is clean, every file parses. | See the novella section below. |

### Novella slice: verified and not verified

- **Verified:**
  - Story structure: 21 paths, each ends in one of exactly two endings; three choices on every path.
  - Every choice changes what follows or how the story can end.
  - TR/EN parity.
  - Saves replay the recorded choices, so tampered variables are ignored.
  - Settings are bounded.
  - No audio, no images.
  - Unlisted and `noindex`.
- **Not verified:**
  - Browser QA. The first QA run found the settings panel off-screen on narrow screens; it is now `position: fixed` under 820 px, but that is untested.
  - No screenshots have been reviewed.
  - No IP register row (A021 is still the placeholder).
  - No `docs/ip/slices/NOVELLA.md`.
  - No adversarial similarity review and no story review (GPT is unavailable, so use a Claude subagent and label it).
  - No performance check.
  - No full gate.
- **Status per the owner's live queue: LATER (paused).** When resumed, the next single step is:
  1. Re-run the browser QA: 1440, 1024 and 390 px; open → 3 choices → ending for 2 paths; mid-story reload; the settings panel.
  2. Then add A021, NOVELLA.md and the reviews.
  3. Then open a **draft `[DO NOT MERGE — IP gate]` PR**.

## Blockers recorded (need the owner or counsel, not code)

- TÜRKPATENT and WIPO Brand DB searches were not performed; both are behind a CAPTCHA and e-Devlet.
- The live title "Apartman: Apartman Yöneticisi" collides with a third-party app name.
- The working name "Akış Hatları" is already used by a web game, so it stays internal only.
- AI art provenance was never recorded for DARBE-H!, VETO-H! and GETT-OH!.
- Creators of the portal and JITEM share images and the Bükücü icons are unknown.
- Bükücü uses the Web Audio API, which conflicts with the silent policy.
- Legacy findings, listed in `docs/ip/TRADEMARK_CLEARANCE.md`:
  - duel-family names;
  - the "Extreme Last 100 Days" wording;
  - the Racon spec saying it takes a Football Manager screen skeleton;
  - Bükücü's trade dress.

## Not started (deferred by the latest instruction)

- Resources/credits update. It must remove the "Extreme Last 100 Days" wording and add a truthful licence record.
- From the premium wave: HANEDANIAN, İHTİLÂL, TC SIM, the Racon map, and `docs/TARIKLAB_PREMIUM_GAME_WAVE_CLOSURE.md`.
- Maintenance items M1 (campaign-start trace) and M4 (PL inventory).
- PRs #57 and #59 remain open.

## Environment notes

- Worktrees still present, under the session scratchpad:
  - `js` → #75 (can be removed);
  - `sc` → novella;
  - `ckpt` → this checkpoint.
  - Everything else was removed. The patches from the old `fix55`/`fix58` experiments are archived in `scratchpad/archived-diffs/`.
- No local dev or static servers are running.
- Playwright needs `executablePath: "/opt/pw-browsers/chromium"`.
- The static games are served from `public/`, and an explicit `/index.html` URL is needed.
