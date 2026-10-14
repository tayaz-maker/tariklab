/**
 * TAKVİM ekranının salt veri katmanı. Yalnız oyuncunun zaten bildiği,
 * kendi kararıyla oluşturdığı yükümlülükleri döner.
 *
 * "social-followup" case türü, mevcut motorun gecikmeli sosyal sonuç
 * mekanizmasıdır (bkz. social.js scheduleSocialFollowup) ve tanım gereği
 * oyuncuya önceden haber verilmemesi gereken bir sürprizi temsil eder.
 * Bu yüzden KNOWN_CASE_TYPES listesine hiçbir zaman eklenmez.
 */
export const KNOWN_CASE_TYPES = ["social-obligation", "friend-loan", "depth2-followup", "favor-obligation", "depth3-followup", "health-followup", "household-followup", "parenting-followup", "adult-child", "risk-dosya"];

/**
 * Oyuncudan gizlenmesi gereken case türleri. Görünürlüğün tek kaynağı burasıdır;
 * ayrı bir filtre yazmak yerine bu liste kullanılmalıdır.
 */
export const HIDDEN_CASE_TYPES = ["social-followup"];

export function isCaseVisible(item) {
  return item.status !== "resolved" && !HIDDEN_CASE_TYPES.includes(item.type) && (!["health-followup", "parenting-followup"].includes(item.type) || item.payload?.playerKnown === true);
}

export function getKnownOpenCases(state) {
  return state.openCases.filter(
    (item) => isCaseVisible(item) && KNOWN_CASE_TYPES.includes(item.type),
  );
}

/**
 * Oyuncunun görebileceği bütün açık meseleler: kendi kararıyla oluşan işler
 * (iş başlangıcı, söz, borç) evet; gecikmeli sürpriz sonuçlar hayır.
 */
export function getPlayerVisibleOpenCases(state) {
  return state.openCases.filter(
    (item) => isCaseVisible(item),
  );
}
