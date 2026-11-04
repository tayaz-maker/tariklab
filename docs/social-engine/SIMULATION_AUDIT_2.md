# SOCIAL ENGINE 2.0 simulation audit

Baseline: `dc302b29344021c87382d661290ecaf454a1245d`. Observations below were
made against an isolated checkout, using Node 24.21.0. They are simulation
observations, not browser or visual acceptance evidence.

## P1 — Traffic drivers cannot satisfy hunger

Reproduce with the ordinary seeded world, no inserted agents:

```js
import { createWorld, stepWorld } from './src/games/social-engine/simulation/engine.ts';
const s = createWorld(920);
const drivers = s.vehicles.filter(v => v.driverId).map(v => v.driverId);
for (let i = 0; i < 14400; i++) stepWorld(s);
console.log(drivers.map(id => {
  const n = s.npcs.find(p => p.id === id);
  return { id, hunger: n.hunger, goal: n.goal,
    vehicle: s.vehicles.find(v => v.driverId === id)?.id };
}));
```

At tick 14400, minute 1920, all seven seeded drivers n81–n87 remained assigned
to v1–v7, had goal `drive`, and hunger 100. Their initial hunger ranged from 6
to 27. `npcMovement` excludes attached drivers while the hourly society update
increases hunger. The existing driver-break assessment details missing safe
parking connectors, capacity, legal routing, market settlement and zero-wallet
handling. Assigning free food or teleporting drivers into a bay would not
constitute a correct fix.

## P1 — Stopped traffic retains positive authoritative speed

Reproduce on the ordinary seed 920 by comparing every vehicle position before
and after each `stepWorld` call. On tick 12, v3 driven by n83 remains at
(44, 21.02) with `speed` 1.8. `advanceTraffic` rejects the proposed movement on a
reservation or collision but leaves speed unchanged. Consequently it can resume
at full stored speed immediately. Player vehicle exit also uses speed rather
than displacement, although braking remains available. This observation does
not identify which guard blocked v3 and does not establish a rendering defect.

## Replay and save constraints on a physics fix

Schema-8 saves can retain un-compacted command journals. `replayJournal` uses
the live engine for schema 8; changing authoritative traffic or NPC movement
without versioning can replay a previously saved history under different rules.
A safe new implementation needs a frozen rules-8 authority, schema/rules
migration with old journal replay before conversion, authenticated historical
fixtures, and coverage of current and archived fallback paths in the IndexedDB
repository. The existing schema-6/7 archive fallback verifies the historical
migration digest; extending it requires preserving that behavior as well as a
rules-8 digest. Bundle and startup costs of an additional historical engine
must be measured. Until verified, no simulation or save rule change is included.

## Baseline tests run

`node --experimental-strip-types --test src/games/social-engine/tests/traffic.test.ts src/games/social-engine/tests/traffic-geometry.test.ts src/games/social-engine/tests/npc-movement.test.ts` passed **31/31**, 0 skipped, in 24.95 s on Node 24.21.0. Several geometry and crowd tests use authored fixtures; their passing does not prove long-term real-world NPC independence, human visual acceptance, hardware performance, or journal migration after a future rules change.

## Unpublished rules-9 candidate: stationary-speed correction

The candidate now stores zero actual speed whenever a physical reservation or
collision guard rejects movement, while retaining NPC resume intent separately.
Admission resumes with bounded acceleration, including after save/load. The schema-8
engine is frozen from the baseline with a pinned source manifest; authentic rules-8
journal fixtures replay to their original canonical hashes before schema-9 conversion.
No existing wallet, ledger, hunger or food stock is rewritten by this correction.

The driver-hunger finding remains an independent gameplay blocker at this stage.
A correct physical driver-break lifecycle must be integrated and accepted separately;
this speed correction does not claim that seven permanently attached drivers can eat.
