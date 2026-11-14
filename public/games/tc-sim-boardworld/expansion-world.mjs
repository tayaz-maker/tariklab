import { hubDistrict, routeBetween } from "./expansion-geography.mjs";
export const REGIONS = {
  istanbul: { name: "İstanbul", price: 115, employment: 109, population: 1860, wage: 510 },
  ankara: { name: "Ankara", price: 94, employment: 103, population: 840, wage: 465 },
  izmir: { name: "İzmir", price: 101, employment: 96, population: 650, wage: 485 },
};
const regionIds = Object.keys(REGIONS);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const DAY = 1440;
const ownRegion = (id) => Object.hasOwn(REGIONS, id);
const goldPlace = (s) => s.expansion.world.region === "istanbul" &&
  ["kadikoy", "besiktas", "sisli"].includes(s.expansion.districts?.place?.districtId ?? s.location);
const worldCopy = {
  "Yeni İstanbul planları için önce İstanbul'a dön.": [
    "Return to Istanbul before making new Istanbul plans.",
    "Wróć do Stambułu przed ustaleniem nowych planów w tym mieście.",
  ],
  "Yerel vardiyayı tamamladın.": ["Local shift completed.", "Ukończono lokalną zmianę."],
  "Mahallede sıcak yemek yedin.": [
    "You ate a hot meal nearby.",
    "Zjedzono ciepły posiłek w okolicy.",
  ],
  "Dinlenip enerjini topladın.": [
    "You rested and regained energy.",
    "Odpoczęto i odzyskano energię.",
  ],
  "Taşınınca aile, borç ve mülk korunur.": [
    "Family, debts and property carry over.",
    "Po przeprowadzce zachowasz rodzinę, długi i nieruchomości.",
  ],
  "Yerel vardiyaya katıl": ["Work a local shift", "Podejmij lokalną zmianę"],
  "Uygun vardiya, yeterli enerji ve bugün tamamlanmamış bir vardiya gerekir.": [
    "You need an available shift and enough energy. You can work once per day.",
    "Potrzebujesz dostępnej zmiany i energii. Możesz pracować raz dziennie.",
  ],
  "Ücret ayırabilen açık bir yerel işletme yok.": [
    "No open local firm has funds for a shift.",
    "Żadna czynna lokalna firma nie ma środków na zmianę.",
  ],
  "Mahallede yemek ye": ["Eat in the neighborhood", "Zjedz posiłek w okolicy"],
  "Yemek ücreti şehir fiyatlarına bağlı.": [
    "Meal cost follows local prices.",
    "Koszt posiłku zależy od cen w mieście.",
  ],
  "Şu anda yeterince toksun.": ["You are already full.", "Już nie jesteś głodny."],
  "Geceyi dinlenerek geçir": ["Rest for the night", "Odpocznij w nocy"],
  "Dinlenirken zaman ve rutinler ilerler.": [
    "Time and world routines advance while you rest.",
    "Odpoczynek przesuwa czas i rutyny świata.",
  ],
  "Şu anda yeterince dinlenmişsin.": [
    "You are already rested.",
    "Masz wystarczająco dużo energii.",
  ],
};

export function localizeWorldText(text, language) {
  if (language !== "en" && language !== "pl") return text;
  const i = language === "en" ? 0 : 1;
  const move = /^(.+) şehrine taşın$/.exec(text);
  if (move) return i === 0 ? `Move to ${move[1]}` : `Przeprowadź się: ${move[1]}`;
  const wage = /^(.+) · Vardiya ücreti: (\d+) TL\.$/.exec(text);
  if (wage)
    return i === 0
      ? `${wage[1]} · Shift pay: ${wage[2]} TL.`
      : `${wage[1]} · Stawka za zmianę: ${wage[2]} TL.`;
  return worldCopy[text]?.[i] ?? text;
}

export function initWorld(s) {
  s.expansion.world = {
    region: "istanbul",
    regions: Object.fromEntries(
      regionIds.map((id) => {
        const { price, employment, population } = REGIONS[id];
        return [id, { price, employment, population, births: 0, deaths: 0, arrivals: 0, exits: 0 }];
      }),
    ),
    startedDay: Math.floor(s.time / DAY) + 1,
    lastShiftDay: 0,
    cycle: 0,
  };
}

export function migratePopulation(s, from, to, count) {
  const regions = s.expansion.world.regions;
  regions[from].population -= count;
  regions[from].exits += count;
  regions[to].population += count;
  regions[to].arrivals += count;
}

export function tickRegions(s, api, markets) {
  const w = s.expansion.world,
    day = api.dayOf(s),
    period = Math.floor((day - w.startedDay) / 30);
  if (period <= w.cycle) return;
  w.cycle = period;
  const cycle = [2, 5, 4, 0, -3, -6, -3, 1][(period + (s.seed % 8)) % 8];
  for (const id of regionIds) {
    const r = w.regions[id],
      market = markets?.[id],
      base = REGIONS[id];
    const prior = r.employment;
    const enterprise = clamp(Math.round(3 * ((market?.workers ?? 0) - (market?.jobseekers ?? 0)) /
      Math.max(1, market?.businesses ?? 3)) - 4, -8, 6);
    r.employment = clamp(
      Math.round((3 * prior + base.employment) / 4) + cycle + enterprise,
      60,
      145,
    );
    r.price = clamp(
      Math.round((r.price * 3 + base.price) / 4) + Math.trunc((r.employment - 100) / 5),
      60,
      170,
    );
    const born = Math.max(1, Math.floor(r.population / 650)),
      died = Math.max(1, Math.floor(r.population / (period % 12 < 8 ? 900 : 500)));
    r.births += born;
    r.deaths += died;
    r.population += born - died;
    if (prior >= 92 !== r.employment >= 92)
      api.expansionEvent(s, r.employment < 92 ? "downturn" : "recovery", id, String(r.employment));
  }
  const score = (id) => w.regions[id].employment * 2 - w.regions[id].price;
  const ordered = [...regionIds].sort((a, b) => score(b) - score(a));
  const to = ordered[0],
    from = ordered.at(-1);
  if (score(to) - score(from) >= 14) {
    const a = w.regions[from];
    const moved = Math.min(
      12,
      Math.floor((score(to) - score(from)) / 8),
      Math.floor(a.population / 90),
    );
    if (moved > 0) {
      migratePopulation(s, from, to, moved);
      api.expansionEvent(s, "migration", from, `${to}:${moved}`);
    }
  }
}

export function worldActions(s, api) {
  const w = s.expansion.world,
    region = REGIONS[w.region],
    r = w.regions[w.region],
    day = api.dayOf(s);
  const actions = [];
  for (const [id, target] of Object.entries(REGIONS)) {
    if (id === w.region) continue;
    const place = api.getPlace(s);
    const route = routeBetween(s, place.venueId || place.districtId, hubDistrict(id));
    actions.push({
      id: `world:move:${id}`,
      category: "world",
      pay: "total",
      label: `${target.name} şehrine taşın`,
      description: "Taşınınca aile, borç ve mülk korunur.",
      cost: route.cost,
      minutes: route.minutes,
      disabled: !route.available,
      reason: route.reason,
      route,
      run(next) {
        next._transit = true;
        return `Yeni şehir: ${target.name}.`;
      },
    });
  }
  if (goldPlace(s)) return actions;
  const wage = Math.floor((region.wage * r.employment) / 100);
  const firm = api.regionalShift?.(s, w.region, wage);
  const available =
    firm &&
    r.employment >= 80 &&
    (day - 1) % 7 < 5 &&
    day > w.lastShiftDay &&
    s.player.energy >= 30 &&
    s.bank + wage <= 1_000_000_000;
  actions.push(
    {
      id: "world:shift",
      category: "world",
      pay: "total",
      label: "Yerel vardiyaya katıl",
      description: firm
        ? `${firm.name} · Vardiya ücreti: ${wage} TL.`
        : "Ücret ayırabilen açık bir yerel işletme yok.",
      cost: 0,
      minutes: 360,
      disabled: !available,
      reason: "Uygun vardiya, yeterli enerji ve bugün tamamlanmamış bir vardiya gerekir.",
      run(next) {
        next.expansion.world.lastShiftDay = day;
        const employer = next.expansion.economy.firms[firm.id];
        employer.cash -= wage;
        employer.costs = Math.min(1_000_000_000, employer.costs + wage);
        next.flags.workDays++;
        api.receive(next, wage, "Yerel vardiya", "bank");
        api.change(next, { energy: -17, stress: 7 });
        return "Yerel vardiyayı tamamladın.";
      },
    },
    {
      id: "world:meal",
      category: "world",
      pay: "total",
      label: "Mahallede yemek ye",
      description: "Yemek ücreti şehir fiyatlarına bağlı.",
      cost: Math.round((90 * r.price) / 100),
      minutes: 40,
      disabled: s.player.hunger >= 95,
      reason: "Şu anda yeterince toksun.",
      run(next) {
        api.change(next, { hunger: 37, stress: -3 });
        return "Mahallede sıcak yemek yedin.";
      },
    },
    {
      id: "world:rest",
      category: "world",
      pay: "total",
      label: "Geceyi dinlenerek geçir",
      description: "Dinlenirken zaman ve rutinler ilerler.",
      cost: 0,
      minutes: 480,
      sleeping: true,
      disabled: s.player.energy >= 92,
      reason: "Şu anda yeterince dinlenmişsin.",
      run(next) {
        api.change(next, { energy: 57, stress: -12 });
        return "Dinlenip enerjini topladın.";
      },
    },
  );
  return actions;
}

export function calendarPlanningReason(s) {
  return s.expansion && !goldPlace(s)
    ? "Yeni İstanbul planları için önce İstanbul'a dön."
    : "";
}

export function adaptWorldActions(s, actions) {
  if (goldPlace(s)) return actions;
  // Gold's district, routes and appointments still represent İstanbul.
  // Explicit regional actions supply local work, care and transport.
  return actions.filter(({ id }) =>
    /^(district:|underworld:|world:|family:|economy:|institution:|business:|event:|wait:|deposit:|withdraw:|repay:|finance:|arrears:pay$|household:collect:|calendar:(cancel|decline|repeat-stop):)/.test(id) ||
    (s.expansion.economy.home && /^(?:sleep$|cook$|buy:groceries$|household:(?:buy:|maintain$)|flow:(?:care$|payments:))/.test(id)),
  );
}

export function validateWorld(s) {
  const w = s.expansion.world;
  const day = Math.floor(s.time / DAY) + 1;
  return (
    !!w &&
    ownRegion(w.region) &&
    integer(w.startedDay, 1, day) &&
    integer(w.lastShiftDay, 0, day) &&
    integer(w.cycle, 0, Math.floor((day - w.startedDay) / 30)) &&
    !!w.regions &&
    Object.keys(w.regions).length === regionIds.length &&
    regionIds.every((id) => {
      const r = w.regions[id];
      return (
        !!r &&
        integer(r.price, 60, 170) &&
        integer(r.employment, 60, 145) &&
        integer(r.population, 1, 1000000) &&
        [r.births, r.deaths, r.arrivals, r.exits].every((v) => integer(v, 0, 1000000)) &&
        r.population === REGIONS[id].population + r.births - r.deaths + r.arrivals - r.exits
      );
    }) &&
    regionIds.reduce((net, id) => net + w.regions[id].arrivals - w.regions[id].exits, 0) === 0
  );
}

/** Shared expansion-only field constraints; relation checks stay with their owner.
 * Groups name fields with one rule: a nonnegative integer ceiling, [min,max,nullable],
 * boolean type, a space-delimited enum, or null for a separately checked field.
 * Object policies intentionally retain the old validators: 0 permits extra keys,
 * 1 requires exact own keys, and 2 also requires Object.prototype.
 */
export const integer = (value, min = 0, max = 1e9) =>
  Number.isSafeInteger(value) && value >= min && value <= max;
export function shape(value, groups, exact = 0) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (exact === 2 && Object.getPrototypeOf(value) !== Object.prototype)
  )
    return false;
  let count = 0;
  for (const [fields, rule] of Object.entries(groups))
    for (const key of fields.split(" ")) {
      count++;
      if (exact && !Object.hasOwn(value, key)) return false;
      const item = value[key];
      if (
        rule !== null &&
        !(typeof rule === "number"
          ? integer(item, 0, rule)
          : rule === true
            ? typeof item === "boolean"
            : typeof rule === "string"
              ? rule.split(" ").includes(item)
              : (rule[2] && item === null) ||
                (Number.isSafeInteger(item) && item >= rule[0] && item <= rule[1]))
      )
        return false;
    }
  return !exact || Object.keys(value).length === count;
}
