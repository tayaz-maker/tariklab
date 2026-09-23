// Scripted players for Son 100 Gün balance tests. Not shipped to the browser.
import * as G from "../public/games/son-100-gun/pov.js";

const weights = {
  door: { kin: 1, friend: 1, young: 1, body: 0.15, peace: 0.2, mark: 0.1, money: 0.05 },
  warm: { kin: 1, friend: 1, young: 1, body: 0.9, peace: 0.3, mark: 0.1, money: 0.05 },
  careful: { mark: 1.2, body: 0.9, peace: 0.3, kin: 0.1, friend: 0.1, young: 0.2, money: 0.05 },
  mark: { mark: 1.6, body: 0.2, peace: 0.2, kin: 0.1, friend: 0.1, young: 0.2, money: 0.05 },
  still: { peace: 1.4, body: 0.6, mark: 0.1, kin: 0.15, friend: 0.15, young: 0.15, money: 0.05 },
  greedy: { kin: 0.34, friend: 0.34, young: 0.34, mark: 1, peace: 0.75, body: 0.4, money: 0.05 },
};
const rhythm = {
  warm: "table",
  careful: "desk",
  door: "table",
  mark: "desk",
  still: "body",
  greedy: "body",
};

function value(fx, w) {
  let v = 0;
  for (const [k, n] of Object.entries(fx)) v += (w[k] || 0) * n;
  return v;
}

export function expected(p, w) {
  let v = value(p.now, w);
  if (p.risk) v += p.risk.p * value(p.risk.win, w) + (1 - p.risk.p) * value(p.risk.lose, w);
  for (const l of p.later) v += value(l.fx, w);
  for (const l of p.lapses) v -= value(l.fx, w);
  v += value(p.close.fx, w);
  return v;
}

export function options(s) {
  const out = [];
  for (const h of s.hand)
    for (const o of G.card(h.id).options) {
      const p = G.preview(s, h.id, o.id);
      if (!p.reason) out.push({ card: h.id, option: o.id, p });
    }
  return out;
}

/** Returns [card, option] for the policy. */
export function pick(s, policy, rng) {
  const opts = options(s);
  if (policy === "first") return [opts[0].card, opts[0].option];
  if (policy === "last") return [opts.at(-1).card, opts.at(-1).option];
  if (policy === "random") {
    const o = opts[Math.floor(rng() * opts.length)];
    return [o.card, o.option];
  }
  const w = weights[policy];
  const pref = opts.find((o) => o.card === "rhythm" && o.p.routine === rhythm[policy]);
  if (pref) return [pref.card, pref.option];
  let best = opts[0];
  let bv = -Infinity;
  for (const o of opts) {
    const v = expected(o.p, w);
    if (v > bv) {
      bv = v;
      best = o;
    }
  }
  return [best.card, best.option];
}

export function play(scenario, seed, policy) {
  const s = G.createGame(scenario, seed);
  let r = seed * 9301 + 49297;
  const rng = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  let guard = 0;
  while (!s.ending && guard++ < 40) {
    const [c, o] = pick(s, policy, rng);
    if (!G.choose(s, c, o)) throw new Error(`policy ${policy} made an illegal move ${c}:${o}`);
  }
  return s;
}
