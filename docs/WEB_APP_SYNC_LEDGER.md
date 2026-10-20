Warning: truncated output (original token count: 38295)
Total output lines: 996

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
- **Unavailable-action reasons.** New `public/games/duel-core/explain.js` turns an engine rejection code plus the live state into a specific sentence: which phase you are in and which would work, how many zones are actually free, the level-to-tribute count, the cost against the points held, turn one versus the wr…20295 tokens truncated…es and early payoff. Full court/attorney/evidence and statutory SGK remain PARTIAL; involuntary wage attachment remains distinct from this arrangement.
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

## 2026-10-19 — final verdict custody and return-to-work integration
- Same source-linked fight lifecycle: first conviction remains noncustodial; repeat final fight convictions invoke an explicitly authored two-game-week custody policy, disclosed before hearing. Detention alone never creates a sentence. Optional custody(sourceCaseId,startWeek,untilWeek) requires a retained final source record and bounded valid dates; malformed/future/unproven custody is discarded.
- Existing isDetained work/commute/decision/service gates include proven active sentences. Completion records servedWeek once, reopens ordinary work, preserves conviction/debt, and lets the existing job-start reentry hook restore opportunities. A pending accepted job is deferred with its original source until release; queued early start is removed and direct completion during sentence rejects. No salary benefit, debt cancellation, new screen or statutory sentence claim.
- V5/V6, repeat vs first verdict, work/salary pause, exact release, pending-job deferral and malformed-custody tests4/4PASS; combined legal/risk/recovery/real-translation28/28PASS. Real browser scenario uses actual first fine payment, second fight, hearing/review, two custody advanceWeek calls, service-counter pause and reload for all TR/EN/PL×1280/390 contexts. Required Chromium remains a release gate. This closes the bounded custody/reentry part of the same Package3 verdict increment; full criminal law remains outside the claim.

## 2026-10-19 — Package 3 canonical acceptance / final-custody stall gate

Canonical #197 source passed 156 targeted and 17 real long-play acceptance tests; released-head Chromium passed. Additional city integration reproduction proved that final custody still allowed `tendShop`: the old stall gate read only pretrial `detainedUntil`. Reuse the existing `isDetained` predicate in `quarters.js`, which already distinguishes final source-backed custody from unproven detention. Army handling, delegation, prices, UI text, saves and debt are unchanged. V5/V6 regressions prove no cash/time/attendance mutation while serving, then ordinary attendance after release. Existing TR/EN/PL 1280/390 Chromium court scenarios now check the stall disabled during custody and perform a real visit after release; legitimate social follow-up is resolved before navigation. Frozen inventory stays 62 and only this authorized runtime source changes. Local 199/199 targeted, 17/17 long-play, lint/typecheck/build PASS; real Chromium and required CI remain release gates. Canonical report: `docs/qa/TC-SIM-PACKAGE3-ACCEPTANCE.md`. Package 3 is not declared DONE while this repair or production gates are pending. No Package 4 implementation yet.
## 2026-10-19 — Package 4 preparation: observed work fuel within the existing car budget

Independent branch based on canonical 1c38718; depends on #198 closure and Package 3 canonical acceptance before merge. Existing car budgets (3200/5200/9200 TL) are retained as conservative monthly affordability forecasts. Game policy allocates 60% to four possible observed work-commute weeks, 40% to the fixed reserve (insurance not implemented separately yet). Actual fuel posts through the existing life-week idempotency guard and monthly-cash ledger only for a valid working, non-retired, non-army, non-detained/non-sentenced, non-recovering car owner with a nonzero pre-car commute. Same-week replay/reload cannot post twice. Month close bills only the fixed reserve; it does not charge fuel again. Public work-transport fare is zero while a car is owned; social visit tariffs are unchanged. No historical usage is invented for V5/V6, no new persistent fields or SAVE_VERSION change. This models work fuel, not personal travel mileage, real petrol prices or statutory insurance premiums. TR/EN/PL actual-ledger copy is included. Existing Chromium TR/EN/PL ×1280/390 scenarios add an actual week advance and fuel/reload assertions. Local targeted and long-game results are recorded in the PR; actual Chromium/required CI remain gates. No Package 3 closure or fuel release is claimed prematurely.

### #199 reconciliation after #198 / proven Polish label regression

Reconciled with canonical d980a14, retaining the final-custody stall gate and its V5/V6/Chromium regressions. Both failed built browser runs (39329321633 and 39329644969) asserted English `Work commute fuel` versus expected Polish at line614. Cause: contentLang deliberately falls back to English for Polish content; vehicleExpenseLabel now prefers the actual selected getLang. The regression stub models getLang=pl and contentLang=en; assertions remain strict. No deployment-race claim, retry, forced click or test relaxation. Canonical Package 3 combined 199/199 and 17/17 long-game PASS; Vercel d980a14 READY and production browser39331805289 PASS. Main CI39331805304 was still running at this checkpoint, so final release closure remains gated.

### Package 3 canonical closure on d980a14

Canonical combined 199/199 +17/17 actual long-game PASS; production Chromium39331805289 PASS on www/Workers; Vercel canonical READY and Workers quarters/criminal-justice byte hashes match. Package 3 DONE within the explicit authored game scope; full statutory criminal law remains partial and physical-device acceptance UNKNOWN. Main39331805304 site-wide Cete browser was still in progress; no claim that unfinished job passed. Updated the single canonical report `docs/qa/TC-SIM-PACKAGE3-ACCEPTANCE.md`. Package 4 #199/#200 remain gated by fresh current-head CI and upstream reconciliation.
## 2026-10-19 — Package 4 preparation: separate vehicle insurance allowance

Dependent on the observed-fuel branch, #198 and Package 3 closure; not an independent release. Reuse the fixed 40% vehicle reserve: half is the monthly insurance allowance, half upkeep; the forecast total and four-week maximum remain exactly the old catalog budget. Premium posts once through the existing month-close guard and ledger, remains due for a parked owned vehicle, and stops prospectively after sale without refunding past costs. No new persistent policy fields or save version. TR/EN/PL ledger labels and V5/V6/no-duplicate regressions included; Chromium adds an actual month close and reload. This is a game-budget insurance premium allowance, not a verified real tariff, legal policy, opt-in coverage or implemented claim/indemnity system. Coverage/claims must not be marked DONE. Existing vehicle loss/forced sale, debt and other financial engines remain unchanged. Targeted 133/133 PASS; full PR validation is recorded separately. No new disaster mechanic.

## 2026-10-19 — Package 4 district risk visibility preparation

Reuse the existing district social/commercial-footfall coefficient and existing voluntary `risk-shortcut` action: social>=1.15 yields +2 attention, otherwise the legacy +1; absent location stays +1. The existing threshold2, 1800 TL earnings, subsequent detention and1500 TL detention cost remain. A busy selected district therefore allows one earning before the existing consequence instead of two. Merely living/moving/working in a district never produces heat, a case, guilt or a charge. This is authored game visibility, explicitly not measured crime rates or a legal assertion. No random weekly incidents or new disaster. Map selection uses the existing context-note component to explain +1/+2 before action, with direct TR/EN/PL copy using actual getLang. Successful illicit choices retain the explanation in existing bounded memory; old pressure is never erased by moving. No new persistent fields, source inventory or SAVE_VERSION change. V5/V6 replay, cash/debt, investigation-not-conviction and existing13-week recovery remain protected. Local204/204 targeted and17/17 long-game PASS; lint/typecheck/build and actual Chromium are required PR gates. Existing real Chromium matrix adds selected-map explanation, no-overflow, actual decision, pressure/cash and reload assertions. This independent branch must reconcile after #199/#200 before release.

### Package 4 combined acceptance preparation after #199

#199 released as14e50edd00eff73d479bc936844a92e0845d6129; source exactly matches the integrated fuel tree. #200 retargeted to main with canonical parent; source unchanged,143/143 +17/17 rechecked. Separate integration merges insurance and district visibility, retaining all Chromium scenarios and ledger entries;273/273 targeted +17/17 long-game PASS. Canonical/production closure still requires current-head CI and sequential release. Integration is a checkpoint branch, not another open PR. Claims/indemnity and physical QA remain explicitly outside DONE claims.

## 2026-10-19 — Production finance fingerprint coverage recovery

Canonical #199 www browser39334966484 job118342038736 failed at22:31:06 UTC: expected one actual fuel row, observed zero. Workers job118342038894 passed. Vercel production dpl_CH2TSqwgxKXwnpVSs78WVQFaugP1 for14e50ed became READY only at22:32:31.616 UTC, after the failed browser assertion. All original7 fingerprint assets are byte-identical between d980a14 and14e50ed, so the readiness gate could accept the previous deployment while life/wealth/location finance modules were stale. Current www/Workers life.js and wealth.js match canonical bytes. Retried only the failed completed www job once after this proof; no gameplay patch or forced click.

Small CI-only repair adds life.js, wealth.js and locations.js to exact candidate fingerprints (7→10). Strict origin/HTTP/redirect/hash checks, bounded readiness, all browser scenarios, main full regression and required job names remain unchanged. The stale-asset loop now verifies each added module; readiness request count derives from the full path list plus the rejected attempt. No tests removed/skipped; no speed gain claimed. Seven targeted CI tests PASS; lint/typecheck/build are PR gates. No game, save or asset optimization changes.


## 2026-10-20 — JITEM prior-help/betrayal source sync

Upstream PR #24 merged at 3e8131c1a7f1f1ae43b9090ffc42a05d551c43a8. Exact clean-checkout integration build changes only assets/runtime.js; SOURCE.json pins that commit and the SHA-256 receipt. Existing actor help remains one-shot but no longer suppresses a later betrayal's existing talk/leak consequence. Upstream 283/283 tests, lint/typecheck/build and real Chromium atlas 7/7 + product 8/8 PASS (run 39406612540). Existing key jitem-derin-ag-v3/schema 5, visuals, sources and shell preserved. Product integration requires its own current-head CI PASS and post-merge production hash verification. IHTILAL stays live pending verified transfer and archive gates; no source or user saves removed.


## 2026-10-20 — JITEM historical actor liveness sync

Upstream #25 merged at 1171d15aff54a2758c46c514455bb2795014572f. New build from this clean SHA adds only the existing dead-actor guard to the generated memory loop; other generated assets remain byte-identical. Existing history, faction knowledge, source-backed delayed events, save key/schema and visual design remain preserved. Source tests 285/285, lint/typecheck/build PASS; real Chromium atlas 7/7 + product 8/8 PASS, run 39408656535. SOURCE/runtime receipt and product integration tests bind the exact SHA. This product sync depends on #203; reconcile with its merged main and require current-head CI before merge. IHTILAL is not archived/unpublished.

## 2026-10-20 — JITEM support payoff eligibility sync

Upstream #26 squash merged as 37c5416e7a49b2ecc998f0d1071a7484d6e508c0 after 288/288 tests, lint/typecheck/build and Chromium 7 atlas + 8 product + 12 support payoff cases PASS on head 2657665d6a5574ffb6ae106bb5db054e6453fa05 (run 39414832356, artifact 12261440776). Built from that merged source with lockfile-matched installed dependencies. Only runtime.js differs among generated assets. SOURCE receipt and integration pin updated; schema 5, save key, visuals, content, routes and shell preserved. Product release and live semantic acceptance require current-head CI and post-merge verification. No IHTILAL/Kiyi removal or transfer code.


## 2026-10-20 — JITEM three ADAPT groups

Standalone #27 (2a07f673fff67779326ec38fa561d59c3850dae4), #28 (042e5f489ad35dc29d723595e681a87d185181d6) and #29 (e1d5bf742d012ef9355f7d822fa31bc896cd7c8d) passed their exact-head CI and squash merged. They add only validated plan saves with previous valid backup, deterministic simultaneous due outcomes and unavailable personal-contact handling, and existing relationship risk in the existing ally rumor roll. No engine replacement, new saved-state fields, visuals, content or portal layout changes. Final upstream: 307 tests, lint/typecheck/build and 63 real Chromium cases PASS (run 39423394167, artifact 12264883127).

The unchanged embed builder changes only runtime.js among 30 generated files. SOURCE.json and integration source pin bind the runtime to merged source; save jitem-derin-ag-v3/schema 5 remain. Prior #26 production close is recorded separately: TarikLab main cfa6d8c run 39417501337 fully PASS, www 36/36, Workers 32/32, both 31/31 hashes. This sync still requires its own current-head CI, merge and production evidence. IHTILAL remains live until all three ADAPT groups are accepted in production; Kiyi Esigi/Racon sources untouched.


## 2026-10-20 — IHTILAL safe archive after ADAPT production acceptance

JITEM #27–29 are accepted in product #206, canonical a31c85940f1fa5e54b68ca4887dfdc5631a072ff. Real Chromium www72/72 and Workers72/72, both31/31 file hashes PASS (run39426926311; www artifact12265808619, Workers artifact12266182758). Source e1d5bf742d012ef9355f7d822fa31bc896cd7c8d and runtime31deba68d1bcc5cd7cef9c813bd033a11b3cc1a40c95fee3c74918a998ad18f4 are unchanged by this archive. Local direct Workers HTTP403/error1010 is recorded separately from exact-origin Chromium PASS.

Named archive/ihtilal-pre-retirement-20261020 ref was created at a31c859 and read back from GitHub before this PR. Manifest retains 47 source/dependency/provenance files, including all18 IHTILAL files, the old card engine, shared runtime/Pixi, locales, Kiyi Esigi and Racon bytes. No source/assets/save keys are removed. The live catalog and Resources remove IHTILAL in TR/EN/PL; the existing old URL opens the preserved game with a localized archive notice and optional JITEM link. Active sitemap entries retire; the existing module network-first/offline fallback remains with portal cache v6.

Archive acceptance adds six real Chromium TR/EN/PL desktop/mobile cases and a strict production/ref receipt gate; existing game/campaign/save/language gates remain. One pre-existing test skip is unchanged. Native stays paused, audio stays disabled, physical-device acceptance belongs to the user. This separate archive PR requires its own exact-head full CI PASS before retirement and deployed archive/hash verification afterward. Kiyi Esigi remains live; Astra workspace untouched.

## 2026-10-20 — Wave 1 save repair integration

Integrated tested checkpoint aa490ba onto post-archive canonical 7c0643c65aa376fc292786b0303feb56a8082ec1 without conflicts. SON KOY accepts legitimate long histories; SON 100 GUN reports actual storage success and retries without repeating decisions; KAYIP TELEFON repairs recoverable UI pointers; AMIRAL BATTI validates nested saves and preserves invalid raw data. Existing save keys and formats remain. BUKUCU QA retains real-slot and saved-RNG fixtures; its runtime is unchanged. Added source and clean-built TR/EN/PL x 390/1280 save acceptance to required browser CI. No native/audio/card work. Exact-head CI and post-merge production acceptance are separate gates.

## 2026-10-20 — Wave 1 decision repair integration

Prepared checkpoint 5a6fc1a after save repairs: legitimate zero treasury survives DEVLET ticks, terminal actions remain no-op, Kapı Nöbeti uses the focused issue's system and consumes follow-up effects once. Existing fields/keys/schema, visuals, content and completed TC SIM remain. Targeted159/159 and Chromium source42/42 plus clean-built42/42 passed after the IHTILAL archive integration. Dedicated source/build workflow adds acceptance without reducing existing CI budgets. The runner now writes inside RUNNER_TEMP on CI. Final reconciliation with merged save main, exact-head CI, portal and production proof remain gates. IHTILAL production receipt is recorded separately.

## 2026-10-20 — Kiyi Esigi archive preparation

Retain the original coast runtime, map model/Pixi fallback, validated v1 saves, bounded corrupt recovery and source provenance. Catalogue status becomes archived, live Resources entries retire in TR/EN/PL, existing routes stay playable with the localized archive notice; the unrelated JITEM link remains specific to IHTILAL. Portal cache v7 retires stale active navigation without changing localStorage or game caches. Separate six-case coast Chromium acceptance preserves primary/backup/recovery and action/reload; existing IHTILAL and coast recovery gates remain. Release depends on both Wave 1 merges and final archive-reference/production verification; no source deletion or game rewrite.

## 2026-10-20 — Racon A preparation

Share district payment eligibility with the existing cash forecast, include eligible district/city shares and project street-manager loyalty before district pay. Existing amounts/order/costs unchanged; dirty-to-clean transfer remains excluded from income. A newly raised seal survives to the next weekly closing, preserves prepared jobs and still permits withdrawal. Same existing card, source/UI/map/save contract; new render copy gets TR/EN and scoped PL entries. 91 Racon +19 i18n tests, source/build60 existing browser checks each PASS. Independent preparation only; post-Wave1/Kiyi reconciliation, new locale/long-run and exact-head CI remain gates. No native/audio/card work.

## 2026-10-20 — Racon B preparation

Preserve injury/absence through fatigue; gate the existing three manager roles on ready/tired status without deleting assignments. Close unavailable police/tip papers using loaded state; remove closed-contact shield/tips, keep normal raid risk and paid current-week protection. Weekly tips and visible full shutter price are once-only and atomic. Existing coefficients, indictment interval, map/UI/content/save fields remain.121 scoped tests, source/built18 locale cases each, existing source/built60 menu checks each, built map47 and old long-run suite PASS; new saves remain readable by pre-repair main. Independent stacked preparation only; A and final integration/release gates remain required.

## 2026-10-20 — Cloudflare independent production release

Baseline main 9b5a06e349131d912baee1a7bb5ba86ced4a9b1e. Racon B production run
39466070754 failed exact index.html bytes because active Worker 1a0557a0 still
served A; verified main candidate de08ead6 was uploaded, not promoted. Main CI
39462047238 and TC 39462047566 PASS; candidate acceptance 39464279187 PASS.
Pin Wrangler, declare the existing Worker/domain/runtime configuration, preserve
dashboard secrets/variables, and gate production publication on exact current
main CI. Add reusable two-host acceptance with unchanged byte/gameplay checks.
No game engine, save format, art, audio or native changes. Vercel cleanup remains
gated on live acceptance; project deletion/domain transfer require separate approval.

### 2026-10-20 — PR #214 DARBE dependency provenance

- Pin only the exact reviewed package/package-lock blobs for Wrangler 4.151.3 and the two Cloudflare release commands. All protected gameplay files and inventory remain pinned to the immutable DARBE baseline.
- Machine-readable provenance records the 85 added tooling lock entries; every existing non-root lock entry remains byte-equivalent after JSON parsing. No game, save, art, audio or native content changed.
- Release still requires exact-head CI and exact-main CI/TC plus both-host production acceptance. Local 127.0.0.1 EPERM failures are environment restrictions, not a test PASS.
