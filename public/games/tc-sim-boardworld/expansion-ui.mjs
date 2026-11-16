import { renderStories, renderFamilyStories, renderBusinessStories, renderSociety, localizeStoryText } from "./expansion-stories-ui.mjs";
import { renderLiving, localizeLivingText } from './expansion-living-ui.mjs';
import { getLanguage, t as tx } from "./i18n.mjs";
import { COURSES, EDUCATIONS, SCENARIOS, TRAITS } from "./content.mjs";
import { DISTRICTS } from "./expansion-geography.mjs";
import { getLifePathCopy, LIFE_PATHS } from "./expansion-life-paths.mjs";
import { REGIONS, localizeWorldText } from "./expansion-world.mjs";
import { translateFamilyAction } from "./expansion-family.mjs";
import { localizeInstitutionText } from "./expansion-institutions.mjs";
import { localizeEconomyText } from "./expansion-economy.mjs";

// Publish only a wake-up signal. Reads and writes remain in the locked IDB store.
export function observeExpansionSaves(refresh) {
  if (typeof BroadcastChannel !== "function") return null;
  try {
    const updates = new BroadcastChannel("tariklab.boardworld.expansion.saved");
    updates.onmessage = refresh;
    return updates;
  } catch {
    return null;
  }
}

export function renderLifePath(view, actions, actionCard, esc) {
  const path = view.lifePath;
  if (!path) return "";
  const copy = getLifePathCopy(path.id, getLanguage());
  const first = actions.filter((action) => path.firstActionIds.includes(action.id));
  const target = path.target;
  const local = target?.districtId === view.districts.place.districtId;
  const travel = target && actions.find((action) => local
    ? action.venue === target.venueId || action.id === `district:visit:${target.venueId}`
    : action.id === `district:travel:${target.districtId}` || (action.destination === target.districtId && !action.venue) || action.id === `world:move:${view.districts.districts.find(d => d.id === target.districtId)?.cityId}`);
  const next = first.find((action) => !action.disabled) || travel || first[0];
  const wait = next?.disabled && actions.find((a) => a.id === "wait:60" && !a.disabled);
  const choices = actions.filter((action) => action.id.startsWith("life-path:choose:"));
  return `<section class="reference" data-life-path="${esc(path.id)}" aria-labelledby="life-path-title">
    <h3 id="life-path-title">${esc(tx(copy.title))}</h3>
    <p data-life-path-objective><strong>${esc(tx(path.completed ? "Tamamlandı" : "İlk adım"))}</strong> · ${esc(tx(copy.objective))}</p>
    ${path.contact ? `<p>${esc(tx("Tanıdık"))} · ${esc(path.contact.name)}</p>` : ""}
    ${path.completed && next ? `<p><strong>${({tr:"Sıradaki adım",en:"Next step",pl:"Następny krok"})[getLanguage()] || "Sıradaki adım"}</strong></p>` : ""}
    ${path.id === "businessperson" && !path.completed && first.some((action) => !action.disabled)
      ? first.map((action) => actionCard(action, true)).join("") : next ? actionCard(next, true) : ""}
    ${wait ? `<button class="text-button" data-action="${wait.id}">${esc(tx(wait.label))}</button>` : ""}
    <details><summary>${esc(tx("Yaşam hedefi"))}</summary>
      <p>${esc(tx(copy.description))}</p><p>${esc(tx(copy.advantage))} ${esc(tx(copy.drawback))}</p>
      ${copy.opportunities.map((line) => `<p>${esc(tx(line))}</p>`).join("")}<p>${esc(tx(copy.goal))}</p>
      ${choices.length ? `<div class="action-grid" aria-label="${esc(tx("Hedefi değiştir"))}">${choices.map((a) =>
        `<button class="secondary" data-action="${esc(a.id)}" aria-pressed="${a.disabled}"${a.disabled ? " disabled" : ""}>${esc(tx(a.label))}</button>`,
      ).join("")}</div>` : ""}
    </details>
  </section>`;
}

// The deferred expansion owns the sector-specific management panel. Values
// come from the same economy view used by settlement, not a second ledger.
export function renderSectorBusiness(view, actions, actionCard, esc, money, language) {
  const c = view.economy.business;
  const l = (tr,en,pl) => ({tr,en,pl}[language] || tr);
  const relevant = actions.filter(a => a.id.startsWith("business:") || a.category === "enterprise").map(a =>
    a.id.startsWith("business:fund:") ? {...a, description:l("Kişisel bakiyeden işletme kasasına aktarım; giderler ve stok işletme kasasından karşılanır.", "Transfer personal funds to the business account for stock and expenses.", "Przenieś środki osobiste do kasy firmy na zapasy i wydatki.")} : a);
  const order = c.order;
  return `<section class="reference"><h2>${esc(localizeEconomyText(c.name, language))}</h2>
    <p>${l("Kasa", "Capital", "Kapitał")}: ${money(c.capital)} · ${l("Stok", "Stock", "Zapasy")}: ${esc(c.stock)} · ${l("Çalışan", "Employees", "Pracownicy")}: ${esc(c.workers)}</p>
    <p>${l("Gelir", "Revenue", "Przychód")}: ${money(c.revenue)} · ${l("Gider", "Costs", "Koszty")}: ${money(c.costs)} · ${l("Ücret borcu", "Wages due", "Zaległe płace")}: ${money(c.wageDue)} · ${l("Vergi borcu", "Tax due", "Zaległy podatek")}: ${money(c.taxDue)}</p>
    <p>${order ? `${l("Mevcut alıcı", "Available buyer", "Dostępny nabywca")}: ${esc(order.units)} · ${money(order.price)} / ${l("birim", "unit", "szt.")}` : l("Şu anda stok, fiyat veya alıcı koşulları nedeniyle sipariş yok.", "No order is available at current stock, price or buyer conditions.", "Brak zamówienia przy obecnych zapasach, cenie lub warunkach nabywcy.")}</p>
    <div class="action-grid">${relevant.map(a => actionCard(a)).join("")}</div></section>`;
}

// Presentation reads the existing contracts; it never mirrors their balances.
export function householdSummary(state, view, language) {
  const economy = state.expansion.economy, home = view.economy.properties.find(p => p.id === economy.home);
  const contract = economy.properties[economy.home]?.lease;
  const job = view.districts.job;
  const firm = job && Object.values(view.economy.regions).flatMap(r => r.firms).find(f => f.id === job.firmId);
  const rentLabel = ({tr:"Kira", en:"Rent", pl:"Czynsz"})[language];
  const mortgageLabel = ({tr:"Kredi taksiti", en:"Mortgage payment", pl:"Rata hipoteki"})[language];
  return {
    housing: contract?.tenant === "household" ? {...state.housing, ...contract} : state.housing,
    homeName: home ? localizeEconomyText(home.name, language) : null,
    job: job && {...job, name: [job.roleName && localizeLivingText(job.roleName, language), localizeEconomyText(firm?.name || job.firmId, language)].filter(Boolean).join(" · ")},
    jobDescription: ({tr:"Vardiya ve iş yeri Dünya bölümünde. Ücret tamamlanan vardiyada bankaya geçer.", en:"Find your shift and workplace in World. Completed shifts pay directly to your bank.", pl:"Zmiana i miejsce pracy znajdują się w Świecie. Ukończone zmiany są opłacane na konto."})[language],
    forecast: view.economy.properties.flatMap(p => [
      ...(p.rentCashFlow && p.leaseDueDay ? [{day:p.leaseDueDay, label:`${rentLabel} · ${localizeEconomyText(p.name, language)}`, amount:p.rentCashFlow - (p.tenancy === "household" ? p.arrears : 0)}] : []),
      ...(p.ownership === "household" && p.mortgageDueDay ? [{day:p.mortgageDueDay, label:`${mortgageLabel} · ${localizeEconomyText(p.name, language)}`, amount:-p.mortgagePayment}] : []),
    ]),
  };
}

const copy = {
  tr: [
    "Aile ağacı",
    "Konut ve işletme",
    "Şehirler",
    "Dünya tarihi",
    "Nüfus",
    "İstihdam endeksi",
    "Fiyat endeksi",
    "Yaş",
    "Anne-baba",
    "Ölüm",
    "Emekli",
    "Evlilikler",
  ],
  en: [
    "Family tree",
    "Homes and enterprise",
    "Cities",
    "World history",
    "Population",
    "Employment index",
    "Price index",
    "Age",
    "Parents",
    "Deceased",
    "Retired",
    "Marriages",
  ],
  pl: [
    "Drzewo rodzinne",
    "Domy i przedsiębiorstwa",
    "Miasta",
    "Historia świata",
    "Ludność",
    "Indeks zatrudnienia",
    "Indeks cen",
    "Wiek",
    "Rodzice",
    "Zmarły",
    "Emerytura",
    "Małżeństwa",
  ],
};
const eventNames = {
  relocation: ["Taşınma", "Relocation", "Przeprowadzka"],
  migration: ["Göç", "Migration", "Migracja"],
  downturn: ["Daralma", "Downturn", "Spowolnienie"],
  recovery: ["Toparlanma", "Recovery", "Ożywienie"],
};

export function translateExpansionAction(action, language) {
  if (language === "tr") return action;
  const prefix = action.id.split(":")[0];
  if (prefix === "story") return Object.fromEntries(Object.entries(action).map(([key,value]) => [key, ["label", "description", "reason"].includes(key) ? localizeStoryText(value, language) : value]));
  if (prefix === "family") return translateFamilyAction(action, language);
  // Expansion also adapts Gold business/work actions while preserving their IDs.
  return Object.fromEntries(
    Object.entries(action).map(([key, value]) => [
      key,
      ["label", "description", "reason"].includes(key) ? localize(value, language) : value,
    ]),
  );
}
const localize = (text, language) =>
  localizeLivingText(localizeEconomyText(
    localizeInstitutionText(localizeWorldText(text, language), language),
    language,
  ), language);
const outcomePatterns = [
  [/^Yeni şehir: (.+)\.$/, "New city: $1.", "Nowe miasto: $1."],
  [
    /^(.+) ile tanıştın\. Okul ve bakım seçenekleri artık aile ekranında\.$/,
    "You met $1. Find school and care in Family.",
    "Poznano $1. Szkoła i opieka są w widoku rodziny.",
  ],
  [
    /^Evlilik başladı\. Ayrı ve ortak bakiyeler kayıtta korunuyor\.$/,
    "Married. Personal and shared balances remain.",
    "Małżeństwo zawarte. Osobiste i wspólne środki pozostają.",
  ],
  [
    /^Ortak ev sözleşmesi kapandı, çocukların aile bağları korunuyor\.$/,
    "Shared lease ended. Children's family ties remain.",
    "Zakończono wspólny najem. Więzi rodzinne dzieci pozostają.",
  ],
  [/^Boşanma kaydedildi\.$/, "Divorce recorded.", "Zapisano rozwód."],
  [/^Aile birliği yeniden kuruldu\.$/, "The family reunited.", "Rodzina znów jest razem."],
  [
    /^Aile planı başladı\. 24 oyun günü sonra çocuk haneye katılacak\.$/,
    "Family plan started; a child joins in 24 game days.",
    "Plan rodziny rozpoczęty; dziecko dołączy za 24 dni gry.",
  ],
  [
    /^250 TL aile bütçesine ayrıldı\.$/,
    "250 TL set aside for the family.",
    "Odłożono 250 TL dla rodziny.",
  ],
  [
    /^Ödenmemiş aile giderinin bir bölümü kapatıldı\.$/,
    "Paid toward family arrears.",
    "Spłacono część zaległości rodziny.",
  ],
  [
    /^Emeklilik başladı\. Aylık ödemeler banka hesabına yatırılacak\.$/,
    "Retired. Monthly payments go to the bank.",
    "Emerytura rozpoczęta. Miesięczne wypłaty trafią do banku.",
  ],
  [
    /^(.+) ile zaman geçirdin\. Aile bağı güçlendi\.$/,
    "Time with $1 strengthened the family bond.",
    "Czas z $1 wzmocnił więź rodzinną.",
  ],
  [
    /^(.+) seçtiği eğitim alanında ilerledi\.$/,
    "$1 progressed in their chosen field of study.",
    "$1 robi postępy w wybranej dziedzinie nauki.",
  ],
  [
    /^(.+) ile zaman geçirip aile desteğini güçlendirdin\.$/,
    "Time with $1 strengthened family support.",
    "Czas z $1 wzmocnił wsparcie rodzinne.",
  ],
  [
    /^(.+) ile aynı dünyada devam ediyorsun\.$/,
    "Continuing in the same world as $1.",
    "Kontynuujesz w tym samym świecie jako $1.",
  ],
];
export function localizeExpansionOutcome(text, language) {
  if (language === "tr") return text;
  const story = localizeStoryText(text, language);
  if (story !== text) return story;
  for (const [pattern, en, pl] of outcomePatterns)
    if (pattern.test(text)) return text.replace(pattern, language === "pl" ? pl : en);
  return localize(text, language);
}

export function renderExpansion({
  view,
  actions,
  actionCard: renderCard,
  sectionHeader,
  money,
  esc,
  language,
  section = "family",
  selectedDistrict,
}) {
  const actionCard = (action, compact) => renderCard(translateExpansionAction(action, language), compact, true);
  // Like Gold's other views, render after chooseLanguage has selected `language`.
  // Existing catalog labels are shared; expansion-only copy stays in this module.
  const t = copy[language] ?? copy.tr;
  const locale = ["tr", "en", "pl"].indexOf(language);
  const label = (...values) => values[locale] ?? values[0];
  const { world, family, economy, institutions, events } = view;
  const options = (prefix) => {
    const matches = actions.filter((a) => a.id.startsWith(prefix + ":"));
    return matches.length
      ? `<div class="action-grid">${matches.map((a) => actionCard(a)).join("")}</div>`
      : "";
  };
  const stateLabel = (value) =>
    ({
      market: label("Piyasada", "On market", "Na rynku"),
      household: label("Haneye ait", "Household owned", "Własność gospodarstwa"),
      employed: label("Çalışıyor", "Employed", "Pracuje"),
      searching: tx("İş arıyor"),
      retired: label("Emekli", "Retired", "Na emeryturze"),
      open: tx("Açık"),
      closed: tx("Kapalı"),
    })[value] || value;
  const nameOf = (id) =>
    view.underworld?.chapters?.find((chapter) => chapter.id === id)?.name ??
    view.districts?.districts?.find((district) => district.id === id)?.name ??
    family.people.find((p) => p.id === id)?.name ??
    economy.properties.find((p) => p.id === id)?.name ??
    Object.values(economy.regions)
      .flatMap((r) => [...(r.residents || []), ...(r.firms || [])])
      .find((p) => p.id === id)?.name ??
    (/^family-household:/.test(id)
      ? label("Bölge hanesi", "Regional household", "Gospodarstwo regionalne")
      : /^(resident:|family:)/.test(id)
        ? label("Bölge sakini", "Local resident", "Mieszkaniec")
        : /^(firm:|business:)/.test(id)
          ? tx("İşletme")
          : id);
  const header = sectionHeader(REGIONS[world.region].name);
  if (section === "family") {
    const generation = (person, seen = new Set()) => {
      if (seen.has(person.id)) return 0;
      seen.add(person.id);
      const parents = person.parents
        .map((id) => family.people.find((p) => p.id === id))
        .filter(Boolean);
      return parents.length ? 1 + Math.max(...parents.map((p) => generation(p, new Set(seen)))) : 0;
    };
    const home = family.household;
    const familyRows = [...new Set(family.people.map((p) => generation(p)))]
      .sort((a, b) => a - b)
      .map(
        (level) =>
          `<div class="family-generation"><h4>${label("Kuşak", "Generation", "Pokolenie")} ${level + 1}</h4><div class="family-cards">${family.people
            .filter((p) => generation(p) === level)
            .map((p) => {
              const links = family.unions.filter((u) => u.first === p.id || u.second === p.id);
              const inHome =
                p.id === family.player.id ||
                home.children.some((c) => c.id === p.id) ||
                family.unions.some(
                  (u) =>
                    u.status === "married" &&
                    ((u.first === family.player.id && u.second === p.id) ||
                      (u.second === family.player.id && u.first === p.id)),
                );
              return `<details class="family-person" id="family-${esc(p.id)}"><summary><strong>${esc(p.name)}</strong><span>${esc(t[7])} ${esc(p.age)} · ${p.died ? esc(t[9]) : p.retired ? esc(t[10]) : p.age < 18 ? label("Çocuk", "Child", "Dziecko") : label("Yetişkin", "Adult", "Dorosły")}${inHome ? ` · ${label("Hanede", "In household", "W gospodarstwie")}` : ""}</span></summary><p>${esc(t[8])}: ${p.parents.length ? p.parents.map((id) => `<a href="#family-${esc(id)}">${esc(nameOf(id))}</a>`).join(", ") : "—"}</p>${links.map((u) => `<p>${esc(t[11])}: <a href="#family-${esc(u.first === p.id ? u.second : u.first)}">${esc(nameOf(u.first === p.id ? u.second : u.first))}</a> · ${esc({ married: label("Evli", "Married", "Małżeństwo"), separated: label("Ayrı", "Separated", "Separacja"), divorced: label("Boşanmış", "Divorced", "Rozwód"), widowed: label("Dul", "Widowed", "Wdowieństwo") }[u.status] || u.status)}</p>`).join("")}</details>`;
            })
            .join("")}</div></div>`,
      )
      .join("");
    const terminal =
      family.player.died && !actions.some((a) => a.id.startsWith("family:successor"));
    const familyStatus = terminal
      ? label(
          "Yetişkin bir ardıl yok; bu yaşam sona erdi. Kaydı dışa aktarabilir veya menüden yeni yaşam başlatabilirsin.",
          "No adult successor; this life has ended. Export the family save or start a new life from the menu.",
          "Brak dorosłego następcy; życie dobiegło końca. Eksportuj zapis rodziny lub rozpocznij nowe życie z menu.",
        )
      : family.player.died
        ? label(
            "Karakterin öldü. Uygun bir ardılla devam edebilirsin.",
            "Your character died. Continue with an eligible heir.",
            "Postać zmarła. Kontynuuj z uprawnionym następcą.",
          )
        : "";
    return (
      header +
      `<section class="status-sheet"><div><h3>${esc(t[0])}</h3><p>${esc(family.player.name)} · ${esc(t[7])} ${family.player.age}${family.player.retired ? ` · ${esc(t[10])}` : ""}</p>
    ${familyStatus ? `<p role="status">${esc(familyStatus)}</p>${terminal ? `<button class="secondary" data-ui="export">${label("Kaydı dışa aktar", "Export save", "Eksportuj zapis")}</button>` : ""}` : ""}
    <p>${label("Hane birikimi", "Household reserve", "Oszczędności gospodarstwa")} ${money(home.reserve)} · ${label("Hane borcu", "Household arrears", "Zaległości gospodarstwa")} ${money(home.arrears)}</p><div class="family-tree">${familyRows}</div></div></section>
    ${renderFamilyStories({view, actions, actionCard, esc, language})}${options("family")}`
    );
  }
  if (section === "finance") {
    const propertyCard = (p) =>
          `<li class="property-card"><strong>${esc(localizeEconomyText(p.name, language))}</strong> · ${esc(REGIONS[p.region]?.name)}<br>${label("Sahiplik", "Owner", "Własność")}: ${esc(stateLabel(p.ownership))} · ${label("Değer", "Value", "Wartość")}: ${money(p.value)} · ${label("Durum", "Condition", "Stan")}: ${esc(p.condition)}%<br>${tx("Kira")}: ${money(p.rent)} · ${label("Kredi", "Mortgage", "Hipoteka")}: ${money(p.mortgage)} · ${label("Gecikme", "Arrears", "Zaległości")}: ${money(p.arrears)}${p.repairCost != null ? `<br>${label("Onarım maliyeti", "Repair cost", "Koszt naprawy")}: ${money(p.repairCost)} · ${label("Sözleşmeye göre kira akışı", "Contractual rent cash flow", "Przepływ czynszu według umowy")}: ${money(p.rentCashFlow)}${p.leaseDueDay ? ` · ${label("Kira günü", "Rent due day", "Termin czynszu")}: ${p.leaseDueDay}` : ""}${p.mortgageDueDay ? ` · ${label("Kredi taksiti", "Mortgage payment", "Rata hipoteki")}: ${money(p.mortgagePayment)} / ${p.mortgageDueDay}` : ""}` : ""}</li>`;
    const localProperty = (p) => p.districtId === view.districts?.place?.districtId || p.ownership === "household" || p.tenancy === "household" || p.id === economy.home;
    const localProperties = economy.properties.filter(localProperty);
    const remoteProperties = economy.properties.filter((p) => !localProperty(p));
    const propertyOptions = (rows) => {
      const matches = actions.filter((a) => a.id.startsWith("economy:") && rows.some((p) => a.id.endsWith(`:${p.id}`)));
      return matches.length ? `<div class="action-grid">${matches.map((a) => actionCard(a)).join("")}</div>` : "";
    };
    const extraEconomy = actions.filter((a) => a.id.startsWith("economy:") && !economy.properties.some((p) => a.id.endsWith(`:${p.id}`)));
    const extras = extraEconomy.length ? `<div class="action-grid">${extraEconomy.map((a) => actionCard(a)).join("")}</div>` : "";
    const company = economy.business;
    return (
      header +
      `${renderBusinessStories({view, actions, actionCard, esc, language})}<section class="reference"><h3>${esc(t[1])}</h3><ul class="property-grid">${localProperties.map(propertyCard).join("")}</ul>${propertyOptions(localProperties)}${remoteProperties.length ? `<details><summary>${label("Diğer bölgeler", "Other districts", "Inne dzielnice")}</summary><ul class="property-grid">${remoteProperties.map(propertyCard).join("")}</ul>${propertyOptions(remoteProperties)}</details>` : ""}
    ${company ? `<p>${esc(localizeEconomyText(company.name, language))} · ${tx("İşletme kasası")} ${money(company.capital)} · ${label("Stok", "Stock", "Zapasy")} ${esc(company.stock)} · ${label("Çalışan", "Employees", "Pracownicy")} ${esc(company.workers)}<br>${label("Gelir", "Revenue", "Przychód")} ${money(company.revenue)} · ${label("Gider", "Costs", "Koszty")} ${money(company.costs)} · ${label("Kâr", "Profit", "Zysk")} ${money(company.revenue - company.costs)}<br>${label("Maaş borcu", "Wages due", "Zaległe płace")} ${money(company.wageDue)} · ${label("Vergi borcu", "Tax due", "Zaległy podatek")} ${money(company.taxDue)}${company.clients != null ? `<br>${tx("Müşteri")}: ${esc(company.clients)} · ${label("İtibar", "Reputation", "Reputacja")}: ${esc(company.reputation)} · ${label("Çalışan vardiya ücreti", "Wage per worker shift", "Płaca za zmianę pracownika")}: ${money(company.wageRate)} · ${label("Birikmiş sabit gider borcu", "Accrued overhead arrears", "Zaległe koszty stałe")}: ${money(company.overhead)}` : ""}</p>` : ""}${extras}</section>`
    );
  }
  if (section === "world") {
    const cities = Object.entries(world.regions)
      .map(([id, r]) => {
        const market = economy.regions[id];
        return `<article><h3>${esc(REGIONS[id].name)}</h3><dl><dt>${esc(t[4])}</dt><dd>${r.population}</dd><dt>${esc(t[5])}</dt><dd>${r.employment}</dd><dt>${esc(t[6])}</dt><dd>${r.price}</dd></dl>${market ? `<p>${label("Çalışan", "Workers", "Pracownicy")}: ${market.workers} · ${label("Ortalama fiyat", "Average price", "Średnia cena")}: ${money(market.averagePrice)}</p>${market.residents?.length ? `<details><summary>${label("Bölge sakinleri", "Local residents", "Mieszkańcy")}</summary><ul>${market.residents.map((n) => `<li><strong>${esc(n.name)}</strong> · ${esc(n.age)} · ${esc(stateLabel(n.employment))} · ${tx("Sağlık")} ${esc(n.health)} · ${tx("Nakit")} ${money(n.cash)} · ${tx("Borç")} ${money(n.debt)}</li>`).join("")}</ul></details>` : ""}${market.firms?.length ? `<details><summary>${label("Bölge işletmeleri", "Local businesses", "Lokalne firmy")}</summary><ul>${market.firms.map((f) => `<li><strong>${esc(f.name)}</strong> · ${esc(stateLabel(f.status))} · ${label("Çalışan", "Workers", "Pracownicy")} ${esc(f.workers)} · ${label("Gelir", "Revenue", "Przychód")} ${money(f.revenue)} · ${label("Gider", "Costs", "Koszty")} ${money(f.costs)}</li>`).join("")}</ul></details>` : ""}` : ""}</article>`;
      })
      .join("");
    const kind = (type) =>
      eventNames[type]?.[locale] ??
      {
        underworld: label("Yerel örgüt ve hukuk", "Local organizations and law", "Lokalne organizacje i prawo"),
        "resident.job-loss": label("İş kaybı", "Job loss", "Utrata pracy"),
        "resident.hired": label("İşe alım", "Hired", "Zatrudnienie"),
        "resident.migration": label("Göç", "Migration", "Migracja"),
        "resident.inheritance": label("Miras", "Inheritance", "Dziedziczenie"),
        "resident.training": label("Mesleki eğitim", "Vocational training", "Szkolenie zawodowe"),
        "family-adoption": label("Evlat edinme", "Adoption", "Adopcja"),
        "family-birth": label("Doğum", "Birth", "Narodziny"),
        "family-npc-birth": label("Doğum", "Birth", "Narodziny"),
        "family-npc-household": label("Hane değişimi", "Household change", "Zmiana gospodarstwa"),
        "family-loss": label("Vefat", "Death", "Śmierć"),
        "family-npc-loss": label("Vefat", "Death", "Śmierć"),
        "family-adult": label("Yetişkinlik", "Adulthood", "Dorosłość"),
        "family-marriage": label("Evlilik", "Marriage", "Małżeństwo"),
        "family-succession": label(
          "Miras ve ardıllık",
          "Inheritance and succession",
          "Dziedziczenie i sukcesja",
        ),
        "property.purchase": label("Mülk alımı", "Property purchase", "Zakup nieruchomości"),
        "property.npc-purchase": label("Mülk alımı", "Property purchase", "Zakup nieruchomości"),
        "property.npc-sale": label("Mülk satışı", "Property sale", "Sprzedaż nieruchomości"),
        "business.layoff": label("İşten ayrılma", "Layoffs", "Zwolnienia"),
        "business.default": label("Kredi temerrüdü", "Loan default", "Niespłacony kredyt"),
        "business.npc-closure": label("İşletme kapandı", "Business closure", "Zamknięcie firmy"),
        "business.npc-open": label("İşletme açıldı", "Business opened", "Otwarcie firmy"),
        "business.open": label("İşletme açıldı", "Business opened", "Otwarcie firmy"),
        education: tx("Eğitim"),
        health: tx("Sağlık"),
        council: label("Belediye", "Council", "Rada"),
        law: label("Hukuk", "Law", "Prawo"),
      }[type] ??
      label("Dünya olayı", "World event", "Wydarzenie świata");
    const detail = (row) => {
      const text = row.detail;
      if (language === "tr") return esc(text);
      const translated = localize(text, language);
      if (translated !== text) return esc(translated);
      const from = REGIONS[text]?.name;
      if (row.type === "relocation" && from)
        return esc(label(`Başlangıç: ${from}`, `From ${from}`, `Z ${from}`));
      const migration = /^([a-z]+):(\d+)$/.exec(text);
      if (row.type === "migration" && migration && REGIONS[migration[1]])
        return esc(
          label(
            `Hedef: ${REGIONS[migration[1]].name} · ${migration[2]} kişi`,
            `To ${REGIONS[migration[1]].name} · ${migration[2]} people`,
            `Do ${REGIONS[migration[1]].name} · ${migration[2]} osób`,
          ),
        );
      if (["downturn", "recovery"].includes(row.type) && /^\d+$/.test(text))
        return esc(label(`İstihdam: ${text}`, `Employment: ${text}`, `Zatrudnienie: ${text}`));
      if (row.type === "property.npc-purchase" || row.type === "resident.migration")
        return esc(text);
      const known = {
        "Borç baskısı nedeniyle satış gerçekleşti.": [
          "Debt pressure forced the sale.",
          "Sprzedaż z powodu zadłużenia.",
        ],
        "Üç gün ödenmeyen ücret nedeniyle ekip ayrıldı.": [
          "The team left after three days without wages.",
          "Zespół odszedł po trzech dniach bez płacy.",
        ],
        "Üç kaçan kredi vadesi nedeniyle üretim durdu.": [
          "Production stopped after three missed loan payments.",
          "Produkcja ustała po trzech niezapłaconych ratach.",
        ],
        "Yerel talep yeni bir bağımsız işletme çekti.": [
          "Local demand brought a new independent business.",
          "Lokalny popyt przyciągnął nową niezależną firmę.",
        ],
        "Giderlerini karşılayamayan işletme kapandı.": [
          "The business closed; it could not cover costs.",
          "Firma zamknięta: nie pokryła kosztów.",
        ],
        "İşletme ve tedarik defteri açıldı.": [
          "Business and supply ledger opened.",
          "Otwarto firmę i księgę dostaw.",
        ],
      };
      if (known[text]) return esc(known[text][language === "pl" ? 1 : 0]);
      const templates = [
        [
          /^(.+) evlat edinildi ve aileye katıldı\.$/,
          "$1 was adopted into the family.",
          "$1 dołącza do rodziny przez adopcję.",
        ],
        [
          /^(.+) doğdu ve aileye katıldı\.$/,
          "$1 was born and joined the family.",
          "$1 urodziło się i dołączyło do rodziny.",
        ],
        [
          /^(.+) aile mirasını ve borçlarını devraldı\.$/,
          "$1 inherited the family estate and debts.",
          "$1 dziedziczy majątek i długi rodziny.",
        ],
        [/^(.+) ve (.+) evlendi\.$/, "$1 and $2 married.", "$1 i $2 zawarli małżeństwo."],
        [/^(.+) ve (.+) barıştı\.$/, "$1 and $2 reconciled.", "$1 i $2 pogodzili się."],
        [/^(.+) yetişkinliğe ulaştı\.$/, "$1 reached adulthood.", "$1 osiąga dorosłość."],
        [
          /^(.+), (\d+) yaşında hayatını kaybetti\.$/,
          "$1 died aged $2.",
          "$1 umiera w wieku $2 lat.",
        ],
        [/^(.+) hayatını kaybetti\.$/, "$1 died.", "$1 umiera."],
        [
          /^Maddi hazırlığı tamamlayan haneye bir çocuk katıldı\.$/,
          "A child joined a financially prepared household.",
          "Dziecko dołączyło do przygotowanego finansowo gospodarstwa.",
        ],
        [
          /^Boşalan haneye yeni bir yetişkin yerleşti\.$/,
          "An adult joined a vacant household.",
          "Do pustego gospodarstwa dołączyła dorosła osoba.",
        ],
        [
          /^Hane taşınma giderini karşılayınca yeni bir yetişkin katıldı\.$/,
          "An adult joined after the household paid moving costs.",
          "Dorosła osoba dołączyła po opłaceniu przeprowadzki.",
        ],
        [
          /^(\d+) TL; peşinat (\d+) TL\.$/,
          "Price $1 TL; down payment $2 TL.",
          "Cena $1 TL; wpłata $2 TL.",
        ],
      ];
      for (const [pattern, en, pl] of templates)
        if (pattern.test(text)) return esc(text.replace(pattern, language === "pl" ? pl : en));
      return `${esc(label("Özgün kayıt", "Original-language record", "Zapis w języku oryginału"))}: <span data-original-record>${esc(text)}</span>`;
    };
    const historySubject = (id) => {
      if (typeof id === "string" && id.startsWith("union:")) {
        const union = family.unions.find((entry) => entry.id === id);
        const member = (personId) => family.people.find((person) => person.id === personId)?.name ||
          label("Aile üyesi", "Family member", "Członek rodziny");
        return union ? `${member(union.first)} · ${member(union.second)}` :
          label("Aile birliği", "Family union", "Związek rodzinny");
      }
      // Regional account IDs survive succession; their current head is not the
      // person who performed every historical action recorded under that account.
      const household = /^resident:(ankara|izmir):(\d+)$/.exec(id);
      return household
        ? `${REGIONS[household[1]].name} · ${label("Hane", "Household", "Gospodarstwo")} ${Number(household[2]) + 1}`
        : (REGIONS[id]?.name ?? nameOf(id));
    };
    const history = events
      .slice(-60)
      .reverse()
      .map(
        (row) =>
          `<li><time>${Math.floor(row.at / 1440) + 1}</time> · <strong>${esc(kind(row.type))}</strong> · ${esc(historySubject(row.subject))} · ${detail(row)}</li>`,
      )
      .join("");
    const course =
      institutions.program && COURSES.find((c) => c.id === institutions.program.course);
    const office = institutions.regions.find((r) => r.region === world.region);
    return (
      header + renderLiving({
        view, actions, actionCard, esc, language, selectedDistrict,
        afterMap: renderLifePath(view, actions, actionCard, esc),
      }) + renderStories({ view, actions, actionCard, esc, language }) + renderSociety({ view, esc, language }) +
      `<section class="reference"><h3>${esc(tx("Kurumlar"))}</h3>
    <p>${label("Kredi durumu", "Credit score", "Ocena kredytowa")} ${esc(institutions.credit)} · ${label("Kamu güveni", "Public trust", "Zaufanie publiczne")} ${office.trust}% · ${label("Yerel bütçe", "Local budget", "Budżet lokalny")} ${money(office.treasury)}</p>
    ${institutions.program ? `<p>${tx("Eğitim")}: ${esc(tx(course?.name || "Eğitim"))} · ${institutions.program.sessions}/${institutions.program.requiredSessions} · ${label("Burs", "Grant", "Stypendium")} ${money(institutions.program.grant)}</p>` : ""}
    ${institutions.illness ? `<p>${label("Sağlık takibi", "Active health issue", "Aktualny problem zdrowotny")}: ${label("Şiddet", "Severity", "Nasilenie")} ${institutions.illness.severity} · ${label("Başlangıç günü", "Since day", "Od dnia")} ${institutions.illness.since}</p>` : ""}
    ${office.policy ? `<p>${label("Güncel politika", "Active policy", "Aktywna polityka")}: ${esc({ skills: tx("Eğitim"), health: tx("Sağlık"), housing: label("Konut", "Housing", "Mieszkalnictwo") }[office.policy])} · ${label("Bitiş günü", "Until day", "Do dnia")} ${office.policyUntil}</p>` : ""}
    ${institutions.investigation ? `<p>${label("Açık dosya", "Open case", "Otwarta sprawa")} · ${money(institutions.investigation.total)}</p>` : ""}
    <details><summary>${label("Kurum işlemleri", "Institution services", "Usługi instytucji")}</summary>${options("institution")}</details></section>
    <section><h3>${esc(t[2])}</h3><div class="reference-grid">${cities}</div></section>
    <details class="reference"><summary>${esc(t[3])}</summary><ol>${history}</ol></details>`
    );
  }
  return header;
}

export function renderStart({app, esc, option, languageControl}) {
  const language = getLanguage();
  const l = (tr,en,pl) => ({tr,en,pl}[language] || tr);
  const header = `<main class="onboarding" id="main"><section class="start-story"><a href="/" target="_top" class="back-link">← TarikLab</a><div class="edition">BOARDWORLD / 31</div><div class="brand-lockup"><span class="brand-seal">TC</span><span>SIM<span class="brand-small">BOARDWORLD</span></span></div><h1>${l("Bir hayat, üç şehir.","One life, three cities.","Jedno życie, trzy miasta.")}</h1><p class="start-lead">${l("İş bul, insanları tanı ve kendi yolunu çiz.","Find work, meet people and make your own way.","Znajdź pracę, poznaj ludzi i wybierz własną drogę.")}</p><p class="start-note">İstanbul · Ankara · İzmir</p></section><section class="creation"><span class="eyebrow">${l("YENİ HAYAT","NEW LIFE","NOWE ŻYCIE")}</span><h2>${l("Başlangıcını seç.","Choose your beginning.","Wybierz swój początek.")}</h2><p class="muted">${l("Seçimlerin başlangıcını şekillendirir; geleceğini sınırlamaz.","Your choices shape your start, not your future.","Wybory kształtują początek, nie ograniczają przyszłości.")}</p>`;

  app.innerHTML = `${header}<form id="create-form"><label class="field">1 · ${tx("Karakter adı")}<input name="name" id="character-name" autocomplete="off" minlength="2" maxlength="32" required value="Deniz"></label><div class="field-row"><label class="field">2 · ${tx("Şehir")}<select name="startCity">${Object.entries(REGIONS).map(([id,{name}])=>`<option value="${id}">${name}</option>`).join("")}</select></label><label class="field">3 · ${l("İlçe","District","Dzielnica")}<select name="startingDistrict">${DISTRICTS.map(d=>`<option value="${esc(d.id)}" data-city="${d.cityId}" ${d.cityId!=="istanbul"?"hidden disabled":""}>${esc(d.name)}</option>`).join("")}</select></label></div><fieldset class="scenario-list"><legend>4 · ${l("Başlangıç hedefi","Starting ambition","Początkowa ambicja")}</legend>${LIFE_PATHS.map((id, i) => {
    const {title, description} = getLifePathCopy(id, language);
    return `<label class="scenario-option"><input type="radio" name="lifePath" value="${id}" ${i===0?"checked":""}><span class="scenario-number">0${i+1}</span><span><strong>${esc(title)}</strong><small>${esc(description)}</small></span><span class="radio-dot"></span></label>`;
  }).join("")}</fieldset><details><summary>5 · ${l("İsteğe bağlı arka plan","Optional background","Opcjonalne tło")}</summary><label class="field">${l("Başlangıç koşulları","Starting circumstances","Warunki początkowe")}<select name="scenario">${SCENARIOS.map((e)=>option(e,SCENARIOS[0].id)).join("")}</select></label><div class="field-row"><label class="field">${l("Eğitim","Education","Edukacja")}<select name="education">${EDUCATIONS.map(e=>option(e,"highschool")).join("")}</select></label><label class="field">${tx("Kişilik")}<select name="trait">${TRAITS.map(e=>option(e,"balanced")).join("")}</select></label></div><p class="creation-detail" id="trait-description">${esc(TRAITS[0]?.description || "")}</p></details><p id="start-summary" aria-live="polite"></p><button class="primary start-button" type="submit" data-testid="create-game">${tx("Hayatına başla")} →</button></form><div class="start-foot">${languageControl()}<button class="text-button" data-ui="import">${l("Kayıt dosyası yükle","Import save","Wczytaj zapis")}</button><button class="text-button" data-ui="help">${l("Nasıl oynanır?","How to play","Jak grać?")}</button></div></section></main>`;
  updateStartSummary();
}
export function updateStartSummary() {
  const form = document.querySelector("#create-form"); if (!form) return;
  const data = new FormData(form), district = DISTRICTS.find(d => d.id === data.get("startingDistrict"));
  const path = getLifePathCopy(data.get("lifePath"), getLanguage()).title;
  const city = REGIONS[district?.cityId]?.name;
  document.querySelector("#start-summary").textContent = `${data.get("name")} · ${city} / ${district?.name} · ${path}`;
}
