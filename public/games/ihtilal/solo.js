/** Single-player desk. Fictional basins, not a border map and not a second seat. */

export const SOLO_KEY = "tariklab.ihtilal.solo.v1";
export const SOLO_VERSION = 1;
export const PERIOD_CAP = 6;

import { REGIONS, ROUTES, FIELDS, mix, initializeNetwork, copyNetworkState, neighbours,
  targetFor, seedMoveSignals, resolveNetwork, bounded, routeBetween, basinReady } from './basin-network.js';
export { REGIONS };

export const MOVES = ["tut", "ac", "sustur", "devret"];

const clamp = (n, a, b) => Math.max(a, Math.min(b, Math.round(n)));

export function regionLinks() {
  return ROUTES.map(({ a, b }) => ({ a, b }));
}

export function createSolo(seed = 1) {
  const s = (Number(seed) >>> 0) || 1;
  return initializeNetwork({
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
  });
}

function region(state, id) {
  return state.regions.find((r) => r.id === id) || state.regions[0];
}

function endOf(state) {
  if (state.tension >= 92) return "kirilma";
  if (state.trust <= 8) return "bosluk";
  if (state.period > PERIOD_CAP && state.tension < 48 && state.trust >= 46 && state.intel >= 25 && state.regions.filter(basinReady).length >= 5) return "tutanak";
  if (state.period > PERIOD_CAP) return "yorgun";
  return null;
}

function closePeriod(state) {
  state = copyNetworkState(state);
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
  const drift = resolveNetwork(next);
  for (const key of ['trust','intel','tension']) next[key] = bounded(next[key] + drift[key]);
  next.log[next.log.length - 1].arrivals = next.network.last.length;
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
  const here = region(state, state.selected);
  const costs = {tut:6, ac:4, sustur:0, devret:12};
  const moves = state.capacity > 0 ? MOVES.filter(id => here.capacity >= costs[id]) : [];
  moves.push("kapat"); // Waiting for a shipment costs the unused decisions in this period.
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
    autoClose: next.period !== state.period,
    period: next.period,
    target: id === 'devret' ? targetFor(state) : null,
    regional: next.regions.map(r => ({ id:r.id, delta:Object.fromEntries(FIELDS.map(k => [k,r[k]-region(state,r.id)[k]])) })),
    waves: [...next.network.last, ...next.network.pulses].filter(p => p.id >= state.network.nextId),
  };
}

export function applyMove(state, id) {
  if (!legalMoves(state).includes(id)) return state;
  if (id === "kapat") return closePeriod(state);
  state = copyNetworkState(state);
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
    next.network.doctrine = id === 'sert' ? 'buffer' : 'listen';
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
    here.capacity = bounded(here.capacity - 6);
    here.trust = bounded(here.trust + 3);
    here.tension = bounded(here.tension - 3);
    trust -= 1;
    pending.push(here.strain > 36
      ? { due: state.period + 1, tension: 6, regionId: here.id, strain: 0, tag: "tut-echo" }
      : { due: state.period + 1, trust: 4, tag: "tut-calm" });
  } else if (id === "ac") {
    here.intel = bounded(here.intel + 16);
    here.trust = bounded(here.trust - 5);
    here.tension = bounded(here.tension + 6);
    here.capacity = bounded(here.capacity - 4);
    intel += 10;
    trust -= 4;
    tension += 2;
    pending.push({ due: state.period + 1, tension: 7, intel: 2, tag: "ac-echo" });
  } else if (id === "sustur") {
    here.tension = bounded(here.tension - 14);
    here.intel = bounded(here.intel - 10);
    here.trust = bounded(here.trust + 1);
    here.capacity = bounded(here.capacity + 3);
    tension -= 9;
    intel -= 4;
    trust += 1;
    pending.push({ due: state.period + 2, intel: -6, tag: "sustur-gap" });
  } else if (id === "devret") {
    here.strain = clamp(here.strain + 7, 0, 100);
    here.capacity = bounded(here.capacity - 12);
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
  seedMoveSignals(next, id, targetFor(state));
  const ending = endOf({ ...next, period: next.period });
  if (ending && (next.trust <= 8 || next.tension >= 92)) return { ...next, phase: "end", ending };
  if (next.capacity <= 0) return closePeriod(next);
  return next;
}

export function selectRegion(state, id) {
  if (!state || state.phase === "end" || !REGIONS.some((r) => r.id === id)) return state;
  return { ...state, selected: id, routeTarget: null };
}

export function serializeSolo(state) {
  return JSON.stringify({ key: SOLO_KEY, version: SOLO_VERSION, state });
}

export function chooseRoute(state, id) {
  if (!state || !neighbours(state,state.selected).some(r=>r.other===id)) return state;
  return {...state,routeTarget:id};
}

export function setConnection(state, mode) {
  if (!state || state.phase!=='play' || state.capacity<1 || !['open','buffered'].includes(mode)) return state;
  const target=targetFor(state), route=routeBetween(state.selected,target);
  if (!route || state.network.links.find(l=>l.id===route.id).mode===mode) return state;
  const next=copyNetworkState(state);
  next.network.links.find(l=>l.id===route.id).mode=mode;
  next.capacity--; next.spent++;
  next.log.push({k:'route',id:route.id,mode,period:state.period});
  return next.capacity===0?closePeriod(next):next;
}

export function periodForecast(state) {
  if (!state || state.phase!=='play') return null;
  const next=closePeriod(state);
  return {period:next.period,phase:next.phase,ending:next.ending,trust:next.trust,intel:next.intel,tension:next.tension,
    regions:next.regions,arrivals:next.network.last, pending:next.network.pulses.length};
}

const integer=(n,lo,hi)=>Number.isInteger(n)&&n>=lo&&n<=hi;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const regionId=id=>REGIONS.some(r=>r.id===id);
const validDelta=d=>object(d)&&Object.keys(d).every(k=>FIELDS.includes(k)&&integer(d[k],-30,30));
function validPulse(p,nextId,history=false) {
  return object(p)&&integer(p.id,1,nextId-1)&&regionId(p.from)&&regionId(p.to)&&regionId(p.origin)&&
    routeBetween(p.from,p.to)?.id===p.via&&['open','buffered'].includes(p.mode)&&
    integer(p.due,1,10)&&['tut','ac','sustur','devret','pressure'].includes(p.kind)&&integer(p.hop,1,2)&&
    Array.isArray(p.visited)&&p.visited.length>=2&&p.visited.length<=3&&p.visited.every(regionId)&&
    new Set(p.visited).size===p.visited.length&&p.visited[0]===p.origin&&
    p.visited.at(-2)===p.from&&p.visited.at(-1)===p.to&&validDelta(p.delta)&&
    (!history||(integer(p.arrived,1,7)&&validDelta(p.delivered)));
}
export function deserializeSolo(raw) {
  try {
    if (typeof raw!=='string'||raw.length>180000) return null;
    const data=JSON.parse(raw), s=data.state;
    if(data.key!==SOLO_KEY||data.version!==SOLO_VERSION||!object(s)||s.id!=='ihtilal-solo'||s.version!==SOLO_VERSION) return null;
    if(!integer(s.seed,1,4294967295)||!integer(s.period,1,7)||!integer(s.capacity,0,3)||!integer(s.spent,0,3)||s.capacity+s.spent!==3) return null;
    if(!['trust','intel','tension'].every(k=>integer(s[k],0,100))||!regionId(s.selected)||!['play','break','end'].includes(s.phase)) return null;
    if(s.phase==='end'?!['kirilma','bosluk','tutanak','yorgun'].includes(s.ending):s.ending!==null) return null;
    if((s.phase==='break'&&s.period!==4)||(s.period===7&&s.phase!=='end')) return null;
    if(!Array.isArray(s.regions)||s.regions.length!==REGIONS.length||new Set(s.regions.map(r=>r.id)).size!==REGIONS.length||
      !s.regions.every(r=>object(r)&&regionId(r.id)&&integer(r.strain,0,100)&&integer(r.hold,0,100))) return null;
    if(!Array.isArray(s.pending)||s.pending.length>32||!s.pending.every(p=>object(p)&&integer(p.due,1,10)&&
      ['tut-echo','tut-calm','ac-echo','sustur-gap','devret-return'].includes(p.tag)&&
      (!p.regionId||regionId(p.regionId))&&['trust','intel','tension','strain'].every(k=>p[k]===undefined||integer(p[k],-100,100)))) return null;
    if(!Array.isArray(s.log)||s.log.length>160||!s.log.every(r=>object(r)&&['move','period','break','route'].includes(r.k))) return null;
    if(s.network===undefined) return initializeNetwork(s); // Old solo-v1 saves retain global state, pending echoes and phase.
    const n=s.network;
    if(!object(n)||n.version!==1||!integer(n.nextId,1,10000)||!['balanced','buffer','listen'].includes(n.doctrine)) return null;
    if(!s.regions.every(r=>FIELDS.every(k=>integer(r[k],0,100)))) return null;
    if(!Array.isArray(n.links)||n.links.length!==ROUTES.length||new Set(n.links.map(l=>l.id)).size!==ROUTES.length||
      !n.links.every(l=>object(l)&&ROUTES.some(r=>r.id===l.id)&&['open','buffered'].includes(l.mode))) return null;
    if(!Array.isArray(n.pulses)||n.pulses.length>96||!n.pulses.every(p=>validPulse(p,n.nextId))||new Set(n.pulses.map(p=>p.id)).size!==n.pulses.length) return null;
    if(!['history','last'].every(k=>Array.isArray(n[k])&&n[k].length<=96&&n[k].every(p=>validPulse(p,n.nextId,true)))) return null;
    if(s.routeTarget!==null&&(!regionId(s.routeTarget)||!routeBetween(s.selected,s.routeTarget))) return null;
    return s;
  } catch { return null; }
}
