This branch implements the physical driver-break candidate described in
[the original assessment](DRIVER_BREAKS.txt). Schema 9 adds the active
driver and bay state; schema 8 still replays with the frozen candidate 7
rules before migration. This candidate is not a release until the natural
liveness checks pass.

A driver uses one of four physical parking bays, follows a swept connector,
walks to the existing market, enters its FIFO, and consumes food only when a
real payment and stock debit settle. They walk back to the same vehicle and
merge through an available gap. An unaffordable meal releases the driver to
ordinary work attendance. A settled wage, funds and available stock can let
them start walking shortly before market opening, but the market cannot
queue or settle the purchase before opening. Severe remaining hunger permits
one separate serving at the end of the same FIFO. An unavailable second
serving does not erase the first paid meal.

Car and pedestrian checks remain active at parking, while crossing, and
during interrupted manoeuvres. A temporarily blocked original driver retains
their claim while they retry. When a living driver exhausts active walking
retries, ordinary routine resumes with their own car still physically parked.
They attempt the return again only when a legal route can be found. If a
driver dies after physically parking, a
reachable local adult must walk to and drive the body out of its bay. The
simulation does not reposition the parked car to resolve an interruption.

The second western bay uses a dedicated position at `(15.2, 31.2)`,
accessible to road loops 0 and 2. Its approaches, disembark point and
returns are physical, and it shares no ownership or occupancy with public
parking. It is held for a severely hungry driver when the ordinary west
bay is actually occupied or reserved. Earlier experimental schema-9
checkpoints with the original parking topology retain it; they load with
no fourth slot and never route a car there. Fresh worlds and the published
schema-8 migration include the additional empty slot. These worlds also
reserve the east parking entrance's swept corridor after a real gap is
confirmed. This avoids trapping its partial turn against a vehicle coming
from the opposite lane. Earlier three-bay checkpoints keep their existing
entrance behavior.

The starter's parked body moved from the previous candidate's
`(21.6, 15.2)` to `(19.6, 14.1)` to leave the market pavement a legal
western exit even when another vehicle holds the marked crossing and the
rental is parked. Its new start is within boarding range, and its swept
exit still joins the original lane at `(26.2, 17)`. Migration moves only
a recognised historical starter pose or a vehicle already in a recorded
parking slot, as applicable. Older rules do not record a no-distance
enter/exit, so a car used and returned to the exact recognised pose may
be indistinguishable from an untouched one. An active driver, a different
road pose, rental contract and all balances retain their existing policy.

Focused checks:

```sh
node --experimental-strip-types --import ./scripts/ts-alias.mjs --test \
  src/games/social-engine/tests/driver-breaks.test.ts \
  src/games/social-engine/tests/npc-movement.test.ts
node scripts/social-engine/verify-replay-bundle.mjs
```

The crowded one-day fixture starts the seven original drivers hungry and
drains n84's wallet via a real fixture transfer. Its gate records a unique paid
market receipt and subsequent physical walk, boarding and merge for each
original person/car pair. Each pair must return by tick 14,400. The fixture
does not certify continued access to food in a fresh world.

Natural checks run without editing the generated world or submitting player
commands:

```sh
node --experimental-strip-types scripts/social-engine/driver-breaks-natural-audit.mjs 920 5
node --experimental-strip-types scripts/social-engine/driver-breaks-natural-audit.mjs 922 5
```

The audit records paid receipts before compaction, each person's first
verified return to their original car, hunger at the end, longest continuous
time at maximum hunger, minimum health, and actual vehicle overlaps. Natural
liveness requires repeated access to food and a return to the original car;
receipt count alone can include ordinary purchases after a failed return.
NPC health is not reduced by the adult hunger increment in these rules, so
health remaining at 100 does not certify healthy eating.

A prior real-world candidate, `48653d82`, achieved first paid meals and
returns for all seven drivers in both seeds. It still failed sustainability:
five drivers in seed 920 and all seven in seed 922 ended the five-day run
with hunger 100. A later candidate, `b548561a`, passed the independent
one-day criterion but regressed sustained access and some first returns.
The latest crossing and parking recovery fixes have focused controls;
they must also be verified on both unmodified seeds over multiple days.

The crossing-turn candidate `e96f1bd0` keeps the existing body guards and
adds staggered turns for waiting vehicles at marked crossings. A vehicle's
turn admits no new NPC pedestrian, while pedestrians already in the crossing
can leave and player curb intent remains protected. This produced 7/7 first
and repeated same-car cycles in both unmodified five-day runs, with no
observed vehicle-body overlaps or validation errors. The exact receipts,
returns and maximum continuous hunger at 100 were:

| Seed | Paid on-break receipts (n81–n87) | Completed original-car cycles (n81–n87) | Final hunger (n81–n87)      | Longest at 100   |
| ---- | -------------------------------- | --------------------------------------- | --------------------------- | ---------------- |
| 920  | 9, 8, 8, 7, 9, 8, 10             | 7, 7, 6, 5, 7, 6, 8                     | 56, 64, 84, 84, 96, 88, 56  | 28.23 game hours |
| 922  | 10, 10, 10, 10, 10, 9, 10        | 6, 9, 10, 8, 9, 6, 8                    | 56, 80, 95, 68, 80, 100, 88 | 7.37 game hours  |

The longest episode in seed 920 still exceeded one full game day. The
overflow bay and the East approach reservation helped other traffic, but the
next candidate still found a bumper conflict at tick 44,000 of seed 920.
The ordinary planner missed a small intersection that the movement guard
correctly refused. The final runtime tested here (`ccd634b3`) tries a more
closely sampled local path only when a real step has stalled next to a
stopped vehicle. The original goal and movement guards still apply. In the
controlled continuation of that snapshot, n84 cleared the road and returned
to v4 after an already-settled receipt. Independent QA observed 576 actual
pedestrian substeps with a minimum sampled vehicle clearance of 0.000780 m,
811 movements of the unblocked car, no invalid segment, and equal replay
after a mid-recovery save.

In the final unmodified five-day runs, each original driver bought at least
nine paid servings on break and completed at least six returns to the same
car. No vehicle-body overlap or state-validation error was observed.

| Seed | Paid on-break receipts (n81–n87) | Completed original-car cycles (n81–n87) | Final hunger (n81–n87) | Longest at 100 | Latest first return |
| ---- | -------------------------------- | --------------------------------------- | ---------------------- | -------------- | ------------------- |
| 920 | 11, 10, 10, 10, 10, 10, 9 | 9, 8, 9, 7, 7, 9, 8 | 44, 72, 88, 72, 60, 92, 100 | 6.75 game hours | n83 at 14,692 |
| 922 | 10, 11, 10, 10, 10, 10, 12 | 6, 8, 9, 8, 9, 9, 10 | 80, 56, 95, 88, 100, 100, 28 | 4.08 game hours | n81 at 9,657 |

The controlled one-day fixture passed for all seven pairs. The fresh seed
920 still exceeded the same one-day deadline for n83 by 292 ticks (29.2 game
minutes). Hunger still reached 100 for prolonged periods and the longest
gap between paid meals was 26.50 game hours in seed 920 and 23.78 in seed
922. The evidence shows repeated feeding and returns in these two worlds;
it does not establish that maximum hunger is prevented, that all natural
seeds meet the one-day threshold, or that a driver can earn enough wages to
cover meals indefinitely. A separate zero-wallet fixture verified actual
work attendance, a salary transfer and subsequent meals, but it also used
the existing bank-loan system.
