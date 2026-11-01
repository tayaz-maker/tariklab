import { NPCS, DISTRICTS } from "./content.mjs";
import { BUSINESS_TYPES, EMPLOYERS } from "./deep-content.mjs";
import { venueById } from "./city.mjs";
import { SECONDARY_PEOPLE } from "./life-content.mjs";
import {
  SOCIETY_COPY as COPY,
  SOCIETY_LIMITS as LIMIT,
  SOCIETY_TOPICS,
} from "./society-content.mjs";
const DAY = 1440,
  MAX = 1e9;
const by = (xs, id) => xs.find((x) => x.id === id);
const clamp = (n, low = 0, high = 100) => {
  const value = Math.max(low, Math.min(high, n));
  return value === 0 ? 0 : value;
};
const day = (s) => Math.floor(s.time / DAY) + 1;
const week = (s) => Math.floor((day(s) - 1) / 7);
const sec = (s, id) => s.life.secondary.find((n) => n.id === id);
const actor = (s, id) => s.deep.npcs[id] || sec(s, id);
const relation = (s, id) => s.npcs[id] || sec(s, id)?.relation;
const name = (id) => by(NPCS, id)?.name || by(SECONDARY_PEOPLE, id)?.name || "";
const ids = (s) => [...NPCS.map((n) => n.id), ...s.life.secondary.map((n) => n.id)];
const edgeKey = (a, b) => `${a}>${b}`;
const edge = (s, a, b) => s.living.graph[a]?.[b] || s.society.secondaryEdges[edgeKey(a, b)];
const keys = Object.keys;
const activeOffer = (o) => o.status === "open";
const liveOffer = (s, o) =>
  activeOffer(o) ||
  (o.status === "accepted" &&
    s.calendar.entries.some((e) => e.id === o.calendarId && e.status === "confirmed"));
function invitationFor(s, entryId) {
  const visited = new Set();
  while (entryId && !visited.has(entryId)) {
    visited.add(entryId);
    const offer = s.society.offers.find(
      (o) => o.calendarId === entryId && ["open", "accepted"].includes(o.status),
    );
    if (offer) return offer;
    entryId = s.calendar.entries.find((e) => e.id === entryId)?.replacesId;
  }
  return null;
}
const funds = (s) => s.cash + s.bank;
const visible = (s, id, place, api) =>
  !!api.playerPresent?.(s, place) ||
  (relation(s, id).trust >= 35 && relation(s, id).affinity >= 30);
function type(s, a, b) {
  const x = actor(s, a),
    y = actor(s, b);
  return x.work === y.work
    ? "colleague"
    : x.home === y.home
      ? "neighbor"
      : edge(s, a, b)?.affinity >= 35
        ? "friend"
        : "acquaintance";
}
function meta(s, a, b) {
  const k = edgeKey(a, b);
  if (!s.society.edgeMeta[k] && keys(s.society.edgeMeta).length < LIMIT.edgeMeta)
    s.society.edgeMeta[k] = {
      type: type(s, a, b),
      reciprocity: 0,
      lastReconciledAt: 0,
      history: [],
    };
  return s.society.edgeMeta[k];
}
const clipText = (value) => String(value).slice(0, 300);
function history(m, s, key) {
  m.history.push({ at: s.time, key });
  m.history = m.history.slice(-3);
}
function row(s, typeKey, actors, whyKey, changeKey, source, extra = {}) {
  const x = s.society;
  const r = {
    id: `soc-${x.nextId++}`,
    type: typeKey,
    actors: [...actors],
    titleKey: typeKey,
    whyKey,
    changeKey,
    happenedAt: s.time,
    learnedAt: s.time,
    source,
    relatedNpcIds: [...actors],
    parentId: "",
    ...extra,
  };
  x.feed.push(r);
  x.feed = x.feed.slice(-LIMIT.feed);
  return r;
}
function publicEdge(s, a, b, source) {
  const e = edge(s, a, b),
    m = meta(s, a, b);
  if (!e || !m) return;
  const k = edgeKey(a, b),
    i = s.society.knownEdges.findIndex((x) => x.id === k);
  if (i >= 0) s.society.knownEdges.splice(i, 1);
  s.society.knownEdges.push({
    id: k,
    from: a,
    to: b,
    type: m.type,
    strength: e.affinity,
    trust: e.trust,
    conflict: e.conflict,
    reciprocity: m.reciprocity,
    learnedAt: s.time,
    source,
    history: m.history.map((x) => ({ ...x })),
  });
  s.society.knownEdges = s.society.knownEdges.slice(-LIMIT.knownEdges);
}
function neutralDistrict(s) {
  return {
    settledDay: day(s),
    settledWeek: week(s),
    foodStock: 120,
    materialStock: 80,
    serviceUsed: 0,
    weeklyActivity: { workedMinutes: 0, services: 0, volunteerMinutes: 0, npcContacts: 0 },
    weeklyDelta: {
      demand: 0,
      rentPressure: 0,
      stockPricePct: 100,
      serviceDelay: 0,
      jobOpenings: 2,
    },
    history: [],
  };
}
function syncActors(s) {
  const x = s.society;
  for (const id of ids(s)) {
    x.cooldowns[id] ??= 0;
    x.knowledge[id] ??= [];
    x.retiredBefore[id] ??= {};
    if (!s.npcs[id]) {
      const n = sec(s, id),
        contacts = NPCS.filter((p) => s.deep.npcs[p.id].home === n.home).slice(0, 3);
      for (const p of contacts)
        for (const [a, b] of [
          [id, p.id],
          [p.id, id],
        ]) {
          const k = edgeKey(a, b);
          if (!x.secondaryEdges[k] && keys(x.secondaryEdges).length < LIMIT.secondaryEdges)
            x.secondaryEdges[k] = { affinity: 18, trust: 15, conflict: 0, lastContactAt: s.time };
          meta(s, a, b);
        }
    }
  }
}
export function initSociety(s) {
  s.society = {
    version: 1,
    initializedAt: s.time,
    lastTick: s.time,
    lastDay: day(s),
    lastInitiationDay: day(s),
    nextId: 1,
    offers: [],
    cooldowns: {},
    edgeMeta: {},
    secondaryEdges: {},
    knowledge: {},
    retiredBefore: {},
    transmissions: [],
    sessions: [],
    knownEdges: [],
    feed: [],
    districts: Object.fromEntries(DISTRICTS.map((d) => [d.id, neutralDistrict(s)])),
  };
  syncActors(s);
  for (const a of NPCS) for (const b of NPCS) if (a.id !== b.id) meta(s, a.id, b.id);
  // Existing public snapshots may be imported; private graph changes are never learned by migration.
  for (const a of NPCS)
    for (const [b, e] of Object.entries(s.living.known[a.id].links)) {
      if (s.society.knownEdges.length >= LIMIT.knownEdges) break;
      s.society.knownEdges.push({
        id: edgeKey(a.id, b),
        from: a.id,
        to: b,
        type: "acquaintance",
        strength: e.affinity,
        trust: e.trust,
        conflict: e.conflict,
        reciprocity: 0,
        learnedAt: e.at,
        source: { labelKey: "observed", actorId: a.id, credibility: 100 },
        history: [],
      });
    }
  return s;
}
export function getSocietyDistrictEffects(s, id) {
  return (
    s.society?.districts[id]?.weeklyDelta || {
      demand: 0,
      rentPressure: 0,
      stockPricePct: 100,
      serviceDelay: 0,
      jobOpenings: 2,
    }
  );
}
function trustChange(s, id, value) {
  const r = relation(s, id),
    before = r.trust;
  r.trust = clamp(r.trust + value);
  return Math.round((r.trust - before) * 10) / 10;
}
export function societyLearn(s, receiver, fact, api) {
  if (!s.society || !actor(s, receiver) || !SOCIETY_TOPICS.includes(fact.topic)) return false;
  syncActors(s);
  const list = s.society.knowledge[receiver],
    existing = list.find((f) => f.id === fact.id);
  if (existing && (existing.corrected || !fact.corrected)) return false;
  if (!existing && fact.eventAt <= (s.society.retiredBefore[receiver][fact.originActorId] ?? -1))
    return false;
  let applied = 0;
  if (existing && fact.corrected) {
    applied = trustChange(s, receiver, -existing.appliedTrust);
    list.splice(list.indexOf(existing), 1);
  } else if (
    fact.topic === "reliability" &&
    fact.negative &&
    fact.credibility >= 40 &&
    fact.sourceActorId !== receiver
  )
    applied = trustChange(s, receiver, -Math.min(3, Math.ceil(fact.credibility / 35)));
  const f = {
    id: clipText(fact.id),
    topic: fact.topic,
    value: clipText(fact.value),
    originActorId: fact.originActorId,
    sourceActorId: fact.sourceActorId || fact.originActorId,
    eventAt: fact.eventAt,
    learnedAt: s.time,
    credibility: clamp(Math.floor(fact.credibility), 0, 100),
    privacy: fact.privacy === "shareable" ? "shareable" : "private",
    hops: fact.hops || 0,
    appliedTrust: fact.corrected ? 0 : applied,
    negative: !!fact.negative,
    corrected: !!fact.corrected,
    proof: fact.proof || "",
    disclosed: fact.disclosed !== false,
    disclosedAt: fact.disclosed !== false ? s.time : 0,
  };
  list.push(f);
  while (list.length > LIMIT.facts) {
    const retired = list.shift(),
      marks = s.society.retiredBefore[receiver];
    marks[retired.originActorId] = Math.max(marks[retired.originActorId] ?? -1, retired.eventAt);
    if (retired.appliedTrust < 0) {
      trustChange(s, receiver, -retired.appliedTrust);
      if (retired.disclosed)
        row(
          s,
          "forgotten",
          [receiver],
          "forgottenWhy",
          "forgottenChange",
          { labelKey: "direct", actorId: receiver, credibility: 100 },
          { parentId: retired.id },
        );
    }
  }
  if (f.disclosed)
    row(
      s,
      f.corrected ? "corrected" : "report",
      [receiver],
      f.corrected ? "correctedWhy" : "reportWhy",
      f.corrected ? "correctedChange" : "reportChange",
      {
        labelKey: f.sourceActorId === receiver ? "direct" : "relayed",
        actorId: f.sourceActorId,
        credibility: f.credibility,
      },
      { parentId: f.id, happenedAt: f.eventAt, learnedAt: s.time },
    );
  if (s.npcs[receiver] && f.disclosed && f.privacy === "shareable")
    api?.reveal?.(s, receiver, `society-${f.topic}`, f.value, name(f.sourceActorId));
  return true;
}
function queueFact(s, from, to) {
  const e = edge(s, from, to);
  if (!e || e.trust < 25 || e.conflict >= 35) return;
  const candidates = s.society.knowledge[from]
    .filter((f) => f.privacy === "shareable" && f.hops < 2 && f.learnedAt <= s.time - 15)
    .slice()
    .reverse();
  for (const f of candidates) {
    if (
      s.society.knowledge[to].some((x) => x.id === f.id && (!f.corrected || x.corrected)) ||
      (!s.society.knowledge[to].some((x) => x.id === f.id) &&
        f.eventAt <= (s.society.retiredBefore[to][f.originActorId] ?? -1)) ||
      s.society.transmissions.some((x) => x.to === to && x.fact.id === f.id)
    )
      continue;
    if (s.society.transmissions.length >= LIMIT.transmissions) return;
    const credibility = Math.max(
      0,
      Math.min(f.credibility - 15, Math.floor(f.credibility * (0.55 + e.trust / 250))),
    );
    if (credibility < 25) return;
    const due = s.time + 15,
      minute = due % DAY;
    s.society.transmissions.push({
      id: `msg-${s.society.nextId++}`,
      from,
      to,
      dueAt:
        minute < 540
          ? Math.floor(due / DAY) * DAY + 540
          : minute >= 1260
            ? (Math.floor(due / DAY) + 1) * DAY + 540
            : due,
      contactAt: s.time,
      fact: {
        ...f,
        sourceActorId: from,
        credibility,
        hops: f.hops + 1,
        appliedTrust: 0,
        disclosed: false,
        disclosedAt: 0,
      },
    });
    return;
  }
}
export function societyContact(s, from, to, details, api) {
  if (!s.society || !actor(s, from) || !actor(s, to) || from === to) return;
  syncActors(s);
  for (const [a, b] of [
    [from, to],
    [to, from],
  ]) {
    const e = edge(s, a, b),
      m = meta(s, a, b);
    if (!e || !m) continue;
    if (m.history.at(-1)?.at === s.time && m.history.at(-1)?.key === details.kind) return;
    m.type = type(s, a, b);
    m.reciprocity = clamp(
      m.reciprocity +
        (details.kind === "favor"
          ? a === from
            ? 6
            : -6
          : details.kind === "repay"
            ? a === from
              ? 4
              : -4
            : 1),
      -100,
      100,
    );
    history(m, s, details.kind);
    if (["social", "reconcile"].includes(details.kind)) {
      const request = actor(s, b).request;
      if (request?.kind === "loan")
        societyLearn(
          s,
          a,
          {
            id: `need:${b}:${request.sinceDay}`,
            topic: "finance",
            value: "Geçici destek aradığını kendisi anlattı.",
            originActorId: b,
            sourceActorId: b,
            eventAt: (request.sinceDay - 1) * DAY,
            credibility: 100,
            privacy: "private",
            hops: 0,
            negative: false,
            corrected: false,
            proof: "",
            disclosed: false,
          },
          api,
        );
      queueFact(s, a, b);
    }
  }
  const d = s.society.districts[details.place];
  if (d) d.weeklyActivity.npcContacts = Math.min(1000, d.weeklyActivity.npcContacts + 1);
  if (visible(s, from, details.place, api)) {
    const source = {
      labelKey: api.playerPresent?.(s, details.place) ? "observed" : "direct",
      actorId: from,
      credibility: 100,
    };
    publicEdge(s, from, to, source);
    publicEdge(s, to, from, source);
    if (
      !s.society.feed.some(
        (r) =>
          r.type === "contact" &&
          r.actors[0] === from &&
          Math.floor(r.learnedAt / DAY) === Math.floor(s.time / DAY),
      )
    )
      row(s, "contact", [from, to], "contactWhy", "contactChange", source);
  }
}
export function societyNpcOptions(s, id) {
  if (!s.society || !s.npcs[id]) return [];
  return Object.entries(s.living.graph[id])
    .filter(
      ([other, e]) =>
        e.conflict >= 20 &&
        e.trust >= 10 &&
        s.time - (s.society.edgeMeta[edgeKey(id, other)]?.lastReconciledAt || 0) >= 14 * DAY,
    )
    .slice(0, 1)
    .map(([target]) => ({
      kind: "social",
      target,
      location: actor(s, target).home,
      minutes: 60,
      score: 82,
    }));
}
export function societyNpcOutcome(s, id, p, api) {
  if (!s.society || p.kind !== "social") return false;
  const a = edge(s, id, p.target),
    b = edge(s, p.target, id),
    m = meta(s, id, p.target);
  if (!a || !b || a.conflict < 20 || s.time - m.lastReconciledAt < 14 * DAY) return false;
  m.lastReconciledAt = s.time;
  meta(s, p.target, id).lastReconciledAt = s.time;
  const ok = a.trust >= 25 && b.trust >= 20 && s.living.npcs[id].energy >= 25;
  if (ok) {
    a.conflict = clamp(a.conflict - 10);
    b.conflict = clamp(b.conflict - 7);
    a.trust = clamp(a.trust + 3);
    b.trust = clamp(b.trust + 2);
  } else {
    a.conflict = clamp(a.conflict + 2);
    b.conflict = clamp(b.conflict + 1);
  }
  a.lastContactAt = b.lastContactAt = s.time;
  societyContact(
    s,
    id,
    p.target,
    { kind: "reconcile", start: p.start, end: p.end, place: p.location },
    api,
  );
  if (visible(s, id, p.location, api))
    row(s, "reconcile", [id, p.target], "reconcileWhy", ok ? "reconcileGood" : "reconcileBad", {
      labelKey: "direct",
      actorId: id,
      credibility: 100,
    });
  return true;
}
export function societyNpcWork(s, id, minutes, place) {
  if (!s.society) return;
  const a = s.society.districts[place]?.weeklyActivity;
  if (a) a.workedMinutes = Math.min(100000, a.workedMinutes + minutes);
}
function free(s, id, minutes) {
  const n = actor(s, id),
    m = s.time % DAY;
  if (m < 540 || m + minutes > 1260 || !n) return false;
  if (s.npcs[id])
    return (
      !s.living.npcs[id].plan.some((p) => p.start < s.time + minutes && s.time < p.end) &&
      !s.calendar.entries.some(
        (e) =>
          e.npcId === id &&
          (e.status === "confirmed" ||
            (e.status === "counter" &&
              s.society.offers.some((o) => o.calendarId === e.id && o.status === "open"))) &&
          e.start < s.time + minutes &&
          s.time < e.end,
      )
    );
  const wd = (day(s) - 1) % 7,
    working =
      n.employment === "employed" ? wd < 5 : n.employment === "studying" && [0, 2, 4].includes(wd);
  return (
    !n.move &&
    n.busyUntil <= s.time &&
    !(s.life.household?.memberId === id && s.life.household.memberTaskEnd > s.time) &&
    !(working && m < 1080 && m + minutes > 480)
  );
}
function reserve(s, id, end, place, key) {
  if (s.npcs[id])
    s.living.npcs[id].plan.push({
      id: key,
      kind: "visit",
      start: s.time,
      end,
      location: place,
      from: place,
      to: place,
      target: "",
      cost: 0,
      wage: 0,
      status: "planned",
    });
  else sec(s, id).busyUntil = end;
}
function offered(s, api) {
  const x = s.society;
  if (
    x.lastInitiationDay === day(s) ||
    x.offers.filter(activeOffer).length >= LIMIT.openOffers ||
    x.offers.filter((o) => liveOffer(s, o)).length >= LIMIT.offers
  )
    return;
  const candidates = ids(s)
    .filter(
      (id) =>
        (!x.cooldowns[id] || day(s) - x.cooldowns[id] >= LIMIT.actorCooldown) &&
        free(s, id, 15) &&
        relation(s, id).trust >= 15 &&
        relation(s, id).affinity >= 18,
    )
    .sort((a, b) => (x.cooldowns[a] || 0) - (x.cooldowns[b] || 0) || a.localeCompare(b));
  for (const id of candidates) {
    const n = actor(s, id),
      r = relation(s, id),
      social = s.living.npcs[id]?.social ?? r.affinity;
    if (social >= 70 || n.cash < 80) continue;
    let calendarId = "",
      expiresAt = s.time + 3 * DAY;
    if (s.npcs[id]) {
      if (!api.createNpcOffer) continue;
      const venue = `${n.home}-cafe`;
      search: for (const offset of [1, 2, 3])
        for (const minute of [1080, 1140, 1200]) {
          const result = api.createNpcOffer(
            s,
            {
              kind: "meeting",
              npcId: id,
              subjectId: "",
              day: day(s) + offset,
              minute,
              venue,
              duration: 60,
              repeat: "none",
            },
            api,
          );
          if (result.ok) {
            calendarId = result.entryId;
            break search;
          }
        }
      if (!calendarId) continue;
      const e = s.calendar.entries.find((e) => e.id === calendarId);
      expiresAt = Math.min(e.start - 60, s.time + 3 * DAY);
    }
    const o = {
      id: `offer-${x.nextId++}`,
      npcId: id,
      calendarId,
      type: calendarId ? "meeting" : "contact",
      createdAt: s.time,
      expiresAt,
      status: "open",
      reason: calendarId ? "invitationWhy" : "requestWhy",
      revised: false,
    };
    x.offers.push(o);
    while (x.offers.length > LIMIT.offers) {
      const i = x.offers.findIndex((o) => !liveOffer(s, o));
      if (i < 0) break;
      x.offers.splice(i, 1);
    }
    x.cooldowns[id] = day(s);
    x.lastInitiationDay = day(s);
    reserve(s, id, s.time + 5, n.home, `${id}:society-message:${s.time}`);
    row(
      s,
      calendarId ? "invitation" : "request",
      [id],
      o.reason,
      o.reason,
      { labelKey: "direct", actorId: id, credibility: 100 },
      { parentId: o.id },
    );
    return;
  }
}
function secondaryContact(s) {
  if (s.society.sessions.length >= LIMIT.sessions) return;
  for (const n of s.life.secondary) {
    if (!free(s, n.id, 30)) continue;
    const partner = keys(s.society.secondaryEdges)
      .filter((k) => k.startsWith(n.id + ">"))
      .map((k) => k.split(">")[1])
      .find(
        (id) =>
          actor(s, id).home === n.home &&
          free(s, id, 30) &&
          s.time - edge(s, n.id, id).lastContactAt >= 3 * DAY,
      );
    if (!partner) continue;
    const end = s.time + 30,
      key = `session-${s.society.nextId++}`;
    reserve(s, n.id, end, n.home, key + ":from");
    reserve(s, partner, end, n.home, key + ":to");
    s.society.sessions.push({
      id: key,
      from: n.id,
      to: partner,
      endsAt: end,
      startedAt: s.time,
      place: n.home,
    });
    return;
  }
}
function settleDistricts(s) {
  for (const [id, d] of Object.entries(s.society.districts)) {
    if (d.settledDay >= day(s)) continue;
    const c = s.living.population.districts[id],
      a = d.weeklyActivity;
    const foodIn = 24 + Math.floor(c.employed / 10),
      foodOut = 20 + Math.floor(c.households / 15),
      materialIn = 12 + Math.floor(c.employed / 20),
      materialOut = 10 + Math.floor(c.households / 40);
    d.foodStock = clamp(d.foodStock + foodIn - foodOut, 0, 180);
    d.materialStock = clamp(d.materialStock + materialIn - materialOut, 0, 120);
    d.serviceUsed = clamp(
      Math.floor(c.households / 15) - Math.floor(a.volunteerMinutes / 240),
      0,
      20,
    );
    d.settledDay = day(s);
    if (d.settledWeek >= week(s)) continue;
    const old = d.weeklyDelta,
      target = clamp(
        Math.round((c.employed - 90) / 4 + a.services / 6 + a.npcContacts / 8 - c.jobseekers / 8),
        -8,
        8,
      ),
      blend = (prev, next) => Math.round((prev + next) / 2);
    d.weeklyDelta = {
      demand: clamp(blend(old.demand, target), -8, 8),
      rentPressure: clamp(
        blend(old.rentPressure, Math.round((c.households / c.capacity - 0.65) * 15)),
        -5,
        5,
      ),
      stockPricePct: clamp(
        blend(old.stockPricePct, 100 + Math.round((55 - d.materialStock) / 8)),
        90,
        110,
      ),
      serviceDelay: clamp(Math.floor(d.serviceUsed / 4) * 5, 0, 30),
      jobOpenings: clamp(
        Math.round((c.employed - c.jobseekers) / 35 + a.workedMinutes / 8000),
        0,
        4,
      ),
    };
    d.history.push({
      at: s.time,
      key: "districtWhy",
      foodIn,
      foodOut,
      materialIn,
      materialOut,
      workedMinutes: a.workedMinutes,
      services: a.services,
      volunteerMinutes: a.volunteerMinutes,
      npcContacts: a.npcContacts,
    });
    d.history = d.history.slice(-6);
    d.settledWeek = week(s);
    row(
      s,
      "district",
      [],
      "districtWhy",
      "districtWhy",
      { labelKey: "observed", actorId: "", credibility: 100 },
      { parentId: id },
    );
    d.weeklyActivity = { workedMinutes: 0, services: 0, volunteerMinutes: 0, npcContacts: 0 };
  }
}
function syncOffers(s) {
  for (const o of s.society.offers.filter((o) => o.status === "accepted")) {
    const visited = new Set();
    while (!visited.has(o.calendarId)) {
      visited.add(o.calendarId);
      const replacement = s.calendar.entries.findLast(
        (e) =>
          e.replacesId === o.calendarId &&
          e.status === "confirmed" &&
          e.kind === "meeting" &&
          e.npcId === o.npcId,
      );
      if (!replacement) break;
      o.calendarId = replacement.id;
    }
  }
  for (const o of s.society.offers.filter(activeOffer)) {
    const e = s.calendar.entries.find((e) => e.id === o.calendarId);
    if (o.calendarId && e?.status !== "counter") {
      o.status = e?.status === "confirmed" || e?.status === "completed" ? "accepted" : "declined";
      row(
        s,
        o.type === "meeting" ? "invitation" : "request",
        [o.npcId],
        o.reason,
        o.status === "accepted" ? "accepted" : "declined",
        { labelKey: "direct", actorId: o.npcId, credibility: 100 },
        { parentId: o.id },
      );
    } else if (s.time >= o.expiresAt) {
      o.status = "expired";
      if (e?.status === "counter") {
        e.status = "rejected";
        e.outcome = COPY.expired;
        e.updatedAt = s.time;
      }
      row(
        s,
        o.type === "meeting" ? "invitation" : "request",
        [o.npcId],
        o.reason,
        "expired",
        { labelKey: "direct", actorId: o.npcId, credibility: 100 },
        { parentId: o.id },
      );
    }
  }
}
export function tickSociety(s, api) {
  if (!s.society || s.time < s.society.lastTick) return;
  const x = s.society;
  syncActors(s);
  syncOffers(s);
  for (const session of [...x.sessions])
    if (session.endsAt <= s.time) {
      x.sessions = x.sessions.filter((q) => q.id !== session.id);
      const present = [session.from, session.to].every(
        (id) =>
          actor(s, id)?.home === session.place &&
          !sec(s, id)?.move &&
          !s.calendar.entries.some(
            (e) =>
              e.npcId === id &&
              e.status === "confirmed" &&
              e.start < session.endsAt &&
              session.startedAt < e.end,
          ),
      );
      if (!present) continue;
      for (const [a, b] of [
        [session.from, session.to],
        [session.to, session.from],
      ]) {
        const e = edge(s, a, b);
        e.affinity = clamp(e.affinity + 3);
        e.trust = clamp(e.trust + 2);
        e.conflict = clamp(e.conflict - 1);
        e.lastContactAt = s.time;
      }
      societyContact(
        s,
        session.from,
        session.to,
        { kind: "social", start: session.startedAt, end: session.endsAt, place: session.place },
        api,
      );
    }
  for (const q of [...x.transmissions])
    if (q.dueAt <= s.time) {
      x.transmissions = x.transmissions.filter((t) => t.id !== q.id);
      // The snapshotted fact was known at the completed contact, never fetched from future state.
      societyLearn(s, q.to, { ...q.fact, disclosed: false }, api);
    }
  if (x.lastDay < day(s)) {
    settleDistricts(s);
    x.lastDay = day(s);
    if (day(s) % 7 === 1)
      for (const [k, m] of Object.entries(x.edgeMeta)) {
        m.reciprocity -= Math.sign(m.reciprocity);
        const e = x.secondaryEdges[k];
        if (e && s.time - e.lastContactAt > 10 * DAY) {
          e.affinity = clamp(e.affinity - 1);
          e.trust = clamp(e.trust - 1);
        }
      }
  }
  const checkpoint = [1050, 1230].includes(s.time % DAY);
  if (s.time > x.lastTick && checkpoint) {
    offered(s, api);
    secondaryContact(s);
  }
  x.lastTick = s.time;
}
export function nextSocietyAt(s) {
  if (!s.society) return Infinity;
  const base = Math.floor(s.time / DAY) * DAY;
  return Math.min(
    ...[
      base + 1050,
      base + 1230,
      base + DAY,
      base + DAY + 1050,
      ...s.society.offers.filter(activeOffer).map((o) => o.expiresAt),
      ...s.society.transmissions.map((q) => q.dueAt),
      ...s.society.sessions.map((q) => q.endsAt),
    ].filter((t) => t > s.time),
  );
}
export function societyActions(s, api) {
  if (!s.society) return [];
  const out = [];
  for (const o of s.society.offers.filter(activeOffer)) {
    if (o.calendarId)
      for (const offset of [1, 2]) {
        const result = o.revised
          ? { ok: false, reason: COPY.oneRevision }
          : api.reviseNpcOffer?.(s, o.calendarId, offset, api, { dryRun: true }) || {
              ok: false,
              reason: COPY.oneRevision,
            };
        out.push({
          id: `society:reschedule:${o.id}:${offset}`,
          label: `${name(o.npcId)} · ${COPY.reschedule} (+${offset})`,
          labelKey: "society.reschedule",
          textVars: { name: name(o.npcId), days: offset },
          description: COPY.rescheduleDetail,
          descriptionKey: "society.rescheduleDetail",
          category: "society",
          minutes: 5,
          cost: 0,
          pay: "total",
          npcId: o.npcId,
          disabled: !result.ok,
          reason: result.reason || "",
          run: (n) => {
            const r = api.reviseNpcOffer(n, o.calendarId, offset, api);
            if (!r.ok) throw Error("Invitation changed after validation");
            const offer = n.society.offers.find((q) => q.id === o.id);
            offer.revised = true;
            const entry = n.calendar.entries.find((e) => e.id === o.calendarId);
            offer.expiresAt = Math.min(entry.start - 60, n.time + 3 * DAY);
            return COPY.rescheduleDetail;
          },
        });
      }
    else
      out.push({
        id: `society:ack:${o.id}`,
        label: COPY.acknowledge,
        labelKey: "society.acknowledge",
        description: COPY.acknowledgeDetail,
        descriptionKey: "society.acknowledgeDetail",
        category: "society",
        minutes: 2,
        cost: 0,
        npcId: o.npcId,
        disabled: false,
        reason: "",
        run: (n) => {
          n.society.offers.find((q) => q.id === o.id).status = "declined";
          return COPY.declined;
        },
      });
  }
  for (const id of ids(s))
    for (const f of s.society.knowledge[id])
      if (f.disclosed && f.privacy === "shareable" && f.negative && !f.corrected && f.proof) {
        const evidence = repairEvidence(s, f);
        out.push({
          id: `society:clarify:${id}:${f.id}`,
          label: `${name(id)} · ${COPY.clarify}`,
          labelKey: "society.clarify",
          textVars: { name: name(id) },
          description: COPY.clarifyDetail,
          descriptionKey: "society.clarifyDetail",
          category: "society",
          minutes: 15,
          cost: 0,
          npcId: id,
          disabled: !evidence || !free(s, id, 15),
          reason: !evidence
            ? COPY.noEvidence
            : !free(s, id, 15)
              ? "Kişinin şu anda görüşme zamanı yok."
              : "",
          run: (n) => {
            reserve(n, id, n.time + 15, actor(n, id).home, `${id}:correction:${n.revision}`);
            societyLearn(
              n,
              id,
              { ...f, corrected: true, sourceActorId: id, credibility: 100, disclosed: true },
              api,
            );
            return COPY.correctedChange;
          },
        });
      }
  return out;
}
function repairEvidence(s, f) {
  return (
    s.calendar.entries.some(
      (e) =>
        e.npcId === f.originActorId &&
        e.status === "completed" &&
        e.end > f.eventAt &&
        relation(s, f.originActorId).trust >= 25,
    ) ||
    s.deep.promises.some(
      (p) =>
        p.npcId === f.originActorId &&
        p.direction === "player" &&
        p.status === "kept" &&
        (p.dueDay - 1) * DAY > f.eventAt,
    )
  );
}
export function adaptSocietyActions(s, actions, api) {
  if (!s.society) return actions;
  return actions.map((original) => {
    const a = { ...original },
      d = s.society.districts[s.location],
      fx = d.weeklyDelta,
      run = a.run;
    const meeting = /^calendar:(accept|attend):(.+)$/.exec(a.id);
    const invitation = meeting && invitationFor(s, meeting[2]);
    if (invitation) {
      const fee = venueById(s.calendar.entries.find((e) => e.id === meeting[2])?.venue)?.fee || 0;
      if (actor(s, invitation.npcId).cash < fee) {
        a.disabled = true;
        a.reason =
          "Karşı taraf kendi görüşme giderini karşılayamıyor; yeni gün öner veya planı kapat.";
      }
      if (meeting[1] === "attend")
        a.run = (n) => {
          actor(n, invitation.npcId).cash -= fee;
          return run(n);
        };
    }
    if (a.id === "buy:groceries") {
      a.cost = Math.round((a.cost * fx.stockPricePct) / 100);
      const why =
        d.foodStock < 1
          ? COPY.noStock
          : (a.pay === "total" ? funds(s) : s.cash) < a.cost
            ? COPY.noFunds
            : "";
      if (why) {
        a.disabled = true;
        a.reason = why;
      }
      a.description += ` Semt stoğu ${d.foodStock}; yerel fiyat %${fx.stockPricePct}.`;
      a.societyCost = { stock: d.foodStock, pricePct: fx.stockPricePct, kind: "food" };
      a.run = (n) => {
        n.society.districts[s.location].foodStock--;
        return run(n);
      };
    }
    if (a.id.startsWith("business:stock:") && s.deep.business) {
      const units = Number(a.id.split(":")[2]),
        type = by(BUSINESS_TYPES, s.deep.business.id),
        base = units * type.unitCost,
        cost = Math.round((base * fx.stockPricePct) / 100),
        why =
          d.materialStock < units
            ? COPY.noStock
            : s.living.enterprise.capital < cost
              ? COPY.noCapital
              : "";
      if (why) {
        a.disabled = true;
        a.reason = why;
      } else if (a.reason === "Malzeme için işletme sermayesi aktar.") {
        a.disabled = false;
        a.reason = "";
      }
      a.description = `${units} birim; güncel ${cost} TL işletme kasasından. Semt stoğu ${d.materialStock}, fiyat %${fx.stockPricePct}. Stok ve gerçek gider bir kez işlenir.`;
      a.societyCost = {
        stock: d.materialStock,
        pricePct: fx.stockPricePct,
        kind: "material",
        units,
        amount: cost,
      };
      a.run = (n) => {
        const msg = run(n),
          delta = cost - base;
        n.living.enterprise.capital -= delta;
        n.deep.business.costs += delta;
        n.society.districts[s.location].materialStock -= units;
        if (delta) api.record(n, "Yerel malzeme fiyat farkı", -delta, "business");
        return msg;
      };
    }
    if (a.id === "clinic") {
      a.minutes += fx.serviceDelay;
      a.description += ` Hizmet yoğunluğu: +${fx.serviceDelay} dk; bakım hakkı korunur.`;
      a.societyCost = { kind: "service", delay: fx.serviceDelay };
      a.run = (n) => {
        n.society.districts[s.location].serviceUsed = clamp(
          n.society.districts[s.location].serviceUsed + 1,
          0,
          20,
        );
        return run(n);
      };
    }
    return a;
  });
}
function learnTransition(s, id, topic, key, value, proof, negative, api, eventAt = s.time) {
  societyLearn(
    s,
    id,
    {
      id: key,
      topic,
      value,
      originActorId: id,
      sourceActorId: id,
      eventAt,
      credibility: 100,
      privacy: ["reliability", "work", "service"].includes(topic) ? "shareable" : "private",
      hops: 0,
      negative,
      corrected: false,
      proof,
      disclosed: true,
    },
    api,
  );
}
export function afterSocietyAction(s, id, before, api, resolved) {
  if (!s.society) return;
  syncActors(s);
  const activity = s.society.districts[before.location].weeklyActivity;
  if (id === "work" && s.job) {
    activity.workedMinutes = Math.min(100000, activity.workedMinutes + (resolved?.minutes || 420));
    const manager = by(EMPLOYERS, s.job.id).manager;
    learnTransition(
      s,
      manager,
      "work",
      `work:${s.life.employers[s.job.id].contractKey}:${week(s)}`,
      COPY.work,
      "",
      false,
      api,
    );
  }
  if (id === "business:serve" || id.startsWith("life:deliver:"))
    activity.services = Math.min(1000, activity.services + 1);
  if (id === "volunteer")
    activity.volunteerMinutes = Math.min(10000, activity.volunteerMinutes + 120);
  for (const p of s.deep.promises)
    if (
      p.direction === "player" &&
      ["kept", "broken"].includes(p.status) &&
      before.deep.promises.find((q) => q.id === p.id)?.status === "pending"
    )
      learnTransition(
        s,
        p.npcId,
        "reliability",
        `promise:${p.id}`,
        p.status === "kept"
          ? "Verilen yardım sözü yerine geldi."
          : "Verilen yardım sözü zamanında tutulmadı.",
        `promise:${p.id}`,
        p.status === "broken",
        api,
        p.status === "broken" ? Math.min(s.time, p.dueDay * DAY) : s.time,
      );
  for (const e of s.calendar.entries)
    if (
      e.npcId &&
      ["completed", "missed"].includes(e.status) &&
      before.calendar.entries.find((q) => q.id === e.id)?.status === "confirmed"
    )
      learnTransition(
        s,
        e.npcId,
        "reliability",
        `calendar:${e.id}`,
        e.status === "completed" ? "Onaylı buluşmaya katıldı." : "Onaylı buluşmaya gelmedi.",
        `calendar:${e.id}`,
        e.status === "missed",
        api,
        e.updatedAt,
      );
  const contact =
    /^(?:talk:|call:|mentor:|date:|life:talk:|life:call:|life:friend:|calendar:meeting:)([^:]+)$/.exec(
      id,
    )?.[1];
  if (contact && actor(s, contact)) {
    for (const f of s.society.knowledge[contact])
      if (!f.disclosed && f.privacy === "shareable") {
        f.disclosed = true;
        f.disclosedAt = s.time;
        row(
          s,
          "report",
          [contact],
          "reportWhy",
          "reportChange",
          { labelKey: "direct", actorId: contact, credibility: f.credibility },
          { parentId: f.id, happenedAt: f.eventAt, learnedAt: s.time },
        );
      }
    for (const o of s.society.offers)
      if (o.type === "contact" && o.npcId === contact && activeOffer(o)) {
        o.status = "accepted";
        row(
          s,
          "request",
          [contact],
          o.reason,
          "accepted",
          { labelKey: "direct", actorId: contact, credibility: 100 },
          { parentId: o.id },
        );
      }
    for (const [a, e] of Object.entries(s.living.known[contact]?.links || {}))
      if (edge(s, contact, a)) {
        // A player contact does not teach every private edge; retain previously observed snapshots only.
        if (e.at >= before.time)
          publicEdge(s, contact, a, { labelKey: "observed", actorId: contact, credibility: 100 });
      }
  }
  tickSociety(s, api);
}
const publicSource = (source) => ({ ...source, label: COPY[source.labelKey] || source.labelKey });
export function getSocietyView(s) {
  if (!s.society)
    return {
      offers: [],
      chronology: [],
      network: [],
      profiles: [],
      districts: [],
      summary: COPY.summary,
    };
  const x = s.society,
    offers = x.offers.filter(activeOffer).map((o) => {
      const e = s.calendar.entries.find((e) => e.id === o.calendarId);
      return {
        ...o,
        actor: { id: o.npcId, name: name(o.npcId) },
        title: COPY[o.type === "meeting" ? "invitation" : "request"],
        titleKey: o.type === "meeting" ? "invitation" : "request",
        why: COPY[o.reason],
        whyKey: o.reason,
        start: e?.start || 0,
        end: e?.end || 0,
        venue: e?.venue || "",
        actionIds: o.calendarId
          ? [
              `calendar:accept:${o.calendarId}`,
              `calendar:decline:${o.calendarId}`,
              ...(!o.revised ? [1, 2].map((d) => `society:reschedule:${o.id}:${d}`) : []),
            ]
          : [`life:call:${o.npcId}`, `society:ack:${o.id}`],
      };
    });
  const network = x.knownEdges.map((e) => ({
    ...e,
    from: { id: e.from, name: name(e.from) },
    to: { id: e.to, name: name(e.to) },
    source: publicSource(e.source),
    history: e.history.map((h) => ({ ...h, text: COPY[h.key] || COPY.contactChange })),
  }));
  return {
    offers,
    chronology: x.feed.map((r) => ({
      ...r,
      actors: r.actors.map((id) => ({ id, name: name(id) })),
      title: COPY[r.titleKey] || COPY.contact,
      why: COPY[r.whyKey],
      change: COPY[r.changeKey],
      source: publicSource(r.source),
      requiresAction: offers.some((o) => o.id === r.parentId),
      actionIds: offers.find((o) => o.id === r.parentId)?.actionIds || [],
    })),
    network,
    profiles: ids(s).map((id) => ({
      id,
      name: name(id),
      offers: offers.filter((o) => o.npcId === id).map((o) => o.id),
      knownFacts: x.knowledge[id]
        .filter((f) => f.disclosed)
        .map((f) => ({
          id: f.id,
          topic: f.topic,
          value: f.value,
          originActor: { id: f.originActorId, name: name(f.originActorId) },
          hops: f.hops,
          source: {
            label: COPY[f.sourceActorId === id ? "direct" : "relayed"],
            actorId: f.sourceActorId,
            credibility: f.credibility,
          },
          credibility: f.credibility,
          happenedAt: f.eventAt,
          learnedAt: f.disclosedAt,
          privacy: f.privacy,
          corrected: f.corrected,
        })),
      ties: network.filter((e) => e.from.id === id || e.to.id === id),
      lastLearnedAt: Math.max(
        0,
        ...x.knowledge[id].filter((f) => f.disclosed).map((f) => f.disclosedAt),
      ),
    })),
    districts: DISTRICTS.map((d) => {
      const z = x.districts[d.id];
      return {
        id: d.id,
        name: d.name,
        foodStock: z.foodStock,
        materialStock: z.materialStock,
        serviceUsed: z.serviceUsed,
        validUntil: (z.settledWeek + 1) * 7 * DAY,
        effects: { ...z.weeklyDelta },
        why: COPY.districtWhy,
        whyKey: "districtWhy",
        history: z.history.map((h) => ({ ...h, text: COPY[h.key] })),
        actionIds:
          s.location === d.id
            ? ["buy:groceries", ...(s.deep.business?.location === d.id ? ["business:stock:3"] : [])]
            : [`travel:${d.id}`],
      };
    }),
    summary: COPY.summary,
  };
}
const plain = (v) =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
const exact = (v, names) =>
  plain(v) && keys(v).sort().join(" ") === names.split(" ").sort().join(" ");
const num = (v, min = 0, max = MAX) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const int = (v, min = 0, max = MAX) => Number.isSafeInteger(v) && v >= min && v <= max;
const text = (v, max = 300) => typeof v === "string" && v.length <= max;
const array = (v, max) => Array.isArray(v) && v.length <= max;
export function validateSociety(s) {
  try {
    const x = s.society,
      actors = ids(s),
      id = (v) => actors.includes(v),
      at = (v) => int(v, 0, s.time),
      district = (v) => DISTRICTS.some((d) => d.id === v);
    const source = (v) =>
      exact(v, "labelKey actorId credibility") &&
      ["observed", "direct", "relayed"].includes(v.labelKey) &&
      (v.actorId === "" || id(v.actorId)) &&
      int(v.credibility, 0, 100);
    const hist = (v) =>
      array(v, 3) &&
      v.every(
        (h) =>
          exact(h, "at key") &&
          at(h.at) &&
          ["social", "favor", "repay", "reconcile"].includes(h.key),
      );
    const fact = (f) =>
      exact(
        f,
        "id topic value originActorId sourceActorId eventAt learnedAt credibility privacy hops appliedTrust negative corrected proof disclosed disclosedAt",
      ) &&
      text(f.id) &&
      f.id.length > 0 &&
      SOCIETY_TOPICS.includes(f.topic) &&
      text(f.value) &&
      id(f.originActorId) &&
      id(f.sourceActorId) &&
      at(f.eventAt) &&
      int(f.learnedAt, f.eventAt, s.time) &&
      (f.disclosed ? int(f.disclosedAt, f.learnedAt, s.time) : f.disclosedAt === 0) &&
      int(f.credibility, 0, 100) &&
      ["private", "shareable"].includes(f.privacy) &&
      int(f.hops, 0, 2) &&
      num(f.appliedTrust, -3, 0) &&
      ["negative", "corrected", "disclosed"].every((k) => typeof f[k] === "boolean") &&
      text(f.proof) &&
      (!f.corrected || f.appliedTrust === 0);
    if (
      !exact(
        x,
        "version initializedAt lastTick lastDay lastInitiationDay nextId offers cooldowns edgeMeta secondaryEdges knowledge retiredBefore transmissions sessions knownEdges feed districts",
      ) ||
      x.version !== 1 ||
      !at(x.initializedAt) ||
      !int(x.lastTick, x.initializedAt, s.time) ||
      !int(x.lastDay, 1, day(s)) ||
      !int(x.lastInitiationDay, 1, day(s)) ||
      !int(x.nextId, 1) ||
      !exact(x.cooldowns, actors.join(" ")) ||
      !Object.values(x.cooldowns).every((v) => int(v, 0, day(s))) ||
      !exact(x.knowledge, actors.join(" ")) ||
      !exact(x.retiredBefore, actors.join(" ")) ||
      !Object.values(x.retiredBefore).every(
        (marks) =>
          plain(marks) &&
          keys(marks).length <= actors.length &&
          Object.entries(marks).every(([origin, value]) => id(origin) && at(value)),
      ) ||
      !Object.values(x.knowledge).every(
        (a) =>
          array(a, LIMIT.facts) && new Set(a.map((f) => f.id)).size === a.length && a.every(fact),
      )
    )
      return false;
    if (
      !plain(x.edgeMeta) ||
      keys(x.edgeMeta).length > LIMIT.edgeMeta ||
      !plain(x.secondaryEdges) ||
      keys(x.secondaryEdges).length > LIMIT.secondaryEdges
    )
      return false;
    for (const [a, b] of NPCS.flatMap((a) =>
      NPCS.filter((b) => a.id !== b.id).map((b) => [a.id, b.id]),
    ))
      if (!x.edgeMeta[edgeKey(a, b)]) return false;
    for (const [k, m] of Object.entries(x.edgeMeta)) {
      const [a, b, ...rest] = k.split(">");
      if (
        rest.length ||
        !id(a) ||
        !id(b) ||
        a === b ||
        !edge(s, a, b) ||
        !exact(m, "type reciprocity lastReconciledAt history") ||
        !["colleague", "neighbor", "friend", "acquaintance"].includes(m.type) ||
        !num(m.reciprocity, -100, 100) ||
        !at(m.lastReconciledAt) ||
        !hist(m.history)
      )
        return false;
    }
    for (const [k, e] of Object.entries(x.secondaryEdges)) {
      const [a, b, ...rest] = k.split(">");
      if (
        rest.length ||
        !id(a) ||
        !id(b) ||
        a === b ||
        (s.npcs[a] && s.npcs[b]) ||
        !exact(e, "affinity trust conflict lastContactAt") ||
        ![e.affinity, e.trust, e.conflict].every((v) => num(v, 0, 100)) ||
        !at(e.lastContactAt) ||
        !x.edgeMeta[k]
      )
        return false;
    }
    if (
      !array(x.offers, LIMIT.offers) ||
      new Set(x.offers.map((o) => o.id)).size !== x.offers.length ||
      new Set(x.offers.filter((o) => o.calendarId).map((o) => o.calendarId)).size !==
        x.offers.filter((o) => o.calendarId).length ||
      x.offers.filter(activeOffer).length > LIMIT.openOffers
    )
      return false;
    for (const o of x.offers) {
      const e = s.calendar.entries.find((e) => e.id === o.calendarId);
      if (
        !exact(o, "id npcId calendarId type createdAt expiresAt status reason revised") ||
        !/^offer-\d+$/.test(o.id) ||
        !id(o.npcId) ||
        !text(o.calendarId, 80) ||
        !["meeting", "contact"].includes(o.type) ||
        !at(o.createdAt) ||
        !int(o.expiresAt, o.createdAt + 1, o.createdAt + 6 * DAY) ||
        !["open", "accepted", "declined", "expired"].includes(o.status) ||
        !["invitationWhy", "requestWhy"].includes(o.reason) ||
        typeof o.revised !== "boolean" ||
        (o.type === "meeting"
          ? !s.npcs[o.npcId] || !o.calendarId
          : o.calendarId !== "" || !!s.npcs[o.npcId]) ||
        (o.type === "meeting" && e && (e.kind !== "meeting" || e.npcId !== o.npcId)) ||
        (activeOffer(o) &&
          (o.expiresAt <= s.time ||
            (o.calendarId &&
              (!e || e.status !== "counter" || e.npcId !== o.npcId || o.expiresAt >= e.start))))
      )
        return false;
    }
    if (
      !array(x.transmissions, LIMIT.transmissions) ||
      new Set(x.transmissions.map((q) => q.id)).size !== x.transmissions.length
    )
      return false;
    for (const q of x.transmissions)
      if (
        !exact(q, "id from to dueAt contactAt fact") ||
        !/^msg-\d+$/.test(q.id) ||
        !id(q.from) ||
        !id(q.to) ||
        q.from === q.to ||
        !int(q.dueAt, s.time + 1, s.time + DAY) ||
        !at(q.contactAt) ||
        q.dueAt < q.contactAt + 15 ||
        !fact(q.fact) ||
        q.fact.privacy !== "shareable" ||
        q.fact.hops < 1 ||
        q.fact.sourceActorId !== q.from
      )
        return false;
    if (
      !array(x.sessions, LIMIT.sessions) ||
      new Set(x.sessions.map((q) => q.id)).size !== x.sessions.length
    )
      return false;
    for (const q of x.sessions)
      if (
        !exact(q, "id from to endsAt startedAt place") ||
        !/^session-\d+$/.test(q.id) ||
        !id(q.from) ||
        !id(q.to) ||
        q.from === q.to ||
        !sec(s, q.from) ||
        !s.npcs[q.to] ||
        !edge(s, q.from, q.to) ||
        !edge(s, q.to, q.from) ||
        sec(s, q.from).busyUntil < q.endsAt ||
        !s.living.npcs[q.to].plan.some(
          (p) =>
            p.id === `${q.id}:to` &&
            p.kind === "visit" &&
            p.status === "planned" &&
            p.start === q.startedAt &&
            p.end === q.endsAt &&
            p.location === q.place,
        ) ||
        !int(q.endsAt, s.time + 1, s.time + 30) ||
        !at(q.startedAt) ||
        q.endsAt !== q.startedAt + 30 ||
        !district(q.place)
      )
        return false;
    if (
      !array(x.knownEdges, LIMIT.knownEdges) ||
      new Set(x.knownEdges.map((e) => e.id)).size !== x.knownEdges.length
    )
      return false;
    for (const e of x.knownEdges)
      if (
        !exact(e, "id from to type strength trust conflict reciprocity learnedAt source history") ||
        e.id !== edgeKey(e.from, e.to) ||
        !id(e.from) ||
        !id(e.to) ||
        e.from === e.to ||
        !["colleague", "neighbor", "friend", "acquaintance"].includes(e.type) ||
        ![e.strength, e.trust, e.conflict].every((v) => num(v, 0, 100)) ||
        !num(e.reciprocity, -100, 100) ||
        !at(e.learnedAt) ||
        !source(e.source) ||
        !hist(e.history)
      )
        return false;
    if (!array(x.feed, LIMIT.feed) || new Set(x.feed.map((r) => r.id)).size !== x.feed.length)
      return false;
    for (const r of x.feed)
      if (
        !exact(
          r,
          "id type actors titleKey whyKey changeKey happenedAt learnedAt source relatedNpcIds parentId",
        ) ||
        !/^soc-\d+$/.test(r.id) ||
        !text(r.type, 30) ||
        !array(r.actors, 2) ||
        !r.actors.every(id) ||
        !array(r.relatedNpcIds, 2) ||
        !r.relatedNpcIds.every(id) ||
        ![r.titleKey, r.whyKey, r.changeKey].every((k) => Object.hasOwn(COPY, k)) ||
        !at(r.happenedAt) ||
        !int(r.learnedAt, r.happenedAt, s.time) ||
        !source(r.source) ||
        !text(r.parentId)
      )
        return false;
    if (!exact(x.districts, DISTRICTS.map((d) => d.id).join(" "))) return false;
    for (const d of Object.values(x.districts)) {
      if (
        !exact(
          d,
          "settledDay settledWeek foodStock materialStock serviceUsed weeklyActivity weeklyDelta history",
        ) ||
        !int(d.settledDay, 1, day(s)) ||
        !int(d.settledWeek, 0, week(s)) ||
        !int(d.foodStock, 0, 180) ||
        !int(d.materialStock, 0, 120) ||
        !int(d.serviceUsed, 0, 20) ||
        !exact(d.weeklyActivity, "workedMinutes services volunteerMinutes npcContacts") ||
        !int(d.weeklyActivity.workedMinutes, 0, 100000) ||
        !int(d.weeklyActivity.services, 0, 1000) ||
        !int(d.weeklyActivity.volunteerMinutes, 0, 10000) ||
        !int(d.weeklyActivity.npcContacts, 0, 1000) ||
        !exact(d.weeklyDelta, "demand rentPressure stockPricePct serviceDelay jobOpenings") ||
        !int(d.weeklyDelta.demand, -8, 8) ||
        !int(d.weeklyDelta.rentPressure, -5, 5) ||
        !int(d.weeklyDelta.stockPricePct, 90, 110) ||
        !int(d.weeklyDelta.serviceDelay, 0, 30) ||
        !int(d.weeklyDelta.jobOpenings, 0, 4) ||
        !array(d.history, 6)
      )
        return false;
      for (const h of d.history)
        if (
          !exact(
            h,
            "at key foodIn foodOut materialIn materialOut workedMinutes services volunteerMinutes npcContacts",
          ) ||
          !at(h.at) ||
          h.key !== "districtWhy" ||
          ![
            h.foodIn,
            h.foodOut,
            h.materialIn,
            h.materialOut,
            h.workedMinutes,
            h.services,
            h.volunteerMinutes,
            h.npcContacts,
          ].every((v) => int(v, 0, 100000))
        )
          return false;
    }
    const generated = [...x.offers, ...x.transmissions, ...x.sessions, ...x.feed].map((r) =>
      Number(r.id.split("-").at(-1)),
    );
    return (
      generated.every((n) => int(n, 1, x.nextId - 1)) &&
      new Set(generated).size === generated.length
    );
  } catch {
    return false;
  }
}
