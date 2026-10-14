// Partnerin görünmeyen ayı ve işyerindeki iki kişi. Yeni ekran yok.
import { getJobById } from "./catalog.js?v=10";
import { addMemory, addNpcMemory, adjustHealth } from "./state.js?v=10";

export const WORKPLACE = Object.freeze({ manager: "Selma", peer: "Kerem" });

const TOPICS = Object.freeze({
  shift: {
    notice: "Partnerinin vardiyası değişti. Kısa dosya açıldı. Bir karar hakkı yer. Parayla kapanmaz.",
    npc: "Vardiyam değişti. Haberi senden duymak istedim. Para bunu kapatmaz.",
    read: "Partnerinin vardiya değişimini okudun. Dosya kapandı. Para gitmedi.",
  },
  parent: {
    notice: "Partnerinin ailesinde bir mesele var. Dosya açıldı. Parayla silinmez.",
    npc: "Evde bir mesele var. Bunu dosyaya yazdım. Parayla silinmez.",
    read: "Aile meselesini duydun. Dosya kapandı. Cüzdan durdu.",
  },
  move: {
    notice: "Partnerin taşınmak istiyor. Bu laf dosyada durur. Para onu kapatmaz.",
    npc: "Taşınmak istiyorum. Bu laf duracak. Para yetmez.",
    read: "Taşınma lafını konuştun. Dosya kapandı. Para dokunmadı.",
  },
});

const whole = (value) => Math.round(Number(value) || 0);

function topicForMonth(month) {
  if (month % 3 === 1) return "shift";
  if (month % 3 === 2) return "parent";
  return "move";
}

export function normalizePartnerMonth(state) {
  if (!state.flags || typeof state.flags !== "object") state.flags = {};
  const src = state.flags.partnerMonth && typeof state.flags.partnerMonth === "object" ? state.flags.partnerMonth : {};
  const banner = src.banner && typeof src.banner.text === "string"
    ? { text: src.banner.text.slice(0, 240), week: whole(src.banner.week) }
    : null;
  state.flags.partnerMonth = {
    monthKey: typeof src.monthKey === "string" ? src.monthKey.slice(0, 16) : "",
    banner,
  };
  return state.flags.partnerMonth;
}

function cleanRows(rows, limit) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row.text !== "string") continue;
    out.push({
      week: whole(row.week),
      year: whole(row.year),
      kind: ["referans", "vardiya", "sessizlik"].includes(row.kind) ? row.kind : null,
      text: row.text.slice(0, 220),
    });
  }
  return out.slice(-limit);
}

export function normalizeWorkplace(state) {
  if (!state.flags || typeof state.flags !== "object") state.flags = {};
  const src = state.flags.workplace && typeof state.flags.workplace === "object" ? state.flags.workplace : {};
  state.flags.workplace = {
    manager: WORKPLACE.manager,
    peer: WORKPLACE.peer,
    notes: cleanRows(src.notes, 12),
    peerShifts: cleanRows(src.peerShifts, 8),
    managerLog: cleanRows(src.managerLog, 8),
  };
  return state.flags.workplace;
}

export function processPartnerMonth(state) {
  if (state.lifetime?.death) return "";
  const partnerId = state.social?.currentPartnerNpcId;
  if (!partnerId || state.time?.weekOfMonth !== 1) return "";
  const key = `${state.time.year}-${state.time.month}`;
  const book = normalizePartnerMonth(state);
  if (book.monthKey === key) return "";
  if ((state.openCases || []).some((item) => item.type === "partner-month" && item.status === "pending")) return "";
  const topic = topicForMonth(state.time.month);
  const spec = TOPICS[topic];
  book.monthKey = key;
  state.openCases.push({
    id: `partner-month-${key}`,
    type: "partner-month",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + 4,
    status: "pending",
    payload: { topic, personId: partnerId },
  });
  addMemory(state, spec.notice);
  addNpcMemory(state, partnerId, spec.npc, `partner-month-${topic}`);
  book.banner = { week: state.time.absoluteWeek, text: spec.notice };
  return spec.notice;
}

export function readPartnerFile(state) {
  const item = (state.openCases || []).find((row) => row.type === "partner-month" && row.status === "pending");
  if (!item) return { ok: false, reason: "Açık partner dosyası yok." };
  const before = state.finances.balance;
  const spec = TOPICS[item.payload?.topic] || TOPICS.shift;
  item.status = "resolved";
  item.resolutionApplied = true;
  addMemory(state, spec.read, "important");
  addNpcMemory(state, item.payload?.personId, spec.read, "partner-month-read");
  if (state.finances.balance !== before) {
    item.status = "pending";
    item.resolutionApplied = false;
    return { ok: false, reason: "Bu dosya parayla kapanmaz." };
  }
  return { ok: true, message: spec.read };
}

export function payToErasePartnerFile(state) {
  const item = (state.openCases || []).find((row) => row.type === "partner-month" && row.status === "pending");
  if (!item) return { ok: false, reason: "Açık partner dosyası yok." };
  return { ok: false, reason: "Bu dosya parayla kapanmaz." };
}

export function notePromotion(state) {
  if (!getJobById(state.career?.jobId)) return "";
  const wp = normalizeWorkplace(state);
  const week = state.time.absoluteWeek;
  const recentShift = wp.peerShifts.some((row) => week - row.week <= 8 && week - row.week >= 0);
  const recentOvertime = Number.isInteger(state.flags.overtimeLastWeek) && week - state.flags.overtimeLastWeek <= 4 && week - state.flags.overtimeLastWeek >= 0;
  const kind = recentShift ? "referans" : recentOvertime ? "vardiya" : "sessizlik";
  const text = kind === "referans"
    ? `H${week}. Selma dosyaya referans yazdı. Kerem tuttuğun vardiyayı hatırlıyor.`
    : kind === "vardiya"
      ? `H${week}. Terfi dosyada vardiya notu. Sessiz alkış yok.`
      : `H${week}. Terfi oldu. Dosyada sessizlik var.`;
  wp.notes.push({ week, year: state.time.year, kind, text });
  addMemory(state, text, "important");
  return text;
}

export function takePeerShift(state) {
  if (!getJobById(state.career?.jobId)) return { ok: false, reason: "Vardiya için aktif bir iş gerekir." };
  const before = state.finances.balance;
  const wp = normalizeWorkplace(state);
  const text = "Kerem, tuttuğun vardiyayı hatırlıyor.";
  wp.peerShifts.push({ week: state.time.absoluteWeek, year: state.time.year, kind: null, text });
  adjustHealth(state, { energy: -6, stress: 2 });
  addMemory(state, "Kerem'in vardiyasını tuttun. Bunu hatırlıyor.", "important");
  if (state.finances.balance !== before) return { ok: false, reason: "Bu vardiya para değiştirmez." };
  return { ok: true, message: `${text} Para değişmedi.` };
}

export function logManagerOvertime(state) {
  if (!state.body?.warningAvailable) return "";
  if (state.flags?.overtimeLastWeek !== state.time?.absoluteWeek) return "";
  const wp = normalizeWorkplace(state);
  if (wp.managerLog.some((row) => row.week === state.time.absoluteWeek)) return "";
  const text = `H${state.time.absoluteWeek}. Selma, sağlık uyarısından sonraki mesaiyi deftere geçirdi.`;
  wp.managerLog.push({ week: state.time.absoluteWeek, year: state.time.year, kind: null, text });
  addMemory(state, text);
  return text;
}

export const PARTNER_WORK_DECISIONS = [
  {
    id: "partner-file",
    title: "Partner dosyasını oku",
    detail: "1 karar · para yemez · dosya kapanır",
    contextual: (state) => (state.openCases || []).some((item) => item.type === "partner-month" && item.status === "pending"),
    apply: readPartnerFile,
  },
  {
    id: "peer-shift",
    title: "Kerem'in vardiyasını tut",
    detail: "1 karar · para yok · Kerem hatırlar",
    contextual: (state) => {
      if (!state.career?.jobId || state.time?.weekOfMonth !== 2) return false;
      const shifts = state.flags?.workplace?.peerShifts;
      const last = Array.isArray(shifts) && shifts.length ? shifts.at(-1).week : null;
      if (!Number.isInteger(last)) return true;
      return state.time.absoluteWeek - last >= 4;
    },
    apply: takePeerShift,
  },
];
