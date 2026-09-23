# Continuation checkpoint (2026-09-23, ~14:35 UTC)

This is a safe handoff point for any model or person continuing the work.

- Repository: `tayaz-maker/tariklab`. The local clone is named `cete-savaslari`.
- Production: https://tariklab.tayaz29.workers.dev. Cloudflare Workers Builds deploys it on every push to `main`.
- `origin/main` = `c8f8a75d2571d21b5422d9f6a1c39e3f49b9a5f2` (merge of #73).

## Rules that still apply

- Merge only when every check on the PR head is green.
  - Use merge method "merge" with `expectedHeadSha` set.
  - After each merge, update the next PR's branch and wait for its CI (about 25 minutes).
- Prove production after every merge:
  1. The merge commit's tree must equal the gated head's tree.
  2. Run `npm run build` on the merged `main`.
  3. Compare production with that build: the HTML asset refs must exist locally, and 7 key files must be byte-identical.
  4. Live smoke: desktop and 390 px, no console errors, no overflow.
- The PRs labelled `[DO NOT MERGE — IP gate]` must **not** be merged. They wait for:
  - written sign-off from Turkish IP/trademark counsel;
  - a public name cleared through a TÜRKPATENT search.
- TarikLab games are silent: no audio of any kind. Never name, list or imitate the reference apps.

## In-flight PRs (recorded merge order: #73 ✅ → #74 → #75 → #76)

| PR | Branch | Head SHA | Base | CI state at checkpoint | Next single step |
|---|---|---|---|---|---|
| #73 T monogram | `claude/t-monogram` | `b781b1c` | — | **MERGED** as `c8f8a75`. Production verified (tree identical to head, 0 missing, 7/7 identical, icons 200 and byte-identical, sw `cete-offline-v5`, live smoke OK). | — |
| #74 Son Köy command bar | `claude/son-koy-command` | `1006f82d59488549f82693cbbcf9a352adaeac08` (branch updated onto `c8f8a75`) | `main` | build ✅, campaign-balance ✅, Workers ✅, Vercel ✅, **campaign-browser running** | When campaign-browser is green: merge with `expectedHeadSha=1006f82…`, then run the production proof. |
| #75 JITEM sync | `claude/jitem-sync-operations` | `45de92a74f691f2f3d8fa4577da9395e962eb1c8` | `main` @ `167f752` (stale) | Green on its old base | After #74: update the branch, wait for CI, merge, run the production proof. Expect `games/jitem-derin-ag/SOURCE.json` to change in production. |
| #76 DEVLET maps | `claude/devlet-maps` | `8ee2806b47d7c39ad0345a855096886f23f164a7` | `main` @ `167f752` (stale) | Green on its old base | After #75: same steps. |

## Originality / legal wave (new work)

| PR | Branch | Head SHA | Base | Status | Next single step |
|---|---|---|---|---|---|
| #77 Wave 0 IP gate (`docs/ip/`) | `claude/ip-wave0` | `9e43e9601fdf42b216a712e6db23b3326877e563` | `main` @ `7fe82f9` | Docs and tests only. Local checks: eslint clean, `scripts/ip-register.test.mjs` 3/3 pass. The full gate also passed as part of #78's stack (1436 + 54 tests). CI on the PR has not been checked. | Check the PR's CI. It may be merged after #76 if green; it is IP evidence, not a new title. |
| #78 Apartment slice (draft) | `claude/slice-apartment` | `28ee6cffd6745acf48647997e20baccd6a0e6dcb` | stacked on #77 | Full local gate on this SHA: typecheck/lint/build pass; tests 1436 pass / 1 skipped, plus 54/54. Sonnet adversarial review: Low; 2 Medium findings fixed. QA at 3 viewports. | **Do not merge** (IP gate). Nothing else is pending. |
| #79 Transit slice (draft) | `claude/slice-transit` | `b27b07c68691aa8a9adbcc62fbfca279bcc61c73` | stacked on #77 | Slice and IP tests 13/13. Sonnet review: all axes Low. QA at 3 viewports. **The full-repo gate was not run locally**, so rely on PR CI. | **Do not merge** (IP gate). Confirm PR CI is green. |
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
- **Next single step:**
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
  - `sk` → #74;
  - `js` → #75;
  - `sc` → novella;
  - `ckpt` → this checkpoint.
  - Everything else was removed. The patches from the old `fix55`/`fix58` experiments are archived in `scratchpad/archived-diffs/`.
- No local dev or static servers are running.
- Playwright needs `executablePath: "/opt/pw-browsers/chromium"`.
- The static games are served from `public/`, and an explicit `/index.html` URL is needed.
