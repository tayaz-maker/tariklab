import { archivedGameSlugs } from "./legacy-game-inventory.mjs";
export { archivedGameSlugs } from "./legacy-game-inventory.mjs";
export const retirementHtml = '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/"><title>TarikLab — Arşiv</title><h1>Oyun arşivlendi</h1><p>Kayıtların silinmedi. / Your saves are preserved. / Twoje zapisy zostały zachowane.</p><a href="/">Oyunlar · Games · Gry</a></html>';
// Keep source for recovery; Nitro excludes only the game-owned directories.
export function legacyGamesArchivePlugin() {
  return {
    name: "tariklab:legacy-games-archive",
    apply: "build",
    generateBundle() {
      if (this.environment?.name !== "client") return;
      for (const slug of archivedGameSlugs)
        this.emitFile({ type: "asset", fileName: `games/${slug}/index.html`, source: retirementHtml });
    },
  };
}
