import { expandGame } from "./engine.mjs";
import { loadExpansionLocked, saveExpansionLocked } from "./persistence.mjs";
// Optional panel copy and rendering; importing this module does not load the simulation.
const expansionIntro = {
  tr: [
    "Nesiller",
    "Bu hayatı nesiller boyunca sürdür",
    "Aile, mülk, kurumlar ve şehirler aynı dünyada gelişir.",
    "Mevcut kayıttan devam et",
  ],
  en: [
    "Generations",
    "Carry this life across generations",
    "Families, property, institutions and cities grow in one world.",
    "Continue from this save",
  ],
  pl: [
    "Pokolenia",
    "Kontynuuj życie przez pokolenia",
    "Rodziny, nieruchomości, instytucje i miasta rozwijają się w jednym świecie.",
    "Kontynuuj z tego zapisu",
  ],
};
export function renderGenerations(state, expansionUi, cachedView, actions, actionCard, sectionHeader, money, esc, language, expansionProblem, tab = "expansion") {
  const [name, headline, description, start] = expansionIntro[language] ?? expansionIntro.tr;
  if (state.expansion)
    return expansionUi.renderExpansion({
      view: cachedView("expansion", () => expansionUi.getExpansionView(state)),
      actions,
      actionCard,
      sectionHeader: (region) => sectionHeader(name, region, description),
      money,
      esc,
      language,
      section: tab === "expansion-world" ? "world" : tab === "expansion-finance" ? "finance" : "family",
    });
  return `${sectionHeader(name, headline, description)}${expansionProblem ? `<p role="alert">${esc(expansionProblem)}</p><button class="primary" data-ui="import">Kayıt dosyası yükle</button>` : `<button class="primary" data-ui="expand">${esc(start)}</button>`}`;
}

// Explicit opt-in is checked against the current authoritative generation before
// loading the simulation; its eventual write repeats the same CAS in IndexedDB.
export async function activateExpansion(state, saveToken, prepare) {
  const current = await loadExpansionLocked();
  if (!current.token || current.saved)
    return { ok: false, message: current.message || "Nesiller kaydını yüklemek için sayfayı yenile." };
  if (current.token.generation !== saveToken?.generation)
    return { ok: false, message: "Başka bir sekme kaydı değiştirdi. Devam etmeden önce sayfayı yenile." };
  await prepare();
  const expanded = expandGame(state);
  const saved = await saveExpansionLocked(expanded, undefined, current.token);
  return { ...saved, state: expanded };
}
