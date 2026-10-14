// İcra / haciz. Mahkeme simülasyonu değil: yazı, süre, sonra mal.
import { addMemory, addNpcMemory, adjustHealth, transact, updateRelationship } from "./state.js?v=10";
import { DURABLES } from "./wealth.js?v=10";

const GRACE = 4;
const ARREARS_FLOOR = 2500;
const FINE = 1500;
const FEE_RATE = 0.1;

const whole = (value) => Math.round(Number(value) || 0);

export function normalizeIcra(state) {
  if (!state.flags || typeof state.flags !== "object") state.flags = {};
  const src = state.flags.icra && typeof state.flags.icra === "object" ? state.flags.icra : {};
  const banner = src.banner && typeof src.banner.text === "string"
    ? { text: src.banner.text.slice(0, 240), week: whole(src.banner.week) }
    : null;
  state.flags.icra = {
    watchWeek: Number.isInteger(src.watchWeek) ? src.watchWeek : null,
    frozenWeek: Number.isInteger(src.frozenWeek) ? src.frozenWeek : null,
    seized: ["cash", "vehicle", "goods"].includes(src.seized) ? src.seized : "",
    banner,
  };
  return state.flags.icra;
}

function remember(state, text) {
  const book = normalizeIcra(state);
  book.banner = { week: state.time.absoluteWeek, text };
  addMemory(state, text, "important");
  return text;
}

export function icraCase(state) {
  return (state.openCases || []).find((item) => item.type === "icra" && item.status === "pending") || null;
}

export function claimOf(state) {
  const arrears = whole(state.finances?.arrears);
  if (arrears >= ARREARS_FLOOR) return { source: "temerrut", amount: arrears };
  const debt = state.flags?.pocket?.familyDebt;
  if (debt && whole(debt.amount) >= 1000 && state.time.absoluteWeek > whole(debt.dueWeek) + GRACE)
    return { source: "aile", amount: whole(debt.amount) };
  const fine = (state.openCases || []).find((item) => item.type === "risk-dosya" && item.status === "pending" && Number.isInteger(item.dueWeek) && item.dueWeek <= state.time.absoluteWeek);
  if (fine) return { source: "ceza", amount: FINE };
  return null;
}

export function openIcraNotice(state, claim) {
  if (icraCase(state) || !claim || claim.amount < 1) return null;
  const amount = whole(claim.amount);
  const item = {
    id: `icra-${state.time.absoluteWeek}-${claim.source}`,
    type: "icra",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + GRACE,
    status: "pending",
    payload: {
      stage: "notice",
      source: String(claim.source || "temerrut").slice(0, 16),
      amount,
      owed: amount,
      playerKnown: true,
    },
  };
  state.openCases.push(item);
  return item;
}

function settleSource(state, item, paid) {
  if (item.payload.source === "temerrut")
    state.finances.arrears = Math.max(0, whole(state.finances.arrears) - paid);
  if (item.payload.source === "aile" && paid >= item.payload.amount)
    state.flags.pocket.familyDebt = null;
}

function closeCase(state, item, stage) {
  item.status = "resolved";
  item.payload.stage = stage;
  item.payload.owed = 0;
  normalizeIcra(state);
}

function takeCash(state, owed) {
  const cash = Math.max(0, whole(state.finances.balance));
  const paid = Math.min(owed, cash);
  if (paid > 0) transact(state, -paid, "İcra tahsilatı", "legal");
  return paid;
}

function seizeVehicle(state) {
  const vehicle = state.wealth?.vehicle;
  if (!vehicle) return 0;
  const proceeds = whole(vehicle.currentValue * 0.6);
  state.wealth.vehicle = null;
  if (proceeds > 0) transact(state, proceeds, "Haciz: araç iskontolu satış", "legal");
  return proceeds;
}

function seizeGoods(state) {
  const list = state.wealth?.durables;
  if (!Array.isArray(list) || !list.length) return { proceeds: 0, id: "" };
  const ranked = [...list].sort((a, b) => {
    const av = whole((a.price || 0) * (DURABLES[a.id]?.resale || 0));
    const bv = whole((b.price || 0) * (DURABLES[b.id]?.resale || 0));
    return bv - av;
  });
  const item = ranked[0];
  const market = whole((item.price || 0) * (DURABLES[item.id]?.resale || 0));
  const proceeds = whole(market * 0.5);
  state.wealth.durables = list.filter((row) => row !== item);
  if (proceeds > 0) transact(state, proceeds, "Haciz: eşya iskontolu satış", "legal");
  return { proceeds, id: item.id };
}

export function runHaciz(state, item) {
  const book = normalizeIcra(state);
  let owed = whole(item.payload.owed ?? item.payload.amount);
  const cashPaid = takeCash(state, owed);
  owed -= cashPaid;
  let seized = cashPaid > 0 ? "cash" : "";
  if (owed > 0) {
    const sold = seizeVehicle(state);
    if (sold > 0) seized = "vehicle";
    owed -= takeCash(state, owed);
  }
  let goodsId = "";
  if (owed > 0) {
    const goods = seizeGoods(state);
    goodsId = goods.id;
    if (goods.proceeds > 0) seized = "goods";
    owed -= takeCash(state, owed);
  }
  owed = Math.max(0, owed);
  if (item.payload.source === "temerrut") state.finances.arrears = Math.min(300000, owed);
  else if (owed > 0) state.finances.arrears = Math.min(300000, whole(state.finances.arrears) + owed);
  else settleSource(state, item, whole(item.payload.amount));
  item.payload.owed = owed;
  book.seized = seized || "cash";
  book.frozenWeek = state.time.absoluteWeek;
  updateRelationship(state, "anne", -6);
  addNpcMemory(state, "anne", "İcra kapına dayandı. Bunu duydum.", "icra");
  const partnerId = state.social?.currentPartnerNpcId;
  if (partnerId) addNpcMemory(state, partnerId, "İcra yazısı eve düştü.", "icra");
  adjustHealth(state, { stress: 6 });
  const text = owed > 0
    ? `Haciz işledi. ${seized === "goods" ? "Eşya" : seized === "vehicle" ? "Araç" : "Nakit"} gitti. Kalan ${owed} TL temerrütte duruyor.`
    : `Haciz kapandı. ${seized === "goods" ? "Eşya iskontolu satıldı." : seized === "vehicle" ? "Araç iskontolu satıldı." : "Nakitten tahsil edildi."}`;
  closeCase(state, item, "enforced");
  if (!Number.isInteger(state.finances.balance)) return { ok: false, reason: "Haciz tam TL yazılmadı." };
  return { ok: true, message: remember(state, text), goodsId };
}

export function payIcra(state) {
  const item = icraCase(state);
  if (!item) return { ok: false, reason: "Açık icra yazısı yok." };
  const owed = whole(item.payload.owed ?? item.payload.amount);
  if (state.finances.balance < owed) return { ok: false, reason: `${owed} TL yok. Yazı duruyor.` };
  const before = state.finances.balance;
  transact(state, -owed, "İcra kapanışı", "legal");
  settleSource(state, item, owed);
  closeCase(state, item, "paid");
  if (!Number.isInteger(state.finances.balance) || state.finances.balance !== before - owed)
    return { ok: false, reason: "İcra tam TL yazılmadı." };
  return { ok: true, message: remember(state, `İcra kapandı. ${owed} TL gitti. Dosya durdu.`) };
}

export function planIcra(state) {
  const item = icraCase(state);
  if (!item || item.payload.stage !== "notice") return { ok: false, reason: "Taksit yalnız ilk yazıda bağlanır." };
  const owed = whole(item.payload.owed ?? item.payload.amount);
  const now = whole(owed * 0.4);
  const rest = owed - now;
  const fee = whole(rest * FEE_RATE);
  const dueNow = now + fee;
  if (rest < 400) return { ok: false, reason: "Kalan bu kadar küçükse tamamını öde." };
  if (state.finances.balance < dueNow) return { ok: false, reason: `${dueNow} TL peşinat yok.` };
  const before = state.finances.balance;
  transact(state, -dueNow, "İcra peşinat ve masraf", "legal");
  if (item.payload.source === "temerrut")
    state.finances.arrears = Math.max(0, whole(state.finances.arrears) - now);
  const installment = Math.ceil(rest / 4);
  item.payload.stage = "plan";
  item.payload.fee = fee;
  item.payload.owed = rest;
  item.payload.installment = installment;
  item.payload.leftParts = 4;
  item.dueWeek = state.time.absoluteWeek + 16;
  if (!Number.isInteger(state.finances.balance) || state.finances.balance !== before - dueNow)
    return { ok: false, reason: "Taksit tam TL yazılmadı." };
  return { ok: true, message: remember(state, `Taksit. Peşin ${now} TL, masraf ${fee} TL. Kalan ${rest} TL, ayda ${installment} TL.`) };
}

export function ignoreIcra(state) {
  const item = icraCase(state);
  if (!item || item.payload.stage !== "notice") return { ok: false, reason: "Yok sayılacak yazı yok." };
  item.dueWeek = state.time.absoluteWeek;
  const result = runHaciz(state, item);
  if (!result.ok) return result;
  return { ok: true, message: result.message };
}

export function workaroundIcra(state) {
  const item = icraCase(state);
  if (!item || item.payload.stage !== "notice") return { ok: false, reason: "Aradan dolaşılacak yazı yok." };
  const bump = 600;
  item.payload.amount = whole(item.payload.amount) + bump;
  item.payload.owed = whole(item.payload.owed ?? item.payload.amount) + bump;
  const open = (state.openCases || []).filter((row) => row.type === "risk-dosya" && row.status === "pending");
  if (!open.some((row) => row.payload?.kind === "icra") && open.length < 3) {
    state.openCases.push({
      id: `risk-icra-${state.time.absoluteWeek}`,
      type: "risk-dosya",
      createdWeek: state.time.absoluteWeek,
      dueWeek: state.time.absoluteWeek + 6,
      status: "pending",
      payload: { kind: "icra", text: "İcra dosyasına kolay yol yazıldı. Bu iş mahkemeye gidebilir.", playerKnown: true },
    });
  }
  adjustHealth(state, { stress: 4 });
  return { ok: true, message: remember(state, `Kolay yol tutmadı. Borç ${bump} TL şişti. Dosya kalınlaştı.`) };
}

function collectInstallment(state, item) {
  const part = whole(item.payload.installment);
  const owed = whole(item.payload.owed);
  if (part < 1 || owed < 1) {
    closeCase(state, item, "paid");
    return remember(state, "Taksit bitti. İcra kapandı.");
  }
  if (state.finances.balance < part) return runHaciz(state, item).message;
  const before = state.finances.balance;
  const pay = Math.min(part, owed);
  transact(state, -pay, "İcra taksidi", "legal");
  item.payload.owed = owed - pay;
  item.payload.leftParts = Math.max(0, whole(item.payload.leftParts) - 1);
  if (!Number.isInteger(state.finances.balance) || state.finances.balance !== before - pay)
    return remember(state, "Taksit tam TL yazılmadı.");
  if (item.payload.owed <= 0) {
    if (item.payload.source === "temerrut") state.finances.arrears = 0;
    if (item.payload.source === "aile") state.flags.pocket.familyDebt = null;
    closeCase(state, item, "paid");
    return remember(state, "Son taksit yattı. İcra kapandı.");
  }
  return remember(state, `Taksit yattı. ${pay} TL. Kalan ${item.payload.owed} TL.`);
}

export function processIcraWeek(state) {
  if (state.lifetime?.death) return "";
  const book = normalizeIcra(state);
  const item = icraCase(state);
  if (!item) {
    const claim = claimOf(state);
    if (!claim) {
      book.watchWeek = null;
      return "";
    }
    if (!Number.isInteger(book.watchWeek)) {
      book.watchWeek = state.time.absoluteWeek;
      return "";
    }
    if (state.time.absoluteWeek < book.watchWeek + GRACE) return "";
    const opened = openIcraNotice(state, claim);
    book.watchWeek = null;
    if (!opened) return "";
    return remember(state, `İcra yazısı geldi. ${opened.payload.amount} TL. Öde, taksit bağla, ya da dosya yürür.`);
  }
  if (item.payload.stage === "notice" && state.time.absoluteWeek >= item.dueWeek)
    return runHaciz(state, item).message || "";
  if (item.payload.stage === "plan" && state.time.weekOfMonth === 1)
    return collectInstallment(state, item) || "";
  return "";
}

function noticeOpen(state) {
  const item = icraCase(state);
  return Boolean(item && item.payload?.stage === "notice");
}

export const ICRA_DECISIONS = [
  {
    id: "icra-pay",
    title: "İcrayı kapat",
    detail: "kalan borcun tamamı · dosya kapanır",
    contextual: (state) => Boolean(icraCase(state)),
    apply: payIcra,
  },
  {
    id: "icra-installment",
    title: "Taksit bağla",
    detail: "yüzde 40 peşin · yüzde 10 masraf · kalan 4 ay",
    contextual: noticeOpen,
    apply: planIcra,
  },
  {
    id: "icra-ignore",
    title: "Yazıyı yok say",
    detail: "haciz işler · nakit, araç, eşya",
    contextual: noticeOpen,
    apply: ignoreIcra,
  },
  {
    id: "icra-workaround",
    title: "Aradan dolaş",
    detail: "borç şişer · dosya kalınlaşır",
    contextual: noticeOpen,
    apply: workaroundIcra,
  },
];
