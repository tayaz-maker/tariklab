# Boardworld 4.0 implementation contract

Base: verified main `5d22f86c462e22b6fd31793b5f2a81606d9f5603`, tree `c67c78f9c1a86f4fc71796c7bf3a4281381456b2`. Dedicated branch `feature/boardworld-emergent-life`. Existing TC SIM, routes, dependencies, shared assets, audio-off policy and Cloudflare guard remain unchanged.

## Ownership and integration

- Root: `engine.mjs`, `calendar.mjs`, `city.mjs`, new `emergent-life.mjs` / `emergent-content.mjs`, routine policies and diminishing returns, focused tests, integration/docs/CI/release.
- Simulation: new `life-systems.mjs` / `life-content.mjs`, household/lease/secondary NPC/role/district/employer systems and focused tests. Small coordinated hooks in `world-life.mjs` only; no parallel engine changes.
- UI: `app.mjs`, `living-ui.mjs`, `deep-ui.mjs`, new `emergent-ui.mjs` / `emergent.css`, `index.html`, new 4.0 browser script. Preserve existing test hooks and all working primary panels; compute views lazily instead of eagerly rendering unrelated panels.
- Release audit: `persistence.mjs`, authentic frozen v3 fixtures/provenance/writer, save tests, independent scenario/performance/acceptance scripts. Existing browser version/key expectations may be adapted without removing coverage.

## State and time

Version 4 adds `s.emergent` (root) and `s.life` (simulation). All v3 fields persist. Pure migration validates source schema, adds namespaces without retroactive time, payouts or NPC mutation, and preserves exact originals before v4 storage promotion. Versions1/2/3 remain strictly importable. Temporary resolver flags are never valid save fields.

Only `resolveAction(state,id,payload?)` writes gameplay. Modules return descriptors `{id,label,description,category,minutes,cost,pay?,disabled,reason,run,effectId?,npcId?,destination?,uncertain?}`. UI never mutates state or invents effects. Resource checks run before any write. All monetary transfers record the actual source and destination; no duplicate material, rent or salary charging.

Clock remains integer game minutes with stable UTC-based labels. The root clock splits at midnight/calendar/living/life/systemic deadlines. Existing NPC plans settle first; household/life state settles at its due boundaries; existing financial settlement uses the explicit household bill hook. Systemic deadlines/conditions then process once. Each module is idempotent for the same time; no wall-clock drift.

## Life systems API

Exports: `initLife(s)`, `tickLife(s,api)`, `nextLifeAt(s)`, `lifeActions(s,api)`, `adaptLifeActions(s,actions,api)`, `afterLifeAction(s,id,before,api,resolvedAction?)`, `validateLife(s)`, `getLifeView(s)`, `lifeSignals(s)`, `getLifeWorkTerms(s)`, `getDistrictEffects(s,id)`, `npcHousingCost(s,id,base)`, `canNpcMove(s,id)`, `householdBill(s,amount,label,kind,api)`, `syncLifeHousing(s,api)`.

`s.life` owns bounded secondary identities, role history, one optional shared-household contract, lease/dispute progression, district conditions and employer terms. Existing `s.deep.npcs` and `s.living` remain authorities for authored NPC money/plans/knowledge and business capital/stock.

- Secondary NPC cap6; promotion moves a relevant resident out of the aggregate cohort, preserving aggregate+secondary population/household totals. No mutation of the fixed authored12 maps. Persist identity, role, resources, routine, reciprocal relationship and learned history; expose only known profiles.
- Shared housing: one consenting authored or secondary roommate, genuine deposit escrow, 40% rent/utilities responsibility, actual contributions, unpaid shares, chores and once-only exit/refund. `householdBill` pays the actual NPC contribution directly to the payee and returns the remaining player bill; it does not mint player income. NPC daily rent is suppressed while sharing through `npcHousingCost`; autonomous relocation is prevented until a coherent household exit. `syncLifeHousing` handles voluntary/forced player moves idempotently.
- District exact fields: `{phase,untilDay,travelDelay,servicePct,rentPct,demandDelta,jobDemand,revision}`; phase `calm|investment|roadworks|pressure`, delay0..20, service/rent80..120%, demandDelta−15..15, jobDemand0..100. Bounded14-day transitions derive from local state. City reads these fields without circular imports. New/renewed leases use rentPct; no retroactive rewrite of earned balances.
- `getLifeWorkTerms(s)` returns `{extraMinutes,bonus,stress}`. Root calendar must reserve the actual selected work duration. Root injects a scheduled-action getter using the life work adapter; no recursion through calendar/getActions. Workload changes are explicit player decisions, reset with contract identity, and only completed work earns additional pay.
- Categories: `household`, `social`, `work`, `business`, `life`. Every exposed life view card includes real `actionIds`; ordinary secondary-contact actions expose `npcId` and known destination. Additional field details belong in the module's tests and public view, not in UI reconstruction.

## Emergent events and routine API

Exports: `initEmergent(s)`, `tickEmergent(s,api)`, `nextEmergentAt(s)`, `emergentActions(s,api)`, `adaptEmergentActions(s,actions,api)`, `afterEmergentAction(s,id,before,api,resolvedAction?)`, `validateEmergent(s)`, `getEmergentView(s)`.

`s.emergent` owns bounded event instances, per-family cooldown/signature history, habit counters and explicit routine policy. At least12 authored reusable causal families: employment, housing, neighborhood, transport, education, friendship, romance, household, health, debt, enterprise, institutions. Each instance has stable ID, family/variant, actors/source/contract identity, condition explanation, location/window/deadline, status, selected route, deferred follow-up and bounded causal history. Every family has state-dependent variants and multiple legal choices. Expired/stale contracts cannot reward a different employer/home/business/partner. Consequences are deterministic except explicitly marked seeded uncertainty; forecasts never reveal a die result.

Systemic action IDs are `systemic:EVENT_ID:CHOICE`, category `systemic`; policy IDs `policy:FIELD:VALUE`, category `policy`. Only finite validated IDs exist. Active decisions pause automation but leave manual needs/recovery available. Original event cards and10story chains retain priority and semantics. Creation is paced, capped and condition-driven; repeating a condition does not create a new payout every turn.

`getEmergentView` exposes `{events,history,policy,habits,summary}`. Event cards expose `{id,family,title,variant,why,source,actors,location,startAt,deadline,status,parentId,consequences,actionIds}` using only information available to the player. UI shows why/what changed and delayed consequences. Policy uses explicit meal/commute/practice/business-service choices with bounded daily quotas, a chosen bedtime and the existing budget floor/work/study/shopping switches. Investment, job change, relationship commitment and event choices are never automatic.

`runRoutine` keeps manual actions authoritative; it stops at events, upcoming commitments, budget/health risks, employer/household changes and meaningful choices. It records performed/skipped actions and stop reason. Planned practice cannot grind a capped skill; repeated same-skill or same-contact gains diminish with clear feedback. Existing historical state remains unchanged by migration.

## Verification

Immutable baseline reproduces full2635 tests and actual browser experience. Audit separates resolver-action counts from real UI clicks; normalizes dynamic IDs when measuring diversity. At least3 strategies × multiple seeds ×30/90/180/365-day checkpoints, exact replay and save round trips. Cover every event family, staged household/dispute exits, real losses/recovery, stale contracts, NPC information boundaries, capped population promotion, automation stops and monetary conservation. Baseline and final browser p95 are measured serially on the same device; paint/network measured separately. Preferred game gzip≤220KB; investigate p95 degradation>20% rather than hiding it. Final release still requires exact-head PR/main CI, existing Cloudflare Ready/active traffic and actual www browser asset/play/save/legacy tests.

## Life public view and implemented bounded model

`getLifeView(s)` is read-only and returns:

- `household`: `{active,title,status,memberName,rentShare,utilityShare,deposit,unpaidShare,chores,playerDue,memberDue,noticeDay,history,actionIds}`. Rent/utility shares and escrow are TL; responsibility dates are game-day integers. One consenting same-district roommate. Explicit presets exchange35/40/50% NPC rent/utility responsibility for different real chore intervals. Escrow remains NPC-owned; direct bill contributions never mint player income. Residual unpaid shares persist after moveout.
- `lease`: `{title,status,stage,rent,renewDay,dueDay,arrears,planLabel,history,actionIds}`. Actual stages clear/warning/negotiation/plan/notice; two missed installments terminate the plan without duplicating principal. Paid renewal sets60days of rent stability and preserves deposit. This is an authored game abstraction, not legal guidance.
- `secondary`: `{id,name,role,home,profession,goal,availability,trust,familiarity,conflict,reciprocity,history,actionIds}[]`. Maximum6 from9 finite authored identities; one promoted resident is removed from its original aggregate cohort, maintaining aggregate+detailed secondary450 and240 aggregate households. Actual private balances/profession/home stay internal until direct contact or a trusted message. Telephone action permits learning an unobserved move without omniscient directions.
- `relationships`: `{id,name,roles:[{id,label,description}],trust,familiarity,conflict,reciprocity,history,actionIds}[]` for the original12. Colleague/neighbor/friend/customer/romantic contexts have distinct requirements, budgets, cadence and consequences. Customer orders use actual NPC cash, enterprise stock and capital; at most2 are open simultaneously, deadline3days, one negotiated extension. Base authored identities and histories remain unchanged.
- `districts`: `{id,name,phase,label,description,untilDay,effects,travelDelay,servicePct,rentPct,jobDemand,...}[]`; 14-day bounded phases derive from aggregate housing/employment/market conditions. New leases use regional rent values; existing balances are not rewritten.
- `employer`: null or `{name,need,workload,terms,bonus,extraMinutes,reviewDay,history,actionIds}`. Chosen extra workload adds60minutes,5stress and15% base wage only to completed shifts. Standard terms remove future bonus and extra time together; already-earned pay remains.
- `obligations`: `{id,name,amount,actionIds}[]` for real outstanding roommate shares, plus `summary`.

Each history is `{day,text}[]`. UI renders actual action descriptors by these IDs; it does not reconstruct private state. `lifeSignals(s)` exports stable causal subsets for systemic events: household `{active,contractKey,actorId,missedChores,unpaidShare,homeKey}`, lease `{homeKey,status,disputeStage,renewAt}`, current district effects, career `{contractKey,extraMinutes,employerNeed}`, secondary `{knownIDs}`. `fulfillHouseholdDuty(s,api)` applies a real duty result; callers must reserve the same60minutes/80TL as the ordinary duty action.

`getLifeJobKey(s)` and `getLifeBusinessKey(s)` expose persistent contract identities. They distinguish same-day rehire/reopening while surviving rotation of the bounded document journal. `closeHousehold` and `syncLifeHousing` reconcile forced moves once. `householdBill` records direct NPC-to-payee transfers under the explicit v4`household` ledger account and caches settled bill identity/results. Life histories are capped48 globally/12 per relationship; secondary facts8, current-household bills24, active customer orders2.

New synchronous life contacts reserve authored NPC plans and secondary `busyUntil` until completion, including clock decision boundaries. Secondary preferences have causal rules: reliability funds deeper weekly skill development, quiet households set an earlier tension boundary, and quality-focused customers require35business reputation. These preferences are disclosed in each profile’s public goal description.

Public social contexts persist `knownWork` separately from actual employment. A legacy migration initializes this from the published authored work district, not an unobserved private job change. Direct conversation or a genuinely observed overlapping shift can update it. Public roles do not change solely because a hidden NPC field changed. `lifeActorMessage` and `lifeActorRelation` apply explicit causal messages/consequences to either an original or a promoted actor, preserving bounded memory and actual trust/affinity.
