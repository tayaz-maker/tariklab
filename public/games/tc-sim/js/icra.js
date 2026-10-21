// İcra / haciz. Süreler ve inceleme masrafı oyun kuralıdır; hukuk tarifesi değildir.
import { addMemory, addNpcMemory, adjustHealth, transact, updateRelationship } from "./state.js?v=10";
import { getMonthlyEmploymentIncome } from "./life.js?v=10";
import { CASH_ARREARS_CAP, DURABLES } from "./wealth.js?v=10";
import { fundWalletFromAccount } from "./bank-accounts.js?v=10";
import { recordMonthlyDetail } from "./monthly-cash.js?v=10";
import { debtBalance, isAmortizingMortgage, mortgageStatus, settleMortgagePayment, reconcileMortgageClaims } from "./mortgage.js?v=10";

const GRACE = 4;
const ARREARS_FLOOR = 2500;
const FINE = 1500;
const FEE_RATE = 0.1;
const REVIEW_COST = 300;
const REVIEW_WEEKS = 2;

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
    seized: ["cash", "vehicle", "goods", "property"].includes(src.seized) ? src.seized : "",
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
  const loan = state.wealth?.debts?.find(d => isAmortizingMortgage(d) && mortgageStatus(d) === "default" && debtBalance(d) > 0);
  if (loan) return { source: "mortgage", amount: debtBalance(loan), loanId: loan.id };
  if (arrears >= ARREARS_FLOOR) return { source: "temerrut", amount: arrears };
  const debt = state.flags?.pocket?.familyDebt;
  if (debt && whole(debt.amount) >= 1000 && state.time.absoluteWeek > whole(debt.dueWeek) + GRACE)
    return { source: "aile", amount: whole(debt.amount) };
  const fine = (state.openCases || []).find((item) => item.type === "risk-dosya" && item.status === "pending" && !item.payload?.fineEnforced && (!item.payload?.justice || item.payload.justice.version !== 1 || (item.payload.justice.stage === "convicted" && item.payload.justice.final === true)) && Number.isInteger(item.dueWeek) && item.dueWeek <= state.time.absoluteWeek);
  if (fine) return { source: "ceza", amount: FINE, sourceCaseId: fine.id };
  return null;
}

export function openIcraNotice(state, claim) {
  if (icraCase(state) || !claim || claim.amount < 1) return null;
  const loan = claim.source === "mortgage" ? state.wealth?.debts?.find(d => d.id === claim.loanId && isAmortizingMortgage(d)) : null;
  if (claim.source === "mortgage" && (!loan || mortgageStatus(loan) !== "default")) return null;
  const amount = loan ? debtBalance(loan) : whole(claim.amount);
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
      ...(claim.source === "mortgage" ? { loanId: claim.loanId } : {}),
      ...(claim.source === "ceza" && claim.sourceCaseId ? { sourceCaseId: claim.sourceCaseId } : {}),
      ...(claim.source === "temerrut" ? { sourceArrears: Math.min(amount, whole(state.finances.arrears)) } : {}),
      playerKnown: true,
    },
  };
  state.openCases.push(item);
  if (item.payload.sourceCaseId) {
    const source = state.openCases.find(row => row.id === item.payload.sourceCaseId);
    if (source) source.payload.fineEnforced = true;
  }
  return item;
}

// sourceArrears is the part of this claim already represented in finances.arrears.
// Legacy V5/V6 cases have no field: their remaining claim is the safe fallback.
function sourceArrears(state, item) {
  if (item.payload.source !== "temerrut") return 0;
  return Math.max(0, Math.min(
    whole(state.finances.arrears),
    whole(item.payload.sourceArrears ?? item.payload.owed ?? item.payload.amount),
  ));
}

export function recordIcraPayment(state, item, amount) {
  if (item.payload.source === "mortgage") {
    const debt = state.wealth?.debts?.find(d => d.id === item.payload.loanId);
    if (!debt || !isAmortizingMortgage(debt)) return 0;
    const interestPaid = debt.mortgage.interestPaid;
    const paid = settleMortgagePayment(debt, amount);
    recordMonthlyDetail(state, "interestPaid", debt.mortgage.interestPaid - interestPaid);
    item.payload.owed = debtBalance(debt);
    if (!item.payload.owed) state.wealth.debts = state.wealth.debts.filter(d => d !== debt);
    reconcileMortgageClaims(state);
    return paid;
  }
  const owed = Math.max(0, whole(item.payload.owed ?? item.payload.amount));
  const paid = Math.max(0, Math.min(owed, whole(amount)));
  const backed = sourceArrears(state, item);
  const settled = Math.min(backed, paid);
  if (item.payload.source === "temerrut") {
    state.finances.arrears -= settled;
    item.payload.sourceArrears = backed - settled;
  }
  item.payload.owed = owed - paid;
  if (item.payload.source === "aile" && item.payload.owed === 0)
    state.flags.pocket.familyDebt = null;
  return paid;
}

function closeCase(state, item, stage) {
  if (item.payload.review?.status === "pending") {
    item.payload.review.status = "settled";
    item.payload.review.closedWeek = state.time.absoluteWeek;
  }
  item.status = "resolved";
  item.payload.stage = stage;
  item.payload.owed = 0;
  const source = state.openCases.find(row => row.id === item.payload.sourceCaseId);
  if (source?.payload?.justice?.final === true && source.payload.fineEnforced) source.status = "resolved";
  normalizeIcra(state);
}

function takeCash(state, owed) {
  const cash = Math.max(0, whole(state.finances.balance));
  let paid = Math.min(owed, cash);
  if (paid > 0) transact(state, -paid, "İcra tahsilatı", "legal");
  // All accounts belong to this character (including their sole trader).
  // Depositing cash cannot hide it from the existing enforcement engine.
  for (const account of state.finances.banking?.accounts || []) {
    const missing = Math.max(0, owed - paid);
    if (!missing) break;
    if (!account.closed) {
      const collected = fundWalletFromAccount(state, account.id, missing, transact, "İcra tahsilatı için hesaptan aktarım");
      if (collected) transact(state, -collected, "İcra banka hesabı tahsilatı", "legal");
      paid += collected;
    }
  }
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

// Fictional 80% liquidation value, not a Turkish auction or legal pricing rule.
// Only the linked collateral is sold. Deficiency transfers to existing D0
// arrears/negative-cash storage after removing the original loan, exactly once.
function forecloseMortgage(state, item) {
  const debt = state.wealth.debts.find(d => d.id === item.payload.loanId);
  if (!debt || !isAmortizingMortgage(debt)) return { ok: false, reason: "Bağlı konut kredisi bulunamadı." };
  recordIcraPayment(state, item, takeCash(state, debtBalance(debt)));
  if (item.status === "resolved")
    return { ok: true, message: remember(state, "Konut kredisi gecikmesi giderildi; icra durdu, kalan kredi ve konut korunuyor.") };
  const property = state.wealth.properties.find(p => p.id === debt.linkedAssetId && p.mortgageId === debt.id);
  let proceeds = 0, sold = false;
  if (debtBalance(debt) > 0 && property) {
    sold = true;
    proceeds = Math.max(0, whole(property.currentValue * 0.8));
    state.wealth.properties = state.wealth.properties.filter(p => p !== property);
    if (proceeds) transact(state, proceeds, "İpotekli konut: oyun satış bedeli", "property");
    recordIcraPayment(state, item, takeCash(state, debtBalance(debt)));
  }
  const remaining = debtBalance(debt);
  const arrears = whole(state.finances.arrears) + remaining;
  state.finances.arrears = Math.min(CASH_ARREARS_CAP, arrears);
  if (arrears > CASH_ARREARS_CAP) transact(state, -(arrears - CASH_ARREARS_CAP), "İcra kalan borç tavan aşımı", "debt");
  state.wealth.debts = state.wealth.debts.filter(d => d !== debt);
  item.payload.settlement = { propertyId: property?.id || null, proceeds, remaining,
    originalPrincipal: debt.mortgage.originalPrincipal, principalPaid: debt.mortgage.principalPaid,
    interestAccrued: debt.mortgage.interestAccrued, interestPaid: debt.mortgage.interestPaid };
  closeCase(state, item, sold || remaining ? "foreclosed" : "paid");
  const book = normalizeIcra(state);
  book.seized = sold ? "property" : "cash";
  book.frozenWeek = state.time.absoluteWeek;
  if (sold) {
    updateRelationship(state, "anne", -6);
    addNpcMemory(state, "anne", "İcra kapına dayandı. Bunu duydum.", "icra");
    adjustHealth(state, { stress: 6 });
  }
  return { ok: true, message: remember(state, "Konut icrası kapandı. Artan satış bedeli sende; ödenmeyen borç temerrüte aktarıldı. Yüzde 80 satış değeri oyun varsayımıdır. Güncel tutarlar Para ekranında.") };
}

export function runHaciz(state, item) {
  if (item.status !== "pending" || item.payload.stage === "court")
    return { ok: false, reason: "İnceleme bitmeden veya kapalı dosyada haciz yapılamaz." };
  reconcileMortgageClaims(state);
  if (item.status !== "pending") return { ok: false, reason: "İnceleme bitmeden veya kapalı dosyada haciz yapılamaz." };
  if (item.payload.source === "mortgage") return forecloseMortgage(state, item);
  const book = normalizeIcra(state);
  let owed = whole(item.payload.owed ?? item.payload.amount);
  const cashPaid = takeCash(state, owed);
  recordIcraPayment(state, item, cashPaid);
  owed = item.payload.owed;
  let seized = cashPaid > 0 ? "cash" : "";
  if (owed > 0) {
    const sold = seizeVehicle(state);
    if (sold > 0) seized = "vehicle";
    recordIcraPayment(state, item, takeCash(state, owed));
    owed = item.payload.owed;
  }
  let goodsId = "";
  if (owed > 0) {
    const goods = seizeGoods(state);
    goodsId = goods.id;
    if (goods.proceeds > 0) seized = "goods";
    recordIcraPayment(state, item, takeCash(state, owed));
    owed = item.payload.owed;
  }
  owed = Math.max(0, owed);
  // Transfer only the unpaid claim, preserving unrelated arrears. The existing
  // arrears ceiling limits storage, never liability: overflow stays negative cash.
  const arrears = whole(state.finances.arrears) - sourceArrears(state, item) + owed;
  state.finances.arrears = Math.min(CASH_ARREARS_CAP, arrears);
  const overflow = Math.max(0, arrears - CASH_ARREARS_CAP);
  if (overflow) transact(state, -overflow, "İcra kalan borç tavan aşımı", "debt");
  if (item.payload.source === "aile") state.flags.pocket.familyDebt = null;
  item.payload.sourceArrears = 0;
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
  reconcileMortgageClaims(state);
  const item = icraCase(state);
  if (!item) return { ok: false, reason: "Açık icra yazısı yok." };
  const owed = whole(item.payload.owed ?? item.payload.amount);
  if (state.finances.balance < owed) return { ok: false, reason: `${owed} TL yok. Yazı duruyor.` };
  const before = state.finances.balance;
  transact(state, -owed, "İcra kapanışı", "legal");
  recordIcraPayment(state, item, owed);
  closeCase(state, item, "paid");
  if (!Number.isInteger(state.finances.balance) || state.finances.balance !== before - owed)
    return { ok: false, reason: "İcra tam TL yazılmadı." };
  return { ok: true, message: remember(state, `İcra kapandı. ${owed} TL gitti. Dosya durdu.`) };
}

// Recorded evidence is a bounded snapshot, never an invented receipt or debt waiver.
export function inspectIcraEvidence(state) {
  reconcileMortgageClaims(state);
  const item = icraCase(state);
  if (!item || !["notice", "court"].includes(item.payload.stage)) return { ok: false, reason: "İncelenecek açık bildirim veya dava yok." };
  const owed = Math.max(0, whole(item.payload.owed));
  const loan = item.payload.source === "mortgage" ? state.wealth?.debts?.find(d => d.id === item.payload.loanId) : null;
  item.payload.evidence = { version: 1, week: state.time.absoluteWeek, source: item.payload.source,
    claimed: owed, backing: loan ? debtBalance(loan) : item.payload.source === "temerrut" ? sourceArrears(state, item) : null,
    sourceCaseId: item.payload.sourceCaseId || null };
  return { ok: true, message: remember(state, "Dosya incelendi. Kaynak borç, güncel kalan ve bağlı kayıt ayrıldı. İnceleme borcu silmez; güncel tutarlar Para ekranında.") };
}
export function hireIcraCounsel(state) {
  const item = icraCase(state);
  if (!item || !["notice", "court"].includes(item.payload.stage) || item.payload.counsel || !item.payload.evidence)
    return { ok: false, reason: "Avukat için önce açık dosyayı incele; destek bir kez alınır." };
  if (state.finances.balance < 500) return { ok: false, reason: "Avukat desteği için 500 TL oyun ücreti gerekiyor." };
  transact(state, -500, "Avukat dosya desteği", "legal");
  item.payload.counsel = { version: 1, hiredWeek: state.time.absoluteWeek, fee: 500 };
  return { ok: true, message: remember(state, "Avukat dosyaya katıldı. 500 TL oyun ücreti ödendi; geçerli borç silinmez. İlk karardan sonra bir ek inceleme istenebilir; bu, yasal istinaf modeli değildir.") };
}
export function appealIcra(state) {
  const item = icraCase(state);
  if (!item || item.payload.stage !== "notice" || item.payload.review?.status !== "confirmed" ||
      !item.payload.counsel || item.payload.review.appealed || state.time.absoluteWeek >= item.dueWeek)
    return { ok: false, reason: "Ek inceleme için avukat, ilk karar ve açık süre gerekiyor." };
  item.payload.review.appealed = true;
  item.payload.review.status = "pending";
  item.payload.review.appealWeek = state.time.absoluteWeek;
  item.payload.stage = "court";
  item.dueWeek = state.time.absoluteWeek + REVIEW_WEEKS;
  return { ok: true, message: remember(state, "Avukatla ek inceleme açıldı. İki oyun haftası haciz bekler; kalan borç yeniden kontrol edilir. Yeni borç veya borç affı oluşmaz.") };
}

// One review per notice. The court checks the live unpaid claim, never the
// original amount: payments made during review cannot be resurrected.
export function objectIcra(state) {
  const item = icraCase(state);
  if (!item || item.payload.stage !== "notice" || item.payload.review || state.time.absoluteWeek >= item.dueWeek)
    return { ok: false, reason: "Bu dosya için yeni itiraz süresi yok." };
  if (state.finances.balance < REVIEW_COST)
    return { ok: false, reason: "İnceleme için 300 TL oyun masrafı gerekiyor." };
  transact(state, -REVIEW_COST, "İcra inceleme masrafı", "legal");
  item.payload.review = { version: 1, status: "pending", filedWeek: state.time.absoluteWeek, cost: REVIEW_COST };
  item.payload.stage = "court";
  item.dueWeek = state.time.absoluteWeek + REVIEW_WEEKS;
  return { ok: true, message: remember(state, "İtiraz kayda geçti. Mahkeme incelemesi 2 hafta sürer; haciz bekler, borç silinmez. Süre ve 300 TL masraf oyun kuralıdır.") };
}

function reviewIcra(state, item) {
  const owed = Math.max(0, whole(item.payload.owed ?? item.payload.amount));
  item.payload.review.status = owed > 0 ? "confirmed" : "settled";
  item.payload.review.closedWeek = state.time.absoluteWeek;
  item.payload.review.confirmedOwed = owed;
  item.payload.review.evidenceWeek = item.payload.evidence?.week ?? null;
  item.payload.review.final = item.payload.review.appealed === true;
  if (owed === 0) {
    closeCase(state, item, "paid");
    return remember(state, "İnceleme kapandı. Ödenmiş borç yeniden yazılmadı.");
  }
  item.payload.stage = "notice";
  item.dueWeek = state.time.absoluteWeek + GRACE;
  return remember(state, `İnceleme bitti. Kayıtlardaki ödenmemiş ${owed} TL doğrulandı. Ödeme veya taksit için 4 oyun haftası var; ikinci itiraz yok.`);
}

// Voluntary game collection order, not a statutory Turkish wage attachment.
// The existing net salary is posted in full before this debt payment.
export function startWageCollection(state) {
  const item = icraCase(state);
  if (!item || item.payload.stage !== "notice" || !["temerrut", "aile"].includes(item.payload.source) || getMonthlyEmploymentIncome(state) <= 0)
    return { ok: false, reason: "Maaştan tahsilat için açık bildirim ve ücretli iş gerekiyor." };
  item.payload.stage = "wage";
  item.payload.wage = { version: 1, lastMonth: null, paid: 0 };
  return { ok: true, message: remember(state, "Maaştan tahsilat bağlandı. Bildirim süresinden sonra gerçekleşmiş net maaşın yüzde 20'si borca gider. Bu oran oyun varsayımıdır; maaş yoksa kesinti yok, borç silinmez.") };
}

// Modeled ordinary private-sector wage claims only. Public service, pensions,
// self-employment, maintenance and historical pre-2003 rules are not inferred.
const ATTACHABLE_JOBS = new Set(["market", "office", "waiter", "barista", "factory", "warehouse", "callcenter", "cashier_big", "sales_floor"]);
function attachableWage(state) {
  return state.time.year >= 2003 && ATTACHABLE_JOBS.has(state.career?.jobId) &&
    state.career?.retirement?.status !== "retired";
}
function attachWage(state, item) {
  // Preserve the existing surcharge/cap-overflow settlement path (D0).
  if (item.payload.source === "temerrut" && whole(item.payload.owed) > sourceArrears(state, item)) return "";
  if (!["temerrut", "aile"].includes(item.payload.source) || !attachableWage(state) || getMonthlyEmploymentIncome(state) <= 0) return "";
  item.payload.stage = "wage";
  item.payload.wage = { version: 1, lastMonth: null, paid: 0, compulsory: true };
  return remember(state, "Bildirim süresi doldu. Maaş haczi başladı; gerçekleşmiş net ücretin en çok dörtte biri borca gider. Desteklenen özel sektör işleri için oyun modeli; emekli aylığına uygulanmaz. Süreler oyun varsayımıdır.");
}

export function collectWageDebt(state, salary) {
  const item = icraCase(state);
  if (!item || item.payload.stage !== "wage" || item.payload.wage?.version !== 1 ||
      state.time.absoluteWeek < item.dueWeek || !Number.isSafeInteger(salary) || salary <= 0 || state.lifetime?.death) return 0;
  if (item.payload.wage.compulsory && !attachableWage(state)) return 0;
  const month = `${state.time.year}-${state.time.month}`;
  if (item.payload.wage.lastMonth === month) return 0;
  item.payload.wage.lastMonth = month;
  const owed = Math.max(0, whole(item.payload.owed));
  const paid = Math.min(owed, Math.floor(salary / (item.payload.wage.compulsory ? 4 : 5)), Math.max(0, whole(state.finances.balance)));
  if (paid > 0) {
    transact(state, -paid, "İcra maaş tahsilatı", "debt");
    recordIcraPayment(state, item, paid);
    item.payload.wage.paid += paid;
  }
  if (item.payload.owed === 0) closeCase(state, item, "paid");
  return paid;
}

export function planIcra(state) {
  const item = icraCase(state);
  if (item?.payload.source === "mortgage")
    return { ok: false, reason: "Konut kredisi için Bankalar menüsündeki yapılandırmayı kullan." };
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
  recordIcraPayment(state, item, now);
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
  if (item.payload.source === "mortgage") return { ok: false, reason: "Konut kredisi için Bankalar menüsündeki yapılandırmayı kullan." };
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
  const pay = Math.min(part, owed);
  if (state.finances.balance < pay) return runHaciz(state, item).message;
  const before = state.finances.balance;
  transact(state, -pay, "İcra taksidi", "legal");
  recordIcraPayment(state, item, pay);
  item.payload.leftParts = Math.max(0, whole(item.payload.leftParts) - 1);
  if (!Number.isInteger(state.finances.balance) || state.finances.balance !== before - pay)
    return remember(state, "Taksit tam TL yazılmadı.");
  if (item.payload.owed <= 0) {
    closeCase(state, item, "paid");
    return remember(state, "Son taksit yattı. İcra kapandı.");
  }
  return remember(state, `Taksit yattı. ${pay} TL. Kalan ${item.payload.owed} TL.`);
}

export function processIcraWeek(state) {
  if (state.lifetime?.death) return "";
  reconcileMortgageClaims(state);
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
    return remember(state, opened.payload.source === "mortgage"
      ? "Konut kredisi icra bildirimi geldi. Öde, itiraz et veya Bankalar üzerinden yapılandır. Ödenmezse bağlı konut yüzde 80 oyun değeriyle satılır; kalan borç silinmez."
      : `İcra yazısı geldi. ${opened.payload.amount} TL. Öde, taksit bağla, ya da dosya yürür.`);
  }
  if (item.payload.stage === "court" && state.time.absoluteWeek >= item.dueWeek)
    return reviewIcra(state, item);
  if (item.payload.stage === "notice" && state.time.absoluteWeek >= item.dueWeek)
    return attachWage(state, item) || runHaciz(state, item).message || "";
  if (item.payload.stage === "plan" && state.time.weekOfMonth === 1)
    return collectInstallment(state, item) || "";
  return "";
}

function noticeOpen(state) {
  const item = icraCase(state);
  return Boolean(item && item.payload?.stage === "notice");
}

export const ICRA_DECISIONS = [
  { id: "icra-evidence", title: "Borç dosyasını incele", detail: "1 hak · kaynak kayıt ve kalan borç · ücret yok",
    contextual: state => { const f=icraCase(state); return Boolean(f && ["notice","court"].includes(f.payload.stage)); }, apply: inspectIcraEvidence },
  { id: "icra-counsel", title: "Dosyaya avukat desteği al", detail: "500 TL oyun ücreti · bir ek inceleme · borç affı yok", minimumBalance: 500,
    contextual: state => { const f=icraCase(state); return Boolean(f && ["notice","court"].includes(f.payload.stage) && f.payload.evidence && !f.payload.counsel); }, apply: hireIcraCounsel },
  { id: "icra-appeal", title: "Avukatla ek inceleme iste", detail: "1 hak · 2 oyun haftası · tek ek inceleme",
    contextual: state => { const f=icraCase(state); return Boolean(f && f.payload.stage==="notice" && f.payload.review?.status==="confirmed" && f.payload.counsel && !f.payload.review.appealed && state.time.absoluteWeek<f.dueWeek); }, apply: appealIcra },
  {
    id: "icra-wage",
    title: "Maaştan tahsilata bağla",
    detail: "gerçekleşmiş net maaşın yüzde 20’si · oyun varsayımı · borç silinmez",
    contextual: state => noticeOpen(state) && ["temerrut", "aile"].includes(icraCase(state).payload.source) && getMonthlyEmploymentIncome(state) > 0,
    apply: startWageCollection,
  },
  {
    id: "icra-object",
    title: "Borç dökümüne itiraz et",
    detail: "300 TL oyun masrafı · 2 hafta inceleme · geçerli borç silinmez",
    minimumBalance: REVIEW_COST,
    contextual: (state) => {
      const item = icraCase(state);
      return Boolean(item && item.payload.stage === "notice" && !item.payload.review && state.time.absoluteWeek < item.dueWeek);
    },
    apply: objectIcra,
  },
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
    contextual: state => noticeOpen(state) && icraCase(state).payload.source !== "mortgage",
    apply: planIcra,
  },
  {
    id: "icra-ignore",
    title: "Yazıyı yok say",
    detail: "haciz işler · nakit, ipotekli konut, araç, eşya",
    contextual: noticeOpen,
    apply: ignoreIcra,
  },
  {
    id: "icra-workaround",
    title: "Aradan dolaş",
    detail: "borç şişer · dosya kalınlaşır",
    contextual: state => noticeOpen(state) && icraCase(state).payload.source !== "mortgage",
    apply: workaroundIcra,
  },
];
