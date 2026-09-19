import { ARCHETYPES, DESKS } from "./decks.js";
import { cardOf } from "./cards.js";
import { labelDesk } from "./copy.js";

export function endReport(state, lang = "tr") {
  const tr = lang !== "en";
  const result = state.result || { winner: "draw", reason: "time" };
  const you = result.winner === 0;
  const draw = result.winner === "draw";
  const reasonMap = {
    hukum: tr ? "Hüküm 10 yazıldı." : "Ruling 10 was written.",
    dagilma: tr ? "Isı 100'e çıktı; kurul dağıldı." : "Heat hit 100; the board dissolved.",
    exhaust: tr ? "Evrak tükendi." : "The papers ran out.",
    skip: tr ? "Kalemler üst üste sustu." : "The pens fell silent in a row.",
    time: tr ? "Kırk tur doldu." : "Forty turns elapsed.",
  };
  const locks = DESKS.map((d) => ({
    desk: d,
    lock: state.desks[d].lock,
    presence: state.desks[d].presence.slice(),
  }));
  const plays = state.log.filter((r) => r.k === "play" || r.k === "counter");
  const byCard = {};
  for (const row of plays) {
    byCard[row.c] = (byCard[row.c] || 0) + 1;
  }
  const repeated = Object.entries(byCard)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({ id, n, title: cardOf(id)?.title?.[lang] || cardOf(id)?.title?.tr || id }));
  const turning = state.log.find((r) => r.k === "steal-lock") || state.log.find((r) => r.k === "lock") || plays[Math.floor(plays.length / 2)];
  const turningLabels = tr
    ? { "steal-lock": "kilit el değiştirdi", lock: "masa kilitlendi", play: "dosya oynandı", counter: "karşı dosya oynandı" }
    : { "steal-lock": "lock changed hands", lock: "desk locked", play: "file played", counter: "counter file played" };
  const turningLabel = turningLabels[turning?.k] || (tr ? "masa değişti" : "board changed");
  const families = Object.entries(state.familyClaim)
    .filter(([k, v]) => !k.includes(":locked") && v.n >= 2)
    .map(([k, v]) => ({ key: k, n: v.n, family: v.family }));
  const chains = Object.values(state.chains || {}).filter((c) => c.step >= 2);
  const crises = state.log.filter((r) => r.k === "repeat-heat" || r.k === "dagilma" || r.k === "artci-overflow");
  const lockCounts = [0, 1].map(owner => locks.filter(row => row.lock === owner).length);
  const comparison = result.reason === "hukum"
    ? (tr ? `Hüküm: sen ${state.players[0].hukum}, rakip ${state.players[1].hukum}. 10'a ilk ulaşan kazanır.` : `Ruling: you ${state.players[0].hukum}, rival ${state.players[1].hukum}. First to 10 wins.`)
    : result.reason === "dagilma"
      ? (tr ? `Mühür: sen ${state.players[0].muhur}, rakip ${state.players[1].muhur}. Isı 100 olduğunda yalnızca Mühür karşılaştırılır; eşitlik beraberliktir.` : `Seals: you ${state.players[0].muhur}, rival ${state.players[1].muhur}. At Heat 100 only Seals decide; equal Seals means a draw.`)
      : (tr ? `Kilitli masa: sen ${lockCounts[0]}, rakip ${lockCounts[1]}. Mühür: ${state.players[0].muhur} / ${state.players[1].muhur}. Önce kilit sayısı, eşitse Mühür karşılaştırılır.` : `Locked desks: you ${lockCounts[0]}, rival ${lockCounts[1]}. Seals: ${state.players[0].muhur} / ${state.players[1].muhur}. Most locks wins; Seals break a tie.`);
  const alt = result.reason === "dagilma"
    ? (tr ? "Bir sonraki oyunda Isı yükselirken rakibin Mühür sayısını izle; gerideysen soğutan dosyalara öncelik ver." : "Next game, watch rival Seals as Heat rises; prioritise cooling files if you trail.")
    : (tr ? "Bir sonraki oyunda iki masayı korumayı dene: tur başındaki +1 Hüküm, rakibine yeni bir masa açmaktan daha pahalıya mal olabilir." : "Next game, try holding two desks: +1 Ruling at turn start can be more valuable than opening another front.");
  return {
    headline: draw ? (tr ? "Berabere" : "Draw") : you ? (tr ? "Kazandın · Senin hükmün" : "You won · Your ruling") : tr ? "Kaybettin · Karşı hüküm" : "You lost · Opposing ruling",
    comparison,
    reason: reasonMap[result.reason] || reasonMap.time,
    archetypes: state.players.map((p) => ARCHETYPES[p.archetype]?.title?.[lang] || p.archetype),
    meters: {
      hukum: state.players.map((p) => p.hukum),
      muhur: state.players.map((p) => p.muhur),
      heat: state.heat,
      turn: state.turn,
    },
    locks: locks.map((row) => ({
      ...row,
      name: labelDesk(row.desk, tr),
    })),
    turning: turning
      ? tr
        ? `Dönemeç: tur ${turning.t}, ${turningLabel}${turning.d ? " / " + labelDesk(turning.d, true) : ""}.`
        : `Turning point: turn ${turning.t}, ${turningLabel}${turning.d ? " / " + labelDesk(turning.d, false) : ""}.`
      : tr
        ? "Belirgin bir dönemeç yok; masa yavaş kapandı."
        : "No sharp turning point; the board closed slowly.",
    repeated,
    families,
    chains: chains.length,
    crises: crises.length,
    alt,
    log: state.log.slice(-16),
  };
}
