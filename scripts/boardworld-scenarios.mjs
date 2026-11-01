/** Independent player policies. All progression uses the exported resolver. */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  createGame,
  getActions,
  getAppointmentOptions,
  getCityView,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { JOBS, HOMES } from "../public/games/tc-sim-boardworld/content.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";

const dayOf = (s) => Math.floor(s.time / 1440) + 1;
const funds = (s) => s.cash + s.bank;
const lookup = (xs, id) => xs.find((x) => x.id === id);
export function selectLifeAction(s, style, memory = {}) {
  const actions = getActions(s).filter((a) => !a.disabled),
    pick = (id) => actions.find((a) => a.id === id);
  const day = dayOf(s),
    minute = s.time % 1440;
  if (s.pendingEvents.length)
    return (
      actions.find((a) => a.id.startsWith("event:") && a.cost === 0) ||
      actions.find((a) => a.id.startsWith("event:"))
    );
  const home = lookup(HOMES, s.housing.id).district;
  const pending = s.calendar.entries
    .filter((e) => e.status === "confirmed" && e.end > s.time)
    .sort((a, b) => a.start - b.start)[0];
  const travel = pending
    ? (s.location === pending.district
        ? 0
        : getCityView(s).routes.find((r) => r.to === pending.district && r.mode === "transit")
            ?.minutes || 90) + (s.city.venue === pending.venue ? 0 : 10)
    : 0;
  if (pending) {
    const attend = pick(`calendar:attend:${pending.id}`);
    if (attend) return attend;
    if (pending.start - s.time <= travel + 60) {
      const visit = pick(`visit:${pending.venue}`);
      if (visit) return visit;
      if (pick("calendar:next")) return pick("calendar:next");
    }
  }
  const fits = (a) =>
    a && (!pending || s.time + a.minutes + travel <= pending.start - 20 || s.time >= pending.end);
  const counter = s.calendar.entries.find((e) => e.status === "counter");
  if (counter)
    return pick(`calendar:accept:${counter.id}`) || pick(`calendar:decline:${counter.id}`);
  if (s.cash < 400 && s.bank > 0) {
    const a = pick("withdraw:1000") || pick("withdraw:all");
    if (a) return a;
  }
  if (s.player.hunger < 45) {
    const a = pick("cook") || pick("soup") || pick("eat") || pick("snack") || pick("buy:groceries");
    if (fits(a)) return a;
  }
  const story = actions.find((a) => a.id.startsWith("story:") && a.cost === 0 && fits(a));
  if (story) return story;
  if (style === "entrepreneur") {
    if (!s.living.projects.some((p) => p.type === "enterprise")) {
      const p = pick("project:start:enterprise:repair:90");
      if (p) return p;
    }
    if (!s.deep.business) {
      const start = pick("business:start:repair");
      if (fits(start)) return start;
    }
    if (s.deep.business) {
      const e = s.living.enterprise;
      if (e.capital >= 3000 && pick("business:withdraw:2000"))
        return pick("business:withdraw:2000");
      if (e.capital < 700 && funds(s) > 1200) {
        const a = pick("business:fund:2000") || pick("business:fund:500");
        if (a) return a;
      }
      if (e.stock < 2) {
        const a = pick("business:stock:6") || pick("business:stock:3");
        if (fits(a)) return a;
      }
      if (s.deep.business.level < 1 && funds(s) > 8000 && fits(pick("business:upgrade")))
        return pick("business:upgrade");
      if (s.deep.business.clients < 4 && fits(pick("business:acquire")))
        return pick("business:acquire");
      if (s.player.energy >= 40 && fits(pick("business:serve"))) return pick("business:serve");
      if (funds(s) < 2000 && pick("business:withdraw:500")) return pick("business:withdraw:500");
    }
    if (s.deep.freelance.active) {
      if (fits(pick("freelance:deliver"))) return pick("freelance:deliver");
      if (minute < 1080 && s.player.energy > 35 && fits(pick("freelance:work")))
        return pick("freelance:work");
    } else if (minute < 1080 && funds(s) > 600 && fits(pick("freelance:accept:repair")))
      return pick("freelance:accept:repair");
  } else {
    if (!s.job && fits(pick("apply:retail"))) return pick("apply:retail");
    if (style === "career") {
      if (!s.living.projects.some((p) => p.type === "qualification")) {
        const a = pick("project:start:qualification:craft:75");
        if (a) return a;
      }
      if (day >= 30 && s.job?.id === "retail" && !s.deep.career.noticeDay && pick("career:notice"))
        return pick("career:notice");
      if (day >= 37 && s.job?.id === "retail" && s.player.skills.craft >= 25) {
        if (!s.inventory.tools && funds(s) > 6000 && fits(pick("buy:tools")))
          return pick("buy:tools");
        if (fits(pick("apply:repair"))) return pick("apply:repair");
      }
      if (fits(pick("career:negotiate"))) return pick("career:negotiate");
    }
    if (fits(pick("promote"))) return pick("promote");
    if (fits(pick("work"))) return pick("work");
    if (s.job && minute < 600 && s.location !== lookup(JOBS, s.job.id).district) {
      const a = pick(`travel:${lookup(JOBS, s.job.id).district}`);
      if (fits(a)) return a;
    }
  }
  if (style === "social") {
    const contacts = ["leyla", "mert", "aylin"];
    if (!s.living.projects.some((p) => p.type === "relationship" && p.status === "active")) {
      const id = contacts.find(
        (id) => !s.living.projects.some((p) => p.type === "relationship" && p.target === id),
      );
      if (id) {
        const a = pick(`project:start:relationship:${id}:60`);
        if (a) return a;
      }
    }
    if (!pending && day >= (memory.proposalDay || 0) + 5 && minute >= 540 && minute <= 1255) {
      const target =
        s.living.projects.find((p) => p.type === "relationship" && p.status === "active")?.target ||
        contacts[Math.floor(day / 7) % 3];
      const options = {
        kind: "meeting",
        npcId: target,
        subjectId: "",
        day: day + 1,
        venue: `${home}-cafe`,
        duration: 60,
        repeat: "none",
      };
      const slot = getAppointmentOptions(s, options).slots.find(
        (slot) => slot.available && slot.minute >= 1050 && slot.minute <= 1200,
      );
      memory.proposalDay = day;
      if (slot) return { id: "calendar:propose", payload: { ...options, minute: slot.minute } };
    }
    for (const id of contacts)
      for (const kind of ["talk", "call", "mentor"]) {
        const a = pick(`${kind}:${id}`);
        if (fits(a)) return a;
      }
  }
  if (minute >= 1080) {
    if (s.location !== home) {
      const a = pick(`travel:${home}`) || pick(`walk:${home}`);
      if (fits(a)) return a;
    }
    if (fits(pick("sleep"))) return pick("sleep");
  }
  if (s.player.energy < 55 || s.player.stress > 40) {
    if (fits(pick("rest"))) return pick("rest");
  }
  if (style === "career") {
    if (
      !s.course &&
      !s.documents.some((d) => d.id === "certificate-repair") &&
      funds(s) > 4000 &&
      fits(pick("enroll:repair"))
    )
      return pick("enroll:repair");
    if (fits(pick("study"))) return pick("study");
    if (fits(pick("practice:craft"))) return pick("practice:craft");
  }
  for (const id of ["practice:communication", "exercise", "rest", "wait:60"])
    if (fits(pick(id))) return pick(id);
  return pick("calendar:next") || pick("wait:60");
}

export function playLife({
  scenario = "restart",
  seed = 2026,
  style = "career",
  days = 90,
  replay = true,
  checkpoints = [30, 90, 180],
  onCheckpoint,
  onAction,
  selector = selectLifeAction,
} = {}) {
  let state = createGame({ scenario, seed, name: `${style} yaşamı` }),
    shadow = replay ? structuredClone(state) : null;
  const initial = structuredClone(state),
    memory = {},
    actions = [],
    counts = {},
    observed = { moved: new Set(), careers: new Set(), npcContacts: 0 };
  const started = performance.now();
  const captured = new Set();
  for (let turn = 0; dayOf(state) < days + 1 && turn < 7000; turn++) {
    const action = selector(state, style, memory);
    assert.ok(
      action,
      `no legal next action: ${scenario}/${style} day${dayOf(state)} time${state.time % 1440}`,
    );
    const before = structuredClone(state),
      outcome = resolveAction(state, action.id, action.payload);
    assert.equal(outcome.ok, true, `${style} ${action.id}: ${outcome.message}`);
    assert.deepEqual(state, before, "authoritative actions leave input untouched");
    state = outcome.state;
    assert.equal(validateState(state), true, `${action.id}: all state invariants`);
    assert.ok(state.time >= before.time);
    if (shadow) {
      const result = resolveAction(shadow, action.id, action.payload);
      assert.equal(result.ok, true);
      shadow = result.state;
      if (turn % 37 === 0) shadow = importGame(exportGame(shadow)).state;
      assert.deepEqual(state, shadow, `exact persisted replay turn${turn}`);
    }
    onAction?.({ before, state, action, turn });
    actions.push({ id: action.id, ...(action.payload ? { payload: action.payload } : {}) });
    counts[action.id] = (counts[action.id] || 0) + 1;
    for (const id of Object.keys(state.deep.npcs)) {
      if (state.deep.npcs[id].home !== before.deep.npcs[id].home) observed.moved.add(id);
      if (
        state.deep.npcs[id].profession !== before.deep.npcs[id].profession ||
        state.deep.npcs[id].employment !== before.deep.npcs[id].employment
      )
        observed.careers.add(id);
      observed.npcContacts += Object.keys(state.living.graph[id]).filter(
        (other) =>
          state.living.graph[id][other].lastContactAt >
          before.living.graph[id][other].lastContactAt,
      ).length;
    }
    for (const checkpoint of checkpoints)
      if (dayOf(state) >= checkpoint + 1 && !captured.has(checkpoint)) {
        captured.add(checkpoint);
        onCheckpoint?.({
          days: checkpoint,
          state,
          actions: actions.length,
          elapsedMs: performance.now() - started,
        });
      }
  }
  assert.ok(dayOf(state) >= days + 1, `${style} reaches ${days} complete legal days`);
  return {
    state,
    initial,
    actions,
    counts,
    elapsedMs: performance.now() - started,
    observed: {
      moved: [...observed.moved],
      careers: [...observed.careers],
      npcContacts: observed.npcContacts,
    },
  };
}
