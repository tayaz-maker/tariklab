import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
const dir = process.cwd() + "/public/games/tc-sim-boardworld/";
const { createGame, expandGame, loadExpansionRuntime, getActions } = await import(
  dir + "engine.mjs"
);
const { getExpansionView } = await import(dir + "expansion.mjs");
const { renderExpansion, localizeExpansionOutcome } = await import(dir + "expansion-ui.mjs");
const { chooseLanguage } = await import(dir + "i18n.mjs");
test("recovery preserves rendered expansion snapshots", async () => {
  await loadExpansionRuntime();
  let s = expandGame(createGame({ seed: 49, name: "Deniz" }));
  let v = getExpansionView(s);
  let out = {};
  let e = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  let samples = [["initial", v, getActions(s)]];
  let full = structuredClone(v);
  full.family.player.died = 1;
  full.family.people.push({
    id: "family:90",
    name: "<Ada>",
    parents: [full.family.player.id],
    age: 25,
    died: null,
    retired: false,
  });
  full.family.unions.push({ first: full.family.player.id, second: "family:90", status: "married" });
  full.family.household.children.push(full.family.people.at(-1));
  Object.assign(full.economy.properties[0], {
    mortgage: 23000,
    arrears: 800,
    repairCost: 123,
    rentCashFlow: -456,
    leaseDueDay: 12,
    mortgageDueDay: 17,
    mortgagePayment: 678,
  });
  full.economy.business = {
    name: "<Shop>",
    capital: 5000,
    stock: 4,
    workers: 2,
    revenue: 8000,
    costs: 6000,
    wageDue: 300,
    taxDue: 200,
    clients: 9,
    reputation: 55,
    wageRate: 220,
    overhead: 70,
  };
  full.institutions.illness = { severity: 30, since: 3 };
  full.institutions.program = { course: "finance", sessions: 1, requiredSessions: 4, grant: 0 };
  full.events = [
    {
      at: 0,
      type: "family-adoption",
      subject: "family:90",
      detail: "<Ada> evlat edinildi ve aileye katıldı.",
    },
    { at: 0, type: "migration", subject: "izmir", detail: "istanbul:2" },
    { at: 0, type: "education", subject: full.family.player.id, detail: "Eğitim kaydı açıldı." },
    { at: 0, type: "unknown", subject: "unknown", detail: "<legacy>" },
  ];
  samples.push(
    ["populated", full, []],
    [
      "heir",
      full,
      [{ id: "family:successor:family:90", label: "Continue", description: "x", reason: "" }],
    ],
  );
  for (const f of ["v7-ankara-family-day35.state.json", "v7-izmir-family-day40.state.json"]) {
    let path = "../release-save-fixtures/" + f;
    if (fs.existsSync(path)) {
      let state = JSON.parse(fs.readFileSync(path));
      samples.push([f, getExpansionView(state), getActions(state)]);
    }
  }
  const approvedCopy = [
    [
      "Yetişkin bir ardıl yok; bu yaşam sona erdi. Kaydı dışa aktarabilir veya menüden yeni yaşam başlatabilirsin.",
      "Yetişkin bir ardıl yok; bu karakterle oynanabilir yaşam sona erdi. Aile kaydını dışa aktarabilir veya menüden yeni bir yaşam başlatabilirsin.",
    ],
    [
      "No adult successor; this life has ended. Export the family save or start a new life from the menu.",
      "No adult successor is available; this life has ended. Export the family save or start a new life from the menu.",
    ],
    [
      "Brak dorosłego następcy; życie dobiegło końca. Eksportuj zapis rodziny lub rozpocznij nowe życie z menu.",
      "Brak dorosłego następcy; to życie dobiegło końca. Wyeksportuj zapis rodziny lub rozpocznij nowe życie z menu.",
    ],
    [
      "Your character died. Continue with an eligible heir.",
      "Your character died. You can continue with an eligible heir.",
    ],
    [
      "Postać zmarła. Kontynuuj z uprawnionym następcą.",
      "Twoja postać zmarła. Możesz kontynuować z uprawnionym następcą.",
    ],
    [
      "Dziecko dołączyło do przygotowanego finansowo gospodarstwa.",
      "Do przygotowanego finansowo gospodarstwa dołączyło dziecko.",
    ],
  ];
  // The simulation's reviewed e02444eb action-copy edits are normalized only
  // for these exact IDs, languages and descriptions. Other fields and all
  // unlisted text remain part of the original byte-for-byte snapshot.
  const actionCopy = [
    {
      lang: "tr",
      ids: ["institution:withdraw"],
      current: "Ücret iadesiz. Beceriler kalır.",
      previous: "Ücret iade edilmez; kazanılan beceriler kalır.",
    },
    {
      lang: "tr",
      ids: [
        "institution:petition:skills",
        "institution:petition:health",
        "institution:petition:housing",
      ],
      current: "Belediye başvuru ve bütçeyi üç günde inceler.",
      previous: "Belediye başvuruyu ve bütçeyi üç günde değerlendirir.",
    },
    {
      lang: "tr",
      ids: ["institution:publish"],
      current: "Doğrulanmış belediye sonucunu yayımla. Güven ve kamuoyu değişir.",
      previous: "Doğrulanmış belediye sonucunu yayımla; güven ve kamuoyu değişir.",
    },
    {
      lang: "tr",
      ids: ["institution:rent-aid"],
      current: "Belediye fonu kira borcunu doğrudan öder.",
      previous: "Belediye fonu doğrudan kira borcuna aktarılır.",
    },
    {
      lang: "tr",
      ids: ["world:move:istanbul", "world:move:izmir", "world:move:ankara"],
      current: "Taşınınca aile, borç ve mülk korunur.",
      previous: "Ailen, borçların ve mülklerin taşınma sonrasında devam eder.",
    },
    {
      lang: "tr",
      ids: ["world:meal"],
      current: "Yemek ücreti şehir fiyatlarına bağlı.",
      previous: "Yemek ücreti şehrin fiyat düzeyine göre değişir.",
    },
    {
      lang: "tr",
      ids: ["world:rest"],
      current: "Dinlenirken zaman ve rutinler ilerler.",
      previous: "Dinlenirken saat ve dünyanın rutinleri ilerler.",
    },
    {
      lang: "en",
      ids: [
        "institution:petition:skills",
        "institution:petition:health",
        "institution:petition:housing",
      ],
      current: "Council reviews petition and budget within three days.",
      previous: "The council reviews the petition and budget within three days.",
    },
    {
      lang: "en",
      ids: ["institution:publish"],
      current: "Publish a verified council result. Trust and opinion change.",
      previous: "Publish a verified council outcome; trust and opinion change.",
    },
    {
      lang: "en",
      ids: ["world:move:istanbul", "world:move:izmir", "world:move:ankara"],
      current: "Family, debts and property carry over.",
      previous: "Your family, debts and property carry over when you move.",
    },
    {
      lang: "en",
      ids: ["world:meal"],
      current: "Meal cost follows local prices.",
      previous: "The meal price reflects the city's price index.",
    },
    {
      lang: "en",
      ids: ["world:rest"],
      current: "Time and world routines advance while you rest.",
      previous: "Time and the world's routines advance while you rest.",
    },
    {
      lang: "pl",
      ids: ["institution:rent-aid"],
      current: "Fundusz rady spłaca zaległy czynsz bezpośrednio.",
      previous: "Fundusz rady bezpośrednio spłaca zaległy czynsz.",
    },
    {
      lang: "pl",
      ids: ["world:meal"],
      current: "Koszt posiłku zależy od cen w mieście.",
      previous: "Cena posiłku zależy od poziomu cen w mieście.",
    },
    {
      lang: "pl",
      ids: ["world:rest"],
      current: "Odpoczynek przesuwa czas i rutyny świata.",
      previous: "Podczas odpoczynku płynie czas, a świat żyje swoim rytmem.",
    },
  ];
  function snapshotAction(action, language) {
    let description = action.description;
    const entry = actionCopy.find(
      (row) => row.lang === language && row.ids.includes(action.id) && row.current === description,
    );
    if (entry) description = entry.previous;
    // a0679fd4 moves only amounts already shown in the card's cost field out
    // of descriptions. Match the complete approved wording and reconstruct
    // the baseline with the same authoritative cost; no value is discarded.
    if (action.id.startsWith("economy:buy:")) {
      const copy = {
        tr: ["Tapu bedeli.", `Tapu bedeli ${action.cost} TL.`],
        en: ["Purchase price.", `Purchase price: ${action.cost} TL.`],
        pl: ["Cena zakupu.", `Cena zakupu: ${action.cost} TL.`],
      }[language];
      if (description === copy[0]) description = copy[1];
    }
    if (action.id.startsWith("economy:mortgage:")) {
      const compact = {
        tr: [
          "Bedel peşinattır. Aylık %0,8 faiz, %4 anapara. Üç ödenmeyen taksitte tasfiye riski.",
          `Peşinat ${action.cost} TL. Aylık %0,8 faiz ve %4 anapara; üç kaçan vade tasfiye riski yaratır.`,
        ],
        en: [
          "Cost is the deposit. Monthly: 0.8% interest, 4% principal. Three missed payments risk foreclosure.",
          `Deposit: ${action.cost} TL. Monthly 0.8% interest and 4% principal. Three missed payments risk foreclosure.`,
        ],
        pl: [
          "Koszt to wkład własny. Miesięcznie: 0,8% odsetek, 4% kapitału. Po 3 zaległościach grozi przejęcie.",
          `Wkład własny: ${action.cost} TL. Co miesiąc 0,8% odsetek i 4% kapitału. Trzy zaległości grożą przejęciem.`,
        ],
      }[language];
      if (description === compact[0]) description = compact[1];
      const templates = {
        tr: [
          /^Peşinat (\d+) TL\. Aylık %0,8 faiz, %4 anapara\. Üç ödenmeyen taksitte tasfiye riski\.$/,
          "Peşinat $1 TL. Aylık %0,8 faiz ve %4 anapara; üç kaçan vade tasfiye riski yaratır.",
        ],
        en: [
          /^Deposit: (\d+) TL\. Monthly: 0\.8% interest, 4% principal\. Three missed payments risk foreclosure\.$/,
          "Deposit: $1 TL. Monthly 0.8% interest and 4% principal. Three missed payments risk foreclosure.",
        ],
        pl: [
          /^Wkład własny: (\d+) TL\. Miesięcznie: 0,8% odsetek, 4% kapitału\. Po 3 zaległościach grozi przejęcie\.$/,
          "Wkład własny: $1 TL. Co miesiąc 0,8% odsetek i 4% kapitału. Trzy zaległości grożą przejęciem.",
        ],
      };
      const [pattern, previous] = templates[language];
      const match = pattern.exec(description);
      if (match) {
        assert.equal(Number(match[1]), action.cost, "mortgage deposit stays authoritative");
        description = description.replace(pattern, previous);
      }
    }
    return JSON.stringify({ ...action, description });
  }
  for (let language of ["tr", "en", "pl"]) {
    await chooseLanguage(language);
    const expectedTravelOutcome = {
      tr: "Yolculuk tamamlandı.",
      en: "Journey completed.",
      pl: "Podróż zakończona.",
    };
    assert.equal(
      localizeExpansionOutcome("Yolculuk tamamlandı.", language),
      expectedTravelOutcome[language],
    );
    for (let [name, view, actions] of samples)
      for (let section of ["family", "finance", "world"]) {
        let html = renderExpansion({
          view,
          actions,
          actionCard: (a) => snapshotAction(a, language),
          sectionHeader: (x) => `<h1>${e(x)}</h1>`,
          money: (n) => `[${n}]`,
          esc: e,
          language,
          section,
        });
        if (name === "populated" && section === "family") {
          assert.ok(html.includes("&lt;Ada&gt;"), "family names remain escaped");
          assert.ok(!html.includes("<Ada>"));
        }
        if (name === "populated" && section === "finance") {
          assert.ok(html.includes("&lt;Shop&gt;"), "business names remain escaped");
          assert.ok(!html.includes("<Shop>"));
        }
        if (name === "populated" && section === "world") {
          assert.ok(html.includes("&lt;legacy&gt;"), "archived event text remains escaped");
          assert.ok(!html.includes("<legacy>"));
        }
        for (const [current, previous] of approvedCopy) html = html.replaceAll(current, previous);
        out[`${language}/${name}/${section}`] = createHash("sha256").update(html).digest("hex");
      }
  }
  // Reviewed LW2 changes:31 districts, connected routes, funded territory,
  // contextual property eligibility and compact organization/property sections.
  // Full action fields, family output and escaped content remain snapshotted.
  const expected = {
    "tr/initial/family": "8a4a64b0ad91daf0cb8762dabef571f0de6b89f406f83af0b5701e6c44ec6007",
    "tr/initial/finance": "593453d9ec9c4ed1fd4c1a36062f88ffaa27329484ea0e22e41bd0ec61c21248",
    "tr/initial/world": "0df4bdb03a48f5b7529fa3cfb467bd9fc8f8de6fba8d0a5885c701867239102d",
    "tr/populated/family": "8d05f4bb0069161dfe559309d4847262d0ee88133a271cedd354b94f011717ce",
    "tr/populated/finance": "6d9fccbedba05dee64eeba03e87a776f4b7bdc55449e4b30653175993d30812c",
    "tr/populated/world": "2a42a38be23c54249aad5a2dba3ff18cce12eb434aa2277c3c648e034fd15377",
    "tr/heir/family": "f11eb8c0b90f31a933909e121d05e8216c7a84a29787812def084b811a506642",
    "tr/heir/finance": "6d9fccbedba05dee64eeba03e87a776f4b7bdc55449e4b30653175993d30812c",
    "tr/heir/world": "2a42a38be23c54249aad5a2dba3ff18cce12eb434aa2277c3c648e034fd15377",
    "en/initial/family": "754fed20538784efde0bc97846c4fe5d04ee5fd3e3bb81c98cdb834ad153fd29",
    "en/initial/finance": "c36fd92520cd063ccf9dc61aaa5547d545520c1be196e6038b786b280902bb1a",
    "en/initial/world": "4d6d533ebb34e98a06d7cc17e9443b3dd636959da4e8bd1aaa6355b0245cb9fa",
    "en/populated/family": "3535f467513aa9b4eea9912f0203bfb291537c8814a3610eca843b50ec15c16a",
    "en/populated/finance": "dc117a030df2e8284ad371502e5bc449d570f1a0504eec6d1e181193f84fba00",
    "en/populated/world": "d416fcfbf51ef0c36a61957ef9092c98d67a05530b1f4e333fce2738ec6229fd",
    "en/heir/family": "7e7554fd47a7b97a393c286b52352ee0a408f5fc7964b73306de155ca092b5ea",
    "en/heir/finance": "dc117a030df2e8284ad371502e5bc449d570f1a0504eec6d1e181193f84fba00",
    "en/heir/world": "d416fcfbf51ef0c36a61957ef9092c98d67a05530b1f4e333fce2738ec6229fd",
    "pl/initial/family": "146f825c308b5e048a7bcead9fe1e641d777062063b6a9e675f879e557394217",
    "pl/initial/finance": "083b45a89a6bbc0f3636cca48e8a66edfe11f88de00fa6c5bbb5f4ae35ab6e94",
    "pl/initial/world": "0780768e85c6c2da3f8ed1ad41a50afd06724911c19b3955df3d0d1ea55d7f46",
    "pl/populated/family": "bd8145681ee28e0b41f18600ea70e9449260d69e965a4a61ba4aba0e0421db4a",
    "pl/populated/finance": "a2700e0eb5024fe833a077e529afdaf8857ba38cbe30c1c1edcbf5fabf240284",
    "pl/populated/world": "1819f86a9424d8086a01fe401a732d6c96399f16bd2c72ce423db6a94e6a3937",
    "pl/heir/family": "00cfa7f37ca3d9113832b18e4fff775f48783e17057c0817e088eb39292513f2",
    "pl/heir/finance": "a2700e0eb5024fe833a077e529afdaf8857ba38cbe30c1c1edcbf5fabf240284",
    "pl/heir/world": "1819f86a9424d8086a01fe401a732d6c96399f16bd2c72ce423db6a94e6a3937"
};
  for (const [name, digest] of Object.entries(out)) assert.equal(digest, expected[name], name);
});
