import { normalizeWedding, weddingRecord, ensureWedding, familyMeetingContext, weddingFundingAvailability, settleWeddingBudget, householdChoiceCost } from "./wedding-planning.js?v=10";
import { addMemory, addNpcMemory, appendCapped, getWeeklyActivityLimit, transact } from "./state.js?v=10";
import { getPerson, getRelationship, applyRelationshipDelta, markMeaningfulContact, isAdultRomanceParticipant } from "./social.js?v=10";
import { getHomeById, relocateHome, getMonthlySummary } from "./life.js?v=10";
import { createSecret, transferSecret, isSecretKnownTo } from "./depth2-systems.js?v=10";

export const HOUSEHOLD_HISTORY_LIMIT = 24;
export const MARRIAGE_COST = 6000;
export const FAMILY_INTENTS = Object.freeze({ wants: "İleride çocuk istiyorum", not_now: "Şimdi değil", no: "Çocuk istemiyorum", unsure: "Emin değilim" });
export function neutralUnion() {
  return { cohabitingSince: null, marriedSince: null, separatedSince: null, reconciled: false, familyPlan: null };
}
export const HOUSEHOLD_CHAINS = Object.freeze({
  engagement: { id: "CHN-S07", eventId: "engagement_preparation" },
  honeymoon: { id: "CHN-S08", eventId: "household_honeymoon" },
  cohabitation: { id: "CHN-S01", eventId: "cohabitation_move" },
  adjustment: { id: "CHN-S02", eventId: "household_adjustment" },
  marriage: { id: "CHN-S03", eventId: "marriage_commitment" },
  family: { id: "CHN-S04", eventId: "household_family_visit" },
  settlement: { id: "CHN-S05", eventId: "separation_review" },
  planning: { id: "CHN-S06", eventId: "family_intent_review" },
});

export function normalizeHousehold(state) {
  const household = state.household;
  if (!household) return;
  normalizeWedding(state);
  const raw = household.union || {};
  const week = (value) => Number.isInteger(value) && value >= 1 && value <= state.time.absoluteWeek ? value : null;
  const hasPartner = Boolean(state.social?.currentPartnerNpcId);
  household.union = {
    cohabitingSince: hasPartner && household.homeId !== "family" ? week(raw.cohabitingSince) : null,
    marriedSince: hasPartner ? week(raw.marriedSince) : null,
    separatedSince: hasPartner && week(raw.marriedSince) ? week(raw.separatedSince) : null,
    reconciled: hasPartner && raw.reconciled === true,
    familyPlan: hasPartner && Object.hasOwn(FAMILY_INTENTS, raw.familyPlan?.intent) && Object.hasOwn(FAMILY_INTENTS, raw.familyPlan?.response) ? { intent: raw.familyPlan.intent, response: raw.familyPlan.response } : null,
  };
  if (household.union.separatedSince) household.union.cohabitingSince = null;
  const ids = new Set();
  household.history = (Array.isArray(household.history) ? household.history : []).filter((entry) => {
    if (typeof entry?.id !== "string" || !entry.id || ids.has(entry.id) || !week(entry.week) || typeof entry.text !== "string") return false;
    ids.add(entry.id); return true;
  }).slice(-HOUSEHOLD_HISTORY_LIMIT);
}

const partner = (state) => getPerson(state, state.social.currentPartnerNpcId);
const living = (state) => Boolean(partner(state) && state.household.union?.cohabitingSince && state.household.homeId !== "family");
const pending = (state, kind) => state.openCases.some((item) => item.type === "household-followup" && item.payload?.kind === kind && item.status !== "resolved");
function stablePartner(state) {
  const person = partner(state);
  const relationship = person && getRelationship(state, person.id);
  return relationship && relationship.closeness >= 68 && relationship.trust >= 62 && relationship.tension <= 35;
}
export function canDiscussHousehold(state, kind) {
  if (!isAdultRomanceParticipant(state, state.social?.currentPartnerNpcId) || !partner(state) || pending(state, kind)) return false;
  if (kind === "separation") return Boolean(state.household.union.marriedSince && !state.household.union.separatedSince && (getRelationship(state, partner(state).id).tension >= 50 || getRelationship(state, partner(state).id).trust < 40));
  if (kind === "planning") return Boolean((state.household.union.marriedSince || living(state)) && !state.household.union.separatedSince && !state.household.union.familyPlan);
  if (state.household.union.separatedSince) return false;
  if (["marriage", "families"].includes(kind) && state.weekly.selectedIds.some(id => CEREMONIES.has(id.replace("household:", "")))) return false;
  if (kind === "cohabitation") {
    const started = partner(state).memories.find((item) => item.type === "became_partner");
    return !living(state) && stablePartner(state) && state.time.absoluteWeek - (started?.week || 1) >= 4;
  }
  if (kind === "breakup") return !state.household.union.marriedSince;
  if (kind === "families") return !state.household.union.marriedSince && stablePartner(state) && !weddingRecord(state)?.familiesMet;
  if (kind === "marriage") {
    const started = partner(state).memories.find(item => item.type === "became_partner");
    return !state.household.union.marriedSince && !pending(state, "engagement") && stablePartner(state) &&
      (living(state) ? state.time.absoluteWeek - state.household.union.cohabitingSince >= 8 : state.time.absoluteWeek - (started?.week || 1) >= 8);
  }
  return false;
}

export function getHouseholdSummary(state) {
  const person = partner(state);
  const cohabiting = living(state);
  return {
    partnerName: person?.name || null,
    status: state.household.union?.separatedSince && person ? "Ayrı yaşıyor · evli" : state.household.union?.marriedSince && person ? "Evli" : weddingRecord(state)?.engagedSince && person ? "Nişanlı" : person ? "Sevgili" : "Partner yok",
    residence: cohabiting ? "Birlikte yaşıyorsunuz" : "Ayrı yaşam düzeni",
    familyPlanning: state.household.union?.familyPlan ? `Sen: ${FAMILY_INTENTS[state.household.union.familyPlan.intent]} · Partnerin: ${FAMILY_INTENTS[state.household.union.familyPlan.response]}` : "",
    space: cohabiting && state.household.homeId === "shared" ? "Paylaşımlı evde ortak alan ve mahremiyet için anlaşmanız gerekiyor." : cohabiting ? "Kendi evinizde giderleri ve sorumlulukları paylaşıyorsunuz." : "",
  };
}

export function getHouseholdFinance(state, { closingMonth = false } = {}) {
  if (!living(state)) return { partnerContribution: 0, householdExtra: 0 };
  const base = getHomeById(state.household.homeId).monthlyCost;
  // İlk ay yalnız birlikte geçirilen haftalar hesaba katılır. İkinci cüzdan yok.
  const fraction = closingMonth ? Math.min(4, Math.max(0, state.time.absoluteWeek - state.household.union.cohabitingSince)) / 4 : 1;
  return { partnerContribution: Math.round(Math.min(2500, base * 0.35) * fraction), householdExtra: Math.round(900 * fraction) };
}

function milestone(state, kind, text) {
  const person = partner(state);
  const entry = { id: `${kind}-${person?.id}-${state.time.absoluteWeek}`, kind, week: state.time.absoluteWeek, personId: person?.id || null, text };
  if (state.household.history.some((item) => item.id === entry.id)) return;
  appendCapped(state.household.history, entry, HOUSEHOLD_HISTORY_LIMIT);
  addMemory(state, text, "important");
  if (person) addNpcMemory(state, person.id, text, kind);
}

function schedule(state, kind, delay, payload = {}) {
  if (pending(state, kind)) return false;
  const chain = HOUSEHOLD_CHAINS[kind];
  const id = `household-${kind}-${state.time.absoluteWeek}`;
  if (state.openCases.some((item) => item.id === id)) return false;
  state.openCases.push({ id, type: "household-followup", chainId: chain.id, eventId: chain.eventId, status: "pending", createdWeek: state.time.absoluteWeek, dueWeek: state.time.absoluteWeek + delay, expiresWeek: state.time.absoluteWeek + delay + 8, payload: { kind, personId: state.social.currentPartnerNpcId, ...payload } });
  return true;
}

export function processHouseholdCases(state) {
  for (const item of state.openCases) {
    if (item.type !== "household-followup" || item.status === "resolved") continue;
    const contextEnded = (item.payload?.kind === "adjustment" && !living(state)) ||
      (item.payload?.kind === "planning" && state.household.union.separatedSince) ||
      (item.payload?.kind === "settlement" && !state.household.union.separatedSince);
    if (contextEnded || item.payload?.personId !== state.social.currentPartnerNpcId || state.time.absoluteWeek > item.expiresWeek) {
      item.status = "resolved";
      if (!contextEnded && item.payload?.personId === state.social.currentPartnerNpcId) addMemory(state, "Birlikte yaşam planının görüşme süresi geçti; karar alınmadı.");
    }
  }
  const retained = new Set(state.openCases.filter((item) => item.type === "household-followup" && item.status === "resolved").map((item) => item.id));
  state.events.queue = state.events.queue.filter((item) => !retained.has(item.sourceCaseId));
  state.openCases = state.openCases.filter((item) => item.type !== "household-followup" || item.status !== "resolved");
  if (partner(state) && state.household.union.separatedSince &&
    state.time.absoluteWeek >= state.household.union.separatedSince + 6 &&
    state.time.absoluteWeek >= (state.events.cooldowns.separation_review || 0)) schedule(state, "settlement", 2);
  const record = weddingRecord(state);
  if (living(state) && record?.settledWeek && state.time.absoluteWeek >= (record.lastReview || record.settledWeek) + 48) {
    if (schedule(state, "adjustment", 2)) record.lastReview = state.time.absoluteWeek;
  }
  const relationship = partner(state) && getRelationship(state, state.social.currentPartnerNpcId);
  if (living(state) && state.time.absoluteWeek >= state.household.union.cohabitingSince + 12 &&
    state.time.absoluteWeek >= (state.events.cooldowns.household_adjustment || 0) &&
    (state.household.homeId === "shared" || relationship.tension >= 30 || state.finances.balance < 2500)) {
    schedule(state, "adjustment", 2);
  }
}

const CEREMONIES = new Set(["household_families", "marriage_discussion", "engagement_preparation", "marriage_commitment", "household_honeymoon"]);
export const HOUSEHOLD_CONVERSATIONS = Object.freeze([
  { id: "relationship_breakup", kind: "breakup", label: "İlişkiyi bitirmeyi konuş" },
  { id: "household_families", kind: "families", label: "Ailelerle tanışmayı konuş" },
  { id: "marriage_discussion", kind: "marriage", label: "Evlilik teklifini konuş" },
  { id: "cohabitation_discussion", kind: "cohabitation", label: "Ortak ev planını konuş" },
  { id: "family_intent_discussion", kind: "planning", label: "Çocuk konusundaki niyetini konuş" },
  { id: "separation_discussion", kind: "separation", label: "Ayrı yaşamayı konuş" },
]);
export function householdConversationAvailable(state, id) {
  const item = HOUSEHOLD_CONVERSATIONS.find(item => item.id === id);
  return Boolean(item && !state.events.active && !state.lifetime?.death && state.time.absoluteWeek >= (state.events.cooldowns[id] || 0) && canDiscussHousehold(state, item.kind));
}
function useTime(state, id) {
  state.weekly.used += 1;
  state.weekly.selectedIds.push(`household:${id}`);
  markMeaningfulContact(state, state.social.currentPartnerNpcId);
}

export function householdChoiceAvailability(state, definition, choice, sourceCase) {
  if (definition.id === "move_in_with_elif" && choice.id !== "look") return { ok: true };
  if (["later", "cancel", "skip", "private"].includes(choice.id)) return { ok: true };
  if (state.lifetime?.death || !isAdultRomanceParticipant(state, state.social?.currentPartnerNpcId) || !partner(state) || (sourceCase && sourceCase.payload?.personId !== state.social.currentPartnerNpcId)) return { ok: false, reason: "Bu planın partner bağlamı değişti." };
  if (sourceCase && (sourceCase.eventId !== definition.id || state.time.absoluteWeek < sourceCase.dueWeek)) return { ok: false, reason: "Bu planın görüşme zamanı henüz gelmedi." };
  if (CEREMONIES.has(definition.id) && state.weekly.selectedIds.some(id => CEREMONIES.has(id.replace("household:", "")))) return { ok: false, reason: "Bu hafta bir hazırlık kararı aldınız. Sonraki adım için gelecek haftaya zaman bırakın." };
  if (definition.id === "relationship_breakup" && !canDiscussHousehold(state, "breakup")) return { ok: false, reason: "Evliysen ayrı yaşam ve boşanma görüşmesini kullanmalısın." };
  if (definition.id === "household_families" && !canDiscussHousehold(state, "families")) return { ok: false, reason: "Aile görüşmesi için ilişkiniz hazır değil veya bu görüşme zaten yapıldı." };
  if (["engagement_preparation", "household_honeymoon"].includes(definition.id) && (!sourceCase || sourceCase.status === "resolved" || state.household.union.separatedSince)) return { ok: false, reason: "Bu hazırlığın geçerli bir ortak planı yok." };
  if (definition.id === "engagement_preparation" && (!weddingRecord(state)?.engagedSince || weddingRecord(state)?.prepared || state.household.union.marriedSince)) return { ok: false, reason: "Açık bir nişan hazırlığı yok." };
  if (definition.id === "household_honeymoon" && (!state.household.union.marriedSince || weddingRecord(state)?.honeymoon)) return { ok: false, reason: "Bu balayı planı artık geçerli değil." };
  if (state.weekly.used >= getWeeklyActivityLimit(state)) return { ok: false, reason: "Bu görüşme bir haftalık aktivite ister; bu haftanın zamanı doldu. Erteleyebilirsin." };
  if (definition.id === "separation_discussion" && !canDiscussHousehold(state, "separation")) return { ok: false, reason: "Ayrılık görüşmesi için çözülmemiş ciddi bir ilişki sorunu yok." };
  if (definition.id === "family_intent_discussion" && !canDiscussHousehold(state, "planning")) return { ok: false, reason: "Bu niyet görüşmesi için ilişki bağlamı değişti." };
  if (definition.id === "separation_review") {
    if (!sourceCase || sourceCase.status === "resolved" || !state.household.union.separatedSince) return { ok: false, reason: "Açık bir ayrılık değerlendirmesi yok." };
    if (choice.id === "reconcile" && !canReconcile(state)) return { ok: false, reason: "Barışmak için zaman, onarılmış güven ve bağımsız bir ev gerekiyor. Aynı evlilikte tekrarlanan barışma döngüsü yok." };
  }
  if (definition.id === "family_intent_review" && (!sourceCase || sourceCase.status === "resolved" || !state.household.union.familyPlan || state.household.union.separatedSince)) return { ok: false, reason: "Bu ortak niyet görüşmesi artık geçerli değil." };
  if (["cohabitation_discussion", "move_in_with_elif"].includes(definition.id) && !canDiscussHousehold(state, "cohabitation")) return { ok: false, reason: "Birlikte yaşama koşulları henüz oluşmadı." };
  if (definition.id === "marriage_discussion" && !canDiscussHousehold(state, "marriage")) return { ok: false, reason: "Evlilik görüşmesi için ortak düzenin ve ilişkinin oturması gerekiyor." };
  if (["cohabitation_move", "marriage_commitment", "household_adjustment", "household_family_visit"].includes(definition.id) && (!sourceCase || sourceCase.status === "resolved")) return { ok: false, reason: "Bu görüşmenin açık bir planı yok." };
  if (definition.id === "cohabitation_move") {
    if (living(state) || !stablePartner(state)) return { ok: false, reason: "Taşınmadan önce ilişkinizdeki belirsizliği konuşmalısınız." };
    const home = getHomeById(choice.id);
    if (!home || home.id === "family") return { ok: false, reason: "İki kişilik bağımsız bir yaşam alanı seç." };
    if (state.finances.balance < (state.household.homeId === home.id ? 0 : home.moveCost)) return { ok: false, reason: "Taşınma bütçesi yetersiz." };
  }
  const cost = householdChoiceCost(state, definition.id, choice.id);
  if (definition.id !== "marriage_commitment" && state.finances.balance < cost) return { ok: false, reason: "Bu hazırlık için bütçe yetersiz; daha sade seçeneği tercih edebilirsin." };
  if (definition.id === "marriage_commitment") {
    if (state.household.union.marriedSince || state.household.union.separatedSince || weddingRecord(state)?.settledWeek || !stablePartner(state)) return { ok: false, reason: "Ortak karar veya güven koşulları uygun değil. Erteleyebilirsin." };
    return weddingFundingAvailability(state, choice.id);
  }
  return { ok: true };
}

export function resolveHouseholdChoice(state, definition, choiceId, sourceCase) {
  const id = definition.id;
  const person = partner(state);
  if (id === "move_in_with_elif" && choiceId !== "look") return;
  if (sourceCase) sourceCase.status = "resolved";
  if (["later", "cancel", "skip"].includes(choiceId)) {
    if (sourceCase && person && sourceCase.payload?.personId === person.id) {
      applyRelationshipDelta(state, person.id, { tension: id === "household_adjustment" && state.household.homeId === "shared" ? 4 : 2 });
      addNpcMemory(state, person.id, "Planladığımız ortak yaşam görüşmesine zaman ayıramadı.", "household_postponed");
    }
    return;
  }
  if (choiceId !== "private") useTime(state, id);
  if (id === "relationship_breakup") {
    milestone(state, "breakup", `${person.name} ile ilişkinizi bitirdiniz; hazırlık giderleri geri gelmedi, varsa borçlar sürüyor.`);
    state.social.currentPartnerNpcId = null; person.social.romanceStatus = "none";
    state.household.union = neutralUnion(); state.household.wedding = null;
  } else if (id === "separation_discussion") {
    state.household.union.separatedSince = state.time.absoluteWeek;
    state.household.union.cohabitingSince = null;
    milestone(state, "separation", `${person.name} ile ayrı yaşamaya başladınız; evlilik henüz bitmedi. Mevcut evin giderleri artık sende.`);
    createSecret(state, { id: `separation-${state.time.absoluteWeek}`, summary: "Evliliğinizdeki ayrılık kararı", type: "household", knownBy: ["player", person.id], sourceEvent: id });
    schedule(state, "settlement", 6);
  } else if (id === "separation_review") {
    if (choiceId === "reconcile") {
      state.household.union.separatedSince = null;
      state.household.union.cohabitingSince = state.time.absoluteWeek;
      state.household.union.reconciled = true;
      milestone(state, "reconciliation", `${person.name} ile ayrı geçen dönemin ardından ortak yaşama yeniden şans verdiniz; geçmiş sorunlar silinmedi.`);
      schedule(state, "adjustment", 4);
    } else if (choiceId === "divorce") {
      milestone(state, "divorce", `${person.name} ile boşandınız. Ortak geçmişiniz ve kişi kaydı korunuyor.`);
      createSecret(state, { id: `divorce-${state.time.absoluteWeek}`, summary: "Boşanma kararınız", type: "household", knownBy: ["player", person.id], sourceEvent: id });
      state.social.currentPartnerNpcId = null;
      person.social.romanceStatus = "none";
      state.household.union = neutralUnion();
      state.household.wedding = null;
    }
  } else if (id === "family_intent_discussion") {
    const relationship = getRelationship(state, person.id);
    const ready = state.finances.balance >= getMonthlySummary(state).expenses * 3 && relationship.trust >= 75 && relationship.tension <= 15;
    const response = ready ? "wants" : "not_now";
    state.household.union.familyPlan = { intent: choiceId, response };
    createSecret(state, { id: `family-intent-${state.time.absoluteWeek}`, summary: "Çocuk konusundaki kişisel niyetleriniz", type: "household", knownBy: ["player", person.id], sourceEvent: id });
    applyRelationshipDelta(state, person.id, { tension: choiceId !== response ? 3 : -1 });
    milestone(state, "family_intent", `Çocuk konusunu konuştunuz: sen “${FAMILY_INTENTS[choiceId]}”, ${person.name} “${FAMILY_INTENTS[response]}” dediniz. Bu bir çocuk sahibi olma kararı değil.`);
    schedule(state, "planning", 4);
  } else if (id === "family_intent_review") {
    if (choiceId !== "talk") return;
    applyRelationshipDelta(state, person.id, { tension: -2 });
    addNpcMemory(state, person.id, "Çocuk konusundaki farklı niyetleri baskı kurmadan tekrar konuştuk; kimsenin tercihi otomatik değişmedi.", "family_intent_review");
  } else if (["cohabitation_discussion", "move_in_with_elif"].includes(id)) {
    schedule(state, "cohabitation", 2);
    addNpcMemory(state, person.id, "Birlikte yaşamayı konuşup taşınma kararı için zaman ayırdık.", "cohabitation_plan");
  } else if (id === "cohabitation_move") {
    if (state.household.homeId !== choiceId) relocateHome(state, choiceId);
    state.household.union.cohabitingSince = state.time.absoluteWeek;
    const secret = createSecret(state, { id: `shared-home-${state.time.absoluteWeek}`, summary: "Partnerinle birlikte kurduğun yaşam düzeni", type: "household", knownBy: ["player", person.id], sourceEvent: id });
    milestone(state, "cohabitation", `${person.name} ile birlikte yaşamaya başladın.`);
    applyRelationshipDelta(state, person.id, { trust: 3, tension: -2 });
    schedule(state, "adjustment", 4);
    schedule(state, "family", 6, { secretId: secret.id });
  } else if (id === "household_adjustment") {
    if (!living(state)) return;
    if (choiceId === "separate_homes") {
      state.household.union.cohabitingSince = null;
      milestone(state, "separate_homes", "İlişkiniz sürerken ayrı evlerde yaşamaya karar verdiniz.");
    } else {
      applyRelationshipDelta(state, person.id, { trust: 3, tension: -6 });
      addNpcMemory(state, person.id, state.household.homeId === "shared" ? "Ortak alanı ve ev işlerini nasıl paylaşacağımızı konuştuk." : "Ev giderleri ve sorumlulukları için zaman ayırdı.", "household_agreement");
    }
  } else if (id === "household_family_visit") {
    if (choiceId === "private") {
      addMemory(state, "Ortak yaşam düzenini aileyle paylaşmayı erteledin.");
    } else if (sourceCase?.payload?.secretId) {
      transferSecret(state, sourceCase.payload.secretId, "anne");
      if (isSecretKnownTo(state, sourceCase.payload.secretId, "anne")) {
        const supportive = state.player.background.family === "supportive";
        const demanding = state.player.background.family === "demanding";
        applyRelationshipDelta(state, "anne", { trust: supportive ? 4 : 2, tension: demanding && !state.household.union.marriedSince ? 4 : -2 });
        addNpcMemory(state, "anne", demanding ? "Ortak ev kararını anlattı; aile beklentilerimiz ve sınırlarımız üzerine konuştuk." : "Ortak yaşam düzenini benimle paylaştı; nasıl destek olabileceğimi konuştuk.", "household_disclosed");
        milestone(state, "family_boundaries", "Ortak evinle aile evinin beklentilerini Anne'yle konuştun.");
      }
    }
  } else if (id === "household_families") {
    const r = ensureWedding(state), views = familyMeetingContext(state);
    Object.assign(r, { familiesMet: state.time.absoluteWeek, familyView: views.own, partnerFamilyView: views.partner, tradition: choiceId === "isteme" ? "isteme" : "informal" });
    const cost = householdChoiceCost(state, id, choiceId);
    if (cost) transact(state, -cost, "İsteme / söz ziyareti ikramı", "household");
    const objection = views.own === "objection" || views.partner === "objection";
    applyRelationshipDelta(state, person.id, { trust: 2, tension: objection ? 2 : -2 });
    for (const familyId of ["anne", "baba"]) {
      applyRelationshipDelta(state, familyId, { trust: 2, tension: objection ? 3 : -2 });
      addNpcMemory(state, familyId, objection ? "Evlilik hazırlığını ve çekincelerimizi konuştuk; son karar çiftin." : "Evlilik hazırlıklarını ve destek sınırlarımızı konuştuk.", "marriage_families");
    }
    milestone(state, "families_meet", `${person.name} ile ${choiceId === "isteme" ? "isteme/söz ziyareti" : "aile tanışması"} yaptınız. ${objection ? "Ailelerden çekince geldi; bu, evliliği veto etmez." : "Beklentiler ve maddi katkı sınırları konuşuldu."}`);
  } else if (id === "marriage_discussion") {
    const r = ensureWedding(state);
    if (choiceId === "engage") {
      transact(state, -householdChoiceCost(state, id, choiceId), "Söz ve nişan hazırlığı", "household");
      r.engagedSince = state.time.absoluteWeek;
      milestone(state, "engagement", `${person.name} ile evlilik teklifini karşılıklı kabul edip söz/nişan yaptınız; yüzük ve hazırlık bütçesi ayrıldı.`);
      schedule(state, "engagement", 2);
    } else {
      milestone(state, "marriage_plan", `${person.name} ile sade evlilik teklifini karşılıklı kabul ettiniz; tören zorunlu değil.`);
      schedule(state, "marriage", 4);
    }
  } else if (id === "engagement_preparation") {
    const r = ensureWedding(state); r.prepared = true;
    const cost = householdChoiceCost(state, id, choiceId);
    if (cost) transact(state, -cost, "Nişan daveti ve hazırlık", "household");
    applyRelationshipDelta(state, person.id, { trust: 2 });
    milestone(state, "engagement_preparation", choiceId === "expanded" ? "Nişan için yakınları davet edip ek hazırlık bütçesi ayırdınız." : "Nişanı küçük tuttunuz; yüzük ve temel hazırlıkla yetindiniz, beklentilere birlikte sınır koydunuz.");
    schedule(state, "marriage", 2);
  } else if (id === "marriage_commitment") {
    settleWeddingBudget(state, choiceId);
    state.household.union.marriedSince = state.time.absoluteWeek;
    milestone(state, "marriage", `${person.name} ile evlendin. ${state.household.union.cohabitingSince ? "Ortak bütçeniz sürüyor." : "Nikâh için önceden birlikte yaşamak gerekmedi; ortak ev planınız ayrıca yapılabilir."}`);
    applyRelationshipDelta(state, person.id, { trust: 4, tension: -3 });
    const secret = createSecret(state, { id: `marriage-${state.time.absoluteWeek}`, summary: "Evlilik kararınız", type: "household", knownBy: ["player", person.id], sourceEvent: id });
    schedule(state, "family", 3, { secretId: secret.id });
    schedule(state, "honeymoon", 2);
    if (living(state)) schedule(state, "adjustment", 8);
  } else if (id === "household_honeymoon") {
    const r = ensureWedding(state); r.honeymoon = state.time.absoluteWeek;
    const cost = householdChoiceCost(state, id, choiceId);
    if (cost) transact(state, -cost, "Kısa balayı", "household");
    applyRelationshipDelta(state, person.id, { closeness: 2, tension: -2 });
    milestone(state, "honeymoon", choiceId === "trip" ? "Bütçenize uygun kısa bir balayına çıktınız." : "Balayını uzakta aramadınız; evde birlikte sakin bir zaman ayırdınız.");
  }

}

export function canReconcile(state) {
  const union = state.household.union;
  const relationship = partner(state) && getRelationship(state, partner(state).id);
  return Boolean(union.separatedSince && !union.reconciled && state.time.absoluteWeek >= union.separatedSince + 6 &&
    state.household.homeId !== "family" && relationship?.trust >= 68 && relationship.tension <= 25);
}

const option = (id, label) => ({ id, label, effects: {} });
const definition = (id, title, text, condition, choices, cooldownWeeks = 24) => ({ id, title, text, condition, choices, repeat: "cooldown", cooldownWeeks, household: true, validateChoice: householdChoiceAvailability });
export const HOUSEHOLD_EVENTS = [
  definition("relationship_breakup", "İlişkinin geleceği", "Birlikte devam etmek istemiyorsan bunu açıkça söyleyebilirsin. Nişan evlilik değildir; ayrılık ortak geçmişi veya alınmış borcu silmez.", () => false, [option("later", "Şimdi karar verme"), option("end", "İlişkiyi bitir · bir aktivite")]),
  definition("household_families", "Ailelerle aynı sofrada", "İsterseniz gündelik bir tanışma, isterseniz isteme/söz ziyareti yapın. Ailelerin desteği, çekincesi ve bütçesi farklı olabilir; karar ikinize ait. Aile onayı evliliğin şartı değildir.", () => false, [option("later", "Tanışmayı sonraya bırak"), option("informal", "Bir çay sofrasında tanışın"), option("isteme", "İsteme / söz ziyareti yapın")]),
  definition("engagement_preparation", "Nişanı nasıl yapalım?", "Yüzük için bütçe ayırdınız. Kalabalık bir davet şart değil; çeyiz, yeni ev ve düğün için de kaynak gerekecek. Aile beklentilerini birbirinize yüklemeden konuşun.", () => false, [option("cancel", "Hazırlığı ertele"), option("modest", "Küçük tutalım; yeni eve kaynak kalsın"), option("expanded", "Yakınları davet edip hazırlığı genişletelim")]),
  definition("household_honeymoon", "İkinize kalan zaman", "Evliliğin ilk haftalarında dinlenmek ve birlikte vakit geçirmek de bir ihtiyaç. Yolculuk zorunlu değil; yeni bütçenize göre karar verin.", () => false, [option("later", "Şimdi zaman ayıramıyoruz"), option("home", "Evde sakin birkaç gün geçirelim"), option("trip", "Kısa bir balayına çıkalım")]),
  definition("separation_discussion", "Bir süre ayrı yaşamak", "Çözülmemiş gerilim ortak hayatı zorluyor. Ayrı yaşamak evliliği kendiliğinden bitirmez. Mevcut ev sende kalır; partner katkısı sona erer.", (state) => canDiscussHousehold(state, "separation"), [option("later", "Şimdilik karar alma"), option("separate", "Ayrı yaşamaya başla · bir aktivite")]),
  definition("separation_review", "Ayrı geçen haftalardan sonra", "Evliliği sürdürmek veya bitirmek açık bir karar ister. Barışmak geçmişi silmez. Henüz hazır değilsen ayrı yaşamayı sürdürebilirsin.", () => false, [option("private", "Ayrı yaşamayı sürdür"), option("reconcile", "Ortak yaşama yeniden şans ver · bir aktivite"), option("divorce", "Boşanma kararını kesinleştir · bir aktivite")]),
  definition("family_intent_discussion", "Çocuk fikrine bakışınız", "İstek, zamanlama ve mevcut sorumluluklar aynı şey değil. Partnerinin bugünkü yanıtı ortak düzenin ve bütçenin hazır olup olmadığına bağlı; senin niyetin farklı olabilir.", (state) => canDiscussHousehold(state, "planning"), [option("later", "Şimdi konuşma"), ...Object.entries(FAMILY_INTENTS).map(([id, text]) => option(id, `${text} · bir aktivite`))]),
  definition("family_intent_review", "Birbirini zorlamadan", "Bu görüşme bir karar dayatmak için değil, farklı niyetlerin ilişkiye nasıl yansıdığını konuşmak için. Bir konuşma kimsenin tercihini değiştirmez.", () => false, [option("private", "Düşünmek için zaman bırak"), option("talk", "Niyetleri ve sınırları konuş · bir aktivite")]),
  definition("cohabitation_discussion", "Aynı evde bir hayat", "Birlikte yaşamak evlenmek değil. Giderleri paylaşmak kadar ortak alan ve sorumluluklar da konuşulmalı.", (state) => canDiscussHousehold(state, "cohabitation"), [option("later", "Şimdilik ayrı düzenlerde kal"), option("plan", "Taşınmayı birlikte planla · bir aktivite")]),
  definition("cohabitation_move", "Ortak ev kararı", "İki kişilik düzeni kuracağınız evi seçin. Taşınma masrafı bir kez, paylaşılan giderler ay sonunda işlenir.", () => false, [option("cancel", "Planı ertele"), option("shared", "Paylaşımlı ev · taşınma ₺2.400"), option("studio", "Stüdyo · taşınma ₺5.200")]),
  definition("household_adjustment", "Aynı ev, ayrı ihtiyaçlar", "Giderler, ev işleri ve kişisel alan için ortak zaman ayırmak gerekiyor. Bu görüşme iş, eğitim ve dinlenmeyle aynı haftalık zamanı kullanır.", () => false, [option("skip", "Bu hafta zaman ayıramıyorum"), option("coordinate", "Sorumlulukları konuş · bir aktivite"), option("separate_homes", "İlişkiyi sürdür, ayrı evlerde yaşa · bir aktivite")]),
  definition("household_family_visit", "Aile evine anlatmak", "Ortak yaşam kararınızı Anne'yle konuşabilir, beklentileri ve sınırları açıklayabilirsiniz. Paylaşmazsan kendiliğinden öğrenmez.", () => false, [option("private", "Şimdilik aramızda kalsın"), option("tell", "Anne'yle konuş · bir aktivite")]),
  definition("marriage_discussion", "Evliliği konuşmak", "Birbirinize güveniniz var. Evlilik ayrı bir karar; ilişkiyi bu biçimde sürdürmek de geçerli. İstersen önce söz/nişan yapıp ailelerle hazırlığı konuşabilirsin.", (state) => canDiscussHousehold(state, "marriage"), [option("later", "Mevcut ilişki biçimini sürdür"), option("plan", "Evliliği sade biçimde planla · bir aktivite"), option("engage", "Teklifi kabul edip söz/nişan yap · bir aktivite")]),
  definition("marriage_commitment", "Ortak karar", "Nikâh, kutlama ve ortak ev ayrı tercihlerdir. Maliyet ve peşin ihtiyaç aşağıda dönem parasıyla gösterilir. Aile katkısı yalnız görüşülmüş destekten gelir; takı henüz harcanabilir gelir değildir.", () => false, [option("cancel", "Evliliği ertele"), option("confirm", "Sade nikâh · bir aktivite"), option("community", "Yakın çevreyle kutla · bir aktivite"), option("wedding", "Salon düğünü · bir aktivite"), option("financed", "İhtiyaç kredisiyle salon düğünü · iki aktivite")]),
];
