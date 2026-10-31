# TC SIM: Boardworld

Independent Turkish-language single-player tabletop life RPG at
`/oyna/tc-sim-boardworld`. Source: `public/games/tc-sim-boardworld/`.
The weekly TC SIM runtime and save namespace are unchanged. Native/Godot remains
paused and sound is disabled. Prices are authored game balance, not real-time
financial data or claims about current Turkish salaries.

## Deep Life 2.0

The original engine and all twelve NPCs, seven careers and twenty-eight event
cards remain. Version 2 extends the same authoritative state with independent
NPC budgets, goals, weekly schedules, professional changes, moving, social ties,
explicitly learned facts and promises. Employer expectations, professional
reputation, wage negotiation, freelance contracts and three microbusiness types
connect time, location, relationships and money.

Ten three-stage life stories connect earlier events to delayed consequences:
shared housing maintenance, a portfolio pilot, community meals, a learning group,
debt recovery, workplace coordination, health recovery, neighborhood change,
relationship expectations and the first customer. Each story records its route,
due day and permanent history. Earned project payments arrive only once after
actual delivery; changing home or job prevents benefits from leaking to the new
contract. Choices remain authored and do not use generated dialogue.

The agenda can run one or seven days of configured routine actions through the
same action resolver. It does not choose cards, new jobs, relationships or
business investments. Important decisions, financial constraints and appointment
conflicts stop the plan with an explanation. The player can inspect an action's
resource forecast before committing; uncertain dice outcomes are not revealed.

The city now exposes neighborhood service costs, specialization, customer demand
and business overhead. Lightweight SVG/CSS architecture, a relationship network,
an interactive agenda, story cards and compact financial panels use the actual
simulation state. No dependency, 3D engine or audio was added.

The save envelope and state are version 2. The canonical primary and rolling
backup use `tariklab.boardworld.v2` and `.v2.backup`; the old `.v1` and `.v1.backup`
slots are read-only migration sources. A still-open 1.0 tab therefore cannot
overwrite 2.0 progress, and healthy 2.0 slots always take priority over legacy
writes. Original version-1 bytes are checksum- and schema-checked before migration,
preserved under `tariklab.boardworld.v1.original-v1` before the first canonical
write, and never rotated away. File import/export and cross-tab updates
continue to work; there is no cloud-save account. See
[`DEEP_LIFE_ACCEPTANCE.md`](DEEP_LIFE_ACCEPTANCE.md) for verification of this update.

## Architecture

- `content.mjs`: districts, backgrounds, jobs, homes, courses, people and conditional stories.
- `engine.mjs`: pure deterministic state creation, legal-action discovery and resolution.
  Absolute simulated minutes drive calendar boundaries, needs, schedules, payroll,
  rent and debt. No wall-clock progression while the game is closed.
- `app.mjs` / `style.css`: accessible responsive tabletop, character creation,
  action cards and state inspection. The view cannot award money or advance time.
- `persistence.mjs`: separate `tariklab.boardworld.v2` primary and `.backup` keys,
  versioned checksum envelope, structural validation and bounded file import/export.
  A checksum detects accidental corruption; it is not an anti-cheat signature.
- `deep-content.mjs` / `deep-life.mjs`: district, employer, NPC, freelance,
  business and routine rules, isolated from browser rendering.
- `life-chains.mjs`: ten explicit, validated three-stage life state machines.
- `deep-ui.mjs` / `deep.css`: additional board, forecast, network and agenda views.

Saving is local to the browser. File export/import transfers a life between
browsers. Storage failures are visible and never silently reported as success.
A corrupt primary can recover the previous valid turn. Creating a new life
requires explicit in-game confirmation when progress already exists.

## Validation

`node --test scripts/boardworld*.test.mjs` exercises simulation, long-run play,
invalid actions and recovery. `node scripts/boardworld-browser.mjs --serve
.output/public` drives real Chromium against built game assets. A separate
Boardworld quality workflow runs these checks on PRs and main. Existing global
CI and TC SIM release gates remain required and unchanged.

Production acceptance must separately verify the main commit, Cloudflare build,
served game bytes, real interactions and save/reload. CI green alone is not proof
of deployment. The October 31, 2026 dashboard audit found no existing deploy hook;
no hook is invented or created by this change.

## Playable scope and acceptance

The initial release contains three İstanbul districts and three origin scenarios;
seven careers with three tiers; twelve named NPCs; five certifying courses; four
housing options including emergency shelter; eight inventory types; twenty-eight
conditional event cards with fifty-seven choices; four lifetime goals and eight
achievement IDs. The fixed city population and authored stories are deliberate;
there is no generated dialogue service, multiplayer, cloud account dependency or
3D engine. All game copy is Turkish; portal EN/PL entries disclose that limit.

Calendar starts Monday, 7 September 2026. Time advances only through actions.
Jobs pay earned wages weekly, rentals recur every thirty days, and monthly
utility/interest settlement runs at crossed midnight boundaries. Retail and café
careers have authored weekly rest days. Qualification, attendance, wages,
certificates and promotions do not roll dice. Only specifically labelled uncertain
event choices consume the saved PRNG sequence.

Local acceptance includes nine legitimate 45-day runs (three origins × three
seeds), two promotions per run, monthly settlement, solvency and health checks;
all fifty-seven event choices; an eight-day course that unlocks a new career;
relationship readiness, retained memories, and completed/cancelled/missed
appointments. Five persistence tests cover exact round trips, backup recovery,
invalid nested state, checksum/version failures and unavailable browser storage.
Real Chromium drives all nine panels, hiring, a shift, transit, save/reload,
file export/import and corrupt-primary recovery at 320, 390 and 1440 pixels.
The existing TC SIM is separately started, played and resumed from its own save.

The life journal and account ledger retain the latest 160 entries; each NPC retains
12 recent memories while relationship values, resolved events, certificates and
achievement flags remain in the saved state. Saves stay bounded for long games.
