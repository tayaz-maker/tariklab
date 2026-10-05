# Grok — VETO-H! / GETT-OH! / DARBE-H! card art handoff

2026-10-05 · User division supersedes “Astra produces 900 cards.” **Grok owns art, frames, generators and assets; Astra owns later invariant/quality/release review.** No new Astra changes in those surfaces. This handoff changes documentation only; accepted replacement art remains **0/900**, not a production approval.

## Frozen inputs and 300 × 3 briefs

Web baseline: [`be160c95eb5283e5ed2ce8bf139ef7aa714d329d`](https://github.com/tayaz-maker/tariklab/commit/be160c95eb5283e5ed2ce8bf139ef7aa714d329d). Each `public/games/<game>/source-cards.json` contains exactly 300 unique IDs. Preserve every field: ID/name/kind/subtype/series/level/ATK/DEF/deckLocation/text and translations/aliases; also preserve designs, decks, balance, engine, saves, localization/accessibility, filters, card dimensions and interaction behavior.

| Game / IDs | Exact source SHA-256 | Published preparation branch / immutable SHA |
|---|---|---|
| VETO-H! / SND-001…300 | `b876fdb69eeb4ddcfd1d06e397df14e14070cf3131ad4d210b4608e8fe7b4acd` | `astra/veto-semantic-art-preparation` / `eb7da70df8cf1b555f8de531d16a641583c9808c` |
| GETT-OH! / RCN-001…300 | `e385808c632851e5110e47950af4c33f33e6f9784ca235ca7d70c5a1e6dd99a3` | `astra/gett-semantic-art-preparation` / `ccdd9c9015cb90badce65983f76856a4c63623be` |
| DARBE-H! / DRB-001…300 | `222916020ef176ced6ad72d4c61038bf045757e7ae9d7a6bfa6d8f99c657f3f9` | `astra/darbe-semantic-art-preparation` / `931429dba20bf521877aa4f6ad4ad8bc591827e4` |

The three existing JSONs carry each exact original card record plus authored subject/action, setting, composition and effect relationship; do not replace them with a generic classifier:

- [VETO 300 briefs](https://github.com/tayaz-maker/tariklab/blob/eb7da70df8cf1b555f8de531d16a641583c9808c/outputs/veto-vector-300/semantic-art-briefs.json); companion `SEMANTIC_QUALITY_STATUS.md`. SND-046/132 narrative referents remain ambiguous; supported visual metaphor cannot invent rule meaning.
- [GETT 300 briefs](https://github.com/tayaz-maker/tariklab/blob/ccdd9c9015cb90badce65983f76856a4c63623be/outputs/gett-vector-300/semantic-art-briefs.json); companion `semantic-quality-status.json`. RCN-094/095/119/135/140 have interpretation limits; **RCN-149 web alias `Semt Korudu` stays unchanged**.
- [DARBE 300 briefs](https://github.com/tayaz-maker/tariklab/blob/931429dba20bf521877aa4f6ad4ad8bc591827e4/outputs/darbe-vector-300/semantic-art-briefs.json); companion `SEMANTIC_PREPARATION_STATUS.md`. All are author drafts, not drawn/accepted art. Preserve [#112](https://github.com/tayaz-maker/tariklab/pull/112) as historical proof, not an accepted 300-card template.

Remote branch trees exactly match the verified local preparation snapshots; current source hashes match all three. Preparation tests rerun 2026-10-05: VETO 6/6, GETT 5/5, DARBE 6/6. These verify 900 source-bound briefs, **not** artwork realism, gameplay runtime or production readiness.

## Art direction and private references

Quality direction only: original adult cinematic realism, credible anatomy/perspective/material/contact and consistent lighting. Never copy reference composition, faces, text, logos or frame layout. No stick figures, generic icon collage, repeated scenes/faces, slogans, invented signs or extra flavour text. Existing UI text only; no audio/music/speech/vibration/autoplay.

| Game | Independent identity | Approved private reference |
|---|---|---|
| VETO | Bright fictional civic/election rooms; cream, dark green, warm wood, restrained red | `image-gen-1(5).png` · Sandık Görevlisi · `libfile_f862b0cb8dd8819199a7237bb2aac503` |
| GETT | Warm fictional neighbourhood/workshop/café; amber/tungsten, natural adult diversity | `image-gen-2(5).png` · Çaycı · `libfile_1293b9949ae881918fcd1eb4ab34ac3f` |
| DARBE | Civil bureaucratic noir; archive/telex/documents, navy/charcoal/matte gold | `image-gen-3(2).png` · Dosya Kâtibi · `libfile_dec63124a39c8191b1bccb8a8aa3d45a` |

Reference pixels are private, outside Git; do not ship/trace them. Latest production constraint remains original code-drawn SVG/vector/layered geometry; **no AI image plates, downloaded photos/models, external assets/CDN, real people/brands/institutions/party or military symbols, propaganda or violence aesthetic**. Rasterizing original geometry to optimized existing-format output is not permission to import raster source art. Three frames must be distinct, not recolours.

## Source, transport, provenance and budgets

- Shared art/content canonical repository is private `tayaz-maker/tariklab-content`, inspected commit `81fb4668abef664eca3f616a421ea8b579bc8169`: `games/veto-h/{cards.json,art-manifest.json,art/}`; `games/gett-oh/{cards.json,decks.json}`; DARBE absent. Canonical VETO art differs from current web art and is **not** an approved restore. Follow canonical-first sync without overwriting web aliases; native remains paused.
- VETO/GETT runtime: `public/games/{veto-h,gett-oh}/assets/cards/<ID>.webp`, `assets/art-manifest.json`; intrinsic 576×384 / 400×300. `scripts/duel-art-packs/` are transport authority: `predev`, `pretest`, `prebuild` unpack them and overwrite public-only replacements. Update generator, per-game packs and manifests together; avoid regenerating another game's pack.
- DARBE runtime uses `assets/card-art/<ID>.svg` with 240×160 viewBox and its `manifest.json`; compatibility faces `assets/cards/<ID>.svg` remain 400×560 with `assets/art-manifest.json`. Both paths must agree with the same ID/source; preserve measured card UI dimensions and accessible text.
- Record generator/source commit, author/method, per-ID SHA-256/bytes/dimensions, source-record hash and provenance; update `docs/ip/card-art-2026-09-24.md` / DARBE records truthfully. No legal-clearance claim. Remove superseded production art only with reference/build proof; retain historical commits and source preparation.
- Existing gates: WebP <180,000 bytes each / mean <100,000; DARBE primary SVG <12,000 plus old palette/shape rules. The old flat-art gate is a **known redesign compatibility issue**, not permission to bypass CI. Candidate planning budget: ≤80,000 bytes per original vector illustration and ≤15,000,000 bytes/game, including declared compatibility overhead; this is a proposal, not an agreed universal cap. Any replacement gate requires measured transfer/decode/visual evidence and reviewed tests; lower output costs where possible.
- Lazy-load visible art; do not fetch 900 images on archive opening or portal load. Test both first visit and warmed/offline cohorts. Current fixed-URL SW can mix one new/299 old cards after update; full-cohort completeness/upgrade is **open**, not closed by hashing files. Coordinate SW integration with Astra before touching shared cache code.

## Per-game acceptance and ownership

One independent PR per 300-card game. Require exact 300-ID manifest correspondence, immutable rules/data/decks/save/i18n/a11y diff, deterministic output, no old art in build, no external fetch/script/font, provenance and measured bytes/request/first-render before/after. Inspect all 300 semantically; contact sheets alone do not prove anatomy, perspective or unique scenes.

Run targeted art/manifest/invariant tests, 24+ deterministic duel regressions, production build/typecheck and required CI. Browser evidence: 320/390/1440 hand/board/archive, decoded visible card UID+manifest source, names/stars/ATK/DEF, keyboard/focus/screen-reader text, reduced motion, silence, old save/reload, offline install/update/failure, resize and console/404/overflow zero. Reuse `scripts/duel-visible-art-browser.mjs`, `duel-browser.mjs`, `duel-production.mjs`; no placeholder screenshot or failed-image “PASS.” Merge only green, then real www + Workers screenshots/hash evidence and status update. No physical GPU/human-review claims from software tests.

**Astra review gate:** source/engine/save/UI invariants, manifest/build/offline/performance/provenance and real visual quality; **Grok production owner:** all 900 illustrations, frames and their generators/assets. Failed studies `e5c89a4` / `1e49474` / `ada990b` remain rejected, never a rollout base. Local `astra/card-cohort-pipeline` at `ecfbf29` is deferred/unwired, no PR: do not assume its API is deployed.

**B11 remains separate:** #118 proved DRB-237…240 trigger in valid UI fixtures, not a natural-match/affected-old-save closure. Track that remaining boundary; no rules changes in art PRs. A1–A3 are already closed (#113 `375b837` → #111 `a534289`); TC #117/#119 are released, current main `be160c95` CI 37282054896 and two-host production 37282054880 succeeded. Do not reopen those blockers.

Final 360 review waits for remaining products **and Grok art releases** in production. Astra will report/classify evidence and human-review gaps; broad fixes after that report require the user's separate task, not automatic continuation.
