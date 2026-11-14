import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGame,
  getActions,
  loadExpansionRuntime,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { renderExpansion } from "../public/games/tc-sim-boardworld/expansion-ui.mjs";
import { chooseLanguage, getLanguage, t } from "../public/games/tc-sim-boardworld/i18n.mjs";
import { exportGame } from "../public/games/tc-sim-boardworld/persistence.mjs";

const { getExpansionView } = await loadExpansionRuntime();
const languages = ["tr", "en", "pl"];
const maliciousName = "<svg onload=alert(1)>";
const olderName = "<img src=x onerror=alert(2)>";
const escapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => escapes[character]);
const removeTags = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const money = (amount) => `${amount} ₺`;
const day = (state) => Math.floor(state.time / 1440) + 1;
const translate = (language, labels) =>
  typeof labels === "string" ? labels : labels[languages.indexOf(language)];
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function fact(html, label, value) {
  // A label and its authoritative value may be separated by tags or punctuation.
  const text = removeTags(html);
  const pattern = new RegExp(
    `${escapeRegex(escape(label))}\\s*[:·–]??\\s*${escapeRegex(value)}(?![\\d.,])`,
  );
  assert.match(text, pattern, `expected ${label} with value ${value}`);
}

function section(state, language, name) {
  const actions = getActions(state);
  const cards = new Map();
  const html = renderExpansion({
    view: getExpansionView(state),
    actions,
    actionCard(action) {
      assert.ok(
        actions.some(({ id }) => action.id === id),
        `invented action ${action.id}`,
      );
      assert.equal(cards.has(action.id), false, `duplicate action ${action.id}`);
      cards.set(action.id, action);
      // The production app supplies the action card renderer. Assert which real
      // descriptors this section hands off rather than freezing its surrounding layout.
      return `<button data-action="${escape(action.id)}" ${action.disabled ? "disabled" : ""}>${escape(action.label)}</button>`;
    },
    sectionHeader: (region) => `<h2>${escape(region)}</h2>`,
    money,
    esc: escape,
    language,
    section: name,
  });
  assert.doesNotMatch(html, /undefined|NaN|<svg onload=|<img src=x onerror=/);
  return { html, cards };
}

function apply(state, id) {
  const result = resolveAction(state, id);
  assert.ok(result.ok, `${id}: ${result.message}`);
  return result.state;
}

function whenAvailable(state, id) {
  for (let attempt = 0; attempt < 48; attempt++) {
    const actions = getActions(state);
    const event = actions.find((action) => action.id.startsWith("event:") && !action.disabled);
    if (event) {
      state = apply(state, event.id);
      continue;
    }
    if (actions.some((action) => action.id === id && !action.disabled)) return apply(state, id);
    state = apply(state, "wait:60");
  }
  assert.fail(`Action never became available: ${id}`);
}

function populatedState() {
  let state = createGame({ expansion: true, scenario: "restart", seed: 303, name: maliciousName });
  state.bank = 160000;
  state.debt = 0;
  state.flags.partner = "mert";
  Object.assign(state.npcs.mert, { affinity: 75, trust: 75, romance: 65 });
  while (state.pendingEvents.length) {
    const option = getActions(state).find(
      ({ id, disabled }) => id.startsWith("event:") && !disabled,
    );
    state = apply(state, option.id);
  }
  for (const action of [
    "family:marry",
    "world:move:ankara",
    "district:visit:ankara:kizilay:housing",
    "economy:mortgage:ankara:room",
    "economy:let:ankara:room",
    "district:visit:ankara:cankaya:housing",
    "economy:rent:ankara:studio",
    "family:reserve",
    "family:adopt",
    "business:start:repair",
    "business:fund:2000",
    "economy:hire",
    "business:stock:6",
    "business:acquire",
  ])
    state = whenAvailable(state, action);

  // Start from real transactions, then set valid persisted values for rare
  // concurrent conditions whose visible amounts must remain distinct.
  state.expansion.family.arrears = 286;
  state.expansion.economy.properties["ankara:room"].lease.arrears = 131;
  Object.assign(state.expansion.economy.business, { wageDue: 357, taxDue: 219 });
  Object.assign(state.deep.business, { revenue: 6429, costs: 4911, arrears: 317 });
  const institutions = state.expansion.institutions;
  Object.assign(institutions.regions.ankara, {
    policy: "health",
    policyUntil: day(state) + 22,
    trust: 67,
    treasury: 18571,
  });
  Object.assign(institutions, {
    credit: 64,
    program: {
      course: "finance",
      region: "ankara",
      sessions: 1,
      lastStudyDay: day(state),
      grant: 763,
    },
    illness: { severity: 38, since: 1 },
    case: {
      region: "ankara",
      owner: state.expansion.playerId,
      amount: 629,
      penalty: 317,
      openedDay: 1,
      decided: true,
      reviewed: false,
      overdue: false,
    },
  });
  state.expansion.events.push({
    id: state.expansion.nextEvent++,
    at: state.time,
    type: "resident.inheritance",
    subject: "resident:ankara:0",
    detail: `${olderName} · Hane mirası devredildi.`,
  });
  assert.ok(validateState(state));
  return state;
}

function expectCards(cards, ...ids) {
  for (const id of ids) assert.ok(cards.has(id), `expected available control ${id}`);
}

function familyFacts(html, state, language) {
  const { family } = getExpansionView(state);
  assert.ok(html.includes(escape(maliciousName)), "player name remains escaped text");
  assert.ok(removeTags(html).includes("Mert Aksoy"));
  const [child] = family.household.children;
  assert.ok(child && removeTags(html).includes(child.name), "dependent child shown");
  assert.ok(removeTags(html).includes(translate(language, ["Çocuk", "Child", "Dziecko"])));
  assert.ok(removeTags(html).includes(translate(language, ["Evli", "Married", "Małżeństwo"])));
  assert.ok(
    removeTags(html).includes(translate(language, ["Hanede", "In household", "W gospodarstwie"])),
  );
  for (const person of family.people) {
    assert.ok(html.includes(escape(person.name)), `missing ${person.id}`);
    for (const id of person.parents) {
      assert.ok(html.includes(`href="#family-${id}"`), `missing parent link to ${id}`);
      assert.ok(html.includes(`id="family-${id}"`), `parent link target missing for ${id}`);
    }
  }
  assert.ok(html.includes('href="#family-npc:mert"'), "spouse is linked to the family tree");
  fact(
    html,
    translate(language, ["Hane birikimi", "Household reserve", "Oszczędności gospodarstwa"]),
    money(family.household.reserve),
  );
  fact(
    html,
    translate(language, ["Hane borcu", "Household arrears", "Zaległości gospodarstwa"]),
    money(family.household.arrears),
  );
}

function financeFacts(html, state, language) {
  const { economy } = getExpansionView(state);
  const owned = economy.properties.find(({ id }) => id === "ankara:room");
  const rented = economy.properties.find(({ id }) => id === "ankara:studio");
  assert.ok(owned.mortgage > 0 && owned.leaseDueDay && owned.rentCashFlow > 0);
  assert.ok(rented.leaseDueDay && rented.rentCashFlow < 0);
  const flags = [
    [
      ["Sahiplik", "Owner", "Własność"],
      translate(language, ["Haneye ait", "Household owned", "Własność gospodarstwa"]),
    ],
    [["Değer", "Value", "Wartość"], money(owned.value)],
    [["Durum", "Condition", "Stan"], `${owned.condition}%`],
    [t("Kira"), money(owned.rent)],
    [["Kredi", "Mortgage", "Hipoteka"], money(owned.mortgage)],
    [["Gecikme", "Arrears", "Zaległości"], money(owned.arrears)],
    [["Onarım maliyeti", "Repair cost", "Koszt naprawy"], money(owned.repairCost)],
    [
      ["Sözleşmeye göre kira akışı", "Contractual rent cash flow", "Przepływ czynszu według umowy"],
      money(owned.rentCashFlow),
    ],
    [
      ["Sözleşmeye göre kira akışı", "Contractual rent cash flow", "Przepływ czynszu według umowy"],
      money(rented.rentCashFlow),
    ],
    [["Kira günü", "Rent due day", "Termin czynszu"], owned.leaseDueDay],
    [
      ["Kredi taksiti", "Mortgage payment", "Rata hipoteki"],
      `${money(owned.mortgagePayment)} / ${owned.mortgageDueDay}`,
    ],
  ];
  for (const [labels, value] of flags) fact(html, translate(language, labels), value);
  const b = economy.business;
  assert.ok(removeTags(html).includes(b.name), "the actual enterprise is named");
  const company = [
    [t("İşletme kasası"), money(b.capital)],
    [["Stok", "Stock", "Zapasy"], b.stock],
    [["Çalışan", "Employees", "Pracownicy"], b.workers],
    [["Gelir", "Revenue", "Przychód"], money(b.revenue)],
    [["Gider", "Costs", "Koszty"], money(b.costs)],
    [["Kâr", "Profit", "Zysk"], money(b.revenue - b.costs)],
    [["Maaş borcu", "Wages due", "Zaległe płace"], money(b.wageDue)],
    [["Vergi borcu", "Tax due", "Zaległy podatek"], money(b.taxDue)],
    [t("Müşteri"), b.clients],
    [["İtibar", "Reputation", "Reputacja"], b.reputation],
    [
      ["Çalışan vardiya ücreti", "Wage per worker shift", "Płaca za zmianę pracownika"],
      money(b.wageRate),
    ],
    [
      ["Birikmiş sabit gider borcu", "Accrued overhead arrears", "Zaległe koszty stałe"],
      money(b.overhead),
    ],
  ];
  for (const [labels, value] of company) fact(html, translate(language, labels), value);
}

function worldFacts(html, state, language) {
  const { world, economy, institutions } = getExpansionView(state);
  const office = institutions.regions.find(({ region }) => region === world.region);
  const terms = [
    [["Kredi durumu", "Credit score", "Ocena kredytowa"], institutions.credit],
    [["Kamu güveni", "Public trust", "Zaufanie publiczne"], `${office.trust}%`],
    [["Yerel bütçe", "Local budget", "Budżet lokalny"], money(office.treasury)],
    [["Burs", "Grant", "Stypendium"], money(institutions.program.grant)],
    [["Şiddet", "Severity", "Nasilenie"], institutions.illness.severity],
    [["Başlangıç günü", "Since day", "Od dnia"], institutions.illness.since],
    [["Güncel politika", "Active policy", "Aktywna polityka"], t("Sağlık")],
    [["Bitiş günü", "Until day", "Do dnia"], office.policyUntil],
    [["Açık dosya", "Open case", "Otwarta sprawa"], money(institutions.investigation.total)],
  ];
  for (const [labels, value] of terms) fact(html, translate(language, labels), value);
  assert.ok(
    removeTags(html).includes(
      translate(language, ["Bütçe okuryazarlığı", "Budget literacy", "Podstawy budżetowania"]),
    ),
  );
  assert.ok(
    removeTags(html).includes(
      `${institutions.program.sessions}/${institutions.program.requiredSessions}`,
    ),
  );
  for (const [id, name] of Object.entries({
    istanbul: "İstanbul",
    ankara: "Ankara",
    izmir: "İzmir",
  })) {
    const region = world.regions[id];
    assert.ok(removeTags(html).includes(name));
    fact(html, translate(language, ["Nüfus", "Population", "Ludność"]), region.population);
    fact(
      html,
      translate(language, ["İstihdam endeksi", "Employment index", "Indeks zatrudnienia"]),
      region.employment,
    );
    fact(html, translate(language, ["Fiyat endeksi", "Price index", "Indeks cen"]), region.price);
    fact(
      html,
      translate(language, ["Ortalama fiyat", "Average price", "Średnia cena"]),
      money(economy.regions[id].averagePrice),
    );
    for (const resident of economy.regions[id].residents) {
      const employment =
        resident.employment === "employed"
          ? translate(language, ["Çalışıyor", "Employed", "Pracuje"])
          : resident.employment === "retired"
            ? translate(language, ["Emekli", "Retired", "Na emeryturze"])
            : t("İş arıyor");
      assert.ok(removeTags(html).includes(resident.name));
      assert.ok(removeTags(html).includes(employment), "resident employment is presented");
      fact(html, t("Sağlık"), resident.health);
      fact(html, t("Nakit"), money(resident.cash));
      fact(html, t("Borç"), money(resident.debt));
    }
    for (const firm of economy.regions[id].firms) {
      assert.ok(removeTags(html).includes(firm.name));
      fact(html, translate(language, ["Çalışan", "Workers", "Pracownicy"]), firm.workers);
      fact(html, translate(language, ["Gelir", "Revenue", "Przychód"]), money(firm.revenue));
      fact(html, translate(language, ["Gider", "Costs", "Koszty"]), money(firm.costs));
    }
  }
  assert.ok(html.includes(escape(olderName)), "historical actor is preserved and escaped");
  assert.ok(
    removeTags(html).includes(
      translate(language, [
        "Hane mirası devredildi",
        "Household estate passed to an heir",
        "Spadek po gospodarstwie przejął następca",
      ]),
    ),
  );
  assert.ok(
    removeTags(html).includes(translate(language, ["Hane 1", "Household 1", "Gospodarstwo 1"])),
  );
}

test("selected sections render current family, property, business, institution and history facts in all locales", async () => {
  const state = populatedState();
  const checkpoint = exportGame(state);
  for (const language of languages) {
    await chooseLanguage(language);
    assert.equal(getLanguage(), language);
    const family = section(state, language, "family");
    const finance = section(state, language, "finance");
    const world = section(state, language, "world");
    familyFacts(family.html, state, language);
    financeFacts(finance.html, state, language);
    worldFacts(world.html, state, language);
    expectCards(family.cards, "family:reserve", "family:arrears", "family:care:family:3");
    expectCards(
      finance.cards,
      "economy:repay:ankara:room",
      "economy:leave:ankara:studio",
      "economy:hire",
    );
    expectCards(
      world.cards,
      "institution:study",
      "institution:clinic",
      "institution:fine",
      "world:move:izmir",
      "district:visit:ankara:cankaya:work",
    );
    const recruitment = [...world.cards.values()].filter(({ id }) =>
      id.startsWith("underworld:recruit:"),
    );
    assert.equal(recruitment.length, 2, "both local organizations expose recruitment");
    assert.ok(recruitment.every(({ disabled }) => disabled), "recruitment requires a social venue");
    for (const id of family.cards.keys()) assert.ok(id.startsWith("family:"));
    for (const id of finance.cards.keys()) assert.ok(id.startsWith("economy:"));
    for (const id of world.cards.keys()) assert.match(id, /^(institution|world|district|underworld):/);
    assert.equal(exportGame(state), checkpoint, "rendering any section is read-only");
  }
});

test("living, inherited and terminal family states expose only authoritative continuation controls", async () => {
  const state = populatedState();
  const dayNow = day(state);
  const family = state.expansion.family;
  const founder = family.people.find(({ id }) => id === state.expansion.playerId);
  const sibling = family.people.find(({ id }) => id === "family:2");
  founder.died = dayNow;
  family.unions[0].status = "widowed";
  family.unions[0].changed = dayNow;
  delete state.flags.partner;
  assert.ok(validateState(state));
  const continuing = `family:successor:${sibling.id}`;
  const inherited = apply(state, continuing);
  const nextView = getExpansionView(inherited);
  assert.equal(nextView.family.lastEstate.to, sibling.id);
  assert.equal(nextView.family.lastEstate.from, founder.id);
  const terminal = structuredClone(state);
  terminal.expansion.family.people.find(({ id }) => id === sibling.id).died = dayNow;
  assert.ok(validateState(terminal));

  for (const language of languages) {
    await chooseLanguage(language);
    const next = section(state, language, "family");
    const end = section(terminal, language, "family");
    const heir = section(inherited, language, "family");
    const history = section(inherited, language, "world");
    expectCards(next.cards, continuing);
    assert.equal(next.cards.size, 1);
    assert.equal(end.cards.size, 0);
    assert.match(end.html, /data-ui="export"/);
    assert.doesNotMatch(next.html, /data-ui="export"/);
    assert.ok(
      removeTags(next.html).includes(
        translate(language, ["ardıl", "eligible heir", "uprawnionym następcą"]),
      ),
    );
    assert.ok(
      removeTags(end.html).includes(
        translate(language, ["ardıl yok", "No adult successor", "Brak dorosłego następcy"]),
      ),
    );
    assert.ok(removeTags(heir.html).includes(sibling.name));
    assert.ok(heir.html.includes(escape(founder.name)), "former life remains in tree");
    assert.ok(removeTags(heir.html).includes(translate(language, ["Ölüm", "Deceased", "Zmarły"])));
    assert.ok(
      removeTags(heir.html).includes(translate(language, ["Dul", "Widowed", "Wdowieństwo"])),
    );
    assert.ok(
      removeTags(history.html).includes(
        translate(language, [
          "mirasını ve borçlarını devraldı",
          "inherited the family estate and debts",
          "dziedziczy majątek i długi rodziny",
        ]),
      ),
    );
  }
});

test("unopened enterprise, cleared institutions and retirement do not show active-only facts", async () => {
  const state = createGame({ name: "Meral", scenario: "restart", seed: 49, expansion: true });
  const person = state.expansion.family.people.find(({ id }) => id === state.expansion.playerId);
  const parent = state.expansion.family.people.find(({ id }) => id === person.parents[0]);
  person.born = 1 - 62 * 30;
  parent.born = person.born - 24 * 30;
  person.retired = true;
  assert.ok(validateState(state));

  for (const language of languages) {
    await chooseLanguage(language);
    const family = section(state, language, "family");
    const finance = section(state, language, "finance");
    const world = section(state, language, "world");
    assert.ok(
      removeTags(family.html).includes(translate(language, ["Emekli", "Retired", "Emerytura"])),
    );
    assert.doesNotMatch(family.html, /data-ui="export"/);
    assert.equal(family.cards.has("family:retire"), false);
    for (const [html, labels] of [
      [finance.html, ["Maaş borcu", "Wages due", "Zaległe płace"]],
      [finance.html, ["Kira günü", "Rent due day", "Termin czynszu"]],
      [world.html, ["Sağlık takibi", "Active health issue", "Aktualny problem zdrowotny"]],
      [world.html, ["Güncel politika", "Active policy", "Aktywna polityka"]],
      [world.html, ["Açık dosya", "Open case", "Otwarta sprawa"]],
    ])
      assert.ok(!removeTags(html).includes(translate(language, labels)), "hidden absent record");
  }
});
