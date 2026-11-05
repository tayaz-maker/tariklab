import { mealAddress, hasMeal, addMeal } from "./meal-membership.ts";
import type { WorldState } from "../domain/types.ts";
const retainedIds = new WeakMap<WorldState, Set<string>>();
/** Dense legacy hexadecimal blocks remain readable. Sparse blocks store exact bit
 * positions instead of hundreds of zeroes per infrequent transaction family. */
export function validTransactionBits(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (/^[0-9a-f]{1,1024}$/.test(value)) return true;
  if (!/^b:(0|[1-9]\d{0,3})(,(0|[1-9]\d{0,3})){0,31}$/.test(value)) return false;
  const bits = value.slice(2).split(",").map(Number);
  return bits.every((n, i) => n < 4096 && (i === 0 || n > bits[i - 1]));
}
export function readTransactionBits(value: string): bigint {
  if (!validTransactionBits(value)) throw Error("Invalid transaction identity bitmap");
  if (!value.startsWith("b:")) return BigInt(`0x${value}`);
  return value
    .slice(2)
    .split(",")
    .reduce((n, bit) => n | (1n << BigInt(bit)), 0n);
}
export function writeTransactionBits(bitmap: bigint): string {
  const hex = bitmap.toString(16);
  if (hex.length < 8) return hex;
  const positions: number[] = [];
  for (let i = hex.length - 1; i >= 0; i--) {
    const digit = parseInt(hex[i], 16);
    for (let bit = 0; bit < 4; bit++)
      if (digit & (1 << bit)) {
        positions.push((hex.length - i - 1) * 4 + bit);
        if (positions.length > 32) return hex;
      }
  }
  const sparse = `b:${positions.join(",")}`;
  return sparse.length < hex.length ? sparse : hex;
}
/** Collision-free persistent ID set. Numeric ID families use sparse 4096-bit blocks;
 * no probabilistic filter and no loss of deduplication when journal entries compact. */
function idAddress(id: string): { key: string; bit: bigint } {
  const match = /^(.*?)(0|[1-9]\d*)(\D*)$/.exec(id);
  if (match && Number.isSafeInteger(Number(match[2])) && String(Number(match[2])) === match[2]) {
    const ordinal = Number(match[2]);
    return {
      key: `txset:${JSON.stringify([match[1], match[3], Math.floor(ordinal / 4096)])}`,
      bit: 1n << BigInt(ordinal % 4096),
    };
  }
  return { key: `txexact:${id}`, bit: 1n };
}

/** Opening balances + matched transfer journal = current balances, including explicit external accounts. */
export function transfer(
  state: WorldState,
  id: string,
  from: string,
  to: string,
  amount: number,
  reason: string,
): boolean {
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    from === to ||
    !Object.hasOwn(state.accounts, from) ||
    !Object.hasOwn(state.accounts, to)
  )
    return false;
  const meal = mealAddress(id);
  const address = idAddress(id),
    stored = String(state.flags[address.key] ?? "0"),
    bitmap = readTransactionBits(stored);
  let recent = retainedIds.get(state);
  if (!recent) {
    recent = new Set(state.ledger.map((entry) => entry.id));
    retainedIds.set(state, recent);
  }
  if (
    (bitmap & address.bit) !== 0n ||
    recent.has(id) ||
    (meal && hasMeal(state.flags[meal.key], meal.code))
  )
    return false;
  if (state.accounts[from] < amount || !Number.isSafeInteger(state.accounts[to] + amount))
    return false;
  state.accounts[from] -= amount;
  state.accounts[to] += amount;
  state.ledger.push({ id, tick: state.tick, from, to, amount, reason });
  if (meal) state.flags[meal.key] = addMeal(state.flags[meal.key], meal.code);
  else state.flags[address.key] = writeTransactionBits(bitmap | address.bit);
  recent.add(id);
  if (state.ledger.length >= 2048) {
    const entries = state.ledger.splice(0, 1024);
    for (const entry of entries) {
      state.ledgerCheckpoint.balances[entry.from] -= entry.amount;
      state.ledgerCheckpoint.balances[entry.to] += entry.amount;
      recent.delete(entry.id);
    }
    state.ledgerCheckpoint.count += entries.length;
  }
  return true;
}
export function reconcile(state: WorldState): string[] {
  const errors: string[] = [],
    balances = { ...state.ledgerCheckpoint.balances },
    ids = new Set<string>();
  for (const entry of state.ledger) {
    if (ids.has(entry.id)) errors.push(`duplicate-ledger:${entry.id}`);
    ids.add(entry.id);
    if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0)
      errors.push(`invalid-transfer:${entry.id}`);
    if (!(entry.from in balances) || !(entry.to in balances))
      errors.push(`unknown-account:${entry.id}`);
    balances[entry.from] -= entry.amount;
    balances[entry.to] += entry.amount;
  }
  let total = 0;
  for (const [id, amount] of Object.entries(state.accounts)) {
    if (!Number.isSafeInteger(amount) || amount < 0) errors.push(`invalid-balance:${id}`);
    if (balances[id] !== amount) errors.push(`unexplained-balance:${id}`);
    total += amount;
  }
  if (total !== state.openingTotal) errors.push("currency-conservation");
  return errors;
}
