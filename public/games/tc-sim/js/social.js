import {socialTravel,districtProfile} from './locations.js?v=10';
import {
  addMemory,
  addNpcMemory,
  adjustHealth,
  adjustTendency,
  clamp,
  getWeeklyActivityLimit,
  isCriticalHealth,
  transact,
  updateRelationship,
} from "./state.js?v=10";

export const RELATIONSHIP_STAGES = {
  acquaintance: "Tanışık",
  friend: "Arkadaş",
  close: "Yakın",
  romantic_interest: "Romantik ilgi",
  partner: "Sevgili",
  family: "Aile",
  work_contact: "İş bağlantısı",
};

export const SOCIAL_ROLE_LABELS = {
  family: "Aile",
  friend: "Arkadaş",
  acquaintance: "Tanıdık",
  work_contact: "İş bağlantısı",
};

const ACTIONS = {
  meet: { title: "Görüş", detail: "₺250 · yakınlık +6 · güven +2", cost: 250 },
  confide: { title: "Dertleş", detail: "yakınlık +3 · güven +5 · stres −5", cost: 0 },
  help: { title: "Yardım et", detail: "₺400 · güven +7 · yakınlık +2", cost: 400 },
  repair: { title: "Arayı düzelt", detail: "gerilim −14 · güven +3", cost: 0 },
  fulfill_promise: { title: "Sözünü tut", detail: "açık yardımı tamamla · güven +10", cost: 300 },
  advance_romance: { title: "İlişkiyi ileri taşı", detail: "romantik ilgiyi açıkça konuş", cost: 200 },
};

export function getPerson(state, personId) {
  return state.people.find((person) => person.id === personId) || null;
}

export function getRelationship(state, personId) {
  const person = getPerson(state, personId);
  if (!person) return null;
  return {
    closeness: Number.isFinite(state.relationships[personId]) ? state.relationships[personId] : 44,
    trust: person.social.trust,
    tension: person.social.tension,
    lastMeaningfulContactWeek: person.social.lastMeaningfulContactWeek,
    romanceStatus: person.social.romanceStatus,
  };
}

export function getRelationshipStage(state, personId) {
  const person = getPerson(state, personId);
  const relationship = getRelationship(state, personId);
  if (!person || !relationship) return "acquaintance";
  if (person.roleId === "family") return "family";
  if (state.social.currentPartnerNpcId === personId || relationship.romanceStatus === "partner")
    return "partner";
  if (relationship.romanceStatus === "interest") return "romantic_interest";
  if (person.roleId === "work_contact" && relationship.closeness < 45) return "work_contact";
  if (relationship.closeness >= 72 && relationship.trust >= 62 && relationship.tension <= 45)
    return "close";
  if (relationship.closeness >= 42) return "friend";
  return "acquaintance";
}

export function applyRelationshipDelta(state, personId, delta = {}) {
  const person = getPerson(state, personId);
  if (!person || person.deceased || state.lifetime?.death) return false;
  if (Number.isFinite(delta.closeness)) updateRelationship(state, personId, delta.closeness);
  if (Number.isFinite(delta.trust)) person.social.trust = clamp(person.social.trust + delta.trust);
  if (Number.isFinite(delta.tension))
    person.social.tension = clamp(person.social.tension + delta.tension);
  return true;
}

export function markMeaningfulContact(state, personId) {
  const person = getPerson(state, personId);
  if (!person) return false;
  person.social.lastMeaningfulContactWeek = state.time.absoluteWeek;
  return true;
}

export function getOpenSocialCase(state, personId) {
  return (
    state.openCases.find(
      (item) =>
        item.type === "social-obligation" &&
        item.status === "pending" &&
        item.payload?.personId === personId,
    ) || null
  );
}

export function createSocialObligation(state, personId) {
  const person = getPerson(state, personId);
  if (!person || getOpenSocialCase(state, personId)) return false;
  const id = `social-promise-${personId}-${state.time.absoluteWeek}`;
  state.openCases.push({
    id,
    type: "social-obligation",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + 3,
    eventId: "social_promise_due",
    status: "pending",
    payload: { personId },
  });
  addMemory(state, `${person.name}'e üç hafta içinde yardım edeceğine söz verdin.`, "important");
  addNpcMemory(state, personId, "Yardım edeceğine söz verdi.", "promise_made");
  return true;
}

export function resolveSocialObligation(state, personId, success) {
  const item = state.openCases.find(
    (candidate) =>
      candidate.type === "social-obligation" &&
      candidate.payload?.personId === personId &&
      ["pending", "triggered"].includes(candidate.status),
  );
  if (!item || item.resolutionApplied) return false;
  item.status = "resolved";
  item.resolutionApplied = true;
  if (success) {
    applyRelationshipDelta(state, personId, { closeness: 4, trust: 10, tension: -5 });
    addMemory(state, `${getPerson(state, personId).name}'e verdiğin sözü tuttun.`, "important");
    addNpcMemory(state, personId, "Verdiği sözü zamanında tuttu.", "promise_kept");
    markMeaningfulContact(state, personId);
  } else {
    applyRelationshipDelta(state, personId, { closeness: -4, trust: -12, tension: 12 });
    addMemory(state, `${getPerson(state, personId).name}'e verdiğin sözü tutamadın.`, "important");
    addNpcMemory(state, personId, "Verdiği sözü tutmadı.", "promise_broken");
  }
  return true;
}

// Elif is the original authored adult peer; expanded cast members carry age.
// An explicit underage/unknown imported character never inherits that fallback.
export function isAdultRomanceParticipant(state, personId) {
  const person = getPerson(state, personId);
  const adult = person?.age === undefined ? personId === "elif" : Number.isFinite(person.age) && person.age >= 18;
  return Boolean(state.player.age >= 18 && !state.lifetime?.death && person && !person.deceased && adult && person.roleId !== "family" && person.tags?.includes("romance_available"));
}

export function setRomanticInterest(state, personId) {
  const person = getPerson(state, personId);
  if (!isAdultRomanceParticipant(state, personId))
    return false;
  if (person.social.romanceStatus !== "none") return false;
  if (state.household.history?.some((entry) => ["divorce", "breakup"].includes(entry.kind) && entry.personId === personId && state.time.absoluteWeek - entry.week < 24)) return false;
  person.social.romanceStatus = "interest";
  addNpcMemory(state, personId, "Aramızdaki romantik ihtimali açıkça konuştuk.", "romance_started");
  addMemory(state, `${person.name} ile aranda romantik bir ilgi oluştu.`, "important");
  return true;
}

export function canBecomePartner(state, personId) {
  const person = getPerson(state, personId);
  const relationship = getRelationship(state, personId);
  if (!person || !relationship) return false;
  return (
    isAdultRomanceParticipant(state, personId) &&
    !state.social.currentPartnerNpcId &&
    person.roleId !== "family" &&
    person.tags.includes("romance_available") &&
    relationship.romanceStatus === "interest" &&
    relationship.closeness >= 68 &&
    relationship.trust >= 62 &&
    relationship.tension <= 35
  );
}

export function becomePartner(state, personId) {
  if (!canBecomePartner(state, personId)) return false;
  const person = getPerson(state, personId);
  state.social.currentPartnerNpcId = personId;
  person.social.romanceStatus = "partner";
  addNpcMemory(state, personId, "İlişkimizi sevgililik olarak tanımladık.", "became_partner");
  addMemory(state, `${person.name} ile sevgili oldunuz.`, "important");
  return true;
}

export function canUseSocialAction(state, personId, actionId) {
  if (state.lifetime?.death || state.people.find(p => p.id === personId)?.deceased) return { ok: false, reason: "Bu kişiyle artık yeni bir eylem yapılamaz." };
  const person = getPerson(state, personId);
  const relationship = getRelationship(state, personId);
  const baseAction = ACTIONS[actionId];
  const travel=actionId==="meet"?socialTravel(state,personId):{cost:0,slots:0};
  const action=baseAction?{...baseAction,cost:baseAction.cost+travel.cost}:null;
  if (!person || !relationship || !action) return { ok: false, reason: "Sosyal işlem geçersiz." };
  if (state.events.active) return { ok: false, reason: "Önce açık olayı sonuçlandır." };
  if (state.weekly.used + 1 + travel.slots > getWeeklyActivityLimit(state))
    return {
      ok: false,
      reason: isCriticalHealth(state)
        ? "Sağlığın kritik; bu hafta yalnız bir şeye gücün yetiyor."
        : "Bu haftanın aktivite hakkı bitti.",
    };
  const decisionId = `social:${personId}:${actionId}`;
  if (state.weekly.selectedIds.includes(decisionId))
    return { ok: false, reason: "Bu kişiyle aynı etkileşimi bu hafta yaptın." };
  if (state.finances.balance < action.cost) return { ok: false, reason: "Yeterli paran yok." };
  if (actionId === "confide" && relationship.closeness < 40)
    return { ok: false, reason: "Dertleşmek için önce biraz yakınlaşmalısınız." };
  if (actionId === "repair" && relationship.tension < 25 && relationship.trust >= 45)
    return { ok: false, reason: "Şu an onarılması gereken belirgin bir gerilim yok." };
  if (actionId === "fulfill_promise" && !getOpenSocialCase(state, personId))
    return { ok: false, reason: "Bu kişiye verilmiş açık bir söz yok." };
  if (actionId === "advance_romance" && !canBecomePartner(state, personId))
    return { ok: false, reason: "İlişki henüz sevgililiğe hazır değil." };
  return { ok: true, action, decisionId,slots:1+travel.slots };
}

export function getAvailableSocialActions(state, personId) {
  return Object.entries(ACTIONS)
    .map(([id, action]) => {const t=id==="meet"?socialTravel(state,personId):{cost:0,slots:0};return {id,...action,detail:action.detail+(t.cost?` · yol ₺${t.cost} · ${1+t.slots} zaman`:""),availability:canUseSocialAction(state,personId,id)};})
    .filter((action) => {
      if (["repair", "fulfill_promise", "advance_romance"].includes(action.id))
        return action.availability.ok;
      return true;
    });
}

export function applySocialAction(state, personId, actionId) {
  const check = canUseSocialAction(state, personId, actionId);
  if (!check.ok) return check;
  const person = getPerson(state, personId);
  if (check.action.cost) transact(state, -check.action.cost, `${person.name}: ${check.action.title}`, "social");
  if (actionId === "meet") {
    applyRelationshipDelta(state, personId, { closeness: Math.round(6*districtProfile(state).social), trust: 2, tension: -2 });
    adjustHealth(state, { energy: -6, stress: -3 });
    addNpcMemory(state, personId, "Birlikte vakit geçirdik.", "met");
  } else if (actionId === "confide") {
    applyRelationshipDelta(state, personId, { closeness: 3, trust: 5, tension: -3 });
    adjustHealth(state, { energy: -3, stress: -5 });
    addNpcMemory(state, personId, "Benimle açıkça dertleşti.", "confided");
  } else if (actionId === "help") {
    applyRelationshipDelta(state, personId, { closeness: 2, trust: 7, tension: -2 });
    adjustHealth(state, { energy: -5, stress: 1 });
    addNpcMemory(state, personId, "İhtiyacım olduğunda yardım etti.", "helped");
  } else if (actionId === "repair") {
    applyRelationshipDelta(state, personId, { closeness: 1, trust: 3, tension: -14 });
    adjustHealth(state, { energy: -3, stress: -4 });
    addNpcMemory(state, personId, "Aramızdaki gerilimi konuşarak azalttı.", "repaired");
  } else if (actionId === "fulfill_promise") {
    resolveSocialObligation(state, personId, true);
  } else if (actionId === "advance_romance") {
    becomePartner(state, personId);
  }
  if (actionId !== "fulfill_promise") markMeaningfulContact(state, personId);
  if (["meet", "confide", "help", "repair"].includes(actionId)) adjustTendency(state, "sociability", 1);
  if (actionId === "help" || actionId === "fulfill_promise") adjustTendency(state, "discipline", 1);
  if (actionId === "meet") adjustTendency(state, "frugality", -1);
  state.weekly.used += check.slots;
  state.weekly.selectedIds.push(check.decisionId);
  state.social.engaged = true;
  return { ok: true, message: `${person.name}: ${check.action.title} tamamlandı.` };
}

/** 3D: bir NPC hafızasında verilen tipte en az bir kayıt var mı. Uygunluk/zincir koşulları için. */
export function hasNpcMemory(state, personId, type) {
  const person = getPerson(state, personId);
  if (!person || !type) return false;
  return person.memories.some((memory) => memory.type === type);
}

/** 3D: kişiye özel, tutarı korunan borç. Mevcut sabit 1500 TL `friend-loan`/`loan_repayment`
 * mekanizmasından tamamen ayrıdır ve onu değiştirmez. */
export function getPersonalDebt(state, personId) {
  return (
    state.openCases.find(
      (item) =>
        item.type === "personal-debt" &&
        item.status !== "resolved" &&
        item.payload?.personId === personId,
    ) || null
  );
}

export function createPersonalDebt(
  state,
  personId,
  amount,
  dueInWeeks = 4,
  memoryType = "lent_money",
) {
  const person = getPerson(state, personId);
  if (!person || !Number.isFinite(amount) || amount <= 0 || getPersonalDebt(state, personId))
    return false;
  state.openCases.push({
    id: `personal-debt-${personId}-${state.time.absoluteWeek}`,
    type: "personal-debt",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + dueInWeeks,
    eventId: null,
    status: "pending",
    payload: { personId, amount, memoryType },
  });
  addNpcMemory(state, personId, `${amount.toLocaleString("tr-TR")} TL borç aldı.`, memoryType);
  return true;
}

export function resolvePersonalDebt(state, personId, { collected }) {
  const item = getPersonalDebt(state, personId);
  if (!item || item.resolutionApplied) return false;
  item.status = "resolved";
  item.resolutionApplied = true;
  const person = getPerson(state, personId);
  if (collected) {
    transact(state, item.payload.amount, `${person.name}: borç tahsilatı`, "social");
    applyRelationshipDelta(state, personId, { tension: 4 });
    addNpcMemory(state, personId, "Borcunu geri ödedi.", "debt_collected");
  } else {
    applyRelationshipDelta(state, personId, { trust: 6, tension: -4 });
    addNpcMemory(state, personId, "Borcunu bağışladın.", "debt_forgiven");
  }
  return true;
}

/** 3D: gecikmeli sosyal sonuç. Mevcut openCases mimarisini sarar; ikinci bir motor değildir.
 * `dueWeek` gelmeden tetiklenmez (processDueOpenCases), tam bir kez çözülür, save/load'da kalıcıdır. */
export function scheduleSocialFollowup(state, { id, eventId, dueWeek, personId, ...payload } = {}) {
  if (!eventId || !Number.isInteger(dueWeek)) return false;
  const caseId = id || `social-followup-${eventId}-${state.time.absoluteWeek}`;
  if (state.openCases.some((item) => item.id === caseId)) return false;
  state.openCases.push({
    id: caseId,
    type: "social-followup",
    createdWeek: state.time.absoluteWeek,
    dueWeek,
    eventId,
    status: "pending",
    payload: { personId, ...payload },
  });
  return true;
}

export function applySocialMaintenance(state) {
  const week = state.time.absoluteWeek;
  if (state.social.lastMaintenanceWeek === week) return false;
  for (const person of state.people) {
    if (person.deceased) continue;
    const relationship = getRelationship(state, person.id);
    const gap = week - relationship.lastMeaningfulContactWeek;
    const stage = getRelationshipStage(state, person.id);
    const threshold = stage === "partner" ? 5 : stage === "close" || stage === "family" ? 8 : 12;
    // Tanışıklık doğal olarak soğur ama ömür boyu sıfıra aşınmaz. Bu taban,
    // aktif bakımın kazancını korurken ilişki/family odaklı oyun ile herkesi
    // görmezden gelen kariyer rotasının aynı sosyal dipte birleşmesini önler.
    const floor = stage === "partner" ? 30 : person.roleId === "family" ? 38 : person.roleId === "friend" ? 28 : 20;
    if (gap > threshold && gap % 4 === 0 && relationship.closeness > floor) {
      applyRelationshipDelta(state, person.id, {
        closeness: -Math.min(stage === "partner" ? 2 : 1, relationship.closeness - floor),
        trust: stage === "partner" ? -1 : 0,
        tension: stage === "partner" ? 1 : 0,
      });
    }
  }
  state.social.lastMaintenanceWeek = week;
  return true;
}
