# SOCIAL ENGINE — Living Society Engine

**Version:** 1.0 proposed architecture. **Runtime:** TypeScript, Web Worker, IndexedDB. **Launch:** 100 active + 1,000 background NPCs. **Target:** 5,000–10,000 NPCs. Performance figures below are targets, not benchmarks.

## Architecture

One authoritative simulation worker owns world state. Main thread handles rendering/input and receives read-only projections. Systems: clock, NPC store, decisions, schedules/navigation, relationship graph, memory, ledger/economy, housing, crime/justice, gangs, family, social shocks, quest validator, persistence and diagnostics. Commands are validated and committed atomically; domain events are append-only. Never use LLM outputs, rendering frame timing, `Date.now()` or `Math.random()` to change authoritative state. Use integer game minutes, integer minor currency units, stable IDs, stable sorting and seeded randomness.

## TypeScript models

```ts
type Id=number; type Money=number; type Minute=number;
type Job='student'|'retail'|'driver'|'mechanic'|'police'|'office'|'delivery'|'healthcare'|'unemployed'|'retired'|'informal';
type Goal='sleep'|'eat'|'work'|'travel'|'shop'|'socialize'|'heal'|'seekJob'|'payRent'|'move'|'crime'|'escape'|'idle';
interface Needs {hunger:number; fatigue:number; safety:number; belonging:number; health:number; financialStress:number;} // 0..1000
interface NpcProfile {id:Id; nameSeed:number; birthDay:number; job:Job; traits:Record<string,number>; skills:Record<string,number>; familyId:Id|null; householdId:Id; employerId:Id|null;}
interface NpcState {id:Id; homeId:Id|null; locationId:Id; destinationId:Id|null; cash:Money; savings:Money; debt:Money; propertyIds:Id[]; monthlyIncome:Money; health:number; needs:Needs; goal:Goal; actionUntil:Minute; nextDecisionAt:Minute; lastSimulatedAt:Minute; alive:boolean; wantedLevel:number; gangId:Id|null;}
interface Household {id:Id; members:Id[]; dependents:Id[]; homeId:Id|null; sharedFunds:Money;}
interface Property {id:Id; districtId:Id; ownerId:Id|null; capacity:number; occupants:Id[]; monthlyRent:Money; quality:number;}
interface Business {id:Id; propertyId:Id; ownerId:Id|null; employees:Id[]; inventory:Record<string,number>; prices:Record<string,Money>; wagePerShift:Money; outputPerShift:Record<string,number>; status:'open'|'distressed'|'closed';}
interface Relation {from:Id; to:Id; trust:number; affection:number; fear:number; resentment:number; loyalty:number; familiarity:number; tags:string[]; lastContactAt:Minute;}
interface SocietyEvent {id:string; tick:Minute; kind:string; actors:Id[]; targets:Id[]; locationId:Id|null; data:Record<string,string|number|boolean|null>; causationId:string|null; visibility:'public'|'witnessed'|'private'; schemaVersion:number;}
interface Memory {observerId:Id; eventId:string; learnedAt:Minute; sourceId:Id|null; confidence:number; salience:number; lastRecalledAt:Minute; expiresAt:Minute|null;}
interface LedgerEntry {id:string; tick:Minute; from:string; to:string; amount:Money; reason:string; eventId:string;}
interface Gang {id:Id; leaderId:Id; officers:Id[]; members:Id[]; treasuryAccount:string; influenceByDistrict:Record<string,number>; rivals:Id[]; heat:number;}
interface Quest {id:string; sourceEvents:string[]; issuerId:Id; targets:Id[]; districtId:Id; prerequisites:string[]; deadline:Minute; reservedReward:Money; status:'offered'|'active'|'complete'|'failed'|'expired';}
```

Immutable profiles are separate from mutable state. Optional data uses sparse components. IDs never recycle; death/emigration leaves tombstones. All ownership, employment, family and ledger references must be valid. Family ancestry is acyclic.

## Decisions and routines

First filter impossible actions (closed shop, inaccessible route, insufficient funds, invalid target). Then compute bounded integer utility: `U = needs + scheduleUrgency + goalProgress + socialValue + opportunity - moneyCost - travelCost - risk - switchPenalty + seededJitter`. Suggested starting weights: hunger >850 gives eating +900, shift within 30 minutes gives work +700, immediate danger gives fleeing +1200, switching a valid action costs 250. These weights require playtesting. Replan on action completion, emergency or tier deadline; use a 10-minute minimum commitment except emergencies. States: IDLE -> PLAN -> TRAVEL -> PERFORM -> COMPLETE; emergency branches FLEE, CLINIC, CUSTODY, DEATH. Failed plans fall back to safe idle with bounded retry.

```ts
function choose(n:NpcState, actions:Action[], ctx:Context):Action {
 const valid=actions.filter(a=>preconditions(a,n,ctx));
 if(!valid.length) return safeIdle(n);
 return valid.map(a=>({a,s:utility(a,n,ctx)+jitter(ctx.seed,ctx.tick,n.id,a.code)}))
 .sort((x,y)=>y.s-x.s||x.a.code.localeCompare(y.a.code))[0].a;
}
```

Weekly schedules cover sleep, work, school, commuting, meals, shopping and social time. Seeded individual variations prevent identical behavior. Shifts can be missed; do not teleport to satisfy schedules. Active travel uses walkable navigation paths and collision. Background travel uses district graph and scheduled arrival; tier promotion projects onto a valid path segment. Shop hours, queues and transit capacity constrain actions.

## Relationships and memory

Sparse directed edges store trust, affection, fear, resentment, loyalty (-1000..1000), familiarity (0..1000), tags and last contact. Relations need not be symmetric. Target 24–48 casual edges per NPC; protect family and important edges. Events change relations through bounded, once-per-event rules. NPCs learn only through participation, actual observation, conversations, public notices or media. Active witnesses use visibility/distance/attention; background witnesses use seeded district encounter rules. Rumors retain source and confidence; they cannot alter objective event history. Target 32–96 episodic memories plus permanent flags per NPC. Integer lookup tables decay salience; evict lowest salience, then oldest, then event ID. Critical promises, crimes and kinship persist longer.

## Economy and housing

Ledger transfers are atomic and idempotent. Every debit has a credit; taxes, external trade and currency creation/destruction use explicit system accounts. Production changes inventory, not money. Loans create matched assets/liabilities. Daily: shifts, inputs, output, sales. Weekly: bounded demand/stock-driven prices, hiring/layoffs. Monthly: contractual wages, rent, debt interest, taxes, benefits and bankruptcy. Prevent negative stock, duplicate payroll, infinite money and unfunded quest rewards. District indicators derive from actual employment, prices, wages and sales.

Housing separates deeds, leases, occupancy, mortgages and rent. Moves evaluate affordability, commute, safety and family ties; reserve destination before releasing prior unit. Enforce capacity and one primary residence per household. Arrears trigger notices and relocation options. District vacancy, maintenance, services and jobs affect neighborhood change. Estates settle debts before property inheritance.

## Crime, justice and gangs

Crime decisions weigh opportunity, conflict, personal choices, gang pressure and detection risk; unemployment alone never marks an NPC criminal. Crimes record offender, victim, location, loss, witnesses, evidence and case. Police know only reported or discovered information, have limited dispatch/investigation capacity and may reach unresolved or mistaken conclusions. Arrest, trial, fines, custody and acquittal are separate events. Stolen property retains provenance and cannot exceed victim inventory. Player crime follows identical rules.

Gangs have explicit membership, hierarchy, one leader, treasury, rivals, police heat and district influence (0..1000). Daily/weekly group decisions weigh loyalty, resources, risks and objectives. Territory influence changes gradually and can be contested. Block duplicate leaders, instant territory capture and unbacked income.

## Families and society

Model parentage, partners, guardians, households and dependents separately. Marriage, separation, birth, death, guardianship and inheritance are validated events. Children use age-appropriate school and care rules, not adult employment/crime. Birth/death rates and migration are capped to avoid population explosions. Death settles estate, closes commitments and preserves memories. Social shocks (recession, strike, shortage, bankruptcy, migration, rent shock, public works) have prerequisites, district scope, duration, severity bounds, cooldowns and measurable consequences. A strike reduces actual output; bankruptcy terminates real jobs.

## Player and quest integration

Player actions (trade, help, threaten, hire, rent, report, fight, negotiate) go through the same transaction/event pipeline. Effects remain when NPCs are offscreen. Generate quests from unresolved facts: shortage -> delivery; unpaid wages -> mediation; burglary -> investigation; vacant unit -> housing search. Check actors alive, routes reachable, rewards reserved, deadlines feasible, inventory available and causal event unresolved. Lock exclusive targets; expire/adapt quests after death, relocation or resolution. Idempotent reward claims prevent duplicates.

Dialogue defaults to offline templates grounded in NPC knowledge and relationships. Optional remote LLM dialogue requires opt-in, privacy disclosure, rate limits, session token/cost caps and fallback. Never run a separate LLM per NPC. LLM output is non-authoritative; proposed actions require deterministic validation.

## Clock and level of detail

Authoritative time is integer game minutes; proposed 1 real second = 1 game minute while playing. Events use a min-heap ordered `(tick, priority, stableId)`. Hourly needs, daily work/production, weekly prices/gang policy, monthly obligations/demographics. Pause stops simulation. Active tier: up to 100, minute-level decisions and rendered navigation. Nearby tier: dynamic subset of remaining NPCs, 5–15 minute decisions and abstract travel. Background tier: remaining population, 1–6 game-hour aggregate updates plus scheduled events. Nearby is not extra population. At 10k keep active cap fixed; use spatial indexes, batched updates and sparse graphs. Promotion/demotion must reconcile missed events and obligations exactly once.

## Determinism

Specify/version PCG32 with fixed 64-bit BigInt arithmetic or equivalent. Derive independent random draws from `(seed, subsystem, tick, entityId, decisionIndex)` to avoid unrelated sequence shifts. Use integer math, canonical serialization, sorted IDs and deterministic tie-breakers. Replay requires identical engine/rules version, seed, initial snapshot and ordered command log. Hash state daily; debugger reports first differing tick and module. Test across browser engines and worker restarts.

## Save schema and recovery

IndexedDB stores manifest, current/previous snapshots, journal, commands, hashes and quarantine. Snapshot includes schema/engine/rules versions, seed, tick, last journal sequence, state and SHA-256 checksum over canonical serialization excluding the checksum field. Write staging snapshot, verify, atomically promote manifest pointer and retain prior valid snapshot. On load verify checksum, restore latest valid snapshot, replay valid journal tail, deduplicate event IDs and quarantine corrupt records. If both snapshots fail, offer explicit import/new game rather than silent reset. Migrations are pure sequential `vN -> vN+1` functions with fixtures and rollback backup. Reject unknown future schemas.

```json
{"schemaVersion":1,"engineVersion":"0.1.0","rulesVersion":"1","seed":"social-001","tick":1440,"lastJournalSequence":420,"state":{"npcProfiles":[],"npcStates":[],"households":[],"businesses":[],"relationships":[],"memories":[],"accounts":[]},"checksum":"sha256:<computed>"}
```

Empty arrays illustrate format only; this is not a populated 1,100-NPC save. Journal segments are bounded and compacted after verified checkpoints.

## Offline behavior

With browser open, the worker runs unless paused or throttled/suspended by browser. When tab/browser/device closes, **simulation stops**. Default reopening resumes the last authoritative game tick. Optional catch-up uses wall-clock elapsed time only as an explicit recorded input, capped initially at 24 in-game hours, with user preview/consent. Process catch-up deterministically using scheduled/aggregate transitions; never claim actual NPC computation occurred while closed. Without a server there is no real-time offline world.

## Proposed performance budgets, NOT measured

| Metric | 1,100 NPC | 10,000 NPC |
|---|---:|---:|
| Worker CPU per real second, p95 | <=12 ms | <=30 ms |
| Retained worker heap | <=40 MB | <=180 MB |
| Compressed snapshot | <=2 MB | <=15 MB |
| Save latency, p95 | <=250 ms | <=1000 ms |
| Cold load+validate, p95 | <=1 s | <=4 s |
| Main-thread FPS | 60 target, >=30 minimum | same active cap |

Benchmark on a documented low-end desktop and at least two browsers; measure p50/p95/p99 tick cost, GC pauses, heap, queue backlog, render frame times, compressed bytes, save duration and state hash equality. These targets may need revision. Never sacrifice ledger correctness or causality to meet FPS.

## Tests and acceptance

1. Same seed/snapshot/commands produce identical hashes over 365 simulated days, across browser engines and different render FPS.
2. Every transfer balances; no negative inventory; duplicate payroll/purchase/quest reward executes once.
3. Unobserved private crime stays unknown; rumors preserve provenance; memory decay is repeatable.
4. NPCs never spawn inside walls, teleport on promotion or occupy unreachable destinations.
5. Concurrent household moves cannot overfill housing; ownership and rent remain consistent.
6. Witness reports can be false; police never access hidden offender IDs as knowledge.
7. Family graph stays acyclic; death/inheritance preserves valid ownership and guardians.
8. Shock, business bankruptcy and unemployment updates reconcile with actual workers and output.
9. Corrupt newest snapshot falls back to previous valid one; corrupt journal tail quarantined; migrations preserve balances.
10. 1,100-NPC and 10,000-NPC synthetic workloads report measured budgets and no simulation stalls.
11. Closing browser freezes state; reopening without catch-up preserves tick; recorded catch-up is replayable.
12. Fuzz 100,000 random validated commands and assert invariants after each batch.

## Implementation milestones

**M0:** Clock, IDs, deterministic RNG, command/event bus, replay hash and invariant harness. **M1:** Population, needs, schedules, navigation tiers and 1,100-NPC seeded world. **M2:** Economy/ledger, businesses, housing and households. **M3:** Social graph, memory, witness knowledge, player interactions. **M4:** Crime/justice, gangs, family and shocks. **M5:** Quest causality, offline dialogue, persistence/migration/corruption recovery. **M6:** Browser profiling, 5k/10k stress tests, tuning and production gates. Each milestone requires deterministic regression tests, save/load round trips and a performance report; do not merge on test counts alone.
