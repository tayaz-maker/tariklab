import type { Command, CommandResult, Person, SocietyEvent, WorldState } from "../domain/types.ts";
import type {
  Faction,
  FactionId,
  KnowledgeMemory,
  SocialMember,
  SocialState,
  SocialView,
  TerritoryId,
  Testimony,
} from "../domain/social-types.ts";
import { FACTIONS } from "../domain/content.ts";
import { BUILDINGS, hasLineOfSight } from "../domain/world.ts";
import { emit, adjustRelation } from "./events.ts";
import { transfer } from "./ledger.ts";
import { draw } from "./random.ts";
import { projectJustice, validateJustice, policeRepresentative } from "./justice.ts";
const DAY = 1440;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const IDS: FactionId[] = ["dock", "hill", "night"];
const criticalKinds = new Set([
  "assault",
  "faction_betrayal",
  "false_testimony",
  "death",
  "marriage",
  "separation",
  "faction_succession",
]);
const bounded = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const yes = (reason: string): CommandResult => ({ ok: true, reason, events: [] });
const no = (reason: string): CommandResult => ({ ok: false, reason, events: [] });
const registry = new WeakMap<WorldState, { size: number; people: Map<string, Person> }>();
const eventRegistry = new WeakMap<
  WorldState,
  { size: number; events: Map<string, SocietyEvent> }
>();
function people(s: WorldState): Map<string, Person> {
  let c = registry.get(s);
  if (!c || c.size !== s.npcs.length) {
    c = { size: s.npcs.length, people: new Map([s.player, ...s.npcs].map((p) => [p.id, p])) };
    registry.set(s, c);
  }
  return c.people;
}
function events(s: WorldState): Map<string, SocietyEvent> {
  let c = eventRegistry.get(s);
  if (!c || c.size > s.events.length) {
    c = { size: 0, events: new Map() };
    eventRegistry.set(s, c);
  }
  for (; c.size < s.events.length; c.size++) c.events.set(s.events[c.size].id, s.events[c.size]);
  return c.events;
}
const adult = (p: Person | undefined) => Boolean(p?.alive && p.age >= 18);
const member = (s: WorldState, id: string) =>
  s.social.factions.find((f) => f.members.some((m) => m.personId === id));
const near = (a: Person, b: Person) =>
  a.location.scene === b.location.scene &&
  Math.hypot(a.location.x - b.location.x, a.location.y - b.location.y) <= 3 &&
  hasLineOfSight(a.location, b.location, a.location.scene);
function at(s: WorldState, id: string) {
  const b = BUILDINGS.find((b) => b.id === id);
  return (
    s.player.location.scene === id ||
    Boolean(
      b &&
      s.player.location.scene === "outside" &&
      Math.hypot(s.player.location.x - b.door.x, s.player.location.y - b.door.y) <= 2,
    )
  );
}
function zeroAccount(s: WorldState, id: string) {
  if (!Object.hasOwn(s.accounts, id)) {
    s.accounts[id] = 0;
    s.ledgerCheckpoint.balances[id] = 0;
  }
}
function newMember(id: string, role: SocialMember["role"], minute: number): SocialMember {
  return { personId: id, role, loyalty: 70, joinedAt: minute, lastServiceAt: -DAY, services: 0 };
}
export function initializeSocial(s: WorldState, legacy = false): SocialState {
  const candidates = s.npcs
    .filter((p) => p.local && adult(p) && !["n5", "n6"].includes(p.id))
    .sort((a, b) => compare(a.id, b.id));
  const factions: Faction[] = FACTIONS.map((f, i) => {
    const roster = candidates
      .slice(i * 6, i * 6 + 6)
      .map((p, j) =>
        newMember(p.id, j === 0 ? "leader" : j === 1 ? "officer" : "member", s.minute),
      );
    const treasuryAccount = `faction:${f.id}`;
    zeroAccount(s, treasuryAccount);
    return {
      id: f.id as FactionId,
      name: f.name,
      treasuryAccount,
      members: roster,
      rivals: IDS.filter((id) => id !== f.id),
      heat: bounded(Number(s.flags[`faction:${f.id}`] ?? 0)),
    };
  });
  const previous = IDS.includes(s.flags.faction as FactionId)
    ? (s.flags.faction as FactionId)
    : null;
  if (previous && adult(s.player))
    factions.find((f) => f.id === previous)!.members.push(newMember("player", "member", s.minute));
  const teachers = s.npcs.filter((p) => adult(p));
  const leader = teachers.find((p) => p.id === "n6") ?? teachers[0];
  if (factions.some((f) => !f.members.length) || !leader)
    throw Error("Social initialization requires living adult NPCs.");
  const social: SocialState = {
    police: { dispatchCapacity: 2, cases: [], custody: null },
    version: 1,
    updatedTick: s.tick,
    factions,
    territories: [
      {
        id: "shore",
        name: "Rıhtım",
        buildingId: "b-taxi",
        influence: { dock: 50, hill: 30, night: 20 },
        lastChangedAt: s.minute,
      },
      {
        id: "market",
        name: "Çarşı",
        buildingId: "b-market",
        influence: { dock: 30, hill: 30, night: 40 },
        lastChangedAt: s.minute,
      },
      {
        id: "hill",
        name: "Yokuş",
        buildingId: "b-school",
        influence: { dock: 20, hill: 55, night: 25 },
        lastChangedAt: s.minute,
      },
    ],
    knowledge: {},
    bonds: [],
    eventCursor: 0,
    lastDay: Math.floor(s.minute / DAY),
    lastRumorAt: {},
    factionChangedAt: {},
    testimonies: [],
    club: {
      id: "study-circle",
      name: "Ufuk Çalışma Kulübü",
      leaderId: leader.id,
      members: [{ personId: leader.id, standing: 100, role: "mentor" }],
      activity: null,
      lastSessionAt: {},
    },
  };
  if (previous) social.factionChangedAt.player = s.minute;
  // Migration reads observed historic events only; it does not fabricate meetings or opening funds.
  s.social = social;
  if (legacy) social.factionChangedAt = previous ? { player: s.minute } : {};
  ingest(s);
  return social;
}
function retain(s: WorldState, m: KnowledgeMemory): void {
  const list = s.social.knowledge[m.ownerId] ?? (s.social.knowledge[m.ownerId] = []);
  const existing = list.find((x) => x.eventId === m.eventId);
  if (existing) {
    if (m.confidence > existing.confidence || m.mode === "direct") Object.assign(existing, m);
    return;
  }
  list.push(m);
  // Latest sixteen critical memories are pinned; consequences and original events stay durable.
  if (list.length > 64) {
    const pinned = new Set(list.filter((x) => x.critical).slice(-16));
    const removable = list
      .filter((x) => !pinned.has(x))
      .sort(
        (a, b) =>
          a.salience - b.salience || a.learnedAt - b.learnedAt || compare(a.eventId, b.eventId),
      );
    const remove = removable[0];
    list.splice(list.indexOf(remove), 1);
  }
}
function ingest(s: WorldState): void {
  const peopleById = people(s);
  const end = s.events.length;
  for (; s.social.eventCursor < end; s.social.eventCursor++) {
    const event = s.events[s.social.eventCursor],
      observers = new Set([...event.actors, ...event.witnesses]);
    if (event.visibility === "public" && event.targetId && peopleById.has(event.targetId))
      observers.add(event.targetId);
    for (const id of observers)
      if (peopleById.get(id)?.alive)
        retain(s, {
          eventId: event.id,
          ownerId: id,
          sourceId: id,
          mode: "direct",
          confidence: 100,
          salience: criticalKinds.has(event.kind) ? 100 : 65,
          critical: criticalKinds.has(event.kind),
          learnedAt: event.minute,
          lastDecayDay: Math.floor(s.minute / DAY),
          chain: [id],
        });
    if (
      [
        "conversation",
        "relationship_dispute",
        "faction_betrayal",
        "faction_join",
        "faction_departure",
        "club_session",
        "false_testimony",
      ].includes(event.kind)
    ) {
      const actors = event.actors.filter((id) => peopleById.has(id));
      for (const from of actors)
        for (const to of actors)
          if (from !== to) {
            let bond = s.social.bonds.find((b) => b.from === from && b.to === to);
            if (!bond && s.social.bonds.length < 4096) {
              bond = { from, to, familiarity: 0, loyalty: 0, updatedAt: s.minute };
              s.social.bonds.push(bond);
            }
            if (bond) {
              bond.familiarity = bounded(bond.familiarity + 2);
              bond.loyalty = bounded(
                bond.loyalty +
                  ([
                    "relationship_dispute",
                    "faction_betrayal",
                    "faction_departure",
                    "false_testimony",
                  ].includes(event.kind)
                    ? -10
                    : 2),
                -100,
                100,
              );
              bond.updatedAt = s.minute;
            }
          }
    }
    if (event.kind === "assault")
      for (const id of event.actors.slice(0, 1)) {
        const f = member(s, id);
        if (f) {
          f.heat = bounded(f.heat + 8);
          s.flags[`faction:${f.id}`] = f.heat;
        }
      }
  }
}
export function shareRumor(
  s: WorldState,
  senderId: string,
  recipientId: string,
  eventId: string,
): boolean {
  ingest(s);
  const sender = people(s).get(senderId),
    recipient = people(s).get(recipientId);
  const source = s.social.knowledge[senderId]?.find((m) => m.eventId === eventId);
  if (
    !sender?.alive ||
    !recipient?.alive ||
    senderId === recipientId ||
    !source ||
    !near(sender, recipient) ||
    source.chain.includes(recipientId) ||
    source.chain.length >= 8 ||
    s.minute - (s.social.lastRumorAt[senderId] ?? -DAY) < 20
  )
    return false;
  if (
    s.social.knowledge[recipientId]?.some(
      (m) => m.eventId === eventId && m.confidence >= Math.floor(source.confidence * 0.75),
    )
  )
    return false;
  const confidence = Math.floor(source.confidence * 0.75);
  if (confidence < 10) return false;
  retain(s, {
    ...source,
    ownerId: recipientId,
    sourceId: senderId,
    mode: "rumor",
    confidence,
    salience: Math.max(10, source.salience - 15),
    learnedAt: s.minute,
    lastDecayDay: Math.floor(s.minute / DAY),
    chain: [...source.chain, recipientId],
  });
  s.social.lastRumorAt[senderId] = s.minute;
  adjustRelation(s, recipientId, senderId, 1);
  return true;
}
function shiftTerritory(s: WorldState, factionId: FactionId, territoryId: TerritoryId): void {
  const zone = s.social.territories.find((z) => z.id === territoryId)!;
  const donor = IDS.filter((id) => id !== factionId).sort(
    (a, b) => zone.influence[b] - zone.influence[a] || compare(a, b),
  )[0];
  if (zone.influence[donor] > 0 && zone.influence[factionId] < 100) {
    zone.influence[donor]--;
    zone.influence[factionId]++;
    zone.lastChangedAt = s.minute;
  }
}
function leave(s: WorldState, id: string, betrayal: boolean): void {
  const f = member(s, id);
  if (!f) return;
  f.members = f.members.filter((m) => m.personId !== id);
  const leader = f.members.find((m) => m.role === "leader");
  if (leader) {
    adjustRelation(s, leader.personId, id, betrayal ? -20 : -8, 0, 0, betrayal ? 20 : 5);
  }
  emit(
    s,
    betrayal ? "faction_betrayal" : "faction_departure",
    betrayal ? "Çevre değiştirmek eski bağları sarstı." : "Bir çevreden ayrılma kayda geçti.",
    [id, ...(leader ? [leader.personId] : [])],
    null,
    "private",
  );
  if (id === "player") {
    s.flags.faction = "";
    s.player.influence = bounded(s.player.influence - 5);
  }
}
export function reconcileSocialAfterDeath(s: WorldState, personId: string): void {
  if (!s.social) return;
  const byId = people(s);
  for (const f of s.social.factions) {
    const wasLeader = f.members.some((m) => m.personId === personId && m.role === "leader");
    f.members = f.members.filter((m) => m.personId !== personId && adult(byId.get(m.personId)));
    if (!f.members.some((m) => m.role === "leader")) {
      let next = f.members
        .slice()
        .sort(
          (a, b) =>
            b.loyalty - a.loyalty || b.services - a.services || compare(a.personId, b.personId),
        )[0];
      if (!next) {
        const candidate = s.npcs.find((p) => adult(p) && !member(s, p.id));
        if (candidate) {
          next = newMember(candidate.id, "leader", s.minute);
          f.members.push(next);
        }
      }
      if (next) {
        next.role = "leader";
        if (wasLeader)
          emit(
            s,
            "faction_succession",
            `${f.name} yeni temsilcisini seçti.`,
            [next.personId],
            null,
            "public",
          );
      }
    }
  }
  s.social.club.members = s.social.club.members.filter(
    (m) => m.personId !== personId && adult(byId.get(m.personId)),
  );
  if (s.social.club.leaderId === personId || !adult(byId.get(s.social.club.leaderId))) {
    const next = s.social.club.members[0]?.personId ?? s.npcs.find((p) => adult(p))?.id;
    if (next) {
      s.social.club.leaderId = next;
      if (!s.social.club.members.some((m) => m.personId === next))
        s.social.club.members.push({ personId: next, role: "mentor", standing: 100 });
    }
  }
  if (s.social.club.activity?.personId === personId) s.social.club.activity = null;
  if (personId === "player") s.flags.faction = "";
}
function statementClosed(s: WorldState, t: Testimony): boolean {
  return (
    Object.hasOwn(s.flags, `policeClosed:${t.crimeId}`) ||
    s.social.police.cases.some(
      (c) => c.crimeId === t.crimeId && (c.status === "acquitted" || c.status === "fined"),
    )
  );
}
export function recordTestimony(
  s: WorldState,
  speakerId: string,
  crimeId: string,
  accusedId: string,
): Testimony | null {
  const crime = s.crimes.find((c) => c.id === crimeId);
  if (
    !crime ||
    !adult(people(s).get(speakerId)) ||
    !adult(people(s).get(accusedId)) ||
    crime.status === "resolved" ||
    s.social.testimonies.some((t) => t.crimeId === crimeId && t.speakerId === speakerId) ||
    s.social.testimonies.filter((t) => t.status === "unverified" && !statementClosed(s, t))
      .length >= 16
  )
    return null;
  const direct = crime.witnesses.includes(speakerId) || crime.victim === speakerId;
  const hearsay = Boolean(
    s.social.knowledge[speakerId]?.some(
      (m) => m.mode === "rumor" && events(s).get(m.eventId)?.kind === "assault",
    ),
  );
  const record: Testimony = {
    id: `statement:${s.nextId++}`,
    crimeId,
    speakerId,
    accusedId,
    basis: direct ? "direct" : hearsay ? "hearsay" : "unsupported",
    confidence: direct ? 80 : hearsay ? 30 : 10,
    submittedAt: s.minute,
    status: "unverified",
    reviewedAt: null,
  };
  s.social.testimonies.push(record);
  if (s.social.testimonies.length > 128) {
    const oldest = s.social.testimonies.findIndex(
      (t) => t.status !== "unverified" || statementClosed(s, t),
    );
    if (oldest >= 0) {
      const removed = s.social.testimonies.splice(oldest, 1)[0];
      for (const c of s.social.police.cases)
        c.testimonyIds = c.testimonyIds.filter((id) => id !== removed.id);
    }
  }
  emit(
    s,
    "testimony",
    "Bir beyan kayda alındı; doğrulanmış fiziksel kanıt sayılmaz.",
    [speakerId, ...[policeRepresentative(s)].filter((id): id is string => id !== null)],
    accusedId,
    "private",
  );
  return record;
}
export function applySocialCommand(s: WorldState, c: Command): CommandResult | null {
  const supported = new Set([
    "JOIN_FACTION",
    "LEAVE_FACTION",
    "FACTION_DONATE",
    "FACTION_SERVICE",
    "FACTION_PROMOTE",
    "SHARE_RUMOR",
    "FILE_TESTIMONY",
    "CLUB_JOIN",
    "CLUB_SESSION",
  ]);
  if (!supported.has(c.type)) return null;
  if (!s.social || !adult(s.player))
    return no("Bu toplumsal etkileşim yetişkin bir karakter gerektirir.");
  const a = c.args,
    p = s.player,
    f = member(s, "player"),
    m = f?.members.find((m) => m.personId === "player");
  switch (c.type) {
    case "JOIN_FACTION": {
      const target = s.social.factions.find((f) => f.id === a.factionId);
      if (!target || p.reputation < 5)
        return no("Bir çevreye katılmak için en az 5 itibar gerekir.");
      if (f === target) return no("Zaten bu çevrenin üyesisin.");
      if (s.minute - (s.social.factionChangedAt.player ?? -DAY) < DAY)
        return no("Çevre değiştirmeden önce bir oyun günü bekle.");
      if (f) leave(s, "player", true);
      target.members.push(newMember("player", "member", s.minute));
      s.flags.faction = target.id;
      s.social.factionChangedAt.player = s.minute;
      p.influence = bounded(p.influence + 5);
      emit(
        s,
        "faction_join",
        `${target.name} üyeliğin başladı.`,
        ["player", target.members.find((x) => x.role === "leader")!.personId],
        null,
        "private",
      );
      return yes("Üyeliğin kaydedildi. Kasa, sadakat ve mahalle işi sonuçları kalıcıdır.");
    }
    case "LEAVE_FACTION":
      if (!f) return no("Bir çevrenin üyesi değilsin.");
      else {
        leave(s, "player", false);
        s.social.factionChangedAt.player = s.minute;
        return yes("Çevreden ayrıldın; eski ilişkiler silinmedi.");
      }
    case "FACTION_DONATE": {
      const amount = a.amount;
      if (
        !f ||
        typeof amount !== "number" ||
        !Number.isSafeInteger(amount) ||
        amount < 100 ||
        amount > 100000
      )
        return no("Bağış 1–1000 TL arasında olmalı ve üyelik gerektirir.");
      if (!transfer(s, `social:${c.id}`, "player", f.treasuryAccount, amount, "faction-donation"))
        return no("Bakiye yetersiz veya işlem daha önce uygulandı.");
      return yes("Bağış ortak kasaya geçti; para üretmedi ve üyelik puanı satmadı.");
    }
    case "FACTION_SERVICE": {
      const zone = s.social.territories.find((z) => z.id === a.territoryId);
      if (
        !f ||
        !m ||
        !zone ||
        !at(s, zone.buildingId) ||
        s.minute - m.lastServiceAt < 60 ||
        p.wanted ||
        p.shift
      )
        return no(
          "Üye olarak hedef mekâna git; mahalle işi saatte bir yapılır, takip/vardiya sırasında yapılamaz.",
        );
      if (
        !transfer(
          s,
          `social:${c.id}`,
          f.treasuryAccount,
          "business:market",
          2000,
          "faction-neighborhood-service",
        )
      )
        return no("Ortak kasada 20 TL hizmet bütçesi gerekiyor.");
      m.lastServiceAt = s.minute;
      m.services++;
      m.loyalty = bounded(m.loyalty + 2);
      shiftTerritory(s, f.id, zone.id);
      p.influence = bounded(p.influence + 1);
      emit(
        s,
        "faction_service",
        `${zone.name} içinde finanse edilmiş bir mahalle işi tamamlandı.`,
        ["player"],
        null,
        "public",
      );
      return yes("Hizmet bedeli ödendi; bölgesel etki yalnızca bir puan değişti.");
    }
    case "FACTION_PROMOTE":
      if (!f || !m || m.role !== "member" || m.services < 3 || m.loyalty < 70)
        return no("Temsilcilik için en az üç mahalle işi ve 70 sadakat gerekir.");
      else {
        m.role = "officer";
        return yes("Çevrenin temsilcilerinden biri oldun; tek lider korunuyor.");
      }
    case "SHARE_RUMOR":
      return typeof a.npcId === "string" &&
        typeof a.eventId === "string" &&
        shareRumor(s, "player", a.npcId, a.eventId)
        ? yes("Duyum kaynağı ve azalan güvenle aktarıldı; kesin bilgiye dönüşmedi.")
        : no("Bilmediğin, tekrar edilmiş veya uzaktaki kişiye yönelik bir duyumu aktaramazsın.");
    case "FILE_TESTIMONY":
      return at(s, "b-police") &&
        typeof a.crimeId === "string" &&
        typeof a.accusedId === "string" &&
        recordTestimony(s, "player", a.crimeId, a.accusedId)
        ? yes("Beyan doğrulanmamış olarak alındı. Fiziksel delil veya otomatik aranma üretmez.")
        : no("Karakolda açık bir dosya için yeni ve geçerli bir beyan ver.");
    case "CLUB_JOIN":
      if (!at(s, "b-school") || s.social.club.members.some((m) => m.personId === "player"))
        return no("Kulübe akademide bir kez katılabilirsin.");
      else {
        s.social.club.members.push({ personId: "player", standing: 0, role: "newcomer" });
        return yes("Ufuk Çalışma Kulübü’ne katıldın. Hiçbir suç çevresine üyelik gerekmez.");
      }
    case "CLUB_SESSION": {
      const cm = s.social.club.members.find((m) => m.personId === "player");
      if (
        !cm ||
        s.player.location.scene !== "b-school" ||
        s.social.club.activity ||
        p.shift ||
        p.vehicleId ||
        p.wanted ||
        s.minute - (s.social.club.lastSessionAt.player ?? -DAY) < 60 ||
        s.flags.trainingSkill ||
        s.life.enrollments.some((e) => e.personId === "player" && e.activeUntil !== null)
      )
        return no(
          "Akademide boş zamanında kulübe katıl; ders/vardiya çakışması veya saatlik bekleme engeller.",
        );
      s.social.club.activity = { personId: "player", startedAt: s.minute, endsAt: s.minute + 30 };
      return yes("Otuz oyun dakikası boyunca akademide kal. Katılım sosyal konumunu geliştirir.");
    }
    default:
      return null;
  }
}
export function tickSocial(s: WorldState): void {
  if (!s.social) return;
  for (const faction of s.social.factions)
    faction.heat = bounded(Number(s.flags[`faction:${faction.id}`] ?? faction.heat));
  ingest(s);
  s.social.updatedTick = s.tick;
  const club = s.social.club,
    a = club.activity;
  if (a) {
    if (
      s.player.location.scene !== "b-school" ||
      s.player.shift ||
      s.player.wanted ||
      !s.player.alive ||
      s.flags.trainingSkill ||
      s.life.enrollments.some((e) => e.personId === "player" && e.activeUntil !== null)
    ) {
      club.activity = null;
    } else if (s.minute >= a.endsAt) {
      const m = club.members.find((m) => m.personId === a.personId)!;
      m.standing = bounded(m.standing + 10);
      m.role =
        m.standing >= 60 && s.player.skills.academic >= 30
          ? "mentor"
          : m.standing >= 20
            ? "member"
            : "newcomer";
      club.lastSessionAt[a.personId] = s.minute;
      club.activity = null;
      adjustRelation(s, club.leaderId, "player", 3, 2);
      emit(
        s,
        "club_session",
        "Çalışma kulübündeki gerçek katılımın tanınırlığını artırdı.",
        ["player", club.leaderId],
        null,
        "private",
      );
    }
  }
  const day = Math.floor(s.minute / DAY);
  if (day > s.social.lastDay) {
    s.social.lastDay = day;
    for (const list of Object.values(s.social.knowledge))
      for (const memory of list) {
        const elapsed = day - memory.lastDecayDay;
        if (elapsed > 0) {
          for (let i = 0; i < elapsed; i++)
            memory.salience = Math.max(
              memory.critical ? 25 : 0,
              Math.floor(memory.salience * (memory.critical ? 0.97 : 0.85)),
            );
          memory.lastDecayDay = day;
        }
      }
    for (const f of s.social.factions) {
      f.heat = bounded(f.heat - 1);
      s.flags[`faction:${f.id}`] = f.heat;
      for (const m of f.members)
        if (
          m.personId !== "player" &&
          adult(people(s).get(m.personId)) &&
          s.accounts[m.personId] > 100000
        ) {
          transfer(
            s,
            `faction-dues:${f.id}:${m.personId}:${day}`,
            m.personId,
            f.treasuryAccount,
            100,
            "faction-npc-dues",
          );
        }
      const zone = s.social.territories[(day + IDS.indexOf(f.id)) % 3];
      if (
        transfer(
          s,
          `faction-service:${f.id}:${day}`,
          f.treasuryAccount,
          "business:market",
          300,
          "faction-npc-service",
        )
      ) {
        shiftTerritory(s, f.id, zone.id);
        const leader = f.members.find((m) => m.role === "leader");
        if (leader) leader.services++;
      }
    }
  }
  if (s.tick % 600 === 0) {
    const locals = s.npcs.filter((p) => p.local && p.alive),
      speaker = locals[draw(s.seed, 79, s.tick) % locals.length];
    if (speaker) {
      const listener = locals.find((p) => p.id !== speaker.id && near(speaker, p));
      const memory = s.social.knowledge[speaker.id]
        ?.slice()
        .sort((a, b) => b.salience - a.salience)[0];
      if (listener && memory) shareRumor(s, speaker.id, listener.id, memory.eventId);
    }
  }
  for (const t of s.social.testimonies) {
    if (t.status !== "unverified") continue;
    const crime = s.crimes.find((c) => c.id === t.crimeId);
    // Only a reported case with a recorded physical eyewitness can corroborate a claim.
    if (
      !crime?.reported ||
      !crime.evidence.some((e) => e.startsWith("saw:")) ||
      s.minute < t.submittedAt + 10
    )
      continue;
    t.status = t.accusedId === crime.offender ? "corroborated" : "contradicted";
    t.reviewedAt = s.minute;
    if (t.status === "contradicted") {
      if (t.speakerId === "player")
        s.player.reputation = bounded(s.player.reputation - 10, -100, 100);
      const f = member(s, t.speakerId),
        m = f?.members.find((m) => m.personId === t.speakerId);
      if (m) m.loyalty = bounded(m.loyalty - 15);
      const officer = policeRepresentative(s);
      if (officer) adjustRelation(s, officer, t.speakerId, -20, 0, 0, 10);
      emit(
        s,
        "false_testimony",
        "Fiziksel tanık kaydıyla çelişen beyan güven kaybettirdi.",
        [...(officer ? [officer] : []), t.speakerId],
        null,
        "private",
      );
    }
  }
}
export function projectSocial(s: WorldState): SocialView {
  const byId = people(s),
    byEvent = events(s);
  return {
    police: projectJustice(s),
    factions: s.social.factions.map((f) => ({
      id: f.id,
      name: f.name,
      leaderName:
        byId.get(f.members.find((m) => m.role === "leader")!.personId)?.name ?? "Temsilci",
      memberCount: f.members.length,
      treasury: s.accounts[f.treasuryAccount],
      heat: f.heat,
      rivals: [...f.rivals],
      membership: f.members.find((m) => m.personId === "player") ?? null,
    })),
    territories: s.social.territories.map((z) => ({ ...z, influence: { ...z.influence } })),
    bonds: s.social.bonds.filter((b) => b.from === "player" || b.to === "player"),
    memories: (s.social.knowledge.player ?? []).map((m) => ({
      ...m,
      chain: [...m.chain],
      text: byEvent.get(m.eventId)?.text ?? "Geçmiş olay",
      kind: byEvent.get(m.eventId)?.kind ?? "memory",
    })),
    testimonies: s.social.testimonies.filter((t) => t.speakerId === "player"),
    club: {
      name: s.social.club.name,
      leaderName: byId.get(s.social.club.leaderId)?.name ?? "Kulüp temsilcisi",
      memberCount: s.social.club.members.length,
      membership: s.social.club.members.find((m) => m.personId === "player") ?? null,
      activity: s.social.club.activity,
    },
  };
}
export function validateSocial(s: WorldState): string[] {
  const errors: string[] = [],
    soci = s.social,
    byId = people(s);
  const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    typeof x === "number" && Number.isSafeInteger(x) && x >= min && x <= max;
  if (
    !soci ||
    soci.version !== 1 ||
    !Array.isArray(soci.factions) ||
    !Array.isArray(soci.territories) ||
    !soci.knowledge ||
    typeof soci.knowledge !== "object" ||
    !Array.isArray(soci.testimonies) ||
    !Array.isArray(soci.bonds) ||
    !soci.club ||
    !Array.isArray(soci.club.members)
  )
    return ["social-shape"];
  if (
    !integer(soci.updatedTick, 0, s.tick) ||
    !integer(soci.eventCursor, 0, s.events.length) ||
    !integer(soci.lastDay, 0, Math.floor(s.minute / DAY))
  )
    errors.push("social-clock");
  const ids = new Set<string>(),
    members = new Set<string>();
  for (const f of soci.factions) {
    if (
      !f ||
      !IDS.includes(f.id) ||
      ids.has(f.id) ||
      f.treasuryAccount !== `faction:${f.id}` ||
      !Object.hasOwn(s.accounts, f.treasuryAccount) ||
      !Array.isArray(f.members) ||
      !Array.isArray(f.rivals) ||
      !integer(f.heat, 0, 100)
    ) {
      errors.push("faction-shape");
      continue;
    }
    ids.add(f.id);
    if (f.members.filter((m) => m?.role === "leader").length !== 1)
      errors.push(`faction-leader:${f.id}`);
    for (const m of f.members) {
      if (
        !m ||
        members.has(m.personId) ||
        !adult(byId.get(m.personId)) ||
        !["leader", "officer", "member"].includes(m.role) ||
        !integer(m.loyalty, 0, 100) ||
        !integer(m.services) ||
        !integer(m.joinedAt, 0, s.minute) ||
        !integer(m.lastServiceAt, -DAY, s.minute)
      )
        errors.push(`faction-member:${f.id}`);
      else members.add(m.personId);
    }
    if (new Set(f.rivals).size !== 2 || f.rivals.some((id) => id === f.id || !IDS.includes(id)))
      errors.push(`faction-rival:${f.id}`);
  }
  if (ids.size !== 3) errors.push("faction-count");
  const zones = new Set<string>();
  for (const z of soci.territories) {
    if (
      !z ||
      !["shore", "market", "hill"].includes(z.id) ||
      zones.has(z.id) ||
      !z.influence ||
      !IDS.every((id) => integer(z.influence[id], 0, 100)) ||
      IDS.reduce((sum, id) => sum + z.influence[id], 0) !== 100 ||
      !BUILDINGS.some((b) => b.id === z.buildingId) ||
      !integer(z.lastChangedAt, 0, s.minute)
    )
      errors.push("territory");
    else zones.add(z.id);
  }
  if (zones.size !== 3) errors.push("territory-count");
  const byEvent = events(s);
  for (const [owner, list] of Object.entries(soci.knowledge)) {
    if (!byId.has(owner) || !Array.isArray(list) || list.length > 64) {
      errors.push("knowledge-owner");
      continue;
    }
    const observed = new Set<string>();
    for (const m of list) {
      if (
        !m ||
        m.ownerId !== owner ||
        !byEvent.has(m.eventId) ||
        observed.has(m.eventId) ||
        !byId.has(m.sourceId) ||
        !["direct", "rumor"].includes(m.mode) ||
        !integer(m.confidence, 0, 100) ||
        !integer(m.salience, 0, 100) ||
        typeof m.critical !== "boolean" ||
        !integer(m.learnedAt, 0, s.minute) ||
        !integer(m.lastDecayDay, 0, Math.floor(s.minute / DAY)) ||
        !Array.isArray(m.chain) ||
        m.chain.length < 1 ||
        m.chain.length > 8 ||
        m.chain.at(-1) !== owner ||
        new Set(m.chain).size !== m.chain.length ||
        m.chain.some((id) => !byId.has(id))
      ) {
        errors.push("knowledge-provenance");
        continue;
      }
      observed.add(m.eventId);
      const e = byEvent.get(m.eventId)!;
      if (
        ![...e.actors, ...e.witnesses, ...(e.visibility === "public" ? [e.targetId] : [])].includes(
          m.chain[0],
        )
      )
        errors.push("knowledge-unobserved-origin");
      if (
        m.mode === "direct" &&
        (m.chain.length !== 1 || m.sourceId !== owner || m.confidence !== 100)
      )
        errors.push("knowledge-direct");
      if (
        m.mode === "rumor" &&
        (m.chain.length < 2 ||
          m.sourceId !== m.chain.at(-2) ||
          m.confidence > Math.floor(100 * 0.75 ** (m.chain.length - 1)))
      )
        errors.push("knowledge-rumor-confidence");
    }
  }
  const bondKeys = new Set<string>();
  if (soci.bonds.length > 4096) errors.push("bond-limit");
  for (const b of soci.bonds) {
    const key = b ? JSON.stringify([b.from, b.to]) : "";
    if (
      !b ||
      !byId.has(b.from) ||
      !byId.has(b.to) ||
      b.from === b.to ||
      bondKeys.has(key) ||
      !integer(b.familiarity, 0, 100) ||
      !integer(b.loyalty, -100, 100) ||
      !integer(b.updatedAt, 0, s.minute)
    )
      errors.push("social-bond");
    else bondKeys.add(key);
  }
  const testimonyIds = new Set<string>();
  for (const t of soci.testimonies) {
    if (
      !t ||
      testimonyIds.has(t.id) ||
      !s.crimes.some((c) => c.id === t.crimeId) ||
      !byId.has(t.speakerId) ||
      !byId.has(t.accusedId) ||
      !["direct", "hearsay", "unsupported"].includes(t.basis) ||
      !["unverified", "corroborated", "contradicted"].includes(t.status) ||
      !integer(t.confidence, 0, 100) ||
      !integer(t.submittedAt, 0, s.minute) ||
      (t.reviewedAt !== null && !integer(t.reviewedAt, t.submittedAt, s.minute))
    )
      errors.push("testimony");
    else testimonyIds.add(t.id);
  }
  if (soci.testimonies.length > 128) errors.push("testimony-limit");
  const clubIds = new Set<string>();
  for (const m of soci.club.members) {
    if (
      !m ||
      clubIds.has(m.personId) ||
      !adult(byId.get(m.personId)) ||
      !integer(m.standing, 0, 100) ||
      !["newcomer", "member", "mentor"].includes(m.role)
    )
      errors.push("club-member");
    else clubIds.add(m.personId);
  }
  if (!clubIds.has(soci.club.leaderId) || !adult(byId.get(soci.club.leaderId)))
    errors.push("club-leader");
  if (
    soci.club.activity &&
    (!clubIds.has(soci.club.activity.personId) ||
      !integer(soci.club.activity.startedAt, 0, s.minute) ||
      !integer(soci.club.activity.endsAt, s.minute, s.minute + 30))
  )
    errors.push("club-activity");
  for (const map of [soci.lastRumorAt, soci.factionChangedAt, soci.club.lastSessionAt])
    if (
      !map ||
      typeof map !== "object" ||
      Array.isArray(map) ||
      Object.entries(map).some(([id, n]) => !byId.has(id) || !integer(n, 0, s.minute))
    )
      errors.push("social-cooldown");
  const membership = soci.factions.find(
    (f) => f && Array.isArray(f.members) && f.members.some((m) => m?.personId === "player"),
  );
  if (String(s.flags.faction ?? "") !== (membership?.id ?? "")) errors.push("faction-player-sync");
  errors.push(...validateJustice(s));
  return errors;
}
