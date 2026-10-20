import { readFileSync } from "node:fs";
import { buildCards } from "../public/games/duel-core/card-data.js";
import { designs as snd } from "../public/games/veto-h/designs.js";
import { designs as rcn } from "../public/games/gett-oh/designs.js";
export const pools = Object.fromEntries(
  [
    ["veto-h", snd],
    ["gett-oh", rcn],
  ].map(([theme, designs]) => [
    theme,
    buildCards(
      JSON.parse(readFileSync(`public/games/${theme}/source-cards.json`, "utf8")),
      designs,
      theme,
    ),
  ]),
);
