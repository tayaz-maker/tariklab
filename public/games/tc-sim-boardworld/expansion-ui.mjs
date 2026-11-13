import { REGIONS, localizeWorldText } from "./expansion-world.mjs";
import { translateFamilyAction } from "./expansion-family.mjs";
import { localizeInstitutionText } from "./expansion-institutions.mjs";
import { localizeEconomyText } from "./expansion-economy.mjs";

const copy = {
  tr: [
    "Aile ağacı",
    "Konut ve işletme",
    "Kurumlar",
    "Şehirler",
    "Dünya tarihi",
    "Nüfus",
    "İstihdam",
    "Fiyat endeksi",
    "Yaş",
    "Anne-baba",
    "Bekleyen olay kartını çöz.",
    "Ölüm",
    "Emekli",
    "Evlilikler",
  ],
  en: [
    "Family tree",
    "Homes and enterprise",
    "Institutions",
    "Cities",
    "World history",
    "Population",
    "Employment",
    "Price index",
    "Age",
    "Parents",
    "Resolve the pending event card.",
    "Deceased",
    "Retired",
    "Marriages",
  ],
  pl: [
    "Drzewo rodzinne",
    "Domy i przedsiębiorstwa",
    "Instytucje",
    "Miasta",
    "Historia świata",
    "Ludność",
    "Zatrudnienie",
    "Indeks cen",
    "Wiek",
    "Rodzice",
    "Rozstrzygnij oczekującą kartę wydarzenia.",
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

export function renderExpansion({
  view,
  actions,
  actionCard,
  sectionHeader,
  money,
  esc,
  language,
}) {
  const t = copy[language] ?? copy.tr;
  const locale = ["tr", "en", "pl"].indexOf(language);
  const label = (...values) => values[locale] ?? values[0];
  const { world, family, economy, institutions, events } = view;
  const options = (prefix) => {
    const matches = actions.filter((a) => a.id.startsWith(prefix + ":"));
    const translate = (action) => {
      if (prefix === "family") return translateFamilyAction(action, language);
      const localize =
        prefix === "institution"
          ? localizeInstitutionText
          : prefix === "world"
            ? localizeWorldText
            : prefix === "economy"
              ? localizeEconomyText
              : null;
      if (!localize) return action;
      return Object.fromEntries(
        Object.entries(action).map(([key, value]) => [
          key,
          ["label", "description", "reason"].includes(key) ? localize(value, language) : value,
        ]),
      );
    };
    return matches.length
      ? `<div class="action-grid">${matches.map((a) => actionCard(translate(a))).join("")}</div>`
      : "";
  };
  const nameOf = (id) => family.people.find((p) => p.id === id)?.name ?? id;
  const familyRows = family.people
    .map(
      (p) =>
        `<li id="family-${esc(p.id)}"><strong>${esc(p.name)}</strong> · ${esc(t[8])} ${esc(p.age)}${p.died ? ` · ${esc(t[11])}` : ""}${p.parents?.length ? ` · ${esc(t[9])} ${p.parents.map((id) => `<a href="#family-${esc(id)}">${esc(nameOf(id))}</a>`).join(", ")}` : ""}</li>`,
    )
    .join("");
  const unions = family.unions
    .map((u) => `<li>${esc(nameOf(u.first))} · ${esc(nameOf(u.second))} · ${esc(u.status)}</li>`)
    .join("");
  const cities = Object.entries(world.regions)
    .map(([id, r]) => {
      const market = economy.regions[id];
      return `<article><h3>${esc(REGIONS[id].name)}</h3><dl><dt>${esc(t[5])}</dt><dd>${r.population}</dd><dt>${esc(t[6])}</dt><dd>${r.employment}</dd><dt>${esc(t[7])}</dt><dd>${r.price}</dd></dl>${market ? `<p>${market.workers} · ${money(market.averagePrice)}</p>` : ""}</article>`;
    })
    .join("");
  const history = events
    .slice(-60)
    .reverse()
    .map(
      (row) =>
        `<li><time>${Math.floor(row.at / 1440) + 1}</time> · <strong>${esc(eventNames[row.type]?.[locale] ?? row.type)}</strong> · ${esc(REGIONS[row.subject]?.name ?? nameOf(row.subject))} · ${esc(row.detail)}</li>`,
    )
    .join("");
  const properties = economy.properties
    .map(
      (p) =>
        `<li>${esc(localizeEconomyText(p.name, language))} · ${esc(REGIONS[p.region]?.name)} · ${money(p.value)} · ${esc(p.condition)}%${p.mortgage ? ` · ${label("Kredi", "Mortgage", "Hipoteka")} ${money(p.mortgage)}` : ""}${p.arrears ? ` · ${label("Gecikmiş kira", "Rent arrears", "Zaległy czynsz")} ${money(p.arrears)}` : ""}</li>`,
    )
    .join("");
  const home = family.household;
  const company = economy.business;
  const office = institutions.regions.find((r) => r.region === world.region);
  const familyStatus = family.player.died
    ? label(
        "Karakterin öldü. Uygun bir ardılla devam edebilirsin.",
        "Your character died. You can continue with an eligible heir.",
        "Twoja postać zmarła. Możesz kontynuować z uprawnionym następcą.",
      )
    : "";
  return `${sectionHeader(REGIONS[world.region].name)}
    <section class="status-sheet"><div><h3>${esc(t[0])}</h3><p>${esc(family.player.name)} · ${esc(t[8])} ${family.player.age}${family.player.retired ? ` · ${esc(t[12])}` : ""}</p>
    ${familyStatus ? `<p role="status">${esc(familyStatus)}</p>` : ""}
    <p>${label("Hane birikimi", "Household reserve", "Oszczędności gospodarstwa")} ${money(home.reserve)} · ${label("Hane borcu", "Household arrears", "Zaległości gospodarstwa")} ${money(home.arrears)}</p><ul>${familyRows}</ul><details><summary>${esc(t[13])}</summary><ul>${unions}</ul></details></div></section>
    ${familyStatus ? options("family") : `<details class="reference"><summary>${esc(t[0])}</summary>${options("family")}</details>`}
    <details class="reference"><summary>${esc(t[1])}</summary><ul>${properties}</ul>
    ${company ? `<p>${esc(company.name)} · ${label("İşletme kasası", "Business cash", "Kasa firmy")} ${money(company.capital)} · ${label("Stok", "Stock", "Zapasy")} ${esc(company.stock)}</p>` : ""}${options("economy")}</details>
    <details class="reference"><summary>${esc(t[2])}</summary>
    <p>${label("Kredi durumu", "Credit score", "Ocena kredytowa")} ${esc(institutions.credit)} · ${label("Kamu güveni", "Public trust", "Zaufanie publiczne")} ${office.trust}% · ${label("Yerel bütçe", "Local budget", "Budżet lokalny")} ${money(office.treasury)}</p>
    ${institutions.program ? `<p>${label("Ders", "Lessons", "Lekcje")} ${institutions.program.sessions}/${institutions.program.requiredSessions}</p>` : ""}
    ${institutions.illness ? `<p>${label("Sağlık takibi", "Active health issue", "Aktualny problem zdrowotny")}</p>` : ""}
    ${institutions.investigation ? `<p>${label("Açık dosya", "Open case", "Otwarta sprawa")} · ${money(institutions.investigation.total)}</p>` : ""}
    ${options("institution")}</details>
    <section><h3>${esc(t[3])}</h3><div class="reference-grid">${cities}</div></section>${options("world")}
    <details class="reference"><summary>${esc(t[4])}</summary><ol>${history}</ol></details>`;
}
