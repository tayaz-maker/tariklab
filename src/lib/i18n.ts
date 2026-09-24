import { useEffect, useState } from "react";
import { EXTRA_PHRASE } from "@/lib/i18n-phrases";

export const LANG_KEY = "tariklab.language";
export const LOCALES = ["tr", "en", "pl"] as const;
export type Lang = (typeof LOCALES)[number];

export function normalizeLang(value: unknown): Lang {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
    ? (value as Lang)
    : "tr";
}

const EN: Record<string, string> = {
  "portal.lab": "Game Lab",
  "portal.games": "Games",
  "portal.playableCount": "{n} playable",
  "portal.category.strategy": "Strategy & Power",
  "portal.category.life": "Life & Management",
  "portal.category.dossier": "Dossiers & Investigation",
  "portal.category.tabletop": "Cards & Tabletop",
  "portal.soon": "Coming Soon",
  "portal.sources": "Resources",
  "portal.back": "← Games",
  "portal.openGame": "Open {title}",
  "footer.rights": "© 2026 TarikLab. All rights reserved.",
  "lang.label": "Language",
  "common.save": "Save",
  "common.load": "Load",
  "common.delete": "Delete",
  "common.newGame": "New Game",
  "common.continue": "Continue",
  "common.howTo": "How to Play",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.cancel": "Cancel",
  "common.slot": "Slot",
  "common.emptySlot": "Empty slot",
  "common.corruptSave": "Corrupt save",
  "common.active": "active",
  "cete.ageTitle": "18+ confirmation",
  "cete.ageBody":
    "Fictional underground simulation. Not an invitation to real gambling, drugs or violence. Leave if you are under 18.",
  "cete.ageBtn": "I am 18 or older",
  "cete.openFile": "Open a file",
  "cete.createTitle": "Your name, hood, racon",
  "cete.createBody":
    "No account needed. Slot {n} stays on this device. You arrive with empty pockets.",
  "cete.name": "Name",
  "cete.hood": "Neighborhood",
  "cete.street": "Hit the street",
  "cete.locked": "The game locked up",
  "cete.lockedBody": "The save is still there. Continue without refreshing.",
  "cete.slotsTitle": "Three save slots",
  "cete.slotsBody":
    "No account needed. Each slot stays separate on this device. A full slot is not overwritten without asking.",
  "cete.saveDone": "Save complete.",
  "cete.saveDeleted": "Save deleted.",
  "cete.saveFail": "Could not finish. The save may be corrupt, or the device is blocking storage.",
  "cete.tab.ben": "Me",
  "cete.tab.icraat": "Jobs",
  "cete.tab.tezgah": "Shop",
  "cete.tab.emlak": "Property",
  "cete.tab.sokak": "Street",
  "cete.tab.hayat": "Life",
  "cete.tab.klinik": "Clinic",
};

const PL: Record<string, string> = {
  "portal.lab": "Laboratorium gier",
  "portal.games": "Gry",
  "portal.playableCount": "{n} gier dostępnych",
  "portal.category.strategy": "Strategia i władza",
  "portal.category.life": "Życie i zarządzanie",
  "portal.category.dossier": "Akta i śledztwa",
  "portal.category.tabletop": "Karty i gry stołowe",
  "portal.soon": "Wkrótce",
  "portal.sources": "Materiały źródłowe",
  "portal.back": "← Gry",
  "portal.openGame": "Otwórz: {title}",
  "footer.rights": "© 2026 TarikLab. Wszelkie prawa zastrzeżone.",
  "lang.label": "Język",
  "common.save": "Zapisz",
  "common.load": "Wczytaj",
  "common.delete": "Usuń",
  "common.newGame": "Nowa gra",
  "common.continue": "Kontynuuj",
  "common.howTo": "Jak grać",
  "common.close": "Zamknij",
  "common.confirm": "Potwierdź",
  "common.cancel": "Anuluj",
  "common.slot": "Slot",
  "common.emptySlot": "Pusty slot",
  "common.corruptSave": "Uszkodzony zapis",
  "common.active": "aktywny",
};

export const CATALOG_EN: Record<string, { title: string; subtitle: string }> = {
  "cete-savaslari": { title: "Çete Savaşları", subtitle: "Racon, district, cash in TL." },
  hanedanian: {
    title: "HANEDANIAN",
    subtitle: "From one settlement to a great dynasty. Read the map, build your future.",
  },
  racon: { title: "Racon Manager", subtitle: "Men die. The name remains." },
  "tc-sim": { title: "TC SIM", subtitle: "One life. Weekly choices, years of fallout." },
  bukucu: {
    title: "Son Mahalle Bükücü",
    subtitle: "Istanbul title deed. Who holds the district bends it. Money in TL.",
  },
  labirent: { title: "Labirent", subtitle: "Closed paths, one exit." },
  "peg-solitaire": { title: "Tek Taş", subtitle: "Jump. Leave one." },
  satranc: { title: "Satranç", subtitle: "Board, move, checkmate." },
  "amiral-batti": { title: "Amiral Battı", subtitle: "Fleet on a grid. Hit, miss, sunk." },
  apartman: {
    title: "Kapı Nöbeti",
    subtitle: "A night courtyard, a maintenance queue, trust and cash. Three decisions on the desk.",
  },
  "kayip-telefon": {
    title: "Kayıp Telefon",
    subtitle: "A phone is lost. The life inside it surfaces.",
  },
  "son-100-gun": {
    title: "Son 100 Gün",
    subtitle: "The last hundred days. Every choice weighs more.",
  },
  "son-kasaba": {
    title: "SON KÖY MANAGER",
    subtitle: "Everyone is leaving. You stay and try to keep the village standing.",
  },
  "tc-sim-devlet": {
    title: "TC SIM: DEVLET",
    subtitle: "A multi-era state simulation. Institutions, economy and society from 1923 to 2030.",
  },
  "veto-h": { title: "VETO-H!", subtitle: "Election night. Build your campaign and answer your rival’s move." },
  "gett-oh": { title: "GETT-OH!", subtitle: "Istanbul at night. Field your crew and play your street power." },
  ihtilal: { title: "İhtilâl", subtitle: "The ruling is written. The archive does not forget." },
  "darbe-h": { title: "DARBE-H!", subtitle: "The telex lands. The desk decides." },
  "jitem-derin-ag": {
    title: "JITEM: Derin Ağ",
    subtitle: "1986–1996. Files don't stay buried. The network grows.",
  },
};

// Cached catalog consumers may still request the supported legacy route alias.
CATALOG_EN.hanedan = CATALOG_EN.hanedanian;

export const CATALOG_PL: Record<string, { title: string; subtitle: string }> = {
  "cete-savaslari": { title: "Çete Savaşları", subtitle: "Racon, dzielnica, gotówka w TL." },
  hanedanian: { title: "HANEDANIAN", subtitle: "Od jednej osady do wielkiej dynastii. Czytaj mapę, buduj przyszłość." },
  racon: { title: "Racon Manager", subtitle: "Ludzie umierają. Imię zostaje." },
  "tc-sim": { title: "TC SIM", subtitle: "Jedno życie. Tygodniowe wybory, lata konsekwencji." },
  bukucu: { title: "Son Mahalle Bükücü", subtitle: "Stambułskie akty własności. Kto trzyma dzielnicę, ten nią rządzi. Pieniądze w TL." },
  labirent: { title: "Labirent", subtitle: "Zamknięte ścieżki, jedno wyjście." },
  "peg-solitaire": { title: "Tek Taş", subtitle: "Przeskakuj. Zostaw jeden pionek." },
  satranc: { title: "Satranç", subtitle: "Plansza, ruch, mat." },
  "amiral-batti": { title: "Amiral Battı", subtitle: "Flota na siatce. Trafienie, pudło, zatopienie." },
  apartman: { title: "Kapı Nöbeti", subtitle: "Nocny dziedziniec, kolejka napraw, zaufanie i kasa. Na biurku trzy decyzje." },
  "kayip-telefon": { title: "Kayıp Telefon", subtitle: "Telefon zaginął. Życie zapisane w środku wychodzi na jaw." },
  "son-100-gun": { title: "Son 100 Gün", subtitle: "Ostatnie sto dni. Każdy wybór waży więcej." },
  "son-kasaba": { title: "SON KÖY MANAGER", subtitle: "Wszyscy wyjeżdżają. Ty zostajesz i próbujesz utrzymać wieś przy życiu." },
  "tc-sim-devlet": { title: "TC SIM: DEVLET", subtitle: "Wieloepokowa symulacja państwa: instytucje, gospodarka i społeczeństwo od 1923 do 2030 roku." },
  "veto-h": { title: "VETO-H!", subtitle: "Noc wyborcza. Buduj kampanię i odpowiadaj na ruchy rywala." },
  "gett-oh": { title: "GETT-OH!", subtitle: "Stambuł nocą. Wystaw ekipę i rozegraj swoją uliczną siłę." },
  ihtilal: { title: "İHTİLÂL", subtitle: "Wyrok jest pisany. Archiwum nie zapomina." },
  "darbe-h": { title: "DARBE-H!", subtitle: "Nadchodzi teleks. Biurko podejmuje decyzję." },
  "jitem-derin-ag": { title: "JITEM: Derin Ağ", subtitle: "1986–1996. Akta nie pozostają pogrzebane. Sieć rośnie." },
};
CATALOG_PL.hanedan = CATALOG_PL.hanedanian;

export function catalogEntry(lang: Lang, slug: string, fallback: { title: string; subtitle: string }) {
  const catalog = lang === "en" ? CATALOG_EN : lang === "pl" ? CATALOG_PL : undefined;
  return catalog?.[slug] ?? fallback;
}

export const CETE_HELP_EN = [
  {
    title: "Aim",
    body: "Start on the street, build a crew, stack cash and reputation, hold your district. There is no single win beat; the till, reputation and staying alive move together.",
  },
  {
    title: "Core loop",
    body: "Take work from Jobs, kit weapons/armor/wheels from the Shop, press a corner or squeeze a district on the Street, grow a dealer corner in Property. Time runs on a real clock; speed it with ×N or skip with 'pass 1 hour'.",
  },
  {
    title: "Controls",
    body: "Tabs at the bottom (phone) or left (desktop) take you to Me, Jobs, Shop, Property, Street, Life and Clinic. The ledger icon shows recent events.",
  },
  {
    title: "Resources and meters",
    body: "Rounds & Stamina are energy, Racon & Charisma are toughness, Health is the body, Heat is police attention. When Heat rises, patrols and rival pressure rise. Till, investments, reputation and the bribe fund sit under Detail.",
  },
  {
    title: "Progress",
    body: "Work earns XP and rank; each rank has its own moniker. A season lasts 14 days and season score accumulates. Buy districts and grow corners for regular tribute.",
  },
  {
    title: "Risk and loss",
    body: "If Health drops under 20 or you get pinched you land in Clinic or holding; you cannot work for that stretch. A bribe fund can shorten holding. Cash you have not banked is at risk on the street while Heat is high.",
  },
  {
    title: "Saves",
    body: "The game autosaves on this device (localStorage). Sign in and progress also backs up to the cloud; guest play stays on this device only.",
  },
  {
    title: "First-run tips",
    body: "Do a few jobs first. Do not walk the street unarmed. If Heat is up, sit in the till for a while. Open a dealer corner early; regular income is the biggest swing. Learn to keep cash in the till.",
  },
  {
    title: "Note",
    body: "Fiction. Not an invitation to real gambling, drugs or violence. Gambling/bar beats on the Life tab are in-game fiction too.",
  },
];

export function readLang(): Lang {
  if (typeof window === "undefined") return "tr";
  try {
    return normalizeLang(window.localStorage.getItem(LANG_KEY));
  } catch {
    return "tr";
  }
}

export function writeLang(next: Lang) {
  try {
    window.localStorage.setItem(LANG_KEY, next);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    document.dispatchEvent(new CustomEvent("tlab-language", { detail: next }));
  }
}

export function translate(
  lang: Lang,
  key: string,
  fallback: string,
  vars?: Record<string, string | number>,
) {
  const dictionary = lang === "en" ? EN : lang === "pl" ? PL : undefined;
  let out = dictionary?.[key] ?? fallback;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>(() => readLang());
  useEffect(() => {
    document.documentElement.lang = lang;
    const onChange = (ev: Event) => {
      const next = normalizeLang((ev as CustomEvent).detail);
      setLangState(next);
      document.documentElement.lang = next;
    };
    document.addEventListener("tlab-language", onChange);
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === LANG_KEY || ev.key === null) {
        const next = readLang();
        setLangState(next);
        document.documentElement.lang = next;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("tlab-language", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [lang]);
  const setLang = (next: Lang) => {
    writeLang(next);
    setLangState(next);
  };
  const t = (key: string, fallback: string, vars?: Record<string, string | number>) =>
    translate(lang, key, fallback, vars);
  const phrase = (text: string) => {
    if (lang === "tr" || text == null) return text;
    return EXTRA_PHRASE[text] ?? text;
  };
  return { lang, setLang, t, phrase };
}
