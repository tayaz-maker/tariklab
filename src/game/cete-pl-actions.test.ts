import { test } from "node:test";
import assert from "node:assert/strict";
import { hydratePlayer, makeRivals, MARKET_START, ALL_ITEMS } from "./data";
import { polishLog } from "./cete-pl-log";
const storage = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    },
    location: { search: "" },
    addEventListener() {},
  },
  document: { addEventListener() {} },
});
const { useGame } = await import("./store");
type State = ReturnType<typeof useGame.getState>;
const variants: [string, (s: State) => void][] = [
  ["buyItem", (s) => s.buyItem("w102")],
  ["sellItem", (s) => s.sellItem("w102")],
  ["buyEstate", (s) => s.buyEstate("r101")],
  ["upgradeEstate", (s) => s.upgradeEstate("r105")],
  ["attackRival", (s) => s.attackRival(s.rivals[0].id)],
  ["bounty", (s) => s.putBounty(s.rivals[0].id, 5000)],
  ["hunt", (s) => s.huntBounty(s.rivals[0].id)],
  ["bribe", (s) => s.depositBribe(2000)],
  ["pay-bribe", (s) => s.payBribe()],
  ["clinic", (s) => s.treatClinic()],
  ["hire", (s) => s.hireCrew("avukat")],
  ["fire", (s) => s.fireCrew("gozcu")],
  ["turf", (s) => s.pressTurf("eyup")],
  ["snitch", (s) => s.snitchHood("eyup")],
  ["traders", (s) => s.sitEsnafBar("eyup")],
  ["deposit", (s) => s.bankMove(1000, "in")],
  ["withdraw", (s) => s.bankMove(1000, "out")],
  ["borrow", (s) => s.writeSenet("borc")],
  ["lend", (s) => s.writeSenet("alacak", s.rivals[0].id)],
  ...(["bira", "raki", "esrar", "pavyon", "okey", "evlen", "bosan", "cocuk"] as const).map(
    (x): [string, (s: State) => void] => [`live-${x}`, (s) => s.live(x)],
  ),
  ...(["slot", "kazi", "blackjack", "rulet"] as const).map((x): [string, (s: State) => void] => [
    `gamble-${x}`,
    (s) => s.gamble(x, 1000),
  ]),
  ["bet", (s) => s.betRace(0, 1000)],
  ["horse", (s) => s.buyHorse()],
  ["train", (s) => s.trainHorse()],
  ["race", (s) => s.raceHorse()],
  ...(["flort", "hediye", "randevu", "baslat", "gece", "evlen", "bitir"] as const).map(
    (x): [string, (s: State) => void] => [`relate-${x}`, (s) => s.relate("p1", x)],
  ),
  ...(["evlen", "ustlen", "reddet"] as const).map((x): [string, (s: State) => void] => [
    `family-${x}`,
    (s) => s.resolveFamily(x),
  ]),
  ["invest-buy", (s) => s.tradeInvest("usd", "al", 100)],
  ["invest-sell", (s) => s.tradeInvest("usd", "sat", 100)],
  ["corner", (s) => s.fundKose()],
  ["daily", (s) => s.claimDaily()],
  ["season", (s) => s.ackSeason()],
  ["skip-hour", (s) => s.skipHour()],
];
test("real game actions generate translatable Polish log messages", () => {
  const missing = new Map<string, string>(),
    generated = new Map<string, number>();
  let rng = 123;
  const old = Math.random;
  Math.random = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  try {
    for (const [key, action] of variants)
      for (let j = 0; j < 30; j++) {
        const player = hydratePlayer({
          name: "QA",
          neighborhood: "eyup",
          level: 10,
          health: 80,
          cash: 1000000,
          bank: 5000,
          usd: 200,
          itibar: 80,
          jobsDone: 20,
          energy: 60,
          stamina: 32,
          crew: ["gozcu"],
          properties: ["r105"],
          inventory: ALL_ITEMS.map((x) => x.id),
          tutorialStep: 4,
          relations: { p1: 80 },
          girlfriend: "p1",
          pendingFamily: { partnerId: "p1", name: "Cansu" },
          horse: { name: "Test", speed: 5, form: 50 },
          eventCooldown: 9999,
        });
        const rivals = makeRivals();
        rivals[0] = { ...rivals[0], bounty: 5000 };
        useGame.setState({ player, rivals, logs: [], market: { ...MARKET_START } });
        if (key === "buyItem") useGame.setState({ player: { ...player, inventory: [] } });
        if (key === "horse") useGame.setState({ player: { ...player, horse: null } });
        if (key === "pay-bribe") useGame.setState({ player: { ...player, durum: "nezaret", durumTick: 6 } });
        if (key === "season") useGame.setState({ player: { ...player, pendingSeasonCeremony: { score: 90, title: "İstanbul'un babası", bonus: 590 } } });
        if (key === "relate-baslat") useGame.setState({ player: { ...player, girlfriend: null } });
        if (key === "live-bosan" || key === "live-cocuk")
          useGame.setState({ player: { ...player, married: true, spouse: "Cansu" } });
        if (key === "relate-evlen" || key === "live-evlen")
          useGame.setState({ player: { ...player, married: false } });
        action(useGame.getState());
        for (const l of useGame.getState().logs) {
          generated.set(key, (generated.get(key) || 0) + 1);
          if (polishLog(l.text) === l.text) missing.set(key, l.text);
        }
      }
  } finally {
    Math.random = old;
  }
  assert.equal(generated.size, variants.length, "every action must actually generate a log");
  assert.deepEqual(Object.fromEntries(missing), {}, "untranslated generated log");
});
