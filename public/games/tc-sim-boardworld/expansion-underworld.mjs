// The optional v7 organization and criminal-case authority. Time comes from the
// ordinary resolver and day hook. Gold place, firms and household funds stay in
// their existing owners.
const DAY = 1440;
const MAX = 1_000_000_000;
const MAX_STOCK = 18;
const MAX_MEMBERSHIPS = 60;
const MAX_CASES = 32;
const SHRINK_AFTER = 60 * DAY;
const RESTRICTION_DAYS = 30;
const RESTITUTION = 120;
const FINE = 420;
const CREDIT_REASONS = /^(?:loan$|economy:(?:mortgage:|business-credit$))/;
const LICENSE_REASONS = /^(?:institution:accept$|district:apply$)/;
const CHAPTERS = [
  ["moda", "Moda Lojistik Birliği", "istanbul", "kadikoy", "Sarp Tunç", "Derya Kutlu", "Bilge Tan"],
  [
    "iskele",
    "İskele Hamalları Birliği",
    "istanbul",
    "besiktas",
    "Naz Esen",
    "Okan Eren",
    "İdil Kar",
  ],
  ["perpa", "Perpa Sevkiyat Ağı", "istanbul", "sisli", "Cihan Ata", "Melis Kurt", "Ali Ilgaz"],
  [
    "guven",
    "Güven Dağıtım Kooperatifi",
    "ankara",
    "ankara:kizilay",
    "Nil Göç",
    "Orhan Cem",
    "Cemre Say",
  ],
  [
    "seymen",
    "Seymen Tedarik Birliği",
    "ankara",
    "ankara:cankaya",
    "Gül Uras",
    "Efe İnce",
    "Selin Ulu",
  ],
  ["kemeralti", "Kemeraltı Kuryeleri", "izmir", "izmir:konak", "Yaşar Kır", "Selen Ak", "Pelin Öz"],
  ["ova", "Ova Depo Kooperatifi", "izmir", "izmir:bornova", "Ufuk Su", "Sevim Kor", "Mina Ilık"],
].map(([id, name, regionId, districtId, ...people], index) => ({
  id,
  name,
  regionId,
  districtId,
  people,
  index,
  workVenue: regionId === "istanbul" ? `${districtId}-work` : `${districtId}:work`,
  socialVenue: regionId === "istanbul" ? `${districtId}-cafe` : `${districtId}:social`,
  officeVenue: regionId === "istanbul" ? `${districtId}-academy` : `${districtId}:institution`,
}));
const catalog = new Map(CHAPTERS.map((chapter) => [chapter.id, chapter]));
const byDistrict = new Map(CHAPTERS.map((chapter) => [chapter.districtId, chapter]));
const rivals = CHAPTERS.flatMap((first) =>
  CHAPTERS.filter((second) => second.index > first.index && first.regionId === second.regionId).map(
    (second) => [first.id, second.id],
  ),
);
const pairId = (first, second) =>
  first.index < second.index ? `${first.id}:${second.id}` : `${second.id}:${first.id}`;
const person = (s, id = s.expansion.playerId) =>
  s.expansion.family.people.find((row) => row.id === id);
const alive = (s, id) => person(s, id)?.died === null;
const state = (s) => s.expansion?.underworld;
const dayOf = (time) => Math.floor(time / DAY) + 1;
const minuteOf = (time) => time % DAY;
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const membershipOf = (x, id) =>
  x?.memberships.find((row) => row.personId === id && row.leftAt === null);
const formerOf = (x, id, chapterId) =>
  x?.memberships.find((row) => row.personId === id && row.chapterId === chapterId);
const event = (s, api, subject, message) => {
  api.expansionEvent(s, "underworld", subject, message);
  api.log(s, message);
};
const staffId = (chapter, index, generation) => `${chapter.id}:staff:${index}:${generation}`;
const staffPeriod = (chapter, index) => 420 + chapter.index * 9 + index * 52;
const staffGeneration = (chapter, index, day) =>
  1 + Math.floor((day - 1) / staffPeriod(chapter, index));
const currentStaffId = (chapter, account, index) =>
  staffId(chapter, index, account.roster[index].generation);
const rostered = (row) => row.joinedDay !== null && row.leftDay === null;
function staffIdentity(chapter, id) {
  if (typeof id !== "string") return null;
  const [org, kind, slot, version, ...extra] = id.split(":");
  const index = Number(slot),
    generation = Number(version);
  if (
    extra.length ||
    org !== chapter.id ||
    kind !== "staff" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= chapter.people.length ||
    !Number.isInteger(generation) ||
    generation < 1 ||
    id !== staffId(chapter, index, generation)
  )
    return null;
  return {
    index,
    generation,
    name:
      generation === 1
        ? chapter.people[index]
        : `${["Deniz", "İpek", "Aren", "Ece", "Kaya"][generation % 5]} ${chapter.people[index].split(" ")[1]}`,
  };
}
const staffName = (chapter, id) => staffIdentity(chapter, id)?.name;
const taskOpen = (task) => task?.resolvedAt === null;
const funds = (s) => s.cash + s.bank;
const ledgerKeys = [
  "wholesale",
  "sales",
  "payroll",
  "alliedSpent",
  "alliedEarned",
  "stolenIn",
  "stolenOut",
  "restored",
  "liability",
  "purchased",
  "sold",
  "sharedOut",
  "sharedIn",
];

function makeState(lastDay) {
  return {
    lastDay,
    nextTask: 1,
    nextIncident: 1,
    chapters: Object.fromEntries(
      CHAPTERS.map((chapter) => [
        chapter.id,
        {
          treasury: 2100 + chapter.index * 90,
          stock: 6,
          influence: 0,
          heat: 0,
          readiness: 40,
          lastSupportDay: 0,
          leader: staffId(chapter, 0, staffGeneration(chapter, 0, lastDay)),
          roster: [72, 64, 0].map((loyalty, index) => ({
            loyalty,
            joinedDay: loyalty ? lastDay : null,
            leftDay: null,
            purse: 0,
            generation: staffGeneration(chapter, index, lastDay),
          })),
          ledger: Object.fromEntries(ledgerKeys.map((key) => [key, 0])),
        },
      ]),
    ),
    relations: Object.fromEntries(
      rivals.map(([first, second]) => [
        `${first}:${second}`,
        {
          standing: -24,
          lastTalkDay: 0,
          lastTradeDay: 0,
        },
      ]),
    ),
    offer: null,
    memberships: [],
    incidents: [],
    cases: [],
  };
}

function ensure(s) {
  return (s.expansion.underworld ??= makeState(dayOf(s.time)));
}

const TERMS = {
  sorting: { name: "Depo düzenleme", minutes: 50, reward: 100, rank: 0, stock: 0 },
  delivery: { name: "Kayıtlı sevkiyat", minutes: 65, reward: 145, rank: 0, stock: 1 },
  dispatch: { name: "Sevkiyat yönetimi", minutes: 90, reward: 210, rank: 1, stock: 2 },
};
const RANKS = ["Aday", "Üye", "Koordinatör", "Lider"];
const CASE_STATES = {
  unreported: "Kayıp kaydı, bildirim bekliyor",
  investigation: "Şüphe, soruşturma açık",
  review: "İnceleme ve duruşma",
  convicted: "Mahkûmiyet",
  acquitted: "Beraat",
};
const EVIDENCE_NAMES = { stock: "Depo sayım kaydı", witness: "Doğrudan tanık ifadesi" };
const CAPACITY_REASON = "Önce açık dosya veya üyelik kayıtları sonuçlanmalı.";
const MONEY_REASON = "Kayıtlı kaynaklar bu işlemi karşılamıyor.";
const WORK_REASON = "Örgütün iş yerine git ve işlemi açık saatlerde tamamla.";
const SOCIAL_REASON = "Örgütün buluşma yerine git ve görüşmeyi açık saatlerde tamamla.";
const OFFICE_REASON = "Dosya için ilgili semtin kamu hizmet noktasına açık saatlerde git.";
const TASK_REASON = "Önce açık görevi tamamla veya süresinin dolmasını bekle.";
const TRUST_REASON = "Daha fazla güven ve tamamlanmış görev gerekiyor.";
const RESTRICTION_REASON = "Kişisel yaptırım nedeniyle bu işlem geçici olarak kapalı.";
const CREDIT_REASON = "Mahkeme borcu veya yaptırımı kredi başvurusunu engelliyor.";
const PAYMENT_HOURS = "Ödeme için günün bitimine beş dakikadan fazla kalmalı.";
const PENDING = "İşlem için süre ayrıldı.";

function reservations(x, chapterId) {
  const member = x.memberships.find((m) => m.chapterId === chapterId && taskOpen(m.task));
  const task = member?.task && TERMS[member.task.kind];
  return { treasury: task?.reward ?? 0, stock: task?.stock ?? 0 };
}

function canTransferOrder(s, api, chapter, units) {
  if (!units) return null;
  // The first qualifying funded buyer in canonical order. The depot only ships
  // when the firm can buy the complete quantity at the current quoted price.
  return (
    [0, 1, 2]
      .map((index) => api.underworldOrder(s, chapter.regionId, index))
      .find((order) => order?.capacity >= units) ?? null
  );
}

function sell(s, api, chapter, account, units, order) {
  if (!order || units * order.price > MAX - account.treasury) return false;
  const paid = api.fulfillUnderworldOrder(s, order.firmId, units, order.price);
  if (!paid) return false;
  account.stock -= units;
  account.treasury += paid;
  account.ledger.sales += paid;
  account.ledger.sold += units;
  return true;
}

function payroll(s, api, account, cost, text) {
  account.treasury -= cost;
  account.ledger.payroll += cost;
  api.receive(s, cost, text, "bank");
}

function replaceLeader(x, chapter) {
  const account = x.chapters[chapter.id];
  const candidates = account.roster
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.joinedDay !== null && row.leftDay === null)
    .sort((a, b) => b.row.loyalty - a.row.loyalty || a.index - b.index);
  account.leader = currentStaffId(chapter, account, candidates[0].index);
}

function closeMembership(s, x, api, member, died) {
  const chapter = catalog.get(member.chapterId);
  if (taskOpen(member.task)) {
    member.task.status = "cancelled";
    member.task.resolvedAt = s.time;
  }
  member.leftAt = s.time;
  member.trust = clamp(member.trust - (died ? 0 : 12));
  if (x.chapters[chapter.id].leader === member.personId) replaceLeader(x, chapter);
  const subject = person(s, member.personId).name;
  if (died) event(s, api, subject, "Üyelik ölümle sona erdi.");
  else api.expansionEvent(s, "underworld", subject, "Örgüt üyeliği sona erdi.");
}

function closePersonalClaims(s, x) {
  for (const [index, row] of x.cases.entries()) {
    const incident = x.incidents[index];
    if (row.fineDue && !incident.offscreen && !alive(s, incident.personId)) {
      row.fineWaived += row.fineDue;
      row.fineDue = 0;
    }
  }
}

function reconcileDeaths(s, x, api) {
  const active = x.memberships.find((row) => row.leftAt === null);
  if (active && !alive(s, active.personId)) closeMembership(s, x, api, active, true);
  closePersonalClaims(s, x);
}

function canArchiveCase(s, x, row) {
  return (
    row.decidedAt !== null &&
    row.personalReserve === 0 &&
    (row.fineDue === 0 ||
      (x.incidents.find((incident) => incident.id === row.id).offscreen &&
        row.fineDue === row.fineArchived)) &&
    row.compensationDue === 0 &&
    (row.restrictionUntil === null || dayOf(s.time) > row.restrictionUntil) &&
    s.time >= row.decidedAt + SHRINK_AFTER
  );
}

function prune(s, x) {
  if (x.memberships.length >= MAX_MEMBERSHIPS) {
    const remove = x.memberships.findIndex(
      (m) => m.leftAt !== null && !alive(s, m.personId) && s.time >= m.leftAt + SHRINK_AFTER,
    );
    if (remove >= 0) x.memberships.splice(remove, 1);
  }
  if (x.cases.length >= MAX_CASES) {
    const remove = x.cases.findIndex((row) => canArchiveCase(s, x, row));
    if (remove >= 0) {
      const [{ id }] = x.cases.splice(remove, 1);
      x.incidents.splice(
        x.incidents.findIndex((incident) => incident.id === id),
        1,
      );
    }
  }
}

function staffOnDuty(account, chapter, time) {
  const day = dayOf(time);
  const minute = minuteOf(time);
  const clerk = account.roster[1];
  if (rostered(clerk) && (day - 1) % 7 < 5 && minute >= 540 && minute < 900)
    return currentStaffId(chapter, account, 1);
  // Some midnight cargo windows have a receiving supervisor on the dock.
  if (minute === 0 && (day + chapter.index) % 4 < 2 && rostered(account.roster[2]))
    return currentStaffId(chapter, account, 2);
  return null;
}

export function nextUnderworldAt(s) {
  const task = s.expansion && membershipOf(state(s), s.expansion.playerId)?.task;
  return taskOpen(task) ? task.dueAt + 1 : Infinity;
}

export function reconcileUnderworldTime(s, api) {
  const x = state(s);
  if (!x) return;
  const member = membershipOf(x, s.expansion.playerId);
  if (!member || !taskOpen(member.task) || member.task.dueAt >= s.time) return;
  member.task.resolvedAt = member.task.dueAt + 1;
  member.task.status = "missed";
  member.trust = clamp(member.trust - 12);
  event(s, api, person(s, member.personId).name, "Görevin süresi doldu; güven azaldı.");
}

function openCase(s, api, incident, row, automatic = true) {
  row.status = "investigation";
  row.reportedAt = s.time;
  row.reviewDay = dayOf(s.time) + 2;
  if (incident.personId === s.expansion.playerId) {
    const message = "Depo kaybı bildirildi; soruşturma açıldı.";
    if (automatic) event(s, api, person(s, incident.personId).name, message);
    else api.expansionEvent(s, "underworld", person(s, incident.personId).name, message);
  }
}

function decision(s, x, api, row, incident) {
  const chapter = catalog.get(incident.offenderChapterId);
  const subject = incident.offscreen
    ? staffIdentity(chapter, incident.personId)
    : person(s, incident.personId);
  const corroborated = incident.evidence.length === 2;
  row.status = corroborated ? "convicted" : "acquitted";
  row.decidedAt = s.time;
  row.reviewDay = null;
  if (corroborated) {
    row.restrictionUntil = dayOf(s.time) + RESTRICTION_DAYS;
    row.compensationDue = RESTITUTION;
    if (incident.offscreen || alive(s, incident.personId)) row.fineDue = FINE;
    else row.fineWaived = FINE;
    if (!incident.offscreen && subject.id === s.expansion.playerId && alive(s, subject.id)) {
      s.deep.career.reputation = clamp(s.deep.career.reputation - 18);
      api.change(s, { stress: 12 });
      for (const child of s.expansion.family.people)
        if (
          child.died === null &&
          child.parents.includes(subject.id) &&
          dayOf(s.time) - child.born < 18 * 30
        )
          child.care = clamp(child.care - 5);
      const member = membershipOf(x, subject.id);
      if (member) member.trust = clamp(member.trust - 10);
    }
  }
  if (!corroborated) row.personalReserve = 0; // Returned to the original worker.
  const verdict = corroborated
    ? "Mahkûmiyet kaydedildi; ceza, tazminat ve 30 günlük yaptırım uygulandı."
    : "Kimliği doğrulayan kanıt yetersiz; beraat kaydedildi.";
  if (incident.offscreen) {
    api.expansionEvent(s, "underworld", subject.name, verdict);
    api.log(s, `${subject.name} · ${verdict}`);
  } else event(s, api, subject.name, verdict);
}

function tickCases(s, x, api, today) {
  for (const row of x.cases) {
    const incident = x.incidents.find(({ id }) => id === row.id);
    if (row.status === "unreported" && today > dayOf(incident.at)) openCase(s, api, incident, row);
    else if (row.status === "investigation" && today >= row.reviewDay) {
      row.status = "review";
      row.reviewDay = today + 2;
      if (incident.personId === s.expansion.playerId)
        event(s, api, person(s).name, "Soruşturma tamamlandı; dosya karar için inceleniyor.");
    } else if (row.status === "review" && today >= row.reviewDay)
      decision(s, x, api, row, incident);
  }
}

function payStaffFine(s, api, region, row, available) {
  const amount = Math.min(row.fineDue, available);
  if (!amount) return 0;
  const accepted = api.creditMunicipalTax(s, region, amount);
  row.finePaid += accepted;
  row.fineDue -= accepted;
  return accepted;
}

function settleNpcCases(s, x, api) {
  for (const [index, row] of x.cases.entries()) {
    const incident = x.incidents[index];
    if (!incident.offscreen || row.status !== "convicted" || row.decidedAt === s.time) continue;
    const chapter = catalog.get(incident.offenderChapterId);
    const victim = catalog.get(incident.chapterId);
    const account = x.chapters[chapter.id];
    const receiving = x.chapters[victim.id];
    const identity = staffIdentity(chapter, incident.personId);
    const staff = account.roster[identity.index];
    if (staff.generation === identity.generation) {
      staff.purse -= payStaffFine(s, api, victim.regionId, row, staff.purse);
    } else {
      row.personalReserve -= payStaffFine(s, api, victim.regionId, row, row.personalReserve);
      // A historical personal balance remains attributed to the former runner.
      // It can enter bounded history after the proceedings, with no new payer.
      if (!row.personalReserve && row.fineDue && !row.fineArchived) {
        row.fineArchived = row.fineDue;
        const detail = "Ayrılan çalışanın ödenmemiş cezası kendi kaydında kaldı.";
        api.expansionEvent(s, "underworld", identity.name, detail);
        api.log(s, `${identity.name} · ${detail}`);
      }
    }
    const compensation = row.compensationDue;
    if (
      compensation &&
      account.treasury - reservations(x, chapter.id).treasury >= compensation &&
      receiving.treasury <= MAX - compensation
    ) {
      account.treasury -= compensation;
      account.ledger.liability += compensation;
      receiving.treasury += compensation;
      receiving.ledger.restored += compensation;
      row.compensationDue = 0;
      row.compensationPaid = compensation;
    }
  }
}

function reserveDepartingFines(s, x, api, chapter, actorId, staff) {
  for (const [index, row] of x.cases.entries()) {
    const incident = x.incidents[index];
    if (!incident.offscreen || incident.personId !== actorId) continue;
    staff.purse -= payStaffFine(s, api, chapter.regionId, row, staff.purse);
    if (row.decidedAt !== null && !row.fineDue) continue;
    const amount = Math.min(staff.purse, row.decidedAt === null ? FINE : row.fineDue);
    staff.purse -= amount;
    row.personalReserve += amount;
  }
}

function renewRoster(s, x, api, chapter, today) {
  const account = x.chapters[chapter.id];
  let leaderLeft = false;
  for (const [index, member] of account.roster.entries()) {
    const generation = staffGeneration(chapter, index, today);
    if (member.generation === generation) continue;
    const departingId = currentStaffId(chapter, account, index);
    leaderLeft ||= account.leader === departingId;
    reserveDepartingFines(s, x, api, chapter, departingId, member);
    // Retiring workers keep earnings above their personal case reserve.
    // The new staff member starts with a separate identity and zero wages.
    Object.assign(member, { generation, loyalty: 52, joinedDay: today, leftDay: null, purse: 0 });
  }
  if (leaderLeft) {
    replaceLeader(x, chapter);
    api.news(s, `${chapter.name} · Kadro değişikliği`);
  }
}

function runChapterDay(s, x, api, chapter, today) {
  const account = x.chapters[chapter.id];
  const reserve = reservations(x, chapter.id);
  const available = () => account.treasury - reserve.treasury;
  const district = api.getDistrictSimulation(s, chapter.districtId);
  const wholesale = 25 + ((district.materialStock ?? 0) < 6 ? 12 : 0);
  const staff = account.roster.filter((row) => row.joinedDay !== null && row.leftDay === null);
  const upkeep = 24 * staff.length;
  if (available() >= upkeep) {
    account.treasury -= upkeep;
    account.ledger.payroll += upkeep; // Named roster's wage and depot upkeep sink.
    for (const member of staff) {
      member.loyalty = clamp(member.loyalty + 1);
      member.purse = Math.min(MAX, member.purse + 24);
    }
  } else {
    account.readiness = clamp(account.readiness - 4);
    for (const member of staff) member.loyalty = clamp(member.loyalty - 8);
  }

  if (
    (today + chapter.index) % 9 === 0 &&
    account.roster[1].loyalty < 48 &&
    account.roster[2].leftDay === null &&
    account.roster[2].joinedDay === null &&
    available() >= 72
  )
    Object.assign(account.roster[2], { loyalty: 56, joinedDay: today });

  if ((today + chapter.index) % 11 === 0) {
    const leaderSlot = chapter.people.findIndex(
      (_, index) => currentStaffId(chapter, account, index) === account.leader,
    );
    const reserveStaff = account.roster[2];
    if (leaderSlot >= 0 && account.roster[leaderSlot].loyalty <= 28) {
      account.roster[leaderSlot].leftDay = today;
      if (account.roster.every((member) => member.joinedDay === null || member.leftDay !== null))
        Object.assign(reserveStaff, { loyalty: 50, joinedDay: today, leftDay: null });
      replaceLeader(x, chapter);
      api.news(s, `${chapter.name} · Kadro değişikliği`);
    } else if (reserveStaff.joinedDay === null && available() >= 250)
      Object.assign(reserveStaff, { loyalty: 52, joinedDay: today });
  }

  if (today % 7 !== 1 && account.stock < 8) {
    const units = Math.min(
      3,
      8 - account.stock,
      Math.max(0, Math.floor((available() - 80) / wholesale)),
    );
    // Independent wholesale supplier sells real depot units. No other ledger
    // represents these deliveries, and the chapter pays the supplier once.
    account.treasury -= units * wholesale;
    account.stock += units;
    account.ledger.wholesale += units * wholesale;
    account.ledger.purchased += units;
  }

  const units = Math.min(account.stock - reserve.stock, account.readiness >= 58 ? 2 : 1);
  const sold =
    units > 0 && sell(s, api, chapter, account, units, canTransferOrder(s, api, chapter, units));
  account.influence = clamp(account.influence + (sold ? 2 : -1));
  account.readiness = clamp(account.readiness + (sold ? 2 : -1));
  account.heat = clamp(account.heat - 1);
  return sold;
}

function tradeAllies(x, first, second, today) {
  const a = x.chapters[first.id],
    b = x.chapters[second.id];
  const [seller, buyer] = a.stock > b.stock ? [first, second] : [second, first];
  const source = x.chapters[seller.id],
    target = x.chapters[buyer.id];
  const sourceReserve = reservations(x, seller.id),
    targetReserve = reservations(x, buyer.id);
  if (
    source.stock - sourceReserve.stock <= target.stock + 1 ||
    target.stock >= MAX_STOCK ||
    target.treasury - targetReserve.treasury < 38 ||
    source.treasury > MAX - 38
  )
    return;
  source.stock--;
  target.stock++;
  target.treasury -= 38;
  source.treasury += 38;
  target.ledger.alliedSpent += 38;
  source.ledger.alliedEarned += 38;
  source.ledger.sharedOut++;
  target.ledger.sharedIn++;
  x.relations[pairId(first, second)].lastTradeDay = today;
}

function settleRelations(s, x, api, today, sales) {
  for (const [first, second] of rivals) {
    const left = catalog.get(first),
      right = catalog.get(second);
    const link = x.relations[pairId(left, right)];
    if (link.standing >= 30 && (today + left.index) % 3 === 0) tradeAllies(x, left, right, today);
    if ((today + right.index) % 7 !== 0) continue;
    const previous = link.standing;
    if (sales.has(first) !== sales.has(second)) link.standing = clamp(link.standing - 8, -100);
    else link.standing = clamp(link.standing + 4, -100);
    if (previous >= -45 && link.standing < -45) {
      for (const id of [first, second]) {
        const account = x.chapters[id];
        account.heat = clamp(account.heat + 9);
        account.readiness = clamp(account.readiness - 5);
        for (const member of account.roster)
          if (member.joinedDay !== null && member.leftDay === null)
            member.loyalty = clamp(member.loyalty - 8);
      }
      api.news(s, `${left.name} · ${right.name} · Tedarik anlaşmazlığı`);
    }
  }
}

export function tickUnderworld(s, api) {
  if (!s.expansion) return;
  const x = state(s) ?? (s.expansion.underworld = makeState(Math.max(1, api.dayOf(s) - 1)));
  reconcileDeaths(s, x, api);
  const today = api.dayOf(s);
  if (x.lastDay >= today) return;
  x.lastDay = today;
  if (x.offer?.until < s.time || (x.offer && !alive(s, x.offer.personId))) x.offer = null;
  reconcileUnderworldTime(s, api);
  for (const chapter of CHAPTERS) renewRoster(s, x, api, chapter, today);
  closePersonalClaims(s, x);
  tickCases(s, x, api, today);
  settleNpcCases(s, x, api);
  prune(s, x);
  // Rotate first access to finite local orders so array order cannot determine
  // the outcome of every rivalry and sale. This consumes no RNG.
  const sales = new Set();
  for (let offset = 0; offset < CHAPTERS.length; offset++) {
    const chapter = CHAPTERS[(today + offset) % CHAPTERS.length];
    if (runChapterDay(s, x, api, chapter, today)) sales.add(chapter.id);
  }
  settleRelations(s, x, api, today, sales);
  raidOffscreen(s, x, api, today);
}

export function underworldDistrictModifiers(s, districtId) {
  const x = state(s);
  const chapter = byDistrict.get(districtId);
  const account = x?.chapters[chapter?.id];
  const influence = account?.influence ?? 0;
  const heat = account?.heat ?? 0;
  return {
    demand: Math.floor(influence * 0.12) - Math.floor(heat * 0.12),
    rentPressure: Math.floor(influence * 0.1) - Math.floor(heat * 0.1),
    jobOpenings: Math.floor(influence * 0.12) - Math.floor(heat * 0.2),
    serviceDelay: Math.floor(heat * 0.2),
    security: -Math.floor(heat * 0.25) || 0,
    influence,
  };
}

function localReason(s, api, chapter, minutes, site) {
  const place = api.getPlace(s);
  const minute = minuteOf(s.time);
  if (s._transit || place.districtId !== chapter.districtId)
    return site === "work" ? WORK_REASON : site === "social" ? SOCIAL_REASON : OFFICE_REASON;
  if (site === "work")
    return place.venueId === chapter.workVenue && minute >= 480 && minute + minutes <= 1260
      ? ""
      : WORK_REASON;
  if (site === "social")
    return place.venueId === chapter.socialVenue && minute >= 540 && minute + minutes <= 1260
      ? ""
      : SOCIAL_REASON;
  return place.venueId === chapter.officeVenue && minute >= 480 && minute + minutes <= 1080
    ? ""
    : OFFICE_REASON;
}

function activePenalty(s, id) {
  return state(s)?.cases.some(
    (row) =>
      row.status === "convicted" &&
      row.restrictionUntil >= dayOf(s.time) &&
      state(s).incidents.find((incident) => incident.id === row.id).personId === id,
  );
}

function outstandingClaims(s, id) {
  const x = state(s);
  return x?.cases.some(
    (row) =>
      (row.fineDue || row.compensationDue) &&
      x.incidents.find((incident) => incident.id === row.id).personId === id,
  );
}

function recruiting(account) {
  return account.treasury >= 350 && account.readiness >= 20;
}

function resultEvent(s, api, text, subject = person(s).name) {
  api.expansionEvent(s, "underworld", subject, text);
  return text;
}

function acceptRecruit(s, x, chapter, api) {
  const id = s.expansion.playerId;
  const former = formerOf(x, id, chapter.id);
  const row = {
    personId: id,
    chapterId: chapter.id,
    joinedAt: s.time,
    leftAt: null,
    trust: former ? clamp(former.trust, 18, 40) : 24,
    responsibility: former ? Math.floor(former.responsibility / 2) : 0,
    rank: 0,
    task: null,
  };
  if (former) Object.assign(former, row);
  else x.memberships.push(row);
  x.offer = null;
  return resultEvent(s, api, "Örgüte aday üye olarak katıldın.", chapter.name);
}

function completeTask(s, x, chapter, member, api) {
  const task = member.task;
  const terms = TERMS[task.kind];
  const account = x.chapters[chapter.id];
  if (!taskOpen(task) || s.time > task.dueAt) return "Görev süresinde tamamlanmadı.";
  if (account.treasury < terms.reward || s.bank > MAX - terms.reward || account.stock < terms.stock)
    return MONEY_REASON;
  if (
    terms.stock &&
    !sell(s, api, chapter, account, terms.stock, canTransferOrder(s, api, chapter, terms.stock))
  )
    return "Alıcı siparişi artık karşılayamıyor.";
  payroll(s, api, account, terms.reward, terms.name);
  task.status = "completed";
  task.resolvedAt = s.time;
  member.trust = clamp(member.trust + (task.kind === "sorting" ? 14 : 18));
  member.responsibility = clamp(member.responsibility + (terms.stock ? 2 : 1));
  account.readiness = clamp(account.readiness + 5);
  account.influence = clamp(account.influence + (terms.stock ? 5 : 1));
  return resultEvent(s, api, "Görev tamamlandı; ücret ödendi ve güven arttı.", chapter.name);
}

function recordRaid(s, x, attacker, victim, personId, offscreen) {
  const clerk = staffOnDuty(x.chapters[victim.id], victim, s.time);
  const id = x.nextIncident++;
  const incident = {
    id,
    personId,
    offscreen,
    chapterId: victim.id,
    offenderChapterId: attacker.id,
    venueId: victim.workVenue,
    at: s.time,
    actionId: `underworld:${offscreen ? "night-raid" : "raid"}:${victim.id}`,
    evidence: [{ kind: "stock", source: victim.id, observedAt: s.time, learnedAt: null }],
  };
  if (clerk)
    incident.evidence.push({ kind: "witness", source: clerk, observedAt: s.time, learnedAt: null });
  x.incidents.push(incident);
  x.cases.push({
    id,
    status: "unreported",
    reportedAt: null,
    inventoryInspectedAt: null,
    reviewInspectedAt: null,
    reviewDay: null,
    decidedAt: null,
    restrictionUntil: null,
    fineDue: 0,
    finePaid: 0,
    fineWaived: 0,
    fineArchived: 0,
    personalReserve: 0,
    compensationDue: 0,
    compensationPaid: 0,
  });
}

function raidOffscreen(s, x, api, today) {
  // A scheduled depot runner can take a rival's unit only on a genuinely
  // heated route. One attempt per day keeps evidence and cases bounded.
  if (x.cases.length >= MAX_CASES - 4) return;
  for (const [first, second] of rivals) {
    const left = catalog.get(first),
      right = catalog.get(second);
    if (
      (today + left.index * 3 + right.index) % 19 !== 0 ||
      x.relations[pairId(left, right)].standing >= -18
    )
      continue;
    const [attacker, victim] =
      (Math.floor(today / 19) + right.index) % 2 ? [left, right] : [right, left];
    const own = x.chapters[attacker.id],
      target = x.chapters[victim.id];
    if (
      !rostered(own.roster[1]) ||
      own.treasury - reservations(x, attacker.id).treasury < 180 ||
      target.stock <= reservations(x, victim.id).stock ||
      own.stock >= MAX_STOCK
    )
      continue;
    const runner = currentStaffId(attacker, own, 1);
    if (
      x.incidents.some(
        (incident, index) =>
          incident.personId === runner &&
          (x.cases[index].decidedAt === null || x.cases[index].restrictionUntil >= today),
      )
    )
      continue;
    recordRaid(s, x, attacker, victim, runner, true);
    const commission = 45;
    own.treasury -= commission;
    own.ledger.payroll += commission;
    own.roster[1].purse = Math.min(MAX, own.roster[1].purse + commission);
    target.stock--;
    target.ledger.stolenOut++;
    own.stock++;
    own.ledger.stolenIn++;
    own.influence = clamp(own.influence + 4);
    own.heat = clamp(own.heat + 11);
    target.heat = clamp(target.heat + 22);
    x.relations[pairId(attacker, victim)].standing = clamp(
      x.relations[pairId(attacker, victim)].standing - 8,
      -100,
    );
    api.news(s, `${victim.name} · Depoda kayıp kaydedildi.`);
    return;
  }
}

function raid(s, x, attacker, victim, api) {
  const target = x.chapters[victim.id];
  const own = x.chapters[attacker.id];
  const targetReserve = reservations(x, victim.id);
  const ownReserve = reservations(x, attacker.id);
  if (
    x.cases.length >= MAX_CASES ||
    s._transit ||
    target.stock <= targetReserve.stock ||
    own.stock >= MAX_STOCK ||
    own.treasury - ownReserve.treasury < RESTITUTION ||
    s.bank > MAX - RESTITUTION
  )
    return MONEY_REASON;

  recordRaid(s, x, attacker, victim, s.expansion.playerId, false);
  // The victim's missing unit is the same one entering the receiving depot.
  // The chapter pays the actor from funds it already holds.
  target.stock--;
  target.ledger.stolenOut++;
  own.stock++;
  own.ledger.stolenIn++;
  payroll(s, api, own, RESTITUTION, "Kayıt dışı sevkiyat ücreti");
  target.heat = clamp(target.heat + 26);
  own.heat = clamp(own.heat + 14);
  own.influence = clamp(own.influence + 5);
  x.relations[pairId(attacker, victim)].standing = clamp(
    x.relations[pairId(attacker, victim)].standing - 24,
    -100,
  );
  membershipOf(x, s.expansion.playerId).trust = clamp(
    membershipOf(x, s.expansion.playerId).trust + 5,
  );
  return resultEvent(
    s,
    api,
    "Kayıt dışı sevkiyat yapıldı; depoda bir kayıp kayda geçti.",
    victim.name,
  );
}

function settleClaim(s, x, row, incident, api, payFine, amount) {
  if (payFine) {
    api.creditMunicipalTax(s, catalog.get(incident.chapterId).regionId, amount);
    row.fineDue -= amount;
    row.finePaid += amount;
  } else {
    const victim = x.chapters[incident.chapterId];
    victim.treasury += amount;
    victim.ledger.restored += amount;
    row.compensationDue -= amount;
    row.compensationPaid += amount;
  }
  return resultEvent(s, api, payFine ? "Mahkeme cezası ödendi." : "Depo tazminatı ödendi.");
}

const completion = new WeakMap();
const disabledForFunds = (s, cost) => (funds(s) < cost ? "Bu işlem için yeterli bakiye yok." : "");

export function underworldActions(s, api) {
  if (!s.expansion || !alive(s) || !api) return [];
  const x = state(s) ?? makeState(dayOf(s.time));
  const id = s.expansion.playerId;
  const member = membershipOf(x, id);
  const local = api.getPlace(s);
  const actions = [];

  function add(key, label, description, minutes, reason, run, cost = 0, category = "underworld") {
    const problem = reason || disabledForFunds(s, cost);
    const action = {
      id: `underworld:${key}`,
      label,
      description,
      category,
      minutes,
      cost,
      pay: "total",
      disabled: Boolean(problem),
      reason: problem,
      run: () => PENDING,
    };
    completion.set(action, run);
    actions.push(action);
  }

  for (const chapter of CHAPTERS) {
    if (chapter.regionId !== local.regionId) continue;
    const account = x.chapters[chapter.id];
    if (!member) {
      const capacity =
        x.memberships.length >= MAX_MEMBERSHIPS && !formerOf(x, id, chapter.id)
          ? CAPACITY_REASON
          : "";
      const restriction = activePenalty(s, id) ? RESTRICTION_REASON : "";
      add(
        `recruit:${chapter.id}`,
        `${chapter.name} · Üye alımına görüş`,
        "Yetkiliyle buluş; kabul edersen davet ertesi günün sonuna dek geçerli.",
        20,
        localReason(s, api, chapter, 20, "social") ||
          capacity ||
          restriction ||
          (!recruiting(account) ? "Örgüt bu aralar üye almıyor." : ""),
        (next, nextState) => {
          if (!recruiting(nextState.chapters[chapter.id])) return "Örgüt bu aralar üye almıyor.";
          nextState.offer = {
            personId: id,
            chapterId: chapter.id,
            offeredAt: next.time,
            until: dayOf(next.time) * DAY + DAY - 1,
          };
          return resultEvent(next, api, "Örgüt daveti alındı.", chapter.name);
        },
      );
      if (x.offer?.chapterId === chapter.id && x.offer.until >= s.time)
        add(
          `join:${chapter.id}`,
          `${chapter.name} · Daveti kabul et`,
          "Aday olarak gir; güven ve sorumluluk tamamlanan işlerle artar.",
          15,
          localReason(s, api, chapter, 15, "social") ||
            capacity ||
            restriction ||
            (x.offer.until < s.time + 15 ? "Davetin süresi doldu." : ""),
          (next, nextState) => acceptRecruit(next, nextState, chapter, api),
        );
    } else if (chapter.id === member.chapterId) {
      memberActions(s, x, api, chapter, member, add);
    } else {
      const ownChapter = catalog.get(member.chapterId);
      if (ownChapter.regionId === chapter.regionId) {
        const ownAccount = x.chapters[ownChapter.id];
        const link = x.relations[pairId(ownChapter, chapter)];
        const raidReason = activePenalty(s, id)
          ? RESTRICTION_REASON
          : x.cases.length >= MAX_CASES
            ? CAPACITY_REASON
            : x.cases.some(
                  (row) =>
                    row.decidedAt === null &&
                    x.incidents.find((incident) => incident.id === row.id).personId === id,
                )
              ? "Önce açık soruşturmanın sonucunu bekle."
              : account.stock <= reservations(x, chapter.id).stock ||
                  ownAccount.treasury - reservations(x, ownChapter.id).treasury < RESTITUTION ||
                  ownAccount.stock >= MAX_STOCK ||
                  s.bank > MAX - RESTITUTION
                ? MONEY_REASON
                : "";
        add(
          `raid:${chapter.id}`,
          `${chapter.name} · Kayıt dışı sevkiyat`,
          `${RESTITUTION} TL örgüt ücreti. Sayım kaydı ve tanık varsa ${FINE} TL ceza, ${RESTITUTION} TL tazminat ve ${RESTRICTION_DAYS} gün kısıtlama. Yalnız sayım varsa beraat.`,
          35,
          localReason(s, api, chapter, 35, "work") || raidReason,
          (next, nextState) => raid(next, nextState, ownChapter, chapter, api),
        );
        add(
          `negotiate:${chapter.id}`,
          `${chapter.name} · Tedarik görüşmesi`,
          "Görüşme ilişkileri iyileştirir. Güçlü anlaşma depolar arasında ücretli ikmal açar.",
          35,
          localReason(s, api, chapter, 35, "social") ||
            (member.rank < 1 || member.trust < 45
              ? TRUST_REASON
              : link.lastTalkDay && dayOf(s.time) - link.lastTalkDay < 3
                ? "Son görüşmenin üzerinden üç gün geçmeli."
                : ""),
          (next, nextState) => {
            const relationship = nextState.relations[pairId(ownChapter, chapter)];
            relationship.standing = clamp(
              relationship.standing + (member.rank >= 2 ? 36 : 26),
              -100,
            );
            relationship.lastTalkDay = dayOf(next.time);
            return resultEvent(
              next,
              api,
              relationship.standing >= 30
                ? "Tedarik ittifakı kuruldu."
                : "Tedarik anlaşmazlığı hafifledi.",
              chapter.name,
            );
          },
        );
      }
    }
  }

  for (const row of x.cases) {
    const incident = x.incidents.find(({ id: key }) => row.id === key);
    const own = incident.personId === id;
    if (!own && (incident.offscreen || !row.compensationDue)) continue;
    const chapter = catalog.get(incident.chapterId);
    const { id: caseId } = row;
    if (own && row.status === "unreported")
      add(
        `report:${caseId}`,
        "Depo kaybını bildir",
        "Bildirim dosyayı açar. Soruşturma ve delil incelemesi ikişer gün sürer.",
        15,
        localReason(s, api, chapter, 15, "office"),
        (next, nextState) => {
          const nextCase = nextState.cases.find((entry) => entry.id === caseId);
          openCase(
            next,
            api,
            nextState.incidents.find((entry) => entry.id === caseId),
            nextCase,
            false,
          );
          return "Depo kaybı bildirildi; soruşturma açıldı.";
        },
      );
    if (own && row.reportedAt !== null) {
      const stage = row.status === "investigation" ? "inventoryInspectedAt" : "reviewInspectedAt";
      if (row[stage] === null)
        add(
          `inspect:${caseId}`,
          "Dosyadaki erişilebilir kanıtı incele",
          "Sayım kaydı kaybı gösterir. Bağımsız tanık kimliği doğrular. Mahkûmiyet için iki kaynak gerekir.",
          25,
          localReason(s, api, chapter, 25, "office"),
          (next, nextState) => {
            const nextCase = nextState.cases.find((entry) => entry.id === caseId);
            const proof = nextState.incidents.find((entry) => entry.id === caseId).evidence;
            nextCase[stage] = next.time;
            const disclosed = proof.slice(0, stage === "inventoryInspectedAt" ? 1 : 2);
            const newEvidence = disclosed.some((e) => e.learnedAt === null);
            for (const e of disclosed) e.learnedAt ??= next.time;
            return newEvidence
              ? "Dosyada erişilebilir kanıtlar öğrenildi."
              : "Dosyada yeni kanıt yok.";
          },
        );
    }
    for (const payFine of [true, false]) {
      const amount = payFine ? (own ? row.fineDue : 0) : row.compensationDue;
      if (!amount) continue;
      const treasury = payFine
        ? s.expansion.institutions.regions[chapter.regionId].treasury
        : x.chapters[chapter.id].treasury;
      add(
        `${payFine ? "fine" : "compensation"}:${caseId}`,
        payFine ? "Mahkeme cezasını öde" : "Depo tazminatını öde",
        payFine
          ? "Kişisel ceza belediyeye ödenir."
          : "Belgeli tazminat zarar gören deponun hesabına ödenir.",
        5,
        treasury > MAX - amount ? MONEY_REASON : minuteOf(s.time) >= DAY - 5 ? PAYMENT_HOURS : "",
        (next, nextState) =>
          settleClaim(
            next,
            nextState,
            nextState.cases.find((entry) => entry.id === caseId),
            incident,
            api,
            payFine,
            amount,
          ),
        amount,
        "wallet",
      );
    }
  }
  return actions;
}

function memberActions(s, x, api, chapter, member, add) {
  const account = x.chapters[chapter.id];
  const getMember = (nextState) => membershipOf(nextState, member.personId);
  const work = (minutes) => localReason(s, api, chapter, minutes, "work");
  const social = (minutes) => localReason(s, api, chapter, minutes, "social");
  if (taskOpen(member.task)) {
    const terms = TERMS[member.task.kind];
    const due = member.task.dueAt < s.time + terms.minutes ? "Görevin süresi yetersiz." : "";
    add(
      `complete:${member.task.id}`,
      `${terms.name} · Görevi tamamla`,
      `${terms.reward} TL örgüt kasasından. Süresinde tamamlanırsa güven ve sorumluluk artar.`,
      terms.minutes,
      work(terms.minutes) ||
        due ||
        (terms.stock && !canTransferOrder(s, api, chapter, terms.stock)
          ? "Uygun, ödeme yapabilen alıcı yok."
          : "") ||
        (s.bank > MAX - terms.reward ? MONEY_REASON : ""),
      (next, nextState) => completeTask(next, nextState, chapter, getMember(nextState), api),
    );
  } else {
    for (const [kind, terms] of Object.entries(TERMS)) {
      if (member.rank < terms.rank) continue;
      add(
        `accept:${kind}`,
        `${terms.name} · Görevi al`,
        `${terms.reward} TL örgüt kasasından. Verilen süre içinde iş yerine dönüp görevi tamamla.`,
        10,
        work(10) ||
          (account.treasury < terms.reward || account.stock < terms.stock ? MONEY_REASON : ""),
        (next, nextState, before) => {
          if (
            nextState.chapters[chapter.id].treasury < terms.reward ||
            nextState.chapters[chapter.id].stock < terms.stock
          )
            return MONEY_REASON;
          getMember(nextState).task = {
            id: nextState.nextTask++,
            kind,
            offeredAt: before.time,
            acceptedAt: next.time,
            dueAt: next.time + DAY,
            status: "accepted",
            resolvedAt: null,
          };
          return "Görev kabul edildi; kaynak ayrıldı.";
        },
      );
    }
  }
  if (member.rank < 2) {
    const requiredTrust = member.rank === 0 ? 45 : 70;
    const requiredResponsibility = member.rank === 0 ? 3 : 5;
    add(
      "promote",
      "Örgütte terfi iste",
      `Terfi için güven ${requiredTrust} ve sorumluluk ${requiredResponsibility} olmalı.`,
      20,
      social(20) ||
        (member.trust < requiredTrust || member.responsibility < requiredResponsibility
          ? TRUST_REASON
          : "") ||
        (activePenalty(s, member.personId) ? RESTRICTION_REASON : ""),
      (next, nextState) => {
        getMember(nextState).rank++;
        return resultEvent(next, api, "Örgütte terfi ettin.", chapter.name);
      },
    );
  }
  if (member.rank === 2)
    add(
      "lead",
      "Örgüt liderliğini üstlen",
      "En az 80 güven ve 8 sorumluluk gerekir. Lider olarak sekiz gün arayla kadro desteği sağlayabilirsin.",
      35,
      social(35) ||
        (member.trust < 80 || member.responsibility < 8 ? TRUST_REASON : "") ||
        (taskOpen(member.task) ? TASK_REASON : "") ||
        (activePenalty(s, member.personId) ? RESTRICTION_REASON : ""),
      (next, nextState) => {
        getMember(nextState).rank = 3;
        nextState.chapters[chapter.id].leader = member.personId;
        return resultEvent(next, api, "Örgütün liderliğini üstlendin.", chapter.name);
      },
    );
  if (member.rank === 3)
    add(
      "support",
      "Kadro desteği sağla",
      "Kasadan 90 TL çalışanlara ödenir; sadakat ve hazırlık artar.",
      30,
      work(30) ||
        (account.treasury - reservations(x, chapter.id).treasury < 90 ? MONEY_REASON : "") ||
        (account.lastSupportDay && dayOf(s.time) - account.lastSupportDay < 8
          ? "Kadro desteği için sekiz gün geçmeli."
          : ""),
      (next, nextState) => {
        const ledger = nextState.chapters[chapter.id];
        ledger.treasury -= 90;
        ledger.ledger.payroll += 90;
        ledger.lastSupportDay = dayOf(next.time);
        ledger.readiness = clamp(ledger.readiness + 10);
        for (const staff of ledger.roster)
          if (staff.joinedDay !== null && staff.leftDay === null)
            staff.loyalty = clamp(staff.loyalty + 12);
        return resultEvent(next, api, "Kadroya destek ödemesi yapıldı.", chapter.name);
      },
    );
  add(
    "leave",
    "Örgütten ayrıl",
    "Görevin kapanır; geçmiş ilişkiler ve ödenmemiş yükümlülükler kalır.",
    10,
    "",
    (next, nextState) => {
      closeMembership(next, nextState, api, getMember(nextState), false);
      return "Örgüt üyeliği sona erdi.";
    },
  );
}

export function adaptUnderworldActions(s, actions) {
  if (!state(s)) return actions;
  const restriction = activePenalty(s, s.expansion.playerId);
  const claims = outstandingClaims(s, s.expansion.playerId);
  return actions.map((action) => {
    if (action.disabled) return action;
    const reason =
      restriction && LICENSE_REASONS.test(action.id)
        ? RESTRICTION_REASON
        : (claims || restriction) && CREDIT_REASONS.test(action.id)
          ? CREDIT_REASON
          : "";
    return reason ? { ...action, disabled: true, reason } : action;
  });
}

export function afterUnderworldAction(s, id, before, api, action) {
  const x = state(s);
  if (x) reconcileDeaths(s, x, api);
  const finish = completion.get(action);
  if (!id.startsWith("underworld:") || !finish) return;
  if (
    !alive(s) ||
    s.expansion.playerId !== before.expansion.playerId ||
    s.time !== before.time + action.minutes ||
    s._transit
  )
    return "İşlem tamamlanmadı.";
  const start = api.getPlace(before);
  const end = api.getPlace(s);
  if (start.districtId !== end.districtId || start.venueId !== end.venueId)
    return "Yer değiştiği için işlem tamamlanmadı.";
  const nextState = ensure(s);
  prune(s, nextState);
  return finish(s, nextState, before);
}

const inRange = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const keys = (value, fields) =>
  value !== null &&
  typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).length === fields.length &&
  fields.every((key) => Object.hasOwn(value, key));
const list = (value, max) => Array.isArray(value) && value.length <= max;

function validChapter(s, x, chapter, today) {
  const account = x.chapters[chapter.id];
  if (
    !keys(account, [
      "treasury",
      "stock",
      "influence",
      "heat",
      "readiness",
      "lastSupportDay",
      "leader",
      "roster",
      "ledger",
    ]) ||
    !inRange(account.treasury, 0, MAX) ||
    !inRange(account.stock, 0, MAX_STOCK) ||
    ![account.influence, account.heat, account.readiness].every((value) =>
      inRange(value, 0, 100),
    ) ||
    !inRange(account.lastSupportDay, 0, today) ||
    !list(account.roster, 3) ||
    account.roster.length !== 3 ||
    !keys(account.ledger, ledgerKeys) ||
    !ledgerKeys.every((key) => inRange(account.ledger[key], 0, Number.MAX_SAFE_INTEGER))
  )
    return false;
  if (
    !account.roster.every(
      (member, index) =>
        keys(member, ["loyalty", "joinedDay", "leftDay", "generation", "purse"]) &&
        inRange(member.loyalty, 0, 100) &&
        member.generation === staffGeneration(chapter, index, today) &&
        inRange(member.purse, 0, MAX) &&
        (member.joinedDay === null
          ? member.leftDay === null && member.loyalty === 0
          : inRange(member.joinedDay, 1, today) &&
            (member.leftDay === null || inRange(member.leftDay, member.joinedDay, today))),
    )
  )
    return false;
  const reserve = reservations(x, chapter.id);
  const leader = account.roster.find(
    (row, index) =>
      currentStaffId(chapter, account, index) === account.leader &&
      row.joinedDay !== null &&
      row.leftDay === null,
  );
  const playerLeader = membershipOf(x, account.leader);
  const l = account.ledger;
  return (
    (leader ||
      (playerLeader?.rank === 3 &&
        playerLeader.chapterId === chapter.id &&
        alive(s, account.leader))) &&
    account.treasury >= reserve.treasury &&
    account.stock >= reserve.stock &&
    account.treasury ===
      2100 +
        chapter.index * 90 +
        l.sales +
        l.alliedEarned +
        l.restored -
        l.wholesale -
        l.payroll -
        l.alliedSpent -
        l.liability &&
    account.stock === 6 + l.purchased + l.stolenIn + l.sharedIn - l.sold - l.stolenOut - l.sharedOut
  );
}

function validMembership(s, x, member, taskIds) {
  if (
    !keys(member, [
      "personId",
      "chapterId",
      "joinedAt",
      "leftAt",
      "trust",
      "responsibility",
      "rank",
      "task",
    ])
  )
    return false;
  const actor = person(s, member.personId);
  if (
    !actor ||
    !catalog.has(member.chapterId) ||
    !inRange(member.joinedAt, 0, s.time) ||
    dayOf(member.joinedAt) - actor.born < 18 * 30 ||
    (member.leftAt === null
      ? member.personId !== s.expansion.playerId || actor.died !== null
      : !inRange(member.leftAt, member.joinedAt, s.time)) ||
    (actor.died !== null &&
      (dayOf(member.joinedAt) >= actor.died || dayOf(member.leftAt) > actor.died)) ||
    !inRange(member.rank, 0, 3) ||
    (member.rank === 3 &&
      member.leftAt === null &&
      x.chapters[member.chapterId]?.leader !== member.personId) ||
    !inRange(member.trust, 0, 100) ||
    !inRange(member.responsibility, 0, 100)
  )
    return false;
  const task = member.task;
  if (task === null) return true;
  if (
    !keys(task, ["id", "kind", "offeredAt", "acceptedAt", "dueAt", "status", "resolvedAt"]) ||
    !Object.hasOwn(TERMS, task.kind) ||
    TERMS[task.kind].rank > member.rank ||
    !inRange(task.id, 1, x.nextTask - 1) ||
    taskIds.has(task.id) ||
    !inRange(task.offeredAt, member.joinedAt, s.time) ||
    task.acceptedAt !== task.offeredAt + 10 ||
    !inRange(task.acceptedAt, member.joinedAt, s.time) ||
    task.dueAt !== task.acceptedAt + DAY ||
    !["accepted", "completed", "missed", "cancelled"].includes(task.status)
  )
    return false;
  taskIds.add(task.id);
  if (task.status === "accepted")
    return task.resolvedAt === null && member.leftAt === null && s.time <= task.dueAt;
  if (!inRange(task.resolvedAt, task.acceptedAt, member.leftAt ?? s.time)) return false;
  if (task.status === "completed")
    return inRange(task.resolvedAt, task.acceptedAt + TERMS[task.kind].minutes, task.dueAt);
  if (task.status === "missed") return task.resolvedAt === task.dueAt + 1;
  return task.resolvedAt === member.leftAt;
}

function validCase(s, x, row, incident, prior) {
  if (
    !keys(incident, [
      "id",
      "personId",
      "offscreen",
      "chapterId",
      "offenderChapterId",
      "venueId",
      "at",
      "actionId",
      "evidence",
    ]) ||
    !keys(row, [
      "id",
      "status",
      "reportedAt",
      "inventoryInspectedAt",
      "reviewInspectedAt",
      "reviewDay",
      "decidedAt",
      "restrictionUntil",
      "fineDue",
      "finePaid",
      "fineWaived",
      "fineArchived",
      "personalReserve",
      "compensationDue",
      "compensationPaid",
    ]) ||
    row.id !== incident.id ||
    !inRange(row.id, prior + 1, x.nextIncident - 1) ||
    !Object.hasOwn(CASE_STATES, row.status) ||
    !inRange(incident.at, 0, s.time) ||
    !list(incident.evidence, 2) ||
    incident.evidence.length < 1
  )
    return false;

  const victim = catalog.get(incident.chapterId);
  const offender = catalog.get(incident.offenderChapterId);
  if (
    !victim ||
    !offender ||
    victim === offender ||
    victim.regionId !== offender.regionId ||
    victim.workVenue !== incident.venueId ||
    typeof incident.offscreen !== "boolean"
  )
    return false;
  const occurred = dayOf(incident.at),
    minute = minuteOf(incident.at);
  const actor = incident.offscreen
    ? staffIdentity(offender, incident.personId)
    : person(s, incident.personId);
  if (!actor) return false;
  if (incident.offscreen) {
    if (
      actor.index !== 1 ||
      actor.generation !== staffGeneration(offender, actor.index, occurred) ||
      minute !== 0 ||
      incident.actionId !== `underworld:night-raid:${victim.id}`
    )
      return false;
  } else if (
    incident.actionId !== `underworld:raid:${victim.id}` ||
    occurred - actor.born < 18 * 30 ||
    (actor.died !== null && occurred >= actor.died) ||
    minute < 515 ||
    minute > 1260
  )
    return false;

  for (const [index, evidence] of incident.evidence.entries()) {
    if (
      !keys(evidence, ["kind", "source", "observedAt", "learnedAt"]) ||
      evidence.observedAt !== incident.at ||
      (evidence.learnedAt !== null &&
        (incident.offscreen ||
          !inRange(evidence.learnedAt, (row.reportedAt ?? s.time) + 25, s.time) ||
          (actor.died !== null && dayOf(evidence.learnedAt) >= actor.died)))
    )
      return false;
    if (!index) {
      if (evidence.kind !== "stock" || evidence.source !== victim.id) return false;
      continue;
    }
    const witness = staffIdentity(victim, evidence.source);
    if (
      !witness ||
      evidence.kind !== "witness" ||
      witness.generation !== staffGeneration(victim, witness.index, occurred) ||
      (incident.offscreen
        ? witness.index !== 2 || (occurred + victim.index) % 4 >= 2
        : witness.index !== 1 || (occurred - 1) % 7 >= 5 || minute < 540 || minute >= 900) ||
      (evidence.learnedAt !== null && dayOf(evidence.learnedAt) < dayOf(row.reportedAt) + 2)
    )
      return false;
  }

  const consultation = [row.inventoryInspectedAt, row.reviewInspectedAt];
  if (
    consultation.some(
      (at) =>
        at !== null &&
        (incident.offscreen ||
          row.reportedAt === null ||
          !inRange(at, row.reportedAt + 25, s.time) ||
          (actor.died !== null && dayOf(at) >= actor.died)),
    )
  )
    return false;
  const reviewAt = (dayOf(row.reportedAt) + 1) * DAY;
  if (
    (row.inventoryInspectedAt !== null && row.inventoryInspectedAt >= reviewAt) ||
    (row.reviewInspectedAt !== null && row.reviewInspectedAt < reviewAt + 25) ||
    incident.evidence[0].learnedAt !== (row.inventoryInspectedAt ?? row.reviewInspectedAt) ||
    (incident.evidence[1] && incident.evidence[1].learnedAt !== row.reviewInspectedAt)
  )
    return false;
  const claimValues = [
    row.fineArchived,
    row.fineDue,
    row.finePaid,
    row.fineWaived,
    row.compensationDue,
    row.compensationPaid,
  ];
  if (
    !claimValues.every((value) => inRange(value, 0, FINE)) ||
    !inRange(row.personalReserve, 0, FINE)
  )
    return false;
  if (row.status !== "convicted" && (row.restrictionUntil !== null || claimValues.some(Boolean)))
    return false;
  const stillCurrent =
    incident.offscreen &&
    x.chapters[offender.id].roster[actor.index].generation === actor.generation;
  if (
    row.personalReserve &&
    (!incident.offscreen ||
      stillCurrent ||
      row.status === "acquitted" ||
      row.status === "unreported" ||
      (row.status === "convicted" && row.personalReserve > row.fineDue))
  )
    return false;
  if (
    row.fineArchived &&
    (!incident.offscreen || stillCurrent || row.personalReserve || row.fineArchived !== row.fineDue)
  )
    return false;
  if (row.status === "unreported")
    return (
      row.reportedAt === null &&
      row.reviewDay === null &&
      row.decidedAt === null &&
      incident.evidence.every((e) => e.learnedAt === null) &&
      dayOf(incident.at) === x.lastDay
    );
  if (
    !inRange(row.reportedAt, incident.at, s.time) ||
    dayOf(row.reportedAt) > dayOf(incident.at) + 1
  )
    return false;
  const reportDay = dayOf(row.reportedAt);
  if (["investigation", "review"].includes(row.status))
    return (
      row.decidedAt === null &&
      row.reviewDay === reportDay + (row.status === "review" ? 4 : 2) &&
      x.lastDay < row.reviewDay &&
      (row.status !== "review" || x.lastDay >= reportDay + 2)
    );
  if (
    row.reviewDay !== null ||
    !inRange(row.decidedAt, row.reportedAt, s.time) ||
    row.decidedAt !== (reportDay + 3) * DAY
  )
    return false;
  if (row.status === "acquitted") return incident.evidence.length === 1;
  return (
    incident.evidence.length === 2 &&
    row.restrictionUntil === dayOf(row.decidedAt) + RESTRICTION_DAYS &&
    row.fineDue + row.finePaid + row.fineWaived === FINE &&
    row.compensationDue + row.compensationPaid === RESTITUTION &&
    (incident.offscreen || actor.died === null ? row.fineWaived === 0 : row.fineDue === 0)
  );
}

export function validateUnderworld(s) {
  const e = s.expansion;
  if (!e || !Object.hasOwn(e, "underworld")) return true;
  const x = e.underworld;
  const today = dayOf(s.time);
  const pairIds = rivals.map(([first, second]) => `${first}:${second}`);
  if (
    !keys(x, [
      "lastDay",
      "nextTask",
      "nextIncident",
      "chapters",
      "relations",
      "offer",
      "memberships",
      "incidents",
      "cases",
    ]) ||
    x.lastDay !== today ||
    ![x.nextIncident, x.nextTask].every((value) => inRange(value, 1, 100_000_001)) ||
    !keys(
      x.chapters,
      CHAPTERS.map(({ id }) => id),
    ) ||
    !keys(x.relations, pairIds) ||
    !list(x.memberships, MAX_MEMBERSHIPS) ||
    !list(x.incidents, MAX_CASES) ||
    !list(x.cases, MAX_CASES) ||
    x.cases.length !== x.incidents.length
  )
    return false;
  const taskIds = new Set();
  const membershipIds = new Set();
  let active = false;
  for (const member of x.memberships) {
    if (!validMembership(s, x, member, taskIds)) return false;
    const id = `${member.personId}/${member.chapterId}`;
    if (membershipIds.has(id) || (active && member.leftAt === null)) return false;
    membershipIds.add(id);
    active ||= member.leftAt === null;
  }
  if (
    !CHAPTERS.every((chapter) => validChapter(s, x, chapter, today)) ||
    !pairIds.every((id) => {
      const link = x.relations[id];
      return (
        keys(link, ["standing", "lastTalkDay", "lastTradeDay"]) &&
        inRange(link.standing, -100, 100) &&
        inRange(link.lastTalkDay, 0, today) &&
        inRange(link.lastTradeDay, 0, today)
      );
    })
  )
    return false;
  if (
    x.offer !== null &&
    (!keys(x.offer, ["personId", "chapterId", "offeredAt", "until"]) ||
      x.offer.personId !== e.playerId ||
      !alive(s) ||
      !catalog.has(x.offer.chapterId) ||
      active ||
      !inRange(x.offer.offeredAt, 0, s.time) ||
      x.offer.until !== (dayOf(x.offer.offeredAt) + 1) * DAY - 1 ||
      x.offer.until < s.time)
  )
    return false;
  let prior = 0;
  for (const [index, row] of x.cases.entries()) {
    if (!validCase(s, x, row, x.incidents[index], prior)) return false;
    prior = row.id;
  }
  return true;
}

const relationStatus = (standing) =>
  standing >= 30 ? "İttifak" : standing <= -20 ? "Rekabet" : "Tarafsız";
const ownActions = (actions, keys) => actions.map(({ id }) => id).filter((id) => keys.test(id));

export function underworldView(s, api) {
  if (!s.expansion) return null;
  const x = state(s) ?? makeState(dayOf(s.time));
  const id = s.expansion.playerId;
  const actions = underworldActions(s, api);
  const active = membershipOf(x, id);
  const member = active ?? x.memberships.findLast((row) => row.personId === id);
  const chapterOfMember = catalog.get(member?.chapterId);
  return {
    chapters: CHAPTERS.map((chapter) => {
      const account = x.chapters[chapter.id];
      const known = member?.chapterId === chapter.id || x.offer?.chapterId === chapter.id;
      return {
        id: chapter.id,
        name: chapter.name,
        districtId: chapter.districtId,
        influence: account.influence,
        recruiting: recruiting(account),
        leader: known
          ? (staffName(chapter, account.leader) ?? person(s, account.leader)?.name ?? null)
          : null,
        relations: rivals
          .filter((pair) => pair.includes(chapter.id))
          .map((pair) => {
            const other = catalog.get(pair.find((id) => id !== chapter.id));
            return {
              chapterId: other.id,
              name: other.name,
              status: relationStatus(x.relations[pairId(chapter, other)].standing),
            };
          }),
        actionIds: ownActions(
          actions,
          new RegExp(`^underworld:(?:recruit|join|raid|negotiate):${chapter.id}$`),
        ),
      };
    }),
    membership: member
      ? {
          chapterId: member.chapterId,
          name: chapterOfMember.name,
          status: member.leftAt === null ? "Etkin" : "Ayrıldı",
          rank: RANKS[member.rank],
          trust: member.trust,
          responsibility: member.responsibility,
          joinedAt: member.joinedAt,
          leftAt: member.leftAt,
          task: member.task
            ? {
                type: TERMS[member.task.kind].name,
                status: {
                  accepted: "Kabul edildi",
                  completed: "Tamamlandı",
                  missed: "Süresi doldu",
                  cancelled: "İptal edildi",
                }[member.task.status],
                acceptedAt: member.task.acceptedAt,
                dueAt: member.task.dueAt,
                reward: TERMS[member.task.kind].reward,
              }
            : null,
          actionIds: ownActions(
            actions,
            /^underworld:(?:complete:|accept:|promote$|lead$|support$|leave$)/,
          ),
        }
      : null,
    cases: x.cases.flatMap((row, index) => {
      const incident = x.incidents[index];
      const own = incident.personId === id;
      if (!own && (incident.offscreen ? row.decidedAt === null : !row.compensationDue)) return [];
      const chapter = catalog.get(incident.chapterId);
      return [
        {
          id: row.id,
          scope: own ? "personal" : incident.offscreen ? "public" : "estate",
          districtId: chapter.districtId,
          subject: incident.offscreen
            ? staffName(catalog.get(incident.offenderChapterId), incident.personId)
            : person(s, incident.personId).name,
          status: own || incident.offscreen ? CASE_STATES[row.status] : "Tereke tazminatı",
          reportedAt: row.reportedAt,
          reviewDay: row.reviewDay,
          decidedAt: row.decidedAt,
          restrictionUntil: own ? row.restrictionUntil : null,
          fine: own ? row.fineDue : 0,
          compensation: incident.offscreen ? 0 : row.compensationDue,
          evidence: own
            ? incident.evidence
                .filter(({ learnedAt }) => learnedAt !== null)
                .map(({ kind, source, observedAt, learnedAt }) => ({
                  kind: EVIDENCE_NAMES[kind],
                  source: kind === "stock" ? chapter.name : staffName(chapter, source),
                  observedAt,
                  learnedAt,
                }))
            : [],
          actionIds: ownActions(
            actions,
            new RegExp(`^underworld:(?:report|inspect|fine|compensation):${row.id}$`),
          ),
        },
      ];
    }),
    actionIds: actions.map(({ id }) => id),
  };
}

const TRANSLATIONS = new Map(
  [
    ["Depo düzenleme", "Warehouse sorting", "Porządkowanie magazynu"],
    ["Kayıtlı sevkiyat", "Registered delivery", "Zarejestrowana dostawa"],
    ["Sevkiyat yönetimi", "Dispatch coordination", "Koordynacja wysyłki"],
    ["Aday", "Probationary member", "Członek na okresie próbnym"],
    ["Üye", "Member", "Członek"],
    ["Koordinatör", "Coordinator", "Koordynator"],
    ["Lider", "Leader", "Lider"],
    [
      "Kayıp kaydı, bildirim bekliyor",
      "Loss logged, awaiting report",
      "Brak w spisie, oczekiwanie na zgłoszenie",
    ],
    ["Şüphe, soruşturma açık", "Suspicion under investigation", "Podejrzenie w toku dochodzenia"],
    ["İnceleme ve duruşma", "Evidence review and hearing", "Ocena dowodów i rozprawa"],
    ["Mahkûmiyet", "Conviction", "Skazanie"],
    ["Beraat", "Acquittal", "Uniewinnienie"],
    ["Depo sayım kaydı", "Warehouse inventory record", "Spis magazynowy"],
    ["Doğrudan tanık ifadesi", "Eyewitness statement", "Zeznanie bezpośredniego świadka"],
    ["Üye alımına görüş", "Meet a recruiter", "Porozmawiaj z rekruterem"],
    ["Daveti kabul et", "Accept membership invitation", "Przyjmij zaproszenie do organizacji"],
    ["Kayıt dışı sevkiyat", "Off-the-books shipment", "Dostawa poza ewidencją"],
    ["Tedarik görüşmesi", "Negotiate a supply agreement", "Negocjuj umowę dostaw"],
    ["Görevi tamamla", "Complete task", "Ukończ zadanie"],
    ["Görevi al", "Accept task", "Przyjmij zadanie"],
    [
      "Yetkiliyle buluş; kabul edersen davet ertesi günün sonuna dek geçerli.",
      "Meet a recruiter. The invitation is valid through the end of the following day.",
      "Porozmawiaj z rekruterem. Zaproszenie jest ważne do końca następnego dnia.",
    ],
    [
      "Aday olarak gir; güven ve sorumluluk tamamlanan işlerle artar.",
      "Join on probation. Completed tasks build trust and responsibility.",
      "Dołącz na okres próbny. Ukończone zadania zwiększają zaufanie i odpowiedzialność.",
    ],
    [
      "Örgüt bu aralar üye almıyor.",
      "The organization is currently closed to new members.",
      "Organizacja obecnie nie przyjmuje członków.",
    ],
    ["Davetin süresi doldu.", "The invitation has expired.", "Zaproszenie wygasło."],
    [
      "Önce açık soruşturmanın sonucunu bekle.",
      "Wait for the current investigation to conclude.",
      "Poczekaj na zakończenie bieżącego dochodzenia.",
    ],
    [
      "Görüşme ilişkileri iyileştirir. Güçlü anlaşma depolar arasında ücretli ikmal açar.",
      "Negotiations improve relations. A strong agreement opens paid transfers between depots.",
      "Rozmowy poprawiają stosunki. Trwałe porozumienie otwiera płatne dostawy między magazynami.",
    ],
    [
      "Son görüşmenin üzerinden üç gün geçmeli.",
      "Wait three days between negotiations.",
      "Między rozmowami muszą minąć trzy dni.",
    ],
    [
      "Tedarik ittifakı kuruldu.",
      "A supply alliance was formed.",
      "Zawarto sojusz zaopatrzeniowy.",
    ],
    ["Tedarik anlaşmazlığı hafifledi.", "The supply dispute eased.", "Spór o zaopatrzenie osłabł."],
    ["Depo kaybını bildir", "Report the warehouse loss", "Zgłoś brak w magazynie"],
    [
      "Bildirim dosyayı açar. Soruşturma ve delil incelemesi ikişer gün sürer.",
      "Reporting opens a case. Investigation and evidence review each take two days.",
      "Zgłoszenie otwiera sprawę. Dochodzenie i ocena dowodów trwają po dwa dni.",
    ],
    [
      "Dosyadaki erişilebilir kanıtı incele",
      "Inspect available case evidence",
      "Sprawdź dostępne dowody",
    ],
    [
      "Sayım kaydı kaybı gösterir. Bağımsız tanık kimliği doğrular. Mahkûmiyet için iki kaynak gerekir.",
      "The stock record shows the loss. An independent witness can identify the actor. Conviction requires both sources.",
      "Spis wykazuje brak. Niezależny świadek może rozpoznać sprawcę. Skazanie wymaga obu dowodów.",
    ],
    [
      "Dosyada yeni kanıt yok.",
      "The file contains no new evidence.",
      "W aktach nie ma nowych dowodów.",
    ],
    [
      "Dosyada erişilebilir kanıtlar öğrenildi.",
      "Available case evidence was disclosed.",
      "Ujawniono dostępne dowody w sprawie.",
    ],
    ["Mahkeme cezasını öde", "Pay the court fine", "Zapłać grzywnę sądową"],
    ["Depo tazminatını öde", "Pay warehouse compensation", "Zapłać odszkodowanie magazynowi"],
    [
      "Kişisel ceza belediyeye ödenir.",
      "The personal fine goes to the municipality.",
      "Grzywna osobista trafia do gminy.",
    ],
    [
      "Belgeli tazminat zarar gören deponun hesabına ödenir.",
      "Documented compensation is paid to the affected warehouse.",
      "Udokumentowane odszkodowanie trafia do poszkodowanego magazynu.",
    ],
    [
      "Görevin süresi yetersiz.",
      "There is too little time left on this task.",
      "Pozostało za mało czasu na to zadanie.",
    ],
    [
      "Uygun, ödeme yapabilen alıcı yok.",
      "No eligible buyer can fund the order.",
      "Brak odpowiedniego nabywcy z dostępnymi środkami.",
    ],
    [
      "Görev kabul edildi; kaynak ayrıldı.",
      "Task accepted and resources reserved.",
      "Przyjęto zadanie i zarezerwowano środki.",
    ],
    ["Örgütte terfi iste", "Ask for an organization promotion", "Poproś o awans w organizacji"],
    [
      "Örgütte terfi ettin.",
      "You earned an organization promotion.",
      "Otrzymujesz awans w organizacji.",
    ],
    [
      "Örgüt liderliğini üstlen",
      "Take over organization leadership",
      "Obejmij przywództwo w organizacji",
    ],
    [
      "En az 80 güven ve 8 sorumluluk gerekir. Lider olarak sekiz gün arayla kadro desteği sağlayabilirsin.",
      "Requires 80 trust and 8 responsibility. A leader can support the roster every eight days.",
      "Wymagane jest 80 zaufania i 8 odpowiedzialności. Lider może wspierać załogę co osiem dni.",
    ],
    [
      "Örgütün liderliğini üstlendin.",
      "You took over organization leadership.",
      "Obejmujesz przywództwo w organizacji.",
    ],
    ["Kadro desteği sağla", "Fund the roster", "Wesprzyj załogę finansowo"],
    [
      "Kasadan 90 TL çalışanlara ödenir; sadakat ve hazırlık artar.",
      "The treasury pays staff 90 TL. Loyalty and readiness improve.",
      "Kasa wypłaca pracownikom 90 TL. Rosną lojalność i gotowość.",
    ],
    [
      "Kadro desteği için sekiz gün geçmeli.",
      "Wait eight days before supporting the roster again.",
      "Przed kolejnym wsparciem załogi odczekaj osiem dni.",
    ],
    [
      "Kadroya destek ödemesi yapıldı.",
      "The roster received its support payment.",
      "Załoga otrzymała wsparcie finansowe.",
    ],
    ["Örgütten ayrıl", "Leave the organization", "Odejdź z organizacji"],
    [
      "Görevin kapanır; geçmiş ilişkiler ve ödenmemiş yükümlülükler kalır.",
      "Your task closes. Former relationships and unpaid obligations remain.",
      "Zadanie zostanie zamknięte. Dawne relacje i niezapłacone zobowiązania pozostaną.",
    ],
    [
      CAPACITY_REASON,
      "Open case or membership records must be resolved first.",
      "Najpierw trzeba zakończyć otwarte sprawy lub wpisy członkostwa.",
    ],
    [
      MONEY_REASON,
      "The available funds or stock cannot cover this.",
      "Dostępne środki lub zapasy nie wystarczą.",
    ],
    [
      WORK_REASON,
      "Go to the organization’s workplace and finish during opening hours.",
      "Udaj się do miejsca pracy organizacji i zakończ przed zamknięciem.",
    ],
    [
      SOCIAL_REASON,
      "Go to the organization’s meeting place during opening hours.",
      "Udaj się do miejsca spotkań organizacji w godzinach otwarcia.",
    ],
    [
      OFFICE_REASON,
      "Visit the district public service office during opening hours.",
      "Odwiedź urząd w tej dzielnicy w godzinach otwarcia.",
    ],
    [
      TASK_REASON,
      "Complete the open task or wait for its deadline.",
      "Ukończ otwarte zadanie lub poczekaj na upływ terminu.",
    ],
    [
      TRUST_REASON,
      "More trust and completed tasks are required.",
      "Potrzeba więcej zaufania i ukończonych zadań.",
    ],
    [
      RESTRICTION_REASON,
      "A personal sanction temporarily prevents this action.",
      "Sankcja osobista czasowo blokuje tę czynność.",
    ],
    [
      PAYMENT_HOURS,
      "Payment requires more than five minutes before midnight.",
      "Wpłatę można wykonać najpóźniej sześć minut przed północą.",
    ],
    [
      CREDIT_REASON,
      "A court obligation or restriction blocks this credit application.",
      "Zobowiązanie lub ograniczenie sądowe blokuje wniosek kredytowy.",
    ],
    [PENDING, "Time allocated for the action.", "Zarezerwowano czas na czynność."],
    [
      "Bu işlem için yeterli bakiye yok.",
      "You do not have enough funds for this action.",
      "Brak środków na tę czynność.",
    ],
    ["İşlem tamamlanmadı.", "The action did not complete.", "Czynność nie została ukończona."],
    [
      "Yer değiştiği için işlem tamamlanmadı.",
      "The location changed before the action could finish.",
      "Lokalizacja zmieniła się przed zakończeniem czynności.",
    ],
    [
      "Örgüte aday üye olarak katıldın.",
      "You joined the organization on probation.",
      "Dołączasz do organizacji na okres próbny.",
    ],
    [
      "Örgüt daveti alındı.",
      "You received a membership invitation.",
      "Otrzymujesz zaproszenie do organizacji.",
    ],
    [
      "Görev süresinde tamamlanmadı.",
      "The task missed its deadline.",
      "Nie ukończono zadania w terminie.",
    ],
    [
      "Alıcı siparişi artık karşılayamıyor.",
      "The buyer can no longer fund the order.",
      "Nabywca nie może już sfinansować zamówienia.",
    ],
    [
      "Görev tamamlandı; ücret ödendi ve güven arttı.",
      "Task completed. You were paid and earned trust.",
      "Zadanie ukończone. Wypłacono wynagrodzenie i wzrosło zaufanie.",
    ],
    [
      "Kayıt dışı sevkiyat ücreti",
      "Off-the-books shipment payment",
      "Zapłata za dostawę poza ewidencją",
    ],
    [
      "Kayıt dışı sevkiyat yapıldı; depoda bir kayıp kayda geçti.",
      "The shipment went ahead. A warehouse loss was recorded.",
      "Dostawa doszła do skutku. Zarejestrowano brak w magazynie.",
    ],
    ["Mahkeme cezası ödendi.", "The court fine was paid.", "Grzywna sądowa została zapłacona."],
    [
      "Depo tazminatı ödendi.",
      "Warehouse compensation was paid.",
      "Odszkodowanie dla magazynu zostało zapłacone.",
    ],
    [
      "Üyelik ölümle sona erdi.",
      "Membership ended upon death.",
      "Członkostwo ustało wraz ze śmiercią.",
    ],
    [
      "Örgüt üyeliği sona erdi.",
      "Organization membership ended.",
      "Członkostwo w organizacji zakończyło się.",
    ],
    [
      "Görevin süresi doldu; güven azaldı.",
      "The task expired and trust fell.",
      "Termin zadania minął i zaufanie spadło.",
    ],
    [
      "Depo kaybı bildirildi; soruşturma açıldı.",
      "A warehouse loss was reported. An investigation opened.",
      "Zgłoszono brak w magazynie. Rozpoczęto dochodzenie.",
    ],
    [
      "Soruşturma tamamlandı; dosya karar için inceleniyor.",
      "The investigation ended. The case is under review for a verdict.",
      "Dochodzenie zakończone. Trwa ocena sprawy przed wyrokiem.",
    ],
    [
      "Mahkûmiyet kaydedildi; ceza, tazminat ve 30 günlük yaptırım uygulandı.",
      "Convicted. A fine, compensation and a 30-day restriction were imposed.",
      "Zapadł wyrok skazujący. Nałożono grzywnę, odszkodowanie i 30 dni ograniczeń.",
    ],
    [
      "Kimliği doğrulayan kanıt yetersiz; beraat kaydedildi.",
      "Identity evidence was insufficient. The court acquitted the accused.",
      "Dowody tożsamości były niewystarczające. Sąd uniewinnił oskarżonego.",
    ],
    [
      "Ayrılan çalışanın ödenmemiş cezası kendi kaydında kaldı.",
      "The retired worker’s unpaid fine remains on their own record.",
      "Niezapłacona grzywna emerytowanego pracownika pozostała w jego własnych aktach.",
    ],
    ["Kadro değişikliği", "Staff change", "Zmiana w załodze"],
    ["Tedarik anlaşmazlığı", "Supply dispute", "Spór o zaopatrzenie"],
    ["Depoda kayıp kaydedildi.", "Warehouse loss reported.", "Odnotowano brak w magazynie."],
    ["İttifak", "Alliance", "Sojusz"],
    ["Rekabet", "Rivalry", "Rywalizacja"],
    ["Tarafsız", "Neutral", "Neutralne"],
    ["Etkin", "Active", "Aktywne"],
    ["Ayrıldı", "Former member", "Były członek"],
    ["Kabul edildi", "Accepted", "Przyjęto"],
    ["Tamamlandı", "Completed", "Ukończono"],
    ["Süresi doldu", "Expired", "Termin minął"],
    ["İptal edildi", "Cancelled", "Anulowano"],
    ["Tereke tazminatı", "Estate compensation claim", "Roszczenie wobec spadku"],
  ].map(([source, en, pl]) => [source, [en, pl]]),
);

const FORMATS = [
  [
    /^(\d+) TL örgüt ücreti\. Sayım kaydı ve tanık varsa (\d+) TL ceza, (\d+) TL tazminat ve (\d+) gün kısıtlama\. Yalnız sayım varsa beraat\.$/,
    "$1 TL from the chapter. A stock record and witness mean a $2 TL fine, $3 TL compensation and a $4-day restriction. Only a stock record means acquittal.",
    "$1 TL z kasy organizacji. Spis i świadek oznaczają $2 TL grzywny, $3 TL odszkodowania i $4 dni ograniczeń. Sam spis oznacza uniewinnienie.",
  ],
  [
    /^(\d+) TL örgüt kasasından\. Süresinde tamamlanırsa güven ve sorumluluk artar\.$/,
    "$1 TL from the chapter treasury. Finish on time to earn trust and responsibility.",
    "$1 TL z kasy organizacji. Ukończ w terminie, aby zwiększyć zaufanie i odpowiedzialność.",
  ],
  [
    /^(\d+) TL örgüt kasasından\. Verilen süre içinde iş yerine dönüp görevi tamamla\.$/,
    "$1 TL from the chapter treasury. Return to the workplace and finish by the deadline.",
    "$1 TL z kasy organizacji. Wróć do miejsca pracy i ukończ zadanie w terminie.",
  ],
  [
    /^Terfi için güven (\d+) ve sorumluluk (\d+) olmalı\.$/,
    "Promotion requires $1 trust and $2 responsibility.",
    "Awans wymaga $1 zaufania i $2 odpowiedzialności.",
  ],
];

export function localizeUnderworldText(text, language) {
  if ((language !== "en" && language !== "pl") || typeof text !== "string") return text;
  const index = language === "pl" ? 1 : 0;
  if (TRANSLATIONS.has(text)) return TRANSLATIONS.get(text)[index];
  for (const [pattern, en, pl] of FORMATS)
    if (pattern.test(text)) return text.replace(pattern, index ? pl : en);
  if (text.includes(" · "))
    return text
      .split(" · ")
      .map((part) => TRANSLATIONS.get(part)?.[index] ?? part)
      .join(" · ");
  return text;
}
