import { migrateLegacyTrafficPoses } from "../simulation/traffic.ts";
import { migrateState as migrateCandidate5 } from "./historical/candidate5/persistence/codec.ts";
import { validateState as validateCandidate5 } from "./historical/candidate5/simulation/engine.ts";
import { gzipText, gunzipText } from "./compression.ts";
import { packRecords, unpackRecords } from "./records.ts";
import { canonical } from "../simulation/random.ts";
import { initializeServices } from "../simulation/services.ts";
import { initializeMissionReservations } from "../simulation/missions.ts";
import { initializeEconomy } from "../simulation/economy.ts";
import { initializeMobility } from "../simulation/mobility.ts";
import { initializeSocial } from "../simulation/social.ts";
import { initializeProgression } from "../simulation/progression.ts";
import type { WorldState } from "../domain/types.ts";
import { validateState } from "../simulation/engine.ts";
import { initializeLife, initializeLifeV2 } from "../simulation/life.ts";
import { ENGINE_VERSION, SCHEMA_VERSION } from "../domain/content.ts";

export const SAVE_SCHEMA = SCHEMA_VERSION;
export const MAX_SAVE_BYTES = 16 * 1024 * 1024;
export const SLOT_IDS = ["slot-1", "slot-2", "slot-3", "auto"] as const;
export type SlotId = (typeof SLOT_IDS)[number];
export type SaveErrorCode =
  | "EMPTY_SLOT"
  | "INVALID_SLOT"
  | "INVALID_STATE"
  | "INVALID_SAVE"
  | "CHECKSUM_MISMATCH"
  | "UNSUPPORTED_VERSION"
  | "STORAGE_UNAVAILABLE"
  | "QUOTA_EXCEEDED"
  | "WRITE_CONFLICT"
  | "WRITE_FAILED"
  | "JOURNAL_CORRUPT"
  | "JOURNAL_LIMIT";
export class SaveError extends Error {
  readonly code: SaveErrorCode;
  constructor(code: SaveErrorCode, message: string) {
    super(message);
    this.name = "SaveError";
    this.code = code;
  }
}
export type SaveEnvelope = {
  format: "social-engine-save";
  schemaVersion: number;
  gameVersion: string;
  slotId: string;
  revisionId: string;
  worldSeed: number;
  tick: number;
  createdAt: string;
  encoding: "canonical-json" | "canonical-json+gzip-base64";
  decodedByteLength?: number;
  payloadSha256?: string;
  byteLength: number;
  sha256: string;
  payload: string;
};
export type DecodedSave = {
  state: WorldState;
  migrated: boolean;
  sourceSchema: number;
  /** Exact validated predecessor world, before any new rules or migration. */
  sourceState?: WorldState;
  source: SaveEnvelope;
};
export function assertSlot(slot: string): asserts slot is SlotId {
  if (!(SLOT_IDS as readonly string[]).includes(slot))
    throw new SaveError("INVALID_SLOT", "Geçersiz kayıt yuvası.");
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** Bounded JSON validation before copying/importing untrusted save data. */
export function assertJsonTree(value: unknown): void {
  let nodes = 0;
  const visit = (v: unknown, depth: number): void => {
    if (++nodes > 1_000_000 || depth > 48)
      throw new SaveError("INVALID_SAVE", "Kayıt yapısı sınırları aşıyor.");
    if (v === null || typeof v === "boolean" || typeof v === "string") return;
    if (typeof v === "number" && Number.isFinite(v)) return;
    if (Array.isArray(v)) {
      for (const child of v) visit(child, depth + 1);
      return;
    }
    if (object(v)) {
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null)
        throw new SaveError("INVALID_SAVE", "Geçersiz kayıt nesnesi.");
      for (const [key, child] of Object.entries(v)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype")
          throw new SaveError("INVALID_SAVE", "Güvensiz kayıt alanı.");
        visit(child, depth + 1);
      }
      return;
    }
    throw new SaveError("INVALID_SAVE", "Kayıt JSON olmayan veri içeriyor.");
  };
  visit(value, 0);
}
export function assertWorld(value: unknown): asserts value is WorldState {
  assertJsonTree(value);
  if (!object(value) || value.schemaVersion !== SAVE_SCHEMA)
    throw new SaveError("UNSUPPORTED_VERSION", "Bu kayıt sürümü desteklenmiyor.");
  const errors = validateState(value as WorldState);
  if (errors.length)
    throw new SaveError(
      "INVALID_STATE",
      `Dünya verisi doğrulanamadı: ${errors.slice(0, 4).join(", ")}`,
    );
}
/** The frozen v1 fixture predates notices and the reconciled ledger checkpoint. */
export function migrateState(value: unknown): WorldState {
  assertJsonTree(value);
  if (!object(value) || !Number.isSafeInteger(value.schemaVersion))
    throw new SaveError("INVALID_SAVE", "Kayıt şeması eksik.");
  if (
    value.schemaVersion !== 1 &&
    value.schemaVersion !== 2 &&
    value.schemaVersion !== 3 &&
    value.schemaVersion !== 4 &&
    value.schemaVersion !== 5 &&
    value.schemaVersion !== 6 &&
    value.schemaVersion !== SAVE_SCHEMA
  )
    throw new SaveError("UNSUPPORTED_VERSION", "Daha yeni veya bilinmeyen kayıt sürümü.");
  const copy = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  if (copy.schemaVersion === 1) {
    if (!object(copy.accounts) || !Array.isArray(copy.ledger))
      throw new SaveError("INVALID_STATE", "Eski muhasebe verisi eksik.");
    if (copy.ledgerCheckpoint === undefined) {
      const balances = { ...copy.accounts } as Record<string, number>;
      for (const balance of Object.values(balances))
        if (!Number.isSafeInteger(balance))
          throw new SaveError("INVALID_STATE", "Eski hesap bakiyesi geçersiz.");
      for (const raw of [...copy.ledger].reverse()) {
        if (
          !object(raw) ||
          typeof raw.from !== "string" ||
          typeof raw.to !== "string" ||
          !Number.isSafeInteger(raw.amount) ||
          (raw.amount as number) < 0 ||
          !Object.hasOwn(balances, raw.from) ||
          !Object.hasOwn(balances, raw.to)
        )
          throw new SaveError("INVALID_STATE", "Eski defter girdisi geçersiz.");
        balances[raw.from] += raw.amount as number;
        balances[raw.to] -= raw.amount as number;
        if (!Number.isSafeInteger(balances[raw.from]) || !Number.isSafeInteger(balances[raw.to]))
          throw new SaveError("INVALID_STATE", "Eski defter sınırı aşıldı.");
      }
      copy.ledgerCheckpoint = { count: 0, balances };
    }
    if (copy.notices === undefined) copy.notices = [];
    copy.schemaVersion = 2;
  }
  if (copy.schemaVersion === 2) {
    // This sequential step preserves all preexisting balances and identities; only zero accounts are registered.
    copy.life = initializeLife(copy as WorldState);
    copy.schemaVersion = 3;
    copy.engineVersion = ENGINE_VERSION;
  }
  if (copy.schemaVersion === 3) {
    const world = copy as WorldState;
    world.life = initializeLifeV2(world);
    world.mobility = initializeMobility(world);
    world.social = initializeSocial(world, true);
    world.progression = initializeProgression(world);
    world.economy = initializeEconomy(world);
    initializeMissionReservations(world, true);
    copy.schemaVersion = 4;
    copy.engineVersion = ENGINE_VERSION;
  }
  if (copy.schemaVersion === 4) {
    const world = copy as WorldState;
    world.economy.services = initializeServices(world);
    copy.schemaVersion = 5;
    copy.engineVersion = "1.0.0-candidate.4";
  }
  if (copy.schemaVersion === 5) {
    if (copy.engineVersion !== "1.0.0-candidate.4")
      throw new SaveError("UNSUPPORTED_VERSION", "Bilinmeyen eski oyun kuralları.");
    copy.schemaVersion = 6;
    copy.engineVersion = "1.0.0-candidate.5";
  }
  if (copy.schemaVersion === 6) {
    if (copy.engineVersion !== "1.0.0-candidate.5")
      throw new SaveError("UNSUPPORTED_VERSION", "Bilinmeyen eski oyun kuralları.");
    const errors = validateCandidate5(copy as WorldState);
    if (errors.length)
      throw new SaveError("INVALID_STATE", `Eski dünya geçersiz: ${errors.slice(0, 4).join(", ")}`);
    migrateLegacyTrafficPoses(copy as WorldState);
    copy.schemaVersion = SAVE_SCHEMA;
    copy.engineVersion = ENGINE_VERSION;
  }
  assertWorld(copy);
  return copy;
}
export async function sha256(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new SaveError("STORAGE_UNAVAILABLE", "Güvenli kayıt sağlama toplamı kullanılamıyor.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export async function encodeSave(
  slotId: string,
  state: WorldState,
  revisionId = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): Promise<SaveEnvelope> {
  assertSlot(slotId);
  assertWorld(state);
  const canonicalText = canonical(packRecords(state));
  let packed;
  try {
    packed = await gzipText(canonicalText);
  } catch {
    throw new SaveError(
      "INVALID_SAVE",
      "Kayıt sıkıştırılamadı veya genişletilmiş boyut sınırını aşıyor.",
    );
  }
  const { payload, decodedByteLength } = packed;
  const byteLength = new TextEncoder().encode(payload).byteLength;
  if (byteLength > MAX_SAVE_BYTES)
    throw new SaveError("INVALID_SAVE", "Kayıt boyutu 16 MiB sınırını aşıyor.");
  return {
    format: "social-engine-save",
    schemaVersion: SAVE_SCHEMA,
    gameVersion: state.engineVersion,
    slotId,
    revisionId,
    worldSeed: state.seed,
    tick: state.tick,
    createdAt,
    encoding: "canonical-json+gzip-base64",
    decodedByteLength,
    byteLength,
    sha256: await sha256(canonicalText),
    payloadSha256: await sha256(payload),
    payload,
  };
}
export async function decodeSave(value: unknown): Promise<DecodedSave> {
  if (
    !object(value) ||
    value.format !== "social-engine-save" ||
    (value.encoding !== "canonical-json" && value.encoding !== "canonical-json+gzip-base64")
  )
    throw new SaveError("INVALID_SAVE", "Bu dosya SOCIAL ENGINE kaydı değil.");
  if (
    value.schemaVersion !== 1 &&
    value.schemaVersion !== 2 &&
    value.schemaVersion !== 3 &&
    value.schemaVersion !== 4 &&
    value.schemaVersion !== 5 &&
    value.schemaVersion !== 6 &&
    value.schemaVersion !== SAVE_SCHEMA
  )
    throw new SaveError("UNSUPPORTED_VERSION", "Bu kayıt sürümü desteklenmiyor.");
  if (
    typeof value.payload !== "string" ||
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.sha256) ||
    typeof value.revisionId !== "string" ||
    value.revisionId.length > 128 ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.gameVersion !== "string" ||
    !Number.isSafeInteger(value.tick) ||
    !Number.isSafeInteger(value.worldSeed)
  )
    throw new SaveError("INVALID_SAVE", "Kayıt başlığı eksik veya geçersiz.");
  if (
    (value.schemaVersion === 6 && value.gameVersion !== "1.0.0-candidate.5") ||
    (value.schemaVersion === SAVE_SCHEMA && value.gameVersion !== ENGINE_VERSION)
  )
    throw new SaveError("UNSUPPORTED_VERSION", "Bilinmeyen oyun kuralları; kaynak korundu.");
  assertSlot(String(value.slotId));
  if (
    value.payload.length > MAX_SAVE_BYTES ||
    new TextEncoder().encode(value.payload).byteLength !== value.byteLength ||
    (value.byteLength as number) > MAX_SAVE_BYTES
  )
    throw new SaveError("INVALID_SAVE", "Kayıt boyutu doğrulanamadı.");
  const compressed = value.encoding === "canonical-json+gzip-base64";
  if (
    compressed &&
    ((value.schemaVersion !== 5 &&
      value.schemaVersion !== 6 &&
      value.schemaVersion !== SAVE_SCHEMA) ||
      typeof value.payloadSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.payloadSha256))
  )
    throw new SaveError("INVALID_SAVE", "Sıkıştırılmış kayıt başlığı geçersiz.");
  if ((await sha256(value.payload)) !== (compressed ? value.payloadSha256 : value.sha256))
    throw new SaveError("CHECKSUM_MISMATCH", "Kayıt hasarlı; doğrulanmış önceki sürüm aranıyor.");
  let canonicalText = value.payload;
  if (compressed) {
    try {
      canonicalText = await gunzipText(value.payload, value.decodedByteLength as number);
    } catch {
      throw new SaveError("INVALID_SAVE", "Kayıt güvenli boyut sınırları içinde açılamadı.");
    }
    if ((await sha256(canonicalText)) !== value.sha256)
      throw new SaveError("CHECKSUM_MISMATCH", "Açılan kayıt sağlama toplamı eşleşmiyor.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalText);
  } catch {
    throw new SaveError("INVALID_SAVE", "Kayıt verisi okunamadı.");
  }
  if (
    !object(parsed) ||
    parsed.schemaVersion !== value.schemaVersion ||
    parsed.tick !== value.tick ||
    parsed.seed !== value.worldSeed ||
    parsed.engineVersion !== value.gameVersion
  )
    throw new SaveError("INVALID_SAVE", "Kayıt başlığı dünya verisiyle eşleşmiyor.");
  if (
    (value.schemaVersion === 6 && parsed.rulesVersion !== "social-engine-rules-6") ||
    (value.schemaVersion === SAVE_SCHEMA && parsed.rulesVersion !== "social-engine-rules-7")
  )
    throw new SaveError("UNSUPPORTED_VERSION", "Bilinmeyen kayıt kuralları; kaynak korundu.");
  let materialized = parsed;
  if (value.schemaVersion >= 5) {
    try {
      assertJsonTree(parsed);
      materialized = unpackRecords(parsed);
    } catch (error) {
      throw new SaveError(
        "INVALID_SAVE",
        `Kayıt nesneleri doğrulanamadı: ${(error as Error).message}`,
      );
    }
  }
  // JSON.parse and unpackRecords produced an owned materialization. Current saves
  // need the same complete validation, without migration's extra copy and walks.
  let state: WorldState;
  if (value.schemaVersion === SAVE_SCHEMA) {
    assertWorld(materialized);
    state = materialized;
  } else state = migrateState(materialized);
  return {
    state,
    migrated: value.schemaVersion < SAVE_SCHEMA,
    sourceSchema: value.schemaVersion,
    ...(value.schemaVersion <= 6 ? { sourceState: migrateCandidate5(materialized) } : {}),
    source: value as SaveEnvelope,
  };
}
export async function decodeSaveText(text: string): Promise<DecodedSave> {
  if (text.length > MAX_SAVE_BYTES * 2)
    throw new SaveError("INVALID_SAVE", "İçe aktarılan dosya çok büyük.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new SaveError("INVALID_SAVE", "Geçersiz kayıt dosyası.");
  }
  return decodeSave(value);
}
