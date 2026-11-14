import test from "node:test";
import assert from "node:assert/strict";
import { createGame, getActions, resolveAction, loadExpansionRuntime, expandGame } from "../public/games/tc-sim-boardworld/engine.mjs";
import { getExpansionView } from "../public/games/tc-sim-boardworld/expansion.mjs";
import { renderExpansion, translateExpansionAction, localizeExpansionOutcome } from "../public/games/tc-sim-boardworld/expansion-ui.mjs";
import { chooseLanguage, getLanguage } from "../public/games/tc-sim-boardworld/i18n.mjs";
import { exportGame } from "../public/games/tc-sim-boardworld/persistence.mjs";

async function selectLanguage(language) {
  await chooseLanguage(language);
  assert.equal(getLanguage(), language);
}

test("expansion view renders actual relatives, parent links and market amounts in each language", async () => {
  await loadExpansionRuntime();
  const state = expandGame(createGame({ name: "Deniz", seed: 49 }));
  const view = getExpansionView(state);
  const original = exportGame(state);
  for (const language of ["tr", "en", "pl"]) {
    await selectLanguage(language);
    const render = section => renderExpansion({ view, actions: getActions(state), actionCard: a => `<button>${a.label}</button>`, sectionHeader: s => `<h2>${s}</h2>`, money: n => `${n} ₺`, esc: String, language, section });
    const html = render("family"), finance = render("finance"), world = render("world");
    for (const p of view.family.people) {
      assert.ok(html.includes(`id="family-${p.id}"`));
      for (const parent of p.parents) assert.ok(html.includes(`href="#family-${parent}"`));
    }
    for (const p of view.economy.properties) {
      assert.ok(finance.includes(`${p.value} ₺`));
      assert.ok(finance.includes(`${p.rent} ₺`));
    }
    for (const panel of [html, finance, world]) assert.doesNotMatch(panel, /undefined|NaN/);
    assert.ok(world.includes(String(view.institutions.credit)));
    assert.equal(exportGame(state), original, "presentation language cannot change saved state");
  }
});

test("populated family, estate and institutional records render without invented values", async () => {
  await loadExpansionRuntime();
  const view = getExpansionView(expandGame(createGame({ name: "Deniz", seed: 49 })));
  const parent = view.family.player, spouse = { id: "family:90", name: "Ada", parents: [], age: 30, died: null, retired: false }, child = { id: "family:91", name: "Ekin", parents: [parent.id, spouse.id], age: 7, died: null, retired: false };
  view.family.people.push(spouse, child);
  view.family.unions.push({ first: parent.id, second: spouse.id, status: "married" });
  view.family.household.children.push(child);
  view.economy.properties[0].mortgage = 23000;
  view.economy.properties[0].arrears = 800;
  Object.assign(view.economy.properties[0], { repairCost: 123, rentCashFlow: -456, leaseDueDay: 12, mortgageDueDay: 17, mortgagePayment: 678 });
  view.economy.business = { name: "Atölye", capital: 5000, stock: 4, workers: 2, revenue: 8000, costs: 6000, wageDue: 300, taxDue: 200, clients: 9, reputation: 55, wageRate: 220, overhead: 70 };
  view.institutions.illness = { severity: 30, since: 3 };
  view.institutions.regions.find(r => r.region === view.world.region).policy = "health";
  const render = (section, language) => renderExpansion({ view, actions: [], actionCard: () => "", sectionHeader: s => s, money: n => `${n} ₺`, esc: String, language, section });
  for (const language of ["tr", "en", "pl"]) {
    await selectLanguage(language);
    const family = render("family", language), finance = render("finance", language), world = render("world", language);
    assert.match(family, /href="#family:|href="#family-family:90"/);
    assert.match(family, /Ada/); assert.match(family, /Ekin/);
    assert.match(finance, /23000 ₺/); assert.match(finance, /800 ₺/); assert.match(finance, /2000 ₺/); assert.match(finance, /123 ₺/); assert.match(finance, /-456 ₺/); assert.match(finance, /678 ₺/); assert.match(finance, /220 ₺/);
    assert.match(world, /30/);
    for (const panel of [family, finance, world]) assert.doesNotMatch(panel, /undefined|NaN/);
  }
});

test("known archived events and course names are localized in the current view", async () => {
  await loadExpansionRuntime();
  const view = getExpansionView(expandGame(createGame({ name: "Deniz", seed: 49 })));
  view.institutions.program = { course: "finance", sessions: 1, requiredSessions: 4, grant: 0 };
  view.events = [
    { at: 0, type: "family-adoption", subject: view.family.player.id, detail: "Deniz evlat edinildi ve aileye katıldı." },
    { at: 0, type: "relocation", subject: "ankara", detail: "istanbul" },
    { at: 0, type: "migration", subject: "izmir", detail: "istanbul:2" },
    { at: 0, type: "education", subject: view.family.player.id, detail: "Eğitim kaydı açıldı." },
    { at: 0, type: "family-npc-birth", subject: "family-household:3", detail: "Maddi hazırlığı tamamlayan haneye bir çocuk katıldı." },
  ];
  for (const [language, expected] of [["en", ["Budget literacy", "was adopted", "From İstanbul", "2 people", "School enrolment confirmed", "financially prepared"]], ["pl", ["Podstawy budżetowania", "adopcj", "Z İstanbul", "2 osób", "Potwierdzono zapis", "przygotowanego finansowo"]]]) {
    await selectLanguage(language);
    const html = renderExpansion({ view, actions: [], actionCard: () => "", sectionHeader: () => "", money: String, esc: String, language, section: "world" });
    for (const value of expected) assert.ok(html.includes(value), value);
    assert.doesNotMatch(html, /undefined|NaN|family-household:3|Original-language record|Zapis w języku oryginału/);
  }
});

test("current regional shift and outcomes translate without changing source", async () => {
  await loadExpansionRuntime();
  let state = expandGame(createGame({ seed: 49 }));
  for (const id of ["event:welcome:work", "world:move:ankara", "district:visit:ankara:kizilay:work", "district:apply"]) {
    const result = resolveAction(state, id);
    assert.equal(result.ok, true, `${id}: ${result.message}`);
    state = result.state;
  }
  const legacy = getActions(state).find(a => a.id === "world:shift");
  assert.equal(legacy.disabled, true, "a second shift path cannot bypass the local contract");
  assert.equal(translateExpansionAction(legacy, "en").label, "Work a local shift");
  const action = getActions(state).find(a => a.id === "district:shift");
  assert.ok(action && !action.disabled);
  const original = { ...action }, translated = translateExpansionAction(action, "en");
  assert.equal(translated.label, "Contract shift");
  assert.match(translated.description, /Pay: \d+ TL/);
  assert.deepEqual(action, original);
  assert.equal(localizeExpansionOutcome("Yeni şehir: Ankara.", "en"), "New city: Ankara.");
  assert.match(localizeExpansionOutcome("Ekin ile tanıştın. Okul ve bakım seçenekleri artık aile ekranında.", "en"), /You met Ekin/);
  assert.match(localizeExpansionOutcome("Yeni şehir: Ankara.", "pl"), /Nowe miasto/);
});

test("family results preserve names, timing and balances in EN and PL", () => {
  const cases = [
    ["Evlilik başladı. Ayrı ve ortak bakiyeler kayıtta korunuyor.", "Personal and shared balances", "Osobiste i wspólne środki"],
    ["Ortak ev sözleşmesi kapandı, çocukların aile bağları korunuyor.", "Children's family ties", "Więzi rodzinne dzieci"],
    ["Boşanma kaydedildi.", "Divorce recorded", "Zapisano rozwód"],
    ["Aile birliği yeniden kuruldu.", "family reunited", "Rodzina znów"],
    ["Aile planı başladı. 24 oyun günü sonra çocuk haneye katılacak.", "24 game days", "24 dni gry"],
    ["250 TL aile bütçesine ayrıldı.", "250 TL", "250 TL"],
    ["Ödenmemiş aile giderinin bir bölümü kapatıldı.", "family arrears", "zaległości rodziny"],
    ["Emeklilik başladı. Aylık ödemeler banka hesabına yatırılacak.", "Monthly payments", "Miesięczne wypłaty"],
    ["Ekin $1 ile zaman geçirdin. Aile bağı güçlendi.", "Ekin $1 strengthened the family bond", "Ekin $1 wzmocnił więź"],
    ["Ekin $1 seçtiği eğitim alanında ilerledi.", "Ekin $1 progressed", "Ekin $1 robi postępy"],
    ["Ada $1 ile zaman geçirip aile desteğini güçlendirdin.", "Ada $1 strengthened family support", "Ada $1 wzmocnił wsparcie"],
    ["Ekin $1 ile aynı dünyada devam ediyorsun.", "same world as Ekin $1", "świecie jako Ekin $1"],
  ];
  for (const [source, en, pl] of cases) {
    assert.equal(localizeExpansionOutcome(source, "tr"), source);
    assert.ok(localizeExpansionOutcome(source, "en").includes(en), source);
    assert.ok(localizeExpansionOutcome(source, "pl").includes(pl), source);
  }
});

test("expansion-adapted Gold business action keeps its actual price, costs and revenue", async () => {
  await loadExpansionRuntime();
  let state = createGame({ scenario: "restart", seed: 303, expansion: true });
  state.bank = 120000;
  for (const id of ["business:start:repair", "business:fund:2000", "business:stock:6", "business:acquire"]) {
    while (state.pendingEvents.length) state = resolveAction(state, getActions(state).find(a => a.id.startsWith("event:") && !a.disabled).id).state;
    const result = resolveAction(state, id);
    assert.ok(result.ok, `${id}: ${result.message}`);
    state = result.state;
  }
  const action = getActions(state).find(a => a.id === "business:serve");
  assert.ok(action && !action.disabled, action?.reason);
  const amounts = action.description.match(/\d+/g);
  const original = { ...action };
  for (const [language, expected] of [["en", "customers at a list price"], ["pl", "klientów przy cenie"]]) {
    const translated = translateExpansionAction(action, language);
    assert.ok(translated.description.includes(expected));
    assert.deepEqual(translated.description.match(/\d+/g), amounts);
    assert.equal(translated.id, action.id);
    assert.equal(translated.run, action.run);
    assert.deepEqual(action, original);
  }
});

test("death screen distinguishes an eligible successor from a terminal family", async () => {
  await loadExpansionRuntime();
  const view = getExpansionView(expandGame(createGame({ seed: 49 })));
  view.family.player.died = 1;
  const render = (actions, language) => renderExpansion({ view, actions, actionCard: a => a.label, sectionHeader: () => "", money: String, esc: String, language, section: "family" });
  for (const [language, terminal, successor] of [["tr", "Yetişkin bir ardıl yok", "Uygun bir ardılla"], ["en", "No adult successor", "eligible heir"], ["pl", "Brak dorosłego następcy", "uprawnionym następcą"]]) {
    await selectLanguage(language);
    const ended = render([], language), continued = render([{ id: "family:successor:family:1", label: "Continue" }], language);
    assert.ok(ended.includes(terminal)); assert.match(ended, /data-ui="export"/);
    assert.ok(continued.includes(successor)); assert.doesNotMatch(continued, /data-ui="export"/);
  }
});

test("regional history identifies the household across succession and escapes captured names", async () => {
  await loadExpansionRuntime();
  const view = getExpansionView(expandGame(createGame({ seed: 49 })));
  view.economy.regions.ankara.residents[0].name = "Current head";
  view.events = [
    { at: 1440, type: "resident.hired", subject: "resident:ankara:0", detail: "Past employer" },
    { at: 2880, type: "resident.inheritance", subject: "resident:ankara:0", detail: "Previous head · Hane mirası devredildi." },
    { at: 4320, type: "family-marriage", subject: "family:90", detail: "<Ada> ve $1 evlendi." },
  ];
  const before = structuredClone(view);
  for (const [language, name] of [["tr", "Hane 1"], ["en", "Household 1"], ["pl", "Gospodarstwo 1"]]) {
    await selectLanguage(language);
    const html = renderExpansion({ view, actions: [], actionCard: () => "", sectionHeader: () => "", money: String, esc: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"), language, section: "world" });
    const history = html.slice(html.indexOf("<ol>"));
    assert.ok(history.includes(`Ankara · ${name}`));
    assert.doesNotMatch(history, /Current head|<Ada>/);
    assert.match(history, /&lt;Ada&gt;/);
    assert.match(history, /\$1/);
    assert.deepEqual(view, before);
  }
});
