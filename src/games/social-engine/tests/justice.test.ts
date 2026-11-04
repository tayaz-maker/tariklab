import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  applyCommand,
  stepWorld,
  advanceMinutes,
  canonicalState,
} from "../simulation/engine.ts";
import { dailyEconomy } from "../simulation/society.ts";
import { recordTestimony } from "../simulation/social.ts";
import { tickJustice, validateJustice, projectJustice } from "../simulation/justice.ts";
import { reconcile, transfer } from "../simulation/ledger.ts";
import { processDeath } from "../simulation/family.ts";
import type { WorldState } from "../domain/types.ts";
let seq = 0;
const act = (
  s: WorldState,
  type: string,
  args: Record<string, unknown> = {},
  id = `justice:${seq++}`,
) => applyCommand(s, { v: 1, id, type, args });
const crime = (s: WorldState, id: string, reported = false, witnessed = false) => {
  s.crimes.push({
    id,
    offender: "player",
    victim: "n0",
    witnesses: witnessed ? ["n1"] : [],
    evidence: witnessed ? ["victim:n0", "saw:n1"] : ["victim:n0"],
    reported,
    status: reported ? "investigating" : "unreported",
    tick: s.tick,
    fine: 15000,
  });
  return s.crimes.at(-1)!;
};
const valid = (s: WorldState) => {
  assert.deepEqual(validateJustice(s), []);
  assert.deepEqual(reconcile(s), []);
};
test("NPC fine preserves unpaid arrears exactly once instead of forgiving unavailable cash", () => {
  const s = createWorld(),
    npc = s.npcs[0];
  assert.equal(
    transfer(s, "npc-fine-fixture", "n0", "external", s.accounts.n0 - 1000, "fixture-spending"),
    true,
  );
  const beforeDebt = npc.debt,
    beforeAsset = Number(s.flags["loanAsset:n0"] ?? 0),
    beforeMunicipal = s.accounts.municipality;
  const c = crime(s, "npc-unpaid", true, true);
  c.offender = "n0";
  c.victim = "n2";
  c.evidence = ["victim:n2", "saw:n1"];
  tickJustice(s);
  s.minute += 60;
  s.tick += 600;
  tickJustice(s);
  assert.equal(c.status, "resolved");
  assert.equal(s.accounts.n0, 0);
  assert.equal(npc.debt - beforeDebt, 14000);
  assert.equal(Number(s.flags["loanAsset:n0"]) - beforeAsset, 14000);
  assert.equal(s.accounts.municipality - beforeMunicipal, 1000);
  const settled = canonicalState(s);
  tickJustice(s);
  assert.equal(canonicalState(s), settled);
  valid(s);
});
test("a pending NPC investigation closes after death without charging the completed estate", () => {
  const s = createWorld(),
    fact = crime(s, "deceased-suspect", true, true);
  fact.offender = "n0";
  fact.victim = "n2";
  fact.evidence = ["victim:n2", "saw:n1"];
  tickJustice(s);
  assert.equal(processDeath(s, "n0", "case-estate-death").ok, true);
  const estate = structuredClone(s.life.estates),
    accounts = { ...s.accounts },
    debt = s.npcs[0].debt;
  s.minute += 60;
  s.tick += 600;
  tickJustice(s);
  assert.equal(s.social.police.cases.find((c) => c.crimeId === fact.id)?.status, "acquitted");
  assert.equal(fact.status, "resolved");
  assert.equal(s.npcs[0].debt, debt);
  assert.deepEqual(s.life.estates, estate);
  assert.deepEqual(s.accounts, accounts);
  assert.ok(fact.evidence.includes("saw:n1"));
  valid(s);
});
test("unreported hidden offender creates no police case, identity, pursuit or projected knowledge", () => {
  const s = createWorld();
  crime(s, "hidden");
  advanceMinutes(s, 20);
  assert.equal(s.player.wanted, 0);
  assert.equal(s.social.police.cases.length, 0);
  assert.equal(projectJustice(s).cases.length, 0);
  valid(s);
});
test("unsupported false accusation is never physical evidence and review acquits without payment", () => {
  const s = createWorld();
  const fact = crime(s, "allegation");
  recordTestimony(s, "n2", fact.id, "player");
  tickJustice(s);
  const c = s.social.police.cases[0];
  assert.equal(c.knownSuspectId, "player");
  assert.deepEqual(c.knownEvidence, []);
  assert.equal(s.player.wanted, 0);
  s.player.location = { x: 7, y: 9, scene: "b-police" };
  const before = { ...s.accounts };
  assert.equal(act(s, "POLICE_REVIEW", { caseId: c.id }).ok, true);
  assert.equal(c.status, "acquitted");
  assert.deepEqual(s.accounts, before);
  assert.deepEqual(fact.evidence, ["victim:n0"]);
  valid(s);
});
test("only two verified cases dispatch, backlog queues and hidden escape releases dispatch capacity", () => {
  const s = createWorld();
  for (let i = 0; i < 4; i++) crime(s, "verified" + i, true, true);
  s.tick += 80;
  s.minute += 8;
  tickJustice(s);
  assert.equal(s.social.police.cases.filter((c) => c.status === "pursuit").length, 2);
  assert.equal(s.social.police.cases.filter((c) => c.status === "queued").length, 2);
  assert.equal(s.player.wanted, 2);
  s.player.location = { x: 7, y: 9, scene: "b-home" };
  s.minute = Number(s.flags.pursuitUntil);
  s.tick = s.minute * 10;
  tickJustice(s);
  assert.equal(s.player.wanted, 0);
  assert.equal(s.social.police.cases.filter((c) => c.status === "pursuit").length, 0);
  tickJustice(s);
  assert.equal(s.social.police.cases.filter((c) => c.status === "pursuit").length, 2);
  assert.ok(
    s.social.police.cases
      .filter((c) => s.flags[`caseHidden:${c.crimeId}`])
      .every((c) => c.status === "queued"),
  );
  valid(s);
});
test("actual voluntary custody blocks movement, survives save/resume, releases after30minutes with one supported fine", () => {
  const s = createWorld();
  const fact = crime(s, "custody", true, true);
  for (let i = 0; i < 81; i++) stepWorld(s);
  s.player.location = { x: 7, y: 9, scene: "b-police" };
  const c = s.social.police.cases.find((c) => c.crimeId === fact.id)!;
  const before = s.accounts.player;
  assert.equal(act(s, "POLICE_ATTEND", { caseId: c.id }, "attend-once").ok, true);
  assert.equal(act(s, "MOVE", { x: 1, y: 0 }).ok, false);
  assert.equal(act(s, "APPLY_JOB", { jobId: "retail" }).ok, false);
  advanceMinutes(s, 29);
  assert.ok(s.social.police.custody);
  assert.equal(s.accounts.player, before);
  const resumed = JSON.parse(canonicalState(s)) as WorldState;
  advanceMinutes(s, 1);
  advanceMinutes(resumed, 1);
  assert.equal(canonicalState(s), canonicalState(resumed));
  assert.equal(s.social.police.custody, null);
  assert.equal(s.accounts.player, before - 15000);
  assert.equal(c.status, "fined");
  assert.equal(s.player.wanted, 0);
  assert.equal(act(s, "POLICE_ATTEND", { caseId: c.id }, "attend-once").ok, false);
  assert.equal(s.accounts.player, before - 15000);
  valid(s);
});
test("unsupported custody ends in acquittal with no money, debt or automatic wanted level", () => {
  const s = createWorld();
  const fact = crime(s, "false-custody");
  recordTestimony(s, "n2", fact.id, "player");
  tickJustice(s);
  s.player.location = { x: 7, y: 9, scene: "b-police" };
  const c = s.social.police.cases[0],
    before = s.accounts.player,
    debt = s.player.debt;
  assert.equal(act(s, "POLICE_ATTEND", { caseId: c.id }).ok, true);
  advanceMinutes(s, 30);
  assert.equal(c.status, "acquitted");
  assert.equal(s.accounts.player, before);
  assert.equal(s.player.debt, debt);
  assert.equal(s.player.wanted, 0);
  assert.equal(s.social.police.custody, null);
  valid(s);
});
test("unsupported allegation does not overwrite known witnessed identity or erase evidence", () => {
  const s = createWorld();
  const fact = crime(s, "verified-report", true, true);
  recordTestimony(s, "n2", fact.id, "n3");
  tickJustice(s);
  const c = s.social.police.cases[0];
  assert.equal(c.knownSuspectId, "player");
  assert.deepEqual(c.knownEvidence, ["saw:n1"]);
  s.player.location = { x: 7, y: 9, scene: "b-police" };
  assert.equal(act(s, "POLICE_REVIEW", { caseId: c.id }).ok, false);
  assert.equal(c.status, "investigating");
  valid(s);
});
test("corrupt police knowledge, capacity and unsupported conviction fail validation", () => {
  const s = createWorld();
  const fact = crime(s, "bad-case");
  recordTestimony(s, "n2", fact.id, "player");
  tickJustice(s);
  const c = s.social.police.cases[0];
  c.knownEvidence = ["saw:n99"];
  assert.ok(validateJustice(s).includes("police-knowledge"));
  c.knownEvidence = [];
  c.status = "fined";
  assert.ok(validateJustice(s).includes("police-unsupported-fine"));
});

test("bounded case and statement history neither reopens dismissed allegations nor blocks new reports", () => {
  const s = createWorld();
  s.player.location = { x: 7, y: 9, scene: "b-police" };
  for (let i = 0; i < 150; i++) {
    const fact = crime(s, `archived:${i}`);
    assert.ok(recordTestimony(s, "n2", fact.id, "player"));
    tickJustice(s);
    const c = s.social.police.cases.find((c) => c.crimeId === fact.id)!;
    assert.equal(act(s, "POLICE_REVIEW", { caseId: c.id }).ok, true);
  }
  assert.equal(s.social.police.cases.length, 128);
  assert.equal(s.social.testimonies.length, 128);
  tickJustice(s);
  assert.ok(s.social.police.cases.every((c) => c.status === "acquitted"));
  assert.equal(s.player.wanted, 0);
  valid(s);
  const original = s.crimes[0];
  original.reported = true;
  original.status = "investigating";
  original.witnesses = ["n1"];
  original.evidence.push("saw:n1");
  s.tick += 81;
  s.minute += 8;
  tickJustice(s);
  assert.equal(s.social.police.cases.find((c) => c.crimeId === original.id)?.status, "pursuit");
  assert.equal(s.player.wanted, 1);
  valid(s);
});

test("weekly economy cannot bypass police capacity or forgive an NPC case's unpaid fine", () => {
  const s = createWorld();
  s.minute = 7 * 1440;
  s.tick = s.minute * 10;
  for (let i = 0; i < 3; i++) {
    const c = crime(s, `week-boundary:${i}`, true, true);
    c.offender = `n${i + 2}`;
  }
  tickJustice(s);
  assert.equal(s.social.police.cases.filter((c) => c.status === "investigating").length, 2);
  assert.equal(s.social.police.cases.filter((c) => c.status === "queued").length, 1);
  dailyEconomy(s);
  assert.ok(
    s.crimes.every((c) => c.status !== "resolved"),
    "Payroll/weekly economy must not settle pending police cases",
  );
  assert.ok(
    s.ledger.every((e) => e.reason !== "npc-case-fine"),
    "No second fine identity outside justice",
  );
  tickJustice(s);
  assert.equal(s.social.police.cases.filter((c) => c.status === "investigating").length, 2);
  assert.equal(s.social.police.cases.filter((c) => c.status === "queued").length, 1);
  valid(s);
});

test("queued NPC investigations spend their own60minute dispatch interval before a fine", () => {
  const s = createWorld();
  for (let i = 0; i < 3; i++) {
    const c = crime(s, `npc-backlog:${i}`, true, true);
    c.offender = `n${i + 2}`;
  }
  tickJustice(s);
  s.minute += 60;
  s.tick += 600;
  tickJustice(s);
  assert.equal(s.social.police.cases.filter((c) => c.status === "fined").length, 2);
  const last = s.social.police.cases[2];
  assert.equal(last.status, "investigating", "Time spent queued is not investigation work");
  const balance = s.accounts.n4;
  s.minute += 59;
  s.tick += 590;
  tickJustice(s);
  assert.equal(last.status, "investigating");
  assert.equal(s.accounts.n4, balance);
  s.minute++;
  s.tick += 10;
  tickJustice(s);
  assert.equal(last.status, "fined");
  assert.equal(s.accounts.n4, balance - 15000);
  const settled = canonicalState(s);
  tickJustice(s);
  assert.equal(canonicalState(s), settled);
  valid(s);
});
