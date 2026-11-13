import { EXPANSION_SAVE_VERSION, loadExpansionRuntime } from "./engine.mjs";
const EXPANSION_KEY = "tariklab.boardworld.v7";
const EXPANSION_BACKUP_KEY = `${EXPANSION_KEY}.backup`;
const EXPANSION_READ_ERROR = "Nesiller kaydı okunamadı; kayıt dosyasıyla kurtarabilirsin.";

function expansionLoad(storage, [probe, read]) {
  const token = probe(storage).token;
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
    saved: Boolean(token.primary || token.backup),
    message: token.primary || token.backup ? EXPANSION_READ_ERROR : "",
  };
}

// Called while Gold's Web Lock is held, but outside an IndexedDB transaction.
export async function loadExpansion(io, storage, transact = io[3]) {
  await loadExpansionRuntime();
  return transact(storage, (memory) => expansionLoad(memory, io));
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
  const [probe, read, write, , checked, conflict, lock, warning] = io;
  if (!locks?.request) return { ok: false, message: warning };
  try {
    return await locks.request(lock, () =>
      transact(storage, (memory, generation) => {
        const previous = probe(memory).token;
        if (
          expectedToken?.generation !== generation ||
          previous.primary !== expectedToken.primary ||
          previous.backup !== expectedToken.backup
        )
          return conflict();
        if (state?.version !== EXPANSION_SAVE_VERSION) throw new Error("invalid-expansion-state");
        const encoded = write(state);
        const primary = previous.primary && read(previous.primary);
        const backup =
          primary?.sourceVersion === EXPANSION_SAVE_VERSION ? previous.primary : previous.backup;
        if (backup !== previous.backup) checked(memory, EXPANSION_BACKUP_KEY, backup);
        checked(memory, EXPANSION_KEY, encoded);
        return {
          ok: true,
          token: { primary: encoded, backup },
          message: "Bu tarayıcıya kaydedildi.",
        };
      }),
    );
  } catch {
    return { ok: false, message: warning };
  }
}
