/** Lossless JSON string interning. No history is dropped or rewritten. */
export function packSave(value) {
  const strings = [],
    ids = new Map();
  function intern(text) {
    let id = ids.get(text);
    if (id === undefined) {
      id = strings.length;
      ids.set(text, id);
      strings.push(text);
    }
    return id;
  }
  function encode(v) {
    if (typeof v === "string") return ["s", intern(v)];
    if (Array.isArray(v)) return ["a", v.map(encode)];
    if (v && typeof v === "object") {
      const keys = Object.keys(v),
        entries = new Array(keys.length);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        entries[i] = [intern(key), encode(v[key])];
      }
      return ["o", entries];
    }
    if (v === null || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)))
      return v;
    throw new Error("Save contains a non-JSON value");
  }
  const root = encode(value);
  return { codec: 1, strings, root };
}
export function unpackSave(packed) {
  if (
    !packed ||
    packed.codec !== 1 ||
    !Array.isArray(packed.strings) ||
    packed.strings.some((s) => typeof s !== "string")
  )
    throw new Error("Invalid save dictionary");
  let nodes = 0;
  function string(id) {
    if (!Number.isSafeInteger(id) || id < 0 || id >= packed.strings.length)
      throw new Error("Invalid string reference");
    return packed.strings[id];
  }
  function decode(v, depth = 0) {
    if (++nodes > 1000000 || depth > 100) throw new Error("Save exceeds decoding limits");
    if (!Array.isArray(v)) {
      if (v === null || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)))
        return v;
      throw new Error("Invalid encoded value");
    }
    if (v.length !== 2) throw new Error("Invalid encoded node");
    if (v[0] === "s") return string(v[1]);
    if (!Array.isArray(v[1])) throw new Error("Invalid encoded collection");
    if (v[0] === "a") return v[1].map((x) => decode(x, depth + 1));
    if (v[0] !== "o") throw new Error("Unknown encoded node");
    const result = {},
      seen = new Set();
    for (const entry of v[1]) {
      if (!Array.isArray(entry) || entry.length !== 2) throw new Error("Invalid encoded property");
      const key = string(entry[0]);
      if (seen.has(key)) throw new Error("Duplicate encoded property");
      seen.add(key);
      Object.defineProperty(result, key, {
        value: decode(entry[1], depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return result;
  }
  return decode(packed.root);
}
