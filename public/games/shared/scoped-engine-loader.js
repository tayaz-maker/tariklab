// Browser loading policy only; no gameplay, save or asset mutation.
const pageGame = typeof document === "undefined" ? "" : document.body?.dataset.game;
const scopedGame = new Set(["apartman", "kayip-telefon", "son-100-gun", "tc-sim-devlet", "son-kasaba"]).has(pageGame) ? pageGame : "";
export const loadGame = (owner, load) => !scopedGame || scopedGame === owner ? load() : Promise.resolve({});
