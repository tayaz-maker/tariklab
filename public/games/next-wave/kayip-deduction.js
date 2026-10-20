import { APPS, CONTACTS, THREADS, DISCOVERABLES, ENDINGS } from "./kayip-data.js";
import {
  EXTRA_PATHS,
  EXTRA_SECRET_EVIDENCE,
  EXTRA_MOVABLE,
  EXCLUSIVE_PAIRS,
  ITEM_VARIANTS,
  overlayThreadMessages,
  itemAllowed as contentItemAllowed,
  reportTraces,
} from "./kayip-content.js";

const cap = (xs, n) => (Array.isArray(xs) ? xs.slice(-n) : []);
const hash = (seed, value) => {
  let x = (Number(seed) || 12345) >>> 0;
  for (const c of String(value)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
  return x >>> 0;
};
const pair = (tr, en) => [tr, en];

export const EVIDENCE_TYPES = ["message", "person", "photo", "location", "time", "note", "call", "calendar", "file", "payment", "media"];
const APP_TYPE = { messages: "message", contacts: "person", calls: "call", photos: "photo", notes: "note", calendar: "calendar", files: "file", voice: "media" };
// The ID scan, the password draft and the lock pattern are the three files the
// witness/family endings are written around ("özel dosyaya girmedin",
// "şifreye ve kimliğe dokunmadın"), so both ending paths test this one list.
const INTIMATE = ["file_scan", "note_pass", "lock_note"];

export const FACTS = [
  { id: "planned-departure", title: pair("Ayrılık planlıydı", "The departure was planned"), critical: true, paths: [["photo_ticket", "cal_bus"], ["photo_bag", "cal_bus"], ["photo_ticket", "photo_bag"]] },
  { id: "naz-meeting", title: pair("Naz ile gizli bir görüşme vardı", "There was a private meeting with Naz"), critical: true, paths: [["cal_naz", "photo_cafe"], ["file_map", "photo_cafe"], ["contact_naz_note", "file_chat"]] },
  { id: "work-pressure", title: pair("İş baskısı kaçışı hızlandırdı", "Work pressure accelerated the escape"), critical: true, paths: [["file_pdf", "cal_work"], ["call_emre", "cal_work"], ["file_pdf", "call_patron"]] },
  { id: "family-unaware", title: pair("Aile planı bilmiyordu", "The family did not know the plan"), critical: true, paths: [["clue_0", "photo_bag"], ["call_leyla", "photo_ticket"]] },
  { id: "ali-timeline-lie", title: pair("Ali zaman çizelgesi konusunda dürüst değildi", "Ali was not honest about the timeline"), critical: true, paths: [["voice_2", "deleted_ali"], ["note_pin", "voice_2"], ["deleted_ali", "note_pin"]] },
];

export const THEORIES = [
  { id: "what", title: pair("Ne oldu?", "What happened?"), options: [
    { id: "planned", title: pair("Planlı biçimde ayrıldı", "They left deliberately"), supports: ["planned-departure", "work-pressure"], contradicts: [] },
    { id: "abduction", title: pair("Zorla götürüldü", "They were taken by force"), supports: [], contradicts: ["planned-departure"] },
    { id: "impulse", title: pair("Ani bir kaçıştı", "It was an impulsive escape"), supports: ["work-pressure"], contradicts: ["planned-departure"] },
  ] },
  { id: "naz", title: pair("Naz'ın rolü ne?", "What was Naz's role?"), options: [
    { id: "confidant", title: pair("Planı bilen sırdaş", "A confidant who knew the plan"), supports: ["naz-meeting", "planned-departure"], contradicts: [] },
    { id: "affair", title: pair("Gizli ilişki", "A secret affair"), supports: ["naz-meeting"], contradicts: [] },
    { id: "unrelated", title: pair("Olayla ilgisiz", "Unrelated to the case"), supports: [], contradicts: ["naz-meeting"] },
  ] },
  { id: "ali", title: pair("Ali doğruyu söylüyor mu?", "Is Ali telling the truth?"), options: [
    { id: "lied", title: pair("Zaman konusunda yalan söyledi", "He lied about the timing"), supports: ["ali-timeline-lie"], contradicts: [] },
    { id: "protected", title: pair("Sahibini korumak için eksik anlattı", "He omitted details to protect the owner"), supports: ["ali-timeline-lie", "planned-departure"], contradicts: [] },
    { id: "truthful", title: pair("Anlatımı doğru", "His account is accurate"), supports: [], contradicts: ["ali-timeline-lie"] },
  ] },
];

export const SIDE_SECRETS = [
  { id: "debt", title: pair("Gizli borç", "Hidden debt"), evidence: ["note_debt", "bank_sms", "note_iban", "voice_3"], threshold: 2 },
  { id: "relationship", title: pair("Saklanan ilişki", "Hidden relationship"), evidence: ["deleted_draft", "photo_key", "voice_1"], threshold: 2 },
  { id: "work", title: pair("İş sırrı", "Work secret"), evidence: ["file_pdf", "cal_work", "call_patron"], threshold: 2 },
  { id: "health", title: pair("Sağlık meselesi", "Health issue"), evidence: ["cal_clinic", "photo_eczane", "file_scan"], threshold: 2 },
  { id: "account", title: pair("Sahte hesap", "False account"), evidence: ["file_chat", "contact_naz_note", "call_unknown"], threshold: 2 },
];

for (const [id, paths] of Object.entries(EXTRA_PATHS)) {
  const fact = FACTS.find((row) => row.id === id);
  if (fact) fact.paths = fact.paths.concat(paths);
}
for (const [id, ids] of Object.entries(EXTRA_SECRET_EVIDENCE)) {
  const secret = SIDE_SECRETS.find((row) => row.id === id);
  if (secret) secret.evidence = secret.evidence.concat(ids);
}

export const DECISIONS = [
  { id: "return", title: pair("Sessizce iade et", "Return it quietly") },
  { id: "warn-family", title: pair("Aileyi uyar", "Warn the family") },
  { id: "accuse-ali", title: pair("Ali'yi suçla", "Accuse Ali") },
  { id: "expose", title: pair("Bulduklarını açıkla", "Expose what you found") },
  { id: "protect", title: pair("Gerçeği sakla", "Protect the truth") },
];

export function caseLayout(seed) {
  const movable = {
    bank_sms: ["messages", "files"], deleted_draft: ["messages", "notes"], file_map: ["files", "notes"],
    contact_naz_note: ["contacts", "notes"], call_unknown: ["calls", "messages"],
    ...EXTRA_MOVABLE,
  };
  const apps = {};
  for (const item of DISCOVERABLES) {
    const choices = movable[item.id] || [item.app];
    if (choices.length < 2) continue;
    apps[item.id] = choices[hash(seed, item.id) % choices.length];
  }
  const ranked = SIDE_SECRETS.slice().sort((a, b) => hash(seed, a.id) - hash(seed, b.id));
  const exclusive = {};
  for (const [family, ids] of Object.entries(EXCLUSIVE_PAIRS)) {
    exclusive[family] = ids[(hash(seed, `exclusive:${family}`) >>> 8) % ids.length];
  }
  return {
    apps,
    messageVariant: hash(seed, "messages") % 6,
    activeSecrets: ranked.slice(0, 3 + (hash(seed, "secrets") % 3)).map((x) => x.id),
    exclusive,
  };
}

export function createPhoneState(seed = 12345) {
  const caseSeed = (Number(seed) || 12345) >>> 0;
  return ensurePhoneState({
    meta: { version: 2, id: "kayip-telefon", seed: caseSeed }, caseId: "lost-phone-01", caseSeed,
    unlockedApps: ["messages", "contacts"], discoveredItems: [], contacts: CONTACTS.map(({ id, name }) => ({ id, name })),
    threads: THREADS.map((x) => ({ id: x.id, contactId: x.contactId, messages: x.messages.slice() })), clues: [], hypotheses: [],
    privacyPressure: 0, ownerRisk: 0, corroboration: [], contradiction: [], openCases: [], timeline: [], history: [],
    evidenceLinks: [], pinnedItems: [], knownFacts: [], sideSecrets: [], decision: "return", caseReport: null,
    flags: { ending: null }, ui: { app: "messages", screen: "Mesajlar", caseTab: "evidence", linkFrom: null },
  });
}

export function newCaseSeed() {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
}

export function validatePhoneState(s) {
  return !!s && s.meta?.id === "kayip-telefon" && [1, 2].includes(s.meta.version) &&
    Array.isArray(s.history) && Array.isArray(s.openCases) && Array.isArray(s.discoveredItems) &&
    Array.isArray(s.unlockedApps) && Number.isFinite(s.privacyPressure) && Number.isFinite(s.ownerRisk) &&
    s.discoveredItems.every((id) => DISCOVERABLES.some((x) => x.id === id));
}

export function ensurePhoneState(s) {
  if (!validatePhoneState(s)) return null;
  s.meta.version = 2;
  s.caseSeed = (Number(s.caseSeed ?? s.meta.seed) || 12345) >>> 0;
  s.meta.seed = s.caseSeed;
  s.caseLayout = s.caseLayout?.apps && Array.isArray(s.caseLayout.activeSecrets) ? s.caseLayout : caseLayout(s.caseSeed);
  if (!s.caseLayout.exclusive || typeof s.caseLayout.exclusive !== "object") {
    s.caseLayout.exclusive = caseLayout(s.caseSeed).exclusive;
  }
  // Valid legacy saves already keep these in range, but a finite, partially
  // written value such as 999 previously rendered as "999/100" and forced the
  // wrong ending until another discovery happened to clamp it.
  s.privacyPressure = Math.max(0, Math.min(100, s.privacyPressure));
  s.ownerRisk = Math.max(0, Math.min(100, s.ownerRisk));
  // The link graph is player-controlled, so a hand-edited or half-written save
  // must not be able to seed the notebook with edges linkEvidence() would have
  // refused: unknown/undiscovered endpoints, self-links, or the same pair
  // twice (A|B and B|A). pinnedItems already gets this guarantee below.
  const linkSeen = new Set();
  s.evidenceLinks = cap(s.evidenceLinks, 64).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const { a, b } = row;
    if (a === b || !s.discoveredItems.includes(a) || !s.discoveredItems.includes(b)) return [];
    const key = [a, b].sort().join("|");
    if (linkSeen.has(key)) return [];
    linkSeen.add(key);
    return [{ ...row, key }];
  });
  s.pinnedItems = cap(s.pinnedItems, 20).filter((id) => s.discoveredItems.includes(id));
  // `clues` was the pre-graph copy of discoveredItems. Keeping both made a
  // content-heavy slot pay for every evidence id twice; all current readers
  // use discoveredItems, so retain the legacy field only as an empty shim.
  s.clues = [];
  s.knownFacts = cap(s.knownFacts, FACTS.length);
  s.sideSecrets = cap(s.sideSecrets, SIDE_SECRETS.length);
  // setTheory() keeps exactly one answer per question. Without the same
  // guarantee on load, a save repeating one answer inflated finishCase()'s
  // `correct` counter and could buy a better ending than the run earned.
  const answered = new Set();
  s.hypotheses = cap(s.hypotheses, THEORIES.length)
    .filter((x) => x && typeof x === "object")
    .filter((x) => {
      if (answered.has(x.question)) return false;
      answered.add(x.question);
      return true;
    });
  s.decision = DECISIONS.some((x) => x.id === s.decision) ? s.decision : "return";
  s.caseReport = s.caseReport && typeof s.caseReport === "object" ? s.caseReport : null;
  s.corrobation = undefined;
  s.corroboration = cap(s.corroboration, 64);
  s.contradiction = cap(s.contradiction, 64);
  // Pressure is aggregate state and the timeline UI only needs item/order.
  // Strip old redundant snapshots on load while preserving discovery order.
  s.timeline = cap(s.timeline, 80).flatMap((row) => row?.item ? [{ item: row.item, order: row.order }] : []);
  s.history = cap(s.history, 80);
  // A save with no flags object loaded fine and then threw on the first
  // action, and an unknown ending id left every action refused while the UI
  // still rendered the playable phone - an unrecoverable soft-lock.
  s.flags = s.flags && typeof s.flags === "object" ? s.flags : {};
  s.flags.ending = Object.hasOwn(ENDINGS, s.flags.ending) ? s.flags.ending : null;
  s.ui = Object.assign({ app: "messages", screen: "Mesajlar", caseTab: "evidence", linkFrom: null }, s.ui || {});
  // UI pointers are recoverable: never let a damaged selection crash the
  // renderer or expose a locked app, and preserve the case's earned progress.
  if (!APPS.includes(s.ui.app) || !s.unlockedApps.includes(s.ui.app)) s.ui.app = "messages";
  if (!["evidence", "theory", "timeline"].includes(s.ui.caseTab)) s.ui.caseTab = "evidence";
  if (!s.discoveredItems.includes(s.ui.linkFrom)) s.ui.linkFrom = null;
  updateDeductions(s);
  return s;
}

export function evidenceSpec(s, id) {
  const item = DISCOVERABLES.find((x) => x.id === id);
  if (!item) return null;
  const app = s.caseLayout?.apps?.[id] || item.app;
  const spec = { ...item, app, type: APP_TYPE[app] || "media" };
  const flavors = ITEM_VARIANTS[id];
  if (flavors?.length) {
    const pick = flavors[hash(s.caseSeed, `${id}:flavor`) % flavors.length];
    if (pick.title) spec.title = pick.title;
    if (pick.text) spec.text = pick.text;
    if (pick.caption) spec.caption = pick.caption;
  }
  return spec;
}

export function itemAllowed(s, id) {
  return contentItemAllowed(id, s.caseLayout?.exclusive);
}

export function availableEvidence(s, app) {
  return DISCOVERABLES
    .filter((x) => contentItemAllowed(x.id, s.caseLayout?.exclusive))
    .map((x) => evidenceSpec(s, x.id))
    .filter((x) => x.app === app);
}
export function evidenceNodes(s) { return s.discoveredItems.map((id) => evidenceSpec(s, id)).filter(Boolean); }
export function phoneThreads(s) {
  const variant = s.caseLayout?.messageVariant || 0;
  return (s.threads || THREADS).map((thread) => ({
    ...thread,
    messages: overlayThreadMessages(thread, variant),
  }));
}

function updateDeductions(s) {
  const got = new Set(s.discoveredItems);
  const visible = new Set([...got, ...(s.threads || []).map((x) => x.id)]);
  const relations = (kind) => DISCOVERABLES.flatMap((item) => {
    if (!got.has(item.id)) return [];
    const targets = Array.isArray(item[kind]) ? item[kind] : item[kind] ? [item[kind]] : [];
    return targets.filter((target) => visible.has(target)).map((target) => ({ item: item.id, with: target }));
  });
  s.corroboration = relations("corroborates");
  s.contradiction = relations("contradicts");
  s.knownFacts = FACTS.filter((fact) => fact.paths.some((path) => path.every((id) => got.has(id)))).map((x) => x.id);
  s.sideSecrets = SIDE_SECRETS.filter((secret) => s.caseLayout.activeSecrets.includes(secret.id) && secret.evidence.filter((id) => got.has(id)).length >= secret.threshold).map((x) => x.id);
  s.hypotheses = s.hypotheses.map((hyp) => theorySummary(s, hyp.question, hyp.option)).filter(Boolean);
}

export function theorySummary(s, questionId, optionId) {
  const question = THEORIES.find((x) => x.id === questionId), option = question?.options.find((x) => x.id === optionId);
  if (!option) return null;
  const support = option.supports.filter((x) => s.knownFacts.includes(x)).length;
  const conflict = option.contradicts.filter((x) => s.knownFacts.includes(x)).length;
  const confidence = Math.max(5, Math.min(100, 15 + support * 38 - conflict * 35));
  const status = conflict && support ? "conflicted" : conflict ? "refuted" : support >= 2 ? "strong" : support ? "supported" : "weak";
  return { question: questionId, option: optionId, confidence, status };
}

export function discoverEvidence(s, id) {
  if (s.flags.ending || s.discoveredItems.includes(id)) return false;
  const item = evidenceSpec(s, id); if (!item) return false;
  if (item.requires?.some((required) => !s.discoveredItems.includes(required))) return false;
  s.discoveredItems.push(id);
  s.privacyPressure = Math.max(0, Math.min(100, s.privacyPressure + (item.pressure || 8)));
  s.ownerRisk = Math.max(0, Math.min(100, s.ownerRisk + (item.tags?.includes("privacy") ? 10 : 3)));
  s.timeline.push({ item: id, order: s.discoveredItems.length });
  s.history.push({ type: "discover", item: id });
  updateDeductions(s); ensurePhoneState(s); return true;
}

export function linkEvidence(s, a, b) {
  if (s.flags.ending || a === b || !s.discoveredItems.includes(a) || !s.discoveredItems.includes(b)) return false;
  const key = [a, b].sort().join("|");
  if (s.evidenceLinks.some((x) => x.key === key)) return false;
  const related = (x, target) => [x.corroborates, x.contradicts].flat().filter(Boolean).includes(target);
  const authored = DISCOVERABLES.some((x) => x.id === a && related(x, b)) || DISCOVERABLES.some((x) => x.id === b && related(x, a)) || FACTS.some((f) => f.paths.some((p) => p.includes(a) && p.includes(b)));
  s.evidenceLinks.push({ key, a, b, relation: authored ? "relevant" : "context" });
  s.history.push({ type: "link", a, b }); s.ui.linkFrom = null; ensurePhoneState(s); return true;
}

export function togglePin(s, id) { if (!s.discoveredItems.includes(id) || s.flags.ending) return false; s.pinnedItems = s.pinnedItems.includes(id) ? s.pinnedItems.filter((x) => x !== id) : cap(s.pinnedItems.concat(id), 20); return true; }
export function setTheory(s, question, option) { if (s.flags.ending || !THEORIES.find((q) => q.id === question)?.options.some((x) => x.id === option)) return false; s.hypotheses = s.hypotheses.filter((x) => x.question !== question).concat(theorySummary(s, question, option)); s.history.push({ type: "theory", question, option }); ensurePhoneState(s); return true; }
export function setDecision(s, decision) { if (s.flags.ending || !DECISIONS.some((x) => x.id === decision)) return false; s.decision = decision; return true; }

export function finishCase(s) {
  if (s.flags.ending) return false;
  const what = s.hypotheses.find((x) => x.question === "what");
  const correct = s.hypotheses.filter((x) => (x.question === "what" && x.option === "planned") || (x.question === "naz" && x.option === "confidant") || (x.question === "ali" && ["lied", "protected"].includes(x.option))).length;
  const wrong = s.hypotheses.filter((x) => x.status === "refuted" || (x.question === "what" && x.option === "abduction")).length;
  // Witness and family are the restrained-reading endings, so they turn on
  // whether the intimate files were opened plus a privacy ceiling. The old
  // ceiling was < 70 with no file test, which made a complete solve
  // impossible: the cheapest route to all five critical facts costs 72
  // pressure, so the best possible deduction always fell through to
  // "reckless" while a 3-fact run earned "witness". 80 clears that cheapest
  // full solve (72) and still excludes a phone-wide sweep (100).
  const intimate = s.discoveredItems.some((x) => INTIMATE.includes(x));
  const restrained = !intimate && s.privacyPressure < 80;
  let ending;
  if (s.decision === "accuse-ali" && (!what || correct < 2)) ending = "reckless";
  else if (s.decision === "warn-family" && s.knownFacts.includes("family-unaware") && s.knownFacts.includes("planned-departure") && wrong === 0 && restrained) ending = "family";
  else if (what?.option === "planned" && s.knownFacts.length >= 3 && wrong === 0 && restrained) ending = "witness";
  // "reckless" is the privacy verdict ("çok derin indin"), so it needs actual
  // intrusion. It used to also absorb every wrong theory, which told a player
  // who opened nothing at all that they had leaked someone's life.
  else if (intimate || s.privacyPressure >= 60) ending = "reckless";
  // "minimal" is the you-learned-almost-nothing verdict. Keying it on having
  // set no theory meant merely opening the theory panel locked it out, so a
  // run with no discoveries was reported as "thorough" - "you saw enough".
  else if (!s.knownFacts.length && s.privacyPressure < 20) ending = "minimal";
  else ending = "thorough";
  s.flags.ending = ending;
  s.caseReport = {
    seed: s.caseSeed, decision: s.decision, ending,
    theories: s.hypotheses.map((x) => ({ ...x })),
    correct, wrong,
    criticalEvidence: FACTS.filter((x) => s.knownFacts.includes(x.id)).map((x) => x.id),
    missedFacts: FACTS.filter((x) => !s.knownFacts.includes(x.id)).map((x) => x.id),
    contradictions: cap(s.contradiction, 8),
    sideSecrets: s.sideSecrets.slice(),
    confidence: s.hypotheses.length ? Math.round(s.hypotheses.reduce((a, x) => a + x.confidence, 0) / s.hypotheses.length) : 0,
    traces: reportTraces(s, ending),
  };
  s.history.push({ type: "ending", ending, decision: s.decision });
  // Once the deterministic report exists, discovery/link history is redundant
  // with discoveredItems, evidenceLinks and the report itself. Keep decisions
  // needed for audit without carrying a second full run transcript forever.
  s.history = s.history.filter((row) => row.type === "theory" || row.type === "ending");
  ensurePhoneState(s); return true;
}

export function legacyEnding(s) {
  const pressure = s.privacyPressure, sawId = s.discoveredItems.some((x) => INTIMATE.includes(x));
  const travel = s.discoveredItems.some((x) => ["photo_ticket", "photo_bag", "cal_bus"].includes(x));
  const family = s.discoveredItems.includes("call_leyla") || s.discoveredItems.includes("clue_0");
  if (s.corroboration.length >= 3 && pressure < 70 && !sawId) return "witness";
  if (family && travel && !sawId && pressure < 55) return "family";
  return pressure < 20 ? "minimal" : pressure < 60 ? "thorough" : "reckless";
}

export { APPS, CONTACTS, DISCOVERABLES, ENDINGS, INTIMATE, EXCLUSIVE_PAIRS };
