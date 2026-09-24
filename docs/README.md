# TarikLab Documentation

This is the map of TarikLab's documentation. It follows the canonical game
catalog in `src/lib/games.ts` — if a game is added, removed, or its status
changes there, update its row here in the same change.

Status here always means "as implemented in the current game catalog," not
any older design document's plan.

## Product posture

- **Post-launch repairs:** [POST_LAUNCH_UPGRADE_SWEEP.md](POST_LAUNCH_UPGRADE_SWEEP.md) records the narrow PWA, İHTİLAL interaction/accessibility and dependency updates after closure.
- **Final closure:** [ASTRA_GLOBAL_FINAL_CLOSURE.md](ASTRA_GLOBAL_FINAL_CLOSURE.md) records the accepted release under the owner's final completion override, with executed QA, regression coverage and infrastructure limitations separated explicitly.
- **Frozen baseline:** [MASTER_FREEZE_CHECK.md](MASTER_FREEZE_CHECK.md).
- **History:** [archive/](archive/) contains superseded handoffs and audits; historical findings are not automatically current defects.

- **Active product:** [www.tariklab.com](https://www.tariklab.com) (this repo).
- **Native/Godot:** paused. Do not continue unless the product owner explicitly restarts it.
- **Download model:** each game will later ship as its **own** standalone downloadable title — not one giant native TarikLab app.
- **Parity:** Web ↔ Native Content Parity is binding. After a meaningful website change, append [WEB_APP_SYNC_LEDGER.md](WEB_APP_SYNC_LEDGER.md). Web does **not** wait for native.
- **Canonical shared content:** private `tayaz-maker/tariklab-content`. Web and native bundle copies.
- **Audio:** disabled.
- **Safety:** never remove existing website games, content, data, or routes because of native work.

In the table below, “native app” for Çete Savaşları means a first-party React route (not an `/oyna/` iframe). It is **not** Godot.

## Live Games

| Game | Slug | Route | Docs | Runtime | Notes |
|---|---|---|---|---|---|
| Çete Savaşları | `cete-savaslari` | `/cete-savaslari` | [docs/cete-savaslari/](cete-savaslari/TECHNICAL_CLOSURE_CHECKPOINT.md) | `src/` (native app, not an `/oyna/` iframe game) | Flagship game; its own route, not the `/oyna/$slug` pattern. |
| HANEDANIAN | `hanedanian` | `/oyna/hanedanian` | [docs/hanedan/](hanedan/README.md) | `public/games/hanedanian/` | Seeded strategy map, local simulation and IndexedDB saves. `/oyna/hanedan` remains an alias; the original game remains at `/games/hanedan/legacy.html`. |
| Racon Manager | `racon` | `/oyna/racon` | [docs/racon/](racon/SPEC-V1-ORIJINAL.md) | `public/games/racon/` | |
| TC SIM | `tc-sim` | `/oyna/tc-sim` | [docs/tc-sim/](tc-sim/TC_SIM_MASTER.md) | `public/games/tc-sim/` | Reference engine for the "Life Sim" family (see Shared Systems). |
| Son Mahalle Bükücü | `bukucu` | `/games/bukucu/index.html` | [docs/bukucu/](bukucu/RAPOR.md) | `public/games/bukucu/` | Only catalog entry routed directly to a static path rather than `/oyna/$slug`. |
| Labirent | `labirent` | `/oyna/labirent` | [docs/tlab-classics/](tlab-classics/PROVENANCE_AND_LICENSES.md) | `public/games/labirent/` | Original TarikLab implementation; see provenance doc for what it replaced. |
| Tek Taş | `peg-solitaire` | `/oyna/peg-solitaire` | [docs/tlab-classics/](tlab-classics/PROVENANCE_AND_LICENSES.md) | `public/games/peg-solitaire/` | Original TarikLab implementation; see provenance doc for what it replaced. |
| Satranç | `satranc` | `/oyna/satranc` | [docs/tlab-classics/](tlab-classics/PROVENANCE_AND_LICENSES.md) | `public/games/satranc/` | Original TarikLab implementation; see provenance doc for what it replaced. |
| Amiral Battı | `amiral-batti` | `/oyna/amiral-batti` | [docs/amiral-batti/](amiral-batti/README.md) | `public/games/amiral-batti/` | Not covered by the Classics provenance doc — has its own entry. |
| Kapı Nöbeti | `apartman` | `/oyna/apartman` | [docs/apartman/](apartman/00_PRODUCT_IDENTITY.md) | `public/games/apartman/` | Reuses the Management Sim engine family (see Shared Systems). |
| Kayıp Telefon | `kayip-telefon` | `/oyna/kayip-telefon` | [docs/kayip-telefon/](kayip-telefon/00_PRODUCT_IDENTITY.md) | `public/games/kayip-telefon/` | |
| Son 100 Gün | `son-100-gun` | `/oyna/son-100-gun` | [docs/son-100-gun/](son-100-gun/00_PRODUCT_IDENTITY.md) | `public/games/son-100-gun/` | Reuses the Life Sim engine family (see Shared Systems). |
| JITEM: Derin Ağ | `jitem-derin-ag` | Sealed teaser | [docs/jitem-derin-ag/](jitem-derin-ag/00_PRODUCT_IDENTITY.md) | Not integrated | Coming soon; catalog card intentionally has no route. |
| TC SIM: DEVLET | `tc-sim-devlet` | `/oyna/tc-sim-devlet` | [docs/tc-sim-devlet/](tc-sim-devlet/TC_SIM_DEVLET_MASTER.md) | `public/games/tc-sim-devlet/` | |
| SON KÖY MANAGER | `son-kasaba` | `/oyna/son-koy-manager` | [docs/son-kasaba/](son-kasaba/IMPLEMENTATION.md) | `public/games/son-kasaba/` | Canonical play route `/oyna/son-koy-manager`; `/oyna/son-kasaba` remains an alias. Save id stays `son-kasaba`. |
| VETO-H! | `veto-h` | `/oyna/veto-h` | [docs/veto-h/](veto-h/README.md) | `public/games/veto-h/` | Shares the duel engine with GETT-OH! (see Shared Systems). |
| GETT-OH! | `gett-oh` | `/oyna/gett-oh` | [docs/gett-oh/](gett-oh/README.md) | `public/games/gett-oh/` | Shares the duel engine with VETO-H! (see Shared Systems). |
| İhtilâl | `ihtilal` | `/oyna/ihtilal` | [docs/ihtilal/](ihtilal/README.md) | `public/games/ihtilal/` | Original Kalem Masası ruleset. `/ihtilal` redirects here. |
| DARBE-H! | `darbe-h` | `/oyna/darbe-h` | [docs/darbe-h/](darbe-h/README.md) | `public/games/darbe-h/` | Third duel sibling. Shared engine, own 300-card pool. |

## Coming Soon

None. The catalog currently has no coming-soon titles.

## Retired / Archived

| Game | Docs | Retirement / Migration Notes |
|---|---|---|
| Hayat | [docs/archive/hayat/](archive/hayat/00_PRODUCT_IDENTITY.md) (pre-retirement design docs) | [docs/archive/HAYAT_RETIREMENT.md](archive/HAYAT_RETIREMENT.md) — removed from catalog and runtime; value migrated to TC SIM, see [docs/tc-sim/HAYAT_VALUE_MIGRATION.md](tc-sim/HAYAT_VALUE_MIGRATION.md). |

## Shared Systems

| System | Docs | Used By |
|---|---|---|
| Duel engine (`public/games/duel-core/`) | [docs/duel/DUEL_ENGINE.md](duel/DUEL_ENGINE.md) | VETO-H!, GETT-OH!, DARBE-H! |
| Next Wave engine families (`public/games/next-wave*`) | [docs/next-wave/](next-wave/00_MASTER_PLAN.md) | Apartman, Son 100 Gün, Kayıp Telefon, TC SIM: DEVLET (reuse references); TC SIM (Life Sim reference engine) |
| TLab Classics provenance/licensing | [docs/tlab-classics/PROVENANCE_AND_LICENSES.md](tlab-classics/PROVENANCE_AND_LICENSES.md) | Labirent, Tek Taş, Satranç |
| Web ↔ native sync ledger | [docs/WEB_APP_SYNC_LEDGER.md](WEB_APP_SYNC_LEDGER.md) | All games that will later have a standalone native build |

## Documentation Rules

- **Follow repository truth.** `src/lib/games.ts` (the `GAMES` catalog) is the
  source of truth for status/route; `public/games/` is the source of truth
  for runtime layout. Docs describe what exists, not what is planned.
- **One canonical doc per shared system.** Do not fork a second copy of the
  duel engine contract, the Next Wave reuse architecture, or the Classics
  provenance record into a per-game folder — link to the canonical doc
  instead.
- **Every catalog entry needs a docs link.** If a game is LIVE or COMING SOON
  in `src/lib/games.ts`, it must have a row above with a working docs link
  — either its own folder or an explicit shared-doc mapping.
- **Retired means retired.** A retired game's docs must not appear under
  Live Games or Coming Soon, and its retirement record must explain what
  happened and why, without deleting the design history that led there.
- **No speculative claims.** Don't write planned features as if implemented,
  don't state card/content counts without verifying them against the repo,
  and don't claim "production verified" without repository evidence for it.
- **IP safety.** VETO-H! and GETT-OH! are original implementations; never
  document them using third-party trading-card branding or copied rules
  text (see [docs/duel/DUEL_ENGINE.md](duel/DUEL_ENGINE.md) for the accepted
  framing).
- **Web ↔ native ledger.** Meaningful website changes go in
  [WEB_APP_SYNC_LEDGER.md](WEB_APP_SYNC_LEDGER.md) in the same change. Native
  follow-up is later; do not block the website on it.
