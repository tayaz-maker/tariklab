# Web ↔ App sync ledger

Track **meaningful** [www.tariklab.com](https://www.tariklab.com) changes that a later **standalone native game** must match.

This is a reminder list, not a second technical report.

## Binding rules

- **Active product:** www.tariklab.com. Web ships first and does **not** wait for native.
- **Native/Godot:** paused. Do not resume unless the product owner explicitly says so.
- **Download model:** each TarikLab game will be its **own** standalone downloadable title — not one giant native TarikLab app.
- **Parity:** Web ↔ Native Content Parity is binding. Log relevant web work here; apply it later on the matching native game.
- **Canonical shared content:** private [`tayaz-maker/tariklab-content`](https://github.com/tayaz-maker/tariklab-content). Web and native **bundle copies**. Do not treat generated `catalog.json` / `designs.js` as authored source.
- **Audio:** disabled.
- **Safety:** never remove existing website games, content, data, or routes because of native work. Do not change gameplay just to create parity.

## When to append

Append after a meaningful website change to a game or shared brand/content. Skip typos, comments, CI, and docs-only work unless they redefine content or presentation a native game would need.

## Entry template

```
### YYYY-MM-DD — <game / surface>
- Web change:
- Content: yes/no
- Artwork: yes/no
- Gameplay/rules: yes/no
- UI/presentation: yes/no
- Shared-content source: yes/no
- Native follow-up: yes / no / already done
- Commits:
```

## Entries

### 2026-10-05 — Anatomy Atlas 3D entry + rendering polish
- Web change: The portal's primary learning link now opens the source-bound 3D anatomy preview; the lightweight 2D atlas remains available as an explicit alternative. Both atlas surfaces cross-link. 3D materials, lighting and desktop canvas scale were tuned without inventing or altering anatomical geometry.
- Content: no; existing nine male-reference thorax/abdomen groups and expert-review caveats remain explicit.
- Artwork: no new artwork; source meshes remain unchanged.
- Gameplay/rules: no.
- UI/presentation: yes — clearer route hierarchy, larger responsive 3D workspace, warmer material separation and controlled highlights.
- Shared-content source: no.
- Native follow-up: no — this is web-specific navigation and rendering.
- Commits: pending

### 2026-10-05 — Kıyı Eşiği v1 save recovery (candidate, not released)
- Web change: malformed v1 saves are rejected before legal/render consumers; a valid backup opens without writing. Unreadable primary/backup bytes are retained before replacement; quota or a full recovery area blocks persistence with a calm TR/EN/PL status.
- Content/artwork/gameplay/rules: no. Key `tariklab.kiyi-esigi.v1`, schema 1, formulas and serialized reachable state remain unchanged; renderer, card surfaces and dependencies untouched.
- UI/presentation: game-local accessible recovery text only; native follow-up when resumed: match the validation/preservation boundary, not a new save schema. Shared-content source: no.
- Offline: versioned entry/app/helper share `sim.js?save=2`; actual root-SW regression covers old fixed-URL cache and warm offline. Completely offline old HTML still runs its old code until reconnect; no whole-site atomic upgrade claim.
- Local: 28 targeted PASS; full suite 1,823 PASS / 1 existing opt-in skip; build/typecheck/lint PASS. One local build hit transient `.rsync-tmp` ENOENT paths; unchanged-source retry passed. Browser/CI/two-host production pending.
- Cost: four changed runtime files total 18,768 → 26,144 raw bytes; gzip-9 sum 6,870 → 9,440 (+2,570). No new art/asset/library; one new small JS module. Route/FMP before-after not measured.
- Provenance: original validation/storage code, existing game data and artwork preserved. Candidate branch `astra/kiyi-save-hotfix`; implementation `da45226`, browser gate `9906185`.

### 2026-09-23 — HANEDANIAN Kuzey Işığı Rölyefi
- Web change: Cached atlas uses a northwest rake (shadow length = height), canopy masses, field furrows, a carved river bed, and southeast road depth. Ownership is a hem, not a tile fill. Selection is a lit plinth. Scheduler and 49×49 simulation unchanged.
- Content: no
- Artwork: yes
- Gameplay/rules: no
- UI/presentation: yes (map only)
- Shared-content source: no
- Native follow-up: yes (paused)
- Commits: grok/hanedanian-kuzey-isigi

### 2026-09-22 — HANEDANIAN cached atlas + DARBE-H! illustrated interiors
- Web change: HANEDANIAN terrain is a cached offscreen atlas (blended biome masses, forest clusters, ridge systems, field parcels) blitted each frame instead of per-tile fillRect. DARBE-H! 300 SVG faces rebuilt as lit interior scenes with perspective, lamp pools and series-specific furniture. Compact HUD unchanged.
- Content: no
- Artwork: yes
- Gameplay/rules: no (49×49 world, seed, movement, save, decks, stats, RNG, 300 IDs untouched)
- UI/presentation: yes (map rendering + DARBE card faces)
- Shared-content source: no
- Native follow-up: yes (paused) — carry atlas cache look and illustrated DARBE interiors
- Commits: grok/hanedanian-darbe-visual-depth

### 2026-09-21 — DARBE-H! card art rebuild + HANEDANIAN atlas rendering
- Web change: DARBE-H! 300 SVG faces rebuilt as series-first archival collages (telex / dossier / command table / paraf / archive). HANEDANIAN map renderer retuned to dynastic atlas (hatching, contours, paper grain, distinct POI symbols, road casing, river banks). Compact HUD palette aligned; height unchanged.
- Content: no
- Artwork: yes
- Gameplay/rules: no (world seed, tiles, movement, save, decks, stats, RNG untouched)
- UI/presentation: yes (map rendering + DARBE card faces)
- Shared-content source: no
- Native follow-up: yes (paused) — carry the new DARBE faces and HANEDANIAN atlas look into a later standalone build
- Commits: grok/darbe-hanedanian-final-art

### 2026-09-19 — Global closure released under final completion override
- Web release: reviewed implementation `455d2601ef70bc4ebf9d08913f3c717cecde788c` fast-forwarded to main in the renamed `tayaz-maker/tariklab` repository; no force update.
- Acceptance: Vercel success; public root + 18 routes HTTP 200; 30 static assets and 6 root bundles byte-identical to the reviewed production build. Browser/viewport limitations are recorded in `ASTRA_GLOBAL_FINAL_CLOSURE.md`, not reported as executed tests.
- Prior IHTILAL/Apartman/shared-i18n candidate entries below are now released. No additional gameplay, content, art, save schema or namespace changes at integration.
- Native follow-up remains presentation parity only; native work stays paused.

### 2026-09-19 — Global closure resume: display IDs and language updates
- Web change: Apartman presents building-system names, resident-group names and authored decision labels instead of raw memory IDs. Legacy memory payloads are preserved.
- Classics/shared vanilla pages: first language change reloads correctly; dynamic DOM text and accessible board coordinates receive EN copy after moves. TC SIM and Hanedan critical setup labels expanded.
- Gameplay/rules: no. Namespaces/migration formats: unchanged. Artwork/audio: no.
- Native follow-up: presentation parity only, when native work resumes.
- Status: candidate only; deployed browser retest and global acceptance still pending.

### 2026-09-19 — Global closure candidate: İHTİLAL usability
- Web change: all three existing save slots selectable in-game; delete-save copy and confirmation; portal language storage synchronization; document language and pressed-state semantics; visible heat value, lock owner, card costs and meaningful ledger events.
- Save: reject non-integer/non-finite slot numbers before storage access; V1 namespace/schema and existing payloads unchanged.
- Gameplay/rules: no. Engine, card/deck data and AI unchanged. Content: UI copy only. Artwork/audio: no.
- Native follow-up: yes (paused), carry the interface safeguards into a later standalone build.
- Status: candidate on `astra/global-final-closure`, not yet production-accepted.

### 2026-09-18 — DARBE-H! targeted balance / expansion repair
- Web change: Regenerated the 300-card DARBE-H! catalog so expansion 151–300 is 90 görevli / 35 emirname / 25 ihtar, the ATK/level curve respects paraf cost (L1–4 free, L5–6 one, L7+ two), and all five 40-card desks mix free and paid officers. Teaching map and expansion trap-series (İhtar) closed. Opus flow-copy (Arşiv / paraf) untouched. VETO/GETT/İHTİLAL untouched.
- Content: yes. Artwork: procedural SVG, unchanged pipeline. Audio: no.
- Gameplay/rules: no shared duel-core rules change. DARBE catalog/decks only.
- UI/presentation: no.
- Shared-content source: no.
- Native follow-up: yes (paused) — later standalone DARBE-H! should ship this repaired catalog, not the inverted-curve dump.
- Commits: `grok/darbe-h-balance-repair`.


### 2026-09-18 — DARBE-H! full wave (duel sibling)
- Web change: DARBE-H! is live as the third VETO-H! / GETT-OH! sibling. Shared duel engine, own theme id `darbe-h`, 300 DRB cards, five crisis decks, KP, telex/briefing visual identity, procedural card faces. Canonical route `/oyna/darbe-h`. Saves/settings/onboarding isolated; no shared `tariklab.duel.*` fallback. İHTİLAL untouched.
- Content: yes. Artwork: procedural SVG (no painted webp pack). Audio: no.
- Gameplay/rules: shared generic duel rules; unique cards/decks/copy. VETO/GETT catalogs unchanged.
- UI/presentation: own theme tokens on the shared shell (ink navy / telex amber).
- Shared-content source: no.
- Native follow-up: yes (paused) — later standalone DARBE-H! should carry this catalog and isolation, not a VETO reskin.
- Commits: `grok/darbe-h-full-wave`.

### 2026-09-18 — İHTİLAL original Kalem Masası (full wave)
- Web change: İhtilâl is live. Original digital-first ruleset (five desks, ink/seal/heat, Hüküm 10, aftershocks, counter window). 204 authored files, 6 archetypes, seeded AI, 3-slot save V1, tutorial, closing report, oxblood-on-paper visual identity. Canonical route `/oyna/ihtilal`; `/ihtilal` redirects. Old teaser (ALTI OK / KIRAT / 2015 credit) removed.
- Content: yes. Artwork: no (procedural CSS/SVG). Audio: no.
- Gameplay/rules: yes — new game. Closed waves untouched.
- UI/presentation: yes — own iframe shell, not duel-core, not next-wave.
- Shared-content source: no.
- Native follow-up: yes (paused) — later standalone İhtilâl should carry this ruleset and catalog, not a board-game reskin.
- Commits: `grok/ihtilal-full-wave-original`.

### 2026-09-18 — İHTİLAL adversarial final integration
- Web change: Final audit made Hüküm pacing the normal close instead of the turn cap, made shared Isı mechanically active at 50/75 and naturally capable of reaching 100, and removed seat-dependent deck RNG. Holding two locks now writes +1 Hüküm per turn; the tutorial/help documents the shipped lock threshold and heat bands.
- Content: no. Artwork: no. Audio: no.
- Gameplay/rules: yes — lock tenure, heat tempo bands, player-scoped once/repeat guards and archetype ink tuning. A 1,296-match mirrored matrix closed at Hüküm 1,235 / time 51 / dağılma 10, median 11 turns / p95 25, with decisive archetype rates inside 40–60% and low seat skew.
- Save/state: Save V1 namespace/version unchanged. AI profile now survives reload; hostile maps/logs/memory and duplicate pending rows are bounded; duplicate card zones fail closed; 25x reload stays deterministic.
- Shared duel preflight: VETO-H!/GETT-OH! legacy settings and onboarding now migrate once into theme-specific keys; reset sentinels stay isolated.
- UI/presentation: copy truth only; visual hierarchy and layout unchanged.
- Shared-content source: no.
- Native follow-up: yes (paused) — carry the final pacing, heat, save and seeded-deck rules into any later standalone İHTİLAL build.
- Commits: `gpt/ihtilal-final-integration`.

### 2026-09-18 — Preflight integration fixes (closed waves frozen)
- Web change: DEVLET catalog icon `tc-sim-devlet` now resolves to the existing devlet glyph instead of the Labirent fallback. Sitemap lists every live play route plus `/ihtilal`. Service worker module graph includes `/games/son-kasaba/`. VETO-H! and GETT-OH! settings/onboarding persist on per-theme keys with a one-time shared-key fallback.
- Content: no. Artwork: no. Audio: no.
- Gameplay/rules: no — Waves 1–5 and VETO/GETT mechanics untouched.
- UI/presentation: DEVLET portal card icon only.
- Shared-content source: no.
- Native follow-up: no.
- Commits: `grok/ihtilal-full-wave-original` (preflight commit).

### 2026-09-18 — TC SIM: DEVLET multi-period catalog truth closure
- Web change: Catalog-facing TR/EN summary now reflects the shipped multi-period runtime (six selectable period packs plus the 1923–2030 grand campaign) instead of describing only the historical 2002–2005 vertical slice. Historical design/handoff documents retain that milestone with explicit supersession notes.
- Content: no. Artwork: no. Audio: no.
- Gameplay/rules: no — route, game id, save V2, period/policy/event engines and all gameplay files are unchanged.
- UI/presentation: copy only; no layout or component change.
- Shared-content source: no.
- Native follow-up: no.
- Commits: `gpt/post-wave5-devlet-catalog-closure`.

### 2026-09-17 — TC SIM: DEVLET content-max (Wave 5)
- Web change: Content-only Wave 5 expansion of TC SIM: DEVLET on the frozen causal core. Authored dossier events, delayed continuations, exclusive policy-path families, cadre flavor overlays, policy prose and State Form traces. Persist in existing `devletDepth.content` (`chains` / `exclusive` / `once` / `waiting[]`). Content choices do not consume the two monthly policy slots.
- Catalog: `public/games/next-wave/devlet-content.js`. Floors met: 329 authored nodes, 107 chains, 231 delayed continuations, 12 exclusive families, 20 cadre profiles, 22 dossier traces, 77 policy-prose entries. 2002 POLICIES=48 / EVENTS=62 unchanged.
- Content: yes. Artwork: no. Audio: no.
- Gameplay/rules: no (fiscal causality, entropy recovery, crisis/form math, cadre competence, save V2 frozen).
- UI/presentation: yes — agenda dossier card, policy rationale/short/medium/long/risk lines, institution cadre flavor, period-file State Form traces. No new screens.
- Shared-content source: no.
- Native follow-up: yes (paused) — later standalone TC SIM: DEVLET should carry this catalog and overlay contract, not the website controller.
- Commits: `grok/wave5-tc-sim-devlet-max-content` (not merged to main).

### 2026-09-17 — TC SIM late-life content patch (65+)
- Web change: Mini content-only patch for TC SIM. Authored life events now continue after 65 (bands 65–69, 70–74, 75–79, 80+): retirement identity, consulting vs leaving work, adult-child money/role, housing downsize vs stay, family near vs independent, club vs home rhythm, partner pace, care, grief callbacks, independence/keys, photo-box legacy. Frozen engine stays (arcs, arrears, commute, retirement math, death/inheritance, save v6, 6-week scheduler, actor-memory core, callback context guards, dossier outcome math).
- Catalog still `public/games/tc-sim/js/life-content.js` via `flags.lifeContent`. New exclusive families `late-work` / `late-home` / `late-family` / `late-circle`. Retired players no longer receive the jobless/status-dinner callbacks.
- Content: yes. Artwork: no. Audio: no.
- Gameplay/rules: no.
- UI/presentation: no.
- Shared-content source: no.
- Native follow-up: yes (paused) — later standalone TC SIM should carry the 65+ catalog.
- Commits: `grok/wave4-tc-sim-late-life-content` (not merged to main).

### 2026-09-17 — TC SIM content-max (life events, voices, delayed chains)
- Web change: Content-only Wave 4 expansion of TC SIM. Frozen engine stays: 10 life arcs, commute/arrears/CASH_FLOOR, actor memory core, 4 delayed engine events, education-leverage once-per-life, goals/opportunities, Life Dossier outcome math, save v6 keys `tlab-tc-sim-slot-1..3`.
- Catalog in `public/games/tc-sim/js/life-content.js`: 128 authored nodes, 49 multi-stage chains, 12 exclusive families, 18 auto delayed callbacks, 7 actor voices, 12 dossier trace templates. Persist via existing `flags.lifeContent` (`chains` / `exclusive` / `once` / `waiting[]`). Content delayed callbacks do not occupy `lifeDepth.pendingEffects`.
- Content: yes. Artwork: no. Audio: no.
- Gameplay/rules: no (arc math, arrears conversion, commute zones, dossier outcomes unchanged).
- UI/presentation: yes — people list/detail voice lines and help “Risk ve sonuçlar” copy only; no new screens.
- Shared-content source: no.
- Native follow-up: yes (paused) — later standalone TC SIM should carry this catalog and voice overlay, not the website controller.
- Commits: `grok/wave4-tc-sim-max-content` (not merged to main).

### 2026-09-15 — Kayıp Telefon content-max (trace + footprint buffer)
- Web change: Catalog buffer on the Wave 3 Kayıp Telefon content-max (extra notes/photos/contradiction pieces) plus bilingual contact `relation` pairs and actor/mislead rows in the existing `caseReport.traces` cap.
- Content: yes. Artwork: no. Audio: no.
- Gameplay/rules: no.
- UI/presentation: yes — contact relation now pair-renders; report traces prioritize ending/decision/privacy.
- Shared-content source: no.
- Native follow-up: yes (paused) — later standalone Kayıp Telefon should carry the buffered catalog and trace contract.
- Commits: `grok/wave3-kayip-telefon-max-content` (not merged to main).

### 2026-09-15 — Kayıp Telefon content-max
- Web change: Content-only Wave 3 expansion of Kayıp Telefon. Deduction engine, 5 critical facts, theory/confidence math, 5 endings, intimate-file list, restrained 72-pressure solve, save keys `tariklab.nextwave.kayip-telefon.slotN` and V2 schema are unchanged.
- Digital footprint: 80+ message pieces (thread overlays, not save-copied), 30+ notes/drafts, 20+ photo/media metadata items, calls/calendar/files/voice density, 9 distinct contact voices, 5 side-secret mini-threads with extra routes, exclusive siblings and seed-sensitive flavor text.
- Content: yes. Artwork: no. Audio: no.
- Gameplay/rules: no (ending priority, privacyPressure, ownerRisk, INTIMATE list frozen).
- UI/presentation: yes — found-phone chrome polish only (contact cards, photo meta, note drafts, report traces); no redesign, no iOS/WhatsApp clone.
- Shared-content source: no.
- Native follow-up: yes (paused) — later standalone Kayıp Telefon should carry this catalog and overlay contract, not the website controller.
- Commits: `grok/wave3-kayip-telefon-max-content` (not merged to main).

### 2026-09-15 — SON 100 GÜN + SON KÖY MANAGER content-max
- Web change: Content-only Wave 2 expansion of Son 100 Gün and the Son Kasaba rename to **SON KÖY MANAGER**. Engines, save keys, 2-action/day, 5-phase math, crisis formula, 3-decision/month, 24-month campaign, 8 cohorts, 6 institution modifiers, 7 investor grant/control numbers and 7 ending conditions are unchanged.
- Son 100 Gün: +80 authored events, 22 mini-arcs, 34 delayed callbacks, actor-memory and preparation-sensitive follow-ups, exclusive branches, dossier traces. Content flags in existing `flags.sonArcs`. Phase/forecast/preparation/crisis/dossier visual polish only.
- SON KÖY MANAGER: user-facing rename; canonical route `/oyna/son-koy-manager`; `/oyna/son-kasaba` remains an alias. Save id stays `son-kasaba`. 12 NPC bibles, 9 group voices, 7 investor voices, 24 chains / 105 extra nodes, Anadolu toprak/kiremit manager chrome. Content flags in existing `flags.townArcs`.
- Content: yes. Artwork: no. Audio: no.
- Gameplay/rules: no.
- UI/presentation: yes — theme polish and manager chrome only; no redesign.
- Shared-content source: no.
- Native follow-up: yes (paused) — later standalone titles should carry these catalogs, village identity and the route alias, not the website controller.
- Commits: `grok/wave2-max-content-son-koy-manager` (not merged to main).

### 2026-09-15 — Racon Manager + Apartman content-max (narrative chains)
- Web change: Content-only expansion of Racon Manager and Apartman on the existing Depth Framework. No engine rewrite, no save-schema change, no election/recovery/proposal math change. New authored NPC/household bibles, multi-stage event chains, delayed callbacks, exclusive branches and identity/politics-sensitive copy. Chain state persists in existing `flags.chains` / `flags.chainFlags` and `depth.delayedEffects`.
- Racon Manager: 16 NPC bibles; 24 chains / 96 nodes; identity-toned copy on 21 nodes; 12 mutually exclusive chains; delayed chain-echo callbacks; crew memory only (people memories still stripped on load). UI: existing olaylar list now renders chain choice buttons (`data-act="chain-choice"`). Catalog lives in `public/games/racon/content.js`.
- Apartman: all 16 catalog households deepened (14 in-game); 24 chains / 95 unique nodes; late-game 4th stages; 8 exclusive chains; resident↔resident relations; macro/election-gated nodes. Unresolved `activeEvent` auto-bekles on week close so long runs cannot soft-lock. UI: small `.apt-event` continuation card only.
- Content: yes. Artwork: no. Audio: no.
- Gameplay/rules: no (vote retain ≥42, recovery fail <38, proposalCounts −0.15/week, identity scores from job orders only).
- UI/presentation: yes — continuation labels/memory hints only; no redesign.
- Shared-content source: no.
- Native follow-up: yes (paused) — later standalone Racon/Apartman titles should carry these chains and household/NPC bibles, not the website controller.
- Commits: `grok/racon-apartman-content-max` (not merged to main).

### 2026-09-14 — Depth Framework wave 1: Racon Manager + Apartman
- Web change: Incremental systemic-depth pass limited to Racon Manager and Apartman. A small shared depth primitive supplies durable actor memory, delayed-effect settlement, event cooldowns and risk bands without replacing either game's controller or visual identity.
- Racon Manager: job orders now build a saved Racon identity, write memories to participating crew, schedule causal callbacks and show finance/police/crew risk before critical orders. End-of-run output includes a concrete loss cause and recent decision trail.
- Apartman: v2 normalization adds durable resident profiles/memories/relations, confidence, opposition/alliances, delayed proposal consequences, cooldown-backed issue selection, building phases, periodic confidence votes with a recovery window, transparent danger warnings and causal run history. New games use fourteen persistent households; legacy sixteen-resident saves remain intact.
- Content: yes (short causal callback and warning copy only). Artwork: no. Audio: no.
- Gameplay/rules: yes — identity/memory/delayed consequences in Racon; resident politics, confidence election and macro building progression in Apartman.
- UI/presentation: yes — risk previews, confidence/politics state, warnings and history summaries; existing responsive structures retained.
- Save: Apartman schema normalizes v1→v2 in place and now keeps a valid per-slot backup. Racon keeps `racon_v1` and fills the optional depth fields during its existing migration.
- Shared-content source: no (no authored card/art bundle changed).
- Native follow-up: yes (paused) — standalone versions should later reproduce the causal/memory contract, not share the website controller.
- Commits: ships with the first-wave depth implementation commit.

### 2026-09-12 — VETO-H! + portal
- Web change: Approved 300 Astra card illustrations (576×384 WebP) and prism/spectrum portal background
- Content: no (authored cards unchanged)
- Artwork: yes
- Gameplay/rules: no
- UI/presentation: yes (prism cover crop; card art `object-fit: cover`)
- Shared-content source: yes (`tayaz-maker/tariklab-content` created)
- Native follow-up: already done (`tariklab-app` tag `veto-h-native-pilot`). Native paused after this.
- Commits: web `8355384` / merge `7eec58f`; content `d6fa1d6`; app `dc610c4`

### 2026-09-13 — VETO-H! + GETT-OH! mega refinement
- Web change: Humanized TR/EN card copy (IDs/mechanics unchanged); 5 AI profiles; match action history; post-match analysis + OP graph; inspector related cards; VETO-H! campaign styles + election-night result + campaign file; GETT-OH! neighborhood identity; drag/drop with tap fallback; hover/dblclick/long-press inspector; valid-target glow; rejection copy; keyboard 1–5/Esc/Space/I/H/A; UI scale / card size / table density
- Content: yes (TR/EN display copy)
- Artwork: no
- Gameplay/rules: no (AI weights only; identities cosmetic)
- UI/presentation: yes
- Shared-content source: yes (`tariklab-content` VETO-H! authored fields + new GETT-OH! `games/gett-oh/cards.json`)
- Native follow-up: yes (paused) — later standalone titles need: humanized names/copy, AI personalities, telemetry/history, post-match analysis, card relationships, campaign styles, election-night result, campaign history, neighborhood identity, drag/drop, inspector gestures, target glow, rejection explanations, keyboard/mobile controls, UI scale, card size, table density, resolution/windowed/fullscreen
- Commits: web `509cc29` (copy) `4deb0c9` (AI/telemetry) `57edb79` (UX) `0029894` (tests/ledger); content `672bf82`; app untouched (`dc610c4`)

### 2026-09-12 — VETO-H! + GETT-OH! web design refoundation
- Web change: Shared `design.css` token contract for readable typography, spacing, card dimensions, controls, modal/inspector widths and density. Legacy chrome is loaded in a lower-priority CSS layer. VETO-H! uses cream/gold and institutional slate; GETT-OH! uses amber/tobacco/deep green.
- Setup: fixed DOM boolean handling for `aria-pressed` (previously emitted an empty attribute); selected chips now expose true/false, check marks, contrast and keyboard focus. Two-column desktop/single-column mobile setup, scrollable body, separate visible footer, focus/scroll retained on selection. Existing saved profile/campaign/neighborhood values feed the match; live AI uses the captured match profile. Cosmetic campaign/neighborhood identities remain cosmetic and are shown beside the hand.
- Inspector/history/settings: one card-name title, larger art and natural text wrapping; internally scrolling detail and mobile sheet; turn-grouped public flow with actor distinction, collapsible desktop rail/mobile dialog; labeled scale/card/density controls and display reset. Typed localized-text and numeric-stat fallbacks avoid rendering missing values as objects/null/undefined.
- Responsive: 1440/1280/1024/768/390 widths; table, hand and commands occupy separate rows so controls never cover the hand. Constrained screens scroll the table internally instead of shrinking body typography. UI scale 80/90/100/110/125 keeps text floors; card size and density persist.
- Content: yes (AI profile and cosmetic campaign/neighborhood TR/EN descriptions only; no card copy changed)
- Artwork: no
- Gameplay/rules: no (AI weights, engine, telemetry model, post-match calculations and save schema unchanged)
- UI/presentation: yes
- Shared-content source: no (no authored card/art source changes)
- Native follow-up: yes, later standalone parity for this token system, setup semantics, modal/footer, inspector, history, settings and responsive layout. Native/Godot remains paused; `tariklab-app` untouched.
- Commits: `astra/web-duel-design-refoundation` (this entry ships with the implementation commit).

### 2026-09-12 — Restore visible gameplay flow
- Oyun Akışı now opens by default as the left rail at desktop widths of 1024px and above. The table stays centered and Card Inspector remains on the right. The existing button toggles the rail; smaller screens retain the flow dialog. Both web duel themes share this fix.
- UI only; no rules, cards, artwork, audio, save schema or native changes. Future standalone parity remains pending.

### 2026-09-13 — Deck presets, repaired setup, combos and catalog-wide how-to-play
- Web change: The five VETO-H! campaign styles and GETT-OH! neighbourhoods become **real 40-card deck presets** frozen in `public/games/<theme>/decks.json` (schema v1) instead of cosmetic labels; the chosen preset is exactly what is dealt, with the match seed controlling order only. Setup is a three-step wizard (deck → opponent style → summary) rendered in place, so a selection can no longer look like a dead click. Deck contents are inspectable before the match and from a new DESTELER tab in the Card Archive. Card relationships carry a derived mechanical reason (arar / çağırır / güçlendirir / korur / tetikler / malzeme olur / aynı seri) and a pair with no derivable reason is not shown, replacing the generic "Bu kartla iyi çalışır".
- How to play: every live catalog game's teaching surface rewritten to the same beginner structure (goal, screen, loop, actions, win/loss, controls, example, common mistakes). VETO-H! and GETT-OH! get a twelve-section bilingual guide. Apartman, Son 100 Gün, Kayıp Telefon, Son Kasaba and TC SIM: DEVLET move to structured sections shared by the front menu and in-game panel; Satranç, Amiral Battı, Labirent and Tek Taş gain goal/loop/win-loss/mistake sections. Racon, Bükücü, Hanedan and TC SIM already met the standard.
- Content: yes. SND-066 / SND-080 (the source's reprints of SND-065 / SND-079) now show their own names while keeping one shared rules identity; four overlong English names shortened; RCN-091..150 rewritten from import shorthand into Turkish sentences; six cards had English rules terms removed from Turkish text.
- Artwork: no.
- Gameplay/rules: two engine fixes. A material-free special summon (`fourGraveUnits` / `revealHandUnit`) stayed legal on a full unit field and resolved into nothing, letting the AI repeat it forever — a reproducible hang. Copy limits and name locks now key off a rules identity rather than the display name, preserving the reprint pairs' shared limit exactly. Save schema unchanged; card stats, effects, traits and costs unchanged.
- UI/presentation: yes. VETO-H! charcoal-slate/cream/gold/institutional-blue and GETT-OH! deep-green/amber/tobacco palettes (colour tokens only). On phones the action dock sticks to the bottom with its own scroll so turn actions cannot fall below the fold.
- Shared-content source: yes — `tariklab-content` needs `games/veto-h/decks.json`, `games/gett-oh/decks.json` and the renamed/rewritten card copy above.
- Native follow-up: yes (paused). Later standalone titles need: deck presets as canonical content, the three-step setup, deck browser, reasoned combo block, the rewritten how-to-play for every title, and the two engine fixes.
- Commits: web `7988ebf` (decks/setup/combos) `bf2641d` (card content) `3388ad2` (how-to-play) `5dd9805` (theme/mobile/gate); app untouched.

### 2026-09-13 — Duel parity, full board, navigation and hand-card hotfix
- Web change: targeted repair of six reported defects in the two duel games. No new features, no redesign of the Astra layout, deck system, how-to-play, AI personalities or card content.
- **Human/AI rule parity**: the engine was already symmetric — both seats issue actions through the same `legalActions` → `dispatch` → `rejection` path, and nothing lets either side exceed one Normal Summon/Set per turn (two with a card granting `extraNormalMaxLevel`). Support sets have never been capped per turn for either seat. What looked like the opponent playing three cards in one turn was the **action history grouping only by turn**, so a legal sequence spread across Hazırlık / Hamle 1 / Hamle 2 read as one moment. The acting phase is now recorded on each event and shown in the flow, and How to Play states the rule in both languages. A new `scripts/duel-parity.test.mjs` proves the symmetry over 500+ matches across every AI profile and preset.
- **Complete board**: the duel table no longer scrolls internally. Opponent half, phase divider and player half are one board box at every viewport (1440/1280/1024/768/390/320), with the hand below it and the turn controls below that. Card sizes are unchanged — the room came from removing the internal scroll and tightening the board's own padding, not from shrinking anything.
- **Turn controls**: the action dock returns to normal document flow. Both pinned variants were tried and both failed — a sticky or fixed dock sits on the viewport floor and covers the hand by up to 90px however much space the column reserves beneath it. The button group is now centred in the gameplay column (0px skew at all twelve viewport/theme combinations).
- **Card Detail**: not reproducible on the current build (1,200 rendered details across both themes and languages scanned clean), but the guards are now permanent. `public/games/duel-core/render-safe.js` refuses to render nullish, non-finite, object or empty-array values as text while always keeping `0`, and the browser gate fails on any `null`/`undefined`/`NaN`/`[object Object]` reaching the screen.
- **Hand cards**: interior type scale down 1.5px (title 15→13.5px, type tag and stats 13→11.5px) with a clearer title → artwork → type → stats hierarchy, a two-line title clamp and tabular stat figures. Outer card size, artwork and information are byte-identical — the hand row measures the same 203px desktop / 185px mobile as before.
- **Navigation**: `Geri`, `Kapat` and `Ana Menü` now mean three different things everywhere. `Kapat` dismisses only the layer on screen and leaves the screen beneath it — and a half-finished duel setup — exactly as it was; reopening the wizard resumes on the step it was left on. `Geri` steps one level up and appears wherever a layer was opened from another layer. `Ana Menü` is the only control that jumps to the root. Escape follows `Geri` when there is a level above and closes the layer only when there is not. Every playable game now ships a visible way out of itself: `← Oyunlar` added to Hanedan, Labirent, Tek Taş, Satranç, Racon, TC SIM and TC SIM: DEVLET, plus an in-game `Ana Menü` for Hanedan and TC SIM (which saves before returning, so it can never lose a run).
- Content: no.
- Artwork: no.
- Gameplay/rules: no. The engine, AI weights, card stats, effects, deck presets, telemetry scoring and save schema are unchanged; the only engine-adjacent change is recording which phase an event happened in.
- UI/presentation: yes.
- Shared-content source: no.
- Native follow-up: yes (paused). Later standalone titles need the complete two-sided board, the three-way navigation semantics, the hand-card interior scale and the phase-aware action history.

### 2026-09-14 — Inspector null root cause, specific unavailable-action reasons, panel typography
- Web change: targeted hotfix to the VETO-H! / GETT-OH! `Kart Ayrıntısı` panel only. The gameplay screen is treated as locked from this pass: board proportions, hand-card outer layout, action dock placement, inspector width, page chrome, theme colours and overall spacing are untouched.
- **Null root cause (found, not guarded around).** `inspectBody` returns an array carrying a `null` in every slot an optional field does not fill. `$` has always dropped those, but the hover preview (`previewInspect`, fired after a 280ms dwell) passed that array straight to `replaceChildren`, which stringifies whatever it is handed — one literal `null` per empty slot, hence `nullnullnull…`. Only the hover path was affected, which is why click-driven passes reported the panel clean. Both insertion paths now share one `renderable()` filter, and a test asserts no call site spreads a nullable array into `replaceChildren` again.
- **Unavailable-action reasons.** New `public/games/duel-core/explain.js` turns an engine rejection code plus the live state into a specific sentence: which phase you are in and which would work, how many zones are actually free, the level-to-tribute count, the cost against the points held, turn one versus the wrong phase. Every sentence is derived from the rule in `rules.js` that produced the code; where the live state gives no specific answer the existing generic copy is returned unchanged rather than a guess. Each blocked action renders as a pair — the action's own name, worded as its enabled button would word it, then the reason — and when several actions share one blocker (usually the phase) it is stated once instead of repeated.
- **Panel typography.** Scoped to the inspector: body 16→15px, secondary 14→13px, meta 13→12px. Secondary copy inside the panel had been set to body size, which is what made the rail read as a wall; it now uses the secondary token. Hand cards, the board and the Oyun Akışı rail are untouched.
- Content: no. Artwork: no. Gameplay/rules: no — the engine, legality, AI, telemetry and save schema are unchanged; `explain.js` only reads state to word an existing rejection.
- UI/presentation: yes (inspector panel only).
- Shared-content source: no.
- Native follow-up: yes (paused). Later standalone titles need the `renderable()` child filter and the specific unavailable-action reasons.

### 2026-09-14 — Action economy, deck balance, AI fairness, match clarity and atmosphere
- Web change: the gameplay-quality pass for VETO-H! and GETT-OH!. The approved gameplay layout is unchanged — board proportions, hand placement, action dock, inspector width, rails, responsive architecture and menu structure are all as they were. Everything below is rules, content, copy or colour.
- **Action economy (the "AI plays three cards" report).** Re-traced from real matches rather than trusting the earlier "history display only" conclusion, which was incomplete. Turn one averaged five card plays and could fill all five unit zones before the opponent had moved, because only the Normal Summon had a per-turn limit — special summons and support sets had none. Two new limits, worded like the existing one and enforced by the same validator for both seats: **one Special Summon per turn** and **at most two support Sets per turn**. Traced after: specials per seat-turn max 1 (was 3), support sets max 2 (was 5), units on board after turn one 1.99 avg / 2 max (was 2.75 / 5), turn-one card plays 3.52 (was 5.05). Match length was unaffected.
- **Fairness.** `legalActions` exempted special summons from the shared validator (`action.type === "special" || !rejection(...)`), so the action list and the validator could disagree and any rule added to the validator did not reach specials. Every candidate now goes through `rejection()`. Parity tests cover both new caps per seat, and that no offered action is refused by the validator.
- **Deck balance.** All ten presets audited and rebalanced with existing cards only. VETO-H! ran 30–75% and GETT-OH! 25–77.5%; over 2400 simulated matches they now run 42.9–56.7% and 45.4–58.3%, first seat 51.2% and 50.1%, with zero illegal actions, invalid states, NaN, loops or deck-outs. Opening hands were never the problem (4.2–5 playable of five); the lists were. No cards added, no preset renamed, identities intact.
- **AI.** The `patient` profile lost to a random-move opponent (22.5%) because its attack gate wanted a 3000 ATK advantage that the scoring formula cannot produce. Retuned to its stated intent; it now wins 92.5% against random and remains the slower profile. All five profiles beat random play and stay distinct.
- **Match clarity.** Anything that was not a battle, draw, move or phase fell through to a bare "Rakip: Etki". `flow-copy.js` words every event as who did what and what it meant, reading the `reason` the engine already recorded on each move, so destroyed, banished, negated, stolen and tributed cards are all explained. Real matches now run with zero unexplained lines.
- **Onboarding.** A six-step first-duel guide anchored to the existing board, shown once, skippable, replayable from the top of How to Play. It never covers or blocks the controls.
- **Card copy.** 67 VETO-H! and 96 GETT-OH! cards re-worded into each game's own vocabulary: engine shorthand removed, and the graveyard finally called Atılan Kartlar / Iskarta as the interface has always labelled it. Wording only.
- **Colour.** Category stripes, stat-strip tint, zone tints, phase underline and a soft table centre light per theme. Measuring contrast caught a bug shipped in the previous pass: hand-card level and type text was `--muted` on the pale card face at 1.46:1, now 17.2:1 and 14.5:1.
- Content: yes (card wording and preset membership). Artwork: no. Audio: no.
- Gameplay/rules: **yes** — two new per-turn limits, applied identically to both seats. Save schema unchanged; older saves read the new counters as zero.
- UI/presentation: yes (flow copy, onboarding, colour).
- Shared-content source: yes — `tariklab-content` branch `opus/gameplay-balance-clarity`, commit `70ab4f3`, carrying both games' `decks.json` and card text. Parity verified in both directions.
- Native follow-up: yes (paused). Later standalone titles need the two per-turn limits and the validator-authoritative action list, the rebalanced preset lists, the flow narration with move reasons, the first-duel guide, the `patient` retune, and the card vocabulary.

### 2026-09-18 — DARBE-H! Repair II: T1 hand-fusion opening bomb closed, sibling defect surfaced
- Web change: DARBE-H! only. Root-caused the balance regression the prior repair's own verification found (Karargâh a replacement crown at 62.5%, İstişare a replacement dead deck, first-mover regressed to 61.8%) instead of tuning decks around it.
- **Root cause.** The shared engine's fusion-material selector defaults to `zones: ["hand", "units"]` when a card's `traits.materials` does not say otherwise (`public/games/duel-core/summoning.js`). DARBE-H!'s six expansion boss fusions (DRB-235..240) never overrode it, so a player could special-summon a 2300-2800 ATK body on turn one straight out of the opening hand for a paraf fee alone — zero board investment, zero tempo cost.
- **Fix, scoped narrowly.** Only DRB-235..240 (`scripts/build-darbe-h-cards.py`) now declare `zones: ["units"]`: their materials must already be standing on the field. Bilingual text updated to say so (TR "sahadaki", EN "on the field"). Core DRB-068..073 — the first-150 freeze — were not touched and remain byte-equivalent to the parent commit.
- **Result, independently measured over 3000 mirrored matches:** deck rate spread 26.2pt → 9.8pt, every matchup cell inside 35-66% (no hard lock, no dead deck), first-mover rate 61.8% → 59.5%, opening delta 23.6pt → 18.9pt. `scripts/darbe-h-balance-closure.test.mjs` (env-gated, `DARBE_H_CLOSURE=1`) holds this to tight bands as a repeatable gate; `scripts/darbe-h-balance.test.mjs` runs a fast 250-match version of the same gate in ordinary `npm test`.
- **No deck-list tuning applied.** Four independent samples at four sample sizes all land inside tight bands from the fix alone; cutting cards from an already-healthy deck would be tuning against sampling noise, not fixing a defect.
- **Sibling A/B (mandatory before any further DARBE tuning), instructive finding for a future pass:** the same turn-1 hand-fusion pattern is not DARBE-specific — it is the shared engine's own default. GETT-OH! hand-fuses on turn one in 858/1000 sampled matches and VETO-H! in 109/1000, both far more often than DARBE-H! ever did, yet their first-mover/opening-delta numbers are lower than DARBE-H!'s residual. VETO-H!, GETT-OH! and the shared engine are unchanged in this pass — this is recorded as a master-freeze observation, not acted on here.
- New instrumentation, reusable for any duel-core theme: `scripts/darbe-h-sim.mjs` (`playMatch`, `runMatrix`, `summarize`, `openingDelta`, `deckConcentration`, `assertHealthyMeta`), `scripts/darbe-h-diagnose.mjs` (Stage A/B/C/sibling CLI), `scripts/darbe-h-instrument.test.mjs` (harness self-tests).
- Content: no (six cards' cost wording only). Artwork: no. Gameplay/rules: yes — a DARBE-H!-only material-zone restriction on six cards; shared engine, VETO-H!, GETT-OH! and every other game untouched.
- UI/presentation: no.
- Shared-content source: no.
- Native follow-up: yes (paused). The material-zone default and its sibling exposure belong in the native port's own review; do not port the DARBE-only override as if it were a shared-engine fix.

### 2026-09-19 — Master Freeze Check before Astra: repo-truth audit, no code change
- Web change: none. Repo-wide audit only — see `docs/MASTER_FREEZE_CHECK.md` for the full record.
- **Inventory:** all 18 catalog games (`src/lib/games.ts`) reconciled against routes, sitemap, SW cache, credits.html and production; no orphan/stale/duplicate surface found. Hayat confirmed retired with no accidental exposure. SON KÖY MANAGER canonical/legacy dual-route confirmed working end-to-end in-browser. TC SIM: DEVLET's 1923–2030 scope confirmed current; the only "2002–2005" text left in the repo is a design doc that already labels itself historical.
- **Racon Manager:** the 2026-09-04 `RACON_MANAGER_AUDIT.md`'s critical findings (inconsistent cash ledger, two unlimited-money/reputation exploits, silent save corruption, residual football-manager structure) are all covered by current, passing regression tests (`racon-final.test.mjs`, `racon-apartman-content.test.mjs`) shipped in a later, undocumented-in-the-ledger pass — reconciled here rather than re-fixed.
- **Shared duel-core fusion classification (mandatory audit, not a fix):** independently root-caused GETT-OH!'s ~84–86% T1 hand-fusion rate to a single card, RCN-083, whose material spec (`{"count":2,"differentSeries":true}`) is a generic any-two-cards requirement unlike every other core fusion card in any of the three sibling themes (all of which require two *specific named* series). A 500-match attribution run attributes ~83% of T1-fusion plays in T1-fusion matches to that one card. Classified **B — measurable issue for Astra's six-gated high-protection repair**, not intentional identity, not a technical blocker, not fixed in this pass. DARBE-H!'s verified balance and the shared engine were not touched.
- **İHTİLAL:** diagnosed only, not reworked. 1,296-match balance matrix (existing test, re-read not re-run-differently) shows all six archetypes inside the enforced 40–60% band with Nöbetçi (57.2%) and Heyetçi (44.8%) at the edges — flagged for Astra's tier-2 balance pass. Live playthrough found a legible archive-styled UI, clean rendering, and an already-strong rock-paper-scissors archetype identity worth preserving.
- **Tests/build:** full `npm test` green (1,307/1,308 pass, 1 intentionally env-gated skip), typecheck clean, lint 0 errors, build succeeds, `git diff --check` clean.
- **Browser/production:** all 18 live surfaces smoke-tested (desktop+mobile, iframe-content level); production HTTP and deployed catalog bundle reconciled against current main.
- Content: no. Artwork: no. Gameplay/rules: no. UI/presentation: no. Shared-content source: no.
- Native follow-up: no code shipped this pass; the GETT-OH! RCN-083 finding and the İHTİLAL balance-edge finding are both handed to Astra, not the native track.

### 2026-09-19 — Post-launch: PWA precache and İHTİLAL interaction repairs
- Baseline: `e091644e70f5d257adb96591d0690d065416b701`; branch `astra/post-launch-upgrade-sweep`. Evidence and retained limitations: [POST_LAUNCH_UPGRADE_SWEEP.md](POST_LAUNCH_UPGRADE_SWEEP.md).
- Web change: restore generated JS/CSS precache injection with an explicit build contract; retain the current static shell, cache name and network-first module policy. Production acceptance compares the emitted SW with the build output.
- İHTİLAL: cancel stale AI callbacks on menu/new/load; modal keyboard containment, Escape and focus return; card/archetype focus preservation; screen-entry scroll reset; narrow mobile label/header repairs; visible terminal save/quota status in existing TR/EN copy.
- Dependency: js-yaml 4.3.1→4.3.2, surgical lock-only advisory patch.
- Content: no. Artwork: no. Audio: no. Gameplay/rules/balance: no. AI decision policy: no. Save schema and namespaces: unchanged.
- UI/presentation: yes. Shared-content source: no.
- Native follow-up: paused. Future standalone İHTİLAL should preserve session-scoped AI work, accessible modal focus, and save-result feedback. No native repository was changed.

### 2026-09-19 — HANEDANIAN identity and canonical catalog route
- Baseline: `9e747ebf6de55cfb0eb526d0c56b63e4320259cf`; branch `astra/hanedanian-ihtilal-upgrade`. The current production/main baseline is newer than the original mandate's `e091644…`; its PWA and İHTİLAL lifecycle repairs are retained.
- Web change: rename the current catalog entry to **HANEDANIAN**, canonical slug `hanedanian`, route `/oyna/hanedanian`. Existing `/oyna/hanedan` canonicalizes to the same title and iframe through the play-route alias; the catalog still contains one entry for this game and 18 live games overall.
- Discovery and copy: TR/EN portal catalog, credits, sitemap and current documentation index point to the new identity and its strategy-map premise. Credits now correctly distinguish the new game’s Turkish-only runtime from the bilingual portal and other games, and its auto/previous/manual archive from numbered independent campaign slots. Frozen historical records and unrelated authored content are not rewritten.
- Artwork: retain the existing original crown/dynasty portal icon under the internal `hanedan` icon key. The site-wide TarikLab brand, OG cards and favicon are unchanged. Audio remains disabled.
- Save namespaces: no other game's key or slot data is renamed by this catalog change. The new game and legacy compatibility are documented in [hanedan/README.md](hanedan/README.md).
- Compatibility: the shared and React English catalog dictionaries retain `hanedan` as an alias of the current `hanedanian` translation, so cached callers do not revive stale branding. The i18n coverage gate now reads every current catalog slug instead of a frozen partial list, with a separate exercised legacy-alias translation check.
- Verification for this surface: 42 docs/catalog/go-live/credits/i18n/sitewide checks pass; direct execution of the catalog resolver confirms both old/new names select the same unique entry and the SON KÖY MANAGER alias is unaffected. Whole-game/browser/offline acceptance is recorded in the upgrade's release report rather than inferred from catalog tests.
- Shared-content source: no shared artwork or content bundle changed in this pass. Native follow-up: paused; any future standalone build should use HANEDANIAN as its product identity and retain the explicitly documented legacy access path.

### 2026-09-19 — HANEDANIAN strategy runtime and İHTİLAL decision flow candidate
- Web/gameplay: independent HANEDANIAN world, economy, settlement/army/scout/AI/trade/diplomacy/campaign modules replace the active old runtime. Original HANEDAN and save keys remain in the explicit legacy route. New art is procedural canvas/SVG; no borrowed game assets or new dependencies, audio stays disabled.
- Persistence/offline: new IndexedDB auto/previous/manual archive and validated checksum envelope, export/import, journal recovery and stale-write protection; dedicated complete-package worker versioned from build content. No cloud save or cross-origin automatic transfer.
- İHTİLAL: clear role/goal/legal-action/result, engine-derived preview, delayed queue, automatic continuation; legal-counter filtering and post-counter victory resolution repair the engine. Existing card values, AI policy, manual save schema and slots remain. User explicitly permits further engine redesign if real usability evidence requires it.
- Validation: full suite 1,415 passed, 0 failed, one existing opt-in skip; typecheck/build passed, lint zero errors. Vercel preview READY. Actual browser/mobile/offline acceptance is blocked, campaign duration is below target, and production is not changed. See [release candidate QA](hanedanian/RELEASE_CANDIDATE_QA.md) for evidence and remaining gates.
- Shared-content source: no. Other games' mechanics: unchanged. Native follow-up: paused; future ports need the new deterministic simulation and save/worker contract, and must retain old-save access rather than falsely converting campaign models.

## Release candidate campaign pacing and acceptance gates (in progress)

- Continue PR #33 on `astra/hanedanian-ihtilal-upgrade`, starting at `9a5b2550a96438e4efe306c7335e887bbd3fb123`; production/main baseline `9e747ebf6de55cfb0eb526d0c56b63e4320259cf`.
- Replace stockpile-only victory with six developed regions, settlement specialization, consumed local investments and real cross-region supply, followed by route-specific regional finale. Building timers and 12× remain unchanged. Optional campaign metadata preserves existing v1 saves.
- Standing supply orders use ordinary caravans, ownership, capacity and travel rules; demobilization allows upkeep reduction after major wars. No free production or instant logistics.
- Add deterministic campaign probes and dedicated Chromium acceptance jobs, including native touch and genuine service-worker/IndexedDB offline reload. Results are pending; these changes are NOT release approval.
- Native/Godot remains paused. No shared art or audio changes.

## Release-candidate verification progress

- All 60 legal campaign probes completed all three routes; 60 adversarial policy
  probes produced no victory. Earliest normal victory is minute 39,000 (10.83h at
  1×); AI stayed within seven settlements and all resources remained finite.
- Chromium verified both desktop sizes and 360×800 touch gameplay through actual
  founding expeditions and save/continue, with no console errors or horizontal
  overflow. İHTİLAL first action, persistent effect feedback and match conclusion
  passed on desktop/mobile; screenshots reviewed. Engine redesign unnecessary.
- Fixed a real manual-save/close race that could reopen the menu after dismissal.
  Offline, twenty-minute mobile soak and final production validation remain gates
  until their dedicated CI runs complete. Latest public main is still baseline.

## P1 regression found during candidate closure

Latest full Chromium regression exposed a 320px VETO-H board briefly widening to
570px during card travel and viewport resize. The design stylesheet overrode the
motion containment from `table.css` with `overflow: visible`. Restore horizontal
clipping on the table workspace while retaining vertical depth and the hand's own
scroll area. Existing overflow assertions remain unchanged; full duel/sitewide
Chromium must pass before integration.
## 2026-09-19 — HANEDANIAN production presentation pass

- The shared `/oyna/:slug` HTML-game chrome is reduced from 44px to a 36px command strip for every catalog game; mobile keeps only the back affordance and language control visible.
- HANEDANIAN now uses a compact command HUD, a contextual three-step first-run guide, clearer tile decision framing, and a richer procedural atlas treatment without adding image payloads.
- Simulation, campaign balance, saves and audio policy are unchanged. Web-only presentation work; no native parity action is required.
# 2026-09-20 — Global interactive-language + TR/EN closure

- Audited the 18-game production catalog, portal and Resources against the shared identity → importance → forecast → causal result → next-decision contract.
- Added a presentation-only HANEDANIAN EN layer that reacts to the outer shell language without writing save state, consuming RNG or revealing unscouted information.
- Replaced retired action-cap and single-building descriptions with the current focus/capacity/effort/site-management mechanics.
- Added one data-driven decision brief to the shared duel inspector for VETO-H!, GETT-OH! and DARBE-H!; card rules remain the source of truth.
- Preserved the sealed JITEM teaser and the bilingual personal attribution note.

### 2026-09-22 — Ultimate visual candidate
- Web change: continuous shaded HANEDANIAN material field, traced ridge belts and dark noble chrome; DARBE original noir WebP scene plates in existing SVG transports and larger art in hand/archive/detail.
- Content: no
- Artwork: yes (60 original DARBE scenes, 300 editions)
- Gameplay/rules: no
- UI/presentation: yes
- Shared-content source: no
- Native follow-up: yes (paused); carry visual architecture when native resumes.
- Commits: astra/hanedanian-darbe-ultimate-visual (candidate; not merged)

### 2026-09-26 — HANEDANIAN living atlas and point logistics
- Web: original zoom-aware procedural capital/town/fortification/POI miniatures; atlas-baked road, river and crossing relief; separate live ownership and observed/unobserved route cues.
- Gameplay: owned points can transfer between towns via a paid courier; source contribution persists until arrival, transfer legality is rechecked and cancelled couriers refund on return. Claim capacity reserves pending slots.
- Reliability: diplomacy-aware threats; correct founder production forecast; accessible SVG/DOM directory with the same tile/order flow; safe Pixi context-loss fallback and renderer cleanup.
- Save/schema: HANEDANIAN schema 1 and storage keys retained; optional courier fields validated; old campaign and pending-order saves remain readable.
- Assets: original code geometry only (A023); no new runtime dependencies or sound. Shared native content unchanged; native remains paused.
- Proof and release owner: docs/ASTRA_ULTRA_RUN_STATE.md and this checkpoint's PR handoff.
### 2026-09-30 — mobile DEVLET release unblocker (#103)
- Measured CI wide-to-narrow Regions failure: closed save details; visible Pixi overlay at x=23, width=320, right=343. TR and EN reproduce; open panel itself fits the viewport.
- Overlay now clamps to the remaining viewport width. Shared save panel stays below the real header, preserving the summary close target and scrollable content; old keys/schema and rules unchanged.
- Chromium TR/EN × 320/360/390: immediate resize, panel open/close, save/reload and Regions→Foreign→Regions PASS; 1,510 full site responsive checks PASS. Targeted tests 18/18; build/typecheck PASS, lint 0 errors/58 baseline warnings. Node 22 full run: 1,554 pass / 2 fail / 1 skip; failures were the DOM-less save fixture and authorized runtime UI hash. Narrow follow-up fixes both (11/11 relevant tests); full CI rerun required.
- Web-only UI/lifecycle fix; native paused. Production proof follows green protected CI.

### 2026-09-30 — ordered CI release integration (#101)
- #103 passed every protected job on fffc2b34 and merged as fc21dc91. TR/EN at 320/360/390 on both www.tariklab.com and tariklab.tayaz29.workers.dev passed real save/reload, panel close, immediate resize and Regions/Foreign transitions.
- Updated #101 on that exact main; shared/workflow/script changes still select the full browser/campaign/balance matrix. No test or soak gate is removed. Web-only tooling; game rules, saves and native pause unchanged.

### 2026-09-30 — HANEDANIAN release candidate (#102)
- Integrated the existing Living Atlas candidate with reviewed #103 and #101 content. Shared mobile save fix and complete CI routing are retained; HANEDANIAN save format and native pause are preserved.
- #101 merged as 513127f4 after every protected CI job passed. Full tests and real browser/campaign evidence are required on the new #102 head before its merge.
### 2026-09-26 — İHTİLÂL basin currents
- Single-player fictional basins now carry local information/trust/tension/capacity; directed effects travel along real adjacency with visible delay, filtering and one attenuated onward hop. Capacity aid never duplicates.
- Original procedural SVG/Pixi geometry shares the simulation's route/layer model. Closing rehearsal, arrival ledger and basin resilience connect decisions to the ending; no audio, external art, real map/person/institution or new dependency.
- Solo v1 key/envelope retained with validated optional network state and old-save fixtures; neighbour targeting, save recovery, terminal continuation, keyboard focus and renderer cleanup hardened. Legacy two-seat archive untouched; native remains paused.
### 2026-09-26 — Racon courtyard consequences
- Web: inherited save-order keys rejected; original fictional street labels, directed delayed neighbour effects and exact network-only closure rehearsal; pure render model with lazy Pixi / semantic SVG+DOM parity.
- Saves: existing three-slot RACON/1 contract and opaque street/item IDs preserved; optional bounded flow queue/history added. Audio/assets/new dependencies: none; A025 records code geometry.
- Native remains paused. Release handoff: `astra/racon-neighbourhood-consequences`; port the same rules/model only when native work resumes.

### 2026-10-04 — JITEM upstream #21 vendor/source sync
- Upstream #21 merged as `0c1fc08db3f050ebf34e237ef4fd1018ba223293` after Decision atlas run [37209063810](https://github.com/tayaz-maker/jitem-derin-ag/actions/runs/37209063810) succeeded on `11c567425c799b92a6442f1acdc77d180ec2c635`; merge used that expected head.
- Built the exact clean upstream SHA after `npm ci` with the unchanged embed builder. All 30 generated files match an independent rebuild; all 31 deployed-output files (including SOURCE.json) match the vendor directory. No compiled file was hand edited.
- Updated SOURCE.json, the integration-test source pin and the stale product identity SHA. Save key `jitem-derin-ag-v3`, schema 5, historical content, calculation rules and TarikLab shell are unchanged. No new artwork/media or gameplay scope; native remains paused.
- Reproduced the silence guard false positive in Pixi's unused video-alpha probe (`autoplay=false`); added only the exact generated chunk SHA-256 plus one-reference pin. All other noise/media checks still run. Targeted integration/silence 7/7, typecheck, build:dev and changed-test ESLint PASS.
- Upstream browser CI covers TR/EN × 1440/390/320 and lifecycle/save/fallback. Vendor browser/physical GPU/production checks remain release work; local browser installation was unavailable. Generated Pixi shader whitespace is preserved byte-for-byte; non-generated diff checks pass. SON KÖY work remains isolated.
- Full local JS run: 1,589 PASS / 1 FAIL / 1 existing skip (235 s); the sole failure was the reproduced Pixi probe guard, then corrected and rechecked 7/7. The separately completed TypeScript phase passed 54/54. Final-head CI must re-run the complete gate; `ci-changes.mjs` selects full browser, DEVLET, duel, campaign and balance checks.

### 2026-09-26 — TC SIM historical starts
- Web change: added fixed 18 April 1999 and seeded 1980s solo life routes through 1 January 2026; preserved Günümüz and `tc-sim-save` compatibility.
- Historical event cards carry event-specific official source URL, publication/access date, institution role and supported claim; uncited dated choices are explicitly fictional life prompts.
- Added deterministic choices and delayed life effects; browser coverage targets 1440, 390 and 320 px.
- Rebased on the #101 merge (`513127f`); retained main's phone `weekPlanHtml` decision layout and decision-network week close.
- Scope: TC SIM historical core only; no DEVLET #100, Pixi CI infrastructure or JITEM changes.
- PR: codex/tc-sim-historical-starts.

## 2026-10-04 — sıralı release kapanışı

- Web releases: #105 `7315055785fa90a46e87c1264c23cfdbb60b3d7b`, #107 `82c731c91b40894060936d9299a61644c970241f`, #106 `d1ea695b76fba15c284690c07cf818316cd97f10`; each merged after 7/7 successful checks.
- Both production hosts matched all Racon/JITEM/TC SIM game files (6/31/38). Per-host browser acceptance: 34 Racon checks, four JITEM restore/renderer scenarios, ten TC SIM starts/legacy/reload/delayed/final scenarios at 1440/390; no console errors or horizontal overflow. Durable hashes/results and screenshot artifact links: `docs/evidence/2026-10-04-release.json`.
- Shared security release: exact React Start 1.168.60 and transitive server-core 1.169.39; npm 10-compatible lock and version-only notices regenerated. No protection bypass or game redesign. JITEM remains upstream #21 `0c1fc08`, key `jitem-derin-ag-v3`, schema 5; source content/rules retained.
- Native remains paused. Test-only production proof branch stays outside main; physical GPU, lint dependency advisory and existing TC SIM lower-card layout limits are recorded in closure/status. Novella LATER; separate SON KÖY WIP untouched.

### 2026-10-04 — Çete Savaşları / silent outcome moments
- Explicit completed jobs project actual before/after state into a pure deterministic receipt; first success, closed contract, multi-crew operation or five-level threshold only. Ordinary actions, save load and clock ticks do not announce.
- Original CSS/SVG night blocks, ledger and connection traces; existing palette/fonts, no assets/audio/canvas. 2.2s visual, close/Escape, focus/hover pause, static reduced-motion, polite persistent announcement.
- Cash, reputation, pressure, net energy, crew commitment and newly set/extended reaction clocks come from the engine. No invented trust score or guaranteed future reward. Existing save key/schema 15 and all engine rules unchanged.
- Native standalone parity: presentation-only adapter/component to port later; native remains paused. CI verifies canonical legacy-save restore, focus, repetition, responsive geometry and deployed bundle evidence.

### 2026-10-04 — Wave 1 decision traces and permanent state artwork
- HANEDANIAN sealed order/queue progress; İHTİLÂL measured basin record/metric level; Racon street commitment/door-light-pressure marks. Separate game vocabularies/layouts, shared transient lifecycle only.
- Rules/content/save schemas remain unchanged. The only offline infrastructure change includes HANEDANIAN's new shared presentation dependency in its atomic package and content hash.
- Original-source register and paired before/after evidence contract: `docs/WAVE1_OUTCOME_ASSETS.md`. Native remains paused; no external assets or audio. Novella LATER; SON KÖY WIP untouched.

### 2026-10-05 — HANEDANIAN canonical HTML offline repair
- Release failure: Workers canonical `index.html` redirect was stored as a redirected HTML Response, then HANEDANIAN navigation reload failed. Main run `37246439763` / artifact `11319313487`; www Wave1 passed9/9.
- Scoped SW repair preserves HTML bytes/status/headers while removing only redirected HTML response metadata. Atomic install/versioning and user saves remain unchanged; native remains paused, no gameplay or asset change.
- Native redirect unit RED→GREEN; offline/version17/17, typecheck/lint/build PASS. Local HTTP browser baseline-negative/fixed online+offline/save fixture and required CI are pending; production is not yet accepted. Details: `docs/HANEDANIAN_OFFLINE_REDIRECT_FIX.md`.

### 2026-10-04 — separate map redraw performance
- İHTİLÂL/Racon retain base geometry and separate decision overlays, skip unchanged framebuffer resize, coalesce hidden updates, and choose same-model SVG under explicit memory/pixel budgets. No rule/content/save/asset changes.
- Instrumented actual renderers, paired 320/390/1440 screenshots/costs and all-live-route cold costs cover this scope. Inventory: `docs/MAP_PERFORMANCE_ASSET_AUDIT.md`; implementation/evidence contract: `docs/MAP_STATIC_CACHE_CHECKPOINT.md`. No asset deletion or claim of unmeasured network savings.
- Native paused; same presentation-only cache policy is a later parity task. Novella LATER; SON KÖY WIP untouched.



## 2026-10-05 — A1 HANEDANIAN release repair candidate

- PR #113, head `cac09e1341e6dbfd72ee41298557f88052ddf8c9`: redirected cached HTML is normalized; all mandatory download bodies finish before atomic package writes. No gameplay, save, shared content/artwork or native changes.
- Local targeted23/23, lint and build PASS. Real Chromium reproduces the minimal old redirect failure and passes patched 19-file online/offline save reload. Workers preview1440/390/320 passes exact-worker/two-reload/zero-error checks, artifact `11321769395`; preview is not production evidence.
- General CI and normal gated merge/two-host production closure remain pending. #111 is blocked until A1 closes. Native remains paused; B7 excludes generated raster trials from production.


## 2026-10-05 — A1/A3 closed; A2 and D5 independent release heads

- #113 merged normally as `375b83752df3d5e16c960797cf99634af0405d31`; exact head had9/9 checks plus Vercel SUCCESS. Main CI37256148777 also SUCCESS. Dedicated production run37256148798/job111593543370 passed www+Workers ×1440/390/320, two real reloads each, actual farm queue/seed/paused-clock save preservation,19/19 cached package, console/page/HTTP/network errors and horizontal overflow0.
- Artifact11322886877 contains24 screenshots/six traces/two results;33,774,583B exceeds32MiB local transfer limit. Browser assertions/logs are verified; these production pixels were not locally inspected. Physical GPU remains unverified.
- #111 rebased onto repaired main; head `eb5913d97ffe387033b315c1560ee25a691f263d`. Local68 targeted tests, lint and production build PASS. Fresh CI pending; no merge. Original map code unchanged from prior tested head; only fixture description and per-host artifact splitting changed in verification support.
- D5 #114 head `316355d72153e1804a906f3e2d5d62f2cd349577`: isolated three-file brace-expansion lock/consumer regression/evidence patch. Baseline2 PASS/12 FAIL → patched14/14 PASS; build/typecheck/lint/IP gates PASS. Fresh CI required. Shared run-state/ledger kept here to avoid overlap with #111. No application, save, gameplay, NOTICE or native change.
- B1–B10 accepted new art remains0/900; failed original vector probes are isolated outside production. B11 legal engine fixtures21/21 pass; reported browser/legacy-save P1 remains unconfirmed. C–F work and independent human gates remain open.


## 2026-10-05 — A2 production closed, D5 dependency release

- A2 #111 merged `a534289490f502f68e12d91803fbc3883de7d790`; exact-head10/10 checks plus Vercel SUCCESS; main run37258787799 SUCCESS. Browser job111601394043 passed Wave1 thirteen cases and Çete seventeen cases on each public host, and VETO/GETT legacy saves/300-card archives. Dedicated HAN run37258787888 passed six two-reload/save cases across both hosts and1440/390/320.
- HAN host-split artifacts11323133708/11322919338 were downloaded, digest-verified and six reload-2 screenshots inspected. Full evidence/limits: `docs/evidence/2026-10-05-a2-han-production.json`. Large production Wave1 artifact11323759638 exceeded32MiB local tool limit; CI assertions/logs verified, not locally inspected pixels. Racon mobile fullPage capture discrepancy stays open; physical GPU/full old-cache cohort are not claimed.
- D5 #114 exact head316355d passed8/8 checks plus Vercel and merged normally as `0383d24dce3e45fc1db16773da8b3a135bf51b6e`. Only development lockfile, real-consumer regression and source evidence changed; no app/native/save/rule/NOTICE change. Main run37260245958 SUCCESS: both hosts passed Wave1 13/13 and Çete 17/17; VETO/GETT archives/legacy saves and24 deterministic UI scenarios passed. Workers/Vercel deployment checks for this exact merge SHA were SUCCESS. `npm audit` was not run after automatic approval review rejected metadata export; no bypass or broad security-clean claim.
- B1–B10 remain0/900 accepted art; three300-card semantic preparation branches are drafts, not release PRs. E anatomy discovery is documented separately; foundation and final360 have not started. No new visual scope merged.

### 2026-10-05 — B10 restored hand capture readiness candidate
- Test/evidence scripts require fixture UID + per-card manifest source/dimensions and bounded visible-image decode before each VETO/GETT legacy screenshot. No game/data/art/save/native changes; native remains paused.
- Visible placeholder/broken/absent images fail; clipped/offscreen lazy art is not forced. Existing duel browser gate now exercises deterministic readiness fixtures without changing workflow budgets.
- Local helper/CI guard tests 28/28, changed-script ESLint, typecheck, build:dev and production build PASS (migration step skipped under its existing no-DATABASE_URL contract). Local Chromium crashed at launch (SIGSEGV); browser CI and production proof remain pending. The identical legacy capture flow is shared by local CI and production callers. Owner Astra, PR none. Scope/evidence: `docs/DUEL_VISIBLE_ART_READINESS.md`.


### 2026-10-05 — #116 proof release closed
- Normal merge `9e50404c0573e1cf9e2dd7e623c9c8bd98b95e56`; exact-head8/8+Vercel and own main37270312084 SUCCESS. www+Workers each24 duel UI scenarios, VETO/GETT300-card archives and unchanged legacy saves; actual origins/11 hashes checked;8 production PNGs opened, artifact11328870080 digest verified.
- Test/evidence-only change; application, artwork/content and native output unchanged. Native remains paused. Full900-card redesign, offline upgrade and human gates stay open; see B10 checkpoint JSON for scoped evidence.
### 2026-10-05 — TC SIM job-start outcome (unreleased branch checkpoint)
- Web change: actual next-week job completion separates immediate cash/focus deltas from prospective salary/workload in one visible result panel outside collapsed inspectors/ledgers; silent 2 s CSS emphasis, static reduced motion and focus-preserving close.
- Content: presentation copy only (TR/EN/PL draft); Artwork: original CSS only; Gameplay/rules/save: no; UI/presentation: yes; Shared-content source: no new external asset.
- Native follow-up: yes, only after web release; native remains paused. Browser/offline/build transfer gates and PL native review remain open; no release claim.
- Commits: branch `astra/tc-sim-job-start-outcome`, based on `9e50404`; see `outputs/tc-sim-job-start-outcome/CHECKPOINT.md` in this checkpoint.


### 2026-10-05 — #117 TC result and #118 bounded rule proof released
- #117 normal merge `539df6ee8cd3fe1e56b4a7833bffcc8953765488` after9/9+Vercel: actual job-start result, rules/save unchanged. Dedicated production37276537798 attempt2 passed22 cases per host with four exact hashes; six PNGs inspected. First attempt rejected previous-main bytes before deployment completion; no gate changed.
- #118 normal merge `23fb636cbfb0c30ad86fb52467982785e1e298b5` after9/9+Vercel: test/workflow only, no artwork/content/native change. Production37277755646 passed12 cases per host,50 runtime/data hashes, eight PNGs inspected; all four DRB effects triggered in legal synthetic UI fixtures. Broader affected-save/natural-match allegation remains bounded OPEN.
- #117 own-main general CI was cancelled by the existing successor-push concurrency; #118 current-main full CI37277755938 SUCCESS; the cancelled #117 run itself is not labelled PASS. TC desktop narrow-label P1 has production DOM evidence and a separate CSS-only candidate; no full visual/i18n acceptance. Native remains paused.
### 2026-10-05 — TC SIM dashboard readability P1 (unreleased local checkpoint)
- Web presentation only: clear residual dashboard named areas/placement after the existing management desk moves panels; Inbox/Key people should use full row width. Parent production DOM confirmed the 7.609 px title defect.
- TC stylesheet only; shared engine/CSS, rules, data, save, localization and artwork unchanged. No native work; any native parity follow-up waits for a verified web release.
- 29 targeted tests, production build and typecheck PASS. Old-CSS/candidate browser comparison, full suite, CI and production remain open; see `outputs/tc-dashboard-row-layout/CHECKPOINT.md`.


### 2026-10-05 — #119 TC dashboard title release closed
- Normal merge `be160c95eb5283e5ed2ce8bf139ef7aa714d329d` after9/9+Vercel; main37282054896 SUCCESS. TC CSS-only8 lines/+324B; all game/rule/save/shared styles and native output unchanged, native paused.
- Dedicated37282054880 attempt2 passed22 cases on each public host, exact CSS/app/outcome hashes,76 dashboard measurements and12 non-dashboard null per host;1440/390/320, warm-worker offline reload and synthetic-v1 migration. Both ZIP digests checked,6 PNGs opened. Attempt1 stopped on old CSS before deployment readiness; no gate or timeout changed.
- Existing mixed EN/PL body copy, all-route old-worker/archive-save review and full visual/art quality remain open. Detailed IDs/digests/cost samples are in `docs/evidence/2026-10-05-tc-dashboard-layout-release.json`.


### 2026-10-05 11:52 UTC — approved card references and active priority
- Documentation checkpoint only; verified A1–A3/#113/#111 remain merged with two-host proof; main be160c95/full CI37282054896 SUCCESS. #116–119 immutable release evidence is retained.
- B3 exact approved targets recovered and visually inspected privately; reference pixels are not copied into web/canonical/native repos or used as asset material. Reference emblems, people, lettering and compositions are excluded.
- New art acceptance remains0/900. B10 pack/cohort validation and separate game-specific procedural surface work are in progress, not production. Latest user prioritizes B; unrelated local TC i18n b32a4dd is preserved/deferred. Native remains paused.


### 2026-10-05 — Grok card-art ownership handoff (documentation only)
- User assigned VETO/GETT/DARBE 900-card art/frame/generator/assets to Grok; Astra retains later immutable-data/engine/save/quality/release review and non-card scope. No new art or production output in this checkpoint.
- `docs/GROK_CARD_ART_HANDOFF.md` links exact published 300×3 semantic drafts, source hashes, canonical/shared-art sync, private references and build/manifest/offline acceptance. All 17 preparation tests passed; no art approval or human/GPU test claim.
- Shared-content repository remains `tayaz-maker/tariklab-content`; native paused. Existing #112 and preparation/probe branches preserved; old-source differences/GETT alias and pack overwrite risks explicitly retained.
- A1–A3 and TC #117/#119 are already released; current main `be160c95` and CI/two-host evidence cited in handoff. Final 360 report is gated on remaining products plus Grok production releases; no autonomous broad post-report fix wave.

### 2026-10-05 — TC SIM week-control translation P1 (unreleased local checkpoint)
- Web copy only: EN week-review button, time/focus label and week heading; missing PL time/focus label plus EN aliases to preserve the existing Polish overlay. Original TR keys, all game files/rules/save/card content and native remain unchanged.
- Real phrase/body API RED reproduced missing labels; 64 targeted tests, production build, typecheck and changed-script lint PASS. Existing 22-case browser gate now records exact visible controls before/after the decision and both offline reload paths; two changed dictionaries join the four unchanged game fingerprints.
- Browser/full suite/CI/two-host production are NOT RUN for this candidate. PL wording remains a draft requiring native review; no full-i18n closure claim. Native follow-up only after web release; see `outputs/tc-week-control-i18n/CHECKPOINT.md`.


## 2026-10-05 — Grok ownership / non-card release evidence
- Documentation-only: preserves #112/source branches; Grok owns all900 illustrations/frames/generators/assets, Astra later invariant review. No new card/runtime/workflow edits in this evidence PR.
- #120 merge1700e6a: exact-head9/9+Vercel; built22/22, www+Workers22/22 each, six released hashes and88 control records/host. Narrow TC control translation; full body/nativePL open.
- #121 merge9b4e169: exact-head9/9+Vercel; built37/37, www+Workers37/37 each, five hashes and148 measurements/host; save backup/raw retention/quota/warm offline proof. Main37314184406 still pending; own #120 main superseded/cancelled.
- First production runs rejected exact old assets before deployment; only failed jobs rerun after successful deployments. No gate/timeout/hash relaxation. Exact artifact/result/screenshot digests in release JSONs.
- B11 natural50matches/6,342actions produced no target summon/activation opportunity; not activation-resolution acceptance. P1/affected-old-save boundary open. E1/C1/C3 handoffs are discovery, not implementation; F remains unstarted until product+Grok releases, then report/classify only.


## 2026-10-05 — E1 Atlas foundation isolated implementation
- Separate static learning product `/atlas/yapi/` with original bounded SVG, content/source schema,13 broad structures, adult variants, front/back, layers/search/zoom and three-stop lesson. Portal/Resources add plain links; no game catalog/engine/save/card content changes. Native remains paused.
- TR/EN/PL draft copy, educational/accuracy/scope notices and per-field factual sources travel in one verified offline package. Independent expert and native Polish review are not performed; this is not a complete or clinically validated atlas.
- Atlas-only worker/build emission follows the root offline plugin so portal precache excludes Atlas. Hash/body regression closes stale incremental geometry; own package never edits root/card caches. Opus#123 file intersection is empty.
- Local52 Atlas tests/full1,874 PASS+1 existing skip/typecheck/build; actual HTTP package integrity checked. Real browser/CI/two-host production are still required and will be recorded at release, not inferred from unit evidence.
- User priority: Atlas first; no new save-recovery work. Grok/Opus card surfaces stay external-owned. Final360 site review transferred to another agent and removed from this workstream.

### 2026-10-06 — Atlas unified full-body expansion candidate
- `/atlas/3d/` now combines the existing lightweight 2D front/back atlas and source-linked 3D models in one workspace, with male/female switching and shared structure detail. The 2D silhouettes remain schematic; the 3D meshes are actual source geometry, not AI-generated anatomy.
- Expanded 3D source inventory: male BodyParts3D 4.0 (CC BY 4.0) and female Human Reference Atlas v1.5 (CC BY 4.0). The converter records source SHA-256, source mesh IDs and per-file hashes. 50 optional compressed geometry files are system/sex split and fetched only when selected; the verified core offline package is about 7.25 MiB. Attribution and missing anatomical coverage are explicit in the sources page and UI. No clinical completeness or expert validation is claimed.
- This candidate changes only the atlas and its packaging/tests plus a narrow ESLint exclusion for vendored 3D library code. Games, cards, rules and save formats are unchanged. No native output. Final 360° review remains assigned outside this workstream.
- Local gate before release: atlas 7/7 tests, production build, typecheck and lint (0 errors) passed; real Chrome 1440/390/320 2D/3D male/female scenes passed without page errors or horizontal overflow. Full-suite/CI/two-host production results must be recorded separately; this paragraph is not a release claim.
- Release audit: six existing core geometry files and two pinned Three.js distribution files are intentionally ignored because the tracked, hash-verified `assets/atlas-3d/` chunks reconstruct them during build. The build/test scripts prove their bytes; do not duplicate them in Git. The silence regression now pins the restored Three.js vendor hashes while continuing to scan first-party code. A clean checkout, CI and both hosts must still prove the resulting files are served before release is called complete.
- First exact-head `atlas-3d-proof` CI found a stale browser contract in the previous nine-structure proof script (`document.body.dataset.ready`, old system names). The candidate now runs the actual unified 2D/3D/offline Chromium test at the workflow's 8096 origin. Old assertions were not treated as product success; new exact-head CI is required.

### 2026-10-06 — Atlas unified release verification
- PR #127 merged to main as `56ff6008a992761d6bb657d50dadc3b87ae5bd23`. Corrected exact-head `atlas-3d-proof` run `37381434543` and `atlas-foundation` run `37381434562` passed; the broader `ci` run `37381434466` was still in progress at this checkpoint and is not called green here.
- Both `www.tariklab.com` and `tariklab.tayaz29.workers.dev` served byte-identical `app.js`, `unified.css`, expansion manifest, `sw.js` and a sampled female geometry file with a fresh versioned request. The earlier unversioned 404 during deployment was stale edge state; a fresh request returned 200 on both hosts.
- Real Chrome at 390px opened the published female 3D model (11 visible selected groups), switched to female 2D, had no page error or horizontal overflow on both hosts. This verifies the narrow release surface, not complete anatomical accuracy or a final 360-degree site audit.

### 2026-10-06 — TC SIM life-to-2030 candidate (not released)
- Historical 1980s and 18 April 1999 starts now continue through 1 January 2030; old 2026-final scenario saves upgrade without replaying resolved events. Present-day start remains the default and the existing `tc-sim-save` key is unchanged.
- Annual World Bank Türkiye CPI observations (1980–2025), 2025 net-minimum-wage calibration and the TL/YTL denomination boundary produce illustrative period amounts. Gameplay still runs in stable purchasing-power points; 2026–2030 future prices/events are explicitly fictional, not forecasts. This is not a measured catalogue of wages or product prices.
- Added larger but bounded weekly decision capacity, top-level inbox/calendar/bank/relationships/body access, readable full-size desk panels and first-step guidance. Added adult consensual intimacy choices, delayed fictional pregnancy branch into the existing parenthood chain, engagement, wedding costs and variable gifts, repayable bank credit, era-gated small businesses and goods, and a schematic body/commute view. No explicit sexual scene or adult content involving minors.
- Existing three abstract city zones gain district-style labels and a commute diagram. Real city/mahalle names were not fabricated because job, housing and commute data do not support distinct city economies yet. Licensed brands were not introduced; goods use descriptive generic names.
- Local targeted 54-test suite, typecheck and Chrome 320/390/1440 smoke are release-candidate evidence only. Full CI, merge, production and the separate non-card game visual backlog remain open.


## 2026-10-06 — TC SIM shared visual palette
- Unified TC SIM base/desk surfaces, text, borders, selected rows and gold focus via shared CSS tokens; other games retain fallback colors. Existing layout/content/engine unchanged by this pass.
- Build and typecheck PASS; targeted core/screens/responsive/expansion tests 35/35 PASS. Browser smoke BLOCKED: available Chromium exits with SIGSEGV before a page opens.
- Scope limitation: this checkout has 13 navigation views and lacks the separately rendered inbox visible in the supplied screenshot; full current-production coverage is not claimed. Earlier working-tree changes remain uncommitted and preserved.

### 2026-10-06 — palette release transfer from preserved 3069d4f
- Original commit is local-only and absent from main/#131. Applied only its two CSS deltas to the current main lineage; retained all newer content, mechanics and every earlier ledger entry. The conflicting root palette uses the explicitly requested 3069d4f values. No #131 changes are included.
- Infrastructure is a separate parent PR. Fresh TC + DEVLET responsive/historical and unit/build gates must pass before product merge. Previous source-checkout validation above is historical evidence, not current release proof.


## 2026-10-07 — TC SIM canonical page shell

- Cause: `arrangeLifeDesk` applied shared management-layout/workspace classes only to seven list/detail views. Their global `:has(.management-layout)` CSS also changed the header, sidebar, width, padding and typography; full views kept a different shell.
- All fourteen menus now use the existing wide TC frame, header, navigation and workspace. Scenario/status and page heading remain full width. A common `tc-page-regions` contains main content and an optional 320px detail region (270px at narrow desktop); mobile retains the existing detail dialog behaviour.
- Shared desk selection, filtering and original action nodes are retained inside the content region. No palette values, game content, mechanics, persistence or navigation destinations changed. TC SIM DEVLET and shared CSS/JS are untouched.
- Browser release gate now records/snapshots all fourteen menus at 1440/390/320, compares header/sidebar/workspace/heading geometry and checks overflow and unchanged storage. Exact-release fingerprint gate additionally verifies desk.js. Existing action, localization, offline and responsive gates remain enabled.
- Validation: local build and typecheck passed. Actual browser and production results are recorded in the associated PR; merge is conditional on passing checks.
- Live browser baseline additionally measured native scrollbar shifts: at a 1363px viewport, inbox width 1363px vs dashboard 1348px; Ben also changed sidebar 164→176px and header 153→149px. Canonical shell reserves native desktop scrollbar space to remove the remaining 15px short/long-page shift.

## 2026-10-07 — TC SIM production typography polish
- Base: main `2e04165a9ad65d26f17dd032f5e10e442b99d678` / merged #135; canonical shell tracks, sidebar, workspace, inspector width and navigation preserved.
- Scope: presentation only in `public/games/tc-sim/styles.css`. Shared caption/meta/body/title/section/page roles (12/13/14/15/17/24px), 500/600/650 weights, readable copy rhythm, consistent panel/control spacing, quieter explanatory notes and nested dividers. Existing palette, text, game logic, saves, starts and economy unchanged.
- Reviewed all 14 desktop route screenshots from exact #135 CI artifact; main issues were tiny metadata, over-bold labels, touching panels, oversized default subheadings and technical-note emphasis. The selected-record desk and ledger now consume TC-specific type roles without changing the shared DEVLET stylesheet.
- Local verification: targeted tests 33/33 PASS; production build PASS. Local Chromium executable absent; official installer returned an invalid archive, so browser validation is delegated to the existing exact-head TC CI gate, without adding a new framework or suite.
- Release policy: FAST MERGE after relevant TC/build validation, stable head and no product regression; known browser startup infrastructure failures and unrelated running campaign checks are not blockers. Production visual acceptance: USER VISUAL QA PENDING. Historical economy wave remains deferred.
- Candidate `2de81ca`: exact TC browser gate PASS (22 cases, 42 shell measurements, 7 fingerprints); all 14 desktop screenshots inspected. Historical browser gate exposed a real click obstruction: compact navigation z-index 12 covered event overlay z-index 10. Corrected only the TC event/help stacking tokens to 110/120, above the existing inspector layer 100; no geometry or logic changes. Existing historical click test is retained for regression coverage.

## 2026-10-07 — TC SIM historical economy and canonical date

Base #135/#136 UI accepted at 7f7da9e57e0f004082bb3d1a7a09ff0d5ba3f98d, preserved. Normal 2017-04-18 start (18 years old, birth 1999-04-18); single civil date and birthday/period clock; dated Ministry net-wage budget scale, compact old TL, period-filtered consumption catalogue; existing business and credit engine gains period uncertainty/demand and skill/fatigue/arrears context. No artwork, audio, other-game or UI redesign. Model/source distinctions, migration assumptions and validation are in `docs/tc-sim/HISTORICAL_ECONOMY_2026-10-07.md`. User production acceptance pending. Native work remains paused.

### Same-wave production smoke correction

PR137 smoke caught a hardcoded creation select that omitted the working 2017 scenario. The form now derives options from HISTORICAL_STARTS, displays the period description outside the seed-only field, and has a real app-render/submit/save regression for the 2017 date and birthday. Existing saves are untouched.

General CI later exposed three stale inventory/count fixtures and a genuine migration idempotence ordering issue: life phase normalized before canonical age. Canonical date now precedes phase normalization; existing no-op reload invariant is retained. Authorized economy source hash and 62-item catalogue fixtures are refreshed, not disabled. General browser-regression reproduced the known PGLite/server-startup infra error.

## 2026-10-07 — TC SIM exchange, gold and business growth

- Base main 6fe1fac (#137/#138). #135/#136 shell, styles, navigation preserved.
- 114 TCMB dated quarterly/exact-start bulletins, 345 World Bank gold months, source URLs/hashes and explicit methodology. EUR cash gate/DEM conversion, eight active currencies, four gold weight options.
- Existing wealth/save ledger gains quantity/cost/value/P&L and capped history. Synchronous integer-cash buy/sell with fee/spread, no over-selling, no future historical observations. Existing abstract portfolios remain untouched.
- Existing business engine gains capacity/employees, separated operating expenses, secured credit, paid restructuring, downsizing and debt-aware liquidation/bankruptcy. Net worth includes business equipment less debt.
- First broad suite: 495/496 PASS; sole archive fixture failure was unstaged new imports, corrected by adding the new files to the index. New exchange/growth cases 7/7 PASS including actual save migration, era restrictions, anti-roundtrip, repeated monthly settlement and insolvency. Final targeted verification follows before release.
- Local Chromium executable absent: INFRA BLOCKED, no test/assertion removed. Production visual acceptance stays with user; no body visualization work.

## 2026-10-07 — TC SIM body visualization

- Verified baseline main `42a9a76b2f30c1eec3b29ceff898427048784bcd` (#139) and matching Vercel production READY before work.
- BEDEN-only presentation: lightweight adult-proportioned SVG front/back, six keyboard/touch selectable regions, global health/energy/stress hierarchy, player-known active/managed/chronic/resolved conditions, and the existing rest/exercise/conditional body-care actions.
- No regional diagnosis inferred: engine exposes no localized injuries or sleep/fitness scores. Gold means selection, not pathology. Hidden conditions and exposure counters never enter the visual model. UI selection is ephemeral and does not write saves.
- Body Engine, formulas, save schema and #139 economy sources unchanged. #135/#136 canonical shell, typography tokens and palette retained; no audio/native/Atlas changes.
- Mapping, hidden-state invariance, selection/keyboard, actual app action equivalence, legacy/current save regressions and existing body gameplay: 37/37 PASS. Build and typecheck PASS. Existing targeted browser gate extended with all six regions, SVG keyboard selection, front/back, unchanged save and 1440/390/320 geometry checks.
- Local Chromium download returned a truncated archive (INFRA); CI browser evidence required before closure. Production visual acceptance remains USER PENDING; final comprehensive mobile QA deferred.

## 2026-10-07 — TC SIM Turkish life and marriage depth

Baseline #140 main `f895560d62a360695f71a0d37e052cd9e898c269` and matching production READY verified. Existing relationship/household/parenthood systems audited DONE/PARTIAL/MISSING in `docs/tc-sim/TURKISH_LIFE_MARRIAGE_2026-10-07.md`.

Optional family/isteme, delayed engagement preparation, civil/small/hall wedding alternatives, existing bank-funded wedding, actual quarter-gold gifts, honeymoon and yearly shared-budget reflection extend the existing household event chain. Existing consent/adult, protection budget and pending follow-up gates strengthened. Old saves do not receive invented marriage history. Economy and Body Engine sources, shell/style and other games unchanged. Targeted scenarios 45/45 PASS; full TC, build/typecheck and targeted browser gate required before release. USER VISUAL QA PENDING; no city/neighborhood wave.

## 2026-10-07 — TC SIM şehir ve mahalle yaşamı
- #141 production/main doğrulandı; mevcut konut/iş/ulaşım/ekonomi motorları üzerine 3 şehir / 9 bölge eklendi.
- EV konum şeması, dönemsel kira/ulaşım, iş erişimi, eğitim yükü, sosyal ziyaret ve mevcut işletme yerel maliyetleri ortak locations helper üzerinden bağlandı.
- Eski saves seçimsiz bütçeyi korur; taşınma haftalık/finansal kapıları, borç ve ortak ev korunur. Kaynak/varsayım ayrımı CITY_LIFE_2026-10-07.md içinde.
- Audio kapalı; canonical shell, #140 body ve #141 wedding akışı korunur. Native/Godot işi açılmadı.

## 2026-10-07 — TC SIM gameplay language and notifications
- #142 exact main/production READY verified. Natural Turkish labels, shared read-only decision feedback, known-case urgency and same-week notice deduplication added.
- All menus and 431 event definitions audited; existing authored voice retained. Methodology remains available in details.
- Engines, saves, event effects, canonical shell/styles and other games unchanged. Validation and boundaries recorded in `tc-sim/GAMEPLAY_LANGUAGE_2026-10-07.md`.
- USER VISUAL QA PENDING. Stop after release; no weekly decision balance wave.

## 2026-10-08 — TC SIM gameplay balance / dashboard final pass
- #137–143 preserved; main/production 3b6130f verified before work.
- Debt-cap conversion no longer creates unrecorded money. Business owner production and minimum workshop rent balanced in existing settlement. Large decisions consume 2–3 existing time slots; repeat gates enforced.
- Dashboard keeps last-week feedback and places long-term metrics in details; actual city label fixed. No CSS/shell/save-schema or other-game changes.
- Reproducible long-game matrix, exploit tests and evidence: `tc-sim/BALANCE_FINAL_2026-10-08.md` and `BALANCE_RESULTS_2026-10-08.json`. Visual/gameplay acceptance USER PENDING; no next wave.

## 2026-10-08 — TC SIM final mobile hardening

Preserved PR #135–144 main `51ee5ccf5b249c7a18df7b3dba2340b8025c4c34`. TC-only mobile CSS fixes readable header actions, 44 px controls, conditional creation fields and whole map labels. Added five-viewport browser audit to the existing fast targeted workflow. All 14 menus, detail/body/map interaction, finance/business controls, week advance and isolated save reload covered. No mechanics/content/save/native/audio changes. See `docs/tc-sim/MOBILE_FINAL_2026-10-08.md`; release evidence in PR. Production visual acceptance: user pending.

## 2026-10-08 — JITEM production quality

Verified main/production #145 `99c7ddb94b5f32b25c7186cd76e3a15bdf2d9836`, READY. Built isolated JITEM runtime from reviewed upstream PR #22; no compiled JS edited manually. Restores existing resource/support decisions with real previews; fixes mobile event tab blocking, 1024px columns, embedded help/end scrolling, unrelated source links and refused-move feedback. Clarifies fixed historical events versus game outcomes and evidence confidence. Keeps source catalogue, artwork, schema-5 saves and production embed/locale contract. Upstream 281/281 tests, build/typecheck PASS; integration 2/2 and portal build/typecheck PASS. Browser matrix and final release evidence recorded in `docs/jitem-derin-ag/PRODUCTION_QUALITY_2026-10-08.md`. TC SIM #145 and other games unchanged. No native/audio work. Stop after JITEM production smoke; user performs visual/play acceptance.

## 2026-10-08 — Çete Savaşları production quality
- Canonical source: portal `src/game` and `src/components/game`; baseline #146 `501bc339145d1c49bdd79ce7567164a7699536ef`.
- Fix payout/trading exploits, district decay/income accuracy; expose existing strategic district decisions and crew availability. State/save version 15 and existing assets remain.
- Targeted regressions and responsive TR/EN browser gate added; details: `docs/CETE_PRODUCTION_QUALITY_2026-10-08.md`.
- No TC SIM, JITEM, HANEDANIAN or native changes. Audio remains disabled.

## 2026-10-08 — HANEDANIAN production quality

Baseline main/production #147 `74e414e991b789735b428ff0e50def21cb042cbb`. Fix expedition starvation and displaced upkeep, prevent empty expedition outcomes, expose permanent dynasty effects and paid heir choices before long campaign goals. Preserve schema-1 saves, existing map/art/campaign/AI and atomic offline packaging. Scoped engine/UI regressions, 9 long campaigns + 9 exploit policies, five-width browser gate. See `docs/hanedanian/PRODUCTION_QUALITY_2026-10-08.md`. No TC SIM, JITEM, Çete, other-game/native/audio changes. User retains live acceptance.

## 2026-10-08 — Racon Manager production quality

Baseline #148 main/production `a1c5123a4f979aa6a773970e0f65773b91d3ca43`. Guard paid story effects and repeat rewards, restore negative evidence, sequence delayed chapters, remove retreat bonus and captured investment recovery. Show paid choices and complete recurring cash outlook with existing design tokens. Preserve save schema, map/crew/rival mechanics, assets and portal integration. 80 targeted tests, deterministic long campaigns and five-width browser gate; see `docs/racon/PRODUCTION_QUALITY_2026-10-08.md`. No other game/native/audio changes. Owner retains live acceptance; no automatic next wave.

## 2026-10-19 — TC SIM D0 debt conservation

Baseline main `9851711081b4ab64ace5626dee1b1310702b1af3`. Route icra down payments, installments, early payoff, seizure and stall withholding through one claim/source settlement rule; reserve active claim arrears from generic recovery. Preserve unrelated debt and retain enforcement overflow as negative cash under the existing 300,000 TL arrears ceiling. Optional claim `sourceArrears` falls back to the remaining claim for legacy V5/V6 saves; SAVE_VERSION stays 6. Deterministic regressions cover both audited 600 TL defects, collection overlap, unrelated arrears, assets, rounding and save round trips. UI, art, other games and native remain unchanged. Release validation is recorded in the PR; physical-device acceptance remains with the owner.
## 2026-10-19 — TC SIM owned housing valuation

Integrated with D0 main `41edc2a46e166fcb71f46faf90cb1426b79411f7` through a merge commit, without rewriting branch history. Include owned semt holdings in the existing net-worth property total, using the existing semt normalizer on an isolated wrapper. Rented homes are excluded, duplicate asset IDs count once, and existing debt principal/arrears remain deducted once. No cash posting, UI, prices, new credit mechanism or save schema change; SAVE_VERSION remains 6. Re-pin the full 56-source baseline for the sole runtime change in wealth.js. Regression coverage includes the 285,000 TL purchase, sale, occupancy, mixed registries/debt and V5/V6 save/load. D0 accounting remains intact; combined housing/icra and V5/V6 regressions are included. Release remains gated on fresh passing CI/browser QA. Physical-device acceptance remains with the owner.

## 2026-10-19 — TC SIM observed bank history foundation

Baseline main `078dbc9dc9e1f0ca7b8ba0943f0113050eb41a4e`. Add optional, bounded `flags.bankRecord` observations for new personal-credit opening/closure, actual debt installments and cash default. A fictional 0–100 game indicator starts only with an observed event; V5/V6 debt creates no invented payment history. Funded monthly payments count once; uncovered payments/default override that period's positive observation, including arrears-cap overflow. Borrow/early-close cycles do not improve the score. Existing debt, cash, eligibility and interest mechanics remain unchanged. Expose read-only TR/EN/PL status within the existing bank panel; no new screen or asset. SAVE_VERSION remains 6; optional fields are sanitized at the existing load normalization boundary. Re-pin the full 57-source guard solely for bank-record.js and the state/bank-business/wealth hooks, preserving D0/housing changes. Deterministic 720-week observation, save/load and debt-conservation regressions accompany the change. Release must follow #174/#175 and fresh passing CI/browser QA; physical-device acceptance remains with the owner.

## 2026-10-19 — TC SIM EN/PL presentation QA

Baseline main `078dbc9dc9e1f0ca7b8ba0943f0113050eb41a4e` after #173. Load a TC-only phrase overlay for icra, adult risk, army, neighborhood stalls/housing and existing help. Preserve Turkish source and mechanics; use numeric-only runtime templates without changing displayed amounts or counters. PL source dictionaries include both Turkish originals and the English fallback, with generated output rebuilt by the existing tool. Correct the TC-only English save help to reflect three existing slots. Actual phrase, DOM text/attribute and PL-body API regressions cover all existing icra/risk/army decision titles/details, authored rows and help. No save/schema, game-state, RNG, asset or other-game changes. Merge after #173 and #174, integration with current main and fresh passing CI/browser; physical-device acceptance remains with the owner.

## 2026-10-19 — TC SIM actual month-close cash card

Integrated with housing main `078dbc9dc9e1f0ca7b8ba0943f0113050eb41a4e` after #173; both housing valuation and receipt postings retained. Add one existing-style dashboard panel for the last closed month's actual cash flows, net balance movement, separately recorded debt/installment cash payments (a subset of outflows), closing loan/arrears balance and live weekly rights. Loans/asset flows are disclosed as cash flows, never profit; netted transactions retain their existing net cash representation. Debt reclassification is shown separately. All four existing cash-write paths feed fixed-size totals before mutation; forecasts and the 120-row display ledger are not receipt sources. Optional finances.monthCash/lastMonthClose normalize neutrally in V5/V6; unknown first months are partial, no historical reconstruction; SAVE_VERSION remains 6. Reuse the existing calendar boundary and period money formatter. No financial amounts, game rules, styling, new screens or other games changed. Merge only after fresh passing CI/browser QA; physical-device testing remains with the owner.

## 2026-10-19 — TC SIM Bankalar screen separation

Stacked on #176 integrated with canonical main `6a33742df9fb3b2d992581382fd44d24fe2243e6`; release must follow #175/#176. Add Bankalar beside Para using existing navigation, full-width panel layout and controls. Move existing bank-credit/early-payment, investment/deposit and exchange panels intact; keep valuation, debt, transaction and realized month-close reports in Para. No separate balances/accounts, new pricing, financial mutations, assets or SAVE_VERSION change. Read-only historical identity/service cards cite official Ziraat, İş Bankası and Garanti sources, use the exact 10 June 2019 Garanti rename boundary and avoid inventing a day for İş Bankası's documented 1997 internet launch. Historical context is explicitly separate from modeled game offers. New copy/help is authored TR/EN/PL. Tests cover routing, unique control ownership, unchanged real credit postings, legacy saves and date boundaries. Existing browser matrix adds Bankalar keyboard/accessibility, 1280/390 widths, localization and offline module checks. Full frozen source inventory stays pinned; merge remains blocked pending dependency integration and fresh CI/browser PASS. Physical-device acceptance belongs to the owner.

### Bankalar browser release correction

PR #177 built-browser outcome matrix passed, but the subsequent mobile financial interaction script still navigated to Para before seeking the moved USD/gold controls. This was an outdated test route, not a deployment mismatch or failed exchange engine. Route exchange/investment interaction tests to Bankalar, retain the real buy/sell/save assertions and return to Para for unchanged business controls. Add Bankalar to the mobile audit and explicit 1280 px coverage; strengthen the accounting-screen exclusion assertion to use the real data-exchange attribute. No game runtime, save, balance, guard hash or financial formula changed. Fresh CI/browser execution remains required.

## 2026-10-19 — TC SIM interest-bearing mortgage foundation

Stacked after #176/#177; canonical main `04fd0b706d7d202913e0d51cb6c435ccd95823d6`. Reuse the existing 30% down-payment housing purchase and linked property/debt registry. New contracts add an optional format-1 mortgage payload: 120 months at a disclosed fictional fixed monthly game rate of 0.50%, integer annuity installments, separate accrued unpaid interest and principal, bounded one-time restructuring, extra repayment/full payoff and observed missed/default outcomes. Legacy V5/V6 mortgages retain their original interest-free payment; SAVE_VERSION stays 6. Unfunded installments never erase principal; overdue is a schedule measure, not an additional liability. Interest is charged only on principal, never on prior interest. Sale, payoff, net worth, budget commitments, debt pressure and actual month-close debt totals include accrued interest once. Restructuring keeps every liability and computes a rounded amortizing payment without a hidden final balloon; no debt forgiveness. Existing Bankalar/Emlak panels/handlers/styles are reused, with TR/EN/PL terms and status. Deterministic amortization, debt/cash conservation, 720-week wealth profiles, old/new save round trips and real UI replay tests accompany 1280/390 TR/EN/PL browser cases. Full enforcement/court/property loss remains a separate approved phase. No real legal/bank interest rules are claimed. Release is gated on predecessors and fresh mandatory CI/browser PASS; physical-device acceptance remains with the owner.

## 2026-10-19 — TC SIM observed credit eligibility

Stacked on the interest-bearing mortgage PR; independent of its amortization calculations. Reuse the existing bank-record score and income/payment-load gates. Actual cash arrears, positive pending enforcement claims or mortgage overdue amounts block new credit, while repayment/restructuring and cash purchases remain available. A disclosed fictional 40/100 game threshold limits larger borrowing; clean legacy saves with no observed history remain neutral. After current arrears are cleared, a small personal loan remains subject to the existing affordability checks, allowing real funded installments to rehabilitate history without a permanent credit deadlock. Borrow/early-close cycling still earns no score. Apply the same read-only policy at personal-loan and mortgage UI/backend gates. New mortgages also reuse the existing regular-income and debt-summary calculations, with a disclosed fictional 50% total monthly loan-payment ceiling; the personal-credit 40% rule is retained. No rates, balances, fees, saved fields or SAVE_VERSION changes. TR/EN/PL explanations and browser button/save checks accompany neutral V5/V6, claim closure, real mortgage delinquency and recovery regressions. D0 debt invariants and the full frozen source guard remain in place. Release requires predecessor integration and fresh mandatory CI/browser PASS; physical-device acceptance remains with the owner.


### 2026-10-19 — TC SIM enforcement review checkpoint
- Reuse existing icra openCases and decision UI for one objection, timed court review, settlement during review and a confirmed unpaid claim. Only live owed is confirmed; no valid debt is forgiven or recreated. Duration/300 indexed-budget cost explicitly fictional game rules, not Turkish legal advice or fees.
- Suspend both asset seizure and actual stall withholding during review; afterward retain existing notice/installment/haciz/D0 accounting. Existing family debt behavior unchanged; no new family liquidation.
- Optional format-1 review trace inside existing case payload; SAVE_VERSION 6 and V5/V6 notices preserved. TR/EN/PL and existing 1280/390 browser matrix extended.
- Depends on #179 after #178. This is only the objection/review increment, not full foreclosure, criminal trial, lawyer or wage-garnishment completion. Next: secured-property loss with one conserved liability; then tax/SGK/pension connections. Salary negotiation, family financial liquidation, economic crises and new disasters remain excluded.


### 2026-10-19 — TC SIM court browser modal regression
- GitHub #180 TC job-start / built log (job 118073666645) failed at outcome-browser line 398: the saved family_late_night dialog legitimately intercepted dashboard navigation after an objection activated the next eligible event.
- Test now asserts the saved occurrence, reloads with the visible dialog, chooses truth through the real event button, verifies history/cash/debt and then navigates/settles. No forced click, removed overlay, cleared event, timeout increase or game logic change.
- Real UI regression reproduces objection → pending event → reload → choice → payment. Existing TR/EN/PL ×1280/390 assertions retained. SAVE_VERSION 6 unchanged.


### 2026-10-19 — TC SIM prospective social insurance / fiscal links
- Optional format-1 socialInsurance tracks completed catalog wage-job weeks prospectively, once per week/reload. Jobless, retired, serving, detained or deceased lives earn no modeled coverage. No invented past contributions or statutory day conversion; this is explicitly a game record, not an SGK statement.
- Existing retirement eligibility/amount rules retained for V5/V6 compatibility; eligibility report exposes observed coverage separately from legacy work experience. No new payroll deduction: net salary remains net.
- Existing settled business tax and pension are read-only alongside coverage on the current career panel; no second tax collection or speculative profit reported. TR/EN/PL and 1280/390 browser coverage extended. SAVE_VERSION remains 6.
- Remaining: actual employer contribution/payment/legal coverage simulation is not claimed; no real Turkish rates or eligibility claims introduced. Mortgage foreclosure/full enforcement remain separate unfinished finance scope. Excluded salary negotiation/family liquidation/new crises/disasters untouched.

### 2026-10-19 — TC SIM insurance browser navigation correction
- #181 job 118089512829 timed out at outcome-browser line 384: Career was inside the collapsed mobile More navigation after switching to Banks. It was hidden, not blocked by an event or missing from the game.
- Use the existing visible More button before Career, matching existing Bank navigation. Keep all six TR/EN/PL ×1280/390 coverage/financial/save assertions. No force click, timeout change, UI or game engine modification.


### 2026-10-19 — TC SIM secured mortgage enforcement + actual acceptance
- Defaulted modern mortgages now open a claim backed by the actual loan, prioritized over recurring living-cost arrears so enforcement cannot starve. No second loan/claim liability. Legacy interest-free V5/V6 loans retain their existing terms.
- Existing notice/review/cash collection reused. Only linked collateral sells at an explicitly fictional 80% game value; interest-first settlement, player surplus and D0 deficiency/cap overflow conserve liabilities. Unrelated arrears stay intact. Early repayment, delinquency cure, voluntary sale or one existing restructure reconcile/withdraw the claim; no phantom future foreclosure.
- New actual advanceWeek acceptance: 3 seeds ×5 profiles ×720 weeks, separate 1200-week/25-game-year run and actual job-loss→notice→foreclosure chain. Real choices and periodic save/load, no mid-run funding/health/event/clock resets. Failed fixture setup was corrected before reported acceptance. Not physical-device or full legal-system proof.
- Existing TR/EN/PL ×1280/390 browser gate adds real foreclosure click/save/reload; same UI, SAVE_VERSION 6. The full court/evidence/lawyer process and statutory SGK detail remain PARTIAL/MISSING, not silently completed or deferred.


## 2026-10-19 — TC SIM prospective wage collection (dependent on #182)

- Reuse the existing icra notice, payment accounting and salary settlement. Optional existing-dashboard decision arranges collection of 20% of actually posted net wages after the notice deadline. This is an explicit fictional game arrangement, not statutory Turkish wage attachment or a complete court order.
- No upfront fee, new tax/SGK withholding, loan forgiveness, pension attachment, cash creation or change to existing installment/foreclosure defaults. Every payment reduces the same source claim; unrelated arrears remain. One period marker inside existing case payload survives reload; SAVE_VERSION 6 and neutral V5/V6 notices preserved.
- Existing UI/components and TR/EN/PL overlays reused; browser matrix adds arrangement click/reload and zero immediate charge at 1280/390. Domain tests cover source conservation, actual month close, exhausted cash, paused income, legacy notices and early payoff. Full court/attorney/evidence and statutory SGK remain PARTIAL; involuntary wage attachment remains distinct from this arrangement.
- Frozen 61-source guard is consciously re-pinned only for icra/time hooks. No other game, art, atlas, site optimization or excluded mechanics changed.


## 2026-10-19 — bounded compulsory wage attachment after #183

- Reuse the existing wage payment writer for an automatic order after an unanswered unsecured notice expires, including the renewed period after review. Supported private wage jobs from the modeled 2003 gate use at most one quarter of actual net salary; existing voluntary20% arrangements remain unchanged. Official ÇSGB source and fictional scope/timing distinctions are retained in docs/tc-sim/FINANCE_LEGAL_GAPS_2026-10-19.md.
- Mortgage foreclosure and surcharge/cap-overflow D0 settlement remain on their existing paths. No second salary/SGK charge, pension/public wage attachment, debt deletion, new screen or SAVE_VERSION change. Existing payload stores compulsory flag; V5/V6 notices remain loadable.
- TR/EN/PL existing case label/banner; real browser matrix adds actual week-close automatic transition and reload at1280/390. Full61-source guard retained, re-pinned only for approved icra hook. Full court and legalSGK still not DONE.


## 2026-10-19 — bounded court evidence, counsel and source-fine finality

- Existing icra decisions now offer source-record inspection (one weekly action, no money), one optional500 game-budget legal-support fee, and one two-week extra review after the first decision while the notice deadline is open. Current source debt/claim is shown in the existing cases panel with an explicitly dated snapshot label. Review uses live unpaid debt; no random waiver or second obligation. This is a bounded game review, not statutory appeal/trial completion.
- Reproduced existing defect: paying1500 fine left the source risk file pending, allowing the identical fine to reopen. New fine claims carry sourceCaseId and mark only their fine representation as assigned; risk proceedings remain pending, any residual arrears remain collectible. Legacy source identities are not guessed.
- TR/EN/PL and real1280/390 UI matrix cover inspection/counsel cost/reload, existing modal resolved via real choice. Four new regressions cover repeated-fine prevention, no-charge evidence, one fee, bounded appeal/live balance, invalid decisions and V5/V6. SAVE_VERSION6 preserved; full61-source guard re-pinned only for approved icra changes.


## 2026-10-19 — prospective modeled service days and employer records

- Add optional version1 service metadata inside existing socialInsurance: observed days, last modeled contract and bounded per-job employer proxies. Supported private catalog jobs from2020 only; four decision weeks allocate8/7/8/7 days, a stated game assumption giving30 for a full modeled month. Actual official partial-month reporting is calendar-based, not this allocation. No past coverage inferred from old weeks or experience.
- Reuse completed-week dedup/exclusions. Unsupported job/year, unemployment, detention, service and retirement add no modeled days. No premium payment or official employer filing is invented. Current net salary has no second charge.
- Existing pension age/abstract480-or240-week criteria now accept the greater of old experience and modeled service equivalent, never their sum; old entitlements preserved. Not statutory Turkish retirement eligibility. Existing Career panel receives authored TR/EN/PL service/status/contract counts.
- Tests cover30-day modeled month, job switch, reload, excluded work/history, future format, pension double-count prevention and three-language read-only output. Browser matrix checks actual persisted days and panel1280/390. SAVE_VERSION6 and full61-source guard retained with only approved life/social-insurance changes.


## 2026-10-19 — Package 2 detained work consistency (depends on #186)

- Reuse existing detention boundary: no job energy/stress, commuting load or family experience while detained; existing education and non-work consequences remain. Salary, coverage, career progression and actual worked experience now agree. Release restores work, with existing once-per-week dedup.
- Deterministic V5/V6 migration/reload/release tests verify cash neutrality, salary, coverage, experience and SAVE_VERSION6. No schema, UI or finance feature added. Full frozen inventory retained; only authorized life.js bytes re-pinned.
- Finance release remains gated on #186 fresh required CI and canonical deployment; this dependent change must not merge first.


## 2026-10-19 — Package 2 detention and occupational health

- Reproduced high stress during detention taking occupational overwork44→47 and creating an overload warning despite no worked week. Reuse existing detention boundary in body-systems.js to remove only the automatic occupational contribution. General stress, under-recovery, inactivity, care, delayed cases and release-time work remain. No new health model or UI.
- Deterministic V5/V6 migration/reload/release tests first failed on the old engine, then passed after the two-line runtime change. Cash and SAVE_VERSION6 unchanged; full frozen61-source guard retained and re-pinned only for body-systems.js. Independent from #186/#187 runtime edits; merge serialization still required.


## 2026-10-19 — Package 2 unavailable weekly career decisions

- Proven bypass: canApplyDecision rejects non-rest activity during detention, but weekly job-offer, resignation and home-move actions still changed work, money and time. Reuse existing isDetained in canUseWeeklyAction only; no new state or rules. Event-driven relocateHome remains distinct from player moveHome; education enrollment retains its explicitly tested zero-slot design.
- V5/V6 migration/reload/release regressions cover declined action atomicity, restored decisions and existing one/two-slot costs. Existing UI, fees, salary, loans and SAVE_VERSION6 unchanged. Full61-source guard kept, re-pinned only for this approved life.js change. Release follows #187 and #188 with canonical reconciliation and fresh mandatory CI.


## 2026-10-19 — unpublished bounded work recovery preparation

- Critical health can use existing300-budget Body care to begin a two-decision-week recovery plan with modest+4 health, preserving old care effects otherwise. Existing health-warning clinic choice remains separate, costs250 and is reused by browser QA. Workload, commute, experience, career progress, overtime and observed-work coverage pause; job and existing monthly salary arrangement remain. No new premium, benefit or debt rule. This is an explicit game policy, not a legal sick-pay or medical prognosis claim.
- Optional body.workRecovery version1(startWeek,untilWeek=start+2) persists acrossV5/V6; absent old state stays absent, unsupported/malformed/future records reject. A date alone never returns critical health to work; recovery ends only after minimum time and health above existing critical threshold. No schema/SAVE_VERSION bump. Existing education commitments and general illness/stress/health consequences remain.
- Existing Body risk/detail slots show authoredTR/EN/PL recovery status, no new screen/style. New real advanceWeek/save/load tests and1280/390 browser scenarios prepared. This branch includes #187–189 dependencies and is not a fourth open PR. Browser execution and canonical reconciliation remain required before release.

## 2026-10-19 — #190 browser fixture sequencing recovery

- Exact built-browser failure: tc-sim-job-start-outcome-browser.mjs536 attempted Body navigation while event-backdrop correctly blocked it. Domain reproduction proves care→health_warning/clinic→job_security_warning/recover→no active event, cash9450. This is a legitimate queued event, not infrastructure or a UI regression.
- Browser scenario now asserts the chained career event, selects its real recover button and waits for modal closure before reload/navigation. No forced click, overlay removal, event reset, game-code change or skipped check. Domain/save regression protects the chain. Prepared V5/V6 overlap acceptance is included with this necessary head update, avoiding a separate CI restart.


## 2026-10-19 — Package 3 promise-to-reputation preparation
- Separate feat/tc-sim-promise-reputation branch from canonicale96a207. Existing social-obligation success/failure already updates NPC trust and memory, but omitted circle reputation. The exact-once resolution now calls the existing bounded reputation evidence recorder using the same source-case ID and NPC circle. No new screen, action, save field, finance or schema.
- V5/V6 real fulfillment and deadline-event tests cover fee/trust/memory/evidence, isolated circle, save/reload and atomic refusal on replay.49/49 targeted social/depth3/frozen-source testsPASS; lint/typecheck/buildPASS. Full61-source guard retained, re-pinned solely for the approved social.js diff.
- This is prepared, not DONE/released. Browser QA, canonical reconciliation after191/192 and mandatory CI remain required before merge. No new PR opened while current releases finish.

- Prepared real Chromium TR/EN/PL×1280/390 kept/broken promise cases using the existing People action and due-event buttons; verify circle evidence, NPC memory, exact fee and no reload replay. Execution remains required; not claimedPASS.

## 2026-10-19 — Package 3 partial friend-loan accountability (prepared)
- Separate branch from canonical52e57f0; depends on Package2/#190 closure before merge.
- Existing 1000TL friend loan wrote lent_1000 memory, but delayed collection only accepted lent_2500. Both existing loan sizes now use the same collection/forgiveness and six-week social follow-up; no new debt ledger or save fields.
- Amount-neutral existing event copy with EN/PL mappings. Exact-once collection, saved NPC memory and follow-up tests cover both sizes. Existing reference promise/broken-promise delayed scenarios retained.
- SAVE_VERSION6/UI/financial engine unchanged; 61-source frozen guard re-pinned only for the authorized events.js diff. Browser/required CI and canonical dependency remain release gates.

- Added real Chromium TR/EN/PL×1280/390 partial-debt collection/reload/memory/follow-up assertions to the existing TC browser gate. Draft PR needed to trigger that workflow; no PASS claim before execution.


## 2026-10-19 — Package 3 network source liveness
- Independent branch from released191 a5de48b. Proven V5/V6 defect: deceased Burak remained in getNetworkContacts and could supply a new reference/favor. Filter deceased contacts, guard new favor/opportunity creation, and suppress new Burak/Selin source offers. Existing memories, cases, favors, cash and debt are retained; no retroactive cancellation.
- Before-fix V5/V6 tests failed with dead contact still active; after-fix47/47 social/depth3/frozen testsPASS, lint/typecheck/buildPASS. Living/dormant/circle behavior and save/reload retained.61-source guard re-pinned only for approved depth3-systems/events changes. No new save fields/UI/copy.
- Chromium/mandatoryCI remains release gate. Ordered after192/193, with canonical reconciliation before merge. This does not claim criminal records or a statutory court simulator are complete.

## 2026-10-19 — prepared PR-only TC ownership routing
- Measured bottleneck follow-up, separate branch and no fourth PR: TC test-only files and the TC outcome harness were classified as generic scripts, causing unrelated campaign/duel browsers on PRs. Added narrow pull_request ownership exceptions; management-desk unit guard covers both TC and DEVLET, and the Polish dictionary is loaded by data-game route.
- All npm tests still run, all required jobs/gates preserved, shared EN/i18n-runtime/workflows/unknown helpers still select full, and push/main retains the original full classification. No runtime/game/save/assets changed.
- Real193 diff CLI comparison: PR routes TC+DEVLET, main remains full; routing/required-gate tests27/27PASS. No wall-time gain claimed before an actual completed after-run. Pending checks on existing192/193/194 must not be restarted solely for this preparation.

## 2026-10-19 — CI preview and deployment readiness
- Separate infrastructure-only branch: measured five CI runs and retained raw queue/job/step evidence in docs/ci/CI-RECOVERY-2026-10-19.{md,json}. No execution speedup claimed.
- Exact built Wrangler preview avoids Nitro fixed10s proxy deadline; bounded real HTTP readiness detects exit. TC production browser waits for all7 candidate fingerprints before launch, retaining its original strict assertion.
- Required job names/gates, test sets, historical/soak coverage, gameplay/UI/assets/SAVE_VERSION unchanged. Readiness/routing/required-gate tests32/32PASS; full CI and actual preview evidence remain release gates.

## 2026-10-19 — Package 3 source-linked noncustodial fight verdicts (prepared)
- New fights alone prospectively capture a confirmed game-event fact and schedule a hearing; old cases, health, police reports and detention never receive inferred convictions. Existing event/calendar choice flow supplies ordinary or one extra review, then an explicit final decision. Unverified evidence produces no new claim. This is bounded authored gameplay, not statutory criminal procedure; custody sentencing, criminal counsel and broader offences remain outside this increment.
- Only final proven new-case decisions open the existing1500-TL enforcement claim. Existing immediate fight cost and legacy fine/debt/mortgage accounting remain. Payment closes the linked source without deleting the retained final record. One-time living-mother memory/trust consequence and a one-week new-job delay for26gameweeks; successfully starting a new job removes that delay, preserving history. At most32 retained recent verdicts.
- Optional flags.criminalJustice(version1,records) and source payload justice(version1,stage,evidence) persist through existing V5/V6 storage; new criminal-hearing calendar case joins the existing scheduler. SAVE_VERSION6 remains. Full frozen inventory intentionally62 with the new focused helper; other games remain guarded. Existing UI is reused; TR/EN/PL copy and six Chromium viewport/language cases prepared.
- Targeted source/review/clearance/detention/replay/career tests8/8 and combined finance/health/save/language/frozen70/70PASS. Fresh lint/typecheck/build, actual Chromium and canonical dependency integration remain gates. Release after #194 and #196; no claim that Package3 is fully closed.

## 2026-10-19 — Package 3 bounded risk disengagement
- Existing heat had no player-selected exit path. Reuse the weekly RISK_DECISIONS list and risk record: one action starts thirteen consecutive clean decision weeks; completion reduces heat by one, grants a living mother's bounded trust/memory consequence, and never pays cash or clears cases/debts. New risky action or detention cancels the plan. Same-week replay cannot advance it; skipped weeks reset continuity.
- Optional risk.disengagement(startWeek,lastWeek,cleanWeeks) validates prospectively through existing V5/V6 normalization; absent old saves stay absent, malformed/future progress rejects. SAVE_VERSION6 unchanged. This is an explicit authored game recovery policy, not legal rehabilitation/expungement or a conviction model.
- Before implementation five deterministic cases failed; afterward5/5 and existing risk/actual TR/EN/PL translation API cases14/14PASS. Existing medical/detention callbacks retained.61-source frozen guard re-pinned only for risk-layer.js. Actual Chromium TR/EN/PL×1280/390 real decision/save/reload cases added to the existing browser gate; browser PASS is still required.
- Separate from pending #195 and #194, to merge only after their canonical reconciliation and mandatory gates. No new screen, finance engine, salary, crisis, asset or card changes.
