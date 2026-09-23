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
