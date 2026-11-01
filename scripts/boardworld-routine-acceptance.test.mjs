import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import {
  createGame,
  getActions,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";

// The controller is the same one measured against immutable production4.0.
// It opts into existing frugal/withdraw policies, chooses events explicitly,
// and retains review of monthly changed terms. It never grants5.0 settlement
// consent. Command counts are not a claim about human navigation gestures.
const results = [];
for (const seed of [2026, 91373])
  test(`routine/${seed}:365 legal days reduce redundant retries without removing necessary reviews`, () => {
    let state = createGame({ scenario: "restart", seed, name: "Rutin karşılaştırması" });
    let shadow = structuredClone(state),
      skipRoutineAt = -1;
    const counts = {
      outer: 0,
      manualMaintenance: 0,
      explicitChoices: 0,
      routineControls: 0,
      innerActions: 0,
      zeroProgress: 0,
      financialReviews: 0,
    };
    const captured = new Set(),
      checkpoints = [];
    for (let turn = 0; Math.floor(state.time / 1440) < 365 && turn < 10000; turn++) {
      const actions = getActions(state).filter((a) => !a.disabled);
      const pick = (id) => actions.find((a) => a.id === id);
      const day = Math.floor(state.time / 1440) + 1;
      let chosen =
        actions.find((a) => a.id.startsWith("event:") && a.cost === 0) ||
        actions.find((a) => a.id.startsWith("event:")) ||
        actions.find((a) => a.id.startsWith("story:") && a.cost === 0) ||
        actions.find((a) => a.id.startsWith("story:"));
      if (!chosen)
        chosen =
          actions.find((a) => a.id.startsWith("systemic:") && a.id.endsWith(":finish")) ||
          actions.find((a) => a.id.startsWith("systemic:") && a.id.endsWith(":commit")) ||
          actions.find((a) => a.id.startsWith("systemic:") && a.id.endsWith(":adapt")) ||
          actions.find((a) => a.id.startsWith("systemic:") && a.id.endsWith(":decline"));
      chosen ||= pick("lease:renew");
      chosen ||= pick("policy:meal:frugal") || pick("policy:autoWithdraw:true");
      if (!chosen && !state.job) chosen = pick("apply:retail");
      chosen ||= pick("promote");
      if (!chosen && state.time !== skipRoutineAt)
        chosen = pick(day <= 359 ? "schedule:run:7" : "schedule:run:1");
      if (!chosen && state.player.hunger < 45) chosen = pick("cook") || pick("soup") || pick("eat");
      chosen ||=
        pick("work") ||
        (state.time % 1440 >= 1080 ? pick("sleep") : null) ||
        pick("rest") ||
        pick("wait:60");
      assert.ok(chosen, "a lawful manual recovery remains available");
      const before = structuredClone(state),
        result = resolveAction(state, chosen.id);
      assert.equal(result.ok, true, `${chosen.id}: ${result.message}`);
      assert.deepEqual(state, before);
      state = result.state;
      assert.ok(validateState(state));
      const replayed = resolveAction(shadow, chosen.id);
      assert.equal(replayed.ok, true);
      shadow = replayed.state;
      if (turn % 17 === 0) shadow = importGame(exportGame(shadow)).state;
      assert.deepEqual(state, shadow, `routine persisted replay turn${turn}`);
      assert.equal(state.flow.settlements, "review");
      assert.equal(state.flow.consent, null);
      counts.outer++;
      if (
        /^(sleep|rest|work|study|exercise|eat|cook|soup|snack|wait:|walk:|travel:|practice:|withdraw:|buy:groceries)/.test(
          chosen.id,
        )
      )
        counts.manualMaintenance++;
      else if (chosen.id.startsWith("schedule:run:")) counts.routineControls++;
      else counts.explicitChoices++;
      if (chosen.id.startsWith("schedule:run:")) {
        counts.innerActions += state.deep.routine.lastActions.length;
        if (state.flow.stop?.code === "payment") counts.financialReviews++;
        if (state.time === before.time) {
          counts.zeroProgress++;
          skipRoutineAt = state.time;
        } else skipRoutineAt = -1;
      }
      for (const completeDays of [30, 90, 180, 365])
        if (Math.floor(state.time / 1440) >= completeDays && !captured.has(completeDays)) {
          captured.add(completeDays);
          checkpoints.push({
            completeDays,
            ...counts,
            saveBytes: Buffer.byteLength(exportGame(state)),
            health: state.player.health,
            cash: state.cash,
            bank: state.bank,
            debt: state.debt,
            arrears: state.housing.arrears,
          });
        }
    }
    assert.equal(Math.floor(state.time / 1440), 365);
    assert.equal(checkpoints.length, 4);
    assert.equal(state.job.id, "retail");
    assert.equal(state.job.level, 2);
    assert.ok(state.job.shifts >= 300);
    assert.equal(state.housing.arrears, 0);
    assert.ok(state.player.health >= 80 && state.debt > 0);
    assert.ok(counts.explicitChoices >= 100, "events and causal choices remain explicit");
    assert.ok(counts.manualMaintenance >= 12, "necessary monthly reviews are not hidden");
    assert.ok(counts.financialReviews >= 12);
    // Frozen4.0:14manual recoveries+14zero-time routine attempts=28avoidable
    // commands per seed. At least25% improvement requires21or fewer, while
    // manual maintenance is reported independently rather than relabelled.
    const avoidable = counts.manualMaintenance + counts.zeroProgress;
    assert.ok(avoidable <= 21, `avoidable commands ${avoidable} exceed the disclosed25% target`);
    assert.ok(counts.zeroProgress < 14);
    results.push({
      seed,
      checkpoints,
      counts,
      baselineAvoidable: 28,
      avoidable,
      reductionPercent: 100 * (1 - avoidable / 28),
    });
    if (process.env.BOARDWORLD_ROUTINE_REPORT)
      writeFileSync(
        process.env.BOARDWORLD_ROUTINE_REPORT,
        JSON.stringify({ lives: results }, null, 2) + "\n",
      );
  });
