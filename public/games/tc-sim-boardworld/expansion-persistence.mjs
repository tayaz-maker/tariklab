import { EXPANSION_SAVE_VERSION, loadExpansionRuntime } from "./engine.mjs";
const EXPANSION_READ_ERROR = "Nesiller kaydı okunamadı; kayıt dosyasıyla kurtarabilirsin.";

function expansionLoad(storage, [probe, read]) {
  const { token, saved } = probe(storage);
  for (const [index, bytes] of [token.primary, token.backup].entries()) {
    const loaded = bytes && read(bytes);
    if (loaded?.state && loaded.sourceVersion === EXPANSION_SAVE_VERSION)
      return {
        ...loaded,
        token,
        saved: true,
        message: index ? "Nesiller ana kaydı okunamadı. Sağlam yedek açıldı." : loaded.message,
      };
  }
  return {
    state: null,
    token,
    saved,
    message: saved ? EXPANSION_READ_ERROR : "",
  };
}

export async function loadExpansion(io, storage, locks, transact) {
  await loadExpansionRuntime();
  // Read the latest slots under the lock after all module downloads finish.
  return locks.request(io[6], () => transact(storage, (memory) => expansionLoad(memory, io)));
}

export async function recoverExpansion(io, snapshot) {
  await loadExpansionRuntime();
  return { ...expansionLoad(snapshot, io), token: null, message: io[7] };
}

export async function saveExpansionLocked(io,
  state,
  storage,
  expectedToken,
  locks = globalThis.navigator?.locks,
  transact = io[3],
) {
  const [probe, read, write, , checked, conflict, lock, warning, livingKey, livingState] = io;
  if (!locks?.request) return { ok: false, message: warning };
  try {
    return await locks.request(lock, () =>
      transact(storage, (memory, generation) => {
        const previous = probe(memory).token;
        if (
          expectedToken?.generation !== generation ||
          previous.key !== expectedToken.key ||
          previous.primary !== expectedToken.primary ||
          previous.backup !== expectedToken.backup
        )
          return conflict();
        if (state?.version !== EXPANSION_SAVE_VERSION) throw new Error("invalid-expansion-state");
        const encoded = write(state);
        const key = livingState(state) ? livingKey : previous.key;
        const primary = previous.primary && read(previous.primary);
        const backup =
          primary?.sourceVersion === EXPANSION_SAVE_VERSION ? previous.primary : previous.backup;
        // First promotion retains the legacy branch and creates a recoverable
        // new pair atomically under the existing global generation/CAS lock.
        if (backup && (key !== previous.key || backup !== previous.backup))
          checked(memory, `${key}.backup`, backup);
        checked(memory, key, encoded);
        return {
          ok: true,
          token: { key, primary: encoded, backup },
          message: "Bu tarayıcıya kaydedildi.",
        };
      }),
    );
  } catch {
    return { ok: false, message: warning };
  }
}
