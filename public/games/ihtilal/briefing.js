import { applyAction, cardOf, cloneState, DESKS, legalActions } from "./engine.js";

// UI evidence comes from real rule resolution; it never commits a preview or
// exposes the opponent's hand. These helpers do not alter the save schema.
export function snapshot(state) {
  return {
    turn: state.turn,
    players: state.players.map(p => ({ hukum: p.hukum, muhur: p.muhur, murekkep: p.murekkep, hand: p.hand.length })),
    heat: state.heat,
    desks: Object.fromEntries(DESKS.map(d => [d, { presence: [...state.desks[d].presence], lock: state.desks[d].lock }])),
    archive: state.archive.map(row => ({ id: row.id, owner: row.owner, due: row.due, cardId: row.cardId, desk: row.desk })),
  };
}

export function changes(before, after) {
  const out = [];
  for (const key of ["hukum", "muhur", "murekkep"]) {
    for (let owner = 0; owner < 2; owner++) {
      const delta = after.players[owner][key] - before.players[owner][key];
      if (delta) out.push({ key, owner, delta });
    }
  }
  for (const desk of DESKS) {
    for (let owner = 0; owner < 2; owner++) {
      const delta = after.desks[desk].presence[owner] - before.desks[desk].presence[owner];
      if (delta) out.push({ key: "presence", desk, owner, delta });
    }
    if (before.desks[desk].lock !== after.desks[desk].lock) out.push({ key: "lock", desk, owner: after.desks[desk].lock });
  }
  if (before.heat !== after.heat) out.push({ key: "isi", delta: after.heat - before.heat });
  return out;
}

export function previewAction(state, action) {
  const next = cloneState(state);
  if (!next) return null;
  const before = snapshot(next);
  if (!applyAction(next, action).ok) return null;
  return { changes: changes(before, snapshot(next)), queued: next.archive.filter(row => !before.archive.some(prev => prev.id === row.id)).map(row => ({ cardId: row.cardId, due: row.due, desk: row.desk })), result: next.result };
}

// A transparent nudge toward a contested desk, not an oracle or hidden-info AI.
export function suggestedAction(state) {
  const options = legalActions(state, 0).filter(a => a.type === "play" || a.type === "counter");
  const score = action => {
    const card = cardOf(action.cardId);
    let value = -card.cost * 0.3 - card.seal * 0.4;
    for (const op of card.effect) {
      const desk = op.desk === "any" ? action.desk : op.desk;
      const row = state.desks[desk];
      if (op.op === "push" && row) {
        const own = row.presence[0], opp = row.presence[1];
        value += Math.min(op.n, Math.max(0, 6 - own));
        if (row.lock !== 0 && own + op.n >= 3 && own + op.n > opp) value += 5;
        if (row.lock === 0 && own > opp + 1) value -= 2;
      } else if ((op.op === "pull" || op.op === "steal") && row) value += Math.min(op.n, row.presence[1]) * 1.5;
      else if (op.op === "hukum") value += op.n * 5;
      else if (op.op === "seal") value += op.n * (state.heat >= 65 ? 2 : 0.7);
      else if (op.op === "heat") value += op.n * (state.players[0].muhur > state.players[1].muhur ? 0.05 : -0.15);
      else if (op.op === "draw" || op.op === "ink") value += op.n * 0.7;
    }
    return value;
  };
  return options.map(action => ({ action, score: score(action) })).sort((a, b) => b.score - a.score)[0]?.action || null;
}

export function deskProgress(row, owner = 0) {
  const own = row.presence[owner], rival = row.presence[1 - owner];
  return { own, rival, needed: Math.max(0, 3 - own, rival + 1 - own), ready: own >= 3 && own > rival, held: row.lock === owner };
}
