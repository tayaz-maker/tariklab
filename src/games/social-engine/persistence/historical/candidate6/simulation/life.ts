import type { Command, CommandResult, Household, Person, WorldState } from "../domain/types.ts";
import type {
  CourseDefinition,
  HouseholdBudget,
  Lease,
  LifeProperty,
  LifeState,
  LifeView,
  Partnership,
} from "../domain/life-types.ts";
import { BUILDINGS, hasLineOfSight } from "../domain/world.ts";
import { emit, adjustRelation, notify } from "./events.ts";
import { transfer } from "./ledger.ts";
import { clamp } from "./random.ts";
import {
  familyDefaults,
  birthEligibility,
  processBirth,
  assignGuardian,
  familyMinute,
  validateFamily,
} from "./family.ts";
export { initializeLifeV2, processBirth, processDeath, assignGuardian } from "./family.ts";
const DAY = 1440,
  WEEK = DAY * 7;
export const COURSES: CourseDefinition[] = [
  {
    id: "office-skills",
    name: "Ofis ve kooperatif işleri",
    fee: 5000,
    skill: "academic",
    minimumSkill: 0,
    requiredSessions: 3,
    sessionMinutes: 30,
    unlocks: ["office"],
  },
  {
    id: "pedagogy",
    name: "Yetişkin eğitimine giriş",
    fee: 9000,
    skill: "academic",
    minimumSkill: 15,
    requiredSessions: 3,
    sessionMinutes: 30,
    unlocks: ["teaching"],
  },
  {
    id: "technical-craft",
    name: "Atölye ustalık temelleri",
    fee: 7000,
    skill: "technical",
    minimumSkill: 0,
    requiredSessions: 3,
    sessionMinutes: 30,
    unlocks: [],
  },
];
const person = (s: WorldState, id: string): Person | undefined =>
  id === "player" ? s.player : s.npcs.find((n) => n.id === id);
const household = (s: WorldState, id = s.player.householdId): Household | undefined =>
  s.households.find((h) => h.id === id);
const budget = (s: WorldState, id: string): HouseholdBudget | undefined =>
  s.life.budgets.find((b) => b.householdId === id);
const property = (s: WorldState, id: string): LifeProperty | undefined =>
  s.life.properties.find((p) => p.id === id);
const lease = (s: WorldState, householdId: string): Lease | undefined =>
  s.life.leases.find((l) => l.householdId === householdId && l.status === "active");
const failed = (reason: string): CommandResult => ({ ok: false, reason, events: [] });
const success = (
  s: WorldState,
  kind: string,
  reason: string,
  actors = ["player"],
): CommandResult => {
  const event = emit(s, kind, reason, actors, null, "private");
  notify(s, reason);
  return { ok: true, reason, events: [event.id] };
};
const key = (a: Record<string, unknown>, name: string): string =>
  typeof a[name] === "string" ? (a[name] as string) : "";
const amount = (a: Record<string, unknown>): number | null =>
  Number.isSafeInteger(a.amount) && (a.amount as number) > 0 && (a.amount as number) <= 100_000_000
    ? (a.amount as number)
    : null;
function account(s: WorldState, id: string): void {
  if (!Object.hasOwn(s.accounts, id)) {
    s.accounts[id] = 0;
    s.ledgerCheckpoint.balances[id] = 0;
  }
}
function at(s: WorldState, buildings: string[]): boolean {
  const p = s.player.location;
  return buildings.some((id) => {
    const b = BUILDINGS.find((b) => b.id === id);
    return (
      b &&
      (p.scene === id ||
        (p.scene === "outside" &&
          Math.hypot(p.x - b.door.x, p.y - b.door.y) <= 1.8 &&
          hasLineOfSight(p, b.door)))
    );
  });
}
function nearby(s: WorldState, n: Person): boolean {
  const p = s.player.location;
  return (
    n.alive &&
    n.location.scene === p.scene &&
    Math.hypot(p.x - n.location.x, p.y - n.location.y) <= 1.8 &&
    hasLineOfSight(p, n.location, p.scene)
  );
}
function canMove(s: WorldState, p: LifeProperty, h: Household): boolean {
  return (
    h.members.length <= p.capacity &&
    (!p.occupantHouseholdId || p.occupantHouseholdId === h.id) &&
    (!p.reservation || p.reservation.expiresAt <= s.minute || p.reservation.householdId === h.id)
  );
}
function updateArrears(s: WorldState, h: Household): void {
  h.arrears = s.life.leases
    .filter((l) => l.householdId === h.id)
    .reduce((sum, l) => sum + l.arrears, 0);
}
function moveMembers(s: WorldState, h: Household, p: LifeProperty): void {
  const old = property(s, h.homeId);
  // Destination is verified/reserved before any canonical residence is released.
  p.occupantHouseholdId = h.id;
  p.reservation = null;
  h.homeId = p.id;
  h.rent = p.ownerId === h.members[0] || h.members.includes(p.ownerId) ? 0 : p.weeklyRent;
  for (const id of h.members) {
    const n = person(s, id);
    if (n) n.homeId = p.id;
  }
  if (old && old.id !== p.id && old.occupantHouseholdId === h.id) old.occupantHouseholdId = null;
}
function refundLease(s: WorldState, old: Lease, txId: string): void {
  const refundable = s.accounts[old.depositAccount] ?? 0;
  if (
    refundable > 0 &&
    !transfer(
      s,
      `life-refund:${txId}:${old.id}`,
      old.depositAccount,
      old.payerId,
      refundable,
      "lease-deposit-refund",
    )
  )
    throw new Error("Verified lease refund failed");
  old.status = "ended";
}
function enterLease(
  s: WorldState,
  h: Household,
  p: LifeProperty,
  payerId: string,
  txId: string,
): boolean {
  if (!canMove(s, p, h)) return false;
  const old = lease(s, h.id),
    refundable = old?.payerId === payerId ? (s.accounts[old.depositAccount] ?? 0) : 0;
  if (s.accounts[payerId] + refundable < p.weeklyRent) return false;
  if (old) refundLease(s, old, txId);
  const id = `lease:${s.nextId++}`,
    depositAccount = `deposit:${id}`;
  account(s, depositAccount);
  if (
    p.weeklyRent &&
    !transfer(s, `life-deposit:${txId}`, payerId, depositAccount, p.weeklyRent, "lease-deposit")
  )
    throw new Error("Verified lease deposit failed");
  s.life.leases.push({
    id,
    householdId: h.id,
    propertyId: p.id,
    payerId,
    landlordId: p.ownerId,
    rent: p.weeklyRent,
    deposit: p.weeklyRent,
    depositAccount,
    startsAt: s.minute,
    nextDueAt: Math.ceil((s.minute + WEEK) / DAY) * DAY,
    arrears: 0,
    status: "active",
  });
  moveMembers(s, h, p);
  updateArrears(s, h);
  return true;
}
function debitBudget(
  s: WorldState,
  b: HouseholdBudget,
  amount: number,
  to: string,
  txId: string,
  reason: string,
): void {
  if (!amount) return;
  const total = s.accounts[b.accountId];
  if (amount > total || !transfer(s, txId, b.accountId, to, amount, reason))
    throw new Error("Verified shared budget payment failed");
  const ids = Object.keys(b.shares).sort(),
    allocations = new Map<string, number>();
  let allocated = 0;
  for (const id of ids) {
    const value = Number((BigInt(amount) * BigInt(b.shares[id])) / BigInt(total));
    allocations.set(id, value);
    allocated += value;
  }
  let remainder = amount - allocated;
  for (const id of ids) {
    const value = allocations.get(id)!;
    const extra = Math.min(remainder, b.shares[id] - value);
    b.shares[id] -= value + extra;
    remainder -= extra;
  }
}
/** Initializes schema3 without moving people, changing existing balances or minting money. */
export function initializeLife(s: WorldState, options: { seedFamilies?: boolean } = {}): LifeState {
  s.flags.lifeRentMarketPrice ??= s.businesses.find((b) => b.id === "market")?.prices.simit ?? 1800;
  const life: LifeState = {
    ...familyDefaults(s),
    version: 2,
    properties: [],
    leases: [],
    budgets: [],
    parentage: {},
    consents: [],
    partnerships: [],
    enrollments: [],
    certificates: [],
    aidLastAt: {},
    archivedHouseholds: [],
    lastDailyAt: Math.floor(s.minute / DAY) * DAY,
  };
  // Business ownerId is authoritative in pre-lifecycle saves. Rebuild only those backreferences.
  const businesses = new Set(s.businesses.map((b) => b.id));
  for (const n of [s.player, ...s.npcs])
    n.propertyIds = n.propertyIds.filter((id) => !businesses.has(id));
  for (const business of s.businesses) {
    const owner = person(s, business.ownerId);
    if (owner) owner.propertyIds.push(business.id);
  }
  for (const [index, h] of s.households.entries()) {
    const home: LifeProperty = {
      id: h.homeId,
      name:
        h.id === s.player.householdId ? "Yuva · başlangıç dairesi" : `Yuva · daire ${index + 1}`,
      buildingId: "b-home",
      capacity: 4,
      ownerId: "landlord",
      askingPrice: 4_500_000,
      weeklyRent: h.rent,
      occupantHouseholdId: h.id,
      reservation: null,
    };
    if (life.properties.some((p) => p.id === home.id))
      throw new Error("Duplicate primary residence during migration");
    life.properties.push(home);
    const id = `lease:initial:${h.id}`,
      depositAccount = `deposit:${id}`;
    account(s, depositAccount);
    life.leases.push({
      id,
      householdId: h.id,
      propertyId: home.id,
      payerId: h.members[0],
      landlordId: home.ownerId,
      rent: h.rent,
      deposit: 0,
      depositAccount,
      startsAt: s.minute,
      nextDueAt: (Math.floor(s.minute / WEEK) + 1) * WEEK,
      arrears: h.arrears,
      status: "active",
    });
    const accountId = `household:${h.id}`;
    account(s, accountId);
    life.budgets.push({
      householdId: h.id,
      accountId,
      shares: Object.fromEntries(h.members.map((id) => [id, 0])),
    });
  }
  for (let index = 0; index < 12; index++)
    life.properties.push({
      id: `vacant-home-${index}`,
      name:
        index < 4
          ? `Yuva · ekonomik daire ${index + 1}`
          : index < 8
            ? `Yuva · aile dairesi ${index - 3}`
            : `Yuva · teras dairesi ${index - 7}`,
      buildingId: "b-home",
      capacity: index < 4 ? 2 : 4,
      ownerId: "landlord",
      askingPrice: index < 4 ? 2_500_000 : index < 8 ? 4_500_000 : 7_000_000,
      weeklyRent: index < 4 ? 25000 : index < 6 ? 30000 : index < 8 ? 45000 : 75000,
      occupantHouseholdId: null,
      reservation: null,
    });
  if (options.seedFamilies) {
    // Initial family history is generated only for a new world. Other households are unrelated flatmates.
    for (const [index, h] of s.households.entries()) {
      if (index % 4 !== 3 || h.members.includes("player") || h.members.length < 2) continue;
      const members = h.members
        .map((id) => person(s, id)!)
        .sort((a, b) => b.age - a.age || a.id.localeCompare(b.id));
      const [a, b] = members;
      if (a.age < 18 || b.age < 18) continue;
      const id = `family:initial:${h.id}`;
      life.partnerships.push({
        id,
        a: a.id,
        b: b.id,
        status: "married",
        startedAt: s.minute,
        marriedAt: s.minute,
        endedAt: null,
        previousHouseholdId: h.id,
        previousHomeId: h.homeId,
      });
      life.consents.push(
        {
          id: `${id}:a`,
          from: a.id,
          to: b.id,
          purpose: "marriage",
          accepted: true,
          minute: s.minute,
        },
        {
          id: `${id}:b`,
          from: b.id,
          to: a.id,
          purpose: "marriage",
          accepted: true,
          minute: s.minute,
        },
      );
      for (const child of members.slice(2)) {
        const parents = [a, b].filter((n) => n.age - child.age >= 18).map((n) => n.id);
        if (parents.length) life.parentage[child.id] = parents;
      }
    }
  }
  // Existing flags are not upgraded into new mutual consent or merged households.
  // They remain historical metadata; schema3 requires fresh explicit validated decisions.
  return life;
}
function currentPartnership(s: WorldState, id: string): Partnership | undefined {
  return s.life.partnerships.find(
    (p) => ["dating", "married"].includes(p.status) && (p.a === id || p.b === id),
  );
}
function related(s: WorldState, a: string, b: string): boolean {
  const ancestors = (id: string): Set<string> => {
    const found = new Set<string>(),
      queue = [id];
    while (queue.length) {
      const next = queue.pop()!;
      for (const parent of s.life.parentage[next] ?? [])
        if (!found.has(parent)) {
          found.add(parent);
          queue.push(parent);
        }
    }
    return found;
  };
  const one = ancestors(a),
    two = ancestors(b);
  return one.has(b) || two.has(a) || [...one].some((id) => two.has(id));
}
function mutualConsent(
  s: WorldState,
  npcId: string,
  purpose: "date" | "marriage" | "parenthood",
): void {
  s.life.consents.push(
    {
      id: `consent:${s.nextId++}`,
      from: "player",
      to: npcId,
      purpose,
      accepted: true,
      minute: s.minute,
    },
    {
      id: `consent:${s.nextId++}`,
      from: npcId,
      to: "player",
      purpose,
      accepted: true,
      minute: s.minute,
    },
  );
}
function movePerson(s: WorldState, n: Person, destination: Household, txId: string): void {
  const source = household(s, n.householdId)!;
  if (source.id === destination.id) return;
  const oldBudget = budget(s, source.id)!,
    newBudget = budget(s, destination.id)!;
  const share = oldBudget.shares[n.id] ?? 0;
  if (share) {
    if (
      !transfer(
        s,
        `household-join:${txId}`,
        oldBudget.accountId,
        newBudget.accountId,
        share,
        "household-share-transfer",
      )
    )
      throw new Error("Shared funds transfer failed");
    newBudget.shares[n.id] = (newBudget.shares[n.id] ?? 0) + share;
  } else newBudget.shares[n.id] ??= 0;
  delete oldBudget.shares[n.id];
  source.members = source.members.filter((id) => id !== n.id);
  destination.members.push(n.id);
  n.householdId = destination.id;
  n.homeId = destination.homeId;
  if (!source.members.length) {
    const old = lease(s, source.id);
    if (old) refundLease(s, old, txId);
    for (const contract of s.life.leases)
      if (contract.householdId === source.id) contract.householdId = destination.id;
    const home = property(s, source.homeId);
    if (home?.occupantHouseholdId === source.id) home.occupantHouseholdId = null;
    s.life.archivedHouseholds.push(source.id);
    s.households = s.households.filter((h) => h.id !== source.id);
    s.life.budgets = s.life.budgets.filter((b) => b.householdId !== source.id);
    updateArrears(s, destination);
  }
}
export function jobPrerequisite(s: WorldState, jobId: string): string | null {
  const course = COURSES.find((c) => c.unlocks.includes(jobId));
  return course &&
    !s.life.certificates.some((c) => c.personId === "player" && c.courseId === course.id)
    ? `${course.name} belgesi gerekiyor. Ufuk Akademi'de kayıt ve üç ders tamamla.`
    : null;
}
export function applyLifeCommand(s: WorldState, command: Command): CommandResult | null {
  const a = command.args,
    p = s.player,
    h = household(s),
    b = h && budget(s, h.id);
  const locationRequired = [
    "RESERVE_HOME",
    "LEASE_HOME",
    "PROPERTY_BUY",
    "HOUSEHOLD_DEPOSIT",
    "HOUSEHOLD_WITHDRAW",
    "PAY_RENT_ARREARS",
  ].includes(command.type);
  if (locationRequired && !at(s, ["b-home", "b-bank", "b-office"]))
    return failed("Konut ve ortak bütçe işlemleri için Yuva, kooperatif veya bankaya git.");
  switch (command.type) {
    case "RESERVE_HOME": {
      const target = property(s, key(a, "propertyId"));
      if (!target || !h || !canMove(s, target, h) || target.id === h.homeId)
        return failed("Daire dolu, ayrılmış, küçük veya zaten senin konutun.");
      for (const home of s.life.properties)
        if (home.reservation?.householdId === h.id) home.reservation = null;
      target.reservation = { householdId: h.id, expiresAt: s.minute + 180 };
      return success(
        s,
        "housing_reserved",
        `${target.name}, üç oyun saati hanen için ayrıldı. Depozito: ${target.weeklyRent / 100} TL.`,
      );
    }
    case "LEASE_HOME": {
      const target = property(s, key(a, "propertyId"));
      if (
        !target ||
        !h ||
        !canMove(s, target, h) ||
        target.id === h.homeId ||
        target.reservation?.householdId !== h.id ||
        target.reservation.expiresAt <= s.minute
      )
        return failed("Önce uygun boş daireyi ayırt; rezervasyon süresi dolmamış olmalı.");
      if (p.shift || s.life.enrollments.some((e) => e.activeUntil !== null))
        return failed("Vardiya veya ders sürerken taşınamazsın.");
      if (target.ownerId === "player") {
        const old = lease(s, h.id);
        if (old) refundLease(s, old, command.id);
        moveMembers(s, h, target);
      } else if (!enterLease(s, h, target, "player", command.id))
        return failed(
          "Kapasite veya iade sonrası depozito bütçesi uygun değil. Eski evin korundu.",
        );
      return success(
        s,
        "household_moved",
        `${target.name} yeni ana konutun. Eski depozito iade edildi; gecikmiş kira borcu korunuyor.`,
        [...h.members],
      );
    }
    case "PROPERTY_BUY": {
      if (
        s.life.estates.some(
          (e) => e.status === "settling" && e.assets.includes(key(a, "propertyId")),
        )
      )
        return failed("Bu mülkün tereke borçları henüz sonuçlanmadı.");
      const target = property(s, key(a, "propertyId"));
      if (
        !target ||
        !h ||
        target.ownerId === "player" ||
        (target.occupantHouseholdId && target.occupantHouseholdId !== h.id) ||
        (target.reservation &&
          target.reservation.expiresAt > s.minute &&
          target.reservation.householdId !== h.id)
      )
        return failed("Satışa uygun boş veya kendi kiraladığın bir daire seç.");
      if (s.accounts.player < target.askingPrice || !Object.hasOwn(s.accounts, target.ownerId))
        return failed("Satın alma bütçen yeterli değil.");
      const previousOwner = person(s, target.ownerId);
      if (
        !transfer(
          s,
          `property-buy:${command.id}`,
          "player",
          target.ownerId,
          target.askingPrice,
          "property-purchase",
        )
      )
        return failed("Tapu ödemesi doğrulanamadı.");
      if (previousOwner)
        previousOwner.propertyIds = previousOwner.propertyIds.filter((id) => id !== target.id);
      target.ownerId = "player";
      if (!p.propertyIds.includes(target.id)) p.propertyIds.push(target.id);
      if (target.occupantHouseholdId === h.id) {
        const old = lease(s, h.id);
        if (old) refundLease(s, old, command.id);
        h.rent = 0;
      }
      return success(
        s,
        "property_bought",
        `${target.name} tapusu alındı. Konutta oturuyorsan yeni kira işlemez; eski borç silinmez.`,
      );
    }
    case "HOUSEHOLD_DEPOSIT":
    case "HOUSEHOLD_WITHDRAW": {
      const value = amount(a);
      if (!value || !h || !b) return failed("Pozitif, tamsayı kuruş tutarı gerekli.");
      const deposit = command.type === "HOUSEHOLD_DEPOSIT";
      if (!deposit && (b.shares.player ?? 0) < value)
        return failed("Yalnızca kendi kullanılmamış ortak bütçe katkını çekebilirsin.");
      if (
        !transfer(
          s,
          `household:${command.id}`,
          deposit ? "player" : b.accountId,
          deposit ? b.accountId : "player",
          value,
          deposit ? "household-deposit" : "household-withdrawal",
        )
      )
        return failed("Yeterli bakiye yok.");
      b.shares.player = (b.shares.player ?? 0) + (deposit ? value : -value);
      return success(
        s,
        "household_budget",
        `${value / 100} TL ${deposit ? "ortak bütçeye yatırıldı" : "kişisel hesabına döndü"}.`,
      );
    }
    case "PAY_RENT_ARREARS": {
      const value = amount(a);
      if (!value || !h || value > h.arrears || s.accounts.player < value)
        return failed("Tutar borçtan veya bakiyenden fazla olamaz.");
      let remaining = value;
      for (const old of s.life.leases.filter((l) => l.householdId === h.id && l.arrears > 0)) {
        const paid = Math.min(remaining, old.arrears);
        if (
          !transfer(
            s,
            `rent-arrears:${command.id}:${old.id}`,
            "player",
            old.landlordId,
            paid,
            "rent-arrears",
          )
        )
          throw new Error("Verified arrears payment failed");
        old.arrears -= paid;
        remaining -= paid;
        if (!remaining) break;
      }
      updateArrears(s, h);
      return success(
        s,
        "rent_arrears_paid",
        `${value / 100} TL gecikmiş kira ödendi. Kalan: ${h.arrears / 100} TL.`,
      );
    }
    case "ASK_DATE":
    case "PROPOSE_MARRIAGE":
    case "SEPARATE": {
      const n = person(s, key(a, "npcId"));
      if (!n || n.id === "player" || n.age < 18 || p.age < 18 || !nearby(s, n))
        return failed("Yakınında yetişkin ve görüşebileceğin bir kişi olmalı.");
      const current = currentPartnership(s, "player"),
        other = currentPartnership(s, n.id),
        edge = s.relations.find((r) => r.from === n.id && r.to === "player");
      if (command.type === "ASK_DATE") {
        if (
          current ||
          other ||
          related(s, "player", n.id) ||
          !edge ||
          edge.trust < 30 ||
          edge.affection < 20 ||
          edge.fear >= 20 ||
          edge.resentment >= 30
        )
          return failed(
            "Karşılıklı rıza, güven ve yakınlık yok; mevcut bağ veya aile bağı da engel olabilir.",
          );
        mutualConsent(s, n.id, "date");
        s.life.partnerships.push({
          id: `partnership:${s.nextId++}`,
          a: "player",
          b: n.id,
          status: "dating",
          startedAt: s.minute,
          marriedAt: null,
          endedAt: null,
          previousHouseholdId: n.householdId,
          previousHomeId: n.homeId,
        });
        s.flags.partner = n.id;
        s.flags[`consent:${n.id}`] = true;
        adjustRelation(s, n.id, "player", 2, 8);
        return success(
          s,
          "partnership_started",
          `${n.name} buluşmayı kendi isteğiyle kabul etti.`,
          ["player", n.id],
        );
      }
      if (!current || current.b !== n.id) return failed("Bu kişiyle aktif ilişki kaydın yok.");
      if (command.type === "PROPOSE_MARRIAGE") {
        if (
          current.status !== "dating" ||
          !edge ||
          edge.trust < 60 ||
          edge.affection < 50 ||
          edge.fear >= 20 ||
          edge.resentment >= 30 ||
          related(s, "player", n.id)
        )
          return failed(
            "Evlilik için iki tarafın güncel rızası, yüksek güven ve yakınlık gerekiyor.",
          );
        const home = h && property(s, h.homeId);
        if (!h || !home || h.members.length + (n.householdId === h.id ? 0 : 1) > home.capacity)
          return failed("Ortak konutun kapasitesi yetmiyor. Önce daha geniş bir daire kirala.");
        mutualConsent(s, n.id, "marriage");
        current.status = "married";
        current.marriedAt = s.minute;
        movePerson(s, n, h, command.id);
        s.flags.spouse = n.id;
        return success(
          s,
          "households_joined",
          `${n.name} ile karşılıklı evlilik kararı aldınız. Aynı konut ve katkı paylı ortak bütçe artık hanenize bağlı.`,
          ["player", n.id],
        );
      }
      if (current.status === "married" && n.householdId === p.householdId) {
        const origin = household(s, current.previousHouseholdId),
          originHome = origin && property(s, origin.homeId);
        if (origin && originHome && origin.members.length < originHome.capacity)
          movePerson(s, n, origin, command.id);
        else if (h && b) {
          // A relationship can always end. Housing scarcity never forces continued consent.
          const share = b.shares[n.id] ?? 0;
          if (share) {
            if (
              !transfer(
                s,
                `separation:${command.id}`,
                b.accountId,
                n.id,
                share,
                "separation-share-return",
              )
            )
              throw new Error("Separation share refund failed");
            b.shares[n.id] = 0;
          }
        }
      }
      current.status = "separated";
      current.endedAt = s.minute;
      s.flags.partner = "";
      s.flags.spouse = "";
      s.flags[`consent:${n.id}`] = false;
      for (const consent of s.life.consents)
        if (
          (consent.from === n.id && consent.to === "player") ||
          (consent.from === "player" && consent.to === n.id)
        )
          consent.accepted = false;
      adjustRelation(s, n.id, "player", -5, -10);
      return success(
        s,
        "partnership_ended",
        `${n.name} ile ilişki sona erdi. Kişisel katkılar ve geçmiş borçlar korundu; uygun yer yoksa konut paylaşımı taşınana kadar sürer.`,
        ["player", n.id],
      );
    }
    case "REQUEST_CHILD": {
      const bond = currentPartnership(s, "player"),
        npc = bond && person(s, bond.b);
      if (!bond || bond.status !== "married" || !npc)
        return failed("Önce karşılıklı evlilik ve ortak konut gerekli.");
      const reason = birthEligibility(s, ["player", npc.id]);
      if (reason) return failed(reason);
      const relation = s.relations.find((r) => r.from === npc.id && r.to === "player");
      if (
        !relation ||
        relation.trust < 70 ||
        relation.affection < 60 ||
        relation.fear >= 20 ||
        relation.resentment >= 20
      )
        return failed("Eşinin aile kurmak için güncel, özgür rızası yok.");
      mutualConsent(s, npc.id, "parenthood");
      return processBirth(s, ["player", npc.id], command.id);
    }
    case "ASSIGN_GUARDIAN": {
      const childId = key(a, "childId"),
        guardianId = key(a, "guardianId");
      if (
        !(s.life.parentage[childId] ?? []).includes("player") &&
        !(s.life.guardians[childId] ?? []).includes("player")
      )
        return failed("Bu çocuğun yasal bakım sorumluluğu sende değil.");
      const guardian = person(s, guardianId),
        edge = s.relations.find((r) => r.from === guardianId && r.to === "player");
      if (
        guardianId !== "player" &&
        guardianId !== "municipality" &&
        (!guardian || !nearby(s, guardian) || !edge || edge.trust < 60)
      )
        return failed("Yetişkin vasi ile yüz yüze anlaşma ve yüksek güven gerekli.");
      if (guardianId === "municipality" && !at(s, ["b-security"]))
        return failed("Kurumsal bakım kararı için Mahalle Dayanışma’ya git.");
      return assignGuardian(s, childId, guardianId, command.id);
    }
    case "COURSE_ENROLL": {
      const course = COURSES.find((c) => c.id === key(a, "courseId"));
      if (!course || !at(s, ["b-school"])) return failed("Kurs kaydı için Ufuk Akademi’ye git.");
      if (
        s.life.enrollments.some(
          (e) => e.personId === "player" && e.courseId === course.id && e.status !== "cancelled",
        )
      )
        return failed("Bu kursa zaten kayıtlısın veya belgen var.");
      if ((p.skills[course.skill] ?? 0) < course.minimumSkill)
        return failed(`Bu kurs için ${course.skill} en az ${course.minimumSkill} olmalı.`);
      if (
        !transfer(
          s,
          `course-fee:${command.id}`,
          "player",
          "business:school",
          course.fee,
          "course-enrollment",
        )
      )
        return failed("Kurs ücretine bakiyen yetmiyor.");
      s.life.enrollments.push({
        id: `enrollment:${s.nextId++}`,
        personId: "player",
        courseId: course.id,
        status: "enrolled",
        enrolledAt: s.minute,
        attended: 0,
        missed: 0,
        nextSessionAt: s.minute,
        activeUntil: null,
        certificateId: null,
      });
      return success(
        s,
        "course_enrolled",
        `${course.name}: ${course.requiredSessions} gerçek katılım kaydı gerekiyor. Ücret ${course.fee / 100} TL; iptalde iade yok.`,
      );
    }
    case "COURSE_ATTEND": {
      const e = s.life.enrollments.find(
          (e) =>
            e.personId === "player" && e.courseId === key(a, "courseId") && e.status === "enrolled",
        ),
        course = e && COURSES.find((c) => c.id === e.courseId);
      if (!e || !course || !at(s, ["b-school"]) || p.location.scene !== "b-school")
        return failed("Kayıtlı kursun dersine akademinin içinde katıl.");
      if (
        p.shift ||
        p.vehicleId ||
        Number(s.flags.trainingUntil ?? 0) > s.minute ||
        s.life.enrollments.some((e) => e.activeUntil !== null) ||
        e.nextSessionAt > s.minute
      )
        return failed("Çakışan vardiya/ders var veya dersin tekrar saati gelmedi.");
      e.activeUntil = s.minute + course.sessionMinutes;
      p.path = [];
      p.destination = null;
      s.flags.moveX = 0;
      s.flags.moveY = 0;
      return success(
        s,
        "course_session_started",
        `${course.name}: ${course.sessionMinutes} oyun dakikası akademide kal. Ayrılırsan yoklama geçmez.`,
      );
    }
    case "COURSE_CANCEL": {
      const e = s.life.enrollments.find(
        (e) =>
          e.personId === "player" && e.courseId === key(a, "courseId") && e.status === "enrolled",
      );
      if (!e) return failed("İptal edilebilir kurs kaydı yok.");
      e.status = "cancelled";
      e.activeUntil = null;
      return success(
        s,
        "course_cancelled",
        "Kurs iptal edildi; tamamlanmamış dersler belgeye dönüşmedi.",
      );
    }
    case "REQUEST_AID": {
      if (!at(s, ["b-clinic", "b-security"]))
        return failed("Destek için klinik veya Mahalle Dayanışma’ya git.");
      const last = s.life.aidLastAt.player ?? -3 * DAY;
      if (
        s.minute < last + 3 * DAY ||
        s.accounts.player >= 5000 ||
        (p.jobId && p.health >= 40 && (h?.arrears ?? 0) <= 0)
      )
        return failed(
          "Destek düşük bakiye ve geçim/sağlık/kira güçlüğü için; üç günde bir alınabilir.",
        );
      if (!transfer(s, `aid:${command.id}`, "municipality", "player", 12000, "recovery-aid"))
        return failed("Dayanışma kasasında bugün yeterli kaynak yok.");
      s.life.aidLastAt.player = s.minute;
      p.health = Math.max(p.health, 35);
      return success(
        s,
        "recovery_aid",
        "Dayanışma kasasından 120 TL geçim desteği aldın. İş, eğitim ve iyileşme yolların açık.",
      );
    }
    default:
      return null;
  }
}
/** Called at integer game-minute boundaries; no wall-clock or RNG input. */
export function lifeMinute(s: WorldState): void {
  for (const home of s.life.properties)
    if (home.reservation && home.reservation.expiresAt <= s.minute) home.reservation = null;
  for (const e of s.life.enrollments) {
    if (e.status !== "enrolled" || e.activeUntil === null) continue;
    const actor = person(s, e.personId),
      course = COURSES.find((c) => c.id === e.courseId)!;
    if (
      !actor ||
      !actor.alive ||
      actor.location.scene !== "b-school" ||
      (e.personId === "player" && s.player.shift !== null)
    ) {
      e.missed++;
      e.activeUntil = null;
      e.nextSessionAt = s.minute + 30;
      if (e.personId === "player")
        notify(s, "Ders yarıda kaldı; yoklama yazılmadı. 30 dakika sonra tekrar katılabilirsin.");
    } else if (s.minute >= e.activeUntil) {
      e.attended++;
      e.activeUntil = null;
      e.nextSessionAt = s.minute + 10;
      actor.skills[course.skill] = clamp((actor.skills[course.skill] ?? 0) + 5);
      emit(
        s,
        "course_attended",
        `${actor.name}, ${course.name} dersine katıldı (${e.attended}/${course.requiredSessions}).`,
        [actor.id],
        null,
        "private",
      );
      if (e.attended >= course.requiredSessions) {
        e.status = "completed";
        e.certificateId = `certificate:${s.nextId++}`;
        s.life.certificates.push({
          id: e.certificateId,
          personId: actor.id,
          courseId: course.id,
          issuedAt: s.minute,
          enrollmentId: e.id,
        });
        const event = emit(
          s,
          "certificate_earned",
          `${actor.name}, ${course.name} belgesi aldı.`,
          [actor.id],
          null,
          "private",
        );
        if (actor.id === "player") notify(s, event.text);
      }
    }
  }
  if (s.minute % DAY !== 0 || s.life.lastDailyAt >= s.minute) return;
  s.life.lastDailyAt = s.minute;
  for (const current of s.life.leases) {
    if (current.status !== "active") continue;
    const h = household(s, current.householdId),
      home = property(s, current.propertyId);
    if (!h || !h.members.length || !home) continue;
    while (current.nextDueAt <= s.minute) {
      const due = current.nextDueAt,
        shared = budget(s, h.id),
        fromShared = Math.min(current.rent, shared ? s.accounts[shared.accountId] : 0),
        payerId = h.members[0];
      const landlord = current.landlordId;
      if (fromShared && shared)
        debitBudget(
          s,
          shared,
          fromShared,
          landlord,
          `shared-rent:${current.id}:${due}`,
          "shared-rent",
        );
      const fromPersonal = Math.min(current.rent - fromShared, s.accounts[payerId]);
      if (
        fromPersonal &&
        !transfer(s, `rent:${current.id}:${due}`, payerId, landlord, fromPersonal, "rent")
      )
        throw new Error("Verified rent transfer failed");
      const unpaid = current.rent - fromShared - fromPersonal;
      current.arrears += unpaid;
      current.nextDueAt += WEEK;
      const payer = person(s, payerId);
      if (payer) payer.expenses += fromPersonal;
      if (unpaid && h.members.includes("player"))
        notify(
          s,
          `Kiranın ${unpaid / 100} TL bölümü gecikti. Konut, ortak bütçe ve destek seçeneklerini değerlendirebilirsin.`,
        );
    }
    updateArrears(s, h);
  }
  if (s.minute % (30 * DAY) === 0) {
    const marketPrice = s.businesses.find((b) => b.id === "market")?.prices.simit ?? 1800;
    const previousPrice = Number(s.flags.lifeRentMarketPrice ?? 1800);
    const factor = Math.max(0.98, Math.min(1.02, marketPrice / Math.max(1, previousPrice)));
    let adjusted = 0;
    for (const home of s.life.properties)
      if (!home.occupantHouseholdId && !home.reservation) {
        const next = Math.min(100000, Math.max(1000, Math.round(home.weeklyRent * factor)));
        if (next !== home.weeklyRent) {
          home.weeklyRent = next;
          adjusted++;
        }
      }
    s.flags.lifeRentMarketPrice = marketPrice;
    if (adjusted)
      emit(
        s,
        factor > 1 ? "rent_rise" : "housing_review",
        `Aylık gıda fiyatı değişimi nedeniyle ${adjusted} boş dairenin istenen kirası güncellendi. Mevcut kira sözleşmeleri korundu.`,
        [],
        null,
        "public",
      );
  }
  // A limited real vacancy pool constrains autonomous moves; no invented destination IDs.
  for (const h of s.households) {
    if (!h.members.length || h.members.includes("player") || h.arrears <= h.rent * 4 || h.rent <= 0)
      continue;
    const target = s.life.properties
      .filter(
        (p) =>
          !p.occupantHouseholdId &&
          p.capacity >= h.members.length &&
          p.weeklyRent <= Math.floor(h.rent * 0.8) &&
          canMove(s, p, h),
      )
      .sort((a, b) => a.weeklyRent - b.weeklyRent || a.id.localeCompare(b.id))[0];
    if (target && enterLease(s, h, target, h.members[0], `npc-move:${h.id}:${s.minute}`))
      emit(
        s,
        "household_moved",
        `${person(s, h.members[0])!.name} ve hanesi bütçesine uygun bir daireye taşındı.`,
        [...h.members],
      );
  }
  familyMinute(s);
}
export function lifeView(s: WorldState): LifeView {
  const h = household(s)!,
    b = budget(s, h.id)!,
    home = property(s, h.homeId)!,
    active = currentPartnership(s, "player"),
    last = s.life.aidLastAt.player ?? -3 * DAY;
  return {
    children: s.npcs
      .filter(
        (n) =>
          n.alive &&
          n.age < 18 &&
          ((s.life.parentage[n.id] ?? []).includes("player") ||
            (s.life.guardians[n.id] ?? []).includes("player") ||
            n.householdId === h.id),
      )
      .map((n) => ({
        id: n.id,
        name: n.name,
        age: n.age,
        guardianNames: (s.life.guardians[n.id] ?? []).map(
          (id) => person(s, id)?.name ?? "Mahalle çocuk bakım birimi",
        ),
      })),
    familyEvents: s.events
      .filter(
        (e) =>
          ["child_born", "citizen_died", "guardianship_assigned"].includes(e.kind) &&
          e.actors.includes("player"),
      )
      .slice(-5)
      .map((e) => e.text),
    estates: s.life.estates
      .filter((e) => e.heirIds.includes("player") || e.executorId === "player")
      .map((e) => ({
        id: e.id,
        personName: person(s, e.personId)?.name ?? e.personId,
        status: e.status,
        receivedCash: e.distributions.find((d) => d.recipient === "player")?.amount ?? 0,
        assetIds: [...(e.distributions.find((d) => d.recipient === "player")?.assetIds ?? [])],
      })),
    birthsRemaining: s.life.demography.maxBirths - s.life.births.length,
    canRequestChild:
      !!active && active.status === "married" && birthEligibility(s, ["player", active.b]) === null,
    properties: s.life.properties
      .filter(
        (p) => p.occupantHouseholdId === h.id || !p.occupantHouseholdId || p.ownerId === "player",
      )
      .map((p) => ({ ...p, reservation: p.reservation ? { ...p.reservation } : null })),
    household: {
      id: h.id,
      homeId: h.homeId,
      homeName: home.name,
      memberNames: h.members.map((id) => person(s, id)?.name ?? id),
      funds: s.accounts[b.accountId],
      ownContribution: b.shares.player ?? 0,
      rent: h.rent,
      arrears: h.arrears,
      nextDueAt: lease(s, h.id)?.nextDueAt ?? null,
    },
    partnership: active ? { ...active, partnerName: person(s, active.b)?.name ?? active.b } : null,
    courses: COURSES.map((c) => ({
      ...c,
      unlocks: [...c.unlocks],
      enrollment: (() => {
        const e = [...s.life.enrollments]
          .reverse()
          .find((e) => e.personId === "player" && e.courseId === c.id);
        return e ? { ...e } : null;
      })(),
      certified: s.life.certificates.some(
        (cert) => cert.personId === "player" && cert.courseId === c.id,
      ),
    })),
    aidAvailableAt: last + 3 * DAY,
    eligibleForAid:
      s.minute >= last + 3 * DAY &&
      s.accounts.player < 5000 &&
      (!s.player.jobId || s.player.health < 40 || h.arrears > 0),
    certificateNames: s.life.certificates
      .filter((c) => c.personId === "player")
      .map((c) => COURSES.find((course) => course.id === c.courseId)?.name ?? c.courseId),
  };
}
/** Validates cross-references, one primary residence, ownership, escrow, shares and acyclic parentage. */
export function validateLife(s: WorldState): string[] {
  try {
    const l = s.life,
      errors: string[] = [];
    if (!l || l.version !== 2) return ["life-version"];
    const people = new Map([s.player, ...s.npcs].map((n) => [n.id, n])),
      households = new Map(s.households.map((h) => [h.id, h])),
      properties = new Map(l.properties.map((p) => [p.id, p]));
    const safe = (n: number) => Number.isSafeInteger(n) && n >= 0;
    if (properties.size !== l.properties.length) errors.push("life-duplicate-property");
    const activeHomes = new Set<string>(),
      memberships = new Set<string>();
    for (const h of s.households) {
      if (!h.members.length) {
        errors.push(`life-empty-household:${h.id}`);
        continue;
      }
      const p = properties.get(h.homeId);
      if (
        !p ||
        p.occupantHouseholdId !== h.id ||
        h.members.length > p.capacity ||
        activeHomes.has(h.homeId)
      )
        errors.push(`life-primary-home:${h.id}`);
      activeHomes.add(h.homeId);
      if (
        !safe(h.rent) ||
        !safe(h.arrears) ||
        h.arrears !==
          l.leases.filter((x) => x.householdId === h.id).reduce((sum, x) => sum + x.arrears, 0)
      )
        errors.push(`life-arrears:${h.id}`);
      for (const id of h.members) {
        const n = people.get(id);
        if (
          memberships.has(id) ||
          !n ||
          !n.alive ||
          n.householdId !== h.id ||
          n.homeId !== h.homeId
        )
          errors.push(`life-membership:${id}`);
        memberships.add(id);
      }
      const budgets = l.budgets.filter((b) => b.householdId === h.id);
      if (budgets.length !== 1) {
        errors.push(`life-budget-count:${h.id}`);
        continue;
      }
      const b = budgets[0];
      if (
        b.accountId !== `household:${h.id}` ||
        !safe(s.accounts[b.accountId]) ||
        Object.keys(b.shares).some((id) => !h.members.includes(id)) ||
        Object.values(b.shares).some((n) => !safe(n)) ||
        Object.values(b.shares).reduce((sum, n) => sum + n, 0) !== s.accounts[b.accountId]
      )
        errors.push(`life-budget:${h.id}`);
    }
    if (memberships.size !== [...people.values()].filter((p) => p.alive).length)
      errors.push("life-unhoused-person");
    for (const p of l.properties) {
      if (
        !Number.isSafeInteger(p.capacity) ||
        p.capacity < 1 ||
        p.capacity > 4 ||
        !safe(p.askingPrice) ||
        !safe(p.weeklyRent) ||
        !Object.hasOwn(s.accounts, p.ownerId) ||
        !BUILDINGS.some((b) => b.id === p.buildingId)
      )
        errors.push(`life-property:${p.id}`);
      if (p.occupantHouseholdId && households.get(p.occupantHouseholdId)?.homeId !== p.id)
        errors.push(`life-occupancy:${p.id}`);
      const owner = people.get(p.ownerId);
      if (owner && !owner.propertyIds.includes(p.id)) errors.push(`life-deed:${p.id}`);
      if (
        p.reservation &&
        (!households.has(p.reservation.householdId) ||
          !safe(p.reservation.expiresAt) ||
          (p.occupantHouseholdId && p.occupantHouseholdId !== p.reservation.householdId))
      )
        errors.push(`life-reservation:${p.id}`);
    }
    for (const n of people.values())
      for (const id of n.propertyIds) {
        const owned = properties.get(id);
        if (owned && owned.ownerId !== n.id) errors.push(`life-deed-backref:${n.id}:${id}`);
      }
    const leaseIds = new Set<string>(),
      activeLeases = new Set<string>();
    for (const lease of l.leases) {
      if (
        leaseIds.has(lease.id) ||
        !properties.has(lease.propertyId) ||
        !people.has(lease.payerId) ||
        !Object.hasOwn(s.accounts, lease.landlordId) ||
        (!households.has(lease.householdId) && !l.archivedHouseholds.includes(lease.householdId)) ||
        ![lease.rent, lease.deposit, lease.startsAt, lease.nextDueAt, lease.arrears].every(safe) ||
        !["active", "ended"].includes(lease.status)
      )
        errors.push(`life-lease:${lease.id}`);
      leaseIds.add(lease.id);
      if (
        lease.depositAccount !== `deposit:${lease.id}` ||
        s.accounts[lease.depositAccount] !== (lease.status === "active" ? lease.deposit : 0)
      )
        errors.push(`life-deposit:${lease.id}`);
      if (lease.status === "active") {
        if (
          activeLeases.has(lease.householdId) ||
          households.get(lease.householdId)?.homeId !== lease.propertyId ||
          households.get(lease.householdId)?.rent !== lease.rent
        )
          errors.push(`life-active-lease:${lease.id}`);
        activeLeases.add(lease.householdId);
      }
    }
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) {
        errors.push("life-parentage-cycle");
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      const parents = l.parentage[id] ?? [];
      if (!people.has(id) || parents.length > 2 || new Set(parents).size !== parents.length)
        errors.push(`life-parentage:${id}`);
      for (const parent of parents) {
        const ancestor = people.get(parent),
          death = l.deaths.find((d) => d.personId === parent);
        const effectiveAge =
          (ancestor?.age ?? 0) +
          (death ? Math.floor(s.minute / (365 * DAY)) - Math.floor(death.minute / (365 * DAY)) : 0);
        if (!ancestor || effectiveAge - (people.get(id)?.age ?? 0) < 18)
          errors.push(`life-parent-age:${id}`);
        visit(parent);
      }
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of Object.keys(l.parentage)) visit(id);
    const partnered = new Set<string>(),
      partnershipIds = new Set<string>();
    for (const bond of l.partnerships) {
      if (partnershipIds.has(bond.id)) errors.push(`life-duplicate-partnership:${bond.id}`);
      partnershipIds.add(bond.id);
      if (
        !people.has(bond.a) ||
        !people.has(bond.b) ||
        bond.a === bond.b ||
        !["dating", "married", "separated", "widowed"].includes(bond.status)
      ) {
        errors.push(`life-partnership:${bond.id}`);
        continue;
      }
      if (["dating", "married"].includes(bond.status)) {
        if (
          partnered.has(bond.a) ||
          partnered.has(bond.b) ||
          people.get(bond.a)!.age < 18 ||
          people.get(bond.b)!.age < 18 ||
          related(s, bond.a, bond.b)
        )
          errors.push(`life-partner-eligibility:${bond.id}`);
        partnered.add(bond.a);
        partnered.add(bond.b);
        const purpose = bond.status === "married" ? "marriage" : "date";
        if (
          ![
            [bond.a, bond.b],
            [bond.b, bond.a],
          ].every(([from, to]) =>
            l.consents.some(
              (c) =>
                c.from === from &&
                c.to === to &&
                c.purpose === purpose &&
                c.accepted &&
                c.minute >= bond.startedAt,
            ),
          )
        )
          errors.push(`life-mutual-consent:${bond.id}`);
        if (
          bond.status === "married" &&
          people.get(bond.a)!.householdId !== people.get(bond.b)!.householdId
        )
          errors.push(`life-married-household:${bond.id}`);
      }
    }
    if (new Set(l.consents.map((c) => c.id)).size !== l.consents.length)
      errors.push("life-duplicate-consent");
    for (const c of l.consents)
      if (
        !people.has(c.from) ||
        !people.has(c.to) ||
        c.from === c.to ||
        !["date", "marriage", "parenthood"].includes(c.purpose) ||
        typeof c.accepted !== "boolean" ||
        !safe(c.minute)
      )
        errors.push(`life-consent:${c.id}`);
    const certificateIds = new Set<string>(),
      enrollmentIds = new Set<string>(),
      registeredCourses = new Set<string>(),
      earnedCourses = new Set<string>();
    for (const e of l.enrollments) {
      const course = COURSES.find((c) => c.id === e.courseId);
      if (
        enrollmentIds.has(e.id) ||
        !people.has(e.personId) ||
        !course ||
        !["enrolled", "completed", "cancelled"].includes(e.status) ||
        ![e.enrolledAt, e.attended, e.missed, e.nextSessionAt].every(safe) ||
        (e.activeUntil !== null && !safe(e.activeUntil)) ||
        e.attended > (course?.requiredSessions ?? 0)
      )
        errors.push(`life-enrollment:${e.id}`);
      enrollmentIds.add(e.id);
      if (e.status !== "enrolled" && e.activeUntil !== null)
        errors.push(`life-inactive-class:${e.id}`);
      if (e.status !== "cancelled") {
        const key = `${e.personId}:${e.courseId}`;
        if (registeredCourses.has(key)) errors.push(`life-duplicate-enrollment:${e.id}`);
        registeredCourses.add(key);
      }
      if (
        e.status === "completed" &&
        (e.attended !== course?.requiredSessions ||
          !l.certificates.some((c) => c.id === e.certificateId && c.enrollmentId === e.id))
      )
        errors.push(`life-unearned-certificate:${e.id}`);
    }
    for (const c of l.certificates) {
      const key = `${c.personId}:${c.courseId}`;
      if (earnedCourses.has(key)) errors.push(`life-duplicate-certificate:${c.id}`);
      earnedCourses.add(key);
      const e = l.enrollments.find((e) => e.id === c.enrollmentId);
      if (
        certificateIds.has(c.id) ||
        !e ||
        e.personId !== c.personId ||
        e.courseId !== c.courseId ||
        e.status !== "completed" ||
        e.certificateId !== c.id ||
        !safe(c.issuedAt)
      )
        errors.push(`life-certificate:${c.id}`);
      certificateIds.add(c.id);
    }
    if (l.enrollments.filter((e) => e.personId === "player" && e.activeUntil !== null).length > 1)
      errors.push("life-overlapping-classes");
    if (
      !safe(l.lastDailyAt) ||
      Object.entries(l.aidLastAt).some(([id, minute]) => !people.has(id) || !safe(minute))
    )
      errors.push("life-schedule");
    errors.push(...validateFamily(s));
    return errors;
  } catch (error) {
    return [`life-malformed:${error instanceof Error ? error.message : "unknown"}`];
  }
}
