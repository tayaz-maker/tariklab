import {
  initializeServices,
  serviceHours,
  serviceOpen,
  validateServices,
  servicesMinute,
} from "./services.ts";
import type { Business, Person, WorldState } from "../domain/types.ts";
import type {
  EconomyState,
  EconomyView,
  EconomicShock,
  ShockKind,
} from "../domain/economy-types.ts";
import { ITEMS } from "../domain/content.ts";
import { BUILDINGS, findPath, isWalkable } from "../domain/world.ts";
import { draw, clamp } from "./random.ts";
import { transfer } from "./ledger.ts";
import { emit } from "./events.ts";
const DAY = 1440,
  MAX_ATTENDANCE = 480;
const resources: Record<string, string> = {
  simit: "grain",
  tea: "herbs",
  meal: "produce",
  medicine: "medical",
  parts: "metal",
  book: "paper",
};
const key = (personId: string, businessId: string) => personId + "|" + businessId;
const caches = new WeakMap<WorldState, { count: number; people: Map<string, Person> }>();
function people(s: WorldState) {
  let cache = caches.get(s);
  if (!cache || cache.count !== s.npcs.length) {
    cache = { count: s.npcs.length, people: new Map(s.npcs.map((n) => [n.id, n])) };
    caches.set(s, cache);
  }
  return cache.people;
}
export function initializeEconomy(s: WorldState): EconomyState {
  if (!Object.hasOwn(s.accounts, "wholesaler")) {
    s.accounts.wholesaler = 0;
    s.ledgerCheckpoint.balances.wholesaler = 0;
  }
  return {
    version: 1,
    services: initializeServices(s),
    attendance: {},
    activeWork: {},
    travel: {},
    arrivals: [],
    arrivalSortNeeded: false,
    inputs: Object.fromEntries(
      s.businesses.map((b) => [
        b.id,
        Object.fromEntries(Object.values(resources).map((x) => [x, 0])),
      ]),
    ),
    wholesaler: Object.fromEntries(
      Object.values(resources).map((x) => [x, x === "grain" ? 10000000 : 1000000]),
    ),
    produced: {},
    consumedInputs: {},
    tax: s.businesses.map((b) => ({
      businessId: b.id,
      salesAssessed: b.sales,
      paid: 0,
      arrears: 0,
    })),
    shocks: [],
    cooldowns: {},
    eventCursor: s.events.length,
    lastDailyAt: Math.floor(s.minute / DAY) * DAY,
    lastPayroll: [],
    lastDemand: {},
  };
}
function finish(s: WorldState, r: { minutes: number; since: number | null }) {
  if (r.since !== null) {
    r.minutes = Math.min(MAX_ATTENDANCE, r.minutes + Math.max(0, s.minute - r.since));
    r.since = null;
  }
}
function attendance(s: WorldState, n: Person) {
  const e = s.economy,
    business = s.businesses.find((b) => b.id === n.employerId),
    working =
      n.alive &&
      n.age >= 18 &&
      n.goal === "work" &&
      business?.status !== "closed" &&
      n.location.scene === business?.buildingId;
  const previous = e.activeWork[n.id];
  if (previous && (!working || e.attendance[previous]?.businessId !== n.employerId)) {
    if (e.attendance[previous]) finish(s, e.attendance[previous]);
    delete e.activeWork[n.id];
  }
  if (!business) return;
  const id = key(n.id, business.id);
  let r = e.attendance[id];
  if (working) {
    r ??= e.attendance[id] = {
      personId: n.id,
      businessId: business.id,
      minutes: 0,
      since: null,
      day: Math.floor(s.minute / DAY),
    };
    if (r.since === null) r.since = s.minute;
    e.activeWork[n.id] = id;
  } else if (r) finish(s, r);
}
export function scheduleBackgroundTravel(
  s: WorldState,
  n: Person,
  plan: { goal: string; building: string },
  index: number,
): void {
  const e = s.economy,
    current = e.travel[n.id];
  if (current?.to.scene === plan.building && current.goal === plan.goal) return;
  if (current) delete e.travel[n.id];
  if (n.location.scene === plan.building) {
    n.goal = plan.goal;
    attendance(s, n);
    return;
  }
  const target = BUILDINGS.find((b) => b.id === plan.building),
    origin = BUILDINGS.find((b) => b.id === n.location.scene);
  if (!target) return;
  const from = origin?.door ?? n.location,
    path = findPath(from, target.door);
  if (!path.length) {
    n.goal = "idle";
    return;
  }
  n.goal = "travel";
  attendance(s, n);
  let length = 0,
    point = from;
  for (const next of path) {
    length += Math.hypot(next.x - point.x, next.y - point.y);
    point = next;
  }
  const duration = Math.max(2, Math.ceil((length + 2) / 1.6)),
    id = `trip:${n.id}:${s.minute}`;
  const trip = {
    id,
    personId: n.id,
    from: { ...n.location },
    to: { x: 4 + (index % 5), y: 6 + (index % 3), scene: plan.building },
    goal: plan.goal,
    departedAt: s.minute,
    arrivalAt: s.minute + duration,
  };
  e.travel[n.id] = trip;
  e.arrivals.push({ personId: n.id, tripId: id, minute: trip.arrivalAt });
  e.arrivalSortNeeded = true;
  n.lastDecision = s.minute;
}
export function economyMinute(s: WorldState): void {
  servicesMinute(s);
  const e = s.economy;
  if (e.arrivalSortNeeded) {
    e.arrivals.sort((a, b) => a.minute - b.minute || a.personId.localeCompare(b.personId, "en"));
    e.arrivalSortNeeded = false;
  }
  let used = 0;
  while (used < e.arrivals.length && e.arrivals[used].minute <= s.minute) {
    const arrival = e.arrivals[used++],
      trip = e.travel[arrival.personId];
    if (!trip || trip.id !== arrival.tripId) continue;
    const n = people(s).get(trip.personId);
    delete e.travel[trip.personId];
    if (!n?.alive) continue;
    n.location = { ...trip.to };
    n.goal = trip.goal;
    attendance(s, n);
  }
  if (used) e.arrivals.splice(0, used);
  for (const n of s.npcs.slice(0, 100)) attendance(s, n);
  for (const shock of e.shocks)
    if (shock.status === "active" && s.minute >= shock.endsAt) shock.status = "ended";
  // A death or job change can terminate a background commitment before its planned arrival.
  for (const [id, trip] of Object.entries(e.travel)) {
    const n = people(s).get(id);
    if (!n?.alive) {
      delete e.travel[id];
      continue;
    }
    if (
      n.location.scene !== trip.from.scene ||
      Math.hypot(n.location.x - trip.from.x, n.location.y - trip.from.y) > 0.001
    )
      delete e.travel[id];
  }
}
export function closeAttendanceDay(s: WorldState): void {
  for (const r of Object.values(s.economy.attendance)) finish(s, r);
  s.economy.lastPayroll = [];
}
export function attendedWage(s: WorldState, n: Person, wage: number): number {
  const r = s.economy.attendance[key(n.id, n.employerId ?? "")],
    minutes = r?.minutes ?? 0,
    amount = Math.floor((wage * Math.min(MAX_ATTENDANCE, minutes)) / MAX_ATTENDANCE);
  s.economy.lastPayroll.push({ personId: n.id, businessId: n.employerId ?? "", minutes, amount });
  return amount;
}
export function recordSale(
  s: WorldState,
  businessId: string,
  item: string,
  quantity: number,
): void {
  const id = businessId + ":" + item;
  s.economy.lastDemand[id] = (s.economy.lastDemand[id] ?? 0) + quantity;
}
export function shockFactor(s: WorldState, businessId: string): number {
  return s.economy.shocks
    .filter((x) => x.status === "active" && (x.businessId === businessId || x.businessId === null))
    .reduce(
      (factor, x) =>
        factor * (x.kind === "strike" ? 1 - x.severity / 100 : x.kind === "public-works" ? 0.8 : 1),
      1,
    );
}
export function startShock(
  s: WorldState,
  kind: ShockKind,
  businessId: string | null,
  sourceEventId: string | null = null,
): EconomicShock | null {
  const e = s.economy,
    b = s.businesses.find((b) => b.id === businessId),
    idkey = kind + ":" + (businessId ?? "district");
  if (
    s.minute < (e.cooldowns[idkey] ?? 0) ||
    e.shocks.some((x) => x.status === "active" && x.kind === kind && x.businessId === businessId)
  )
    return null;
  if (kind === "strike" && (!b || b.status !== "distressed" || !b.employees.length)) return null;
  if (kind === "public-works" && (!b || b.status === "closed" || s.accounts.municipality < 5000))
    return null;
  if (kind === "bankruptcy" && b?.status !== "closed") return null;
  if (kind === "shortage" && (!b || Object.values(b.stock).every((q) => q >= 8))) return null;
  if (kind === "recession" && !s.businesses.some((x) => x.status === "distressed")) return null;
  if (
    (kind === "migration" || kind === "rent") &&
    !s.events.some(
      (x) =>
        x.id === sourceEventId &&
        x.kind === (kind === "migration" ? "household_moved" : "rent_rise"),
    )
  )
    return null;
  const budget = kind === "strike" || kind === "public-works" ? 5000 : 0,
    id = `shock:${s.nextId++}`;
  if (budget) {
    const recipient =
      kind === "strike"
        ? (b!.employees.find((id) => id !== "player") ?? "player")
        : "business:" + b!.id;
    if (
      !transfer(
        s,
        id,
        "municipality",
        recipient,
        budget,
        kind === "strike" ? "strike-subsistence" : "public-works-contract",
      )
    )
      return null;
  }
  const shock: EconomicShock = {
    id,
    kind,
    businessId,
    startedAt: s.minute,
    endsAt: s.minute + (kind === "bankruptcy" ? 7 : 2) * DAY,
    severity: kind === "strike" ? 50 : 20,
    budget,
    status: "active",
    sourceEventId,
  };
  e.shocks.push(shock);
  e.cooldowns[idkey] = s.minute + 14 * DAY;
  emit(
    s,
    "shock_" + kind,
    kind === "strike"
      ? "Ücret sıkıntısı greve dönüştü; gerçek üretim iki gün yarıya indi."
      : kind === "public-works"
        ? "Belediye bakım sözleşmesi finanse edildi; işyerinin üretimi iki gün %20 yavaşlar."
        : "Mahallenin ekonomik koşullarında ölçülen değişim kaydedildi.",
    b ? [b.ownerId] : [],
    businessId,
    "public",
    [],
    sourceEventId,
  );
  if (e.shocks.length > 64)
    e.shocks = e.shocks
      .filter((x) => x.status === "active")
      .concat(e.shocks.filter((x) => x.status === "ended").slice(-48));
  return shock;
}
export function produceBusiness(s: WorldState, b: Business): void {
  const e = s.economy,
    day = Math.floor(s.minute / DAY),
    worked = Object.values(e.attendance)
      .filter((x) => x.businessId === b.id)
      .reduce((n, x) => n + x.minutes, 0),
    labor = Math.min(
      1,
      worked / Math.max(1, b.employees.filter((id) => id !== "player").length * MAX_ATTENDANCE),
    );
  for (const item of Object.keys(b.stock).sort()) {
    const resource = resources[item];
    if (!resource || !ITEMS[item]) continue;
    const desired = Math.min(
      (item === "simit" ? 4500 : 1500) - b.stock[item],
      Math.floor(
        (item === "simit" ? 4800 : 25) *
          labor *
          shockFactor(s, b.id) *
          (s.mobility.weather.kind === "rain" ? 0.84 : 1),
      ),
    );
    if (desired <= 0) continue;
    const unitCost = Math.max(1, Math.floor(ITEMS[item].price * 0.22)),
      available = Math.min(
        desired,
        e.wholesaler[resource],
        Math.floor(s.accounts["business:" + b.id] / unitCost),
      );
    if (
      available > 0 &&
      transfer(
        s,
        `inputs:${day}:${b.id}:${item}`,
        "business:" + b.id,
        "wholesaler",
        available * unitCost,
        "production-inputs",
      )
    ) {
      e.wholesaler[resource] -= available;
      e.inputs[b.id][resource] += available;
    }
    const output = Math.min(desired, e.inputs[b.id][resource]);
    e.inputs[b.id][resource] -= output;
    b.stock[item] += output;
    e.produced[item] = (e.produced[item] ?? 0) + output;
    e.consumedInputs[resource] = (e.consumedInputs[resource] ?? 0) + output;
  }
  if (day % 7 === 0)
    for (const item of Object.keys(b.prices).sort()) {
      const demand = e.lastDemand[b.id + ":" + item] ?? 0,
        pressure = demand > Math.max(1, b.stock[item]) ? 2 : b.stock[item] > 1000 ? -2 : 0,
        weather = s.mobility.weather.kind === "rain" ? 1 : 0,
        delta = clamp(pressure + weather, -3, 3);
      b.prices[item] = Math.max(
        100,
        Math.min(100000, Math.round((b.prices[item] * (100 + delta)) / 100)),
      );
      e.lastDemand[b.id + ":" + item] = 0;
    }
}
/** A distressed employer with unsold output reduces one funded position, then the citizen can seek a new job. */
export function reconcileStaffing(s: WorldState): void {
  const day = Math.floor(s.minute / DAY);
  for (const b of s.businesses) {
    const demand = Object.entries(s.economy.lastDemand)
      .filter(([id]) => id.startsWith(b.id + ":"))
      .reduce((n, [, units]) => n + units, 0);
    if (
      b.status !== "distressed" ||
      b.employees.length <= 10 ||
      b.stock.simit < 500 ||
      demand >= b.employees.length ||
      s.flags[`staffing:${b.id}`] === day
    )
      continue;
    const candidates = b.employees
      .filter((id) => id !== "player" && id !== b.ownerId)
      .map((id) => people(s).get(id))
      .filter((p): p is Person => !!p && p.alive && p.age >= 18 && p.employerId === b.id);
    candidates.sort(
      (a, b) =>
        (s.economy.attendance[key(a.id, a.employerId!)]?.minutes ?? 0) -
          (s.economy.attendance[key(b.id, b.employerId!)]?.minutes ?? 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const person = candidates[0];
    if (!person) continue;
    b.employees = b.employees.filter((id) => id !== person.id);
    person.employerId = null;
    person.jobId = null;
    delete s.economy.activeWork[person.id];
    s.flags[`staffing:${b.id}`] = day;
    emit(
      s,
      "layoff",
      `${person.name}, satılamayan stok ve daralan talep nedeniyle yeni bir iş arıyor.`,
      [person.id, b.ownerId],
      b.id,
      "public",
    );
  }
}
export function economyDayEnd(s: WorldState): void {
  reconcileStaffing(s);
  const e = s.economy,
    day = Math.floor(s.minute / DAY);
  for (const tax of e.tax) {
    const b = s.businesses.find((b) => b.id === tax.businessId)!;
    const due = tax.arrears + Math.floor((Math.max(0, b.sales - tax.salesAssessed) * 2) / 100);
    let paid = Math.min(due, s.accounts["business:" + b.id]);
    if (
      paid &&
      transfer(
        s,
        `sales-tax:${day}:${b.id}`,
        "business:" + b.id,
        "municipality",
        paid,
        "business-sales-tax",
      )
    )
      tax.paid += paid;
    else paid = 0;
    tax.arrears = due - paid;
    tax.salesAssessed = b.sales;
  }
  for (const b of s.businesses) {
    if (b.status === "closed") startShock(s, "bankruptcy", b.id);
    else if (b.status === "distressed" && day % 5 === 0) startShock(s, "strike", b.id);
    if (Object.values(b.stock).some((x) => x < 8)) startShock(s, "shortage", b.id);
  }
  if (day % 10 === 0)
    startShock(s, "public-works", s.businesses[draw(s.seed, 915, day) % s.businesses.length].id);
  if (s.businesses.filter((b) => b.status === "distressed").length >= 2)
    startShock(s, "recession", null);
  for (; e.eventCursor < s.events.length; e.eventCursor++) {
    const event = s.events[e.eventCursor];
    if (event.kind === "household_moved") startShock(s, "migration", null, event.id);
    if (event.kind === "rent_rise") startShock(s, "rent", null, event.id);
  }
  e.attendance = {};
  e.activeWork = {};
  e.lastDailyAt = s.minute;
}
export function economyView(s: WorldState): EconomyView {
  const e = s.economy,
    adults = s.npcs.filter((n) => n.alive && n.age >= 18),
    tax = e.tax;
  return {
    services: s.businesses.map((b) => ({
      businessId: b.id,
      opens: serviceHours(b.id)[0],
      closes: serviceHours(b.id)[1],
      open: serviceOpen(s, b),
      waiting: e.services[b.id].queue.length,
    })),
    unemployment: Math.round(
      (adults.filter((n) => !n.jobId).length * 100) / Math.max(1, adults.length),
    ),
    averageWage: Math.round(s.businesses.reduce((n, b) => n + b.wage, 0) / s.businesses.length),
    priceIndex: Math.round(
      (s.businesses.reduce(
        (sum, b) =>
          sum +
          Object.entries(b.prices).reduce(
            (n, [item, price]) => n + price / (ITEMS[item]?.price ?? price),
            0,
          ) /
            Object.keys(b.prices).length,
        0,
      ) *
        100) /
        s.businesses.length,
    ),
    sales: s.businesses.reduce((n, b) => n + b.sales, 0),
    taxPaid: tax.reduce((n, t) => n + t.paid, 0),
    taxArrears: tax.reduce((n, t) => n + t.arrears, 0),
    traveling: Object.keys(e.travel).length,
    attendedMinutes: e.lastPayroll.reduce((n, p) => n + p.minutes, 0),
    shocks: e.shocks.filter((x) => x.status === "active").map((x) => ({ ...x })),
    wholesaleUnits: Object.values(e.wholesaler).reduce((a, b) => a + b, 0),
    producedUnits: Object.values(e.produced).reduce((a, b) => a + b, 0),
  };
}
export function validateEconomy(s: WorldState): string[] {
  const e = s.economy,
    errors: string[] = [];
  if (!e || e.version !== 1) return ["missing-economy"];
  errors.push(...validateServices(s));
  const people = new Map(s.npcs.map((n) => [n.id, n]));
  for (const r of Object.values(e.attendance)) {
    const n = people.get(r.personId);
    if (
      !n ||
      !Number.isInteger(r.minutes) ||
      r.minutes < 0 ||
      r.minutes > MAX_ATTENDANCE ||
      (r.since !== null && (!Number.isInteger(r.since) || r.since > s.minute)) ||
      !s.businesses.some((b) => b.id === r.businessId)
    )
      errors.push("invalid-attendance");
  }
  for (const [id, t] of Object.entries(e.travel)) {
    const n = people.get(id);
    if (
      !n?.alive ||
      n.local ||
      t.personId !== id ||
      t.arrivalAt <= s.minute ||
      t.departedAt > s.minute ||
      !isWalkable(t.from, t.from.scene) ||
      !isWalkable(t.to, t.to.scene) ||
      n.location.scene !== t.from.scene ||
      Math.hypot(n.location.x - t.from.x, n.location.y - t.from.y) > 0.001
    )
      errors.push("invalid-background-travel:" + id);
  }
  for (const records of [e.wholesaler, e.produced, e.consumedInputs, ...Object.values(e.inputs)])
    for (const n of Object.values(records))
      if (!Number.isSafeInteger(n) || n < 0) errors.push("invalid-production-stock");
  for (const [resource, initial] of Object.entries(
    Object.fromEntries(
      Object.values(resources).map((x) => [x, x === "grain" ? 10000000 : 1000000]),
    ),
  )) {
    const total =
      e.wholesaler[resource] +
      Object.values(e.inputs).reduce((n, inputs) => n + (inputs[resource] ?? 0), 0) +
      (e.consumedInputs[resource] ?? 0);
    if (total !== initial) errors.push("unbalanced-production-input:" + resource);
  }
  for (const t of e.tax)
    if (
      !s.businesses.some((b) => b.id === t.businessId) ||
      ![t.salesAssessed, t.paid, t.arrears].every((x) => Number.isSafeInteger(x) && x >= 0)
    )
      errors.push("invalid-tax");
  for (const shock of e.shocks)
    if (
      !Number.isInteger(shock.severity) ||
      shock.severity < 0 ||
      shock.severity > 100 ||
      shock.endsAt <= shock.startedAt ||
      shock.budget < 0 ||
      (shock.sourceEventId && !s.events.some((x) => x.id === shock.sourceEventId))
    )
      errors.push("invalid-shock");
  return errors;
}
