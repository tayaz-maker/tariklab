/** One coastal network. Thresholds, not borrowed route marks. No real city. */

export const KEY = "tariklab.kiyi-esigi.v1";
export const PERIODS = 6;

export const NODES = [
  { id: "rihtim", kind: "pier", tr: "Rıhtım", en: "Pier", x: 58, y: 214, water: 1, slope: 0, trust: 1 },
  { id: "iskele", kind: "pier", tr: "İskele", en: "Landing", x: 148, y: 186, water: 1, slope: 0, trust: 1 },
  { id: "merdiven", kind: "stair", tr: "Merdiven", en: "Stair", x: 148, y: 112, water: 0, slope: 2, trust: 2 },
  { id: "rampa", kind: "ramp", tr: "Rampa", en: "Ramp", x: 228, y: 138, water: 0, slope: 1, trust: 3 },
  { id: "tunel", kind: "tunnel", tr: "Tünel ağzı", en: "Tunnel mouth", x: 274, y: 72, water: 0, slope: 1, trust: 1 },
  { id: "kopru", kind: "bridge", tr: "Köprü eklemi", en: "Bridge joint", x: 64, y: 96, water: 1, slope: 1, trust: 0 },
  { id: "yokus", kind: "slope", tr: "Yokuş", en: "Slope", x: 186, y: 46, water: 0, slope: 2, trust: 1 },
];

export const LINKS = [
  ["rihtim", "iskele"],
  ["iskele", "merdiven"],
  ["iskele", "kopru"],
  ["merdiven", "rampa"],
  ["merdiven", "yokus"],
  ["rampa", "tunel"],
  ["kopru", "yokus"],
  ["tunel", "yokus"],
];

const clamp = (n, a, b) => Math.max(a, Math.min(b, Math.round(n)));
export const nodeById = (id) => NODES.find((n) => n.id === id);

export function neighbors(id) {
  return LINKS.filter((edge) => edge.includes(id)).map((edge) => (edge[0] === id ? edge[1] : edge[0]));
}

export function costOf(id) {
  const n = nodeById(id);
  return 1 + n.slope + n.water;
}

export function createCoast(seed = 1) {
  return {
    id: "kiyi-esigi",
    version: 1,
    seed: (Number(seed) >>> 0) || 1,
    period: 1,
    resource: 9,
    trust: 46,
    access: 0,
    risk: 12,
    built: 0,
    line: [],
    ramps: [],
    pending: [],
    fault: null,
    phase: "play",
    ending: null,
    log: [],
  };
}

export function faultOf(state) {
  for (const id of state.line) {
    const n = nodeById(id);
    if ((n.kind === "stair" || n.kind === "slope") && !state.ramps.includes(id)) {
      return { id, reason: n.kind };
    }
  }
  return null;
}

function candidates(state) {
  if (!state.line.length) return NODES.slice();
  return NODES.filter((n) => !state.line.includes(n.id) && state.line.some((id) => neighbors(id).includes(n.id)));
}

export function legal(state) {
  if (!state || state.phase === "end") return [];
  const moves = ["bekle"];
  for (const n of candidates(state)) {
    if (state.resource >= costOf(n.id)) moves.push(`bagla:${n.id}`);
  }
  for (const id of state.line) {
    const n = nodeById(id);
    if ((n.kind === "stair" || n.kind === "slope") && !state.ramps.includes(id) && state.resource >= 2) {
      moves.push(`rampa:${id}`);
    }
  }
  if (state.built > 0) moves.push("kapat");
  return moves;
}

function endOf(state) {
  if (state.risk >= 90 || (state.fault && state.risk >= 80)) return "kopuk";
  if (state.period > PERIODS && state.line.length === NODES.length && !faultOf(state) && state.trust >= 40) return "surekli";
  if (state.period > PERIODS && state.line.length >= 4 && !faultOf(state) && state.trust >= 55 && state.risk <= 70) return "mahalle";
  if (state.period > PERIODS || (state.resource <= 0 && !legal({ ...state, phase: "play" }).some((m) => m.startsWith("bagla") || m.startsWith("rampa")))) {
    return state.period > PERIODS || state.resource <= 0 ? "yorgun" : null;
  }
  return null;
}

function close(state) {
  let { resource, trust, risk, access } = state;
  for (const item of state.pending) {
    resource += item.resource || 0;
    trust += item.trust || 0;
    risk += item.risk || 0;
    access += item.access || 0;
  }
  if (faultOf(state)) risk += 28;
  else resource += Math.min(3, 1 + state.line.length);
  const next = {
    ...state,
    period: state.period + 1,
    built: 0,
    resource: clamp(resource, 0, 24),
    trust: clamp(trust, 0, 100),
    risk: clamp(risk, 0, 100),
    access,
    pending: [],
    fault: faultOf(state),
    log: state.log.concat({ k: "period", n: state.period }),
  };
  const ending = endOf(next);
  return ending ? { ...next, phase: "end", ending } : next;
}

export function apply(state, move) {
  if (!legal(state).includes(move)) return state;
  if (move === "bekle") {
    const unmet = NODES.length - state.line.length;
    return close({
      ...state,
      trust: clamp(state.trust - Math.min(8, unmet), 0, 100),
      resource: clamp(state.resource + 2, 0, 24),
      log: state.log.concat({ k: "bekle" }),
    });
  }
  if (move === "kapat") return close(state);
  if (move.startsWith("rampa:")) {
    const id = move.slice(6);
    const next = {
      ...state,
      ramps: state.ramps.concat(id),
      resource: state.resource - 2,
      trust: clamp(state.trust + 7, 0, 100),
      built: state.built + 1,
      pending: state.pending.concat({ access: 1, tag: "ramp" }),
      log: state.log.concat({ k: "rampa", id }),
    };
    next.fault = faultOf(next);
    return next;
  }
  const id = move.slice(6);
  const n = nodeById(id);
  const rushed = state.built >= 2;
  const next = {
    ...state,
    line: state.line.concat(id),
    resource: state.resource - costOf(id),
    access: state.access + (n.kind === "stair" || n.kind === "slope" ? 0 : 1),
    trust: clamp(state.trust + (n.water ? -2 : 2) + (n.trust || 0), 0, 100),
    risk: clamp(state.risk + n.water * 4 + n.slope * 3 + (rushed ? 8 : 0), 0, 100),
    built: state.built + 1,
    pending: rushed ? state.pending.concat({ risk: 5, tag: "rush" }) : state.pending,
    log: state.log.concat({ k: "bagla", id }),
  };
  next.fault = faultOf(next);
  if (next.risk >= 90) return { ...next, phase: "end", ending: "kopuk" };
  return next;
}

export function preview(state, move) {
  if (!legal(state).includes(move)) return { ok: false };
  const next = apply(state, move);
  return {
    ok: true,
    resource: next.resource - state.resource,
    trust: next.trust - state.trust,
    risk: next.risk - state.risk,
    access: next.access - state.access,
    fault: next.fault?.reason || null,
  };
}

export function serialize(state) {
  return JSON.stringify({ key: KEY, version: 1, state });
}

export function deserialize(raw) {
  try {
    const data = JSON.parse(raw);
    if (data.key !== KEY || data.version !== 1 || !Array.isArray(data.state?.line)) return null;
    return data.state;
  } catch {
    return null;
  }
}
