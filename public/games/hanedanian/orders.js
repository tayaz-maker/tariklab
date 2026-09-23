// Order preview, period summary and the order step indicator.
//
// The preview runs the real `dispatch` on a private copy of the campaign, so
// what the player reads before confirming is exactly what the committed order
// does: same validation, same costs, same arrival and completion times. The
// world clock stops while an order dialog is open, so the live state cannot
// drift between the preview and the commit. Nothing here is saved.
import { dispatch, getPlayerSettlements, getFaction, getMilitaryPower } from './engine.js';
import { RESOURCES } from './data.js';

const RESOURCE_KEYS = Object.keys(RESOURCES);

export function previewOrder(state, action) {
  // Orders never write to the map (only arrivals do, inside `advance`), so the
  // copy shares the immutable-for-orders world and clones everything else.
  // That keeps a preview well under a millisecond on a 49 × 49 campaign.
  const copy = structuredClone({ ...state, world: null });
  copy.world = state.world;
  const result = dispatch(copy, action);
  if (!result.ok) return { ok: false, message: result.message, cost: {}, outcome: null };
  return { ok: true, message: result.message, ...orderDelta(state, copy, action) };
}

/** What an order changed between two states: its cost and its visible result. */
export function orderDelta(before, after, action) {
  const cost = {};
  const town = before.settlements.find((t) => t.id === action.settlementId);
  const next = town && after.settlements.find((t) => t.id === town.id);
  if (town && next) {
    for (const key of RESOURCE_KEYS) {
      const spent = Math.round(town.resources[key] - next.resources[key]);
      if (spent > 0) cost[key] = spent;
    }
  }
  const influence = Math.round(
    (getFaction(before, before.playerId)?.influence || 0) - (getFaction(after, after.playerId)?.influence || 0),
  );
  if (influence > 0) cost.influence = influence;
  let outcome = null;
  const armyIds = new Set(before.armies.map((a) => a.id));
  const army = after.armies.find((a) => !armyIds.has(a.id));
  if (army) outcome = { kind: 'army', mission: army.mission, arriveAt: army.arriveAt, to: { ...army.to }, troops: { ...army.troops } };
  else if (town && next && next.queue.length > town.queue.length) {
    const job = next.queue.at(-1);
    outcome = { kind: 'queue', job: job.kind, building: job.building, unit: job.unit, level: job.level, count: job.count, startAt: job.startAt, completeAt: job.completeAt };
  } else if (town && next) {
    const troops = {};
    for (const key of Object.keys(town.troops)) {
      const d = next.troops[key] - town.troops[key];
      if (d) troops[key] = d;
    }
    if (Object.keys(troops).length) outcome = { kind: 'troops', troops };
  }
  return { cost, outcome };
}

/** Plain numbers the period summary compares; small and never persisted. */
export function snapshot(state) {
  const towns = getPlayerSettlements(state);
  const resources = Object.fromEntries(RESOURCE_KEYS.map((k) => [k, Math.floor(towns.reduce((s, t) => s + t.resources[k], 0))]));
  return {
    time: state.time,
    resources,
    influence: Math.floor(getFaction(state, state.playerId)?.influence || 0),
    settlements: towns.length,
    power: Math.round(getMilitaryPower(state, state.playerId)),
    armies: state.armies.filter((a) => a.ownerId === state.playerId).length,
    jobs: towns.reduce((s, t) => s + t.queue.length, 0),
    reportId: state.reports[0]?.id ?? null,
    reportIds: state.reports.slice(0, 40).map((r) => r.id),
  };
}

/**
 * Changes over one stretch of world time (from the moment the clock started
 * to the moment it stopped). Returns null when nothing moved.
 */
export function summarizePeriod(before, after, reports = []) {
  if (!before || !after || after.time <= before.time) return null;
  const rows = [];
  for (const key of RESOURCE_KEYS)
    if (after.resources[key] !== before.resources[key]) rows.push({ key, from: before.resources[key], to: after.resources[key] });
  for (const key of ['influence', 'settlements', 'power', 'armies', 'jobs'])
    if (after[key] !== before[key]) rows.push({ key, from: before[key], to: after[key] });
  const seen = new Set(before.reportIds);
  const news = reports.filter((r) => !seen.has(r.id)).slice(0, 5).map((r) => ({ id: r.id, title: r.title, critical: !!r.critical }));
  return { from: before.time, to: after.time, minutes: after.time - before.time, rows, news };
}

/** Which way a summary row reads for the player. */
export function rowTone(row) {
  if (row.key === 'jobs' || row.key === 'armies') return 'neutral';
  return row.to > row.from ? 'good' : 'bad';
}

export const ORDER_STEPS = ['target', 'order', 'confirm', 'watch'];

/**
 * The step the player is on for an order: pick a target, pick an order,
 * check the preview and confirm, then let time run and watch the result.
 */
export function orderStep({ selected, dialog, paused, pending }) {
  if (dialog) return 'confirm';
  if (pending && paused) return 'watch';
  if (!selected) return 'target';
  return 'order';
}
