import type { Quest, WorldState } from "../domain/types.ts";
import { EVENT_TEMPLATES, type EventKind, type EventTemplate } from "../domain/content.ts";
import { BUILDING_FOR_BUSINESS } from "./population.ts";
import { emit, notify } from "./events.ts";
import { transfer } from "./ledger.ts";
import { draw } from "./random.ts";

export function eventEligible(state: WorldState, template: EventTemplate): boolean {
  if (
    Number(state.flags[`event:${template.kind}`] ?? -100000) + template.cooldownMinutes >
    state.minute
  )
    return false;
  const business = state.businesses.find((item) => item.id === template.requiredLocation);
  switch (template.kind) {
    case "job_offer":
      return state.businesses.some((item) => item.status === "open");
    case "late_wage":
      return state.businesses.some((item) => item.status === "distressed");
    case "layoff":
      return state.npcs.some((npc) => npc.alive && npc.age >= 18 && !npc.jobId);
    case "promotion":
      return Object.values(state.player.skills).some((value) => value >= 20);
    case "rent_rise":
      return (
        state.households.some((household) => household.arrears > 0) || state.minute >= 1440 * 7
      );
    case "loan_due":
      return state.player.debt > 0;
    case "price_shock":
      return state.minute >= 1440;
    case "shortage":
      return !!business && Object.values(business.stock).some((stock) => stock < 8);
    case "delivery":
      return !!state.businesses.find((item) => item.id === "warehouse" && item.stock.parts > 0);
    case "vehicle_breakdown":
      return state.flags.vehicleWear === true;
    case "traffic_jam":
      return state.vehicles.filter((vehicle) => vehicle.speed < 1).length >= 2;
    case "lost_item":
      return state.minute >= 600;
    case "neighbor_help":
      return state.npcs.some((npc) => npc.alive && npc.age >= 18 && npc.hunger >= 20);
    case "friend_invite":
      return state.relations.some((edge) => edge.to === "player" && edge.trust >= 8);
    case "relationship_dispute":
      return state.relations.some((edge) => edge.resentment >= 10);
    case "scholarship":
      return state.player.skills.academic < 40;
    case "neighborhood_argument":
      return state.relations.some((edge) => edge.trust < 0);
    case "witness_report":
      return state.crimes.some(
        (crime) => crime.witnesses.length > 0 && crime.status !== "resolved",
      );
    case "police_check":
      return state.crimes.some((crime) => crime.reported && crime.status !== "resolved");
    case "faction_truce":
      return (
        Math.max(...["dock", "hill", "night"].map((id) => Number(state.flags[`faction:${id}`]))) >
        25
      );
  }
}
const descriptions: Record<EventKind, string> = {
  job_offer: "Marketle görüş. Aktif bir işe girip ilan sahibine dön; bir referans kapısı açılsın.",
  late_wage:
    "Tamirhaneye uğra ve patronla görüş. Geciken ücretler için komşuluk fonunun aracılığı gerekiyor.",
  layoff:
    "İşsiz kalan komşu için kooperatife uğra. Bir vardiya tamamlamak yeniden başlama yolunu gösterir.",
  promotion: "Kooperatifte becerini göster. En az bir beceriyi 20 seviyesine getir.",
  rent_rise:
    "Yuva Apartmanı toplantısına katıl. Bir komşuyla güven ilişkisi kurarak arabuluculuk yap.",
  loan_due: "Kıyı Finans şubesine uğra. Borç bakiyeni azalt ve ödeme kaydını göster.",
  price_shock: "Market fiyatlarını öğren. Bir ticaret dersiyle bütçe bilgisini artır.",
  shortage: "Tamirhanede parça azaldı. Bir yedek parça bul ve ustaya getir.",
  delivery:
    "Liman deposunun paketi ayrıldı. Kabul ettiğinde çantana konur; Martı Taksi’ye teslim et.",
  vehicle_breakdown:
    "Ustaya bir yedek parça getir. Tamir, araç filosunun yeniden hareket etmesini sağlar.",
  traffic_jam: "Taksi durağına uğra. Araçla yol grafında ilerleyip darboğazı aş.",
  lost_item: "Çınar Çayevi’ne uğra. Bulunan cüzdanı sahibine ulaştırmak için komşuyla konuş.",
  neighbor_help: "Yuva Apartmanı’ndaki komşuya bir simit getir. Küçük yardım uzun süre hatırlanır.",
  friend_invite: "Çınar Çayevi’nde buluş. Bir çay getir ve arkadaşınla güvenini geliştir.",
  relationship_dispute:
    "Sahil Sofrası’ndaki tartışmayı yatıştır. Bir komşuya yardım ederek güvenini göster.",
  scholarship:
    "Ufuk Akademi’ye uğra. Akademik becerinde bir derslik ilerleme yap; destek ödemesi hazır.",
  neighborhood_argument:
    "Bereket Market önündeki tartışmada komşuyu dinle. Olumlu bir konuşmayla arabuluculuk yap.",
  witness_report: "Karakola git. Gerçek bir tanık kaydına dayanan olayı bildir.",
  police_check: "Karakola uğra. Aktif takibi çözüme ulaştır; olay dosyası kayıt altında kalacak.",
  faction_truce: "Sahil Sofrası’nda üç çevreyi buluştur. Sosyal itibarı 10 seviyesine çıkar.",
};
export function offerEvent(state: WorldState, kind: EventKind): Quest | null {
  const template = EVENT_TEMPLATES.find((item) => item.kind === kind)!;
  if (
    !eventEligible(state, template) ||
    state.quests.filter((quest) => quest.status === "offered" || quest.status === "active")
      .length >= 8
  )
    return null;
  const business =
    kind === "late_wage"
      ? state.businesses.find((item) => item.status === "distressed")
      : kind === "job_offer"
        ? state.businesses.find((item) => item.status === "open")
        : state.businesses.find((item) => item.id === template.requiredLocation);
  const unemployed =
    kind === "layoff"
      ? state.npcs.find((npc) => npc.alive && npc.age >= 18 && !npc.jobId)
      : undefined;
  const issuerId =
    unemployed?.id ?? business?.ownerId ?? state.npcs.find((n) => n.alive && n.age >= 18)?.id;
  if (!issuerId) return null;
  const issuer = state.npcs.find((n) => n.id === issuerId);
  if (!issuer?.alive || issuer.age < 18) return null;
  const buildingId =
    kind === "late_wage" || kind === "job_offer"
      ? business!.buildingId
      : kind === "delivery" || kind === "traffic_jam"
        ? "b-taxi"
        : kind === "loan_due"
          ? "b-bank"
          : kind === "witness_report" || kind === "police_check"
            ? "b-police"
            : kind === "neighbor_help" || kind === "rent_rise"
              ? "b-home"
              : (BUILDING_FOR_BUSINESS[template.requiredLocation] ?? "b-home");
  if (
    state.quests.some(
      (quest) =>
        (quest.status === "offered" || quest.status === "active") &&
        (quest.issuerId === issuerId || quest.buildingId === buildingId),
    )
  )
    return null;
  const id = `q${state.nextId++}`,
    account = `escrow:${id}`;
  state.accounts[account] = 0;
  state.ledgerCheckpoint.balances[account] = 0;
  if (!transfer(state, `reserve:${id}`, "quests", account, template.reward, "mission-reserve")) {
    delete state.accounts[account];
    delete state.ledgerCheckpoint.balances[account];
    return null;
  }
  const cause = [...state.events]
    .reverse()
    .find(
      (event) =>
        event.actors.includes(issuerId) &&
        (kind === "late_wage"
          ? ["business_distress", "late_wage"].includes(event.kind)
          : kind === "layoff"
            ? event.kind === "layoff"
            : event.kind === kind),
    );
  const source = emit(
    state,
    kind,
    template.title,
    [issuerId],
    "player",
    kind === "loan_due" ? "private" : "public",
    [],
    cause?.id ?? null,
  );
  const description =
    kind === "late_wage"
      ? "Ekonomik sıkıntı yaşayan işyerine uğra. Komşuluk fonu ücretlerin ödenmesine aracılık edebilir."
      : descriptions[kind];
  const quest: Quest = {
    id,
    kind,
    title: template.title,
    description,
    issuerId,
    targetId: issuerId,
    buildingId,
    sourceEvent: source.id,
    status: "offered",
    reward: template.reward,
    deadline: state.minute + template.expiryMinutes,
    progress: 0,
    required: 1,
  };
  state.quests.push(quest);
  state.flags[`event:${kind}`] = state.minute;
  if (kind === "loan_due") state.flags[`questDebt:${id}`] = state.player.debt;
  if (kind === "scholarship") state.flags[`questAcademic:${id}`] = state.player.skills.academic;
  notify(state, `Yeni fırsat: ${quest.title}. Telefonundaki görevlerden inceleyebilirsin.`);
  return quest;
}
export function missionMinute(state: WorldState): void {
  for (const quest of state.quests)
    if (
      (quest.status === "active" || quest.status === "offered") &&
      state.minute >= quest.deadline
    ) {
      quest.status = "expired";
      const account = `escrow:${quest.id}`,
        balance = state.accounts[account];
      if (balance)
        transfer(state, `expire:${quest.id}`, account, "quests", balance, "mission-expired");
      if (state.player.inventory[`parcel:${quest.id}`]) {
        state.businesses.find((b) => b.id === "warehouse")!.stock.parts +=
          state.player.inventory[`parcel:${quest.id}`];
        delete state.player.inventory[`parcel:${quest.id}`];
      }
      emit(
        state,
        "mission_expired",
        `${quest.title}: süre doldu. Başka fırsatlar açık.`,
        [quest.issuerId],
        "player",
        "private",
      );
    }
  if (state.minute % 30 !== 0) return;
  const eligible = EVENT_TEMPLATES.filter((template) => eventEligible(state, template));
  if (eligible.length)
    offerEvent(state, eligible[draw(state.seed, 20, state.minute) % eligible.length].kind);
}

/** Old saves keep their already-promised quests; overlapping legacy reservations are explicitly grandfathered until terminal. */
export function initializeMissionReservations(state: WorldState, legacy = false): void {
  if (!legacy) return;
  const pending = state.quests.filter((q) => q.status === "active" || q.status === "offered");
  for (let i = 0; i < pending.length; i++)
    for (let j = i + 1; j < pending.length; j++)
      if (
        pending[i].issuerId === pending[j].issuerId ||
        pending[i].buildingId === pending[j].buildingId
      ) {
        state.flags["legacyReservation:" + pending[i].id] = true;
        state.flags["legacyReservation:" + pending[j].id] = true;
      }
}
export function validateMissionReservations(state: WorldState): string[] {
  const errors: string[] = [],
    pending = state.quests.filter((q) => q.status === "active" || q.status === "offered");
  for (let i = 0; i < pending.length; i++)
    for (let j = i + 1; j < pending.length; j++)
      if (
        (pending[i].issuerId === pending[j].issuerId ||
          pending[i].buildingId === pending[j].buildingId) &&
        !(
          state.flags["legacyReservation:" + pending[i].id] === true &&
          state.flags["legacyReservation:" + pending[j].id] === true
        )
      )
        errors.push("conflicting-quest-reservations:" + pending[i].id + ":" + pending[j].id);
  return errors;
}
