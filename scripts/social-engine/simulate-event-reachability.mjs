import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  createWorld,
  applyCommand,
  advanceMinutes,
  stepWorld,
  validateState,
  canonicalState,
  offerEvent,
  eventEligible,
} from "../../src/games/social-engine/simulation/engine.ts";
import { EVENT_TEMPLATES } from "../../src/games/social-engine/domain/content.ts";
import { BUILDINGS, INTERIOR_EXIT } from "../../src/games/social-engine/domain/world.ts";

const sourceFiles = ["domain", "simulation"].flatMap((dir) =>
  readdirSync(`src/games/social-engine/${dir}`)
    .filter((f) => f.endsWith(".ts"))
    .sort()
    .map((f) => `src/games/social-engine/${dir}/${f}`),
);
const sourceHash = createHash("sha256");
for (const file of sourceFiles) sourceHash.update(file).update(readFileSync(file));
const sourceSha256 = sourceHash.digest("hex");
const startedAt = new Date().toISOString();
const state = createWorld(20261103, {
  name: "Deniz Yel",
  appearance: 0,
  background: "graduate",
  attributes: { body: 3, mind: 3, social: 3, discipline: 3 },
});
const observed = new Map(),
  commands = [];
let sequence = 0;
function act(type, args = {}) {
  const command = { v: 1, id: `reachability:${sequence++}`, type, args };
  const result = applyCommand(state, command);
  commands.push({ tick: state.tick, command, result });
  assert.equal(result.ok, true, `${type}: ${result.reason}`);
  return result;
}
function collect() {
  // Reservations are genuinely declined through the player API after evidence is recorded.
  for (const quest of state.quests)
    if (quest.status === "offered") {
      if (!observed.has(quest.kind))
        observed.set(quest.kind, {
          kind: quest.kind,
          tick: state.tick,
          minute: state.minute,
          questId: quest.id,
          sourceEvent: state.events.find((event) => event.id === quest.sourceEvent),
          issuerId: quest.issuerId,
          targetId: quest.targetId,
          buildingId: quest.buildingId,
          escrow: state.accounts[`escrow:${quest.id}`],
        });
      act("DECLINE_QUEST", { questId: quest.id });
    }
  // Request each still-unseen eligible template. This tests real prerequisite reachability,
  // not random scheduler coverage; no condition, money, relationship or clock is fabricated.
  for (const template of EVENT_TEMPLATES)
    if (!observed.has(template.kind) && eventEligible(state, template)) {
      const quest = offerEvent(state, template.kind);
      if (!quest) continue;
      observed.set(quest.kind, {
        kind: quest.kind,
        tick: state.tick,
        minute: state.minute,
        questId: quest.id,
        sourceEvent: state.events.find((event) => event.id === quest.sourceEvent),
        issuerId: quest.issuerId,
        targetId: quest.targetId,
        buildingId: quest.buildingId,
        escrow: state.accounts[`escrow:${quest.id}`],
      });
      act("DECLINE_QUEST", { questId: quest.id });
    }
  assert.deepEqual(validateState(state), []);
}
function ticks(count) {
  for (let i = 0; i < count; i++) stepWorld(state);
}
function walk(buildingId) {
  const target = BUILDINGS.find((building) => building.id === buildingId).door;
  act("MOVE_TO", target);
  for (let count = 0; state.player.path.length && count < 4000; count++) stepWorld(state);
  assert.ok(
    state.player.location.scene === "outside" &&
      Math.hypot(state.player.location.x - target.x, state.player.location.y - target.y) < 0.2,
    `walk to ${buildingId}`,
  );
}
const started = performance.now();
mkdirSync("artifacts/social-engine/event-reachability", { recursive: true });
writeFileSync(
  "artifacts/social-engine/event-reachability/results.json",
  JSON.stringify({ status: "RUNNING", startedAt: new Date().toISOString() }),
);
try {
  collect();
  act("TALK", { npcId: "n0", topic: "greet" });
  ticks(20);
  act("TALK", { npcId: "n0", topic: "greet" });
  collect();
  ticks(20);
  // Faction tension needs an actual membership/action; passive heat decay is not a scenario setup.
  act("TALK", { npcId: "n0", topic: "help" });
  ticks(20);
  act("TALK", { npcId: "n0", topic: "help" });
  act("JOIN_FACTION", { factionId: "dock" });
  ticks(20);
  act("TALK", { npcId: "n0", topic: "insult" });
  ticks(20);
  act("TALK", { npcId: "n0", topic: "insult" });
  collect();
  // An independent resident may leave any venue. Follow the current world rather
  // than requiring one preselected person to remain in a restaurant.
  const livingAdults = () => state.npcs.filter(n => n.local && n.alive && n.age >= 18 && n.health > 15 && !state.vehicles.some(v => v.driverId === n.id));
  let victim;
  for (let trip = 0; trip < 8 && !victim; trip++) {
    const groups = new Map();
    for (const n of livingAdults()) if (n.location.scene !== "outside")
      groups.set(n.location.scene, (groups.get(n.location.scene) ?? 0) + 1);
    const venue = [...groups.entries()].filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1] || (a[0]<b[0]?-1:1))[0]?.[0];
    if (!venue) { ticks(30); continue; }
    if (state.player.location.scene !== "outside") act("EXIT");
    walk(venue); act("ENTER",{buildingId:venue});
    for (let t = 0; t < 120; t++) {
      const people = livingAdults().filter(n=>n.location.scene===venue);
      const distance=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
      const target=people.filter(n=>people.some(w=>w.id!==n.id && distance(w.location,n.location)<4))
        .sort((a,b)=>distance(a.location,state.player.location)-distance(b.location,state.player.location))[0];
      if (!target) break;
      if (distance(target.location,state.player.location)<0.7) { victim=target; break; }
      if(t%5===0) act("MOVE_TO",{x:target.location.x,y:target.location.y});
      stepWorld(state);
    }
  }
  assert.ok(victim,"A genuine reachable adult and independent nearby witness must be present");
  act("STOP");
  const crimeCount = state.crimes.length;
  act("ATTACK", { npcId: victim.id });
  ticks(3);
  assert.equal(
    state.crimes.length,
    crimeCount + 1,
    "Fixture must establish actual contact, not merely a windup",
  );
  assert.ok(
    state.crimes.at(-1).witnesses.length > 0,
    "Police scenarios require an actual line-of-sight witness",
  );
  ticks(120);
  collect();
  // Traffic changes can make a nearby officer complete a real arrest before this point.
  // Both outcomes use the same case/custody rules; never forge wanted state for a fixture.
  if (state.player.wanted > 0) act("SURRENDER");
  else
    assert.ok(
      state.social.police.custody ||
        state.crimes.some((c) => c.offender === "player" && c.reported),
      "Assault must produce an actual reported case or custody",
    );
  for (let i = 0; state.social.police.custody && i < 1000; i++) stepWorld(state);
  assert.equal(
    Boolean(state.social.police.custody),
    false,
    "Custody must finish before bank journey",
  );
  if (state.player.location.scene !== "outside") {
    act("MOVE_TO", INTERIOR_EXIT);
    for (let i = 0; state.player.path.length && i < 1000; i++) stepWorld(state);
    act("EXIT");
  }
  walk("b-bank");
  act("BORROW", { amount: 20000 });
  collect();
  let days = 0;
  while (observed.size < EVENT_TEMPLATES.length && days < 365) {
    advanceMinutes(state, 1440);
    days++;
    collect();
  }
  const missing = EVENT_TEMPLATES.filter((template) => !observed.has(template.kind)).map(
    (template) => template.kind,
  );
  const result = {
    status: missing.length ? "FAIL" : "PASS",
    sourceSha256,
    sourceFiles,
    startedAt,
    finishedAt: new Date().toISOString(),
    seed: state.seed,
    daysAfterInitialActions: days,
    ticks: state.tick,
    elapsedMs: performance.now() - started,
    observed: [...observed.values()],
    missing,
    playerCommands: commands,
    sourceStateHash: createHash("sha256").update(canonicalState(state)).digest("hex"),
    note: "All prerequisites arise from real initial profile, player commands, pathfinding and autonomous economy. Eligible templates are explicitly requested to test reachability; this is not proof that random scheduling shows all twenty in a short playthrough and is not human-playtest evidence.",
  };
  mkdirSync("artifacts/social-engine/event-reachability", { recursive: true });
  writeFileSync(
    "artifacts/social-engine/event-reachability/results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        ...result,
        observed: result.observed.map((event) => ({ kind: event.kind, minute: event.minute })),
        playerCommands: undefined,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(missing, []);
} catch (error) {
  writeFileSync(
    "artifacts/social-engine/event-reachability/results.json",
    JSON.stringify(
      {
        status: "FAIL",
        finishedAt: new Date().toISOString(),
        reason: String(error.stack ?? error),
        ticks: state.tick,
        observed: [...observed.values()],
        playerCommands: commands,
      },
      null,
      2,
    ),
  );
  throw error;
}
