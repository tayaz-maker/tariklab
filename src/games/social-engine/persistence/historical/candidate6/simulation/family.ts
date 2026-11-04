import type { CommandResult, Household, Person, WorldState } from "../domain/types.ts";
import type { EstateRecord, LifeState } from "../domain/life-types.ts";
import { transfer } from "./ledger.ts";
import { emit, notify } from "./events.ts";
import { draw, clamp } from "./random.ts";
import { reconcileProgression } from "./progression.ts";
import { reconcileSocialAfterDeath } from "./social.ts";
const DAY = 1440,
  YEAR = 365 * DAY;
const people = (s: WorldState): Person[] => [s.player, ...s.npcs];
const person = (s: WorldState, id: string) => people(s).find((n) => n.id === id);
const household = (s: WorldState, id: string) => s.households.find((h) => h.id === id);
const failed = (reason: string): CommandResult => ({ ok: false, reason, events: [] });
const zero = (s: WorldState, id: string) => {
  if (!Object.hasOwn(s.accounts, id)) {
    s.accounts[id] = 0;
    s.ledgerCheckpoint.balances[id] = 0;
  }
};
const paid = (
  s: WorldState,
  id: string,
  from: string,
  to: string,
  value: number,
  reason: string,
) => {
  if (value > 0 && !transfer(s, id, from, to, value, reason))
    throw new Error(`Verified family transfer failed: ${reason}`);
};
export function familyDefaults(
  s: WorldState,
): Pick<LifeState, "guardians" | "births" | "deaths" | "estates" | "demography"> {
  return {
    guardians: {},
    births: [],
    deaths: [],
    estates: [],
    demography: {
      initialPopulation: s.flags.benchmarkPopulation === 10000 ? 10000 : 1100,
      maxBirths: 24,
      lastDailyAt: Math.floor(s.minute / DAY) * DAY,
      lastAgingYear: Math.floor(s.minute / YEAR),
      parenthoodAt: {},
    },
  };
}
/** Pure schema3 life-v1 -> schema4 life-v2 augmentation; no fabricated births, deaths or money. */
export function initializeLifeV2(s: WorldState): LifeState {
  if (s.life.version === 2) return structuredClone(s.life);
  return { ...structuredClone(s.life), ...familyDefaults(s), version: 2 };
}
export function birthEligibility(s: WorldState, parentIds: [string, string]): string | null {
  const [a, b] = parentIds.map((id) => person(s, id));
  if (
    !a ||
    !b ||
    a.id === b.id ||
    !a.alive ||
    !b.alive ||
    a.age < 18 ||
    b.age < 18 ||
    a.age > 55 ||
    b.age > 55
  )
    return "Çocuk planı için iki yaşayan yetişkin ebeveyn gerekir (18–55).";
  if (
    a.householdId !== b.householdId ||
    !s.life.partnerships.some(
      (p) => p.status === "married" && [p.a, p.b].includes(a.id) && [p.a, p.b].includes(b.id),
    )
  )
    return "İki ebeveynin evlilik ve ortak konut kaydı gerekli.";
  const h = household(s, a.householdId),
    home = s.life.properties.find((p) => p.id === h?.homeId);
  if (!h || !home || h.members.length >= home.capacity)
    return "Çocuk için konutta boş kapasite gerekli.";
  if (s.life.births.length >= s.life.demography.maxBirths)
    return "Bu mahallenin yeni çocuk kapasitesi doldu.";
  if (parentIds.some((id) => s.minute - (s.life.demography.parenthoodAt[id] ?? -YEAR) < YEAR))
    return "Yeni aile planı için bir oyun yılı geçmeli.";
  return null;
}
/** Internal validated birth transition; caller must first record both current parenthood consents. */
export function processBirth(
  s: WorldState,
  parentIds: [string, string],
  txId: string,
): CommandResult {
  if (s.life.births.some((b) => b.id === txId)) return failed("Bu doğum daha önce kaydedildi.");
  const reason = birthEligibility(s, parentIds);
  if (reason) return failed(reason);
  if (
    !parentIds.every((from, i) =>
      s.life.consents.some(
        (c) =>
          c.from === from &&
          c.to === parentIds[1 - i] &&
          c.purpose === "parenthood" &&
          c.accepted &&
          c.minute === s.minute,
      ),
    )
  )
    return failed("İki ebeveynin güncel aile kurma rızası gerekli.");
  const a = person(s, parentIds[0])!,
    h = household(s, a.householdId)!,
    id = `born:${s.nextId++}`;
  const child: Person = {
    id,
    name: `Bebek ${s.life.births.length + 1}`,
    age: 0,
    local: false,
    location: { x: 7, y: 9, scene: "b-home" },
    destination: null,
    path: [],
    homeId: h.homeId,
    householdId: h.id,
    jobId: null,
    employerId: null,
    goal: "care",
    health: 100,
    stamina: 100,
    hunger: 0,
    fatigue: 0,
    debt: 0,
    income: 0,
    expenses: 0,
    propertyIds: [],
    skills: {
      driving: 0,
      combat: 0,
      communication: 0,
      technical: 0,
      trade: 0,
      academic: 0,
      body: 0,
      discipline: 0,
    },
    memories: [],
    wanted: 0,
    lastDecision: s.minute,
    appearance: a.appearance,
    alive: true,
  };
  s.npcs.push(child);
  zero(s, id);
  h.members.push(id);
  s.life.budgets.find((b) => b.householdId === h.id)!.shares[id] = 0;
  s.life.parentage[id] = [...parentIds];
  s.life.guardians[id] = [...parentIds];
  s.life.births.push({
    id: txId,
    childId: id,
    parentIds: [...parentIds],
    householdId: h.id,
    minute: s.minute,
  });
  for (const parent of parentIds) s.life.demography.parenthoodAt[parent] = s.minute;
  const event = emit(
    s,
    "child_born",
    `${child.name} haneye katıldı. Bakım ve konut sorumluluğu ebeveynlere bağlı.`,
    [...parentIds, id],
    id,
    "private",
  );
  if (parentIds.includes("player")) notify(s, event.text);
  return { ok: true, reason: event.text, events: [event.id] };
}
export function assignGuardian(
  s: WorldState,
  childId: string,
  guardianId: string,
  txId: string,
): CommandResult {
  if (s.flags[`guardianDecision:${txId}`] === true)
    return failed("Bu vasi kararı daha önce işlendi.");
  const child = person(s, childId),
    guardian = person(s, guardianId);
  if (
    !child?.alive ||
    child.age >= 18 ||
    (guardianId !== "municipality" &&
      (!guardian?.alive || guardian.age < 18 || guardian.id === childId))
  )
    return failed("Çocuk ve yaşayan yetişkin vasi kaydı gerekli.");
  // Care authority need not transfer primary residence. Occupancy never exceeds a household's capacity.
  s.life.guardians[childId] = [guardianId];
  const event = emit(
    s,
    "guardianship_assigned",
    `${child.name} için ${guardian?.name ?? "mahalle çocuk bakım birimi"} bakım sorumluluğunu üstlendi.`,
    [childId, ...(guardian ? [guardian.id] : [])],
    childId,
    "private",
  );
  s.flags[`guardianDecision:${txId}`] = true;
  return { ok: true, reason: event.text, events: [event.id] };
}
function rehomeEmpty(s: WorldState, h: Household): void {
  if (h.members.length) return;
  const home = s.life.properties.find((p) => p.id === h.homeId);
  if (home) home.occupantHouseholdId = null;
  for (const lease of s.life.leases.filter(
    (l) => l.householdId === h.id && l.status === "active",
  )) {
    paid(
      s,
      `empty-house:${lease.id}:${s.minute}`,
      lease.depositAccount,
      lease.payerId,
      s.accounts[lease.depositAccount],
      "estate-lease-refund",
    );
    lease.status = "ended";
  }
  for (const p of s.life.properties) if (p.reservation?.householdId === h.id) p.reservation = null;
  s.life.archivedHouseholds.push(h.id);
  s.households = s.households.filter((x) => x.id !== h.id);
  s.life.budgets = s.life.budgets.filter((b) => b.householdId !== h.id);
}
function ownerOf(s: WorldState, id: string): string | undefined {
  return (
    s.life.properties.find((p) => p.id === id)?.ownerId ??
    s.businesses.find((b) => b.id === id)?.ownerId
  );
}
function moveDeed(s: WorldState, id: string, to: string): void {
  const from = ownerOf(s, id);
  if (from === to) return;
  const old = from && person(s, from),
    next = person(s, to);
  if (!next?.alive || next.age < 18) throw new Error("Estate deed requires adult custodian");
  if (old) old.propertyIds = old.propertyIds.filter((p) => p !== id);
  if (!next.propertyIds.includes(id)) next.propertyIds.push(id);
  const property = s.life.properties.find((p) => p.id === id);
  if (property) property.ownerId = to;
  else s.businesses.find((b) => b.id === id)!.ownerId = to;
}
function estateHeirs(s: WorldState, n: Person): string[] {
  const spouse = s.life.partnerships.find(
    (p) => p.status === "married" && (p.a === n.id || p.b === n.id),
  );
  const children = Object.entries(s.life.parentage)
    .filter(([, parents]) => parents.includes(n.id))
    .map(([id]) => id);
  const family = [...(spouse ? [spouse.a === n.id ? spouse.b : spouse.a] : []), ...children].filter(
    (id) => person(s, id)?.alive,
  );
  return [
    ...new Set(
      family.length
        ? family
        : (household(s, n.householdId)?.members ?? []).filter(
            (id) => id !== n.id && person(s, id)?.alive,
          ),
    ),
  ].sort();
}
function executorFor(s: WorldState, heirs: string[], exclude: string): string {
  const choices = [
    ...heirs,
    ...s.npcs.filter((n) => n.alive && n.age >= 18 && n.age < 60).map((n) => n.id),
    "player",
  ];
  return choices.find(
    (id) => id !== exclude && person(s, id)?.alive && (person(s, id)?.age ?? 0) >= 18,
  )!;
}
function settleEstate(s: WorldState, e: EstateRecord): void {
  const n = person(s, e.personId)!;
  // New rent/receipts addressed to a preserved tombstone are swept into the same estate.
  paid(s, `estate-sweep:${e.id}:${s.minute}`, n.id, e.accountId, s.accounts[n.id], "estate-cash");
  let owed = e.debts.reduce((v, d) => v + d.amount - d.paid - d.writtenOff, 0);
  if (s.accounts[e.accountId] < owed) {
    for (const id of [...e.assets]) {
      const home = s.life.properties.find((p) => p.id === id),
        business = s.businesses.find((b) => b.id === id),
        price = home?.askingPrice ?? (business?.status === "distressed" ? 600000 : 1200000);
      const buyer = people(s)
        .filter((p) => p.alive && p.age >= 18 && p.id !== e.executorId && s.accounts[p.id] >= price)
        .sort((a, b) => s.accounts[b.id] - s.accounts[a.id] || a.id.localeCompare(b.id))[0];
      if (!buyer) continue;
      paid(
        s,
        `estate-sale:${e.id}:${id}`,
        buyer.id,
        e.accountId,
        price,
        "estate-asset-liquidation",
      );
      moveDeed(s, id, buyer.id);
      e.assets = e.assets.filter((asset) => asset !== id);
      if (s.accounts[e.accountId] >= owed) break;
    }
  }
  for (const debt of e.debts) {
    const amount = Math.min(debt.amount - debt.paid - debt.writtenOff, s.accounts[e.accountId]);
    if (amount) {
      paid(
        s,
        `estate-debt:${e.id}:${debt.kind}:${debt.leaseId ?? "bank"}:${s.minute}`,
        e.accountId,
        debt.creditor,
        amount,
        "estate-debt-payment",
      );
      debt.paid += amount;
    }
    if (debt.kind === "loan") {
      n.debt = debt.amount - debt.paid - debt.writtenOff;
      s.flags[`loanAsset:${n.id}`] = n.debt;
    } else {
      const lease = s.life.leases.find((l) => l.id === debt.leaseId)!;
      lease.arrears = debt.amount - debt.paid - debt.writtenOff;
    }
  }
  owed = e.debts.reduce((v, d) => v + d.amount - d.paid - d.writtenOff, 0);
  if (owed && e.assets.length) return; // No inheritance while collectible assets and debt remain.
  if (owed) {
    for (const debt of e.debts) {
      const loss = debt.amount - debt.paid - debt.writtenOff;
      debt.writtenOff += loss;
      s.flags[`estateWriteOff:${debt.creditor}`] =
        Number(s.flags[`estateWriteOff:${debt.creditor}`] ?? 0) + loss;
      if (debt.kind === "loan") {
        n.debt = 0;
        s.flags[`loanAsset:${n.id}`] = 0;
      } else s.life.leases.find((l) => l.id === debt.leaseId)!.arrears = 0;
    }
    emit(
      s,
      "estate_insolvent",
      `${n.name} terekesinde karşılanamayan borç, alacaklı kaybı olarak açıkça kaydedildi.`,
      [n.id],
      e.id,
      "private",
    );
  }
  const heirs = e.heirIds.filter((id) => person(s, id)?.alive),
    recipients = heirs.length ? heirs : ["municipality"];
  for (const id of [...e.assets]) {
    const beneficiary = recipients[Object.keys(e.assetBeneficiaries).length % recipients.length];
    const adult = person(s, beneficiary);
    const custodian =
      adult?.age && adult.age >= 18
        ? adult.id
        : ((s.life.guardians[beneficiary] ?? []).find(
            (id) => person(s, id)?.alive && (person(s, id)?.age ?? 0) >= 18,
          ) ?? e.executorId);
    moveDeed(s, id, custodian);
    e.assetBeneficiaries[id] = beneficiary;
    const home = s.life.properties.find((p) => p.id === id),
      residents = home?.occupantHouseholdId && household(s, home.occupantHouseholdId);
    if (residents && residents.members.includes(beneficiary)) {
      residents.rent = 0;
      for (const lease of s.life.leases.filter(
        (l) => l.householdId === residents.id && l.status === "active",
      )) {
        paid(
          s,
          `inherit-deposit:${e.id}:${lease.id}`,
          lease.depositAccount,
          lease.payerId,
          s.accounts[lease.depositAccount],
          "inherited-home-deposit-return",
        );
        lease.status = "ended";
      }
    }

    let record = e.distributions.find((d) => d.recipient === beneficiary);
    if (!record) {
      record = { recipient: beneficiary, amount: 0, assetIds: [] };
      e.distributions.push(record);
    }
    record.assetIds.push(id);
  }
  e.assets = [];
  const total = s.accounts[e.accountId];
  let remaining = total;
  recipients.forEach((id, index) => {
    const value =
      Math.floor(total / recipients.length) + (index < total % recipients.length ? 1 : 0);
    paid(s, `estate-inherit:${e.id}:${s.minute}:${id}`, e.accountId, id, value, "inheritance");
    remaining -= value;
    let d = e.distributions.find((d) => d.recipient === id);
    if (!d) {
      d = { recipient: id, amount: 0, assetIds: [] };
      e.distributions.push(d);
    }
    d.amount += value;
  });
  if (remaining !== 0) throw new Error("Estate split did not balance");
  e.status = heirs.length ? "settled" : "public-custody";
  e.settledAt = s.minute;
}
/** Internal event transition, never a UI kill command. The player retains the clinic recovery route. */
export function processDeath(
  s: WorldState,
  personId: string,
  txId: string,
  cause: "natural" | "validated" = "validated",
): CommandResult {
  const n = person(s, personId);
  if (
    !n ||
    personId === "player" ||
    !n.alive ||
    n.age < 18 ||
    s.life.deaths.some((d) => d.personId === personId || d.id === txId)
  )
    return failed("Bu yaşam kaydı ölüm geçişine uygun değil.");
  const heirs = estateHeirs(s, n),
    executorId = executorFor(s, heirs, n.id),
    h = household(s, n.householdId)!,
    b = s.life.budgets.find((b) => b.householdId === h.id)!;
  const entrusted = new Set(
    s.life.estates.flatMap((estate) => [
      ...estate.assets,
      ...Object.entries(estate.assetBeneficiaries)
        .filter(([, beneficiary]) => beneficiary !== n.id)
        .map(([id]) => id),
    ]),
  );
  const e: EstateRecord = {
    id: `estate:${s.nextId++}`,
    personId: n.id,
    accountId: `estate:${n.id}`,
    heirIds: heirs,
    openedAt: s.minute,
    settledAt: null,
    status: "settling",
    assets: n.propertyIds.filter((id) => !entrusted.has(id)),
    executorId,
    assetBeneficiaries: {},
    debts: n.debt
      ? [{ creditor: "bank", amount: n.debt, paid: 0, writtenOff: 0, kind: "loan" }]
      : [],
    distributions: [],
  };
  zero(s, e.accountId);
  for (const lease of s.life.leases.filter((l) => l.payerId === n.id)) {
    if (lease.arrears)
      e.debts.push({
        creditor: lease.landlordId,
        amount: lease.arrears,
        paid: 0,
        writtenOff: 0,
        kind: "rent",
        leaseId: lease.id,
      });
    paid(
      s,
      `estate-deposit:${e.id}:${lease.id}`,
      lease.depositAccount,
      e.accountId,
      s.accounts[lease.depositAccount],
      "estate-deposit-release",
    );
    lease.deposit = 0;
    if (lease.status === "active") {
      lease.status = "ended";
      if (h.members.some((id) => id !== n.id)) {
        const successor = `lease:${s.nextId++}`,
          depositAccount = `deposit:${successor}`;
        zero(s, depositAccount);
        s.life.leases.push({
          ...lease,
          id: successor,
          payerId: executorId,
          depositAccount,
          deposit: 0,
          arrears: 0,
          startsAt: s.minute,
          status: "active",
        });
      }
    }
  }
  paid(
    s,
    `estate-budget:${e.id}`,
    b.accountId,
    e.accountId,
    b.shares[n.id] ?? 0,
    "estate-budget-share",
  );
  delete b.shares[n.id];
  h.members = h.members.filter((id) => id !== n.id);
  n.alive = false;
  n.health = 0;
  n.stamina = 0;
  n.path = [];
  n.destination = null;
  n.goal = "deceased";
  n.jobId = null;
  n.employerId = null;
  n.wanted = 0;
  for (const business of s.businesses)
    business.employees = business.employees.filter((id) => id !== n.id);
  for (const v of s.vehicles)
    if (v.driverId === n.id) {
      v.driverId = null;
      v.speed = 0;
    }
  for (const id of e.assets) moveDeed(s, id, executorId);
  for (const pending of s.life.estates)
    if (pending.executorId === n.id) {
      pending.executorId = executorId;
      for (const id of [...pending.assets, ...Object.keys(pending.assetBeneficiaries)])
        if (ownerOf(s, id) === n.id) moveDeed(s, id, executorId);
    }
  for (const bond of s.life.partnerships)
    if ((bond.a === n.id || bond.b === n.id) && ["dating", "married"].includes(bond.status)) {
      bond.status = "widowed";
      bond.endedAt = s.minute;
    }
  for (const consent of s.life.consents)
    if (consent.from === n.id || consent.to === n.id) consent.accepted = false;
  if (s.flags.partner === n.id) {
    s.flags.partner = "";
    s.flags.spouse = "";
    s.flags[`consent:${n.id}`] = false;
  }
  for (const enrollment of s.life.enrollments)
    if (enrollment.personId === n.id && enrollment.status === "enrolled") {
      enrollment.status = "cancelled";
      enrollment.activeUntil = null;
    }
  for (const quest of s.quests)
    if (
      [quest.issuerId, quest.targetId].includes(n.id) &&
      ["offered", "active"].includes(quest.status)
    ) {
      quest.status = "failed";
      const escrow = `escrow:${quest.id}`;
      paid(
        s,
        `death-quest:${quest.id}`,
        escrow,
        "quests",
        s.accounts[escrow] ?? 0,
        "mission-participant-death",
      );
      if (s.player.inventory[`parcel:${quest.id}`]) {
        s.businesses.find((b) => b.id === "warehouse")!.stock.parts +=
          s.player.inventory[`parcel:${quest.id}`];
        delete s.player.inventory[`parcel:${quest.id}`];
      }
    }
  reconcileSocialAfterDeath(s, n.id);
  reconcileProgression(s, `death:${txId}`);
  for (const child of people(s).filter((p) => p.alive && p.age < 18)) {
    const guardians = (s.life.guardians[child.id] ?? []).filter(
      (id) => id === "municipality" || (person(s, id)?.alive && (person(s, id)?.age ?? 0) >= 18),
    );
    if (guardians.length) s.life.guardians[child.id] = guardians;
    else assignGuardian(s, child.id, "municipality", `death:${txId}:${child.id}`);
  }
  rehomeEmpty(s, h);
  s.life.estates.push(e);
  s.life.deaths.push({ id: txId, personId: n.id, minute: s.minute, cause });
  settleEstate(s, e);
  for (const home of s.households)
    home.arrears = s.life.leases
      .filter((l) => l.householdId === home.id)
      .reduce((v, l) => v + l.arrears, 0);
  const event = emit(
    s,
    "citizen_died",
    `${n.name} yaşamını yitirdi. Vesayet, sözleşmeler ve tereke kayıtları işlendi.`,
    [n.id, ...heirs],
    e.id,
    "private",
  );
  return { ok: true, reason: event.text, events: [event.id] };
}
export function familyMinute(s: WorldState): void {
  if (s.minute % DAY !== 0 || s.life.demography.lastDailyAt >= s.minute) return;
  s.life.demography.lastDailyAt = s.minute;
  const year = Math.floor(s.minute / YEAR),
    years = year - s.life.demography.lastAgingYear;
  for (const p of people(s))
    if (p.alive) {
      const birth = s.life.births.find((b) => b.childId === p.id);
      if (birth) p.age = Math.floor((s.minute - birth.minute) / YEAR);
      else if (years > 0) p.age += years;
      if (p.age >= 18) delete s.life.guardians[p.id];
    }
  if (years > 0) s.life.demography.lastAgingYear = year;
  for (const child of people(s).filter((p) => p.alive && p.age < 18)) {
    let guardians = (s.life.guardians[child.id] ?? []).filter(
      (id) => id === "municipality" || (person(s, id)?.alive && (person(s, id)?.age ?? 0) >= 18),
    );
    if (!guardians.length) {
      assignGuardian(s, child.id, "municipality", `care:${child.id}:${s.minute}`);
      guardians = ["municipality"];
    }
    const market = s.businesses.find((b) => b.id === "market")!,
      cost = market.prices.simit * 2,
      payer =
        guardians.find((id) => s.accounts[id] >= cost) ??
        (s.accounts.municipality >= cost ? "municipality" : undefined);
    if (payer && market.stock.simit >= 2) {
      paid(
        s,
        `child-care:${child.id}:${s.minute}`,
        payer,
        "business:market",
        cost,
        "dependent-food",
      );
      market.stock.simit -= 2;
      market.sales += cost;
      child.hunger = clamp(child.hunger - 65);
      child.health = clamp(child.health + 4);
    }
    child.fatigue = clamp(child.fatigue - 30);
  }
  for (const estate of s.life.estates)
    if (estate.status === "settling" || s.accounts[estate.personId] > 0) settleEstate(s, estate);
  for (const home of s.households)
    home.arrears = s.life.leases
      .filter((l) => l.householdId === home.id)
      .reduce((v, l) => v + l.arrears, 0);
  const day = Math.floor(s.minute / DAY);
  const elder = s.npcs.find(
    (n, i) => n.alive && n.age >= 65 && draw(s.seed, 81, day, i) % 100000 < 35,
  );
  if (elder) processDeath(s, elder.id, `natural:${day}:${elder.id}`, "natural");
  // At most one autonomous birth per month; population growth also has a persistent24-record cap.
  if (day % 30 === 0 && s.life.births.length < s.life.demography.maxBirths) {
    const bond = s.life.partnerships
      .filter((p) => p.status === "married" && p.a !== "player" && p.b !== "player")
      .find((p) => birthEligibility(s, [p.a, p.b]) === null);
    if (bond) {
      for (const [from, to] of [
        [bond.a, bond.b],
        [bond.b, bond.a],
      ])
        s.life.consents.push({
          id: `parenthood:${s.nextId++}`,
          from,
          to,
          purpose: "parenthood",
          accepted: true,
          minute: s.minute,
        });
      processBirth(s, [bond.a, bond.b], `birth:${day}:${bond.id}`);
    }
  }
}
export function validateFamily(s: WorldState): string[] {
  const errors: string[] = [],
    l = s.life,
    ids = new Set(people(s).map((p) => p.id)),
    safe = (n: number) => Number.isSafeInteger(n) && n >= 0;
  if (
    l.version !== 2 ||
    l.demography.initialPopulation !== (s.flags.benchmarkPopulation === 10000 ? 10000 : 1100) ||
    l.demography.maxBirths !== 24 ||
    l.births.length > 24 ||
    ![l.demography.lastDailyAt, l.demography.lastAgingYear].every(safe)
  )
    errors.push("family-demography");
  if (s.npcs.length !== l.demography.initialPopulation + l.births.length)
    errors.push("family-population-accounting");
  if (
    new Set(l.births.map((b) => b.childId)).size !== l.births.length ||
    new Set(l.births.map((b) => b.id)).size !== l.births.length
  )
    errors.push("family-duplicate-birth");
  for (const b of l.births)
    if (
      !ids.has(b.childId) ||
      !b.childId.startsWith("born:") ||
      b.parentIds.length !== 2 ||
      b.parentIds.some((id) => !ids.has(id)) ||
      !safe(b.minute) ||
      JSON.stringify(l.parentage[b.childId]) !== JSON.stringify(b.parentIds)
    )
      errors.push(`family-birth:${b.id}`);
  for (const p of people(s)) {
    if (!p.alive && !l.deaths.some((d) => d.personId === p.id))
      errors.push(`family-tombstone:${p.id}`);
    if (p.alive && p.age < 18) {
      const guardians = l.guardians[p.id];
      if (
        !guardians?.length ||
        guardians.some(
          (id) =>
            id !== "municipality" && (!person(s, id)?.alive || (person(s, id)?.age ?? 0) < 18),
        )
      )
        errors.push(`family-guardian:${p.id}`);
      if (p.jobId || p.employerId || p.wanted || s.vehicles.some((v) => v.driverId === p.id))
        errors.push(`family-child-adult-role:${p.id}`);
    }
  }
  for (const [id, guardians] of Object.entries(l.guardians))
    if (
      !person(s, id)?.alive ||
      (person(s, id)?.age ?? 18) >= 18 ||
      new Set(guardians).size !== guardians.length
    )
      errors.push(`family-guardian-ref:${id}`);
  if (
    new Set(l.deaths.map((d) => d.personId)).size !== l.deaths.length ||
    l.deaths.some(
      (d) =>
        !ids.has(d.personId) ||
        person(s, d.personId)?.alive ||
        !safe(d.minute) ||
        d.personId === "player",
    )
  )
    errors.push("family-death");
  for (const e of l.estates) {
    if (
      !l.deaths.some((d) => d.personId === e.personId) ||
      e.accountId !== `estate:${e.personId}` ||
      !Object.hasOwn(s.accounts, e.accountId) ||
      !person(s, e.executorId)?.alive ||
      (person(s, e.executorId)?.age ?? 0) < 18 ||
      e.heirIds.some((id) => !ids.has(id))
    )
      errors.push(`family-estate:${e.id}`);
    if (
      e.debts.some(
        (d) =>
          ![d.amount, d.paid, d.writtenOff].every(safe) ||
          d.paid + d.writtenOff > d.amount ||
          !Object.hasOwn(s.accounts, d.creditor),
      )
    )
      errors.push(`family-estate-debt:${e.id}`);
    if (
      e.status !== "settling" &&
      (e.assets.length ||
        e.debts.some((d) => d.paid + d.writtenOff !== d.amount) ||
        s.accounts[e.accountId] !== 0)
    )
      errors.push(`family-unsettled-inheritance:${e.id}`);
    if (
      e.assets.some((id) => ownerOf(s, id) !== e.executorId) ||
      e.distributions.some((d) => !Object.hasOwn(s.accounts, d.recipient) || !safe(d.amount))
    )
      errors.push(`family-estate-assets:${e.id}`);
  }
  return errors;
}
