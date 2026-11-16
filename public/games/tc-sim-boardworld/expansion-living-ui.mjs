import { renderWorldMap } from "./expansion-world-map.mjs";
import { localizeDistrictText } from "./expansion-districts.mjs";
import { localizeUnderworldText } from "./expansion-underworld.mjs";

export function localizeLivingText(text, language) {
  return localizeUnderworldText(localizeDistrictText(text, language), language);
}
export function renderLiving({ view, actions, actionCard, esc, language, selectedDistrict, afterMap = "" }) {
  if (!view.districts) return "";
  const tr = language !== "en" && language !== "pl";
  const label = (a, b, c) => (tr ? a : language === "en" ? b : c);
  const { place, districts } = view.districts;
  const here = districts.find((d) => d.id === place.districtId);
  const localActions = actions.filter((a) => /^(district:|underworld:)/.test(a.id));
  const other = localActions.filter((a) => !/^district:(travel|visit):/.test(a.id) && !a.id.startsWith("underworld:"));
  const organizationActions = localActions.filter((a) => a.id.startsWith("underworld:"));
  const essentials = actions.filter((a) => ["world:meal", "world:rest"].includes(a.id));
  const nearest = view.districts.nearestInstitution;
  const publicHere = here?.venues.some((v) => v.kind === "institution");
  const currentVenue = here?.venues.find((v) => v.id === place.venueId);
  const housingLink = currentVenue?.kind === "housing" ? `<p><button class="secondary" data-tab="expansion-finance">${label("Konut seçenekleri", "Housing options", "Opcje mieszkaniowe")} →</button></p>` : "";
  const publicHint = !publicHere && nearest ? `<p>${label("En yakın kamu merkezi", "Nearest public centre", "Najbliższe centrum usług publicznych")}: ${esc(nearest.districtName)} · ${esc(localizeLivingText(nearest.name,language))} · ${nearest.hours[0]}:00–${nearest.hours[1]}:00 · ${nearest.minutes} ${label("dk", "min", "min")} · ${nearest.cost} TL${nearest.available ? "" : ` · ${esc(localizeLivingText(nearest.reason, language))}`}</p>` : "";
  const uw = view.underworld;
  const name = (id) =>
    districts.find((d) => d.id === id)?.name ||
    label("Yerel semt", "Local district", "Lokalna dzielnica");
  const chapters = (uw?.chapters || [])
    .map(
      (c) =>
        `<li><strong>${esc(c.name)}</strong> · ${esc(name(c.districtId))} · ${label("Etki", "Influence", "Wpływy")} ${esc(c.influence)}${c.leader ? ` · ${esc(c.leader)}` : ""}${c.territory?.length ? `<p>${label("Bölgesel etki", "Territorial influence", "Wpływy terytorialne")}: ${c.territory.map((t) => `${esc(t.name)} ${esc(t.influence)}`).join(" · ")}</p>` : ""}${c.relations?.length ? `<ul>${c.relations.map((r) => `<li>${esc(r.name)} · ${esc(localizeLivingText(r.status, language))}</li>`).join("")}</ul>` : ""}</li>`,
    )
    .join("");
  const legalStage = (stage) => ({
    unreported: label("Kayıp kaydı bir suçluluk bulgusu değildir.", "A loss record is not a finding of guilt.", "Zapis straty nie oznacza ustalenia winy."),
    investigation: label("Şüphe araştırılıyor; henüz hüküm yok.", "Suspicion is being investigated; no verdict yet.", "Podejrzenie jest badane; nie ma jeszcze wyroku."),
    review: label("İsnat incelemede. Sayım kaybı, bağımsız tanık kimliği doğrular; ikisi de gerekir.", "The allegation is under review. Inventory establishes loss; an independent witness establishes identity. Both are required.", "Zarzut jest oceniany. Spis potwierdza stratę, niezależny świadek tożsamość. Potrzebne są oba dowody."),
    acquitted: label("Kimlik kanıtı yetersiz; söylenti mahkûmiyet sayılmaz.", "Identity evidence is insufficient; rumor is not a conviction.", "Brak dowodów tożsamości; plotka nie oznacza skazania."),
    convicted: label("Karar iki bağımsız kanıta dayanır. Ceza ve tazminat ayrı yükümlülüklerdir.", "The finding rests on two independent sources. Fine and compensation are separate obligations.", "Orzeczenie opiera się na dwóch niezależnych źródłach. Grzywna i odszkodowanie to osobne zobowiązania."),
  })[stage] || "";
  const renderCases = (rows) =>
    rows
      .map(
        (c) =>
          `<li>${esc(c.subject)} · ${esc(name(c.districtId))} · ${esc(localizeLivingText(c.status, language))}${c.stage ? `<p>${esc(legalStage(c.stage))}</p>` : ""}${Number.isFinite(c.reportedAt) ? ` · ${label("Bildirim", "Reported", "Zgłoszono")} ${Math.floor(c.reportedAt / 1440) + 1}` : ""}${c.reviewDay ? ` · ${label("İnceleme günü", "Review day", "Dzień przeglądu")} ${c.reviewDay}` : ""}${Number.isFinite(c.decidedAt) ? ` · ${label("Karar günü", "Decision day", "Dzień decyzji")} ${Math.floor(c.decidedAt / 1440) + 1}` : ""}${c.fine ? ` · ${label("Ceza", "Fine", "Grzywna")} ${c.fine} TL` : ""}${c.compensation ? ` · ${label("Tazminat", "Compensation", "Odszkodowanie")} ${c.compensation} TL` : ""}${c.restrictionUntil ? ` · ${label("Kısıtlama bitiş günü", "Restriction ends on day", "Ograniczenie do dnia")} ${c.restrictionUntil}` : ""}<ul>${(c.evidence || []).map((e) => `<li>${esc(localizeLivingText(e.kind, language))}${e.source ? ` · ${esc(e.source)}` : ""} · ${label("Gözlem günü", "Observed on day", "Dzień obserwacji")} ${Math.floor(e.observedAt / 1440) + 1} · ${label("Öğrenildi", "Learned", "Poznano")} ${Math.floor(e.learnedAt / 1440) + 1}</li>`).join("")}</ul></li>`,
      )
      .join("");
  const caseRows = uw?.cases || [];
  const cases = renderCases(caseRows.filter((c) => c.scope !== "public" && c.scope !== "estate"));
  const estateCases = renderCases(caseRows.filter((c) => c.scope === "estate"));
  const publicCases = renderCases(caseRows.filter((c) => c.scope === "public"));
  const membership = uw?.membership;
  const sim = here?.simulation;
  const contacts = (view.districts.contacts || [])
    .map(
      (c) =>
        `<li>${esc(c.name)} · ${label("Bağ", "Relationship", "Relacja")} ${c.score}/100 · ${label("Son görüşme günü", "Last met on day", "Ostatnie spotkanie: dzień")} ${c.lastDay}</li>`,
    )
    .join("");
  return renderWorldMap({view, actions, actionCard, esc, language, selectedDistrict, localize:localizeLivingText}) + afterMap + `<section class="reference"><h3>${label("Yaşayan semtler", "Living districts", "Żyjące dzielnice")}</h3>${sim ? `<p>${label("Talep", "Demand", "Popyt")} ${sim.demand} · ${label("Kira baskısı", "Rent pressure", "Presja czynszowa")} ${sim.rentPressure} · ${label("İş olanakları", "Job openings", "Oferty pracy")} ${sim.jobOpenings} · ${label("Güvenlik", "Security", "Bezpieczeństwo")} ${sim.security} · ${label("Etki", "Influence", "Wpływy")} ${sim.influence}</p><p>${label("Yemek stoğu", "Meal stock", "Zapas posiłków")} ${sim.foodStock} · ${label("Malzeme stoğu", "Material stock", "Zapas materiałów")} ${sim.materialStock} · ${label("Hizmet gecikmesi", "Service delay", "Opóźnienie usług")} ${sim.serviceDelay} ${label("dk", "min", "min")}</p><p>${label("Talep ve kira endekslerinde 100 şehir ölçeğindeki başlangıçtır; iş olanakları açık pozisyon sayısıdır.", "Demand and rent indices use 100 as the city baseline; job openings are available positions.", "Indeksy popytu i czynszu mają bazę miejską 100; oferty pracy to liczba wolnych miejsc.")}</p>` : ""}${contacts ? `<h4>${label("Yerel ilişkiler", "Local relationships", "Lokalne relacje")}</h4><ul>${contacts}</ul>` : ""}${essentials.length ? `<h4>${label("Günlük ihtiyaçlar", "Daily needs", "Codzienne potrzeby")}</h4><div class="action-grid">${essentials.map((action) => actionCard(action)).join("")}</div>` : ""}${publicHint}${housingLink}<div class="action-grid">${other.map((action) => actionCard(action)).join("")}</div>${chapters || organizationActions.length ? `<details><summary>${label("Yerel örgütler", "Local organizations", "Lokalne organizacje")}</summary><div class="action-grid">${organizationActions.map((action) => actionCard(action)).join("")}</div><ul>${chapters}</ul></details>` : ""}${membership ? `<p>${esc(membership.name)} · ${esc(localizeLivingText(membership.rank, language))} · ${label("Güven", "Trust", "Zaufanie")} ${membership.trust} · ${label("Sorumluluk", "Responsibility", "Odpowiedzialność")} ${membership.responsibility} · ${esc(localizeLivingText(membership.status, language))}${membership.task ? `<br>${esc(localizeLivingText(membership.task.type, language))} · ${esc(localizeLivingText(membership.task.status, language))} · ${label("Son gün", "Due day", "Termin")} ${Math.floor(membership.task.dueAt / 1440) + 1} · ${label("Ödül", "Reward", "Nagroda")} ${membership.task.reward} TL` : ""}</p>` : ""}${cases ? `<h4>${label("Kişisel hukuki dosyalar", "Personal legal cases", "Osobiste sprawy prawne")}</h4><ul>${cases}</ul>` : ""}${estateCases ? `<h4>${label("Tereke yükümlülükleri", "Estate obligations", "Zobowiązania spadkowe")}</h4><ul>${estateCases}</ul>` : ""}${publicCases ? `<h4>${label("Kamuya açık kararlar", "Public decisions", "Jawne orzeczenia")}</h4><ul>${publicCases}</ul>` : ""}</section>`;
}
