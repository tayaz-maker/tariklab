import { ITEMS, JOBS, NPCS } from "./content.mjs";
import { LOCATIONS, districtById } from "./expansion-geography.mjs";
import { getPlace, setExpansionDistrict } from "./expansion-districts.mjs";
import { initStartingLease, regionalMarkets } from "./expansion-economy.mjs";
import { recruitmentLead } from "./expansion-underworld.mjs";
import { t } from "./i18n.mjs";

export const LIFE_PATHS = Object.freeze([
  "ordinary", "businessperson", "gangster", "professional", "social-climber", "freeform",
]);

const copy = {
  ordinary: ["Gündelik yaşam","Mahallende düzenli bir hayat kur.","Zanaat deneyimi ve işten bir tanıdık.","Teknoloji deneyimin az.","Yerel bir işe başvur veya ilk vardiyanı tamamla.","Düzenli gelir kur, komşularla tanış ve bir beceri geliştir.","Borçlarını kapat ve kalıcı bir düzen kur."],
  businessperson: ["Girişimci","Küçük bir tamir atölyesi açmayı düşünüyorsun.","Zanaat deneyimin ve aletlerin var.","Aletlere para harcadın. Kurulum ve kira seni bekliyor.","Kurulum ücretini öde ve atölyeni aç.","Müşteri bul, stok al ve nakit akışını izle.","Kâr elde et ve kazancınla mülke yatırım yap."],
  gangster: ["Gangster","Yerel bir örgütün üye aldığını duydun.","Pazarlığa alışkınsın ve bir bağlantın var.","Eğitim deneyimin az. Örgüt işleri adli risk taşır.","Şehrindeki bir örgütün üye alım görüşmesine git.","Aday olmayı değerlendir, görevlerle güven kazan ve rekabeti yönet.","Sorumlulukla nüfuz kazan veya risk büyürse örgütten ayrıl."],
  professional: ["Kariyer","Bir meslekte uzmanlaşmak istiyorsun.","Bilgi ve teknik becerilerin güçlü.","İletişim deneyimin az ve eğitim zaman alır.","Bilgi becerin için bireysel çalışma yap.","Bir kurs veya iş seç, deneyim kazan ve bir rehber bul.","Niteliklerini belgele, terfi et ve kurumlarla itibar kur."],
  "social-climber": ["Çevre kurucu","Yeni çevrende güçlü ilişkiler kurmak istiyorsun.","İletişimde iyisin ve bir tanıdığın var.","Zanaat deneyimin az. İlişkiler zaman ister.","Bir mahalleliyle konuş veya bir tanıdığını ara.","Tekrar görüş, sözünü tut ve mahalle girişimlerine katıl.","Güvenilir bir çevre kur ve etkin kişilerle yakınlaş."],
  freeform: ["Serbest yaşam","Kendi yönünü çiz.","Beceri ve paran seçtiğin geçmişe bağlı.","Mahallede eski bir tanıdığın yok.","Yakın çevreni incele veya yerel bir etkinlik seç.","İşi, eğitimi, ilişkileri ve girişimi keşfet.","Başarı ölçünü kendin belirle."],
};

export function getLifePathCopy(id, language = "tr") {
  const row = copy[LIFE_PATHS.includes(id) ? id : "freeform"];
  const [title, description, advantage, drawback, objective, next, goal] = language === "tr" ? row : row.map((line) => t(line));
  return { title, description, advantage, drawback, objective, opportunities: [next], goal };
}

export function resolveLifePathStart({ startingDistrict = "kadikoy", lifePath = "ordinary" }) {
  const district = districtById(startingDistrict);
  if (!district || !LIFE_PATHS.includes(lifePath)) throw new TypeError("Invalid Boardworld starting setup");
  return { district, lifePath };
}

const adjustments = {
  ordinary: { craft: 4, technical: -4 },
  businessperson: { knowledge: -4 },
  gangster: { communication: 7, knowledge: -6 },
  professional: { knowledge: 8, technical: 4, communication: -5 },
  "social-climber": { communication: 10, craft: -6 },
  freeform: {},
};
const goldContacts = {
  kadikoy: { ordinary: "mert", businessperson: "mert", gangster: "arda", professional: "cem", "social-climber": "aylin" },
  besiktas: { ordinary: "ece", businessperson: "emre", gangster: "naz", professional: "selin", "social-climber": "ece" },
  sisli: { ordinary: "derya", businessperson: "baran", gangster: "okan", professional: "selin", "social-climber": "baran" },
};
const localResidents = (s, place) =>
  (regionalMarkets(s, true)[place.regionId].residents ?? []).filter((person) => person.health > 0 &&
    (person.districtId === place.districtId || person.presentDistrictId === place.districtId));

function introduceContact(s, id, place, api) {
  const goldId = goldContacts[place.districtId]?.[id];
  const score = id === "social-climber" ? 24 : 14;
  if (goldId) {
    s.npcs[goldId].affinity += score;
    s.npcs[goldId].trust += Math.floor(score / 2);
    api.memory(s, goldId, "Mahallede yeniden karşılaşabileceğim eski bir tanıdık.");
    return goldId;
  }
  if (id === "freeform") return "";
  const people = localResidents(s, place);
  const contact = id === "professional" ? people.find((person) => /:teaching$/.test(person.employer)) ?? people[0]
    : id === "businessperson" ? people.find((person) => /:repair$/.test(person.employer)) ?? people[0]
    : people[0];
  if (!contact) return "";
  s.expansion.districts.contacts[contact.id] = { score, lastDay: 0, generation: contact.generation, name: contact.name };
  return contact.id;
}

export function initLifePath(s, { district, lifePath }, api) {
  setExpansionDistrict(s, district.id);
  initStartingLease(s, district.id, api);
  const place = getPlace(s);
  const contact = introduceContact(s, lifePath, place, api);
  for (const [skill, value] of Object.entries(adjustments[lifePath])) api.skill(s, skill, value);
  if (lifePath === "businessperson") {
    api.skill(s, "craft", Math.max(0, 35 - s.player.skills.craft));
    if (!s.inventory.tools) {
      const cost = ITEMS.find((item) => item.id === "tools").price;
      api.spend(s, cost, "Atölye aletleri", "total");
      s.inventory.tools = 1;
    }
    api.change(s, { stress: 8 });
  }
  s.expansion.lifePath = { origin: lifePath, districtId: district.id, owner: s.expansion.playerId, active: lifePath, contact, completed: {} };
  api.expansionEvent(s, "life-path.begin", lifePath, district.id);
}

export function lifePathActions(s) {
  return LIFE_PATHS.map((id) => ({
    id: `life-path:choose:${id}`,
    category: "ambition",
    label: getLifePathCopy(id).title,
    description: getLifePathCopy(id).description,
    minutes: 0,
    cost: 0,
    disabled: (s.expansion.lifePath?.active ?? "freeform") === id,
    reason: (s.expansion.lifePath?.active ?? "freeform") === id ? "Bu hedef zaten seçili." : "",
    run(next) {
      next.expansion.lifePath ??= {
        origin: null, districtId: null, owner: next.expansion.playerId, active: "freeform", contact: "", completed: {},
      };
      next.expansion.lifePath.active = id;
      return "Yaşam hedefin güncellendi.";
    },
  }));
}

export function afterLifePathAction(s, id, before, api) {
  const profile = s.expansion.lifePath;
  if (!profile) return;
  if (s.expansion.playerId !== profile.owner) {
    Object.assign(profile, { owner: s.expansion.playerId, active: "freeform", contact: "", completed: {} });
    return;
  }
  let goal;
  if (/^(?:apply:|district:apply$|work$|district:shift$|world:shift$)/.test(id) &&
    (s.flags.workDays > before.flags.workDays || (!before.job && s.job) ||
      (!before.expansion.districts?.job && s.expansion.districts?.job))) goal = "ordinary";
  if (id.startsWith("business:start:") && !before.deep.business && s.deep.business) goal = "businessperson";
  if (id.startsWith("underworld:recruit:") && s.expansion.underworld?.offer?.offeredAt === s.time)
    goal = "gangster";
  if (id === "practice:knowledge" && s.flags["practice-knowledge"] !== before.flags["practice-knowledge"])
    goal = "professional";
  if (/^(?:(?:life:)?(?:talk|call):|district:meet:)/.test(id)) {
    const local = id.startsWith("district:meet:");
    const contact = local ? id.slice("district:meet:".length) : id.split(":").at(-1);
    const score = (state) => local ? state.expansion.districts?.contacts[contact]?.score : state.npcs[contact]?.affinity;
    if ((score(s) ?? 0) > (score(before) ?? 0)) goal = "social-climber";
  }
  if (goal && !Object.hasOwn(profile.completed, goal)) {
    profile.completed[goal] = s.time;
    api.expansionEvent(s, "life-path.objective", goal, id);
  }
}

export function getLifePathView(s, language = "tr") {
  if (!s.expansion) return null;
  const profile = s.expansion.lifePath;
  const id = profile?.active ?? "freeform";
  const completed = Object.hasOwn(profile?.completed ?? {}, id);
  const place = getPlace(s);
  const gold = goldContacts[place.districtId];
  const contactId = profile?.contact;
  const person = NPCS.find((npc) => npc.id === contactId) ?? s.expansion.districts?.contacts[contactId];
  const contact = person ? { id: contactId, name: person.name } : null;
  let firstActionIds = [];
  let target = null;
  if (!completed && id === "ordinary") {
    firstActionIds = ["district:apply", "district:shift"];
    if (gold) firstActionIds.unshift(...JOBS.filter((job) => job.district === place.districtId).map((job) => `apply:${job.id}`));
    target = LOCATIONS.find((venue) => venue.districtId === place.districtId && venue.kind === "work") ?? null;
  }
  if (!completed && id === "businessperson") firstActionIds = ["business:start:repair"];
  if (!completed && id === "professional") firstActionIds = ["practice:knowledge"];
  if (!completed && id === "gangster") {
    const lead = recruitmentLead(s, place);
    if (lead) {
      firstActionIds = [lead.action];
      target = lead;
    }
  }
  if (!completed && id === "social-climber") {
    if (gold) {
      const people = NPCS.filter((npc) => npc.home === place.districtId || npc.work === place.districtId);
      firstActionIds = [...people.filter((npc) => npc.id === contactId), ...people.filter((npc) => npc.id !== contactId)].map((npc) => `call:${npc.id}`);
    } else {
      const people = localResidents(s, place);
      const person = people.find((npc) => npc.id === contactId) ?? people[0];
      firstActionIds = people.map((npc) => `district:meet:${npc.id}`);
      const social = LOCATIONS.find((venue) => venue.id === person?.socialVenueId) ??
        LOCATIONS.find((venue) => venue.districtId === place.districtId && venue.kind === "social");
      if (social) target = social;
    }
  }
  return {
    id, origin: profile?.origin ?? null, startingDistrict: profile?.districtId ?? null,
    completed, contact, firstActionIds,
    target: target ? { districtId: target.districtId, venueId: target.venueId ?? target.id } : null,
    ...getLifePathCopy(id, language),
  };
}

export function validateLifePath(s) {
  const profile = s.expansion.lifePath;
  if (profile === undefined) return true;
  return Boolean(profile && Object.keys(profile).sort().join(",") === "active,completed,contact,districtId,origin,owner" &&
    LIFE_PATHS.includes(profile.active) && profile.owner === s.expansion.playerId &&
    (profile.origin === null ? profile.districtId === null : LIFE_PATHS.includes(profile.origin) && typeof profile.districtId === "string" && districtById(profile.districtId)?.id === profile.districtId) &&
    typeof profile.contact === "string" && (profile.contact === "" || NPCS.some((npc) => npc.id === profile.contact) || Object.hasOwn(s.expansion.economy.residents, profile.contact)) &&
    profile.completed && typeof profile.completed === "object" && !Array.isArray(profile.completed) &&
    Object.entries(profile.completed).every(([id, minute]) => id !== "freeform" && LIFE_PATHS.includes(id) &&
      Number.isSafeInteger(minute) && minute >= 480 && minute <= s.time));
}
