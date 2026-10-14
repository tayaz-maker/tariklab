import {
  addCareerHistory,
  addMemory,
  addNpcMemory,
  adjustHealth,
  adjustTendency,
  appendCapped,
  recordComparisonMilestone,
  transact,
} from "./state.js?v=10";
import { applyRelationshipDelta } from "./social.js?v=10";
import { CAREER_RISK_PERFORMANCE, clampMoneyReliefAmount, endEmployment, getMoneyReliefAmount, promoteCareer, retireCareer } from "./life.js?v=10";
import { hatirSentences } from "./march-hatir.js?v=10";

const MAX_DEPTH2_CASES = 24;

export function scheduleDepth2Followup(state, { id, eventId, dueWeek, expiresWeek, kind, payload = {} } = {}) {
  if (!eventId || !Number.isInteger(dueWeek)) return false;
  const caseId = id || `depth2-${eventId}-${state.time.absoluteWeek}`;
  if (state.openCases.some((item) => item.id === caseId)) return false;
  const cases = state.openCases.filter((item) => item.type === "depth2-followup" && item.status !== "resolved");
  if (cases.length >= MAX_DEPTH2_CASES) return false;
  state.openCases.push({
    id: caseId,
    type: "depth2-followup",
    createdWeek: state.time.absoluteWeek,
    dueWeek,
    expiresWeek: Number.isInteger(expiresWeek) ? expiresWeek : dueWeek + 8,
    eventId,
    status: "pending",
    payload: { kind, ...payload },
  });
  return true;
}

export function createSecret(state, { id, type = "personal", summary, relatedPeople = [], knownBy = ["player"], hiddenFrom = [], evidence = "none", sourceEvent = null } = {}) {
  if (!id || !summary || !Array.isArray(knownBy)) return null;
  const existing = state.secrets.find((secret) => secret.id === id);
  if (existing) return existing;
  const secret = {
    id,
    type,
    summary,
    relatedPeople: relatedPeople.filter((value) => typeof value === "string").slice(0, 4),
    knownBy: [...new Set(knownBy.filter((value) => typeof value === "string"))],
    hiddenFrom: [...new Set(hiddenFrom.filter((value) => typeof value === "string"))].slice(0, 4),
    evidence: ["none", "weak", "strong"].includes(evidence) ? evidence : "none",
    status: knownBy.some((personId) => personId !== "player") ? "exposed" : "hidden",
    createdWeek: state.time.absoluteWeek,
    sourceEvent,
  };
  appendCapped(state.secrets, secret, 30);
  return secret;
}

export function seedDepth2Secrets(state) {
  if (state.household?.homeId === "family" && !state.secrets.some((secret) => secret.id === "family-home-privacy")) {
    createSecret(state, {
      id: "family-home-privacy",
      type: "privacy",
      summary: "Aile evindeki kişisel alan ihtiyacı",
      relatedPeople: ["anne", "baba"],
      knownBy: ["player"],
      sourceEvent: "privacy_context_event",
    });
  }
}

export function transferSecret(state, id, personId, from = "player") {
  const secret = state.secrets.find((item) => item.id === id);
  if (!secret || !personId || personId === from || !secret.knownBy.includes(from) || secret.knownBy.includes(personId)) return false;
  secret.knownBy.push(personId);
  secret.status = "exposed";
  secret.exposedWeek = state.time.absoluteWeek;
  addNpcMemory(state, personId, secret.summary, "secret_learned");
  return true;
}

export function resolveSecret(state, id) {
  const secret = state.secrets.find((item) => item.id === id);
  if (!secret) return false;
  secret.status = "resolved";
  secret.resolvedWeek = state.time.absoluteWeek;
  return true;
}

export function isSecretKnownTo(state, id, personId = "player") {
  return Boolean(state.secrets.find((item) => item.id === id)?.knownBy.includes(personId));
}

export function advanceComparisonCircle(state) {
  if (!state.comparisonCircle) return;
  const week = state.time.absoluteWeek;
  const milestones = state.comparisonCircle.milestones;
  const peers = state.comparisonCircle.peers || [];
  const markPeer = (id, key, status, text) => {
    const peer = peers.find((item) => item.id === id);
    if (!peer || peer.milestones?.some((item) => item.key === key)) return;
    peer.status = status;
    peer.milestones = Array.isArray(peer.milestones) ? peer.milestones : [];
    peer.milestones.push({ key, week, text });
    if (peer.milestones.length > 8) peer.milestones.splice(0, peer.milestones.length - 8);
    peer.memories = Array.isArray(peer.memories) ? peer.memories : [];
    peer.memories.push({ week, text });
    if (peer.memories.length > 12) peer.memories.splice(0, peer.memories.length - 12);
  };
  if (week >= 24 && !milestones.some((item) => item.key === "first-year")) {
    markPeer("comparison-cousin", "first-year", "Yeni bir iş buldu", "Selin yeni bir işe geçti.");
    recordComparisonMilestone(state, { key: "first-year", text: "Selin yeni bir işe geçti; Emre eğitimine devam ediyor." });
  }
  if (week >= 52 && !milestones.some((item) => item.key === "second-year")) {
    markPeer("comparison-classmate", "second-year", "Eğitimini sürdürüyor", "Emre eğitimine devam ediyor.");
    recordComparisonMilestone(state, { key: "second-year", text: "Çevrendeki insanların yolları senden farklı ilerliyor." });
  }
  if (week >= 104 && !milestones.some((item) => item.key === "third-year")) {
    markPeer("comparison-cousin", "third-year", "Kendi düzenini kurdu", "Selin kendi düzenini kurdu.");
    recordComparisonMilestone(state, { key: "third-year", text: "Selin kendi düzenini kurdu; senin önceliklerin yeniden görünür oldu." });
  }
}

export function expireMilitaryObligation(state) {
  if (!state?.military?.applicable || state.military.status !== "pending") return false;
  if (!Number.isInteger(state.military.dueWeek) || state.time.absoluteWeek <= state.military.dueWeek) return false;
  state.military.status = "expired";
  state.military.dueWeek = null;
  addMemory(state, "Askerlik planındaki erteleme penceresi sona erdi; yükümlülüğü yeniden planlaman gerekiyor.", "important");
  return true;
}

export function getRelationshipContext(state, personId) {
  const person = state.people.find((item) => item.id === personId);
  if (!person) return [];
  const notes = [];
  const homePrivacy = state.household.homeId === "family" ? 1 : state.household.homeId === "shared" ? 2 : 3;
  if (personId === state.social.currentPartnerNpcId && homePrivacy < 3) notes.push("Mahremiyet sınırlı; ortak planlar daha fazla koordinasyon istiyor.");
  if (personId === "anne" && state.household.homeId === "family") notes.push("Aynı evde yaşamak yakınlığı artırıyor, kişisel alanı daraltıyor.");
  if (personId === state.social.currentPartnerNpcId && state.finances.balance < 2500) notes.push("Sıkışık bütçe, birlikte yapılacak planları etkiliyor.");
  if (personId === state.social.currentPartnerNpcId && person.social.lastMeaningfulContactWeek <= state.time.absoluteWeek - 8) notes.push("Uzun süredir ayırdığın zaman az; ilişki bunu hissedebilir.");
  if (personId === state.social.currentPartnerNpcId && state.social.lastMaintenanceWeek <= state.time.absoluteWeek - 12) notes.push("İlişkiyi sürdürme sorumluluğu son aylarda daha görünür hale geldi.");
  if (personId === "anne" && ["demanding", "strained"].includes(state.player.background?.family)) notes.push("Aile geçmişin, iş ve para kararlarında daha fazla beklenti yaratıyor.");
  if (state.secrets?.some((secret) => secret.status === "hidden" && secret.knownBy?.includes("player") && secret.relatedPeople?.includes(personId))) notes.push("Aranızda henüz paylaşılmamış bir mesele var.");
  if (state.health.stress >= 70) notes.push("Yoğunluk, bu ilişkide ayırabildiğin zamanı azaltıyor.");
  return [...hatirSentences(state, personId), ...notes].slice(0, 2);
}

/** Geri ödeme penceresi kaçırıldığında da ödenmeme sonucu işler. */
export const MONEY_RELIEF_DEFAULT_COOLDOWN = 104;

function applyMoneyReliefDefault(state, reason) {
  applyRelationshipDelta(state, "anne", { trust: -6, tension: 8 });
  addNpcMemory(state, "anne", "Verdiği geri ödeme sözünü tutmadı.", "money_promise_broken");
  adjustHealth(state, { stress: 6 });
  // Tek ve sınırlı sonuç: destek kapısı normalin çok üstünde bir süre kapanır.
  state.events.cooldowns.money_relief_choice = state.time.absoluteWeek + MONEY_RELIEF_DEFAULT_COOLDOWN;
  addMemory(state, reason, "important");
  resolveSecret(state, "money-shortcut");
}

export function applyDepth2Resolution(state, definition, choiceId, sourceCase = null) {
  const id = definition.id;
  if (id === "career_promotion_window") {
    if (choiceId === "accept") {
      state.flags.depth2PromotionPending = true;
      scheduleDepth2Followup(state, { eventId: "career_promotion_review", dueWeek: state.time.absoluteWeek + 6, expiresWeek: state.time.absoluteWeek + 12, kind: "career_promotion" });
      addCareerHistory(state, { type: "opportunity", label: "Bir üst pozisyon için değerlendirmeye girdin." });
    } else {
      addCareerHistory(state, { type: "opportunity_declined", label: "Bir üst pozisyon teklifini bu kez erteledin." });
    }
  }
  if (id === "career_promotion_review") {
    state.flags.depth2PromotionPending = null;
    if (state.career.jobId === null) {
      // İş güvenliği kaybı ya da istifa önce sonuçlandıysa terfi görüşmesi
      // konusuz kalır. "İşten çıkarıldı ve terfi etti" çelişkisi olamaz.
      addCareerHistory(state, { type: "promotion_review", label: "Terfi görüşmesi konusuz kaldı; o iş artık yok." });
      addMemory(state, "Terfi görüşmesi konusuz kaldı; o iş artık yok.", "important");
    } else if (choiceId === "advance") {
      const promotion = promoteCareer(state);
      state.career.performance = Math.min(100, state.career.performance + 6);
      addCareerHistory(state, { type: "promotion_review", label: promotion.ok ? "Terfi değerlendirmesini olumlu tamamladın." : "Terfi değerlendirmesinde uygun bir üst pozisyon bulunamadı." });
      addMemory(state, promotion.ok ? "Terfi değerlendirmesini olumlu tamamladın." : "Terfi değerlendirmesinde uygun bir üst pozisyon bulunamadı.", "important");
    } else {
      state.career.performance = Math.max(0, state.career.performance - 4);
      addCareerHistory(state, { type: "promotion_review", label: "Terfi değerlendirmesinde mevcut tempoda kaldın." });
    }
  }
  if (id === "family_expectation_window") {
    if (choiceId === "commit") {
      scheduleDepth2Followup(state, { eventId: "family_expectation_followup", dueWeek: state.time.absoluteWeek + 8, expiresWeek: state.time.absoluteWeek + 16, kind: "family_expectation" });
      addNpcMemory(state, "anne", "Bir aile sorumluluğunu üstleneceğini söyledi.", "expectation_accepted");
      if (state.player.background?.family === "demanding") applyRelationshipDelta(state, "anne", { trust: 2, tension: 2 });
    } else {
      applyRelationshipDelta(state, "anne", { trust: -4, tension: 6 });
      if (state.player.background?.family === "supportive") applyRelationshipDelta(state, "anne", { tension: -2 });
      addNpcMemory(state, "anne", "Aile sorumluluğunu erteledi.", "expectation_deferred");
    }
  }
  if (id === "family_expectation_followup") {
    if (choiceId === "kept") {
      applyRelationshipDelta(state, "anne", { trust: 6, tension: -4 });
      addNpcMemory(state, "anne", "Üstlendiği aile sorumluluğunu yerine getirdi.", "expectation_kept");
    } else {
      applyRelationshipDelta(state, "anne", { trust: -8, tension: 8 });
      addNpcMemory(state, "anne", "Üstlendiği aile sorumluluğunu yerine getirmedi.", "expectation_broken");
    }
  }
  if (id === "money_relief_choice" && choiceId === "borrow") {
    // Tutar gerçek açıktan türer ve tam bir kez aktarılır; miktar geri ödemeye
    // kadar açık dosyanın kendi yükünde saklanır.
    const amount = getMoneyReliefAmount(state);
    if (amount > 0) {
      transact(state, amount, "Geçici aile desteği", "debt");
      createSecret(state, { id: "money-shortcut", type: "money", summary: "Ay sonunu kapatmak için alınan geçici destek", relatedPeople: ["anne"], knownBy: ["player", "anne"], sourceEvent: id });
      scheduleDepth2Followup(state, { eventId: "money_relief_due", dueWeek: state.time.absoluteWeek + 8, expiresWeek: state.time.absoluteWeek + 14, kind: "money_relief", payload: { amount } });
      addMemory(state, `Ay sonunu kapatmak için ₺${amount.toLocaleString("tr-TR")} destek aldın; geri ödeme sözü verdin.`, "important");
    } else {
      state.flags.moneyReliefOpen = null;
    }
  }
  if (id === "money_relief_due") {
    const amount = clampMoneyReliefAmount(sourceCase?.payload?.amount);
    if (choiceId === "repay") {
      transact(state, -amount, "Geçici destek geri ödemesi", "debt");
      addMemory(state, `Aldığın ₺${amount.toLocaleString("tr-TR")} desteği geri ödedin.`, "important");
      resolveSecret(state, "money-shortcut");
    } else {
      applyMoneyReliefDefault(state, "Aldığın geçici desteği geri ödeyemedin.");
    }
  }
  if (id === "secret_confrontation" && choiceId === "open") {
    transferSecret(state, "family-home-privacy", "anne");
    addNpcMemory(state, "anne", "Evdeki mahremiyet meselesini açıkça konuştu.", "secret_exposed");
  }
  if (id === "comparison_circle_update") {
    if (state.player.background?.family === "demanding" && choiceId === "follow") applyRelationshipDelta(state, "anne", { tension: 4, trust: -2 });
    if (state.player.background?.family === "supportive" && choiceId === "reflect") applyRelationshipDelta(state, "anne", { trust: 2, tension: -1 });
  }
  if (id === "education_path_window" && choiceId === "consider" && state.player.background?.education === "unfinished") {
    addMemory(state, "Yarım kalan eğitimine dönme ihtimalini yeniden değerlendirdin.");
    adjustTendency(state, "discipline", 1);
  }
  if (id === "education_path_window" && choiceId === "consider") {
    state.flags.educationWindowOpen = true;
    scheduleDepth2Followup(state, {
      eventId: "education_window_followup",
      dueWeek: state.time.absoluteWeek + 4,
      expiresWeek: state.time.absoluteWeek + 8,
      kind: "education_window",
    });
  }
  if (id === "education_window_followup") {
    state.flags.educationWindowOpen = null;
    if (choiceId === "pursue") {
      addMemory(state, "Eğitim için bir sonraki kayıt dönemine hazırlanma kararı aldın.", "important");
      adjustTendency(state, "discipline", 1);
    } else {
      addMemory(state, "Eğitim için uygun dönemi bu kez kaçırdın.", "important");
    }
  }
  if (id === "military_window" && state.military?.applicable) {
    state.military.status = choiceId === "defer" ? "deferred" : "completed";
    const deferWeeks = state.education?.active ? 60 : state.career?.jobId ? 48 : 36;
    state.military.dueWeek = choiceId === "defer" ? state.time.absoluteWeek + deferWeeks : null;
    addMemory(state, choiceId === "defer" ? "Askerlik yükümlülüğünü erteledin." : "Askerlik hizmetini planına aldın.", "important");
  }
  if (id === "job_security_warning") {
    if (choiceId === "push") createSecret(state, { id: "career-warning", type: "career", summary: "İşteki yorgunluk ve performans riski", relatedPeople: [], knownBy: ["player"], sourceEvent: id });
    const alreadyOpen = state.openCases.some((item) => item.type === "depth2-followup" && item.status !== "resolved" && item.payload?.kind === "job_security");
    if (state.career.jobId !== null && !alreadyOpen)
      scheduleDepth2Followup(state, { eventId: "job_security_review", dueWeek: state.time.absoluteWeek + 8, expiresWeek: state.time.absoluteWeek + 16, kind: "job_security" });
  }
  if (id === "job_security_review") {
    // Sonucu haftalar önce verilen cevap değil, değerlendirme anındaki gerçek
    // kariyer durumu belirler. "Toparlanacağım" demek tek başına korumaz.
    state.flags.jobSecurityRisk = null;
    state.flags.jobSecurityRecovery = null;
    resolveSecret(state, "career-warning");
    if (state.career.jobId === null) {
      addMemory(state, "İş güvenliği görüşmesi konusuz kaldı; o iş artık yok.");
    } else if (state.career.performance > CAREER_RISK_PERFORMANCE) {
      if (choiceId === "recover") state.career.performance = Math.min(100, state.career.performance + 3);
      addCareerHistory(state, { type: "security_review_passed", jobId: state.career.jobId, label: "Performans değerlendirmesini geçtin; işin devam ediyor." });
      addMemory(state, "İşteki performans değerlendirmesini geçtin.", "important");
    } else {
      endEmployment(state, { label: "Performans düşüşü sonrası işini kaybettin." });
    }
  }
  if (id === "midlife_career_family_pressure" && choiceId === "carry") {
    state.career.performance = Math.min(100, state.career.performance + 2);
  }
  if (id === "late_career_workload") {
    if (choiceId === "downshift") {
      state.flags.lateCareerReducedLoadUntil = state.time.absoluteWeek + 24;
      state.career.performance = Math.max(0, state.career.performance - 2);
    } else {
      state.flags.lateCareerReducedLoadUntil = null;
      state.career.performance = Math.min(100, state.career.performance + 2);
    }
  }
  if (id === "midlife_family_obligation") {
    if (choiceId === "commit") {
      scheduleDepth2Followup(state, {
        eventId: "midlife_family_obligation_followup",
        dueWeek: state.time.absoluteWeek + 6,
        expiresWeek: state.time.absoluteWeek + 12,
        kind: "midlife_family_obligation",
      });
      applyRelationshipDelta(state, "anne", { trust: 2 });
    } else {
      applyRelationshipDelta(state, "anne", { trust: -3, tension: 4 });
      addNpcMemory(state, "anne", "Aile yükümlülüğünde bu kez sınır koydu.", "midlife_boundary");
    }
  }
  if (id === "midlife_family_obligation_followup") {
    state.flags.midlifeFamilyObligationOpen = null;
    if (choiceId === "keep") {
      applyRelationshipDelta(state, "anne", { trust: 6, tension: -4 });
      addNpcMemory(state, "anne", "Değişen aile sorumluluğunda verdiği sözü tuttu.", "midlife_support");
    } else {
      applyRelationshipDelta(state, "anne", { trust: -7, tension: 7 });
      addNpcMemory(state, "anne", "Değişen aile sorumluluğunda verdiği sözü tutamadı.", "midlife_missed");
    }
  }
  if (id === "retirement_planning") {
    state.career.retirement.plannedWeek = state.time.absoluteWeek;
    if (choiceId === "plan") {
      state.career.retirement.status = "planned";
      scheduleDepth2Followup(state, {
        eventId: "retirement_transition",
        dueWeek: state.time.absoluteWeek + 8,
        expiresWeek: state.time.absoluteWeek + 20,
        kind: "retirement_transition",
      });
    } else {
      state.career.retirement.status = "working";
      state.career.retirement.deferredUntil = state.time.absoluteWeek + 48;
    }
  }
  if (id === "retirement_transition") {
    if (choiceId === "retire") retireCareer(state);
    else {
      state.career.retirement.status = "working";
      state.career.retirement.deferredUntil = state.time.absoluteWeek + 48;
      addCareerHistory(state, { type: "retirement_deferred", jobId: state.career.jobId, label: "Emeklilik yerine bir yıl daha çalışmayı seçtin." });
    }
  }
}

export function expireDepth2Cases(state) {
  for (const item of state.openCases) {
    if (item.type !== "depth2-followup" || item.status !== "pending" || !Number.isInteger(item.expiresWeek)) continue;
    if (state.time.absoluteWeek > item.expiresWeek) {
      item.status = "resolved";
      item.resolutionApplied = true;
      if (item.payload?.kind === "career_promotion") state.career.performance = Math.max(0, state.career.performance - 8);
      if (item.payload?.kind === "family_expectation") {
        state.flags.familyExpectationOpen = null;
        applyRelationshipDelta(state, "anne", { trust: -8, tension: 8 });
      }
      if (item.payload?.kind === "money_relief") {
        state.flags.moneyReliefOpen = null;
        // Pencereyi kaçırmak, ödememekle aynı kapıya çıkar; aksi halde olayı
        // görmezden gelmek bedelsiz bir kaçış yolu olurdu.
        applyMoneyReliefDefault(state, "Geri ödeme penceresini kaçırdın.");
      }
      if (item.payload?.kind === "job_security") {
        state.flags.jobSecurityRisk = null;
        state.flags.jobSecurityRecovery = null;
      }
      if (item.payload?.kind === "education_window") {
        state.flags.educationWindowOpen = null;
        state.flags.educationWindowExpired = true;
        addMemory(state, "Eğitim kayıt penceresini kaçırdın.", "important");
      }
      if (item.payload?.kind === "midlife_family_obligation") {
        state.flags.midlifeFamilyObligationOpen = null;
        applyRelationshipDelta(state, "anne", { trust: -7, tension: 7 });
      }
      if (item.payload?.kind === "retirement_transition") {
        state.career.retirement.status = "working";
        state.career.retirement.deferredUntil = state.time.absoluteWeek + 48;
      }
      addMemory(state, "Bir yaşam fırsatının süresi doldu; karar vermek için geç kaldın.");
    }
  }
  // Sonuçlanmış gecikmeli dosyalar olay geçmişinin yerine geçmez. Yakın dönem
  // hata ayıklama bağlamını koru, onlarca yıllık yaşamda openCases'i büyütme.
  state.openCases = state.openCases.filter((item) =>
    item.type !== "depth2-followup" ||
    item.status !== "resolved" ||
    state.time.absoluteWeek - (item.dueWeek || item.createdWeek || 0) <= 24,
  );
}
