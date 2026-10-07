import { addMemory, addNpcMemory, adjustHealth, getWeeklyActivityLimit, transact } from "./state.js?v=10";
import { applyRelationshipDelta, getPerson, getRelationship, markMeaningfulContact, isAdultRomanceParticipant } from "./social.js?v=10";
import { beginUnplannedPregnancy } from "./parenthood.js?v=10";

const CHOICES = Object.freeze(["talk", "condom", "without_condom"]);

export function intimacyAvailability(state, choiceId) {
  if (!CHOICES.includes(choiceId)) return { ok: false, reason: "Geçersiz seçim." };
  if (state.lifetime?.death || state.events.active) return { ok: false, reason: "Önce açık olayı bitir." };
  const partnerId = state.social.currentPartnerNpcId;
  const relationship = partnerId && getRelationship(state, partnerId);
  // The only romance-eligible authored character is Elif. Never infer adulthood
  // for arbitrary people imported by an old or modified save.
  if (!isAdultRomanceParticipant(state, partnerId) || partnerId !== "elif" || state.household.union?.separatedSince)
    return { ok: false, reason: "Bu seçenek yalnız yetişkin, karşılıklı rızaya dayalı ilişkide açılır." };
  if (relationship.romanceStatus !== "partner" || relationship.trust < 55 || relationship.tension > 40)
    return { ok: false, reason: "Önce güveni ve karşılıklı isteği konuşun." };
  if (state.weekly.used >= getWeeklyActivityLimit(state)) return { ok: false, reason: "Bu hafta zaman kalmadı." };
  if (state.weekly.selectedIds.some((id) => id.startsWith("intimacy:")))
    return { ok: false, reason: "Bu haftanın yakınlık kararı verildi." };
  if (choiceId === "condom" && state.finances.balance < 120) return { ok: false, reason: "Korunma gideri için bütçe yetersiz; konuşma seçeneği ücretsiz." };
  if (choiceId === "without_condom" && state.flags.intimacyFollowup) return { ok: false, reason: "Önce önceki yakınlığın takip görüşmesini tamamlayın." };
  return { ok: true };
}

export function chooseIntimacy(state, choiceId) {
  const available = intimacyAvailability(state, choiceId);
  if (!available.ok) return available;
  const partnerId = state.social.currentPartnerNpcId;
  const partner = getPerson(state, partnerId);
  state.weekly.used += 1;
  state.weekly.selectedIds.push(`intimacy:${choiceId}`);
  markMeaningfulContact(state, partnerId);
  if (choiceId === "talk") {
    applyRelationshipDelta(state, partnerId, { trust: 4, tension: -3 });
    addMemory(state, `${partner.name} ile sınırlarınızı ve korunma tercihlerinizi açıkça konuştunuz.`);
    return { ok: true, message: "Sınırlar ve korunma konuşuldu; yakınlık için baskı yok." };
  }
  const protectedSex = choiceId === "condom";
  if (protectedSex) transact(state, -120, "Kondom ve kişisel sağlık gideri", "health");
  applyRelationshipDelta(state, partnerId, { closeness: 5, trust: protectedSex ? 2 : 0 });
  adjustHealth(state, { energy: -2, stress: -2 });
  addNpcMemory(state, partnerId, protectedSex ? "Karşılıklı rızayla kondom kullanarak yakınlaştık." : "Korunmasız yakınlığın sonuçlarını konuşarak karar verdik.", "adult_intimacy");
  addMemory(state, protectedSex ? `${partner.name} ile karşılıklı rızayla kondomlu seks yaşadınız.` : `${partner.name} ile karşılıklı rızayla kondomsuz seks yaşadınız; gebelik olasılığı ve sağlık konusu açık kaldı.`);
  if (!protectedSex && !state.parenthood.pregnancy) {
    state.flags.intimacyFollowup = { partnerId, dueWeek: state.time.absoluteWeek + 4, originWeek: state.time.absoluteWeek };
  }
  return { ok: true, message: protectedSex ? "Kondomlu seks yaşandı. Oyun bunu sıfır tıbbi risk garantisi olarak sunmaz." : "Kondomsuz seks yaşandı. Dört hafta sonra sağlık ve gebelik olasılığı konuşulacak; sonuç oyun kurgusudur, tıbbi bilgi değildir." };
}

export function processIntimacyFollowup(state) {
  const followup = state.flags.intimacyFollowup;
  if (!followup || state.time.absoluteWeek < followup.dueWeek) return "";
  delete state.flags.intimacyFollowup;
  // Fictional, deterministic story branch; not a medical pregnancy probability.
  const storyBranch = (followup.originWeek * 17 + (state.meta?.rngState || 1) * 3) % 7 === 0;
  // This authored route only models a man player and Elif as a possible
  // biological-parent pair. Identity alone is not a clinical fertility model.
  if (storyBranch && state.player.gender === "man" && beginUnplannedPregnancy(state, followup.partnerId))
    return "Gebelik haberi geldi. Aile ve bütçe ekranlarında hazırlık kararları açıldı.";
  addMemory(state, "Beklenen gebelik sonucu bu kez olumsuz çıktı; korunma ve sağlık üzerine yeniden konuştunuz.");
  return "Gebelik sonucu bu kez olumsuz. Bu, sonraki korunmasız birliktelikler için garanti değildir.";
}
