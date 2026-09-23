// Son 100 Gün — single-seat point-of-view engine. Pure functions, no DOM.
// One decision per period; outcomes are seeded so previews state honest odds
// and saves replay the recorded choices.
import { CARDS, SCENARIOS } from "./pov-data.js";

export const VERSION = 1;
/** New namespace: the earlier next-wave saves (tariklab.nextwave.son-100-gun.*) are never read or written. */
export const SAVE_PREFIX = "tariklab.son100.pov.v1";
export const SLOT_COUNT = 3;
/** First day of each decision period. The last period closes on LAST_DAY. */
export const CALENDAR = [1, 8, 15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 91, 96];
export const LAST_DAY = 100;
export const RHYTHM_TURN = 2;
export const BREAK_TURN = 8;
export const HAND = 3;
export const PEOPLE = ["kin", "friend", "young"];
export const STATS = ["body", "money", "peace", "mark"];
/** An axis must reach this to earn its ending. */
export const ENDING_BAR = 65;

const byId = new Map(CARDS.map((c) => [c.id, c]));
export const card = (id) => byId.get(id);
export const scenario = (id) => SCENARIOS.find((s) => s.id === id);

export function phaseOf(day) {
  if (day <= 14) return "start";
  if (day <= 50) return "routine";
  if (day <= 78) return "break";
  return "end";
}

/** Days still ahead, counting today. */
export const daysLeft = (s) => Math.max(0, LAST_DAY - s.day + 1);
export const periodEnd = (turn) => CALENDAR[turn + 1] ?? LAST_DAY;

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
export const roll = (seed, turn, key) => hash(`${seed}|${turn}|${key}`) / 4294967296;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hasFlag = (s, f) => s.flags.includes(f);
function addFlag(s, f) {
  if (f && !s.flags.includes(f)) s.flags.push(f);
}

export function createGame(scenarioId, seed = 1) {
  const sc = scenario(scenarioId);
  if (!sc) throw new Error(`unknown scenario ${scenarioId}`);
  const st = sc.start;
  const s = {
    v: VERSION,
    seed: seed >>> 0,
    scenario: sc.id,
    turn: 0,
    day: CALENDAR[0],
    body: st.body,
    money: st.money,
    peace: st.peace,
    mark: st.mark,
    people: { kin: st.kin, friend: st.friend, young: st.young },
    routine: null,
    job: "full",
    flags: [],
    pending: [],
    seen: {},
    shown: {},
    took: [],
    log: [],
    hand: [],
    ending: null,
  };
  s.hand = draw(s);
  return s;
}

export function personBy(s, rule) {
  const order = [...PEOPLE].sort((a, b) =>
    rule === "highest" ? s.people[b] - s.people[a] : s.people[a] - s.people[b],
  );
  return order[0];
}

/** The weakest area decides which breaking point arrives on the break day. */
export function breakKind(s) {
  const avg = PEOPLE.reduce((n, k) => n + s.people[k], 0) / PEOPLE.length;
  const w = [
    ["body", s.body],
    ["money", clamp(s.money * 3, 0, 100)],
    ["people", avg],
    ["meaning", (s.mark + s.peace) / 2],
  ];
  return w.reduce((min, x) => (x[1] < min[1] ? x : min))[0];
}

export function blocked(s, opt) {
  const n = opt.needs;
  if (!n) return null;
  if (n.body != null && s.body < n.body) return "body";
  if (n.flag && !hasFlag(s, n.flag)) return "flag";
  if (n.noflag && hasFlag(s, n.noflag)) return "noflag";
  return null;
}

function available(s, c) {
  if (c.scen && !c.scen.includes(s.scenario)) return false;
  const last = s.seen[c.id];
  if (c.once && last != null) return false;
  if (c.cd && last != null && s.turn - last < c.cd) return false;
  if (c.when && !c.when(s)) return false;
  return c.options.some((o) => !blocked(s, o));
}

function entry(s, c) {
  return c.target ? { id: c.id, target: personBy(s, c.target) } : { id: c.id };
}

export function draw(s) {
  if (s.turn === RHYTHM_TURN) return [entry(s, card("rhythm"))];
  if (s.turn === BREAK_TURN) {
    const kind = breakKind(s);
    return [
      entry(
        s,
        CARDS.find((c) => c.breakKind === kind),
      ),
    ];
  }
  const phase = phaseOf(s.day);
  const pool = CARDS.filter((c) => !c.forced && c.phases.includes(phase) && available(s, c));
  const key = (c) => {
    if (c.urgent && c.urgent(s)) return -2;
    if (c.core) return -1;
    // A card passed over last period steps back so the hand keeps moving.
    const stale = s.shown[c.id] === s.turn - 1 ? 0.45 : 0;
    return roll(s.seed, s.turn, c.id) + stale;
  };
  return pool
    .map((c) => [key(c), c])
    .sort((a, b) => a[0] - b[0])
    .slice(0, HAND)
    .map(([, c]) => entry(s, c));
}

/** Expand authored effects into concrete stat keys. */
export function resolveFx(fx = {}, target) {
  const out = {};
  const add = (k, v) => {
    if (v) out[k] = (out[k] || 0) + v;
  };
  for (const [k, v] of Object.entries(fx)) {
    if (k === "people") for (const p of PEOPLE) add(p, v);
    else if (k === "target") add(target, v);
    else add(k, v);
  }
  return out;
}

function apply(s, fx) {
  for (const [k, v] of Object.entries(fx)) {
    if (PEOPLE.includes(k)) s.people[k] = clamp(s.people[k] + v, 0, 100);
    else if (k === "money") s.money = clamp(s.money + v, -40, 200);
    else s[k] = clamp(s[k] + v, 0, 100);
  }
}

function snapshot(s) {
  return { body: s.body, money: s.money, peace: s.peace, mark: s.mark, ...s.people };
}
function diff(a, b) {
  const out = {};
  for (const k of Object.keys(a)) if (b[k] !== a[k]) out[k] = b[k] - a[k];
  return out;
}

const JOB_PAY = { full: 1, part: 0.55, quit: 0 };

/** What closing the current period would do, given the state as it stands. */
export function upkeep(s) {
  const from = s.day;
  const to = periodEnd(s.turn);
  const span = to - from;
  let decay = 0;
  for (let d = from; d < to; d += 1) decay += 0.22 + 0.0045 * d;
  let mult = 1;
  if (s.routine === "body") mult *= 0.7;
  if (s.routine === "work") mult *= 1.1;
  if (s.job === "full") mult *= 1.1;
  if (s.job === "quit") mult *= 0.95;
  if (hasFlag(s, "responding")) mult *= 0.8;
  const sc = scenario(s.scenario);
  const income = sc.wage * JOB_PAY[s.job] * (s.routine === "work" ? 1.3 : 1) * span;
  const fx = { body: -Math.round(decay * mult), money: Math.round(income - sc.burn * span) };
  const add = (more) => {
    for (const [k, v] of Object.entries(more)) fx[k] = (fx[k] || 0) + v;
  };
  if (s.routine === "body") add({ peace: 1, money: -1 });
  if (s.routine === "work") add({ mark: 1 });
  if (s.routine === "table") add({ kin: 3, friend: 3, young: 3, money: -1 });
  if (s.routine === "desk") add({ mark: 2, peace: 1, kin: -1 });
  if (hasFlag(s, "comfort")) add({ peace: 1 });
  const drift = s.job === "full" ? -2 : -1;
  for (const p of PEOPLE) add({ [p]: drift });
  if (from >= 50) add({ peace: -1 });
  for (const k of Object.keys(fx)) if (!fx[k]) delete fx[k];
  return { from, to, span, fx };
}

/** Everything the player should know before committing an option. */
export function preview(s, cardId, optionId) {
  const h = s.hand.find((x) => x.id === cardId);
  const c = card(cardId);
  const o = c?.options.find((x) => x.id === optionId);
  if (!h || !o) return null;
  const target = h.target;
  const after = structuredClone(s);
  apply(after, resolveFx(o.fx, target));
  if (o.routine) after.routine = o.routine;
  if (o.job) after.job = o.job;
  if (o.flag) addFlag(after, o.flag);
  return {
    reason: blocked(s, o),
    now: resolveFx(o.fx, target),
    risk: o.risk
      ? {
          p: o.risk.p,
          win: resolveFx(o.risk.win, target),
          lose: resolveFx(o.risk.lose, target),
          flag: o.risk.flag || null,
        }
      : null,
    later: (o.later || []).map((l) => ({
      in: l.in,
      day: CALENDAR[s.turn + l.in] ?? LAST_DAY,
      fx: resolveFx(l.fx, target),
      text: l.text,
    })),
    lapses: s.hand
      .filter((x) => x.id !== cardId && card(x.id).lapse)
      .map((x) => ({ id: x.id, target: x.target, fx: resolveFx(card(x.id).lapse.fx, x.target) })),
    close: upkeep(after),
    flag: o.flag || null,
    routine: o.routine || null,
    job: o.job || null,
    irreversible: Boolean(o.irreversible),
    keep: Boolean(o.keep),
  };
}

export function scores(s) {
  const ties = Math.round(PEOPLE.reduce((n, k) => n + s.people[k], 0) / PEOPLE.length);
  return {
    door: ties,
    mark: Math.round(s.mark),
    still: Math.round(s.peace * 0.75 + s.body * 0.25),
  };
}

export function endingFor(s) {
  const sc = scores(s);
  let best = "unfinished";
  let top = ENDING_BAR - 1;
  for (const k of ["door", "mark", "still"])
    if (sc[k] > top) {
      best = k;
      top = sc[k];
    }
  return best;
}

function finish(s, early) {
  // Consequences still in flight arrive before the last day.
  const late = s.pending.splice(0);
  for (const p of late) apply(s, p.fx);
  s.ending = {
    id: endingFor(s),
    early,
    day: s.day,
    scores: scores(s),
    arrived: late.map((p) => ({ text: p.text, fx: p.fx, from: p.from })),
  };
  s.hand = [];
}

function closePeriod(s) {
  const before = snapshot(s);
  const u = upkeep(s);
  apply(s, u.fx);
  if (s.money < 0) {
    apply(s, { peace: -2 });
    addFlag(s, "debt");
  }
  s.day = u.to;
  s.turn += 1;
  const matured = s.pending.filter((p) => p.due <= s.turn);
  s.pending = s.pending.filter((p) => p.due > s.turn);
  for (const p of matured) apply(s, p.fx);
  const closeFx = diff(before, snapshot(s));
  if (s.body <= 0) finish(s, true);
  else if (s.turn >= CALENDAR.length) finish(s, false);
  else s.hand = draw(s);
  return {
    span: u.span,
    fx: closeFx,
    matured: matured.map((p) => ({ text: p.text, fx: p.fx, from: p.from })),
  };
}

/** Commit one decision and close the period. Returns the log entry or null. */
export function choose(s, cardId, optionId) {
  if (s.ending) return null;
  const h = s.hand.find((x) => x.id === cardId);
  const c = card(cardId);
  const o = c?.options.find((x) => x.id === optionId);
  if (!h || !o || blocked(s, o)) return null;
  const { turn, day } = s;
  const target = h.target;
  const before = snapshot(s);
  apply(s, resolveFx(o.fx, target));
  let outcome = null;
  if (o.risk) {
    outcome = roll(s.seed, turn, `${cardId}:${optionId}`) < o.risk.p ? "win" : "lose";
    apply(s, resolveFx(o.risk[outcome], target));
    if (outcome === "win") addFlag(s, o.risk.flag);
  }
  for (const l of o.later || [])
    s.pending.push({
      due: turn + l.in,
      fx: resolveFx(l.fx, target),
      text: l.text,
      from: cardId,
      target,
    });
  addFlag(s, o.flag);
  if (o.routine) s.routine = o.routine;
  if (o.job) {
    s.job = o.job;
    if (o.job === "quit") addFlag(s, "quit");
  }
  if (!o.keep) s.seen[cardId] = turn;
  const choiceFx = diff(before, snapshot(s));
  const lapsed = [];
  for (const x of s.hand) {
    s.shown[x.id] = turn;
    const lc = card(x.id);
    if (x.id !== cardId && lc.lapse) {
      const fx = resolveFx(lc.lapse.fx, x.target);
      apply(s, fx);
      lapsed.push({ id: x.id, target: x.target, fx });
    }
  }
  s.took.push([cardId, optionId]);
  const close = closePeriod(s);
  const log = {
    turn,
    day,
    card: cardId,
    option: optionId,
    target,
    outcome,
    choiceFx,
    lapsed,
    close,
  };
  s.log.push(log);
  return log;
}

export function serialize(s) {
  return JSON.stringify({ v: VERSION, scenario: s.scenario, seed: s.seed, took: s.took });
}

/** Rebuild a game by replaying its recorded choices. Stops at the first invalid step. */
export function restore(raw) {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || data.v !== VERSION || !scenario(data.scenario) || !Array.isArray(data.took))
    return null;
  const seed = Number.isInteger(data.seed) && data.seed >= 0 ? data.seed : 1;
  const s = createGame(data.scenario, seed);
  for (const step of data.took) {
    if (!Array.isArray(step) || !choose(s, String(step[0]), String(step[1]))) break;
  }
  return s;
}
