import { NPCS, SKILLS, COURSES, HOMES, DISTRICTS } from "./content.mjs";
import { BUSINESS_TYPES, NPC_PROFILES, DISTRICT_RULES } from "./deep-content.mjs";
import { travelMinutes } from "./city.mjs";
import { PROJECT_TYPES, HOUSEHOLD_ASSETS, MARKET_CYCLE, NPC_UTILITIES } from "./world-content.mjs";
const DAY = 1440,
  MAX = 1_000_000_000;
const by = (list, id) => list.find((x) => x.id === id);
const cap = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const money = (n) => Math.round(cap(n, 0, MAX));
const day = (s) => Math.floor(s.time / DAY) + 1;
const funds = (s) => s.cash + s.bank;
const off = (d, i) => (d - 1) % 7 === i % 7 || (d - 1) % 7 === (i + 1) % 7;
const overlap = (a, b) => a.start < b.end && b.start < a.end;
const name = (id) => by(NPCS, id)?.name || id;
const district = (id) => by(DISTRICTS, id)?.name || id;
const commitments = (s, id, start, end) =>
  s.calendar?.entries?.filter(
    (e) =>
      e.npcId === id &&
      (e.status === "confirmed" ||
        (s.version >= 5 &&
          e.status === "counter" &&
          s.society?.offers.some((o) => o.calendarId === e.id && o.status === "open"))) &&
      e.start < end &&
      start < e.end,
  ) || [];
function market(s, id) {
  const index = DISTRICTS.findIndex((d) => d.id === id),
    week = Math.floor((day(s) - 1) / 7);
  const cohort = s.living?.population?.districts[id];
  const demand = cap(
    MARKET_CYCLE[(week + index * 2 + (s.seed % 3)) % MARKET_CYCLE.length] +
      (cohort ? Math.round((cohort.employed - 90) / 3) : 0) +
      (s.life?.districts[id]?.demandDelta || 0) +
      (s.society?.districts[id]?.weeklyDelta.demand || 0),
    30,
    100,
  );
  return {
    demand,
    activity: cap(demand + index * 3 + (cohort ? Math.round(cohort.students / 12) : 0), 0, 100),
    vacancies: cohort
      ? Math.min(8, Math.max(0, Math.floor((cohort.capacity - cohort.households) / 8)))
      : 5,
  };
}
function nextDecision(at) {
  const base = Math.floor(at / DAY) * DAY;
  return [480, 720, 1080, 1260].map((m) => base + m).find((t) => t > at) || base + DAY + 480;
}
function block(id, kind, start, end, location, extra = {}) {
  return {
    id,
    kind,
    start,
    end,
    location,
    from: location,
    to: location,
    target: "",
    cost: 0,
    wage: 0,
    status: "planned",
    ...extra,
  };
}
function routine(s, id, d) {
  const index = NPCS.findIndex((n) => n.id === id),
    n = s.deep.npcs[id],
    start = (d - 1) * DAY,
    out = [];
  const booking = commitments(s, id, start, start + DAY);
  const working = n.employment === "employed" && !off(d, index);
  const workplace = n.employment === "searching" ? "sisli" : n.work;
  if (working) {
    const a = start + 540,
      b = start + 1020,
      travel = travelMinutes(s, n.home, workplace, a),
      back = travelMinutes(s, workplace, n.home, b);
    const work = block(`${id}:${d}:work`, "work", a, b, workplace, { wage: n.salary });
    if (!booking.some((c) => overlap({ start: a - travel, end: b + back }, c))) {
      if (travel)
        out.push(
          block(`${id}:${d}:commute-out`, "commute", a - travel, a, n.home, { to: workplace }),
        );
      out.push(work);
      if (back)
        out.push(
          block(`${id}:${d}:commute-home`, "commute", b, b + back, workplace, { to: n.home }),
        );
    }
  }
  out.push(block(`${id}:${d}:night`, "sleep", start + 1320, start + DAY + 420, n.home));
  return out;
}
function currentBlocks(s, id, from, to) {
  return (
    s.living?.npcs[id]?.plan.filter(
      (p) => p.status === "planned" && p.start < to && from < p.end,
    ) || []
  );
}
export function getNpcPlan(s, id, from = s.time, to = s.time + DAY) {
  if (!s.living?.npcs[id] || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to <= from)
    return [];
  to = Math.min(to, from + 14 * DAY);
  const result = new Map();
  for (let d = Math.floor(from / DAY) + 1; d <= Math.floor((to - 1) / DAY) + 1; d++)
    for (const p of d === day(s) ? [] : routine(s, id, d))
      if (p.start < to && from < p.end) result.set(p.id, p);
  for (const p of currentBlocks(s, id, from, to)) result.set(p.id, p);
  const booked = commitments(s, id, from - 180, to + 180);
  return [...result.values()]
    .filter((p) => !booked.some((c) => overlap(p, c)))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id))
    .map((p) => ({
      start: p.start,
      end: p.end,
      location: p.location,
      kind: p.kind,
      from: p.from,
      to: p.to,
    }));
}
function seedDay(s, id, d, after) {
  const n = s.living.npcs[id];
  n.plan = n.plan.filter((p) => p.end > after && p.status === "planned");
  for (const p of routine(s, id, d)) {
    if (p.end <= after || n.plan.some((x) => x.id === p.id)) continue;
    if (p.start < after) {
      const length = p.end - p.start;
      p.wage = Math.floor((p.wage * (p.end - after)) / length);
      p.start = after;
    }
    n.plan.push(p);
  }
  n.plan = n.plan.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)).slice(0, 16);
}
export function initLiving(s) {
  const now = s.time;
  s.living = {
    version: 1,
    initializedAt: now,
    lastTickAt: now,
    settledDay: day(s),
    npcs: Object.fromEntries(
      NPCS.map((n) => [
        n.id,
        {
          energy: 80,
          social: 65,
          nextDecisionAt: nextDecision(now),
          decisionDay: day(s),
          decisions: 0,
          serial: 0,
          lastFavorAt: 0,
          plan: [],
        },
      ]),
    ),
    graph: Object.fromEntries(
      NPCS.map((n) => [
        n.id,
        Object.fromEntries(
          NPCS.filter((x) => x.id !== n.id).map((other) => {
            const affinity = s.deep.npcs[n.id].ties[other.id] || 10;
            return [
              other.id,
              {
                affinity,
                trust: Math.round(affinity * 0.7),
                conflict: 0,
                lastContactAt: now,
                owed: 0,
                dueAt: 0,
              },
            ];
          }),
        ),
      ]),
    ),
    known: Object.fromEntries(
      NPCS.map((n) => [
        n.id,
        {
          home: s.deep.npcs[n.id].home,
          profession: s.deep.npcs[n.id].profession,
          lastSharedAt: now,
          changes: [],
          links: {},
        },
      ]),
    ),
    projects: [],
    nextProject: 1,
    population: {
      settledWeek: Math.floor((day(s) - 1) / 7),
      districts: Object.fromEntries(
        DISTRICTS.map((d, i) => [
          d.id,
          {
            employed: 90 + i * 5,
            jobseekers: 20 - i * 3,
            students: 40 - i * 2,
            households: 75 + i * 5,
            capacity: 115 + i * 7,
          },
        ]),
      ),
    },
    household: { assets: [], maintainedUntil: now + 30 * DAY, lastLeaseAt: 0 },
    enterprise: {
      instanceId: s.deep.business ? `${s.deep.business.id}:${s.deep.business.openedDay}` : "",
      capital: 0,
      stock: 0,
      lastRestockAt: 0,
    },
    markets: Object.fromEntries(DISTRICTS.map((d) => [d.id, market(s, d.id)])),
    feed: [],
  };
  for (const region of DISTRICTS) s.living.markets[region.id] = market(s, region.id);
  for (const n of NPCS) seedDay(s, n.id, day(s), now);
  return s;
}
function known(s, id, text, api, place = s.deep.npcs[id].home, channel = "") {
  const observed = api.playerPresent?.(s, place) && s.time % DAY >= 420 && s.time % DAY < 1320;
  const told = !!channel || (s.npcs[id].affinity >= 30 && s.npcs[id].trust >= 20);
  if (!observed && !told) return;
  const source = channel || (observed ? "Yerinde gözlem" : `${name(id)} haber verdi`);
  const k = s.living.known[id];
  k.home = s.deep.npcs[id].home;
  k.profession = s.deep.npcs[id].profession;
  k.lastSharedAt = s.time;
  k.changes.push({ at: s.time, text, source });
  k.changes = k.changes.slice(-10);
  s.living.feed.push({ at: s.time, text: `${name(id)}: ${text}`, source });
  s.living.feed = s.living.feed.slice(-32);
  api.memory(s, id, text);
  api.news(s, `${name(id)}: ${text}`);
}
function explainNpc(s, id, text, api, place) {
  const n = s.deep.npcs[id];
  n.changes.push({ day: day(s), text });
  n.changes = n.changes.slice(-12);
  known(s, id, text, api, place);
}
function locationAt(s, id, at) {
  const active = getNpcPlan(s, id, at, at + 1).find((p) => p.start <= at && at < p.end);
  return active?.location || s.deep.npcs[id].home;
}
function feasible(s, id, start, duration, place, api) {
  const end = start + duration,
    n = s.deep.npcs[id],
    actual = locationAt(s, id, start),
    travel = api.travelMinutes?.(s, actual, place, start) ?? travelMinutes(s, actual, place, start),
    finish = end + travel;
  if (
    start % DAY < 420 ||
    finish % DAY > 1320 ||
    Math.floor(start / DAY) !== Math.floor(finish / DAY)
  )
    return null;
  const own = getNpcPlan(s, id, start, finish);
  if (own.some((p) => overlap({ start, end: finish }, p))) return null;
  const bookings =
    api.npcCommitments?.(s, id, start, finish + 180) || commitments(s, id, start, finish + 180);
  for (const c of bookings) {
    const buffer = travelMinutes(s, place, c.district || c.location || n.home, finish);
    if (start < c.end && c.start < finish + buffer) return null;
  }
  return { travel, finish, from: actual };
}
function addDecision(s, id, option, api) {
  const x = s.living.npcs[id],
    fit = feasible(s, id, s.time, option.minutes, option.location, api);
  if (!fit) return false;
  if (option.target && ["social", "favor"].includes(option.kind)) {
    const recipientFit = feasible(
      s,
      option.target,
      s.time,
      option.minutes + fit.travel,
      option.location,
      api,
    );
    if (!recipientFit || recipientFit.travel !== 0) return false;
  }
  x.serial++;
  const key = `${id}:choice:${x.serial}`;
  if (fit.travel)
    x.plan.push(
      block(key + ":travel", "commute", s.time, s.time + fit.travel, fit.from, {
        to: option.location,
      }),
    );
  x.plan.push(
    block(key, option.kind, s.time + fit.travel, fit.finish, option.location, {
      target: option.target || "",
      cost: option.cost || 0,
    }),
  );
  if (option.target && ["social", "favor"].includes(option.kind)) {
    const other = s.living.npcs[option.target];
    other.plan.push(
      block(
        key + ":recipient",
        "visit",
        s.time,
        s.time + fit.travel + option.minutes,
        option.location,
        { target: id },
      ),
    );
    other.plan = other.plan
      .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
      .slice(-16);
  }
  x.plan = x.plan.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)).slice(-16);
  x.decisions++;
  return true;
}
function selectDecision(s, id, index, api) {
  const x = s.living.npcs[id],
    n = s.deep.npcs[id],
    profile = NPC_PROFILES[index],
    options = [];
  const owed = Object.entries(s.living.graph[id]).find(
    ([, e]) => e.owed > 0 && n.cash >= e.owed + 200,
  );
  if (owed)
    options.push({ kind: "repay", minutes: 30, location: n.home, target: owed[0], score: 110 });
  options.push({ kind: "rest", minutes: 60, location: n.home, score: Math.max(8, 95 - x.energy) });
  options.push({
    kind: "budget",
    minutes: 30,
    location: n.home,
    score: n.cash < 500 || n.cash > 3500 ? 75 : 12,
  });
  if (n.employment === "searching")
    options.push({ kind: "job-search", minutes: 120, location: "sisli", score: 100 });
  if (n.cash >= 90)
    options.push({
      kind: "study",
      minutes: 90,
      location: n.home,
      cost: 90,
      score: (profile.priority === "career" ? 49 : 30) + (100 - n.skill) / 10,
    });
  if (n.employment === "employed" && n.level < 2 && n.tenure >= 12 && n.skill >= 28 + n.level * 10)
    options.push({
      kind: "career",
      minutes: 90,
      location: n.work,
      score: profile.priority === "career" ? 85 : 38,
    });
  if (
    (api.canNpcMove?.(s, id) ?? true) &&
    profile.priority === "home" &&
    n.savings >= 12000 &&
    s.time - n.lastMoveDay * DAY >= 30 * DAY
  )
    options.push({ kind: "move", minutes: 120, location: n.home, score: 90 });
  const contacts = Object.entries(s.living.graph[id]).sort(
    (a, b) =>
      b[1].affinity - b[1].conflict - (a[1].affinity - a[1].conflict) || a[0].localeCompare(b[0]),
  );
  for (const [otherId, edge] of contacts.slice(0, 3)) {
    const other = s.deep.npcs[otherId];
    if (s.time - edge.lastContactAt >= DAY && feasible(s, otherId, s.time, 60, other.home, api))
      options.push({
        kind: "social",
        minutes: 60,
        location: other.home,
        target: otherId,
        score: Math.max(10, 75 - x.social) + edge.affinity / 6,
      });
    // V6 support is selected exclusively from the directly learned, recent
    // needs supplied below. Private recipient balances cannot affect utility.
    if (
      s.version < 6 &&
      other.cash < 400 &&
      (s.version < 5 ||
        s.society?.knowledge[id]?.some(
          (f) => f.id === `need:${otherId}:${other.request?.sinceDay}` && f.topic === "finance",
        )) &&
      n.cash >= 1200 &&
      edge.trust >= 25 &&
      s.time - x.lastFavorAt >= 7 * DAY &&
      feasible(s, otherId, s.time, 30, other.home, api)
    )
      options.push({
        kind: "favor",
        minutes: 30,
        location: other.home,
        target: otherId,
        score: 70,
      });
  }
  if (s.version >= 5) options.push(...(api.societyNpcOptions?.(s, id) || []));
  options.sort(
    (a, b) =>
      b.score - a.score ||
      a.kind.localeCompare(b.kind) ||
      String(a.target).localeCompare(String(b.target)),
  );
  for (const option of options) if (addDecision(s, id, option, api)) return;
}
function syncGraph(s, id) {
  s.deep.npcs[id].ties = Object.fromEntries(
    Object.entries(s.living.graph[id])
      .sort((a, b) => b[1].affinity - a[1].affinity || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([other, e]) => [other, Math.round(e.affinity)]),
  );
}
function meetNpcs(s, id, otherId, api, plan) {
  const a = s.living.graph[id][otherId],
    b = s.living.graph[otherId][id],
    person = s.deep.npcs[id],
    other = s.deep.npcs[otherId];
  a.affinity = cap(a.affinity + 5);
  a.trust = cap(a.trust + 3);
  a.conflict = cap(a.conflict - 2);
  a.lastContactAt = s.time;
  b.affinity = cap(b.affinity + 3);
  b.trust = cap(b.trust + 2);
  b.conflict = cap(b.conflict - 1);
  b.lastContactAt = s.time;
  s.living.npcs[id].social = cap(s.living.npcs[id].social + 20);
  s.living.npcs[otherId].social = cap(s.living.npcs[otherId].social + 12);
  if (s.version < 5)
    for (const [source, target, edge] of [
      [person, other, a],
      [other, person, b],
    ])
      if (edge.trust >= 35 && edge.conflict < 20) {
        const fact = source.knownFacts.at(-1);
        if (fact && !target.knownFacts.some((f) => f.id === fact.id && f.day >= fact.day))
          api.reveal(
            s,
            source === person ? otherId : id,
            fact.id,
            fact.value,
            `${source === person ? name(id) : name(otherId)} yüz yüze anlattı`,
          );
      }
  syncGraph(s, id);
  syncGraph(s, otherId);
  if (s.version >= 5)
    api.societyContact?.(
      s,
      id,
      otherId,
      { kind: "social", start: plan.start, end: plan.end, place: plan.location },
      api,
    );
  const place = other.home;
  if (api.playerPresent?.(s, place))
    for (const [from, to] of [
      [id, otherId],
      [otherId, id],
    ]) {
      const e = s.living.graph[from][to];
      s.living.known[from].links[to] = {
        trust: e.trust,
        affinity: e.affinity,
        conflict: e.conflict,
        at: s.time,
      };
    }
  explainNpc(
    s,
    id,
    `${name(otherId)} ile görüştü; birbirlerine duydukları güven aynı hızda olmasa da arttı.`,
    api,
    place,
  );
}
function finish(s, id, p, api) {
  const n = s.deep.npcs[id],
    x = s.living.npcs[id];
  if (p.kind === "commute") {
    return;
  }
  if (p.kind === "sleep") {
    x.energy = 95;
    return;
  }
  if (p.kind === "work") {
    n.cash = money(n.cash + p.wage);
    if (s.version >= 5) api.societyNpcWork?.(s, id, p.end - p.start, p.location);
    n.tenure++;
    x.energy = cap(x.energy - 28);
    x.social = cap(x.social - 3);
    return;
  }
  if (p.cost > n.cash) return;
  n.cash -= p.cost;
  switch (p.kind) {
    case "rest":
      x.energy = cap(x.energy + 24);
      break;
    case "budget": {
      const debtToPeople = Object.values(s.living.graph[id]).reduce((sum, e) => sum + e.owed, 0),
        bankDebt = Math.max(0, n.debt - debtToPeople);
      if (n.cash < 800 && n.savings) {
        const value = Math.min(n.savings, 1600 - n.cash);
        n.cash += value;
        n.savings -= value;
      }
      if (bankDebt && n.cash > 900) {
        const value = Math.min(bankDebt, n.cash - 700, 500);
        n.cash -= value;
        n.debt -= value;
      }
      if (n.cash > 3500) {
        const value = n.cash - 2500;
        n.cash -= value;
        n.savings = money(n.savings + value);
      }
      break;
    }
    case "study":
      n.skill = cap(n.skill + 2);
      x.energy = cap(x.energy - 8);
      break;
    case "job-search":
      n.jobSearchDays++;
      x.energy = cap(x.energy - 10);
      if (n.jobSearchDays >= 3) {
        const place = DISTRICTS.slice().sort(
          (a, b) =>
            s.living.markets[b.id].demand - s.living.markets[a.id].demand ||
            a.id.localeCompare(b.id),
        )[0];
        n.employment = "employed";
        n.work = place.id;
        n.employer = `${place.name} · yeni ekip`;
        n.lastJobChangeDay = day(s);
        n.tenure = 0;
        explainNpc(s, id, `${place.name}’ta yeni bir iş sözleşmesi buldu.`, api, place.id);
      }
      break;
    case "career":
      if (n.level < 2) {
        n.level++;
        n.salary = money(n.salary * 1.1);
        const destination = DISTRICTS[(NPCS.findIndex((a) => a.id === id) + n.level) % 3];
        n.work = destination.id;
        n.profession =
          n.level === 1
            ? `${by(NPCS, id).role} · kıdemli`
            : `${by(NPCS, id).role} · ekip sorumlusu`;
        n.employer = `${destination.name} · uzman ekip`;
        n.tenure = 0;
        n.lastJobChangeDay = day(s);
        explainNpc(
          s,
          id,
          `Uzmanlığına uygun bir görüşme sonucunda ${destination.name}’ta iş değiştirdi.`,
          api,
          destination.id,
        );
      }
      break;
    case "move":
      if (n.savings >= 4500) {
        const destination = DISTRICTS.filter((d) => d.id !== n.home).sort(
          (a, b) =>
            s.living.markets[b.id].vacancies - s.living.markets[a.id].vacancies ||
            a.id.localeCompare(b.id),
        )[0];
        n.savings -= 4500;
        n.home = destination.id;
        n.rent = Math.max(3500, n.rent - 250);
        n.lastMoveDay = day(s);
        for (const future of x.plan)
          if (future.kind === "sleep" && future.start > s.time) {
            future.location = destination.id;
            future.from = destination.id;
            future.to = destination.id;
          }
        explainNpc(
          s,
          id,
          `Biriktirdiği parayla ${destination.name}’a taşındı; sonraki yaşam giderleri değişti.`,
          api,
          destination.id,
        );
      }
      break;
    case "social":
      if (
        !commitments(s, p.target, p.start, p.end).length &&
        s.living.npcs[p.target].plan.some(
          (q) => q.kind === "visit" && q.target === id && q.start <= p.start && q.end === p.end,
        )
      )
        if (!(s.version >= 5 && api.societyNpcOutcome?.(s, id, p, api)))
          meetNpcs(s, id, p.target, api, p);
      break;
    case "favor": {
      const other = s.deep.npcs[p.target],
        edge = s.living.graph[p.target][id],
        reverse = s.living.graph[id][p.target];
      if (
        n.cash >= 700 &&
        edge.owed === 0 &&
        !commitments(s, p.target, p.start, p.end).length &&
        s.living.npcs[p.target].plan.some(
          (q) => q.kind === "visit" && q.target === id && q.start <= p.start && q.end === p.end,
        )
      ) {
        n.cash -= 300;
        other.cash = money(other.cash + 300);
        other.debt = money(other.debt + 300);
        edge.owed = 300;
        edge.dueAt = s.time + 7 * DAY;
        edge.trust = cap(edge.trust + 6);
        reverse.trust = cap(reverse.trust + 2);
        x.lastFavorAt = s.time;
        if (s.version >= 5)
          api.societyContact?.(
            s,
            id,
            p.target,
            { kind: "favor", start: p.start, end: p.end, place: p.location, amount: 300 },
            api,
          );
        explainNpc(
          s,
          id,
          `${name(p.target)} için kendi bütçesinden kısa vadeli destek ayırdı.`,
          api,
          p.location,
        );
      }
      break;
    }
    case "repay": {
      const edge = s.living.graph[id][p.target];
      if (edge.owed && n.cash >= edge.owed) {
        const value = edge.owed;
        n.cash -= value;
        n.debt = Math.max(0, n.debt - value);
        s.deep.npcs[p.target].cash = money(s.deep.npcs[p.target].cash + value);
        edge.owed = 0;
        edge.dueAt = 0;
        if (s.version >= 5)
          api.societyContact?.(
            s,
            id,
            p.target,
            { kind: "repay", start: p.start, end: p.end, place: p.location, amount: value },
            api,
          );
        edge.conflict = cap(edge.conflict - 6);
        s.living.graph[p.target][id].trust = cap(s.living.graph[p.target][id].trust + 5);
        explainNpc(s, id, `${name(p.target)}’e verdiği geri ödeme sözünü tuttu.`, api, p.location);
      }
      break;
    }
  }
}
function settlePopulation(s) {
  const population = s.living.population,
    week = Math.floor((day(s) - 1) / 7);
  if (population.settledWeek >= week) return;
  population.settledWeek = week;
  for (const region of DISTRICTS) {
    const c = population.districts[region.id],
      demand = s.living.markets[region.id].demand,
      graduates = Math.min(1, c.students),
      layoffs = demand < 60 ? Math.min(c.employed, 3) : 0,
      hires = demand >= 60 ? Math.min(c.jobseekers, Math.floor(demand / 20)) : 0;
    c.students -= graduates;
    c.jobseekers += graduates + layoffs - hires;
    c.employed += hires - layoffs;
  }
  const ordered = DISTRICTS.slice().sort(
      (a, b) =>
        s.living.markets[a.id].demand - s.living.markets[b.id].demand || a.id.localeCompare(b.id),
    ),
    from = population.districts[ordered[0].id],
    to = population.districts[ordered.at(-1).id];
  const movers = Math.min(2, from.jobseekers, Math.max(0, to.capacity - to.households));
  from.jobseekers -= movers;
  from.households -= movers;
  to.jobseekers += movers;
  to.households += movers;
}
function settleDay(s, api) {
  const d = day(s);
  if (s.living.settledDay >= d) return;
  s.living.settledDay = d;
  settlePopulation(s);
  for (const [index, base] of NPCS.entries()) {
    const id = base.id,
      n = s.deep.npcs[id],
      x = s.living.npcs[id];
    const livingCost =
        api.npcHousingCost?.(s, id, 180 + Math.round(n.rent / 30)) ?? 180 + Math.round(n.rent / 30),
      paid = Math.min(livingCost, n.cash);
    n.cash -= paid;
    n.debt = money(n.debt + livingCost - paid);
    x.social = cap(x.social - 9);
    const profile = NPC_PROFILES[index];
    n.goalProgress = cap(
      profile.priority === "career"
        ? n.level * 35 + n.tenure
        : profile.priority === "home"
          ? (n.lastMoveDay ? 50 : 0) + n.savings / 400
          : profile.priority === "security"
            ? (n.savings - n.debt) / 250
            : Object.values(s.living.graph[id]).reduce((sum, e) => sum + e.affinity, 0) / 7,
    );
    s.npcs[id].mood = Math.round(cap((x.energy + x.social) / 2 - n.resentment / 3));
    if (d - s.npcs[id].lastTalkDay > 5 && d % 4 === 0)
      s.npcs[id].affinity = cap(s.npcs[id].affinity - 1);
    if (n.resentment > 0 && d % 7 === index % 7) n.resentment = cap(n.resentment - 1);
    if (!n.request && (n.cash < 400 || x.social < 35) && d - n.lastHelpDay > 7) {
      n.request = { kind: n.cash < 400 ? "loan" : "help", sinceDay: d, deadlineDay: d + 4 };
      known(s, id, "Kendi düzeni için çevresinden somut destek arıyor.", api, n.home);
    }
    if (n.request && d > n.request.deadlineDay) n.request = null;
    for (const [other, e] of Object.entries(s.living.graph[id])) {
      if (s.time - e.lastContactAt > 10 * DAY && d % 7 === index % 7) {
        e.affinity = cap(e.affinity - 1);
        e.trust = cap(e.trust - 1);
      }
      if (e.owed && e.dueAt && s.time > e.dueAt) {
        e.dueAt = 0;
        e.conflict = cap(e.conflict + 8);
        s.living.graph[other][id].trust = cap(s.living.graph[other][id].trust - 10);
        explainNpc(
          s,
          id,
          `${name(other)}’e verdiği geri ödeme sözünü kaçırdı; aralarında güven azaldı.`,
          api,
          n.home,
        );
      }
    }
    if (
      d % 7 === 1 &&
      n.employment === "employed" &&
      s.living.markets[n.work].demand < 50 &&
      n.tenure >= 10 &&
      n.level === 0
    ) {
      n.employment = "searching";
      n.jobSearchDays = 0;
      n.lastJobChangeDay = d;
      explainNpc(
        s,
        id,
        "İşyerindeki talep daralınca sözleşmesi sona erdi; yeni bir iş arıyor.",
        api,
        n.work,
      );
    }
    x.decisionDay = d;
    x.decisions = 0;
    seedDay(s, id, d, s.time);
    syncGraph(s, id);
  }
  for (const region of DISTRICTS) s.living.markets[region.id] = market(s, region.id);
  if (s.deep.business && d % 7 === 1 && s.living.markets[s.deep.business.location].demand < 60)
    s.deep.business.clients = Math.max(0, s.deep.business.clients - 1);
  for (const project of s.living.projects)
    if (project.status === "active" && d > project.dueDay) {
      project.status = "failed";
      api.log(
        s,
        `${by(PROJECT_TYPES, project.type).name}: plan süresi doldu. Gerçek beceriler, eşya ve sözleşmeler korundu; proje ödülü yok.`,
      );
    }
}
export function tickLiving(s, api) {
  if (!s.living || s.time <= s.living.lastTickAt) return;
  // Stable actor order and due-time ordering make ties and money flows replayable.
  const due = [];
  for (const actor of NPCS)
    for (const p of s.living.npcs[actor.id].plan)
      if (p.status === "planned" && p.end <= s.time) due.push({ id: actor.id, p });
  due.sort((a, b) => a.p.end - b.p.end || a.id.localeCompare(b.id) || a.p.id.localeCompare(b.p.id));
  for (const { id, p } of due) {
    p.status = "done";
    if (!commitments(s, id, p.start, p.end).length) finish(s, id, p, api);
  }
  settleDay(s, api);
  for (const [index, n] of NPCS.entries()) {
    const x = s.living.npcs[n.id];
    if (x.nextDecisionAt <= s.time) {
      if (x.decisionDay !== day(s)) {
        x.decisionDay = day(s);
        x.decisions = 0;
      }
      if (x.decisions < 4) selectDecision(s, n.id, index, api);
      x.nextDecisionAt = nextDecision(s.time);
    }
    x.plan = x.plan.filter((p) => p.status === "planned" && p.end > s.time).slice(-16);
  }
  s.living.lastTickAt = s.time;
}
export function nextLivingAt(s) {
  if (!s.living) return Infinity;
  let next = (Math.floor(s.time / DAY) + 1) * DAY;
  for (const n of Object.values(s.living.npcs)) {
    if (n.nextDecisionAt > s.time) next = Math.min(next, n.nextDecisionAt);
    for (const p of n.plan)
      if (p.status === "planned" && p.end > s.time) next = Math.min(next, p.end);
  }
  return next;
}

const targetName = (type, id) =>
  by(
    type === "qualification"
      ? SKILLS
      : type === "relocation"
        ? HOMES
        : type === "enterprise"
          ? BUSINESS_TYPES
          : NPCS,
    id,
  )?.name || id;
const targets = (type) =>
  type === "qualification"
    ? SKILLS
    : type === "relocation"
      ? HOMES.filter((h) => h.id !== "shelter")
      : type === "enterprise"
        ? BUSINESS_TYPES
        : NPCS;
const projectKey = (type, target) => `${type}:${target}`;
function projectRelevant(s, p, id) {
  if (p.type === "qualification")
    return (
      id === `practice:${p.target}` ||
      (id === "study" && by(COURSES, s.course?.id)?.skill === p.target) ||
      (id.startsWith("enroll:") && by(COURSES, id.slice(7))?.skill === p.target)
    );
  if (p.type === "relocation") return id === `move:${p.target}`;
  if (p.type === "enterprise")
    return (
      id.startsWith("business:") &&
      (!s.deep.business || s.deep.business.id === p.target) &&
      !id.startsWith("business:withdraw") &&
      !id.startsWith("business:stock")
    );
  return (
    (id.endsWith(`:${p.target}`) &&
      /^(talk|gift|date|mentor|apologize|deep:|calendar:meeting:)/.test(id)) ||
    (id.startsWith("deep:fulfill:") &&
      s.deep.promises.find((x) => x.id === id.slice(13))?.npcId === p.target)
  );
}
function projectCost(s, p, a) {
  if (!projectRelevant(s, p, a.effectId || a.id)) return 0;
  return a.cost || 0;
}
function describeProject(s, p) {
  const t = by(PROJECT_TYPES, p.type);
  return {
    id: p.id,
    title: `${t.name} · ${targetName(p.type, p.target)}`,
    description: t.description,
    status: p.status,
    progress: p.progress.filter(Boolean).length,
    total: 3,
    budget: p.budget,
    spent: p.spent,
    dueDay: p.dueDay,
    nextMilestone: t.milestones[p.progress.findIndex((x) => !x)] || "Plan tamamlandı.",
    consequences: t.consequences,
    actionIds: p.status === "active" ? [`project:extend:${p.id}`, `project:abandon:${p.id}`] : [],
  };
}
export function getHouseholdEffects(s) {
  const atHome = s.location === by(HOMES, s.housing.id).district && s.housing.id !== "shelter",
    h = s.living?.household,
    active = atHome && h && s.time < h.maintainedUntil;
  return {
    sleepEnergy: active && h.assets.includes("bed") ? 5 : 0,
    cookMinutes: active && h.assets.includes("kitchen") ? -15 : 0,
    cookHunger: active && h.assets.includes("kitchen") ? 5 : 0,
    practiceBonus: active && h.assets.includes("desk") ? 1 : 0,
  };
}
function businessMetrics(s) {
  const b = s.deep.business;
  if (!b) return { capacity: 0, demand: 0, served: 0, revenue: 0, operating: 0 };
  const type = by(BUSINESS_TYPES, b.id),
    rule = by(DISTRICT_RULES, b.location),
    demand = s.living.markets[b.location].demand,
    capacity = 2 + b.level,
    served = Math.min(
      s.living.enterprise.stock,
      b.clients,
      capacity,
      Math.max(1, Math.floor((capacity * demand) / 100)),
    ),
    quality = s.player.energy < 35 ? 0.65 : 1;
  return {
    capacity,
    demand,
    served,
    quality,
    operating: served * 30,
    revenue: Math.round(
      served *
        type.unitPrice *
        (rule.business === b.id ? rule.demand : 1) *
        (demand / 100) *
        quality,
    ),
  };
}
export function livingActions(s, api) {
  if (!s.living) return [];
  const result = [];
  const add = (id, label, description, category, minutes, cost, reason, run) => {
    const why = reason || (funds(s) < cost ? `${cost} TL kullanılabilir bakiye gerekir.` : "");
    result.push({
      id,
      label,
      description,
      category,
      minutes,
      cost,
      disabled: !!why,
      reason: why,
      pay: "total",
      run,
    });
  };
  for (const type of PROJECT_TYPES)
    for (const target of targets(type.id)) {
      const existing = s.living.projects.find((p) => p.type === type.id && p.target === target.id);
      if (existing && existing.status !== "failed") continue;
      for (const duration of [type.days, type.days + 30])
        add(
          `project:start:${type.id}:${target.id}:${duration}`,
          `${type.name} · ${target.name} · ${duration} gün`,
          `${type.budget} TL plan bütçesi; para ayrılmaz veya kazanılmaz. Üç aşama gerçek eylemlerle ilerler. Bütçeyi ve süreyi sonradan sınırlı değiştirebilirsin.`,
          "project",
          0,
          0,
          s.living.projects.filter((p) => p.status === "active").length >= 4
            ? "En çok dört etkin proje olabilir."
            : s.living.projects.length >= 24 && !existing
              ? "Proje arşivi dolu."
              : "",
          (next) => {
            if (existing)
              next.living.projects = next.living.projects.filter((p) => p.id !== existing.id);
            const id = `project-${next.living.nextProject++}`;
            next.living.projects.push({
              id,
              type: type.id,
              target: target.id,
              status: "active",
              startedAt: next.time,
              dueDay: day(next) + duration,
              budget: type.budget,
              spent: 0,
              progress: [false, false, false],
              extended: false,
            });
            return "Proje açıldı; bütçe bir harcama sınırıdır, ayrı bir para hesabı değildir.";
          },
        );
    }
  for (const p of s.living.projects.filter((p) => p.status === "active")) {
    for (const budget of [2000, 5000, 15000, 30000])
      if (budget !== p.budget)
        add(
          `project:budget:${p.id}:${budget}`,
          `${targetName(p.type, p.target)} · bütçe ${budget} TL`,
          "Gerçek harcamaları geri almaz. Yalnızca bu hedefe bağlı sonraki eylemlerin harcama sınırını değiştirir.",
          "project",
          0,
          0,
          budget < p.spent ? "Yeni sınır harcanan tutarın altında olamaz." : "",
          (next) => {
            next.living.projects.find((x) => x.id === p.id).budget = budget;
            return "Proje bütçesi güncellendi.";
          },
        );
    add(
      `project:extend:${p.id}`,
      `${targetName(p.type, p.target)} · 14 gün ekle`,
      "Her projede bir kez. Gerçek randevuların veya kursların tarihi kendiliğinden değişmez.",
      "project",
      0,
      0,
      p.extended ? "Bu projenin süre uzatma hakkı kullanıldı." : "",
      (next) => {
        const x = next.living.projects.find((x) => x.id === p.id);
        x.dueDay += 14;
        x.extended = true;
        return "Proje son tarihi 14 gün uzadı.";
      },
    );
    add(
      `project:abandon:${p.id}`,
      `${targetName(p.type, p.target)} · projeyi bırak`,
      "Gerçek sözleşmeler, öğrenilen beceriler ve giderler kalır; proje ödülü verilmez.",
      "project",
      0,
      0,
      "",
      (next) => {
        next.living.projects.find((x) => x.id === p.id).status = "failed";
        return "Proje kapatıldı; gerçek yaşam sonuçları korundu.";
      },
    );
  }
  for (const asset of HOUSEHOLD_ASSETS)
    if (!s.living.household.assets.includes(asset.id))
      add(
        `household:buy:${asset.id}`,
        `${asset.name} · evine kur`,
        `${asset.description} ${asset.cost} TL; taşındığında yanında götürürsün.`,
        "life",
        60,
        asset.cost,
        s.housing.id === "shelter"
          ? "Önce düzenli bir oda kirala."
          : s.location !== by(HOMES, s.housing.id).district
            ? "Ev semtine git."
            : "",
        (next) => {
          next.living.household.assets.push(asset.id);
          api.document(
            next,
            `house-${asset.id}`,
            asset.name,
            `${asset.cost} TL karşılığında alındı; aylık ortak bakım gerekir.`,
          );
          return "Eşya kuruldu; bakımlı olduğu sürece evde somut fayda sağlar.";
        },
      );
  add(
    "household:maintain",
    "Ev bakımını yap",
    "200 TL, 60 dk. Tüm taşınabilir ev eşyalarının faydasını 30 gün sürdürür; kalan bakım süresini silmez.",
    "life",
    60,
    200,
    !s.living.household.assets.length
      ? "Önce bir ev eşyası edin."
      : s.location !== by(HOMES, s.housing.id).district
        ? "Ev semtine git."
        : s.living.household.maintainedUntil > s.time + 7 * DAY
          ? "Bakımın son yedi gününde veya bitince yenileyebilirsin."
          : "",
    (next) => {
      next.living.household.maintainedUntil =
        Math.max(next.time, next.living.household.maintainedUntil) + 30 * DAY;
      return "Ev eşyalarının bakımı tamamlandı.";
    },
  );
  add(
    "household:lease",
    "Kira sözleşmesini gözden geçir",
    "300 TL düzenleme, 60 dk; ev sahibi güveni 50 ve gecikmesiz kira gerekir. Mevcut kira %3 azalır. En az 60 gün ara; kira başlangıç bedelinin %80’inin altına inmez.",
    "life",
    60,
    300,
    s.housing.id === "shelter"
      ? "Misafirhanede kira sözleşmesi yok."
      : s.location !== by(HOMES, s.housing.id).district
        ? "Ev semtine git."
        : s.housing.arrears
          ? "Önce biriken kirayı öde."
          : s.housing.rent <= Math.round(by(HOMES, s.housing.id).rent * 0.8)
            ? "Bu konut için kira görüşmesi alt sınırına ulaştın."
            : s.npcs.leyla.trust < 50
              ? "Ev sahibinin güveni 50 olmalı."
              : s.living.household.lastLeaseAt && s.time - s.living.household.lastLeaseAt < 60 * DAY
                ? "Son sözleşme görüşmesinden 60 gün geçmeli."
                : "",
    (next) => {
      next.housing.rent = Math.max(
        Math.round(by(HOMES, next.housing.id).rent * 0.8),
        Math.round(next.housing.rent * 0.97),
      );
      next.living.household.lastLeaseAt = next.time;
      api.document(
        next,
        `lease-${next.revision}`,
        "Kira sözleşmesi eki",
        `Düzenli ödeme ve karşılıklı güvenle yeni aylık kira ${next.housing.rent} TL.`,
      );
      return "Kira sözleşmesi yenilendi; yeni kira sonraki ödeme gününde geçerli.";
    },
  );
  if (s.deep.business) {
    const e = s.living.enterprise,
      b = s.deep.business,
      type = by(BUSINESS_TYPES, b.id);
    for (const amount of [500, 2000, 5000])
      add(
        `business:fund:${amount}`,
        `İşletmeye ${amount} TL sermaye aktar`,
        "Kişisel bakiyeden işletme kasasına aktarım; kâr veya gider sayılmaz. Stok ve müşteri edinimi kasadan ödenir. Haftalık sabit gider kişisel hesaptan tahsil edilir.",
        "business",
        5,
        amount,
        e.capital + amount > MAX ? "İşletme kasası üst sınırda." : "",
        (next) => {
          next.living.enterprise.capital += amount;
          return "Para işletme kasasına aktarıldı; toplam sahip olduğun para değişmedi.";
        },
      );
    for (const amount of [500, 2000, 5000])
      add(
        `business:withdraw:${amount}`,
        `İşletmeden ${amount} TL çek`,
        "İşletme kasasından bankana aktar; bu bir satış geliri değildir. Yaklaşan stok ve tanıtım ihtiyacını dikkate al.",
        "business",
        5,
        0,
        e.capital < amount ? "İşletme kasasında bu tutar yok." : "",
        (next) => {
          next.living.enterprise.capital -= amount;
          api.receive(next, amount, "İşletme kasasından kişisel hesaba aktarım", "bank");
          return "İşletme kasasından bankana aktarım yapıldı.";
        },
      );
    for (const units of [3, 6, 12])
      add(
        `business:stock:${units}`,
        `${units} hizmetlik stok hazırla`,
        `${units * type.unitCost} TL işletme kasasından gider. En çok 24 birim; stok kullanılmadan gelir oluşmaz.`,
        "business",
        30,
        0,
        s.location !== b.location
          ? "İşletmenin semtine git."
          : e.stock + units > 24
            ? "Stok kapasitesi 24 birim."
            : e.capital < units * type.unitCost
              ? "Malzeme için işletme sermayesi aktar."
              : "",
        (next) => {
          const value = units * type.unitCost;
          next.living.enterprise.capital -= value;
          next.living.enterprise.stock += units;
          next.living.enterprise.lastRestockAt = next.time;
          next.deep.business.costs = money(next.deep.business.costs + value);
          api.record(next, "İşletme stoğu · kasadan", -value, "business");
          return "Stok satın alındı; malzeme gideri yalnızca bir kez kaydedildi.";
        },
      );
  }
  return result;
}
function socialTarget(s, id) {
  const end = id.split(":").at(-1);
  if (by(NPCS, end)) return end;
  if (id.startsWith("deep:fulfill:"))
    return s.deep.promises.find((p) => p.id === id.slice(13))?.npcId;
  return null;
}
function socialRequirement(s, id, n) {
  const r = s.npcs[n],
    d = day(s),
    type = id.split(":")[0];
  if (type === "talk" && r.lastTalkDay === d) return "Bugün uzun bir sohbet ettiniz.";
  if (type === "call" && r.lastCallDay === d) return "Bugün aradın.";
  if (type === "gift")
    return !s.inventory.gift
      ? "Çantanda küçük hediye yok."
      : r.lastGiftDay === d
        ? "Bugün hediye verdin."
        : "";
  if (type === "apologize")
    return r.lastApologyDay === d
      ? "Bugün bu konuyu konuştunuz."
      : r.trust >= 70
        ? "Aranızdaki güven zaten güçlü."
        : "";
  if (type === "conflict" && s.flags[`conflict-${n}`] === d) return "Bugün sınırını dile getirdin.";
  if (type === "mentor")
    return r.trust < 40
      ? "Birlikte çalışmak için güven 40 gerekir."
      : r.lastMentorDay === d
        ? "Bugün birlikte çalıştınız."
        : "";
  if (type === "date")
    return r.affinity < 40 || r.trust < 30
      ? "Karşılıklı yakınlık 40 ve güven 30 gerekir."
      : r.lastDateDay === d
        ? "Bugün birlikte özel zaman geçirdiniz."
        : s.flags.partner && s.flags.partner !== n
          ? "Önce mevcut ilişkin hakkında açık bir karar ver."
          : "";
  if (type === "partner")
    return s.flags.partner
      ? "Önce mevcut ilişkin hakkında bir karar ver."
      : r.affinity < 55 || r.trust < 45 || r.romance < 24
        ? "Yakınlık 55, güven 45, romantizm 24 gerekir."
        : "";
  if (id.startsWith("deep:disclose:") && s.deep.npcs[n].lastDisclosureDay === d)
    return "Bugün planlarını anlattın.";
  if (id.startsWith("deep:support:"))
    return r.trust < 50
      ? "Güven 50 gerekir."
      : s.deep.npcs[n].lastPromiseDay && d - s.deep.npcs[n].lastPromiseDay < 21
        ? "Son destek talebinden 21 gün geçmeli."
        : s.deep.promises.some(
              (p) => p.npcId === n && p.status === "pending" && p.direction === "npc",
            )
          ? "Bu kişiden zaten bir söz bekliyorsun."
          : "";
  return "";
}
export function adaptLivingActions(s, actions, api) {
  if (!s.living) return actions;
  const effects = getHouseholdEffects(s);
  return actions.map((original) => {
    let a = { ...original };
    const n = a.category === "social" ? socialTarget(s, a.id) : null;
    if (
      n &&
      !a.id.startsWith("deep:promise:") &&
      !a.id.startsWith("deep:decline:") &&
      !a.id.startsWith("schedule:")
    ) {
      const remote = a.id.startsWith("call:"),
        plans = getNpcPlan(s, n, s.time, s.time + Math.max(1, a.minutes));
      const busy = plans.find((p) => overlap(p, { start: s.time, end: s.time + a.minutes }));
      const where = locationAt(s, n, s.time),
        reason =
          s.time % DAY < 540 || (s.time % DAY) + a.minutes > 1260
            ? "Görüşme 09.00–21.00 arasında tamamlanmalı."
            : busy
              ? `${name(n)} bu sürede ${busy.kind === "work" ? "çalışıyor" : busy.kind === "commute" ? "yolda" : "başka bir planla meşgul"}. Takvimden uygun bir saat seç.`
              : !remote && s.location !== where
                ? `${name(n)} şu an ${district(where)}’ta; o semte git veya telefon et.`
                : socialRequirement(s, a.id, n) ||
                  ((a.pay === "total" ? funds(s) : a.pay === "bank" ? s.bank : s.cash) < a.cost
                    ? "Gerekli kullanılabilir bakiye yok."
                    : "");
      a.disabled = !!reason;
      a.reason = reason;
      a.npcId = n;
      a.destination = remote ? "" : where;
      const run = a.run;
      a.run = (next) => {
        next.living.npcs[n].plan.push(
          block(`${n}:player:${next.revision}`, "visit", next.time, next.time + a.minutes, where),
        );
        return run(next);
      };
    }
    if (a.id === "sleep" && effects.sleepEnergy) {
      const run = a.run;
      a.run = (next) => {
        const text = run(next);
        api.change(next, { energy: effects.sleepEnergy });
        return text + " Bakımlı yatağın +5 enerji sağladı.";
      };
      a.description += " Bakımlı yatak: +5 enerji.";
    }
    if (a.id === "cook" && effects.cookHunger) {
      const run = a.run;
      a.minutes = Math.max(15, a.minutes + effects.cookMinutes);
      a.run = (next) => {
        const text = run(next);
        api.change(next, { hunger: effects.cookHunger });
        return text + " Düzenli mutfakla daha hızlı, doyurucu bir öğün.";
      };
      a.description += " Bakımlı mutfak: −15 dk, +5 tokluk.";
    }
    if (a.id.startsWith("practice:") && effects.practiceBonus) {
      const run = a.run;
      a.run = (next) => {
        const text = run(next);
        api.skill(next, a.id.slice(9), 1);
        return text + " Çalışma köşesi +1 beceri sağladı.";
      };
      a.description += " Bakımlı çalışma köşesi: +1 beceri.";
    }
    if (a.id.startsWith("move:")) {
      const target = by(HOMES, a.id.slice(5));
      if (target && ["studio", "apartment"].includes(target.id)) {
        const available = s.living.markets[target.district].vacancies;
        a.description += ` Semtte ${available} kiralık konut fırsatı var.`;
        if (!available && !a.disabled) {
          a.disabled = true;
          a.reason =
            "Semtte uygun bağımsız konut kalmadı; gelecek haftanın ilanlarını veya paylaşımlı odayı değerlendir.";
        }
      }
    }
    const b = s.deep.business,
      e = s.living.enterprise;
    if (b && a.id === "business:acquire") {
      const max = Math.min(
        8,
        2 + b.level * 2,
        Math.max(2, Math.floor(s.living.markets[b.location].demand / 16)),
      );
      a.cost = 0;
      a.description = `120 dk, işletme kasasından 180 TL tanıtım; müşteri +1. Günlük bir kez; bölgesel talebe göre sınır ${max}.`;
      a.reason =
        b.status !== "active"
          ? "Önce işletmeyi yeniden aç."
          : s.location !== b.location
            ? "İşletmenin semtine git."
            : b.clients >= max
              ? "Bölgesel talep ve kapasite sınırına ulaştın."
              : b.lastAcquireDay === day(s)
                ? "Bugünkü müşteri edinimini yaptın."
                : e.capital < 180
                  ? "Tanıtım için işletme sermayesi aktar."
                  : "";
      a.disabled = !!a.reason;
      a.run = (next) => {
        next.living.enterprise.capital -= 180;
        next.deep.business.costs = money(next.deep.business.costs + 180);
        next.deep.business.clients++;
        next.deep.business.lastAcquireDay = day(next);
        api.record(next, "Müşteri edinimi · işletme kasası", -180, "business");
        api.change(next, { energy: -7, stress: 4 });
        return "Tanıtım tamamlandı; gerçek işletme kasasından gider işlendi.";
      };
    }
    if (b && a.id === "business:serve") {
      const m = businessMetrics(s),
        type = by(BUSINESS_TYPES, b.id);
      a.cost = 0;
      a.description = `${m.served} müşteri; talep %${m.demand}. 180 dk, ${m.operating} TL işletme kasası gideri → ${m.revenue} TL işletme kasası geliri. Önceden alınan stok kullanılır. Sabit haftalık gider kişisel hesaptan ayrıca ödenir.`;
      a.reason =
        b.status !== "active"
          ? "İşletme durmuş durumda."
          : s.location !== b.location
            ? "İşletmenin semtine git."
            : !b.clients
              ? "Önce müşteri bul."
              : !e.stock
                ? "Önce işletme kasasından stok hazırla."
                : b.lastServiceDay === day(s)
                  ? "Bugün hizmet vardiyası yaptın."
                  : s.player.energy < 20
                    ? "En az 20 enerji gerekir."
                    : e.capital < m.operating
                      ? "Hizmet gideri için işletme kasasını tamamla."
                      : "";
      a.disabled = !!a.reason;
      a.run = (next) => {
        const business = next.deep.business;
        next.living.enterprise.stock -= m.served;
        next.living.enterprise.capital = money(
          next.living.enterprise.capital + m.revenue - m.operating,
        );
        business.costs = money(business.costs + m.operating);
        business.revenue = money(business.revenue + m.revenue);
        business.lastServiceDay = day(next);
        business.reputation = cap(business.reputation + (m.quality === 1 ? 3 : -5));
        if (m.quality < 1) business.clients = Math.max(0, business.clients - 1);
        api.record(next, "Müşteri hizmeti · işletme kasası", m.revenue - m.operating, "business");
        api.change(next, { energy: -18, stress: 8 });
        api.skill(next, type.skill, 1);
        return `${m.served} stok kullanıldı; işletme kasasına net ${m.revenue - m.operating} TL girdi. Malzeme ve haftalık gider sonrası kârlılığı izlemelisin.`;
      };
    }
    if (b && a.id === "business:close") {
      const type = by(BUSINESS_TYPES, b.id),
        liquid =
          e.capital + Math.floor(e.stock * type.unitCost * 0.35) + Math.floor(type.startup / 4),
        owed = b.arrears + Math.ceil(b.accruedOverhead);
      a.cost = Math.max(0, owed - liquid);
      a.reason = funds(s) < a.cost ? "Borçların tasfiye değerini aşan kısmını karşıla." : "";
      a.disabled = !!a.reason;
      a.description = `Kasa ${e.capital} TL, stok tasfiyesi ${Math.floor(e.stock * type.unitCost * 0.35)} TL, kurulumun %25’i; toplam ${liquid} TL. Birikmiş ${owed} TL gider mahsup edilir. Geri kalan ${Math.max(0, liquid - owed)} TL bankana aktarılır.`;
      a.run = (next) => {
        api.receive(
          next,
          Math.max(0, liquid - owed),
          "İşletme tasfiyesi · kasa ve kalan varlıklar",
          "bank",
        );
        api.document(
          next,
          `closure-${next.revision}`,
          type.name + " · tasfiye",
          `Gelir ${b.revenue} TL, gider ${b.costs + Math.ceil(b.accruedOverhead)} TL; kasa ve stok yalnızca bir kez tasfiye edildi.`,
        );
        next.deep.business = null;
        next.living.enterprise = { instanceId: "", capital: 0, stock: 0, lastRestockAt: 0 };
        return "İşletme kapatıldı; sermaye, stok ve borç birlikte tasfiye edildi.";
      };
    }
    for (const p of s.living.projects.filter((p) => p.status === "active"))
      if (p.spent + projectCost(s, p, a) > p.budget && !a.disabled) {
        a.disabled = true;
        a.reason = `${targetName(p.type, p.target)} projesinin bütçesi yetersiz. Proje bütçesini açıkça güncelle veya planı bırak.`;
      }
    return a;
  });
}
function updateProjects(s, id, before, api, resolved) {
  for (const p of s.living.projects) {
    const prior = before.living.projects.find((x) => x.id === p.id);
    if (!prior || prior.status !== "active") continue;
    const original = api.getBaseAction?.(before, id);
    let cost = resolved?.cost ?? original?.cost ?? 0;
    if (!resolved) {
      if (id.startsWith("business:fund:")) cost = Number(id.split(":")[2]);
      if (id === "business:serve" || id === "business:acquire" || id.startsWith("business:stock:"))
        cost = 0;
    }
    if (projectRelevant(before, p, id)) p.spent = money(p.spent + cost);
    if (p.status !== "active") continue;
    if (p.type === "qualification") {
      if (
        id === `practice:${p.target}` ||
        (id.startsWith("enroll:") && by(COURSES, id.slice(7))?.skill === p.target) ||
        (id === "study" && by(COURSES, before.course?.id)?.skill === p.target)
      )
        p.progress[0] = true;
      p.progress[1] = s.documents.some(
        (d) => d.id.startsWith("certificate-") && by(COURSES, d.id.slice(12))?.skill === p.target,
      );
      p.progress[2] = s.player.skills[p.target] >= 60;
    }
    if (p.type === "relocation") {
      const home = by(HOMES, p.target);
      if (
        s.location === home.district &&
        (id.startsWith("travel:") || id.startsWith("walk:") || id.startsWith("visit:"))
      )
        p.progress[0] = true;
      if (funds(s) >= home.rent + home.deposit + 300) p.progress[1] = true;
      if (s.housing.id === p.target && before.housing.id !== p.target) {
        p.progress[0] = true;
        p.progress[1] = true;
        p.progress[2] = true;
      }
    }
    if (p.type === "enterprise") {
      const b = s.deep.business;
      if (b?.id === p.target) {
        p.progress[0] = true;
        if (b.clients >= 3 && b.lastServiceDay) p.progress[1] = true;
        p.progress[2] = b.revenue - b.costs >= 2000 && b.arrears === 0;
      }
    }
    if (p.type === "relationship") {
      if (/^(talk:|date:|mentor:|calendar:meeting:)/.test(id) && id.endsWith(`:${p.target}`))
        p.progress[0] = true;
      const kept = s.deep.promises.some(
        (x) =>
          x.npcId === p.target &&
          x.direction === "player" &&
          x.status === "kept" &&
          before.deep.promises.find((y) => y.id === x.id)?.status === "pending",
      );
      const meeting = s.calendar.entries.some(
        (x) =>
          x.npcId === p.target &&
          x.status === "completed" &&
          before.calendar.entries.find((y) => y.id === x.id)?.status !== "completed",
      );
      if (kept || meeting) p.progress[1] = true;
      p.progress[2] = s.npcs[p.target].trust >= 55 && s.npcs[p.target].affinity >= 45;
    }
    if (p.progress.every(Boolean)) {
      p.status = "complete";
      if (p.type === "qualification") s.deep.career.reputation = cap(s.deep.career.reputation + 5);
      if (p.type === "enterprise" && s.deep.business)
        s.deep.business.reputation = cap(s.deep.business.reputation + 8);
      if (p.type === "relationship")
        s.deep.npcs[p.target].respect = cap(s.deep.npcs[p.target].respect + 5);
      if (p.type === "relocation")
        for (const n of NPCS.filter((n) => n.home === by(HOMES, p.target).district))
          s.npcs[n.id].affinity = cap(s.npcs[n.id].affinity + 3);
      api.document(
        s,
        p.id,
        by(PROJECT_TYPES, p.type).name,
        `${targetName(p.type, p.target)} hedefinin üç gerçek aşaması tamamlandı. Harcanan proje bütçesi ${p.spent} TL.`,
      );
      api.log(s, `${by(PROJECT_TYPES, p.type).name} tamamlandı; kalıcı sonuç uygulandı.`);
    }
  }
}
export function afterLivingAction(s, id, before, api, resolved) {
  if (!s.living) return;
  const b = s.deep.business,
    key = b ? `${b.id}:${b.openedDay}` : "";
  if (s.living.enterprise.instanceId !== key)
    s.living.enterprise = { instanceId: key, capital: 0, stock: 0, lastRestockAt: 0 };
  const contact = socialTarget(s, id);
  if (contact && /^(talk|call|date|mentor|deep:disclose):/.test(id))
    known(
      s,
      contact,
      "Görüşmede güncel işini ve yaşadığı semti anlattı.",
      api,
      s.location,
      `${name(contact)} ${id.startsWith("call:") ? "telefonda" : "yüz yüze"} anlattı`,
    );
  for (const entry of s.calendar.entries)
    if (
      entry.npcId &&
      entry.status === "completed" &&
      before.calendar.entries.find((x) => x.id === entry.id)?.status !== "completed"
    )
      known(
        s,
        entry.npcId,
        "Buluşmada güncel yaşam düzenini paylaştı.",
        api,
        s.location,
        `${name(entry.npcId)} buluşmada anlattı`,
      );
  updateProjects(s, id, before, api, resolved);
}
export function getLivingView(s) {
  if (!s.living) return null;
  const l = s.living,
    b = s.deep.business,
    m = businessMetrics(s);
  return {
    projects: [
      ...l.projects.map((p) => describeProject(s, p)),
      ...PROJECT_TYPES.filter(
        (t) => !l.projects.some((p) => p.type === t.id && p.status === "active"),
      ).map((t) => ({
        id: `available-${t.id}`,
        title: t.name,
        description: t.description,
        status: "available",
        progress: 0,
        total: 3,
        budget: t.budget,
        spent: 0,
        dueDay: day(s) + t.days,
        nextMilestone: t.milestones[0],
        consequences: t.consequences,
        actionIds: [],
      })),
    ],
    population: DISTRICTS.map((d) => ({
      district: d.id,
      name: d.name,
      ...l.markets[d.id],
      ...l.population.districts[d.id],
      summary: `Talep %${l.markets[d.id].demand}; ${l.markets[d.id].vacancies} konut fırsatı. ${l.population.districts[d.id].employed} çalışan, ${l.population.districts[d.id].jobseekers} iş arayan, ${l.population.districts[d.id].students} öğrenci ve ${l.population.districts[d.id].households} hane. Haftalık iş ve taşınma akışları talebi değiştirir.`,
    })),
    npcs: NPCS.map((n) => {
      const k = l.known[n.id],
        busy = getNpcPlan(s, n.id, s.time, s.time + 1)[0];
      return {
        id: n.id,
        name: n.name,
        knownHome: k.home,
        knownProfession: k.profession,
        availability: busy
          ? busy.kind === "work"
            ? "Çalışıyor; takvimden uygun saat seç."
            : busy.kind === "commute"
              ? "Yolda; geliş saatini bekle."
              : "Kendi planıyla meşgul."
          : "Görüşme için takvimden uygun saat seçebilirsin.",
        goalSummary: by(NPC_PROFILES, n.id).goal,
        observedChanges: k.changes.map(({ at, text, source }) => ({
          at,
          text: `${text} (${source})`,
        })),
        ties: Object.entries(k.links).map(([id, e]) => ({
          id,
          name: name(id),
          trust: e.trust,
          affinity: e.affinity,
          conflict: e.conflict,
        })),
        offers:
          s.deep.npcs[n.id].request && k.changes.some((c) => c.text.includes("destek"))
            ? ["Yakın çevresinden destek arıyor; konuşarak sor."]
            : [],
      };
    }),
    household: {
      assets: l.household.assets.map((id) => ({
        id,
        name: by(HOUSEHOLD_ASSETS, id).name,
        effect: by(HOUSEHOLD_ASSETS, id).description,
      })),
      maintenanceDue: Math.floor(l.household.maintainedUntil / DAY) + 1,
      summary:
        s.time < l.household.maintainedUntil
          ? "Bakımlı eşyalar yalnızca kendi ev semtinde fayda sağlar."
          : "Bakım süresi doldu; eşyalar duruyor, faydaları bakım yapılınca açılır.",
    },
    enterprise: {
      capital: l.enterprise.capital,
      stock: l.enterprise.stock,
      capacity: m.capacity,
      demand: m.demand,
      summary: b
        ? `Kasada ${l.enterprise.capital} TL; ${l.enterprise.stock} hizmetlik stok. Stok ve tanıtım kasadan, haftalık sabit gider kişisel hesaptan ödenir. Kâr garantisi yok.`
        : "İşletme kurulduğunda kasa, stok ve bölgesel talep birlikte izlenir.",
    },
    feed: l.feed.map((x) => ({ ...x })),
  };
}

const object = (x) =>
  x && typeof x === "object" && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const exact = (x, fields) =>
  object(x) && Object.keys(x).length === fields.length && fields.every((k) => Object.hasOwn(x, k));
const num = (x, min = 0, max = MAX) => Number.isSafeInteger(x) && x >= min && x <= max;
const str = (x, max = 400) => typeof x === "string" && x.length <= max;
const ids = (list) => list.map((x) => x.id),
  npcIds = ids(NPCS),
  districtIds = ids(DISTRICTS);
export function validateLiving(s) {
  try {
    const l = s.living;
    if (
      !exact(l, [
        "version",
        "initializedAt",
        "lastTickAt",
        "settledDay",
        "npcs",
        "graph",
        "known",
        "projects",
        "nextProject",
        "population",
        "household",
        "enterprise",
        "markets",
        "feed",
      ]) ||
      l.version !== 1 ||
      !num(l.initializedAt, 0, s.time) ||
      !num(l.lastTickAt, l.initializedAt, s.time) ||
      !num(l.settledDay, 1, day(s)) ||
      !num(l.nextProject, 1) ||
      !exact(l.npcs, npcIds) ||
      !exact(l.graph, npcIds) ||
      !exact(l.known, npcIds) ||
      !exact(l.markets, districtIds)
    )
      return false;
    for (const id of npcIds) {
      const n = l.npcs[id],
        g = l.graph[id],
        k = l.known[id];
      if (
        !exact(n, [
          "energy",
          "social",
          "nextDecisionAt",
          "decisionDay",
          "decisions",
          "serial",
          "lastFavorAt",
          "plan",
        ]) ||
        ![n.energy, n.social].every((x) => num(x, 0, 100)) ||
        !num(n.nextDecisionAt, s.time + 1, s.time + DAY) ||
        !num(n.decisionDay, 1, day(s)) ||
        !num(n.decisions, 0, 4) ||
        !num(n.serial) ||
        !num(n.lastFavorAt, 0, s.time) ||
        !Array.isArray(n.plan) ||
        n.plan.length > 16 ||
        !exact(
          g,
          npcIds.filter((x) => x !== id),
        )
      )
        return false;
      for (const p of n.plan)
        if (
          !exact(p, [
            "id",
            "kind",
            "start",
            "end",
            "location",
            "from",
            "to",
            "target",
            "cost",
            "wage",
            "status",
          ]) ||
          !str(p.id, 120) ||
          !["work", "sleep", "commute", "visit", ...ids(NPC_UTILITIES)].includes(p.kind) ||
          !num(p.start, 0, s.time + 2 * DAY) ||
          !num(p.end, Math.max(p.start + 1, s.time + 1), s.time + 3 * DAY) ||
          !districtIds.includes(p.location) ||
          !districtIds.includes(p.from) ||
          !districtIds.includes(p.to) ||
          !(p.target === "" || (npcIds.includes(p.target) && p.target !== id)) ||
          !num(p.cost) ||
          !num(p.wage) ||
          p.status !== "planned"
        )
          return false;
      if (new Set(n.plan.map((p) => p.id)).size !== n.plan.length) return false;
      const ordered = n.plan.slice().sort((a, b) => a.start - b.start || a.end - b.end);
      if (ordered.some((p, i) => i > 0 && p.start < ordered[i - 1].end)) return false;
      for (const e of Object.values(g))
        if (
          !exact(e, ["affinity", "trust", "conflict", "lastContactAt", "owed", "dueAt"]) ||
          ![e.affinity, e.trust, e.conflict].every(
            (x) => Number.isFinite(x) && x >= 0 && x <= 100,
          ) ||
          !num(e.lastContactAt, 0, s.time) ||
          !num(e.owed, 0, 300) ||
          !num(e.dueAt, 0, s.time + 7 * DAY)
        )
          return false;
      if (
        !exact(k, ["home", "profession", "lastSharedAt", "changes", "links"]) ||
        !districtIds.includes(k.home) ||
        !str(k.profession, 100) ||
        !num(k.lastSharedAt, 0, s.time) ||
        !Array.isArray(k.changes) ||
        k.changes.length > 10 ||
        !object(k.links) ||
        Object.keys(k.links).some((x) => !npcIds.includes(x) || x === id)
      )
        return false;
      for (const c of k.changes)
        if (
          !exact(c, ["at", "text", "source"]) ||
          !num(c.at, 0, s.time) ||
          !str(c.text) ||
          !str(c.source, 100)
        )
          return false;
      for (const e of Object.values(k.links))
        if (
          !exact(e, ["trust", "affinity", "conflict", "at"]) ||
          ![e.trust, e.affinity, e.conflict].every(
            (x) => Number.isFinite(x) && x >= 0 && x <= 100,
          ) ||
          !num(e.at, 0, s.time)
        )
          return false;
    }
    if (
      !Array.isArray(l.projects) ||
      l.projects.length > 24 ||
      new Set(l.projects.map((p) => projectKey(p.type, p.target))).size !== l.projects.length ||
      new Set(l.projects.map((p) => p.id)).size !== l.projects.length ||
      l.projects.filter((p) => p.status === "active").length > 4
    )
      return false;
    for (const p of l.projects)
      if (
        !exact(p, [
          "id",
          "type",
          "target",
          "status",
          "startedAt",
          "dueDay",
          "budget",
          "spent",
          "progress",
          "extended",
        ]) ||
        !/^project-\d+$/.test(p.id) ||
        !num(Number(p.id.slice(8)), 1, l.nextProject - 1) ||
        !ids(PROJECT_TYPES).includes(p.type) ||
        !targets(p.type).some((t) => t.id === p.target) ||
        !["active", "complete", "failed"].includes(p.status) ||
        !num(p.startedAt, l.initializedAt, s.time) ||
        !num(p.dueDay, Math.floor(p.startedAt / DAY) + 1, Math.floor(p.startedAt / DAY) + 181) ||
        !num(p.budget, 0, 30000) ||
        !num(p.spent, 0, p.budget) ||
        !Array.isArray(p.progress) ||
        p.progress.length !== 3 ||
        !p.progress.every((v) => typeof v === "boolean") ||
        (p.status === "complete" && !p.progress.every(Boolean)) ||
        typeof p.extended !== "boolean"
      )
        return false;
    if (
      !exact(l.population, ["settledWeek", "districts"]) ||
      !num(l.population.settledWeek, 0, Math.floor((day(s) - 1) / 7)) ||
      !exact(l.population.districts, districtIds)
    )
      return false;
    let residents = 0,
      households = 0;
    for (const c of Object.values(l.population.districts)) {
      if (
        !exact(c, ["employed", "jobseekers", "students", "households", "capacity"]) ||
        ![c.employed, c.jobseekers, c.students].every((v) => num(v, 0, 450)) ||
        !num(c.households, 1, c.capacity) ||
        !num(c.capacity, 100, 150)
      )
        return false;
      residents += c.employed + c.jobseekers + c.students;
      households += c.households;
    }
    if (
      residents + (s.version >= 4 ? s.life?.secondary?.length || 0 : 0) !== 450 ||
      households !== 240
    )
      return false;
    const h = l.household,
      e = l.enterprise;
    if (
      !exact(h, ["assets", "maintainedUntil", "lastLeaseAt"]) ||
      !Array.isArray(h.assets) ||
      h.assets.length > 3 ||
      new Set(h.assets).size !== h.assets.length ||
      !h.assets.every((x) => ids(HOUSEHOLD_ASSETS).includes(x)) ||
      !num(h.maintainedUntil, 0, s.time + 37 * DAY) ||
      !num(h.lastLeaseAt, 0, s.time) ||
      !exact(e, ["instanceId", "capital", "stock", "lastRestockAt"]) ||
      e.instanceId !==
        (s.deep.business ? `${s.deep.business.id}:${s.deep.business.openedDay}` : "") ||
      !num(e.capital) ||
      !num(e.stock, 0, 24) ||
      !num(e.lastRestockAt, 0, s.time) ||
      (!s.deep.business && (e.capital || e.stock || e.lastRestockAt))
    )
      return false;
    for (const m of Object.values(l.markets))
      if (
        !exact(m, ["demand", "activity", "vacancies"]) ||
        !num(m.demand, 0, 100) ||
        !num(m.activity, 0, 100) ||
        !num(m.vacancies, 0, 8)
      )
        return false;
    return (
      Array.isArray(l.feed) &&
      l.feed.length <= 32 &&
      l.feed.every(
        (f) =>
          exact(f, ["at", "text", "source"]) &&
          num(f.at, 0, s.time) &&
          str(f.text, 500) &&
          str(f.source, 100),
      )
    );
  } catch {
    return false;
  }
}
