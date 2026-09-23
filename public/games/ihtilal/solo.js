/** Single-player desk. Fictional basins, not a border map and not a second seat. */

export const SOLO_KEY = "tariklab.ihtilal.solo.v1";
export const SOLO_VERSION = 1;
export const PERIOD_CAP = 6;

export const REGIONS = [
  { id: "kuzey", tr: "Kuzey kıyı", en: "North shore", x: 70, y: 48 },
  { id: "bati", tr: "Batı eşik", en: "West threshold", x: 48, y: 150 },
  { id: "ic", tr: "İç ova", en: "Inner plain", x: 150, y: 78 },
  { id: "merkez", tr: "Merkez halka", en: "Center ring", x: 156, y: 168 },
  { id: "dogu", tr: "Doğu hat", en: "East line", x: 250, y: 96 },
  { id: "yayla", tr: "Yüksek yayla", en: "High plateau", x: 248, y: 196 },
  { id: "guney", tr: "Güney kapı", en: "South gate", x: 150, y: 262 },
];

const LINKS = [
  ["kuzey", "ic"], ["kuzey", "bati"], ["bati", "merkez"], ["ic", "merkez"],
  ["ic", "dogu"], ["merkez", "yayla"], ["merkez", "guney"], ["dogu", "yayla"], ["yayla", "guney"],
];

export const MOVES = ["tut", "ac", "sustur", "devret"];

const clamp = (n, a, b) => Math.max(a, Math.min(b, Math.round(n)));

function mix(seed, text) {
  let h = seed >>> 0;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export function regionLinks() {
  return LINKS.map(([a, b]) => ({ a, b }));
}

export function createSolo(seed = 1) {
  const s = (Number(seed) >>> 0) || 1;
  return {
    id: "ihtilal-solo",
    version: SOLO_VERSION,
    seed: s,
    period: 1,
    capacity: 3,
    spent: 0,
    trust: 52,
    intel: 34,
    tension: 22,
    selected: "merkez",
    regions: REGIONS.map((r) => ({
      id: r.id,
      strain: 22 + (mix(s, r.id) % 24),
      hold: 36 + (mix(s, `${r.id}.h`) % 20),
    })),
    pending: [],
    log: [],
    phase: "play",
    ending: null,
  };
}

function region(state, id) {
  return state.regions.find((r) => r.id === id) || state.regions[0];
}

function endOf(state) {
  if (state.tension >= 92) return "kirilma";
  if (state.trust <= 8) return "bosluk";
  if (state.period > PERIOD_CAP && state.tension < 48 && state.trust >= 46) return "tutanak";
  if (state.period > PERIOD_CAP) return "yorgun";
  return null;
}

function closePeriod(state) {
  const due = state.pending.filter((p) => p.due <= state.period);
  const later = state.pending.filter((p) => p.due > state.period);
  let { trust, intel, tension } = state;
  const regions = state.regions.map((r) => ({ ...r }));
  for (const p of due) {
    trust += p.trust || 0;
    intel += p.intel || 0;
    tension += p.tension || 0;
    if (p.regionId && p.strain) {
      const hit = regions.find((r) => r.id === p.regionId);
      if (hit) hit.strain = clamp(hit.strain + p.strain, 0, 100);
    }
  }
  const next = {
    ...state,
    period: state.period + 1,
    capacity: 3,
    spent: 0,
    trust: clamp(trust, 0, 100),
    intel: clamp(intel, 0, 100),
    tension: clamp(tension, 0, 100),
    regions,
    pending: later,
    phase: "play",
    log: state.log.concat({ k: "period", from: state.period, echoes: due.length }),
  };
  if (next.period === 4) next.phase = "break";
  const ending = endOf(next);
  if (ending) {
    next.phase = "end";
    next.ending = ending;
  }
  return next;
}

export function legalMoves(state) {
  if (!state || state.phase === "end") return [];
  if (state.phase === "break") return ["sert", "acik"];
  const moves = state.capacity > 0 ? MOVES.slice() : [];
  if (state.spent > 0) moves.push("kapat");
  return moves;
}

export function previewMove(state, id) {
  if (!legalMoves(state).includes(id)) return { ok: false };
  const next = applyMove(state, id);
  return {
    ok: true,
    trust: next.trust - state.trust,
    intel: next.intel - state.intel,
    tension: next.tension - state.tension,
    strain: (region(next, state.selected).strain - region(state, state.selected).strain),
    delayed: id === "kapat" || id === "sert" || id === "acik" ? 0 : 1,
    ending: next.ending,
  };
}

export function applyMove(state, id) {
  if (!legalMoves(state).includes(id)) return state;
  if (id === "kapat") return closePeriod(state);
  if (id === "sert" || id === "acik") {
    const trust = state.trust + (id === "sert" ? -8 : 6);
    const tension = state.tension + (id === "sert" ? -10 : 8);
    const intel = state.intel + (id === "acik" ? 6 : -4);
    const next = {
      ...state,
      trust: clamp(trust, 0, 100),
      tension: clamp(tension, 0, 100),
      intel: clamp(intel, 0, 100),
      phase: "play",
      log: state.log.concat({ k: "break", id }),
    };
    const ending = endOf(next);
    if (ending) return { ...next, phase: "end", ending };
    return next;
  }
  const selected = region(state, state.selected);
  let { trust, intel, tension } = state;
  const regions = state.regions.map((r) => ({ ...r }));
  const here = regions.find((r) => r.id === selected.id);
  const pending = state.pending.slice();
  if (id === "tut") {
    here.strain = clamp(here.strain - 12, 0, 100);
    here.hold = clamp(here.hold + 8, 0, 100);
    trust -= 1;
    pending.push(here.strain > 36
      ? { due: state.period + 1, tension: 6, regionId: here.id, strain: 0, tag: "tut-echo" }
      : { due: state.period + 1, trust: 4, tag: "tut-calm" });
  } else if (id === "ac") {
    intel += 10;
    trust -= 4;
    tension += 2;
    pending.push({ due: state.period + 1, tension: 7, intel: 2, tag: "ac-echo" });
  } else if (id === "sustur") {
    tension -= 9;
    intel -= 4;
    trust += 1;
    pending.push({ due: state.period + 2, intel: -6, tag: "sustur-gap" });
  } else if (id === "devret") {
    here.strain = clamp(here.strain + 5, 0, 100);
    const other = regions.filter((r) => r.id !== here.id).sort((a, b) => b.strain - a.strain)[0];
    if (other) other.strain = clamp(other.strain - 8, 0, 100);
    pending.push({ due: state.period + 1, regionId: here.id, strain: -11, tension: 3, tag: "devret-return" });
  }
  const next = {
    ...state,
    trust: clamp(trust, 0, 100),
    intel: clamp(intel, 0, 100),
    tension: clamp(tension, 0, 100),
    regions,
    pending,
    capacity: state.capacity - 1,
    spent: state.spent + 1,
    log: state.log.concat({ k: "move", id, region: selected.id, period: state.period }),
  };
  const ending = endOf({ ...next, period: next.period });
  if (ending && (next.trust <= 8 || next.tension >= 92)) return { ...next, phase: "end", ending };
  if (next.capacity <= 0) return closePeriod(next);
  return next;
}

export function selectRegion(state, id) {
  if (!state || state.phase === "end" || !REGIONS.some((r) => r.id === id)) return state;
  return { ...state, selected: id };
}

export function serializeSolo(state) {
  return JSON.stringify({ key: SOLO_KEY, version: SOLO_VERSION, state });
}

export function deserializeSolo(raw) {
  try {
    const data = JSON.parse(raw);
    if (data.key !== SOLO_KEY || data.version !== SOLO_VERSION || !data.state) return null;
    if (!Array.isArray(data.state.regions) || data.state.regions.length !== REGIONS.length) return null;
    return data.state;
  } catch {
    return null;
  }
}
