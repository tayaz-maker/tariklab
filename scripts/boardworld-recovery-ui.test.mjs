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
  // Reviewed against living-safety-base: family output remains byte-for-byte
  // unchanged. Finance changes district-priced rent/value quotes and housing
  // office eligibility; world adds districts, organizations and local action
  // requirements. Full action fields and escaped content remain snapshotted.
  const expected = {
    "tr/initial/family": "8a4a64b0ad91daf0cb8762dabef571f0de6b89f406f83af0b5701e6c44ec6007",
    "tr/initial/finance": "10422d11a46b50eaf9e9ac8189d5aa7b5608bae25bfbdb62c6a9f0a7fea9a61e",
    "tr/initial/world": "0a2b73315cde500d8cc0c04c8d0ff2d9e59e122c91c303c747cb514816e13a32",
    "tr/populated/family": "8d05f4bb0069161dfe559309d4847262d0ee88133a271cedd354b94f011717ce",
    "tr/populated/finance": "1f89d2ed542c5cbdc499146737daf1296a4e7e340c3217b23173282875a318cd",
    "tr/populated/world": "dcdba7b7021f98bbf6740a5aa3d551bb1aa2ba390324313cc9aa1915c9980312",
    "tr/heir/family": "f11eb8c0b90f31a933909e121d05e8216c7a84a29787812def084b811a506642",
    "tr/heir/finance": "1f89d2ed542c5cbdc499146737daf1296a4e7e340c3217b23173282875a318cd",
    "tr/heir/world": "dcdba7b7021f98bbf6740a5aa3d551bb1aa2ba390324313cc9aa1915c9980312",
    "tr/v7-ankara-family-day35.state.json/family":
      "52c61da08cbdd1b1b6b8bd19d982d8c7583a84ce523adb5fcf7ed9399725be81",
    "tr/v7-ankara-family-day35.state.json/finance":
      "ef531c5c6adffe7b1f3ea3e18cd2cc6f563c62a518972b892ad77265d9e8f96e",
    "tr/v7-ankara-family-day35.state.json/world":
      "7e5281c8e71f84dddf5929cc9ea58bfab1f6bc5731fa4f4ad1d1308170759daa",
    "tr/v7-izmir-family-day40.state.json/family":
      "677f0a470b26a13f23fd64ad1d233ee6050c2e36e043dd7bc46e737c53294c18",
    "tr/v7-izmir-family-day40.state.json/finance":
      "eb6315cf7f2a13a432d5647a1665c79b1501d6b0de2570d23dc81f6cbb71d35d",
    "tr/v7-izmir-family-day40.state.json/world":
      "45bc21ced36f61556ede29a43b0e5a6c4fb82c840bfcc9fb2f121a70ab82c8dc",
    "en/initial/family": "754fed20538784efde0bc97846c4fe5d04ee5fd3e3bb81c98cdb834ad153fd29",
    "en/initial/finance": "418eece2fb21ba68821bdaeca039453c0dd405513a7c6d376de9c1ed49d59f6e",
    "en/initial/world": "82844cd22f49b263a3ff0041e7bdfd3864a4c8a15b621517949d5eb5d1f9793d",
    "en/populated/family": "3535f467513aa9b4eea9912f0203bfb291537c8814a3610eca843b50ec15c16a",
    "en/populated/finance": "da1ea7998607bb7d9ecbadd95f88fff9676da2a0ae4ab9f87f04c72b806198b6",
    "en/populated/world": "0f2a09c4a4e7aa2f6949e1cf0212f192d0944f599b87a2e33f0b00d11bffddcd",
    "en/heir/family": "7e7554fd47a7b97a393c286b52352ee0a408f5fc7964b73306de155ca092b5ea",
    "en/heir/finance": "da1ea7998607bb7d9ecbadd95f88fff9676da2a0ae4ab9f87f04c72b806198b6",
    "en/heir/world": "0f2a09c4a4e7aa2f6949e1cf0212f192d0944f599b87a2e33f0b00d11bffddcd",
    "en/v7-ankara-family-day35.state.json/family":
      "da48c48586846bc7c6217932414b7abda30fd8c5d93382f5690670aebc8b08a2",
    "en/v7-ankara-family-day35.state.json/finance":
      "fc2a450cf2b65157b8863f617b7b12008d55f8710f8a2037ecad6daa73ff6310",
    "en/v7-ankara-family-day35.state.json/world":
      "9f4bb210204a00c2395f493825936ed33492f4cfb138f930a646ad49bfefaa72",
    "en/v7-izmir-family-day40.state.json/family":
      "20ace6482d69d4b4b81fbef061c425c5e4a3f222462482c595cc25368d3f3b04",
    "en/v7-izmir-family-day40.state.json/finance":
      "d9173b602ef809c5d7e7148f6c95c5bf8c5482a2ded272d6be9e9fe3c81f52db",
    "en/v7-izmir-family-day40.state.json/world":
      "4d655484e5ed2ce82e07feb21ea3b5aa4fa6070dd5eeba21f6a3d52263691b59",
    "pl/initial/family": "146f825c308b5e048a7bcead9fe1e641d777062063b6a9e675f879e557394217",
    "pl/initial/finance": "2e4551250cbc055849a09cfc1cd07797295ebb1adbc446a28abf41f0c618c096",
    "pl/initial/world": "ed687d253b3bee3f1bccfc4106b6bb743cbe51bed2d88d88d1a12a0d02ee1d62",
    "pl/populated/family": "bd8145681ee28e0b41f18600ea70e9449260d69e965a4a61ba4aba0e0421db4a",
    "pl/populated/finance": "a0ca04a6bf216b75aea4f27982bf43fe29f0d87376e787fa545e990fc26de075",
    "pl/populated/world": "2cc098d23a34f78dcd115277211708f8bb88833d88a6d7812e3a0f9a6096ecef",
    "pl/heir/family": "00cfa7f37ca3d9113832b18e4fff775f48783e17057c0817e088eb39292513f2",
    "pl/heir/finance": "a0ca04a6bf216b75aea4f27982bf43fe29f0d87376e787fa545e990fc26de075",
    "pl/heir/world": "2cc098d23a34f78dcd115277211708f8bb88833d88a6d7812e3a0f9a6096ecef",
    "pl/v7-ankara-family-day35.state.json/family":
      "4945df85d41d49e016bc97ca4aa7e6e13289b2bf6475fe4e4faaa576289000ce",
    "pl/v7-ankara-family-day35.state.json/finance":
      "a47fb3dd0ade8356a466ca4320ed70268d69dbd866154b4cbfeeb85eda0a2dde",
    "pl/v7-ankara-family-day35.state.json/world":
      "c29220cda230f9cf86d3c4456da5d2cb652574d68316fecbcdc85f9a47c5efca",
    "pl/v7-izmir-family-day40.state.json/family":
      "c77177e9d635a03466236ed77ddc7d076ba78849680a61f5840a37fce7a4b902",
    "pl/v7-izmir-family-day40.state.json/finance":
      "db6c10ef05ccd63115d3cf0b2d9e8f52b2e311a80d8ac1ed68ccad03e2da974a",
    "pl/v7-izmir-family-day40.state.json/world":
      "2f85645886ded65bfae2ba22dbb81886ec9bf88b1935a36ad29656cfb2964cc9",
  };
  for (const [name, digest] of Object.entries(out)) assert.equal(digest, expected[name], name);
});
