#!/usr/bin/env node
// Promote ONE game's art pack to an atomic, content-addressed release.
//
//   node scripts/card-art-gate/release.mjs --pack <dir> --game darbe-h --signoff <qa.json> [--write]
//
// Refuses unless: the gate reports 300/300 manifest-pass with no pack errors,
// and a human visual-QA sign-off ({ game, releaseId, verdict: "PASS",
// reviewer, date }) names exactly the release id these 300 files hash to.
// Without --write it only prints what it would do. With --write it copies the
// 300 files + manifest.json into
// public/games/<game>/assets/card-art-releases/<releaseId>/ and only then flips
// the pointer in public/games/duel-core/art-release.js (last step, so a
// half-copied release is never referenced). Legacy art is left in place.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GAMES, validateGame, finalizeReport, releaseIdFor } from "./lib.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function planRelease({ repoRoot, packRoot, game, signoff }) {
  if (!GAMES[game]) return { ok: false, reason: `unknown game ${game}` };
  const result = validateGame({ repoRoot, packRoot, game });
  const report = finalizeReport([result], { packLabel: packRoot, decodeMode: "release" });
  const summary = report.games[game];
  if (summary.releaseGate !== "READY_FOR_VISUAL_QA") {
    return {
      ok: false,
      reason: `gate BLOCKED: ${summary.manifestPass}/300 manifest-pass, ${summary.rejected} rejected, ${summary.missing} missing`,
    };
  }
  const rows = result.cards.map((c) => ({ id: c.id, sha256: c.sha256, bytes: c.bytes }));
  const releaseId = releaseIdFor(rows);
  if (!signoff) return { ok: false, reason: "no visual-QA sign-off", releaseId };
  if (signoff.game !== game || signoff.releaseId !== releaseId || signoff.verdict !== "PASS") {
    return { ok: false, reason: `sign-off does not approve ${game}/${releaseId}`, releaseId };
  }
  if (!signoff.reviewer || !signoff.date)
    return { ok: false, reason: "sign-off needs reviewer and date", releaseId };
  const spec = GAMES[game];
  return {
    ok: true,
    releaseId,
    pointer: {
      id: releaseId,
      status: "accepted",
      count: 300,
      kind: "webp",
      width: spec.width,
      height: spec.height,
    },
    manifest: {
      schema: "card-art-release/1",
      game,
      releaseId,
      sourceSha256: result.sourceSha256,
      width: spec.width,
      height: spec.height,
      visualQa: { reviewer: signoff.reviewer, date: signoff.date, verdict: signoff.verdict },
      cards: Object.fromEntries(rows.map((r) => [r.id, { bytes: r.bytes, sha256: r.sha256 }])),
    },
  };
}

export function setPointer(source, game, pointer) {
  const re = new RegExp(`("${game}": )(null|\\{[^}]*\\})(,)`);
  if (!re.test(source)) throw new Error(`art-release.js has no entry for ${game}`);
  return source.replace(
    re,
    (_m, a, _b, c) => `${a}${JSON.stringify(pointer).replace(/"(\w+)":/g, "$1: ")}${c}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
  const packRoot = resolve(opt("pack") || "");
  const game = opt("game");
  const signoffPath = opt("signoff");
  const signoff =
    signoffPath && existsSync(signoffPath) ? JSON.parse(readFileSync(signoffPath, "utf8")) : null;
  const plan = planRelease({ repoRoot, packRoot, game, signoff });
  if (!plan.ok) {
    console.error(
      `REFUSED ${game}: ${plan.reason}${plan.releaseId ? ` (release id would be ${plan.releaseId})` : ""}`,
    );
    process.exit(1);
  }
  const dest = join(repoRoot, "public/games", game, "assets/card-art-releases", plan.releaseId);
  console.log(`${game} → ${dest}`);
  if (!args.includes("--write")) {
    console.log("dry run; pass --write to copy files and flip the pointer");
    process.exit(0);
  }
  mkdirSync(dest, { recursive: true });
  for (const id of Object.keys(plan.manifest.cards)) {
    copyFileSync(
      join(packRoot, "public/games", game, "assets/cards", `${id}.webp`),
      join(dest, `${id}.webp`),
    );
  }
  writeFileSync(join(dest, "manifest.json"), JSON.stringify(plan.manifest, null, 2) + "\n");
  const pointerFile = join(repoRoot, "public/games/duel-core/art-release.js");
  writeFileSync(pointerFile, setPointer(readFileSync(pointerFile, "utf8"), game, plan.pointer));
  console.log(`released ${game} ${plan.releaseId}`);
}
