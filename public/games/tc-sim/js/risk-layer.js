import {openCriminalHearing, isServingCriminalSentence, processCriminalSentenceWeek} from './criminal-justice.js?v=10';
// +18 risk katmanı. Yeni ekran yok: kısa karar, dosya, hafıza.
import { addMemory, addNpcMemory, adjustHealth, transact, updateRelationship } from "./state.js?v=10";
import { applyRelationshipDelta } from "./social.js?v=10";

const whole = (value) => Math.round(Number(value) || 0);

export function isDetained(state) {
  const until = state?.flags?.risk?.detainedUntil;
  return (Number.isInteger(until) && (state.time?.absoluteWeek || 1) < until) || isServingCriminalSentence(state);
}

export function normalizeRisk(state) {
  if (!state.flags || typeof state.flags !== "object") state.flags = {};
  const src = state.flags.risk && typeof state.flags.risk === "object" ? state.flags.risk : {};
  const banner = src.banner && typeof src.banner.text === "string"
    ? { text: src.banner.text.slice(0, 240), week: whole(src.banner.week) }
    : null;
  const log = [];
  for (const row of Array.isArray(src.log) ? src.log : []) {
    if (!row || typeof row.text !== "string") continue;
    log.push({ week: whole(row.week), kind: String(row.kind || "").slice(0, 24), text: row.text.slice(0, 220) });
  }
  const plan = src.disengagement;
  const now = state.time?.absoluteWeek || 1;
  const validPlan = plan && Number.isInteger(plan.startWeek) && plan.startWeek >= 1 &&
    Number.isInteger(plan.lastWeek) && plan.lastWeek >= plan.startWeek && plan.lastWeek <= now &&
    Number.isInteger(plan.cleanWeeks) && plan.cleanWeeks >= 0 && plan.cleanWeeks < 13 &&
    plan.cleanWeeks <= plan.lastWeek - plan.startWeek;
  state.flags.risk = {
    uses: Math.max(0, Math.min(12, whole(src.uses))),
    heat: Math.max(0, Math.min(6, whole(src.heat))),
    nightKey: typeof src.nightKey === "string" ? src.nightKey.slice(0, 16) : "",
    clinicDue: Number.isInteger(src.clinicDue) ? src.clinicDue : null,
    detainedUntil: Number.isInteger(src.detainedUntil) ? src.detainedUntil : null,
    banner,
    log: log.slice(-8),
    ...(validPlan ? { disengagement: { startWeek: plan.startWeek, lastWeek: plan.lastWeek, cleanWeeks: plan.cleanWeeks } } : {}),
  };
  return state.flags.risk;
}

function adult(state) {
  return !state.lifetime?.death && (state.player?.age || 0) >= 18 && !isDetained(state);
}

function remember(state, kind, text) {
  const book = normalizeRisk(state);
  if (["gece", "madde", "kavga", "kolay", "gozalti"].includes(kind)) delete book.disengagement;
  book.log.push({ week: state.time.absoluteWeek, kind, text });
  book.log = book.log.slice(-8);
  book.banner = { week: state.time.absoluteWeek, text };
  addMemory(state, text, "important");
  return text;
}

function openDosya(state, kind, text) {
  const open = (state.openCases || []).filter((item) => item.type === "risk-dosya" && item.status === "pending");
  if (open.some((item) => item.payload?.kind === kind) || open.length >= 3) return false;
  const source = {
    id: `risk-${kind}-${state.time.absoluteWeek}`,
    type: "risk-dosya",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + 6,
    status: "pending",
    payload: { kind, text, playerKnown: true },
  };
  state.openCases.push(source);
  if (kind === "kavga") openCriminalHearing(state, source);
  return true;
}

export function beginDetention(state, weeks, text) {
  const book = normalizeRisk(state);
  if (isDetained(state)) return book.banner?.text || text;
  transact(state, -1500, "Gözaltı masrafı", "legal");
  book.detainedUntil = state.time.absoluteWeek + Math.max(1, whole(weeks) || 2);
  book.heat = Math.min(6, book.heat + 1);
  openDosya(state, "gozalti", text);
  return remember(state, "gozalti", text);
}

// Authored game policy, not a legal expungement or sentencing rule.
export function startRiskDisengagement(state) {
  const book = normalizeRisk(state);
  if (!adult(state) || book.heat <= 0 || book.disengagement)
    return { ok: false, reason: "Uzaklaşma planı şu anda başlatılamaz." };
  book.disengagement = { startWeek: state.time.absoluteWeek, lastWeek: state.time.absoluteWeek, cleanWeeks: 0 };
  return { ok: true, message: remember(state, "uzaklasma", "Uzaklaşma planı başladı. 13 kesintisiz risksiz hafta baskıyı bir kademe azaltır; geçmiş dosyalar ve borçlar kalır.") };
}

function processDisengagement(state, book) {
  const plan = book.disengagement;
  if (!plan || state.time.absoluteWeek <= plan.lastWeek) return "";
  if (isDetained(state)) { delete book.disengagement; return ""; }
  plan.cleanWeeks = state.time.absoluteWeek === plan.lastWeek + 1 ? plan.cleanWeeks + 1 : 0;
  plan.lastWeek = state.time.absoluteWeek;
  if (plan.cleanWeeks < 13) return "";
  book.heat = Math.max(0, book.heat - 1);
  delete book.disengagement;
  const mother = state.people?.find(p => p.id === "anne" && !p.deceased);
  if (mother) {
    applyRelationshipDelta(state, "anne", { trust: 2 });
    addNpcMemory(state, "anne", "Riskli çevreden uzaklaşmak için verdiği sözü haftalarca sürdürdü.", "risk-recovery");
  }
  return remember(state, "toparlanma", "13 risksiz hafta tamamlandı. Baskı bir kademe azaldı. Geçmiş dosyalar ve borçlar duruyor.");
}

export function processRiskWeek(state) {
  if (state.lifetime?.death) return "";
  const book = normalizeRisk(state);
  const sentenceNote = processCriminalSentenceWeek(state);
  const recoveryNote = processDisengagement(state, book);
  if (Number.isInteger(book.clinicDue) && state.time.absoluteWeek >= book.clinicDue) {
    book.clinicDue = null;
    adjustHealth(state, { health: -6, stress: 4 });
    return remember(state, "klinik", "Klinik sonucu dosyaya işlendi. Beden yoruldu. Bu tıbbi tavsiye değil.");
  }
  if (Number.isInteger(book.detainedUntil) && state.time.absoluteWeek >= book.detainedUntil) {
    book.detainedUntil = null;
    return remember(state, "cikis", "Çıktın. Kısa tutuklama işi ve haftayı yedi. Dosya duruyor.");
  }
  if (isDetained(state)) {
    const text = "İçeridesin. Bu hafta iş durdu. Yalnız dinlenme var.";
    book.banner = { week: state.time.absoluteWeek, text };
    return text;
  }
  return [sentenceNote, recoveryNote].filter(Boolean).join(" ");
}

export function riskNight(state) {
  if (!adult(state)) return { ok: false, reason: "Bu kapı şu anda kapalı." };
  const book = normalizeRisk(state);
  const key = `${state.time.year}-${state.time.month}`;
  if (book.nightKey === key) return { ok: false, reason: "Bu ayın riskli gecesi zaten yazıldı." };
  if (state.finances.balance < 450) return { ok: false, reason: "450 TL yok. Bu gece nakit ister." };
  const before = state.finances.balance;
  transact(state, -450, "Riskli gece", "health");
  adjustHealth(state, { energy: -6, stress: 8, health: -2 });
  book.nightKey = key;
  book.clinicDue = state.time.absoluteWeek + 4;
  const partnerId = state.social?.currentPartnerNpcId;
  if (partnerId) {
    applyRelationshipDelta(state, partnerId, { trust: -4, tension: 8 });
    addNpcMemory(state, partnerId, "Riskli geceyi duydum. Güven ayrı, dosya ayrı.", "risk-night");
  }
  openDosya(state, "saglik", "Riskli temas sağlık dosyasına geçti. Polis henüz yok.");
  if (book.heat >= 1) openDosya(state, "polis", "Gece bir ihbarla birleşti. Bu iş mahkemeye gidebilir.");
  const text = partnerId
    ? "Riskli bir gece. 450 TL gitti. Sağlık dosyası açıldı. Partner gerildi."
    : "Riskli bir gece. 450 TL gitti. Sağlık dosyası açıldı.";
  if (!Number.isInteger(state.finances.balance) || state.finances.balance !== before - 450)
    return { ok: false, reason: "Para tam TL yazılmadı." };
  return { ok: true, message: remember(state, "gece", text) };
}

export function riskDose(state) {
  if (!adult(state)) return { ok: false, reason: "Bu kapı şu anda kapalı." };
  const book = normalizeRisk(state);
  const cost = Math.min(2000, 500 + book.uses * 250);
  if (state.finances.balance < cost) return { ok: false, reason: `${cost} TL yok.` };
  const before = state.finances.balance;
  transact(state, -cost, "Madde", "health");
  book.uses += 1;
  adjustHealth(state, { health: -Math.min(16, 3 + book.uses * 2), energy: -8, stress: 10 });
  let text = `Bir doz. ${cost} TL ve beden gitti. Henüz dosya yok.`;
  if (book.uses >= 2) {
    book.heat = Math.min(6, book.heat + 1);
    openDosya(state, "madde", "Madde ikinci kez yazıldı. Bu dosya mahkemeye gidebilir.");
    text = `İkinci doz. ${cost} TL. Madde dosyası açıldı.`;
  }
  if (book.uses >= 3) {
    text = beginDetention(state, 2, "Üçüncü doz polise gitti. Kısa tutuklama. İş durdu.");
  } else {
    remember(state, "madde", text);
  }
  if (!Number.isInteger(state.finances.balance) || state.finances.balance > before)
    return { ok: false, reason: "Madde para kazandırmaz." };
  return { ok: true, message: text };
}

export function riskFight(state) {
  if (!adult(state)) return { ok: false, reason: "Bu kapı şu anda kapalı." };
  if ((state.health?.stress || 0) < 40) return { ok: false, reason: "Stres 40 değil. Kavga kendiliğinden açılmaz." };
  const book = normalizeRisk(state);
  const before = state.finances.balance;
  transact(state, -900, "Kavga cezası", "legal");
  updateRelationship(state, "anne", -8);
  addNpcMemory(state, "anne", "Kavgayı duydum. Dosyada adın var.", "risk-fight");
  book.heat = Math.min(6, book.heat + 1);
  openDosya(state, "kavga", "Kavga polis dosyasına geçti. Bu iş mahkemeye gidebilir.");
  adjustHealth(state, { health: -4, energy: -10, stress: 6 });
  let text = "Kavga dosyaya geçti. 900 TL ceza. Anne bunu duydu.";
  if (book.heat >= 2) text = beginDetention(state, 2, "Kavga büyüdü. Kısa tutuklama. İş iki hafta durdu.");
  else remember(state, "kavga", text);
  if (!Number.isInteger(before - state.finances.balance)) return { ok: false, reason: "Ceza tam TL değil." };
  return { ok: true, message: text };
}

export function riskShortcut(state) {
  if (!adult(state)) return { ok: false, reason: "Bu kapı şu anda kapalı." };
  const book = normalizeRisk(state);
  if (book.heat >= 2) {
    const text = beginDetention(state, 2, "Kolay para tutmadı. Polis dosyası büyüdü. Kısa tutuklama.");
    return { ok: true, message: text };
  }
  transact(state, 1800, "Kolay para", "legal");
  book.heat += 1;
  const text = book.heat >= 2
    ? "Kolay para geldi. Isı tepeye çıktı. Bir sonraki sefer geri teper."
    : "Kolay para geldi. 1800 TL. Isı arttı. Bu geri tepebilir.";
  return { ok: true, message: remember(state, "kolay", text) };
}

function slot(state, weekOfMonth, extra = true) {
  return adult(state) && state.time?.weekOfMonth === weekOfMonth && extra;
}

export const RISK_DECISIONS = [
  {
    id: "risk-disengage", title: "Riskli çevreden uzaklaş",
    detail: "1 haftalık karar · 13 kesintisiz risksiz hafta · baskı bir kademe azalır; dosya ve borç silinmez.",
    contextual: state => adult(state) && (state.flags?.risk?.heat || 0) > 0 && !state.flags?.risk?.disengagement,
    apply: startRiskDisengagement,
  },
  {
    id: "risk-night",
    title: "Riskli gece",
    detail: "450 TL. Sağlık dosyası açılır. Varsa partner gerilir.",
    contextual: (state) => slot(state, 3),
    apply: riskNight,
  },
  {
    id: "risk-dose",
    title: "Bir doz",
    detail: "Para ve beden gider. İkincide dosya açılır.",
    contextual: (state) => slot(state, 4),
    apply: riskDose,
  },
  {
    id: "risk-fight",
    title: "Kavgaya gir",
    detail: "900 TL ceza. Anne duyar. Tekrarı tutuklama.",
    contextual: (state) => slot(state, 2, (state.health?.stress || 0) >= 40),
    apply: riskFight,
  },
  {
    id: "risk-shortcut",
    title: "Kolay para",
    detail: "Şimdi nakit gelir. Isı artar. Geri tepebilir.",
    contextual: (state) => slot(state, 1, (state.time?.absoluteWeek || 1) >= 8),
    apply: riskShortcut,
  },
];
