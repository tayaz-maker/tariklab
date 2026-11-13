export const REGIONS = {
  istanbul: { name: "İstanbul", price: 115, employment: 109, population: 1860, wage: 510 },
  ankara: { name: "Ankara", price: 94, employment: 103, population: 840, wage: 465 },
  izmir: { name: "İzmir", price: 101, employment: 96, population: 650, wage: 485 },
};
const regionIds = Object.keys(REGIONS);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const DAY = 1440;
const whole = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const ownRegion = (id) => Object.hasOwn(REGIONS, id);
const worldCopy = {
  "Ailen, borçların ve mülklerin taşınma sonrasında devam eder.": [
    "Your family, debts and property carry over when you move.",
    "Po przeprowadzce zachowasz rodzinę, długi i nieruchomości.",
  ],
  "Yerel vardiyaya katıl": ["Work a local shift", "Podejmij lokalną zmianę"],
  "Uygun vardiya, yeterli enerji ve bugün tamamlanmamış bir vardiya gerekir.": [
    "You need an available shift and enough energy. You can work once per day.",
    "Potrzebujesz dostępnej zmiany i energii. Możesz pracować raz dziennie.",
  ],
  "Mahallede yemek ye": ["Eat in the neighborhood", "Zjedz posiłek w okolicy"],
  "Yemek ücreti şehrin fiyat düzeyine göre değişir.": [
    "The meal price reflects the city's price index.",
    "Cena posiłku zależy od poziomu cen w mieście.",
  ],
  "Şu anda yeterince toksun.": ["You are already full.", "Już nie jesteś głodny."],
  "Geceyi dinlenerek geçir": ["Rest for the night", "Odpocznij w nocy"],
  "Dinlenirken saat ve dünyanın rutinleri ilerler.": [
    "Time and the world's routines advance while you rest.",
    "Podczas odpoczynku płynie czas, a świat żyje swoim rytmem.",
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
  const wage = /^İş piyasasına bağlı ücret: (\d+) TL\.$/.exec(text);
  if (wage)
    return i === 0
      ? `Local market wage: ${wage[1]} TL.`
      : `Płaca na lokalnym rynku: ${wage[1]} TL.`;
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
    const enterprise = clamp((market?.workers ?? 0) - 4, -4, 6);
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
    const a = w.regions[from],
      b = w.regions[to];
    const moved = Math.min(
      12,
      Math.floor((score(to) - score(from)) / 8),
      Math.floor(a.population / 90),
    );
    if (moved > 0) {
      a.population -= moved;
      a.exits += moved;
      b.population += moved;
      b.arrivals += moved;
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
    actions.push({
      id: `world:move:${id}`,
      category: "world",
      pay: "total",
      label: `${target.name} şehrine taşın`,
      description: "Ailen, borçların ve mülklerin taşınma sonrasında devam eder.",
      cost: id === "istanbul" || w.region === "istanbul" ? 780 : 620,
      minutes: 360,
      disabled: false,
      reason: "",
      run(next) {
        const world = next.expansion.world;
        const from = world.region;
        if (next.job) api.settleCareer(next);
        next.city.venue = "";
        world.region = id;
        api.expansionEvent(next, "relocation", id, from);
        return `Yeni şehir: ${target.name}.`;
      },
    });
  }
  if (w.region === "istanbul") return actions;
  const offer = r.employment >= 80 && (day + (s.seed % 7)) % 7 < 5;
  const available = offer && day > w.lastShiftDay && s.player.energy >= 30;
  const wage = Math.floor((region.wage * r.employment) / 100);
  actions.push(
    {
      id: "world:shift",
      category: "world",
      pay: "total",
      label: "Yerel vardiyaya katıl",
      description: `İş piyasasına bağlı ücret: ${wage} TL.`,
      cost: 0,
      minutes: 360,
      disabled: !available,
      reason: "Uygun vardiya, yeterli enerji ve bugün tamamlanmamış bir vardiya gerekir.",
      run(next) {
        next.expansion.world.lastShiftDay = day;
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
      description: "Yemek ücreti şehrin fiyat düzeyine göre değişir.",
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
      description: "Dinlenirken saat ve dünyanın rutinleri ilerler.",
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

export function adaptWorldActions(s, actions) {
  if (s.expansion.world.region === "istanbul") return actions;
  // Gold's district, routes and appointments still represent İstanbul.
  // Explicit regional actions supply local work, care and transport.
  return actions.filter((a) =>
    /^(world:|family:|economy:|institution:|business:|event:|wait:|deposit:|withdraw:|repay:|finance:)/.test(
      a.id,
    ),
  );
}

export function validateWorld(s) {
  const w = s.expansion.world;
  const day = Math.floor(s.time / DAY) + 1;
  return (
    !!w &&
    ownRegion(w.region) &&
    whole(w.startedDay, 1, day) &&
    whole(w.lastShiftDay, 0, day) &&
    whole(w.cycle, 0, Math.floor((day - w.startedDay) / 30)) &&
    !!w.regions &&
    Object.keys(w.regions).length === regionIds.length &&
    regionIds.every((id) => {
      const r = w.regions[id];
      return (
        !!r &&
        whole(r.price, 60, 170) &&
        whole(r.employment, 60, 145) &&
        whole(r.population, 1, 1000000) &&
        [r.births, r.deaths, r.arrivals, r.exits].every((v) => whole(v, 0, 1000000)) &&
        r.population === REGIONS[id].population + r.births - r.deaths + r.arrivals - r.exits
      );
    }) &&
    regionIds.reduce((net, id) => net + w.regions[id].arrivals - w.regions[id].exits, 0) === 0
  );
}
