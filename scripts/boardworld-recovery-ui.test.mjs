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
        for (const [current, previous] of approvedCopy) html = html.replaceAll(current, previous);
        out[`${language}/${name}/${section}`] = createHash("sha256").update(html).digest("hex");
      }
  }
  const expected = {
    "tr/initial/family": "8a4a64b0ad91daf0cb8762dabef571f0de6b89f406f83af0b5701e6c44ec6007",
    "tr/initial/finance": "67e0a9ba9e07d66daf03a02f344dd91e332b30bef4279af76308747243862991",
    "tr/initial/world": "74c4c3056f398cb874b8abcbe5c38ad6476d385a0a4b133631236a81412d8ad5",
    "tr/populated/family": "8d05f4bb0069161dfe559309d4847262d0ee88133a271cedd354b94f011717ce",
    "tr/populated/finance": "750b3ec668cd600478e8cb1672f758ccc6e2ee8c4788c6eee1ddbd063aab1757",
    "tr/populated/world": "d84a2e5d2adc0b26768f284a736f547d718ae746fb32412425f37c6a6752dade",
    "tr/heir/family": "f11eb8c0b90f31a933909e121d05e8216c7a84a29787812def084b811a506642",
    "tr/heir/finance": "750b3ec668cd600478e8cb1672f758ccc6e2ee8c4788c6eee1ddbd063aab1757",
    "tr/heir/world": "d84a2e5d2adc0b26768f284a736f547d718ae746fb32412425f37c6a6752dade",
    "tr/v7-ankara-family-day35.state.json/family":
      "52c61da08cbdd1b1b6b8bd19d982d8c7583a84ce523adb5fcf7ed9399725be81",
    "tr/v7-ankara-family-day35.state.json/finance":
      "8725b0c04cb7555bead17104103c8f4ab0d08ffc49c240d45afb93d47cc703b1",
    "tr/v7-ankara-family-day35.state.json/world":
      "4c9fca00881636709a47dec51e57506e7d623f0dd7a5298df1ed3cfc76e2523a",
    "tr/v7-izmir-family-day40.state.json/family":
      "677f0a470b26a13f23fd64ad1d233ee6050c2e36e043dd7bc46e737c53294c18",
    "tr/v7-izmir-family-day40.state.json/finance":
      "69418eb2ce5d5e4f60b1af67df007587166b913f4f8d391c1a587a7df85df7e6",
    "tr/v7-izmir-family-day40.state.json/world":
      "025444d941bb106eb5f4266d273b82c63e0a6a967e7fcf9e282ca69ebb8972e0",
    "en/initial/family": "754fed20538784efde0bc97846c4fe5d04ee5fd3e3bb81c98cdb834ad153fd29",
    "en/initial/finance": "86f0db948532713411415a1240ffbc55078f0b122522c2a0a819e6c68d1edd65",
    "en/initial/world": "3b63d2c09c6ff5e85cac98037d0fe51191addac0d22443a41ec800f20bd1e189",
    "en/populated/family": "3535f467513aa9b4eea9912f0203bfb291537c8814a3610eca843b50ec15c16a",
    "en/populated/finance": "d2e8440bc785b0065b784cd7f39d06faecd0c6205065dd0d4f25f45f94f78321",
    "en/populated/world": "14ebb8f18539d3327c318f531b0bcd7ac1166b4056722aedf29c68da8736bb6a",
    "en/heir/family": "7e7554fd47a7b97a393c286b52352ee0a408f5fc7964b73306de155ca092b5ea",
    "en/heir/finance": "d2e8440bc785b0065b784cd7f39d06faecd0c6205065dd0d4f25f45f94f78321",
    "en/heir/world": "14ebb8f18539d3327c318f531b0bcd7ac1166b4056722aedf29c68da8736bb6a",
    "en/v7-ankara-family-day35.state.json/family":
      "da48c48586846bc7c6217932414b7abda30fd8c5d93382f5690670aebc8b08a2",
    "en/v7-ankara-family-day35.state.json/finance":
      "9bc66ab51cadc589f91c963334c238f391ba08d80ed5be3d25536b66dea725ba",
    "en/v7-ankara-family-day35.state.json/world":
      "0fb6ff6fd2c14d42b473d543634be5c48bf624cbc2489d13b13e020979936690",
    "en/v7-izmir-family-day40.state.json/family":
      "20ace6482d69d4b4b81fbef061c425c5e4a3f222462482c595cc25368d3f3b04",
    "en/v7-izmir-family-day40.state.json/finance":
      "4530861135a07cf988045baefc95cdf14baf14be9168a42eb076eac35d84c2e5",
    "en/v7-izmir-family-day40.state.json/world":
      "61b2bb371207e485d0f32e89141552fe821fdc002fabf59df0b24de0eed93b40",
    "pl/initial/family": "146f825c308b5e048a7bcead9fe1e641d777062063b6a9e675f879e557394217",
    "pl/initial/finance": "f7444e5ca31ae5989372ea395ce90dbefbf5ba147ae7624ba41e94f96b6569f1",
    "pl/initial/world": "90b546756c33a1336aa39bf6d5d175638ce8b293d8a17d8660399af8aa29cb31",
    "pl/populated/family": "bd8145681ee28e0b41f18600ea70e9449260d69e965a4a61ba4aba0e0421db4a",
    "pl/populated/finance": "656b9565db79be1e1fc0796399e164dbc7bd77016878e18fdebfcfb17e0ab75a",
    "pl/populated/world": "3ea85e3aca5c66c9009a9041a9de9c1d10083c12569ad6b05c4ab379e5b02000",
    "pl/heir/family": "00cfa7f37ca3d9113832b18e4fff775f48783e17057c0817e088eb39292513f2",
    "pl/heir/finance": "656b9565db79be1e1fc0796399e164dbc7bd77016878e18fdebfcfb17e0ab75a",
    "pl/heir/world": "3ea85e3aca5c66c9009a9041a9de9c1d10083c12569ad6b05c4ab379e5b02000",
    "pl/v7-ankara-family-day35.state.json/family":
      "4945df85d41d49e016bc97ca4aa7e6e13289b2bf6475fe4e4faaa576289000ce",
    "pl/v7-ankara-family-day35.state.json/finance":
      "62f1f2d20f29bf8005814872d9901edb7956fe67806cad73d02d7c38604a3814",
    "pl/v7-ankara-family-day35.state.json/world":
      "7550d4379f6f25211c07708479762dc8a0af2f4e8d3fef0df7b7d125dc437e16",
    "pl/v7-izmir-family-day40.state.json/family":
      "c77177e9d635a03466236ed77ddc7d076ba78849680a61f5840a37fce7a4b902",
    "pl/v7-izmir-family-day40.state.json/finance":
      "ea263dc3745979655a216fe65acca3d57a25ce8432a2c3ebf4284f501da99cf0",
    "pl/v7-izmir-family-day40.state.json/world":
      "c1fd2d2e66248a8cc965ed75f6b447bb85ed75cb3f34c39324ed8f629c277838",
  };
  for (const [name, digest] of Object.entries(out)) assert.equal(digest, expected[name], name);
});
