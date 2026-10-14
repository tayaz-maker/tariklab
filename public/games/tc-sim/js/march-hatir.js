// Mart kira adımı ve üç hatır haftası. Yeni ekran yok; kasa, karar hakkı ve kişi hafızası kullanılır.
import { getHomeById, getJobById } from "./catalog.js?v=10";
import { ensureLifeEchoState } from "./life-echo-events.js?v=10";
import {
  MARCH_STEP,
  QUARTERS,
  rentToLive,
  steppedRent,
} from "./quarters.js?v=10";
import {
  addMemory,
  addNpcMemory,
  adjustHealth,
  transact,
} from "./state.js?v=10";

export const HATIR_SLOT = Object.freeze({ dugun: 14, bayram: 22, cenaze: 36 });
const TWO_YEARS = 96;
const LADDER = ["sirt", "kiyi", "ceper"];
const SMALLER = ["3+1", "2+1", "1+1"];

const HATIR = Object.freeze({
  dugun: {
    label: "Düğün",
    full: 1500,
    small: 500,
    fullLine: (amount) => `Düğün zarfı ${amount} TL. Ölçüsü hatırda kaldı.`,
    smallLine: (amount) => `Düğün zarfını küçük bıraktın. ${amount} TL. Gelmemek başka bir kayıt.`,
    skipLine: "Düğüne gelmedin. Zarf yok.",
    fullNpc: "Düğün zarfının ölçüsünü tuttu.",
    smallNpc: "Zarfı küçük bıraktı. Gelmemekle bir değil.",
    skipNpc: "Düğüne gelmedi. İki yıl bu cümle durur.",
    fullNote: "Düğün zarfının ölçüsü hatırda.",
    smallNote: "Zarfı küçük bıraktığın ayrı duruyor.",
    skipNote: "Düğüne gelmediğin hâlâ duruyor.",
  },
  bayram: {
    label: "Bayram evi",
    full: 800,
    small: 300,
    fullLine: (amount) => `Bayram evine gittin. Zarf ${amount} TL.`,
    smallLine: (amount) => `Bayram zarfını küçük bıraktın. ${amount} TL.`,
    skipLine: "Bayram evine gelmedin.",
    fullNpc: "Bayramda evi doldurdu. Zarfın ölçüsü duruyor.",
    smallNpc: "Bayram zarfı küçük kaldı. Gelmemekle bir değil.",
    skipNpc: "Bayram evine gelmedi.",
    fullNote: "Bayram zarfının ölçüsü hatırda.",
    smallNote: "Bayram zarfını küçük bıraktığın ayrı duruyor.",
    skipNote: "Bayram evine gelmediğin duruyor.",
  },
  cenaze: {
    label: "Cenaze",
    full: 1000,
    small: 400,
    fullLine: (amount) => `Cenazeye gittin. Zarf ${amount} TL.`,
    smallLine: (amount) => `Cenaze zarfını küçük bıraktın. ${amount} TL.`,
    skipLine: "Cenazeye gelmedin.",
    fullNpc: "Cenaze zarfının ölçüsünü tuttu.",
    smallNpc: "Cenaze zarfı küçük kaldı. Gelmemekle bir değil.",
    skipNpc: "Cenazeye gelmedi.",
    fullNote: "Cenaze zarfının ölçüsü hatırda.",
    smallNote: "Cenaze zarfını küçük bıraktığın ayrı duruyor.",
    skipNote: "Cenazeye gelmediğin duruyor.",
  },
});

const whole = (value) => Math.round(Number(value) || 0);

function weekOfYear(state) {
  const week = state.time?.absoluteWeek || 1;
  return ((week - 1) % 48) + 1;
}

function kindForSlot(slot) {
  if (slot === HATIR_SLOT.dugun) return "dugun";
  if (slot === HATIR_SLOT.bayram) return "bayram";
  if (slot === HATIR_SLOT.cenaze) return "cenaze";
  return null;
}

export function normalizeCalendar(state) {
  if (!state.flags || typeof state.flags !== "object") state.flags = {};
  const src = state.flags.calendar && typeof state.flags.calendar === "object" ? state.flags.calendar : {};
  const hatir = [];
  for (const row of Array.isArray(src.hatir) ? src.hatir : []) {
    const spec = HATIR[row?.kind];
    if (!spec) continue;
    if (!["gelmedi", "kucuk", "tuttu"].includes(row.outcome)) continue;
    const envelope = whole(row.envelope);
    hatir.push({
      kind: row.kind,
      year: whole(row.year),
      week: whole(row.week),
      outcome: row.outcome,
      envelope,
      untilWeek: whole(row.untilWeek),
    });
  }
  const openMarch = src.openMarch && typeof src.openMarch === "object"
    ? {
        year: whole(src.openMarch.year),
        week: whole(src.openMarch.week),
        quarterId: QUARTERS[src.openMarch.quarterId] ? src.openMarch.quarterId : null,
        step: whole(src.openMarch.step),
        before: whole(src.openMarch.before),
        after: whole(src.openMarch.after),
        done: src.openMarch.done === true,
        choice: src.openMarch.choice === "overtime" || src.openMarch.choice === "move" ? src.openMarch.choice : null,
      }
    : null;
  const openHatir = src.openHatir && HATIR[src.openHatir.kind]
    ? {
        kind: src.openHatir.kind,
        year: whole(src.openHatir.year),
        week: whole(src.openHatir.week),
        done: src.openHatir.done === true,
      }
    : null;
  const banner = src.banner && typeof src.banner.text === "string"
    ? { text: src.banner.text.slice(0, 280), week: whole(src.banner.week) }
    : null;
  state.flags.calendar = {
    marchYear: whole(src.marchYear),
    anneGapWeeks: src.anneGapWeeks === 2 || src.anneGapWeeks === 3 ? src.anneGapWeeks : 0,
    anneSeenWeek: whole(src.anneSeenWeek),
    openMarch,
    openHatir,
    hatir: hatir.slice(-18),
    banner,
  };
  return state.flags.calendar;
}

function rentedLive(state) {
  const semt = state.household?.semt;
  const holding = semt?.holdings?.find((item) => item.occupancy === "live" && item.id === semt.live?.holdingId);
  if (!holding || holding.mode !== "rented") return null;
  return holding;
}

function marchOpen(state) {
  const open = state.flags?.calendar?.openMarch;
  if (!open || open.done || open.week !== state.time?.absoluteWeek) return null;
  return open;
}

function hatirOpen(state) {
  const open = state.flags?.calendar?.openHatir;
  if (!open || open.done || open.week !== state.time?.absoluteWeek) return null;
  return open;
}

export function cheaperQuarterOption(state) {
  const holding = rentedLive(state);
  if (holding) {
    const index = LADDER.indexOf(holding.quarterId);
    if (index >= 0 && index < LADDER.length - 1) {
      const quarterId = LADDER[index + 1];
      const monthly = steppedRent(state, quarterId, holding.unitId);
      if (monthly < holding.monthly) return { quarterId, unitId: holding.unitId, monthly };
    }
    const unitIndex = SMALLER.indexOf(holding.unitId);
    if (unitIndex >= 0 && unitIndex < SMALLER.length - 1) {
      const unitId = SMALLER[unitIndex + 1];
      const monthly = steppedRent(state, holding.quarterId, unitId);
      if (monthly < holding.monthly) return { quarterId: holding.quarterId, unitId, monthly };
    }
    return null;
  }
  const home = getHomeById(state.household?.homeId);
  const current = home?.monthlyCost || 0;
  let best = null;
  for (const quarterId of LADDER) {
    for (const unitId of ["1+1", "2+1", "3+1"]) {
      const monthly = steppedRent(state, quarterId, unitId);
      if (monthly >= current) continue;
      if (!best || monthly < best.monthly) best = { quarterId, unitId, monthly };
    }
  }
  return best;
}

function remember(state, text, importance = "normal") {
  addMemory(state, text, importance);
}

function pushRecord(state, row) {
  const cal = normalizeCalendar(state);
  cal.hatir.push(row);
  if (cal.hatir.length > 18) cal.hatir.splice(0, cal.hatir.length - 18);
}

function writeHatirMemory(state, kind, outcome, envelope) {
  const spec = HATIR[kind];
  const week = state.time.absoluteWeek;
  const line = outcome === "tuttu" ? spec.fullLine(envelope) : outcome === "kucuk" ? spec.smallLine(envelope) : spec.skipLine;
  const npc = outcome === "tuttu" ? spec.fullNpc : outcome === "kucuk" ? spec.smallNpc : spec.skipNpc;
  remember(state, line, outcome === "gelmedi" ? "normal" : "important");
  addNpcMemory(state, "anne", npc, `hatir-${kind}-${outcome}`);
  if (kind === "dugun") {
    ensureLifeEchoState(state);
    addNpcMemory(state, "kardes", npc, `hatir-${kind}-${outcome}`);
  }
  pushRecord(state, {
    kind,
    year: state.time.year,
    week,
    outcome,
    envelope,
    untilWeek: week + TWO_YEARS,
  });
  return line;
}

export function processMarchRent(state) {
  if (state.lifetime?.death) return "";
  if (state.time?.month !== 3 || state.time?.weekOfMonth !== 1) return "";
  const cal = normalizeCalendar(state);
  if (cal.marchYear === state.time.year) return "";
  cal.marchYear = state.time.year;
  const semt = state.household?.semt;
  if (semt) semt.rentYears = Math.max(0, whole(semt.rentYears)) + 1;
  const holding = rentedLive(state);
  let step = 0;
  let before = 0;
  let after = 0;
  let text = `Mart. Mahalle kiraları adım attı: Sırt +${MARCH_STEP.sirt}, Kıyı +${MARCH_STEP.kiyi}, Çeper +${MARCH_STEP.ceper} TL. Maaş durdu.`;
  if (holding) {
    step = MARCH_STEP[holding.quarterId];
    before = holding.monthly;
    holding.monthly = before + step;
    after = holding.monthly;
    const name = QUARTERS[holding.quarterId].name;
    text = `Mart. ${name} kirası ${step} TL arttı. Aylık ${after} TL. Maaş durdu.`;
    remember(state, `${name} kirası Mart'ta ${step} TL arttı. Aylık kira ${after} TL. Maaş durdu.`, "important");
  }
  cal.openMarch = {
    year: state.time.year,
    week: state.time.absoluteWeek,
    quarterId: holding?.quarterId || null,
    step,
    before,
    after,
    done: false,
    choice: null,
  };
  cal.banner = { week: state.time.absoluteWeek, text };
  return text;
}

export function openHatirWeek(state) {
  if (state.lifetime?.death) return "";
  const kind = kindForSlot(weekOfYear(state));
  if (!kind) return "";
  const cal = normalizeCalendar(state);
  if (cal.openHatir?.week === state.time.absoluteWeek) return "";
  if (cal.hatir.some((row) => row.kind === kind && row.year === state.time.year)) return "";
  cal.openHatir = { kind, year: state.time.year, week: state.time.absoluteWeek, done: false };
  const spec = HATIR[kind];
  const text = `${spec.label} haftası. Zarf ${spec.full} TL, küçük zarf ${spec.small} TL. Karar hakkı sıkışır; gelmemek ayrı kayıttır.`;
  remember(state, text);
  cal.banner = { week: state.time.absoluteWeek, text };
  return text;
}

export function closeHatirWeek(state) {
  if (state.lifetime?.death) return "";
  const cal = state.flags?.calendar;
  const open = cal?.openHatir;
  if (!open || open.done || open.week !== state.time?.absoluteWeek) return "";
  if (state.weekly?.selectedIds?.some((id) => id === "hatir-full" || id === "hatir-small")) {
    open.done = true;
    return "";
  }
  const line = writeHatirMemory(state, open.kind, "gelmedi", 0);
  normalizeCalendar(state).openHatir.done = true;
  return `${line} Bu haftanın karar hakkı sıkıştı.`;
}

function absorbMarch(state) {
  const open = marchOpen(state);
  if (!open || open.step <= 0) return { ok: false, reason: "Bu hafta karşılanacak bir kira adımı yok." };
  if (!getJobById(state.career?.jobId)) return { ok: false, reason: "Mesai için aktif bir iş gerekiyor." };
  const salary = getJobById(state.career.jobId).salary;
  transact(state, open.step, "Mart zammı mesaisi", "income");
  adjustHealth(state, { energy: -6, stress: 4 });
  open.done = true;
  open.choice = "overtime";
  const same = getJobById(state.career.jobId).salary === salary;
  const text = `Kira adımını mesaiyle karşıladın. ${open.step} TL. Bir karar hakkı gitti.${same ? " Maaş durdu." : ""}`;
  remember(state, text, "important");
  return { ok: true, message: text };
}

function moveCheaper(state) {
  const open = marchOpen(state);
  if (!open) return { ok: false, reason: "Ucuz mahalle seçeneği bu haftaya ait." };
  const target = cheaperQuarterOption(state);
  if (!target) return { ok: false, reason: "Daha ucuz bir mahalle seçeneği yok." };
  const quarter = QUARTERS[target.quarterId];
  const result = rentToLive(state, target.quarterId, target.unitId, { freeWeek: true });
  if (!result.ok) return result;
  const cal = normalizeCalendar(state);
  cal.openMarch.done = true;
  cal.openMarch.choice = "move";
  cal.anneGapWeeks = quarter.anneSlots ? 3 : 2;
  cal.anneSeenWeek = state.time.absoluteWeek;
  const text = `${quarter.name} ${target.unitId} daha ucuz. Taşıma ${quarter.moveCost} TL. Annenin ziyareti seyrekleşir.`;
  remember(state, text, "important");
  addNpcMemory(state, "anne", "Yol uzadı. Ziyaret seyrekleşir.", "hatir-visit");
  return { ok: true, message: text };
}

function payHatir(state, outcome) {
  const open = hatirOpen(state);
  if (!open) return { ok: false, reason: "Bu hafta hatır zarfı yok." };
  const spec = HATIR[open.kind];
  const amount = outcome === "tuttu" ? spec.full : spec.small;
  if (state.finances.balance < amount) return { ok: false, reason: "Zarf için nakit yetmiyor." };
  transact(state, -amount, `${spec.label} zarfı`, "social");
  writeHatirMemory(state, open.kind, outcome, amount);
  const cal = normalizeCalendar(state);
  cal.openHatir.done = true;
  return { ok: true, message: outcome === "tuttu" ? spec.fullLine(amount) : spec.smallLine(amount) };
}

export function hatirSentences(state, personId) {
  if (personId !== "anne" && personId !== "kardes") return [];
  const now = state.time?.absoluteWeek || 0;
  const rows = state.flags?.calendar?.hatir || [];
  const notes = [];
  for (const row of rows) {
    if (row.untilWeek < now) continue;
    if (personId === "kardes" && row.kind !== "dugun") continue;
    const spec = HATIR[row.kind];
    if (!spec) continue;
    const note = row.outcome === "gelmedi" ? spec.skipNote : row.outcome === "kucuk" ? spec.smallNote : spec.fullNote;
    if (!notes.includes(note)) notes.push(note);
  }
  return notes;
}

export const MARCH_HATIR_DECISIONS = [
  {
    id: "march-overtime",
    title: "Kira zammını mesaiyle karşıla",
    detail: "1 karar · zammın kendisi kadar tam lira · maaş durur",
    contextual: (state) => {
      const open = marchOpen(state);
      return Boolean(open && open.step > 0 && getJobById(state.career?.jobId));
    },
    apply: absorbMarch,
  },
  {
    id: "march-move",
    title: "Daha ucuz mahalleye geç",
    detail: "1 karar · taşıma · annenin ziyareti seyrekleşir",
    contextual: (state) => {
      const open = marchOpen(state);
      const target = open ? cheaperQuarterOption(state) : null;
      return Boolean(target && state.finances.balance >= QUARTERS[target.quarterId].moveCost);
    },
    apply: moveCheaper,
  },
  {
    id: "hatir-full",
    title: "Zarfı ölçüsünde bırak",
    detail: "düğün 1.500 · bayram 800 · cenaze 1.000 · 1 karar",
    contextual: (state) => {
      const open = hatirOpen(state);
      return Boolean(open && state.finances.balance >= HATIR[open.kind].full);
    },
    apply: (state) => payHatir(state, "tuttu"),
  },
  {
    id: "hatir-small",
    title: "Zarfı küçük bırak",
    detail: "düğün 500 · bayram 300 · cenaze 400 · gelmemekten ayrı kayıt",
    contextual: (state) => {
      const open = hatirOpen(state);
      return Boolean(open && state.finances.balance >= HATIR[open.kind].small);
    },
    apply: (state) => payHatir(state, "kucuk"),
  },
];
