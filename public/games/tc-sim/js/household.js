import { addMemory, addNpcMemory, appendCapped, getWeeklyActivityLimit, transact } from "./state.js?v=10";
import { getPerson, getRelationship, applyRelationshipDelta, markMeaningfulContact } from "./social.js?v=10";
import { getHomeById, relocateHome, getMonthlySummary } from "./life.js?v=10";
import { createSecret, transferSecret, isSecretKnownTo } from "./depth2-systems.js?v=10";

export const HOUSEHOLD_HISTORY_LIMIT = 24;
export const MARRIAGE_COST = 6000;
export const FAMILY_INTENTS = Object.freeze({ wants: "İleride çocuk istiyorum", not_now: "Şimdi değil", no: "Çocuk istemiyorum", unsure: "Emin değilim" });
export function neutralUnion() {
  return { cohabitingSince: null, marriedSince: null, separatedSince: null, reconciled: false, familyPlan: null };
}
export const HOUSEHOLD_CHAINS = Object.freeze({
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
  if (!partner(state) || pending(state, kind)) return false;
  if (kind === "separation") return Boolean(state.household.union.marriedSince && !state.household.union.separatedSince && (getRelationship(state, partner(state).id).tension >= 50 || getRelationship(state, partner(state).id).trust < 40));
  if (kind === "planning") return Boolean(state.household.union.marriedSince && !state.household.union.separatedSince && !state.household.union.familyPlan);
  if (state.household.union.separatedSince) return false;
  if (kind === "cohabitation") {
    const started = partner(state).memories.find((item) => item.type === "became_partner");
    return !living(state) && stablePartner(state) && state.time.absoluteWeek - (started?.week || 1) >= 4;
  }
  if (kind === "marriage") return living(state) && !state.household.union.marriedSince && stablePartner(state) && state.time.absoluteWeek - state.household.union.cohabitingSince >= 8;
  return false;
}

export function getHouseholdSummary(state) {
  const person = partner(state);
  const cohabiting = living(state);
  return {
    partnerName: person?.name || null,
    status: state.household.union?.separatedSince && person ? "Ayrı yaşıyor · evli" : state.household.union?.marriedSince && person ? "Evli" : person ? "Sevgili" : "Partner yok",
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
  const relationship = partner(state) && getRelationship(state, state.social.currentPartnerNpcId);
  if (living(state) && state.time.absoluteWeek >= state.household.union.cohabitingSince + 12 &&
    state.time.absoluteWeek >= (state.events.cooldowns.household_adjustment || 0) &&
    (state.household.homeId === "shared" || relationship.tension >= 30 || state.finances.balance < 2500)) {
    schedule(state, "adjustment", 2);
  }
}

function useTime(state, id) {
  state.weekly.used += 1;
  state.weekly.selectedIds.push(`household:${id}`);
  markMeaningfulContact(state, state.social.currentPartnerNpcId);
}

export function householdChoiceAvailability(state, definition, choice, sourceCase) {
  if (definition.id === "move_in_with_elif" && choice.id !== "look") return { ok: true };
  if (["later", "cancel", "skip", "private"].includes(choice.id)) return { ok: true };
  if (!partner(state) || (sourceCase && sourceCase.payload?.personId !== state.social.currentPartnerNpcId)) return { ok: false, reason: "Bu planın partner bağlamı değişti." };
  if (sourceCase && (sourceCase.eventId !== definition.id || state.time.absoluteWeek < sourceCase.dueWeek)) return { ok: false, reason: "Bu planın görüşme zamanı henüz gelmedi." };
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
  if (definition.id === "marriage_discussion" && choice.id === "engage" && state.finances.balance < 1500) return { ok: false, reason: "Söz/nişan hazırlığı için bütçe yetersiz." };
  if (definition.id === "marriage_commitment" && (!living(state) || state.household.union.marriedSince || !stablePartner(state) || state.finances.balance < (choice.id === "wedding" ? MARRIAGE_COST + 14000 : MARRIAGE_COST))) return { ok: false, reason: "İlişki, ortak ev veya seçilen hazırlığın bütçesi uygun değil. Erteleyebilirsin." };
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
  if (id === "separation_discussion") {
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
  } else if (id === "marriage_discussion") {
    schedule(state, "marriage", 4);
    if (choiceId === "engage") {
      transact(state, -1500, "Söz ve nişan hazırlığı", "household");
      milestone(state, "engagement", `${person.name} ile söz/nişan yaptınız; aile beklentileri ve evlilik bütçesi konuşuldu.`);
    } else milestone(state, "marriage_plan", `${person.name} ile evlilik kararını ve hazırlık bütçesini görüşmek üzere sözleştiniz.`);
  } else if (id === "marriage_commitment") {
    transact(state, -MARRIAGE_COST, "Ortak evlilik hazırlığı", "household");
    if (choiceId === "wedding") {
      transact(state, -14000, "Düğün salonu, yemek ve hazırlık", "household");
      const gifts = state.player.background.social === "broad" ? 11000 : state.player.background.family === "supportive" ? 8500 : 6000;
      transact(state, gifts, "Düğün takı ve zarf gelirleri", "household");
      addMemory(state, `Düğün takıları ${gifts.toLocaleString("tr-TR")} oyun birimi getirdi; salon ve hazırlık giderleri ayrı işlendi.`, "important");
    }
    state.household.union.marriedSince = state.time.absoluteWeek;
    milestone(state, "marriage", `${person.name} ile evlendin.`);
    applyRelationshipDelta(state, person.id, { trust: 4, tension: -3 });
    const secret = createSecret(state, { id: `marriage-${state.time.absoluteWeek}`, summary: "Evlilik kararınız", type: "household", knownBy: ["player", person.id], sourceEvent: id });
    schedule(state, "family", 3, { secretId: secret.id });
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
  definition("separation_discussion", "Bir süre ayrı yaşamak", "Çözülmemiş gerilim ortak hayatı zorluyor. Ayrı yaşamak evliliği kendiliğinden bitirmez. Mevcut ev sende kalır; partner katkısı sona erer.", (state) => canDiscussHousehold(state, "separation"), [option("later", "Şimdilik karar alma"), option("separate", "Ayrı yaşamaya başla · bir aktivite")]),
  definition("separation_review", "Ayrı geçen haftalardan sonra", "Evliliği sürdürmek veya bitirmek açık bir karar ister. Barışmak geçmişi silmez. Henüz hazır değilsen ayrı yaşamayı sürdürebilirsin.", () => false, [option("private", "Ayrı yaşamayı sürdür"), option("reconcile", "Ortak yaşama yeniden şans ver · bir aktivite"), option("divorce", "Boşanma kararını kesinleştir · bir aktivite")]),
  definition("family_intent_discussion", "Çocuk fikrine bakışınız", "İstek, zamanlama ve mevcut sorumluluklar aynı şey değil. Partnerinin bugünkü yanıtı ortak düzenin ve bütçenin hazır olup olmadığına bağlı; senin niyetin farklı olabilir.", (state) => canDiscussHousehold(state, "planning"), [option("later", "Şimdi konuşma"), ...Object.entries(FAMILY_INTENTS).map(([id, text]) => option(id, `${text} · bir aktivite`))]),
  definition("family_intent_review", "Birbirini zorlamadan", "Bu görüşme bir karar dayatmak için değil, farklı niyetlerin ilişkiye nasıl yansıdığını konuşmak için. Bir konuşma kimsenin tercihini değiştirmez.", () => false, [option("private", "Düşünmek için zaman bırak"), option("talk", "Niyetleri ve sınırları konuş · bir aktivite")]),
  definition("cohabitation_discussion", "Aynı evde bir hayat", "Birlikte yaşamak evlenmek değil. Giderleri paylaşmak kadar ortak alan ve sorumluluklar da konuşulmalı.", (state) => canDiscussHousehold(state, "cohabitation"), [option("later", "Şimdilik ayrı düzenlerde kal"), option("plan", "Taşınmayı birlikte planla · bir aktivite")]),
  definition("cohabitation_move", "Ortak ev kararı", "İki kişilik düzeni kuracağınız evi seçin. Taşınma masrafı bir kez, paylaşılan giderler ay sonunda işlenir.", () => false, [option("cancel", "Planı ertele"), option("shared", "Paylaşımlı ev · taşınma ₺2.400"), option("studio", "Stüdyo · taşınma ₺5.200")]),
  definition("household_adjustment", "Aynı ev, ayrı ihtiyaçlar", "Giderler, ev işleri ve kişisel alan için ortak zaman ayırmak gerekiyor. Bu görüşme iş, eğitim ve dinlenmeyle aynı haftalık zamanı kullanır.", () => false, [option("skip", "Bu hafta zaman ayıramıyorum"), option("coordinate", "Sorumlulukları konuş · bir aktivite"), option("separate_homes", "İlişkiyi sürdür, ayrı evlerde yaşa · bir aktivite")]),
  definition("household_family_visit", "Aile evine anlatmak", "Ortak yaşam kararınızı Anne'yle konuşabilir, beklentileri ve sınırları açıklayabilirsiniz. Paylaşmazsan kendiliğinden öğrenmez.", () => false, [option("private", "Şimdilik aramızda kalsın"), option("tell", "Anne'yle konuş · bir aktivite")]),
  definition("marriage_discussion", "Evliliği konuşmak", "Ortak düzeniniz oturuyor. Evlilik ayrı bir karar; ilişkiyi bu biçimde sürdürmek de geçerli. İstersen önce söz/nişan yapıp ailelerle hazırlığı konuşabilirsin.", (state) => canDiscussHousehold(state, "marriage"), [option("later", "Mevcut ilişki biçimini sürdür"), option("plan", "Evliliği sade biçimde planla · bir aktivite"), option("engage", "Söz/nişan yap · hazırlık gideri 1.500 · bir aktivite")]),
  definition("marriage_commitment", "Ortak karar", "Evliliğin biçimini birlikte seçin. Sade hazırlık 6.000; düğün ek 14.000. Düğün takıları gelir getirebilir ama gideri garanti karşılamaz.", () => false, [option("cancel", "Evliliği ertele"), option("confirm", "Sade evlilik · 6.000 · bir aktivite"), option("wedding", "Düğün yap · 20.000 brüt gider, takı geliri · bir aktivite")]),
];
