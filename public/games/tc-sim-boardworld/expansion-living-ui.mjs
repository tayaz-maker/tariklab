import { localizeDistrictText } from "./expansion-districts.mjs";
import { localizeUnderworldText } from "./expansion-underworld.mjs";

export function localizeLivingText(text, language) {
  return localizeUnderworldText(localizeDistrictText(text, language), language);
}
export function renderLiving({ view, actions, actionCard, esc, language }) {
  if (!view.districts) return "";
  const tr = language !== "en" && language !== "pl";
  const label = (a, b, c) => (tr ? a : language === "en" ? b : c);
  const { place, districts } = view.districts;
  const here = districts.find((d) => d.id === place.districtId);
  const localActions = actions.filter((a) => /^(district:|underworld:)/.test(a.id));
  const renderAction = (a) => actionCard({...a, label:localizeLivingText(a.label,language), description:localizeLivingText(a.description,language), reason:localizeLivingText(a.reason,language)});
  const goldHere = ["kadikoy", "besiktas", "sisli"].includes(place.districtId);
  const travel = [...localActions.filter((a) => a.id.startsWith("district:travel:")), ...(goldHere ? actions.filter((a) => /^travel:(kadikoy|besiktas|sisli)$/.test(a.id)) : [])];
  const visits = [...localActions.filter((a) => a.id.startsWith("district:visit:")), ...(goldHere ? actions.filter((a) => a.id.startsWith(`visit:${place.districtId}-`)) : [])];
  const other = localActions.filter((a) => !/^district:(travel|visit):/.test(a.id) && !a.id.startsWith("underworld:"));
  const organizationActions = localActions.filter((a) => a.id.startsWith("underworld:"));
  const essentials = actions.filter((a) => ["world:meal", "world:rest"].includes(a.id));
  const nearest = view.districts.nearestInstitution;
  const publicHere = here?.venues.some((v) => v.kind === "institution");
  const currentVenue = here?.venues.find((v) => v.id === place.venueId);
  const housingLink = currentVenue?.kind === "housing" ? `<p><button class="secondary" data-tab="expansion-finance">${label("Konut seçenekleri", "Housing options", "Opcje mieszkaniowe")} →</button></p>` : "";
  const publicHint = !publicHere && nearest ? `<p>${label("En yakın kamu merkezi", "Nearest public centre", "Najbliższe centrum usług publicznych")}: ${esc(nearest.districtName)} · ${esc(localizeLivingText(nearest.name,language))} · ${nearest.hours[0]}:00–${nearest.hours[1]}:00 · ${nearest.minutes} ${label("dk", "min", "min")}</p>` : "";
  const neighborhood = view.districts.neighborhoods?.find((n) => n.id === place.neighborhoodId);
  const neighborhoodName = neighborhood?.fictional ? label("Oyun mahallesi (kurgusal)", "Game neighborhood (fictional)", "Dzielnica gry (fikcyjna)") : neighborhood?.name;
  const cities = {istanbul:"İstanbul",ankara:"Ankara",izmir:"İzmir"};
  const neighborhoodGroups = (view.districts.neighborhoods || []).filter((n) => n.districtId === place.districtId).map((n) => {
    const cards = visits.filter((a) => here?.venues.some((v) => v.id === a.id.replace(/^(district:)?visit:/, "") && v.neighborhoodId === n.id));
    if (!cards.length) return "";
    const title = n.fictional ? label("Oyun mahallesi (kurgusal)", "Game neighborhood (fictional)", "Dzielnica gry (fikcyjna)") : n.name;
    return `<details open><summary>${esc(title)}</summary><div class="action-grid">${cards.map(renderAction).join("")}</div></details>`;
  }).join("");
  const picker = `<details><summary>${label("İlçe seç ve yolculuk et", "Choose a district and travel", "Wybierz dzielnicę i podróż")}</summary><div class="action-grid">${travel.map(renderAction).join("")}</div></details><h4>${label("Mahalle ve mekânlar", "Neighborhoods and places", "Okolice i miejsca")}</h4>${neighborhoodGroups}`;
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
  const renderCases = (rows) =>
    rows
      .map(
        (c) =>
          `<li>${esc(c.subject)} · ${esc(name(c.districtId))} · ${esc(localizeLivingText(c.status, language))}${Number.isFinite(c.reportedAt) ? ` · ${label("Bildirim", "Reported", "Zgłoszono")} ${Math.floor(c.reportedAt / 1440) + 1}` : ""}${c.reviewDay ? ` · ${label("İnceleme günü", "Review day", "Dzień przeglądu")} ${c.reviewDay}` : ""}${Number.isFinite(c.decidedAt) ? ` · ${label("Karar günü", "Decision day", "Dzień decyzji")} ${Math.floor(c.decidedAt / 1440) + 1}` : ""}${c.fine ? ` · ${label("Ceza", "Fine", "Grzywna")} ${c.fine} TL` : ""}${c.compensation ? ` · ${label("Tazminat", "Compensation", "Odszkodowanie")} ${c.compensation} TL` : ""}${c.restrictionUntil ? ` · ${label("Kısıtlama bitiş günü", "Restriction ends on day", "Ograniczenie do dnia")} ${c.restrictionUntil}` : ""}<ul>${(c.evidence || []).map((e) => `<li>${esc(localizeLivingText(e.kind, language))}${e.source ? ` · ${esc(e.source)}` : ""} · ${label("Gözlem günü", "Observed on day", "Dzień obserwacji")} ${Math.floor(e.observedAt / 1440) + 1} · ${label("Öğrenildi", "Learned", "Poznano")} ${Math.floor(e.learnedAt / 1440) + 1}</li>`).join("")}</ul></li>`,
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
  return `<section class="reference"><h3>${label("Yaşayan semtler", "Living districts", "Żyjące dzielnice")}</h3><p>${label("Bulunduğun yer", "Your location", "Twoja lokalizacja")}: <strong>${esc(cities[place.cityId] || "")} · ${esc(here?.name || "")} · ${esc(neighborhoodName || "")}</strong>${place.venueId ? ` · ${esc(localizeLivingText(here?.venues.find((v) => v.id === place.venueId)?.name || "", language))}` : ""}</p>${sim ? `<p>${label("Talep", "Demand", "Popyt")} ${sim.demand} · ${label("Kira baskısı", "Rent pressure", "Presja czynszowa")} ${sim.rentPressure} · ${label("İş olanakları", "Job openings", "Oferty pracy")} ${sim.jobOpenings} · ${label("Güvenlik", "Security", "Bezpieczeństwo")} ${sim.security} · ${label("Etki", "Influence", "Wpływy")} ${sim.influence}</p><p>${label("Yemek stoğu", "Meal stock", "Zapas posiłków")} ${sim.foodStock} · ${label("Malzeme stoğu", "Material stock", "Zapas materiałów")} ${sim.materialStock} · ${label("Hizmet gecikmesi", "Service delay", "Opóźnienie usług")} ${sim.serviceDelay} ${label("dk", "min", "min")}</p><p>${label("Talep ve kira endekslerinde 100 şehir ölçeğindeki başlangıçtır; iş olanakları açık pozisyon sayısıdır.", "Demand and rent indices use 100 as the city baseline; job openings are available positions.", "Indeksy popytu i czynszu mają bazę miejską 100; oferty pracy to liczba wolnych miejsc.")}</p>` : ""}${contacts ? `<h4>${label("Yerel ilişkiler", "Local relationships", "Lokalne relacje")}</h4><ul>${contacts}</ul>` : ""}${essentials.length ? `<h4>${label("Günlük ihtiyaçlar", "Daily needs", "Codzienne potrzeby")}</h4><div class="action-grid">${essentials.map(renderAction).join("")}</div>` : ""}${publicHint}${housingLink}${picker}<div class="action-grid">${other.map(renderAction).join("")}</div>${chapters || organizationActions.length ? `<details><summary>${label("Yerel örgütler", "Local organizations", "Lokalne organizacje")}</summary><div class="action-grid">${organizationActions.map(renderAction).join("")}</div><ul>${chapters}</ul></details>` : ""}${membership ? `<p>${esc(membership.name)} · ${esc(localizeLivingText(membership.rank, language))} · ${label("Güven", "Trust", "Zaufanie")} ${membership.trust} · ${label("Sorumluluk", "Responsibility", "Odpowiedzialność")} ${membership.responsibility} · ${esc(localizeLivingText(membership.status, language))}${membership.task ? `<br>${esc(localizeLivingText(membership.task.type, language))} · ${esc(localizeLivingText(membership.task.status, language))} · ${label("Son gün", "Due day", "Termin")} ${Math.floor(membership.task.dueAt / 1440) + 1} · ${label("Ödül", "Reward", "Nagroda")} ${membership.task.reward} TL` : ""}</p>` : ""}${cases ? `<h4>${label("Kişisel hukuki dosyalar", "Personal legal cases", "Osobiste sprawy prawne")}</h4><ul>${cases}</ul>` : ""}${estateCases ? `<h4>${label("Tereke yükümlülükleri", "Estate obligations", "Zobowiązania spadkowe")}</h4><ul>${estateCases}</ul>` : ""}${publicCases ? `<h4>${label("Kamuya açık kararlar", "Public decisions", "Jawne orzeczenia")}</h4><ul>${publicCases}</ul>` : ""}</section>`;
}
