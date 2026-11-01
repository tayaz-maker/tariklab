import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  resolveAction,
  getActions,
  validateState,
  getAppointmentOptions,
  getCalendarView,
  getCityView,
  previewAction,
  getIntentActions,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { EVENTS, NPCS, COURSES } from "../public/games/tc-sim-boardworld/content.mjs";
import { getRoute } from "../public/games/tc-sim-boardworld/city.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";

// Focused boundary fixtures isolate cards; long-run acceptance uses untouched lives.
function fixture() {
  const s = createGame({ seed: 77 });
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.cash = 20000;
  return step(s, "wait:60");
}
function step(s, id, payload) {
  const before = structuredClone(s),
    r = resolveAction(s, id, payload);
  assert.equal(r.ok, true, `${id}: ${r.message}`);
  assert.deepEqual(s, before, "input remains immutable");
  assert.equal(validateState(r.state), true);
  return r.state;
}
function wait(s, at) {
  while (s.time + 60 <= at) s = step(s, "wait:60");
  while (s.time + 15 <= at) s = step(s, "wait:15");
  return s;
}
function draft(s, changes = {}) {
  return {
    kind: "meeting",
    npcId: "leyla",
    subjectId: "",
    day: Math.floor(s.time / 1440) + 2,
    minute: 1080,
    venue: "kadikoy-cafe",
    duration: 60,
    repeat: "none",
    ...changes,
  };
}
function freeDraft(s, p = draft(s)) {
  for (let offset = 0; offset < 7; offset++) {
    const q = { ...p, day: p.day + offset };
    const slot = getAppointmentOptions(s, q).slots.find(
      (x) => x.available && !x.counterExpected && !x.rejectionExpected,
    );
    if (slot) return { ...q, minute: slot.minute };
  }
  throw new Error("No feasible appointment in seven days");
}
function entry(s) {
  // These cases track player-authored plans; an autonomous invitation can arrive later.
  return s.calendar.entries.findLast((e) => !s.society?.offers.some((o) => o.calendarId === e.id));
}

test("chosen meeting time, venue, early attendance and once-only outcome survive exact save/reload", () => {
  let s = fixture();
  const p = freeDraft(s),
    before = structuredClone(s),
    forecast = previewAction(s, "calendar:propose", p);
  assert.equal(forecast.ok, true);
  assert.deepEqual(s, before);
  s = step(s, "calendar:propose", p);
  const e = entry(s);
  assert.equal(e.start, (p.day - 1) * 1440 + p.minute);
  assert.equal(e.status, "confirmed");
  assert.equal(e.end - e.start, 60);
  s = step(s, `visit:${e.venue}`);
  s = wait(s, e.start - 30);
  const reload = importGame(exportGame(s)).state;
  assert.deepEqual(reload, s);
  const beforeCash = s.cash,
    beforeTrust = s.npcs.leyla.trust;
  const done = step(s, `calendar:attend:${e.id}`),
    replayed = step(reload, `calendar:attend:${e.id}`);
  assert.deepEqual(done, replayed);
  assert.equal(done.time, e.end);
  assert.equal(entry(done).status, "completed");
  assert.equal(entry(done).lateBy, 0);
  assert.ok(done.cash < beforeCash);
  assert.equal(done.npcs.leyla.trust, Math.min(100, beforeTrust + 10));
  assert.equal(resolveAction(done, `calendar:attend:${e.id}`).ok, false);
});

test("overlapping player commitments and insufficient transfer buffers are rejected atomically", () => {
  let s = fixture();
  const p = freeDraft(s);
  s = step(s, "calendar:propose", p);
  for (const q of [
    { ...p, kind: "personal", npcId: "", subjectId: "rest", venue: "kadikoy-park" },
    {
      ...p,
      kind: "personal",
      npcId: "",
      subjectId: "practice",
      venue: "sisli-park",
      minute: p.minute + 60,
    },
  ]) {
    const before = structuredClone(s),
      r = resolveAction(s, "calendar:propose", q);
    assert.equal(r.ok, false);
    assert.match(r.message, /çakış|ulaşım/);
    assert.deepEqual(r.state, before);
  }
  const a = getActions(s).find((a) => a.id === "sleep");
  assert.ok(a, "ordinary actions remain discoverable");
});

test("NPC unavailability yields grounded counterproposal, acceptance and explicit rejection", () => {
  let s = fixture(),
    chosen = null;
  for (const npc of NPCS) {
    s.npcs[npc.id].affinity = 25;
    s.npcs[npc.id].trust = 25;
    for (let d = 2; d <= 5 && !chosen; d++) {
      const p = draft(s, { npcId: npc.id, day: d });
      const slot = getAppointmentOptions(s, p).slots.find((x) => x.available && x.counterExpected);
      if (slot) chosen = { ...p, minute: slot.minute };
    }
    if (chosen) break;
  }
  assert.ok(chosen);
  s = step(s, "calendar:propose", chosen);
  const counter = entry(s);
  assert.equal(counter.status, "counter");
  assert.notEqual(counter.start, (chosen.day - 1) * 1440 + chosen.minute);
  const accepted = step(s, `calendar:accept:${counter.id}`);
  assert.equal(entry(accepted).status, "confirmed");
  const rejected = step(s, `calendar:decline:${counter.id}`);
  assert.equal(entry(rejected).status, "rejected");
  const weak = fixture(),
    q = draft(weak, { npcId: NPCS.find((n) => n.id !== "leyla").id });
  const refused = step(weak, "calendar:propose", q);
  assert.equal(entry(refused).status, "rejected");
});

test("rescheduling preserves history and cancellation differs from no-show", () => {
  let s = fixture();
  const p = freeDraft(s);
  s = step(s, "calendar:propose", p);
  const first = entry(s);
  const moved = freeDraft(s, { ...p, day: p.day + 1 });
  s = step(s, `calendar:reschedule:${first.id}`, moved);
  assert.equal(s.calendar.entries.find((e) => e.id === first.id).status, "cancelled");
  assert.equal(entry(s).status, "confirmed");
  const e = entry(s),
    trust = s.npcs[e.npcId].trust;
  const cancelled = step(s, `calendar:cancel:${e.id}`);
  assert.equal(entry(cancelled).status, "cancelled");
  assert.equal(cancelled.npcs[e.npcId].trust, trust - 1);
  const missed = wait(s, e.start + 75);
  assert.equal(entry(missed).status, "missed");
  assert.ok(missed.npcs[e.npcId].trust <= trust - 12);
  assert.equal(missed.calendar.stats.missed, 1);
  const later = wait(missed, missed.time + 120);
  assert.equal(later.calendar.stats.missed, 1);
  assert.equal(resolveAction(missed, `calendar:reschedule:${e.id}`, moved).ok, false);
});

test("late attendance is distinct and cannot extend the reservation into a second booking", () => {
  let s = fixture();
  const p = freeDraft(s);
  s = step(s, "calendar:propose", p);
  const e = entry(s);
  s = step(s, `visit:${e.venue}`);
  s = wait(s, e.start + 15);
  const trust = s.npcs[e.npcId].trust;
  s = step(s, `calendar:attend:${e.id}`);
  assert.ok(entry(s).lateBy > 0 && entry(s).lateBy <= 30);
  assert.equal(s.time, e.end);
  assert.equal(s.npcs[e.npcId].trust, Math.min(100, trust + 2));
});

test("scheduled shift uses actual duration, earned pay and ordinary career causal hooks once", () => {
  let s = step(fixture(), "apply:retail");
  const p = draft(s, {
    kind: "shift",
    npcId: "",
    subjectId: "retail",
    day: 2,
    minute: 540,
    venue: "kadikoy-work",
    duration: 60,
  });
  s = step(s, "calendar:propose", p);
  const e = entry(s);
  assert.equal(e.end - e.start, 420);
  s = step(s, "visit:kadikoy-work");
  s = wait(s, e.start - 30);
  const earned = s.job.earned,
    experience = s.deep.career.experience.retail;
  s = step(s, `calendar:attend:${e.id}`);
  assert.equal(s.job.earned - earned, 1000);
  assert.equal(s.deep.career.experience.retail, experience + 1);
  assert.equal(s.job.lastWorkDay, 2);
  assert.equal(resolveAction(s, "work").ok, false);
});

test("personal recurring plans use an advancing cursor, stop safely, and cannot farm same-day benefits", () => {
  let s = fixture(),
    p = draft(s, {
      kind: "personal",
      npcId: "",
      subjectId: "practice",
      day: 2,
      minute: 1080,
      venue: "kadikoy-park",
      repeat: "weekly",
    });
  s = step(s, "calendar:propose", p);
  assert.equal(s.calendar.recurrences.length, 1);
  const duplicate = resolveAction(s, "calendar:propose", { ...p, minute: 1200, repeat: "none" });
  assert.equal(duplicate.ok, false);
  const e = entry(s);
  s = step(s, "visit:kadikoy-park");
  s = wait(s, e.start - 30);
  s = step(s, `calendar:attend:${e.id}`);
  assert.equal(s.calendar.entries.filter((x) => x.recurrenceId).length, 2);
  const cursor = s.calendar.recurrences[0].nextStart;
  const again = step(s, "wait:15");
  assert.equal(again.calendar.recurrences[0].nextStart, cursor);
  s = step(again, `calendar:repeat-stop:${again.calendar.recurrences[0].id}`);
  assert.equal(s.calendar.recurrences.filter((r) => r.enabled).length, 0);
});

test("city connections differ in real route cost/time and visit honors venue closure", () => {
  let s = fixture();
  const a = getRoute(s, "kadikoy", "sisli"),
    b = getRoute(s, "kadikoy", "besiktas");
  assert.ok(a.minutes > b.minutes);
  assert.ok(a.cost > b.cost);
  const before = s.cash,
    time = s.time;
  s = step(s, "travel:sisli");
  assert.equal(s.cash, before - a.cost);
  assert.equal(s.time, time + a.minutes);
  assert.equal(s.location, "sisli");
  assert.equal(s.city.venue, "");
  const view = getCityView(s);
  assert.equal(view.districts.length, 3);
  assert.equal(view.venues.length, 12);
  assert.ok(view.routes.every((r) => r.minutes > 0));
  s = wait(s, 1380);
  const closed = getActions(s).find((a) => a.id === "visit:sisli-cafe");
  assert.equal(closed.disabled, true);
  assert.match(closed.reason, /kapalı|tamamlanamaz/);
});

test("fast-forward stops before appointment departure and before unresolved consequences", () => {
  let s = fixture(),
    p = freeDraft(s);
  s = step(s, "calendar:propose", p);
  const e = entry(s),
    r = resolveAction(s, "calendar:next");
  if (r.ok) {
    s = r.state;
    assert.ok(s.time <= e.start - 30);
    assert.equal(entry(s).status, "confirmed");
  }
  const start = createGame(),
    blocked = resolveAction(start, "calendar:next");
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.state, start);
});

test("intent composer only returns authoritative descriptors and malformed proposals cannot spend or advance", () => {
  const s = fixture(),
    all = new Set(getActions(s).map((a) => a.id));
  assert.ok(getIntentActions(s, { category: "travel", query: "Şişli" }).length);
  assert.ok(getIntentActions(s, { query: "hayaliuzaygemisi" }).length === 0);
  for (const a of getIntentActions(s, { npcId: "leyla" })) assert.ok(all.has(a.id));
  for (const p of [
    null,
    { ...draft(s), day: 0 },
    { ...draft(s), minute: 12 },
    { ...draft(s), money: 1000000 },
    { ...draft(s), venue: "moon" },
  ]) {
    const r = resolveAction(s, "calendar:propose", p);
    assert.equal(r.ok, false);
    assert.deepEqual(r.state, s);
  }
  const view = getCalendarView(s);
  assert.equal(view.days.length, 15);
  assert.ok(view.days.every((d) => d.dateLabel && d.weekday));
});

test("an unavailable reschedule keeps the original booking until a counteroffer is accepted", () => {
  let s = fixture();
  const p = freeDraft(s);
  s = step(s, "calendar:propose", p);
  const old = entry(s);
  let proposed;
  for (let day = p.day + 1; day < p.day + 7 && !proposed; day++) {
    const q = { ...p, day },
      slot = getAppointmentOptions(s, { ...q, ignoreId: old.id }).slots.find(
        (x) => x.available && x.counterExpected,
      );
    if (slot) proposed = { ...q, minute: slot.minute };
  }
  assert.ok(proposed);
  s = step(s, `calendar:reschedule:${old.id}`, proposed);
  const counter = entry(s);
  assert.equal(counter.status, "counter");
  assert.equal(s.calendar.entries.find((e) => e.id === old.id).status, "confirmed");
  const declined = step(s, `calendar:decline:${counter.id}`);
  assert.equal(declined.calendar.entries.find((e) => e.id === old.id).status, "confirmed");
  const accepted = step(s, `calendar:accept:${counter.id}`);
  assert.equal(accepted.calendar.entries.find((e) => e.id === old.id).status, "cancelled");
  assert.equal(accepted.calendar.entries.find((e) => e.id === counter.id).status, "confirmed");
});

test("chosen interview and class slots execute actual employment and education, not decorative attendance", () => {
  let s = fixture();
  const p = draft(s, {
    kind: "interview",
    npcId: "",
    subjectId: "retail",
    day: 2,
    minute: 540,
    venue: "kadikoy-work",
    duration: 60,
  });
  const invalid = resolveAction(s, "calendar:propose", {
    ...p,
    subjectId: "developer",
    venue: "sisli-work",
  });
  assert.equal(invalid.ok, false, "qualification is checked before booking");
  s = step(s, "calendar:propose", p);
  let e = entry(s);
  assert.equal(e.end - e.start, 30);
  s = step(s, `visit:${e.venue}`);
  s = wait(s, e.start - 30);
  const rng = s.rng;
  s = step(s, `calendar:attend:${e.id}`);
  assert.equal(s.job.id, "retail");
  assert.equal(s.rng, rng);
  let c = fixture();
  const course = COURSES.find((x) => x.district === "kadikoy");
  c = step(c, `enroll:${course.id}`);
  c = step(
    c,
    "calendar:propose",
    draft(c, {
      kind: "class",
      npcId: "",
      subjectId: course.id,
      day: 2,
      minute: 600,
      venue: "kadikoy-academy",
      duration: 30,
    }),
  );
  e = entry(c);
  assert.equal(e.end - e.start, course.minutes);
  c = step(c, `visit:${e.venue}`);
  c = wait(c, e.start - 30);
  const skill = c.player.skills[course.skill];
  c = step(c, `calendar:attend:${e.id}`);
  assert.ok(c.player.skills[course.skill] > skill);
  assert.equal(c.course.sessions, 1);
  assert.equal(entry(c).status, "completed");
});

test("future transfer buffers use departure congestion in both booking orders and ordinary action forecasts", () => {
  // Reach this state through ordinary public actions: booking occurs off-peak,
  // but the proposed transfer occurs during the known evening rush period.
  let s = createGame({ scenario: "restart", seed: 77 });
  const drain = (state) => {
    while (state.pendingEvents.length) {
      const choices = getActions(state).filter((a) => a.category === "event" && !a.disabled);
      state = step(state, (choices.find((a) => a.cost === 0) || choices[0]).id);
    }
    return state;
  };
  s = drain(s);
  s = drain(step(s, "travel:besiktas"));
  s = drain(step(s, "enroll:communication"));
  assert.ok(s.time % 1440 >= 600 && s.time % 1440 < 1020);
  const day = Math.floor(s.time / 1440) + 2;
  const first = draft(s, {
    kind: "personal",
    npcId: "",
    subjectId: "rest",
    day,
    minute: 960,
    venue: "kadikoy-park",
  });
  const second = draft(s, {
    kind: "class",
    npcId: "",
    subjectId: "communication",
    day,
    minute: 1080,
    venue: "besiktas-academy",
    duration: 120,
  });
  const actualGap =
    getRoute(s, "kadikoy", "besiktas", "transit", (day - 1) * 1440 + 1020).minutes + 10;
  assert.equal(actualGap, 75);
  for (const [earlier, later] of [
    [first, second],
    [second, first],
  ]) {
    const reserved = step(s, "calendar:propose", earlier),
      before = structuredClone(reserved);
    const rejected = resolveAction(reserved, "calendar:propose", later);
    assert.equal(rejected.ok, false);
    assert.match(rejected.message, /ulaşım/);
    assert.deepEqual(rejected.state, before);
  }
  const reserved = step(s, "calendar:propose", first);
  const enough = step(reserved, "calendar:propose", { ...second, minute: 1095 });
  assert.equal(enough.calendar.entries.at(-1).start, (day - 1) * 1440 + 1095);
  // The same departure-time rule applies to an action ending in rush hour.
  let today = step(s, "calendar:propose", { ...second, day: day - 1, minute: 1095 });
  today = step(today, "travel:kadikoy");
  today = wait(today, 945); // 15:45: a ninety-minute action ends during rush hour.
  const practice = getActions(today).find((a) => a.id === "practice:knowledge");
  assert.ok(today.time < 1020 && today.time + practice.minutes >= 1020);
  assert.equal(practice.disabled, true);
  assert.match(practice.reason, /ulaşım/);
});

test("a thirty-minute reservation cannot be attended at its end for a one-minute reward", () => {
  let s = fixture();
  s = step(
    s,
    "calendar:propose",
    draft(s, {
      kind: "personal",
      npcId: "",
      subjectId: "practice",
      day: 1,
      minute: 600,
      venue: "kadikoy-park",
      duration: 30,
    }),
  );
  const e = entry(s);
  s = step(s, `visit:${e.venue}`);
  s = wait(s, e.end);
  assert.equal(s.time, e.end);
  assert.equal(entry(s).status, "missed");
  const before = structuredClone(s),
    attempt = resolveAction(s, `calendar:attend:${e.id}`);
  assert.equal(attempt.ok, false);
  assert.deepEqual(attempt.state, before);
  assert.equal(attempt.state.calendar.stats.completed, 0);
  assert.equal(attempt.state.calendar.stats.missed, 1);
});

test("early arrival cannot execute a new job or course through an old reservation", () => {
  let student = step(step(fixture(), "travel:besiktas"), "enroll:communication");
  student = step(
    student,
    "calendar:propose",
    draft(student, {
      kind: "class",
      npcId: "",
      subjectId: "communication",
      day: 2,
      minute: 600,
      venue: "besiktas-academy",
      duration: 120,
    }),
  );
  const lesson = entry(student);
  student = step(step(student, "leave-course"), "enroll:teaching");
  student = step(student, `visit:${lesson.venue}`);
  student = wait(student, lesson.start - 30);
  assert.equal(
    getActions(student).find((a) => a.id === "study").disabled,
    true,
    "ordinary course action is held by reservation conflict",
  );
  const beforeStudent = structuredClone(student),
    wrongLesson = resolveAction(student, `calendar:attend:${lesson.id}`);
  assert.equal(wrongLesson.ok, false);
  assert.match(wrongLesson.message, /değişti/);
  assert.deepEqual(wrongLesson.state, beforeStudent);

  // A narrowly qualified fixture isolates same-district employment switching;
  // both employment contracts themselves are created by ordinary applications.
  let worker = fixture();
  worker.player.skills.craft = 30;
  worker.inventory.tools = 1;
  worker = step(worker, "apply:retail");
  worker = step(
    worker,
    "calendar:propose",
    draft(worker, {
      kind: "shift",
      npcId: "",
      subjectId: "retail",
      day: 2,
      minute: 540,
      venue: "kadikoy-work",
      duration: 420,
    }),
  );
  const shift = entry(worker);
  worker = step(worker, "apply:repair");
  worker = step(worker, `visit:${shift.venue}`);
  worker = wait(worker, shift.start - 30);
  assert.equal(
    getActions(worker).find((a) => a.id === "work").disabled,
    true,
    "ordinary shift is held by reservation conflict",
  );
  const beforeWorker = structuredClone(worker),
    wrongShift = resolveAction(worker, `calendar:attend:${shift.id}`);
  assert.equal(wrongShift.ok, false);
  assert.match(wrongShift.message, /değişti/);
  assert.deepEqual(wrongShift.state, beforeWorker);
});
