# Boardworld 3.0 — implementation contract

Base: current main `467ef16e9f06ea3089f001592aa13aebd9cc069d`. Extend existing engine; no dependency, deployment or legacy TC changes. All game times are integer minutes since the existing UTC-based fictional calendar epoch; UI obtains labels from engine, never host timezone.

## Gap / target / acceptance

| Current constraint               | 3.0 target                                                                                             | Acceptance                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Meetings always tomorrow 18:00   | Chosen day/time/venue; availability, counterproposal, reschedule, cancellation, early/late/no-show     | Real actions + exact save/replay, no double booking                 |
| Three unconnected district cards | Connected routes, venues, hours, route/time/conflict preview                                           | Different districts change actual costs and feasible schedules      |
| NPC daily threshold changes      | Bounded utility decisions, feasible plans, directed relationships, sourced public knowledge            | 30+ days independent activity; private changes not exposed          |
| No player projects               | Qualification, relocation, enterprise and relationship projects with budgets/deadlines/real milestones | Outcomes depend on actual course/move/business/social actions       |
| Fixed action tabs only           | Finite intent composer using authoritative actions and alternatives                                    | No unsupported commands or state mutation                           |
| v2 storage isolated from v1      | v3 namespace; immutable v1/v2 backups and immediate migration                                          | Real fixtures, stale v1/v2 writer, quota/corruption/cross-tab tests |
| 90-day single-main-career sweep  | Distinct career/social/business 90-day paths and 180-day replay                                        | Legal actions only, measured action mix/time/memory/save size       |

## Ownership

- Root: `engine.mjs`, new `calendar.mjs`, `city.mjs`, focused scheduler/map tests, integration/docs/CI/release.
- Simulation agent: new `world-life.mjs`, `world-content.mjs`, focused world/project tests. May edit `deep-life.mjs` only the agreed v3 skip of `settleNpc`, and delegated compatibility support if coordinated.
- UI agent: `app.mjs`, `deep-ui.mjs`, new `living-ui.mjs`, `living.css`, `index.html`, new `boardworld-living-browser.mjs`; existing visual identity/old selectors preserved.
- Audit agent: `persistence.mjs`, save tests/fixtures, independent 3.0 acceptance/performance scripts. Existing browser test version/key expectations may be updated in coordination with UI agent.

## State and module boundaries

Schema version 3 adds `calendar`, `city`, `living`; all existing fields remain. Legacy `appointments` are preserved as migration evidence, but v3 gameplay reads `calendar.entries`. `migrateState` is pure/idempotent: validates v1/v2 first, initializes missing deep/stories then new namespaces without retroactive time/payments.

`city`: `{venue: string, lastRoute: null|{from,to,mode,minutes,cost,at}, visits:{kadikoy,besiktas,sisli}}`. Empty venue means district hub. Venue must belong to current district. `city.mjs` imports content only; exports `VENUES`, `getRoute(s,from,to,mode='transit',at=s.time)`, `travelMinutes(s,from,to,at)`, `getCityView(s)`, `initCity(s)`, `validateCity(s)`, `cityActions(s,api)`. Routes return `{id,from,to,label,minutes,cost,available,reason,actionId,conflicts:[]}`. `visit:venueId` travels to a specific venue; legacy `travel:district`/`walk:district` IDs remain functional. Values are openly game-simulated, not live transit data.

`calendar`: `{nextId,entries,recurrences,lastTick,stats}`. Entry shape: `{id,kind,subjectId,npcId,venue,district,start,end,status,createdAt,updatedAt,lateBy,outcome,recurrenceId,replacesId,legacy,history}`. Kinds: `meeting`, `interview`, `class`, `shift`, `personal`; statuses: `counter`, `confirmed`, `completed`, `missed`, `cancelled`, `rejected`. NPC/subject fields may be empty for personal plans. Times absolute. Up to 96 retained entries, 24 newly active (48 for imported legacy entries), 8 recurring definitions; monotonic IDs/next occurrence prevent duplicate execution. Imported legacy conflicts remain visible and cannot both be attended successfully. New overlapping reservations are rejected. Rescheduling preserves the original reservation until a counterproposal is accepted.

Root engine exports `getCalendarView(s,{day}={})`, `getAppointmentOptions(s,options={})`, `getCityView(s)`, `getLivingView(s)` and `getIntentActions(s,filters={})`. Views are pure. Calendar view contains `{day,days,entries,reminders,nextEvent,venues,kinds,subjects}` with engine-formatted date/time labels. Options uses `{kind,npcId,subjectId,day,venue,duration,repeat}` and returns `{slots:[{minute,label,available,reason}],venues,kinds,subjects}`. Supported proposal payload exactly `{kind,npcId,subjectId,day,minute,venue,duration,repeat}`; repeat is `none` or `weekly` for personal/class/shift only.

`resolveAction(state,id,payload?)` and `previewAction(state,id,payload?)` remain the only action/forecast APIs. IDs: `calendar:propose`, `calendar:reschedule:ENTRY`, `calendar:accept:ENTRY`, `calendar:decline:ENTRY`, `calendar:cancel:ENTRY`, `calendar:attend:ENTRY`, `calendar:next`. Proposal/reschedule take validated payload; all other actions use no payload. Dynamic commands are validated before any spend/time. Scheduled interview/class/shift attendance executes the existing apply/study/work action through the same atomic resolver and causal hooks. Meeting attendance updates actual relationship; personal plans consume real time and provide a bounded need benefit.

`world-life.mjs`: exports `initLiving(s)`, `tickLiving(s,api)`, `nextLivingAt(s)`, `livingActions(s,api)`, `adaptLivingActions(s,actions,api)`, `afterLivingAction(s,id,before,api,resolvedAction?)`, `validateLiving(s)`, `getLivingView(s)`, `getNpcPlan(s,id,from,to)`, `getHouseholdEffects(s)`. Owns only new `s.living` plus intentional mutations to existing deep NPC/enterprise/player data. `deep.npcs` remains sole NPC monetary/job/home authority. Skip old `settleNpc` for v3; preserve deep promise/bill/business settlement. Root skips old generic NPC daily mood/decay loop for v3. At most four decisions/day/NPC; plans/graph/history bounded. `getNpcPlan` returns `{start,end,location,kind}` blocks including work and commute; calendar combines them with confirmed commitments. `getLivingView` exposes only learned/public changes, not private balances or unlearned transitions. Project spending uses the exact resolved descriptor, including calendar attendance fees, rather than reconstructing a price after the action.

Shared API injected into modules retains existing log/record/memory/change/skill/receive/spend/document/news/roll/dayOf/minuteOf/reveal. Adds `npcCommitments(s,id,start,end)` (confirmed calendar overlap), `travelMinutes(s,from,to,at)`, `getBaseAction(s,id)` (existing undecorated action), and `playerPresent(s,district)` (false during transit). Root clock splits at midnight/calendar/living boundaries; deterministic order is world tick, daily financial settlement at midnight, calendar consequences, locations. Tick functions must be idempotent at same time; no independent wall clocks.

Intent composer uses finite `getActions` descriptors and calendar form. Unsupported intentions show legal alternatives; no LLM or arbitrary text-to-state execution. UI can filter category/label/location/NPC without inventing action IDs.

Save implementation uses v3 canonical slots and read-only v2/v1 sources. Archive exact original bytes per source version before immediate promotion. Never let an old tab write the new namespace. Export version3, import versions1/2/3, validate envelope/schema/checksum before migration. Original TC keys remain untouched.
