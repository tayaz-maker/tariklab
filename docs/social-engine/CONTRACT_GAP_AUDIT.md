# Four-contract audit — SOCIAL ENGINE

Current DARAMCIK build. Recalculated from the current isolated suite and named browser or simulation evidence; hardware, human and release gates stay separate.

## C01 — Rental, paid bus stops, parking capacity, traffic signals and junction reservations

**PASS** · GAME_DESIGN.md:77-85; TECHNICAL_SPEC.md:26-27

Funded transit, rental escrow, finite parking, directed-lane turns, deterministic signals, occupancy reservations and cross-lane/yield safety are implemented. Five focused traffic tests plus integrated mobility and real browser travel/rental controls verify these boundaries.

Code: mobility.ts; traffic.ts; domain/traffic.ts. Evidence: mobility.test.ts; traffic.test.ts; v4-browser/results.json.

## C02 — Clear/cloud/rain/wind weather and 0.5x/1x/2x time controls; cosmetic aging

**PASS** · GAME_DESIGN.md:197-205

Four seeded weather states and0.5/1/2wall-clock cadence retain fixed authority. Player age is cosmetic and visible in the life panel; NPC demography follows the higher-priority society contract.

Code: mobility.ts; family.ts; ui/app.ts. Evidence: mobility.test.ts; life-family.test.ts; v4-browser/results.json.

## C03 — Player heavy attack and dodge controls

**PASS** · GAME_DESIGN.md:65-73

Real G heavy-attack and Space dodge inputs use the same authoritative combat/stamina/cooldown rules.

Code: engine.ts; ui/app.ts. Evidence: v4-browser/results.json; simulation.test.ts.

## C04 — Daily XP ceiling, perk/unlock progression

**PASS** · GAME_DESIGN.md:41-49

One20point daily allowance covers all skill sources; professional perk requires five completed shifts and pays a backed wage bonus.

Code: progression.ts. Evidence: progression.test.ts.

## C05 — University lesson, club and school social hierarchy

**PASS** · GAME_DESIGN.md:125-133

Three attended courses and certificate-gated jobs coexist with a paid study club, actual attendance and earned hierarchy.

Code: life.ts; social.ts. Evidence: life.test.ts; social.test.ts; ui-browser/results.json; v4-browser/results.json.

## C06 — Faction membership/hierarchy, one leader, treasury, rivals, heat, personal loyalty and contested territory

**PASS** · SOCIETY_ENGINE.md:60; GAME_DESIGN.md:137-145

Three factions have unique leader/member roles, actual treasury accounts, rivals, heat, personal loyalty and bounded contested influence; dues and services transfer real funds.

Code: social.ts. Evidence: social.test.ts; v4-browser/results.json.

## C07 — False witness reports, limited police knowledge/capacity, separate arrest/custody/acquittal outcomes

**PASS** · SOCIETY_ENGINE.md:58,114; GAME_DESIGN.md:149-157,293

Twelve justice tests cover evidence-limited knowledge, two concurrent admissions and distinct legal outcomes. Weekly economy cannot settle or forgive pending NPC cases; queue wait cannot count as admitted investigation time. Both regressions failed before the fix and pass on current sources.

Code: justice.ts; social.ts. Evidence: justice.test.ts; social.test.ts; v4-browser/results.json.

## C08 — Stolen item provenance and victim inventory bound

**PASS** · SOCIETY_ENGINE.md:58

One existing stock unit is transferred without payment and linked to a real victim, item and incident. Only that unit can be returned once; a return does not erase evidence.

Code: simulation/property-crime.ts; UI shop and inventory; persistence fixtures. Evidence: property-crime.test.ts; property-browser-{chromium,firefox,webkit}/results.json.

## C09 — Guardians, dependents, bounded births/deaths/migration, tombstones and debt-first estates/inheritance

**PASS** · SOCIETY_ENGINE.md:29,64,115

Bounded births/deaths, adult guardians, capacity-safe housing/moves, nonrecycled identities and debt-first estates preserve custody, deeds and money.

Code: family.ts; life.ts. Evidence: life-family.test.ts; life.test.ts; v4-browser/results.json.

## C10 — Rumor source/confidence, repeatable salience decay, critical memories and familiarity/loyalty

**PASS** · SOCIETY_ENGINE.md:23,48,111; GAME_DESIGN.md:161-169

Rumor source chains and confidence, salience decay, protected critical memories, familiarity and loyalty preserve observer knowledge boundaries.

Code: social.ts; events.ts. Evidence: social.test.ts; v4-browser/results.json.

## C11 — Background scheduled travel arrivals, shop hours/queues, school routines and missed-work consequence

**PASS** · SOCIETY_ENGINE.md:31-44; TECHNICAL_SPEC.md:29-30

Abstract trips retain the departure location until actual arrival. Attendance governs wages, children commute to school, and shared bounded FIFO queues plus real business hours constrain purchases.

Code: economy.ts; services.ts; society.ts. Evidence: economy.test.ts; services.test.ts.

## C12 — Taxes, resource-constrained production, market demand/stock prices and district indicators

**PASS** · SOCIETY_ENGINE.md:52

Finite wholesale inputs and labor constrain funded production. Recorded demand and stock change prices; tax transfers and derived district indicators reconcile exact balances.

Code: economy.ts; ledger.ts. Evidence: economy.test.ts; ledger-sparse.test.ts.

## C13 — Bounded strikes, migration/public works and measurable district shock duration/severity

**PASS** · SOCIETY_ENGINE.md:64

State-driven strikes and funded public works have bounded duration/output effects; housing moves and distress affect employment and district indicators.

Code: economy.ts; life.ts. Evidence: economy.test.ts; life.test.ts.

## C14 — Exclusive participants AND locations, causal unresolved facts, choices/effects/fallback definitions

**PASS** · GAME_DESIGN.md:257-261; SOCIETY_ENGINE.md:68; TECHNICAL_SPEC.md:53-54

All20 causal branches are reached on current source using ordinary validated commands and simulated schedules; participant/location locks, choices, effects and fallback are validated separately. The reachability harness explicitly offers eligible events, so this is not a claim that the random scheduler selects every branch within seven days.

Code: missions.ts; domain/content.ts. Evidence: simulation-events.test.ts; quest-faults.test.ts; event-reachability/results.json.

## C15 — Inventory slot limit and unique item identity

**PASS** · GAME_DESIGN.md:185-193

Weight30 and12distinct stack slots constrain purchase/delivery atomically; owned item instances retain stable identity and consumption removes corresponding units.

Code: progression.ts; engine.ts. Evidence: progression.test.ts.

## C16 — Voluntary retirement endpoint without mandatory game over

**PASS** · GAME_DESIGN.md:221-229

Voluntary retirement freezes world time, preserves obligations and supports explicit return; no forced player game-over.

Code: progression.ts; ui/app.ts. Evidence: progression.test.ts; v4-browser/results.json.

## C17 — Replayable durable command-journal tail and corrupt-tail quarantine

**PASS** · SOCIETY_ENGINE.md:80-88,117

Four current browser journal cases pass, including the original100000tick burst, exact-tail reload, concurrent-tab conflict and WebGL-loss recovery. QA stepping yields between fixed500tick chunks without changing authoritative order; production QA remains disabled.

Code: persistence/journal.ts; persistence/repository.ts; ui/live-journal.ts; ui/save-queue.ts. Evidence: persistence-journal.test.ts; live-journal.test.ts; save-queue.test.ts; journal-browser/results.json; persistence-browser/results.json.

## C18 — Per-object schemaVersion/updatedTick, separate rules version, immutable profile store, bounded delta projection

**PASS** · GAME_DESIGN.md:13-15; SOCIETY_ENGINE.md:29,82; TECHNICAL_SPEC.md:35-36,136

Normalized records have identity/schema/reconciliation tick; immutable profiles have one persisted owner and separate rules version. Worker projections are bounded full views; ADR9 documents representation semantics and avoids claiming true field-delta encoding.

Code: persistence/records.ts; persistence/codec.ts; worker/runtime.ts. Evidence: record-snapshot.test.ts; worker.test.ts; ADR9.

## C19 — Priority heap, spatial hash, hierarchical routing, route invalidation, offscreen scheduling

**PASS** · TECHNICAL_SPEC.md:23-30; SOCIETY_ENGINE.md:74

ADR10 documents cached static A*, deterministic sorted arrival commitments and bounded local scans in place of proposed heap/spatial-hash hierarchy. This credits the justified algorithm choice only; it does not approve unmet performance budgets.

Code: domain/world.ts; economy.ts; society.ts. Evidence: world.test.ts; ADR10; capacity-10000/results.json.

## C20 — Reduced-fidelity main-thread worker fallback; optional-asset placeholder/retry

**PASS** · TECHNICAL_SPEC.md:32-33,59-69

Reduced-visual-fidelity main-thread fallback preserves the same domain state. Optional props have bounded placeholder/retry behavior. Five real headless WebGL create/render/destroy cycles now return all owned atlas cache entries and aliases to baseline; the pre-fix2-per-restart leak is preserved as failed evidence. Current built asset-fault and fallback browser reruns also pass after this renderer-only fix.

Code: worker/local-endpoint.ts; rendering/renderer.ts; ui/app.ts. Evidence: local-endpoint.test.ts; v4-browser/results.json; asset-faults/results.json; renderer-lifecycle/results.json.

## C21 — 10,000-NPC synthetic benchmark; 100,000 random validated commands

**PASS** · SOCIETY_ENGINE.md:118-120

Current-source100000validated-command fuzz passes. A genuine10000citizen/28800tick synthetic world completes with no invariants lost. CPU p95=0.1425ms, p99=3.988ms, max=982.45ms under concurrent load; this is capacity correctness, not a production hardware/performance pass.

Code: simulation/engine.ts. Evidence: adversarial.test.ts; capacity-10000/results.json.

## C22 — Two human30-minute playtests; browser native200%zoom; real hidden tab; reference PC/low-end long soak

**UNVERIFIED** · ACCEPTANCE_TESTS.md:184-211; TECHNICAL_SPEC.md:50-51,79-95; GAME_DESIGN.md:281

Earlier native zoom evidence is historical. Two human sessions are deferred, and reference hardware, low-end hardware and repeatable visibility on a dedicated host remain unverified. An unattended two-hour wall clock does not by itself satisfy the continuity requirement.

Code: scripts/social-engine/native-browser.mjs; scripts/social-engine/performance.mjs. Evidence: native-browser/results.json; performance/latest.json.

## C23 — Combined debt + job loss + wanted + health recovery; all20event branches reload; three livelihoods7days

**PASS** · GAME_DESIGN.md:25,37,241,263-271,281; ACCEPTANCE_TESTS.md

Combined debt/job-loss/wanted/health recovery uses real commands and paid assistance/work/repayment; all20 branches reload; three distinct legal livelihoods run seven days. Fixtures and accelerated ticks are disclosed, not human-play evidence.

Code: simulation/engine.ts; life.ts; missions.ts. Evidence: recovery.test.ts; simulation-events.test.ts; simulation-careers.test.ts.

## C24 — Immutable preview/providerSHA/CI/rollback, production verification

**UNVERIFIED** · ACCEPTANCE_TESTS.md:171-181,213-243; TECHNICAL_SPEC.md:76-77

The owner explicitly authorizes merge and the verified existing Cloudflare hook after all gates and release serialization. Draft PR #256 and a real local built route exist. No production traffic, live commit identity, deployment ID, or rollback trial is verified.

Code: docs/social-engine/ISOLATION.md. Evidence: route-browser/results.json.
