import type { WorldState } from "../domain/types.ts";
import { RULES_VERSION } from "../domain/content.ts";
type Scalar = null | boolean | number | string;
type Value = Scalar | Value[] | { $ref: string };
type RecordEntry = {
  id: string;
  schemaVersion: 1;
  updatedTick: number;
  data: Record<string, Value>;
};
export type RecordSnapshot = {
  format: "social-engine-record-snapshot";
  schemaVersion: number;
  engineVersion: string;
  rulesVersion: string;
  tick: number;
  seed: number;
  root: string;
  records: Record<string, RecordEntry>;
  profiles: Record<string, RecordEntry>;
};
/** Record updatedTick is the persisted revision's reconciliation tick, not a claim
 * about the exact last field mutation. Profiles have one normalized storage authority.
 * Runtime objects are a materialized view of these records, never a second save store. */
export function packRecords(state: WorldState): RecordSnapshot {
  const copy = structuredClone(state);
  const records: Record<string, RecordEntry> = {},
    profiles: Record<string, RecordEntry> = {};
  function normalize(value: unknown, id: string, table = records): Value {
    if (value === null || typeof value !== "object") return value as Scalar;
    if (Array.isArray(value))
      return value.map((item, index) =>
        normalize(
          item,
          `${id}/${typeof item?.id === "string" ? "@" + encodeURIComponent(item.id) : index}`,
        ),
      );
    if (table[id]) throw Error("Duplicate record identity");
    const entry: RecordEntry = { id, schemaVersion: 1, updatedTick: state.tick, data: {} };
    table[id] = entry;
    for (const key of Object.keys(value).sort())
      entry.data[key] = normalize(
        (value as Record<string, unknown>)[key],
        `${id}/${encodeURIComponent(key)}`,
      );
    return { $ref: id };
  }
  for (const person of [copy.player, ...copy.npcs]) {
    const record = person as unknown as Record<string, unknown>,
      id = `profile:${person.id}`;
    const profile: Record<string, unknown> = {
      personId: person.id,
      name: person.name,
      appearance: person.appearance,
      local: person.local,
    };
    if (person.id === "player") {
      profile.creation = copy.player.profile;
      delete record.profile;
    }
    normalize(profile, id, profiles);
    delete record.name;
    delete record.appearance;
    delete record.local;
    record.profileRef = id;
  }
  normalize(copy, "world");
  return {
    format: "social-engine-record-snapshot",
    schemaVersion: state.schemaVersion,
    engineVersion: state.engineVersion,
    rulesVersion: RULES_VERSION,
    tick: state.tick,
    seed: state.seed,
    root: "world",
    records,
    profiles,
  };
}
export function unpackRecords(input: unknown): WorldState {
  const s = input as RecordSnapshot;
  if (
    !s ||
    s.format !== "social-engine-record-snapshot" ||
    !(
      (s.schemaVersion === 7 &&
        s.rulesVersion === RULES_VERSION &&
        s.engineVersion === "1.0.0-candidate.6") ||
      (s.schemaVersion === 6 &&
        s.rulesVersion === "social-engine-rules-6" &&
        s.engineVersion === "1.0.0-candidate.5") ||
      (s.schemaVersion === 5 &&
        s.rulesVersion === "social-engine-rules-5" &&
        s.engineVersion === "1.0.0-candidate.4")
    ) ||
    s.root !== "world" ||
    !s.records ||
    !s.profiles ||
    Array.isArray(s.records) ||
    Array.isArray(s.profiles)
  )
    throw Error("Snapshot record/rules version is unsupported");
  const used = new Set<string>();
  const count = Object.keys(s.records).length + Object.keys(s.profiles).length;
  if (count < 1 || count > 100000) throw Error("Snapshot record count is invalid");
  function expand(value: Value, depth: number): unknown {
    if (depth > 48) throw Error("Snapshot record depth exceeded");
    if (Array.isArray(value)) return value.map((v) => expand(v, depth + 1));
    if (!value || typeof value !== "object") return value;
    if (Object.keys(value).length !== 1 || typeof value.$ref !== "string")
      throw Error("Malformed record reference");
    const id = value.$ref,
      entry = s.records[id] ?? s.profiles[id];
    if (
      !entry ||
      used.has(id) ||
      entry.id !== id ||
      entry.schemaVersion !== 1 ||
      entry.updatedTick !== s.tick ||
      !entry.data ||
      Array.isArray(entry.data) ||
      typeof entry.data !== "object"
    )
      throw Error("Record identity, version, tick or ownership is invalid");
    used.add(id);
    return Object.fromEntries(
      Object.entries(entry.data).map(([key, v]) => [key, expand(v, depth + 1)]),
    );
  }
  const state = expand({ $ref: s.root }, 0) as WorldState;
  if (!state || !state.player || !Array.isArray(state.npcs)) throw Error("World records missing");
  for (const person of [state.player, ...state.npcs]) {
    const record = person as unknown as Record<string, unknown>,
      id = `profile:${person.id}`;
    if (
      record.profileRef !== id ||
      !Object.hasOwn(s.profiles, id) ||
      Object.hasOwn(record, "name") ||
      Object.hasOwn(record, "appearance") ||
      Object.hasOwn(record, "local") ||
      Object.hasOwn(record, "profile")
    )
      throw Error("Immutable profile has competing authority");
    const profile = expand({ $ref: id }, 0) as Record<string, unknown>;
    if (
      profile.personId !== person.id ||
      typeof profile.name !== "string" ||
      !Number.isInteger(profile.appearance) ||
      typeof profile.local !== "boolean"
    )
      throw Error("Profile owner or identity is invalid");
    person.name = profile.name;
    person.appearance = Number(profile.appearance);
    person.local = profile.local;
    if (person.id === "player")
      state.player.profile = profile.creation as WorldState["player"]["profile"];
    else if (Object.hasOwn(profile, "creation"))
      throw Error("NPC cannot own player creation profile");
    delete record.profileRef;
  }
  if (
    used.size !== count ||
    Object.keys(s.profiles).length !== state.npcs.length + 1 ||
    state.tick !== s.tick ||
    state.seed !== s.seed ||
    state.schemaVersion !== s.schemaVersion ||
    state.engineVersion !== s.engineVersion
  )
    throw Error("Snapshot contains unowned or mismatched records");
  return state;
}
