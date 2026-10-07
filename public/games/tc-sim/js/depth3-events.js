import { createSecret, transferSecret } from "./depth2-systems.js?v=10";
import { addCareerHistory, addNpcMemory } from "./state.js?v=10";
import { applyRelationshipDelta, getPerson, markMeaningfulContact } from "./social.js?v=10";
import {
  createFavor,
  createNetworkOpportunity,
  exposeKnownMilestone,
  getNetworkContacts,
  getPerceptionContext,
  getReputationContext,
  getRealityPerceptionGap,
  getSocialDistanceContext,
  resolveFavor,
  markNpcMilestoneKnown,
  recordReputationEvidence,
  DEPTH3_CHAIN_REGISTRY,
} from "./depth3-systems.js?v=10";

const hasWeakContact = (state) => getNetworkContacts(state).some((person) => person.contactCategory === "weak" || person.contactCategory === "former");

export const DEPTH3_EVENTS = [
  {
    id: "housing_move_followup", chainId: DEPTH3_CHAIN_REGISTRY.LOCATION_SOCIAL.id, repeat: "cooldown", cooldownWeeks: 24, depth3: true,
    title: "Taşınmanın yankısı", text: "Yeni düzenin otururken aileyle ve yakınlarınla görüşme biçimin de değişti.", condition: () => false,
    choices: [
      { id: "make_time", label: "Görüşmeye zaman ayır", effects: { health: { stress: -2 }, memory: "Taşınmanın ardından yakınlarınla görüşmeye zaman ayırdın." } },
      { id: "keep_distance", label: "Mesafeyi koru", effects: { health: { stress: 2 }, memory: "Taşınmanın ardından kendi düzenini korumayı seçtin." } },
    ],
  },
  {
    id: "network_reconnect_news", repeat: "cooldown", cooldownWeeks: 36, depth3: true,
    title: "Eski çevreden haber", text: "Bir süredir görüşmediğin birinden haber geldi. Hayatındaki değişimi doğrudan sorabilirsin.",
    condition: (state) => state.time.absoluteWeek >= 24 && hasWeakContact(state) && !state.flags.networkNewsSeen,
    choices: [
      { id: "ask", label: "Haber sor", effects: { health: { energy: -2 }, memory: "Eski çevrenden gelen haberi takip ettin." } },
      { id: "later", label: "Sonra konuşuruz", effects: { health: { stress: 1 }, memory: "Eski çevrenden gelen haberi bu kez erteledin." } },
    ],
  },
  {
    id: "network_referral_offer", chainId: DEPTH3_CHAIN_REGISTRY.MILESTONE_NETWORK.id, repeat: "cooldown", cooldownWeeks: 52, depth3: true,
    title: "Bir iş bağlantısı", text: "Burak, çalıştığı ekipteki bir ihtiyacı senden söz ederek değerlendirebileceğini söylüyor.",
    condition: (state) => state.time.absoluteWeek >= 36 && state.career.jobId !== null && !getPerson(state, "burak")?.dormant && getPerson(state, "burak")?.lifeMilestones?.some((item) => item.id === "burak-promotion") && getPerson(state, "burak")?.knownMilestones?.includes("burak-promotion") && getReputationContext(state, "professional").signal !== "unreliable" && !state.openCases.some((item) => item.payload?.networkType === "network_referral_followup" && item.status !== "resolved"),
    choices: [
      { id: "consider", label: "Bağlantıyı değerlendir", effects: { health: { energy: -3, stress: 3 }, memory: "Burak'ın iş bağlantısını değerlendirmeye aldın." } },
      { id: "decline", label: "Şimdilik reddet", effects: { health: { stress: -1 }, memory: "Burak'ın iş bağlantısını bu kez reddettin." } },
    ],
  },
  {
    id: "network_referral_followup", chainId: DEPTH3_CHAIN_REGISTRY.MILESTONE_NETWORK.id, repeat: "cooldown", cooldownWeeks: 24, depth3: true,
    title: "İş bağlantısının devamı", text: "Burak senden bu bağlantının arkasında durup durmayacağını netleştirmeni istiyor.", condition: () => false,
    choices: [
      { id: "show_up", label: "Görüşmeye git", effects: { health: { energy: -4 }, memory: "İş bağlantısının görüşmesine gittin." } },
      { id: "ignore", label: "Takip etme", effects: { health: { stress: 4 }, memory: "İş bağlantısının devamını takip etmedin." } },
    ],
  },
  {
    id: "network_housing_lead", repeat: "cooldown", cooldownWeeks: 60, depth3: true,
    title: "Taşınma için bir ipucu", text: "Selin'in kurduğu düzende boşalan bir oda için senden söz edebileceğini söylüyor.",
    condition: (state) => state.household.homeId === "family" && state.time.absoluteWeek >= 72 && getPerson(state, "selin")?.knownMilestones?.includes("selin-moved") && !state.flags.housingLeadSeen,
    choices: [
      { id: "ask", label: "Ayrıntıları sor", effects: { health: { energy: -2, stress: 2 }, memory: "Selin'in taşınma bağlantısının ayrıntılarını sordun." } },
      { id: "pass", label: "Şimdilik bekle", effects: { health: { stress: -1 }, memory: "Taşınma bağlantısını şimdilik beklettin." } },
    ],
  },
  {
    id: "network_favor_due", repeat: "cooldown", cooldownWeeks: 24, depth3: true,
    title: "Verdiğin iyiliğin karşılığı", text: "Bir tanıdığın, daha önce verdiğin sözün gereğini hatırlatıyor.", condition: () => false,
    choices: [
      { id: "fulfill", label: "Sözünü tut", effects: { health: { energy: -4, stress: -2 }, memory: "Bir tanıdığına verdiğin iyiliğin karşılığını yerine getirdin." } },
      { id: "decline", label: "Bu kez yapamayacağını söyle", effects: { health: { stress: 5 }, memory: "Bir tanıdığına verdiğin iyiliğin karşılığını bu kez yerine getiremedin." } },
    ],
  },
  {
    id: "network_return_favor", repeat: "cooldown", cooldownWeeks: 44, depth3: true,
    title: "Bir iyilik isteği", text: "Daha önce yanında olan birine bu kez senin destek olup olmayacağın soruluyor.",
    condition: (state) => state.favors?.some((item) => item.direction === "npc_owes" && item.status === "open"),
    choices: [
      { id: "help", label: "Yardım et", effects: { health: { energy: -4, stress: 2 }, memory: "Daha önce yanında olan birine destek oldun." } },
      { id: "decline", label: "Sınır koy", effects: { health: { stress: -1 }, memory: "Bir iyilik isteğine bu kez sınır koydun." } },
    ],
  },
  {
    id: "family_circle_reaction", repeat: "cooldown", cooldownWeeks: 48, depth3: true,
    title: "Aile çevresinin yorumu", text: "Aile çevresinde son dönemdeki iş ve para kararların hakkında bir yorum dolaşıyor.",
    condition: (state) => state.household.homeId === "family" && getReputationContext(state, "family").signal === "pressure" && state.time.absoluteWeek >= 48,
    choices: [
      { id: "explain", label: "Durumu açıkla", effects: { health: { stress: -2 }, memory: "Aile çevresine durumunu sakin biçimde anlattın." } },
      { id: "boundary", label: "Konuyu kapat", effects: { health: { stress: 2 }, memory: "Aile çevresinin yorumlarına sınır koydun." } },
    ],
  },
  {
    id: "perception_reality_gap", chainId: DEPTH3_CHAIN_REGISTRY.FAMILY_PERCEPTION.id, repeat: "cooldown", cooldownWeeks: 52, depth3: true,
    title: "Görünen ile olan", text: "Çevrenin seni nasıl gördüğüyle yaşadığın gerçeklik arasında bir fark açılmış olabilir.",
    condition: (state) => state.time.absoluteWeek >= 60 && getRealityPerceptionGap(state, "family").gap,
    choices: [
      { id: "share", label: "Gerçeği paylaş", effects: { health: { stress: 4 }, memory: "Görünen ile yaşadığın gerçeklik arasındaki farkı paylaştın." } },
      { id: "keep", label: "Şimdilik sakla", effects: { health: { stress: 3 }, memory: "Yaşadığın sıkışıklığı şimdilik kendine sakladın." } },
    ],
  },
  {
    id: "former_contact_reconnect", repeat: "cooldown", cooldownWeeks: 56, depth3: true,
    title: "Eski bir bağlantı", text: "Uzun süredir görüşmediğin bir tanıdık yeniden yazdı. İlişkinin yönünü sen belirleyeceksin.",
    condition: (state) => state.time.absoluteWeek >= 84 && state.people.some((person) => person.dormant && person.contactCategory === "former"),
    choices: [
      { id: "reconnect", label: "Yeniden görüş", effects: { health: { energy: -3, stress: -2 }, memory: "Eski bir bağlantıyla yeniden görüştün." } },
      { id: "leave", label: "Olduğu yerde bırak", effects: { health: { stress: -1 }, memory: "Eski bağlantının yeniden başlamasını istemedin." } },
    ],
  },
  {
    id: "network_housing_conversation", repeat: "cooldown", cooldownWeeks: 24, depth3: true,
    title: "Yaşam düzeni üzerine", text: "Bir tanıdığın, ev ve iş arasındaki düzenin hakkında gerçekçi bir öneri sunuyor.",
    condition: (state) => state.time.absoluteWeek >= 52 && state.household.homeId !== "family" && getSocialDistanceContext(state, "selin"),
    choices: [
      { id: "listen", label: "Dinle", effects: { health: { stress: -2 }, memory: "Yaşam düzeni üzerine bir tanıdığının önerisini dinledin." } },
      { id: "ignore", label: "Kendi düzeninde kal", effects: { health: { stress: 1 }, memory: "Yaşam düzeninle ilgili öneriyi dikkate almadın." } },
    ],
  },
];

for (const definition of DEPTH3_EVENTS) definition.depth3 = true;

export function applyDepth3Resolution(state, definition, choiceId, sourceCase = null) {
  const id = definition.id;
  if (id === "network_reconnect_news") {
    state.flags.networkNewsSeen = true;
    if (choiceId === "ask") {
      const person = state.people.find((item) => item.contactCategory === "weak" || item.contactCategory === "former");
      if (person?.lifeMilestones[0]) markNpcMilestoneKnown(state, person.id, person.lifeMilestones[0].id);
    }
  }
  if (id === "network_referral_offer") {
    state.flags.networkReferralSeen = true;
    if (choiceId === "consider") {
      createFavor(state, { personId: "burak", type: "referral", dueWeeks: 6, sourceEvent: id });
      createNetworkOpportunity(state, "burak", "network_referral_followup", 6);
    }
  }
  if (id === "network_referral_followup") {
    const favor = state.favors.find((item) => item.personId === "burak" && item.type === "referral" && item.status === "open");
    if (favor) resolveFavor(state, favor.id, choiceId === "show_up" ? "fulfilled" : "broken");
    if (choiceId === "show_up") addCareerHistory(state, { type: "network", label: "Bir iş bağlantısını değerlendirdin." });
  }
  if (id === "network_housing_lead") {
    state.flags.housingLeadSeen = true;
    if (choiceId === "ask") createFavor(state, { personId: "selin", type: "housing", dueWeeks: 8, sourceEvent: id });
  }
  if (id === "network_favor_due" && sourceCase?.payload?.favorId) resolveFavor(state, sourceCase.payload.favorId, choiceId === "fulfill" ? "fulfilled" : "broken");
  if (id === "network_return_favor") {
    const favor = state.favors.find((item) => item.direction === "npc_owes" && item.status === "open");
    if (favor) resolveFavor(state, favor.id, choiceId === "help" ? "fulfilled" : "declined");
  }
  if (id === "family_circle_reaction") {
    const good = choiceId === "explain";
    applyRelationshipDelta(state, "anne", good ? { trust: 2, tension: -2 } : { trust: -2, tension: 3 });
    recordReputationEvidence(state, "family", good ? "reliable" : "distant", good ? 1 : -1, id);
  }
  if (id === "perception_reality_gap" && choiceId === "share") {
    const secret = createSecret(state, { id: "financial-context", type: "money", summary: "Paylaşılan maddi durum", knownBy: ["player"], sourceEvent: id });
    transferSecret(state, secret.id, "anne");
    state.perception.circles.family = state.finances.balance < 2500 ? "baskı altında" : "dengeli";
    applyRelationshipDelta(state, "anne", { trust: 3, tension: -2 });
  }
  if (id === "former_contact_reconnect") {
    const person = state.people.find((item) => item.dormant && item.contactCategory === "former");
    if (person) { person.dormant = choiceId !== "reconnect"; if (choiceId === "reconnect") markMeaningfulContact(state, person.id); }
  }
  if (id === "network_housing_conversation" && choiceId === "listen") {
    addNpcMemory(state, "selin", "Yaşam düzeni hakkında konuştu.", "housing_context");
    applyRelationshipDelta(state, "selin", { closeness: 2, trust: 2, tension: -1 });
  }
  if (id === "housing_move_followup") {
    const movedAway = sourceCase?.payload?.intercity || (sourceCase?.payload?.fromHomeId === "family" && sourceCase?.payload?.toHomeId !== "family");
    if (movedAway) {
      const good = choiceId === "make_time";
      applyRelationshipDelta(state, "anne", good ? { trust: 2, tension: -1 } : { trust: -1, tension: 2 });
      addNpcMemory(state, "anne", good ? "Taşındıktan sonra da görüşmeye zaman ayırdı." : "Taşındıktan sonra kendi düzenine çekildi.", "housing_move");
    }
  }
}
