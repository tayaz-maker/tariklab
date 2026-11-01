# Boardworld 5.0 — Living Society architecture

This milestone extends verified4.0 (`c2e7f352d471b819c6d955b6ff106aaf3b26226c`).
Implementation and acceptance are separate: see BOARDWORLD_5_ACCEPTANCE.md for
actual final gates, measurements, limitations and release evidence. This document
is not a claim that production has been updated or that the game is Gold.

## State and ownership

`resolveAction` remains the only public simulation writer. Actions validate before
mutation, operate on a clone, use the same clock and seeded generator, and validate
the result. Preview uses the same resolver without committing its output. No
network, wall-clock timer, per-frame population loop or new runtime dependency was
introduced. Existing authored NPCs, careers, cards, chains and projects remain.

Schema5 adds separately versioned `society` and `flow` namespaces. Primary wallets
remain in `deep.npcs`, primary relations in `living.graph`, appointments in the
existing calendar, and secondary people in `life.secondary`. Public views contain
learned snapshots, not private schedules or account balances. Migration validates
the authentic source first, then adds neutral namespaces; it does not advance time,
randomness, payments or rewards. Current-schema persistence removes duplicate same-call validation. A per-storage
WeakMap retains at most three exact, previously validated canonical envelope
strings and boolean validity metadata for rotating recovery slots; it retains no
parsed state or mutable input. Unknown bytes always take the full checksum/schema
path, every save validates its current input, and every import/load returns a
freshly decoded and validated state. Checked writes and immutable originals are
unchanged. There is no mutable-state validation cache.

## Society and neighborhood feedback

The existing NPC scheduler calls society hooks after actual work and contacts.
A reconciliation proposal has a cooldown and can fail under relationship/energy
constraints. Invitations have a bounded rate, expiry and one canonical counteroffer
in the normal calendar. Ignoring an unaccepted invitation has no no-show penalty.
Acceptance, alternative dates, travel windows and attendance reuse calendar rules;
actual attendance charges the inviter's existing wallet the venue fee once.
Accepted invitations follow canonical replacement appointments, including a change
of venue. Pending confirmed commitments are retained within the eight-offer cap;
new invitations pause when every retained slot is still live. Imported links must
match the calendar participant.

Knowledge carries an episode identifier, original event time, NPC receipt time,
player disclosure time, source, credibility, privacy and hop count. Only learned,
shareable evidence travels through real trusted contacts, with delayed delivery
and a two-hop limit. Evicted facts leave a bounded per-origin retirement cutoff
so old episodes cannot be applied twice; forgetting reverses only that fact’s
remaining rumor penalty. Private finance, health and relationship facts do not become
public from graph proximity. Corrections use evidence of actual repair and reverse
only the recorded reputational penalty. Feed rotation does not change knowledge
or invent a new event. Old unclassified records remain preserved and private.

Food and material stock is consumed atomically with purchases; operating capital
and recorded costs still belong to the existing enterprise ledger. Restocking and
aggregate household demand are explicit external market flows. Weekly smoothed
signals affect demand, new lease pressure, job opportunities, material prices and
service time. These effects have bounded ranges and a single integration point;
existing signed leases are not retroactively repriced by the district signal.
Free-food and basic-care recovery remain available during shortages.

Caps are explicit:12 primary NPCs,6 secondary people,8 retained/3 open offers,
180 edge metadata records,48 secondary edges,12 facts per actor,24 queued messages,
6 paired contact completion handles,48 public edge snapshots,64 chronology rows,
3 district records and6 history samples per district. Save validation checks
identifiers, canonical linkage, timestamps and bounds before any imported action.

## Daily decisions and consent

The dashboard separates urgent obligations, opportunities and optional background
information. Every item uses real action descriptors and context navigation.
A stopped routine records a stable relevant-state fingerprint; revision and journal
noise cannot enable another identical zero-time attempt. A real recovery action,
changed preference or elapsed time invalidates the old diagnostic.

Needs batching is explicitly invoked, limited to8 actions and480 minutes, and
executes actual meals, shopping, travel, withdrawal and rest according to existing
preferences. It stops for cards, appointments, budget floors and contract changes.
It never accepts a story, new loan, lease, job or relationship on the player's
behalf. Existing-payment permission is opt-in, revocable and tied to current lease
terms. Separate utility, weekly principal, negotiated rent-arrears and business-overhead
boundaries are recognized even after a move or when a payment reduces debt. All
three batching paths require consent before committing those charges. Permission
cannot allow an unaffordable installment miss, plan cancellation, new operating
arrears or forced business closure. New payment plans and changes to business
commitments revoke the old permission. A new loan/repayment agreement or changed rent revokes it. Even authorized
batches stop for insufficient funds, arrears and changed terms. The original
monthly rent increase therefore remains a genuine review boundary unless an
existing stabilization agreement applies. No automatic full debt payoff exists.

The new sustainable-business goal complements all four legacy goals: reach day90,
operate profitably after recorded and accrued costs, retain reputation60, hold
3000 TL operating capital and3000 TL emergency savings, and have no personal debt,
business arrears or unpaid rent. It does not require employment. Earned legacy
goals are retained.

## Presentation and affected files

| Files | Responsibility |
| --- | --- |
| engine.mjs | Schema5 orchestration, split clock, authoritative batches and new goal |
| daily-flow.mjs | Consent, stop diagnostics, recovery descriptors and daily decision view |
| society-content.mjs / society-systems.mjs | Bounded social state, evidence, invitations, contacts and district feedback |
| calendar.mjs | Canonical NPC counteroffers, self-reservation exclusion, alternative-date checks |
| world-life.mjs / life-systems.mjs | Hooks into real NPC plans, work, contacts and existing local economy |
| city.mjs | Public district stock and effect projection |
| deep-life.mjs / emergent-life.mjs | Accurate privacy/cause descriptions and readable existing labels |
| persistence.mjs | Separatev5 slots, immutable authentic originals, strict import and stale-writer isolation |
| app.mjs / deep-ui.mjs / living-ui.mjs / emergent-ui.mjs | Existing13 panels, formatted resources and integration of decision/social views |
| society-ui.mjs / society.css / index.html | Compact decision desk, sourced chronology, district and NPC context |
| i18n.mjs / locale modules | Local presentation-only TR/EN/PL catalogs; selected language loads lazily |
| scripts/boardworld*.test.mjs / browser harnesses | Focused, adversarial, legacy, endurance, responsive and save tests |
| scripts/fixtures/boardworld/v4-* | Authentic released4 envelopes, immutable writer, traces and provenance |
| docs/tc-sim-boardworld/BOARDWORLD_5_* | Baseline, contract, architecture and independently measured acceptance |
| docs/WEB_APP_SYNC_LEDGER.md | Web change ledger; no native/Godot restart |
| src/lib/games.ts / src/lib/i18n.ts | Only the Boardworld listing subtitle and language description |
| .github/workflows/boardworld-quality.yml | Adds the Living Society browser check and artifact; all existing gates remain |

Paths in this table are relative to `public/games/tc-sim-boardworld/` unless a
prefix is shown. No original TC SIM source/key, other game, portal route, shared
asset, Cloudflare Worker configuration, deploy guard, Vercel resource or package
was changed. Audio remains disabled. Original persisted prose and player names
remain byte-exact; translated presentation never changes simulation state.

## Release and rollback

Only an ordinary feature PR with successful exact-head checks may merge. Check
exact-main CI and the existing Cloudflare Git deployment separately, then verify
the active production version and every runtime asset hash plus real browser play.
The existing Git guard is retained; do not force a stale deployment or bypass it.

The last verified4 production version is
`9f58244b-9837-4221-b639-c6503fcb800c` (build
`9f0b6b67-2beb-4901-a26b-6490574966b4`, commit `c2e7f352`). If a critical production
regression requires rollback, the existing Worker's deployment UI can restore
that already-verified version. Follow with a normal revert PR through the same
checks so Git and production converge; never force-reset main or create a Worker.

Version5 saves and originals must remain untouched during rollback. The released4
client writes only its ownv4 namespace. It cannot read newv5 progress; any play
continued in4 during rollback is a separate branch of progress and is not merged
automatically into5. Re-deploying fixed5 resumes its retainedv5 state. Preserve
both exports where possible; do not rewrite a5 envelope as4 or erase either slot.
