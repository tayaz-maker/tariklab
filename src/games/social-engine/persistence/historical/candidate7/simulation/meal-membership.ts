/** Exact transaction membership index for schema 8. Families are
 * distinct transaction identities, including the genuine pre-v5 queue spelling. */
export type MealAddress = { family: "v5" | "queue"; business: string; tick: number; npc: number };
const uint = (text: string): number | null =>
  /^(0|[1-9]\d*)$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null;
const business = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z][a-z0-9-]*$/.test(value);
export function parseMealId(id: string): MealAddress | null {
  let match: string[] | null = /^meal:v5:([^:]+):([^:]+):n([^:]+)$/.exec(id);
  const family = match ? "v5" : "queue";
  if (!match) {
    const old = /^meal:queue:([^:]+):n([^:]+):([^:]+)$/.exec(id);
    if (!old) return null;
    match = [old[0], old[1], old[3], old[2]];
  }
  const tick = uint(match[2]),
    npc = uint(match[3]);
  return business(match[1]) && tick !== null && npc !== null && npc < 65536
    ? { family, business: match[1], tick, npc }
    : null;
}
export function mealId(a: MealAddress): string {
  return a.family === "v5"
    ? `meal:v5:${a.business}:${a.tick}:n${a.npc}`
    : `meal:queue:${a.business}:n${a.npc}:${a.tick}`;
}
export function mealAddress(id: string): { key: string; code: number } | null {
  const a = parseMealId(id);
  return (
    a && {
      key: `txmeal:${JSON.stringify([a.family, a.business, Math.floor(a.tick / 1024)])}`,
      code: (a.tick % 1024) * 65536 + a.npc,
    }
  );
}
function bucket(key: string): [MealAddress["family"], string, number] {
  if (!key.startsWith("txmeal:")) throw Error("Not a meal membership key");
  const parts = JSON.parse(key.slice(7));
  if (
    !Array.isArray(parts) ||
    parts.length !== 3 ||
    JSON.stringify(parts) !== key.slice(7) ||
    (parts[0] !== "v5" && parts[0] !== "queue") ||
    !business(parts[1]) ||
    !Number.isSafeInteger(parts[2]) ||
    parts[2] < 0 ||
    parts[2] > Math.floor(Number.MAX_SAFE_INTEGER / 1024)
  )
    throw Error("Invalid meal bucket");
  return parts as [MealAddress["family"], string, number];
}
export function mealCodes(value: unknown): number[] {
  if (typeof value !== "string" || !/^[0-9a-z]+(,[0-9a-z]+)*$/.test(value))
    throw Error("Invalid meal membership list");
  const codes = value.split(",").map((text) => {
    const code = parseInt(text, 36);
    if (
      !Number.isSafeInteger(code) ||
      code < 0 ||
      code >= 1024 * 65536 ||
      code.toString(36) !== text
    )
      throw Error("Invalid meal membership code");
    return code;
  });
  if (codes.some((code, i) => i > 0 && code <= codes[i - 1]))
    throw Error("Duplicate or unordered meal membership");
  return codes;
}
export function validMealMembership(key: string, value: unknown): boolean {
  try {
    const [, , block] = bucket(key);
    if (typeof value !== "string" || !value.length) return false;
    const maxOffset = Math.min(1023, Number.MAX_SAFE_INTEGER - block * 1024);
    let previous = -1,
      current = 0,
      digits = 0,
      firstZero = false;
    for (let i = 0; i <= value.length; i++) {
      const char = i === value.length ? 44 : value.charCodeAt(i);
      if (char === 44) {
        if (!digits || current <= previous || Math.floor(current / 65536) > maxOffset) return false;
        previous = current;
        current = 0;
        digits = 0;
        firstZero = false;
      } else {
        const digit =
          char >= 48 && char <= 57 ? char - 48 : char >= 97 && char <= 122 ? char - 87 : -1;
        if (digit < 0 || (digits && firstZero)) return false;
        if (!digits) firstZero = digit === 0;
        current = current * 36 + digit;
        if (current >= 1024 * 65536) return false;
        digits++;
      }
    }
    return true;
  } catch {
    return false;
  }
}
export function hasMeal(value: unknown, code: number): boolean {
  return value === undefined ? false : mealCodes(value).includes(code);
}
export function addMeal(value: unknown, code: number): string {
  if (!Number.isSafeInteger(code) || code < 0 || code >= 1024 * 65536)
    throw Error("Invalid meal code");
  const codes = value === undefined ? [] : mealCodes(value);
  let low = 0,
    high = codes.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (codes[mid] < code) low = mid + 1;
    else high = mid;
  }
  if (codes[low] !== code) codes.splice(low, 0, code);
  return codes.map((n) => n.toString(36)).join(",");
}
export function* mealIds(key: string, value: unknown): Generator<string> {
  const [family, business, block] = bucket(key);
  for (const code of mealCodes(value)) {
    const a = {
      family,
      business,
      tick: block * 1024 + Math.floor(code / 65536),
      npc: code % 65536,
    };
    if (!Number.isSafeInteger(a.tick)) throw Error("Meal tick overflow");
    yield mealId(a);
  }
}
/** Utility migration supplied its exact legacy bit decoder; known keys are removed
 * only after every old membership was checked and grouped losslessly. */
export function compactLegacyMeals(
  flags: Record<string, unknown>,
  readBits: (value: string) => bigint,
): { keys: number; members: number } {
  const groups = new Map<string, Set<number>>(),
    consumed: string[] = [];
  let members = 0;
  for (const [key, value] of Object.entries(flags)) {
    if (!key.startsWith("txset:")) continue;
    let parts: unknown;
    try {
      parts = JSON.parse(key.slice(6));
    } catch {
      continue;
    }
    if (
      !Array.isArray(parts) ||
      parts.length !== 3 ||
      JSON.stringify(parts) !== key.slice(6) ||
      parts[1] !== "" ||
      !Number.isSafeInteger(parts[2]) ||
      parts[2] < 0 ||
      typeof parts[0] !== "string"
    )
      continue;
    const prefix = parts[0];
    const v5 = /^meal:v5:([^:]+):([^:]+):n$/.exec(prefix),
      queue = /^meal:queue:([^:]+):n([^:]+):$/.exec(prefix);
    if (!v5 && !queue) continue;
    const bits = readBits(String(value));
    if (bits === 0n) continue;
    let valid = true;
    const positions: number[] = [];
    if (String(value).startsWith("b:"))
      positions.push(...String(value).slice(2).split(",").map(Number));
    else {
      const hex = bits.toString(16);
      for (let i = hex.length - 1; i >= 0; i--) {
        const digit = parseInt(hex[i], 16);
        for (let j = 0; j < 4; j++)
          if (digit & (1 << j)) positions.push((hex.length - i - 1) * 4 + j);
      }
    }
    const addresses: { key: string; code: number }[] = [];
    for (const bit of positions) {
      const ordinal = parts[2] * 4096 + bit;
      if (!Number.isSafeInteger(ordinal)) {
        valid = false;
        break;
      }
      const id = v5
        ? `meal:v5:${v5[1]}:${v5[2]}:n${ordinal}`
        : `meal:queue:${queue![1]}:n${queue![2]}:${ordinal}`;
      const a = mealAddress(id);
      if (!a) {
        valid = false;
        break;
      }
      addresses.push(a);
    }
    if (!valid) continue;
    for (const a of addresses) {
      if (!groups.has(a.key)) groups.set(a.key, new Set());
      groups.get(a.key)!.add(a.code);
      members++;
    }
    consumed.push(key);
  }
  // Prepare all replacements before deleting any historical authority.
  const replacements = new Map<string, string>();
  for (const [key, codes] of groups) {
    if (Object.hasOwn(flags, key)) for (const code of mealCodes(flags[key])) codes.add(code);
    replacements.set(
      key,
      [...codes]
        .sort((a, b) => a - b)
        .map((n) => n.toString(36))
        .join(","),
    );
  }
  for (const key of consumed) delete flags[key];
  for (const [key, value] of replacements) flags[key] = value;
  return { keys: consumed.length, members };
}
