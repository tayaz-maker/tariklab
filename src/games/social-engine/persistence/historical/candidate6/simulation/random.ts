/** Versioned deterministic integer mixer. Draws do not depend on call order. */
export function draw(seed: number, channel: number, tick: number, entity = 0): number {
  let x =
    (seed ^
      Math.imul(channel + 1, 0x9e3779b9) ^
      Math.imul(tick + 1, 0x85ebca6b) ^
      Math.imul(entity + 1, 0xc2b2ae35)) >>>
    0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
export const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));
export const quantize = (value: number): number => Math.round(value * 1000) / 1000;
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
    .join(",")}}`;
}
