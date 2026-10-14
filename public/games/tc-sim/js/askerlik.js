// Askerlik penceresi, 18–25, bir kez. Ordu simülasyonu değil.
import { addCareerHistory, addMemory, addNpcMemory, adjustHealth, transact, updateRelationship } from "./state.js?v=10";
import { clearSemtLive } from "./quarters.js?v=10";
import { getJobById } from "./catalog.js?v=10";
import { normalizeWorkplace } from "./partner-workplace.js?v=10";

const SERVICE_WEEKS = 8;
const TECIL_COST = 800;
const TECIL_DELAY = 48;
const FINE = 1800;

const whole = (value) => Math.round(Number(value) || 0);

export function normalizeAskerlik(state) {
  if (!state.flags || typeof state.flags !== "object") state.flags = {};
  const src = state.flags.askerlik && typeof state.flags.askerlik === "object" ? state.flags.askerlik : {};
  const mode = ["serving", "done", "avoided", "aged-out"].includes(src.mode) ? src.mode : "";
  const banner = src.banner && typeof src.banner.text === "string"
    ? { text: src.banner.text.slice(0, 240), week: whole(src.banner.week) }
    : null;
  state.flags.askerlik = {
    mode,
    tecilUsed: src.tecilUsed === true,
    until: Number.isInteger(src.until) ? src.until : null,
    resumeWeek: Number.isInteger(src.resumeWeek) ? src.resumeWeek : null,
    returned: src.returned === true,
    troubleDue: Number.isInteger(src.troubleDue) ? src.troubleDue : null,
    troubleDone: src.troubleDone === true,
    previousJobId: typeof src.previousJobId === "string" ? src.previousJobId.slice(0, 32) : "",
    banner,
  };
  return state.flags.askerlik;
}

export function isServing(state) {
  const book = state?.flags?.askerlik;
  return book?.mode === "serving" && Number.isInteger(book.until) && (state.time?.absoluteWeek || 1) < book.until;
}

function remember(state, text) {
  const book = normalizeAskerlik(state);
  book.banner = { week: state.time.absoluteWeek, text };
  addMemory(state, text, "important");
  return text;
}

function legacyTrack(state) {
  return state.military?.applicable === true;
}

function windowOpen(state, { tecil = false } = {}) {
  if (state.lifetime?.death || legacyTrack(state) || isServing(state)) return false;
  const age = state.player?.age || 0;
  if (age < 18 || age > 25) return false;
  if ((state.time?.absoluteWeek || 1) < 8 || state.time?.weekOfMonth !== 1) return false;
  const book = normalizeAskerlik(state);
  if (book.mode === "done" || book.mode === "avoided" || book.mode === "aged-out" || book.mode === "serving") return false;
  if (book.tecilUsed && !(state.time.absoluteWeek >= book.resumeWeek)) return false;
  if (tecil && (book.tecilUsed || age > 24)) return false;
  return true;
}

function sitFamilyBed(state) {
  if (state.household?.homeId === "family") return "Ucuz yatak aile evinde kaldı.";
  if (state.household?.union?.cohabitingSince) return "Ortak ev duruyor. Aile yatağı ayrı duruyor.";
  clearSemtLive(state);
  if (state.household.location) state.household.location = null;
  state.household.homeId = "family";
  state.household.livingWithFamily = true;
  return "Ucuz yatak aile evine çekildi.";
}

function closeManagerFile(state) {
  const wp = normalizeWorkplace(state);
  wp.managerLog = [];
  const text = "Selma defteri kapattı. Bant durmadı.";
  wp.notes.push({ week: state.time.absoluteWeek, year: state.time.year, kind: "sessizlik", text });
  wp.notes = wp.notes.slice(-12);
  addMemory(state, text, "important");
  return text;
}

export function askerGitme(state) {
  if (!windowOpen(state)) return { ok: false, reason: "Askerlik penceresi kapalı." };
  const book = normalizeAskerlik(state);
  const bed = sitFamilyBed(state);
  const job = getJobById(state.career?.jobId);
  book.mode = "serving";
  book.until = state.time.absoluteWeek + SERVICE_WEEKS;
  book.previousJobId = job?.id || "";
  adjustHealth(state, { energy: -4, stress: 6 });
  const partnerId = state.social?.currentPartnerNpcId;
  if (partnerId) addNpcMemory(state, partnerId, "Gittin. Bu ayı ben tutuyorum.", "asker-gitme");
  addNpcMemory(state, "anne", "Ucuz yatak burada kaldı.", "asker-gitme");
  const text = partnerId
    ? `Gittin. Maaş yok. ${bed} Partner bunu yazdı.`
    : `Gittin. Maaş yok. ${bed}`;
  return { ok: true, message: remember(state, text) };
}

export function askerTecil(state) {
  if (!windowOpen(state, { tecil: true })) return { ok: false, reason: "Tecil bu pencereye sığmıyor." };
  const book = normalizeAskerlik(state);
  if (book.tecilUsed) return { ok: false, reason: "Tecil bir kez." };
  if ((state.player?.age || 0) > 24) return { ok: false, reason: "Bu yaşta tecil tutmaz." };
  if (state.finances.balance < TECIL_COST) return { ok: false, reason: `${TECIL_COST} TL yok.` };
  const before = state.finances.balance;
  transact(state, -TECIL_COST, "Tecil masrafı", "legal");
  book.tecilUsed = true;
  book.resumeWeek = state.time.absoluteWeek + TECIL_DELAY;
  const text = `Tecil. ${TECIL_COST} TL gitti. Bir kez. Pencere sonra yine açılır.`;
  if (!Number.isInteger(state.finances.balance) || state.finances.balance !== before - TECIL_COST)
    return { ok: false, reason: "Tecil tam TL yazılmadı." };
  return { ok: true, message: remember(state, text) };
}

function openAskerDosya(state, text) {
  const open = (state.openCases || []).filter((item) => item.type === "risk-dosya" && item.status === "pending");
  if (open.some((item) => item.payload?.kind === "askerlik") || open.length >= 3) return false;
  state.openCases.push({
    id: `risk-askerlik-${state.time.absoluteWeek}`,
    type: "risk-dosya",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + 8,
    status: "pending",
    payload: { kind: "askerlik", text, playerKnown: true },
  });
  return true;
}

export function askerKacirma(state) {
  if (!windowOpen(state)) return { ok: false, reason: "Askerlik penceresi kapalı." };
  const book = normalizeAskerlik(state);
  book.mode = "avoided";
  book.troubleDue = state.time.absoluteWeek + 16;
  updateRelationship(state, "anne", -8);
  addNpcMemory(state, "anne", "Yoklamadan kaçtın. Dosyada adın var.", "asker-kacirma");
  const partnerId = state.social?.currentPartnerNpcId;
  if (partnerId) addNpcMemory(state, partnerId, "Kaçtın. Bunu duymazdan gelemem.", "asker-kacirma");
  openAskerDosya(state, "Yoklama kaçtı. Bu dosya mahkemeye gidebilir.");
  adjustHealth(state, { stress: 6 });
  return { ok: true, message: remember(state, "Yoklamadan kaçtın. Dosya açıldı. Anne bunu duydu.") };
}

function finishService(state, book) {
  book.mode = "done";
  book.returned = true;
  book.until = null;
  const job = getJobById(state.career?.jobId);
  if (job) {
    book.previousJobId = job.id;
    addCareerHistory(state, {
      type: "interruption",
      jobId: job.id,
      label: `${job.title} beklemedi. Askerlik bitince bant kapandı.`,
    });
    state.career.jobId = null;
    state.career.weeksInRole = 0;
    state.career.pendingJob = null;
    state.flags.jobSecurityRisk = null;
    state.flags.jobSecurityRecovery = null;
  }
  closeManagerFile(state);
  addNpcMemory(state, "anne", "Döndün. Eski iş beklemedi.", "asker-donus");
  const partnerId = state.social?.currentPartnerNpcId;
  if (partnerId) addNpcMemory(state, partnerId, "Döndün. Aradaki haftalar duruyor.", "asker-donus");
  return remember(state, "Döndün. Eski bant beklemedi. Selma defteri kapattı. İş yeniden aranacak.");
}

function collectFine(state, book) {
  book.troubleDone = true;
  book.troubleDue = null;
  const before = state.finances.balance;
  transact(state, -FINE, "Yoklama cezası", "legal");
  if (!Number.isInteger(state.finances.balance) || state.finances.balance !== before - FINE)
    return remember(state, "Yoklama cezası tam yazılamadı.");
  return remember(state, `Yoklama cezası geldi. ${FINE} TL. Dosya duruyor.`);
}

export function processAskerlikWeek(state) {
  if (state.lifetime?.death) return "";
  const book = normalizeAskerlik(state);
  if (book.mode === "serving" && Number.isInteger(book.until) && state.time.absoluteWeek >= book.until)
    return finishService(state, book);
  if (book.mode === "avoided" && !book.troubleDone && Number.isInteger(book.troubleDue) && state.time.absoluteWeek >= book.troubleDue)
    return collectFine(state, book);
  if (isServing(state)) {
    const text = "Askerdesin. Bu hafta iş yok. Yalnız dinlenme var.";
    book.banner = { week: state.time.absoluteWeek, text };
    return text;
  }
  return "";
}

export const ASKER_DECISIONS = [
  {
    id: "asker-gitme",
    title: "Askere git",
    detail: "iş durur · ucuz yatak · dönüşte bant kapanır",
    contextual: (state) => windowOpen(state),
    apply: askerGitme,
  },
  {
    id: "asker-tecil",
    title: "Tecil et",
    detail: `${TECIL_COST} TL · bir kez · pencere geri gelir`,
    contextual: (state) => windowOpen(state, { tecil: true }),
    apply: askerTecil,
  },
  {
    id: "asker-kacirma",
    title: "Yoklamadan kaç",
    detail: "dosya · anne · sonra ceza",
    contextual: (state) => windowOpen(state),
    apply: askerKacirma,
  },
];
