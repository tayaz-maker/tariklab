#!/usr/bin/env node
// One-command, re-runnable card-art gate.
//
//   npm run art:gate -- --pack <extracted-dir | pack.zip> [--out <dir>] [--decode auto|on|off]
//
// Writes <out>/card-art-gate.json and <out>/card-art-gate.md and prints the
// "VETO x/300; GETT y/300; DARBE z/300" line. Exit code is 0 only when all
// three games reach 300/300 manifest-pass (still pending human visual QA).
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GAMES, validateGame, finalizeReport, renderMarkdown } from "./lib.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const packArg = opt("pack");
if (!packArg) {
  console.error("usage: npm run art:gate -- --pack <dir|zip> [--out dir] [--decode auto|on|off]");
  process.exit(2);
}

function resolvePackRoot(p) {
  let root = resolve(p);
  if (root.endsWith(".zip")) {
    const dest = mkdtempSync(join(tmpdir(), "card-art-pack-"));
    execFileSync("unzip", ["-q", root, "-d", dest]);
    root = dest;
  }
  // Accept either the pack root itself or a parent holding one directory.
  if (!existsSync(join(root, "public/games")) && !existsSync(join(root, "provenance"))) {
    const kids = readdirSync(root).filter((n) => existsSync(join(root, n, "public/games")));
    if (kids.length === 1) root = join(root, kids[0]);
  }
  return root;
}

async function browserDecode(packRoot) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  try {
    const page = await browser.newPage();
    const out = {};
    for (const game of Object.keys(GAMES)) {
      const dir = join(packRoot, "public/games", game, "assets/cards");
      const map = new Map();
      out[game] = map;
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir).filter((n) => n.endsWith(".webp"))) {
        const b64 = readFileSync(join(dir, name)).toString("base64");
        const res = await page.evaluate(async (data) => {
          try {
            const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
            const bmp = await createImageBitmap(new Blob([bytes], { type: "image/webp" }));
            const c = new OffscreenCanvas(bmp.width, bmp.height);
            const ctx = c.getContext("2d");
            ctx.drawImage(bmp, 0, 0);
            // Flat single-colour frames decode fine but are not art.
            const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
            let min = 255;
            let max = 0;
            for (let i = 0; i < px.length; i += 4 * 97) {
              const l = (px[i] + px[i + 1] + px[i + 2]) / 3;
              if (l < min) min = l;
              if (l > max) max = l;
            }
            return { width: bmp.width, height: bmp.height, flat: max - min < 8 };
          } catch (error) {
            return { error: String(error && error.message ? error.message : error) };
          }
        }, b64);
        if (res.flat) res.error = "flat-image";
        map.set(name.slice(0, -5), res);
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}

const packRoot = resolvePackRoot(packArg);
const decodeOpt = opt("decode", "auto");
let decoded = null;
let decodeMode = "off (structural RIFF/VP8 header parse only)";
if (decodeOpt !== "off") {
  try {
    decoded = await browserDecode(packRoot);
    decodeMode = "chromium createImageBitmap (full pixel decode)";
  } catch (error) {
    if (decodeOpt === "on") throw error;
    decodeMode = `off — browser decoder unavailable (${error.message.split("\n")[0]})`;
  }
}

const results = Object.keys(GAMES).map((game) =>
  validateGame({ repoRoot, packRoot, game, decoded: decoded ? decoded[game] : null }),
);
const report = finalizeReport(results, { packLabel: packArg, decodeMode });
const outDir = resolve(opt("out", join(repoRoot, "artifacts/card-art-gate")));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "card-art-gate.json"), JSON.stringify(report, null, 2) + "\n");
writeFileSync(join(outDir, "card-art-gate.md"), renderMarkdown(report));
console.log(report.line);
for (const [g, s] of Object.entries(report.games)) {
  console.log(
    `${g}: files ${s.filesInPack}, pass ${s.manifestPass}, rejected ${s.rejected}, missing ${s.missing}, gate ${s.releaseGate}, visual QA ${s.visualQa}`,
  );
}
console.log(`report: ${join(outDir, "card-art-gate.md")}`);
process.exit(
  Object.values(report.games).every((s) => s.releaseGate === "READY_FOR_VISUAL_QA") ? 0 : 1,
);
