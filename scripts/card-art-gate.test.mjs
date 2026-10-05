// Card-art release gate: validator logic, atomic release pointer, DARBE
// SVG→WebP migration path and old/new art cache separation. Uses small synthetic
// packs only; the real Grok pack is validated with `npm run art:gate`.
import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GAMES,
  parseWebp,
  releaseIdFor,
  sha256,
  validateGame,
  finalizeReport,
} from "./card-art-gate/lib.mjs";
import { planRelease, setPointer } from "./card-art-gate/release.mjs";
import {
  ART_RELEASES,
  acceptedRelease,
  resolveCardArt,
} from "../public/games/duel-core/art-release.js";
import { cardArt, themeMeta } from "../public/games/duel-core/theme-meta.js";

const repoRoot = new URL("..", import.meta.url).pathname;

// Minimal lossless (VP8L) WebP header with the given size; `salt` makes bytes unique.
function fakeWebp(width, height, salt = 0) {
  const vp8l = Buffer.alloc(5 + 8);
  vp8l[0] = 0x2f;
  vp8l.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 1);
  vp8l.writeUInt32LE(salt, 5);
  const chunk = Buffer.concat([Buffer.from("VP8L"), Buffer.alloc(4), vp8l]);
  chunk.writeUInt32LE(vp8l.length, 4);
  const riff = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), chunk]);
  riff.writeUInt32LE(riff.length - 8, 4);
  return riff;
}

function source(game) {
  return JSON.parse(
    readFileSync(join(repoRoot, "public/games", game, "source-cards.json"), "utf8"),
  );
}

// Builds a synthetic pack with `count` valid cards for `game`.
function makePack(game, count, mutate = () => {}) {
  const root = mkdtempSync(join(tmpdir(), "art-gate-"));
  const spec = GAMES[game];
  const dir = join(root, "public/games", game, "assets/cards");
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(root, "provenance"));
  mkdirSync(join(root, "prompts"));
  const cards = source(game);
  const prov = [];
  cards.slice(0, count).forEach((c, i) => {
    const buf = fakeWebp(spec.width, spec.height, i + 1);
    writeFileSync(join(dir, `${c.id}.webp`), buf);
    prov.push({
      id: c.id,
      name: c.name,
      kind: c.kind,
      output: `/x/public/games/${game}/assets/cards/${c.id}.webp`,
      width: spec.width,
      height: spec.height,
      bytes: buf.length,
      sha256: sha256(buf),
      tool: "test",
      note: "test",
    });
  });
  const prompts = cards.map((c) => ({
    id: c.id,
    name: c.name,
    w: spec.width,
    h: spec.height,
    sceneClass: "object",
  }));
  const ctx = { root, dir, prov, prompts, cards };
  mutate(ctx);
  writeFileSync(
    join(root, "provenance", `${game}.jsonl`),
    ctx.prov.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  writeFileSync(join(root, "prompts", `${game}.json`), JSON.stringify(ctx.prompts));
  return root;
}

const gate = (packRoot, game) =>
  finalizeReport([validateGame({ repoRoot, packRoot, game })], {
    packLabel: "t",
    decodeMode: "off",
  });

test("canonical source-cards.json hashes are unchanged (card data is not part of the art release)", () => {
  for (const game of Object.keys(GAMES)) {
    assert.equal(
      sha256(readFileSync(join(repoRoot, "public/games", game, "source-cards.json"))),
      GAMES[game].sourceSha256,
      game,
    );
    assert.equal(new Set(source(game).map((c) => c.id)).size, 300, game);
  }
});

test("parseWebp reads real dimensions and rejects truncated / non-WebP bytes", () => {
  assert.deepEqual(parseWebp(fakeWebp(400, 560)), {
    ok: true,
    codec: "VP8L",
    width: 400,
    height: 560,
  });
  assert.equal(parseWebp(fakeWebp(400, 560).subarray(0, 25)).ok, false);
  assert.equal(
    parseWebp(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>".padEnd(40))).ok,
    false,
  );
  const realLegacy = join(repoRoot, "public/games/veto-h/assets/cards/SND-001.webp");
  if (existsSync(realLegacy)) {
    const p = parseWebp(readFileSync(realLegacy));
    assert.equal(p.ok, true);
    assert.deepEqual([p.width, p.height], [576, 384]);
  }
});

test("a full, clean 300/300 pack reaches READY_FOR_VISUAL_QA, never ACCEPTED", () => {
  const r = gate(makePack("darbe-h", 300), "darbe-h");
  assert.equal(r.games["darbe-h"].manifestPass, 300);
  assert.equal(r.games["darbe-h"].releaseGate, "READY_FOR_VISUAL_QA");
  assert.equal(r.games["darbe-h"].visualQa, "PENDING");
  assert.equal(r.line, "DARBE 300/300");
});

test("a partial pack is BLOCKED and lists every missing id", () => {
  const r = gate(makePack("gett-oh", 135), "gett-oh").games["gett-oh"];
  assert.equal(r.manifestPass, 135);
  assert.equal(r.missing, 165);
  assert.equal(r.missingIds[0], "RCN-136");
  assert.equal(r.releaseGate, "BLOCKED");
});

test("every rejection carries a reason: size, provenance, name swap, duplicate bytes, stray files, freeze", () => {
  const root = makePack("veto-h", 300, (ctx) => {
    const [a, b, c, d, e, f] = ctx.cards;
    writeFileSync(join(ctx.dir, `${a.id}.webp`), fakeWebp(400, 300, 9999)); // wrong size
    ctx.prov = ctx.prov.filter((r) => r.id !== b.id); // no provenance row
    ctx.prov.find((r) => r.id === c.id).name = d.name; // provenance says another card
    writeFileSync(join(ctx.dir, `${e.id}.webp`), readFileSync(join(ctx.dir, `${f.id}.webp`))); // same bytes
    ctx.prov.find((r) => r.id === e.id).sha256 = ctx.prov.find((r) => r.id === f.id).sha256;
    ctx.prov.find((r) => r.id === e.id).bytes = ctx.prov.find((r) => r.id === f.id).bytes;
    writeFileSync(join(ctx.dir, "SND-017.webp.tmp"), "x");
    writeFileSync(
      join(ctx.root, "provenance/MISSING.json"),
      JSON.stringify({
        frozenAt: "T",
        counts: { "veto-h": 299 },
        missing: { "veto-h": [ctx.cards[299].id] },
      }),
    );
  });
  const r = gate(root, "veto-h").games["veto-h"];
  const why = Object.fromEntries(r.rejectedCards.map((c) => [c.id, c.reasons.join("|")]));
  assert.match(why["SND-001"], /size:400x300/);
  assert.match(why["SND-002"], /provenance:no-row/);
  assert.match(why["SND-003"], /provenance:name-mismatch/);
  assert.match(why["SND-005"], /duplicate-bytes:with\(veto-h\/SND-006\)/);
  assert.match(why["SND-006"], /duplicate-bytes:with\(veto-h\/SND-005\)/);
  assert.match(why["SND-300"], /freeze:written-after-freeze/);
  assert.ok(
    r.packIssues.some((i) => i.code === "pack:misnamed-file" && i.detail === "SND-017.webp.tmp"),
  );
  assert.equal(r.releaseGate, "BLOCKED");
});

test("byte size is never a quality signal: a clean pack of tiny files still reaches only manifest-pass with visual QA PENDING", () => {
  const r = gate(makePack("darbe-h", 300), "darbe-h").games["darbe-h"];
  assert.equal(r.under8KB, 300);
  assert.equal(r.manifestPass, 300);
  assert.equal(r.visualQa, "PENDING");
});

test("release.mjs refuses partial packs and missing / mismatched visual-QA sign-off", () => {
  const partial = planRelease({
    repoRoot,
    packRoot: makePack("darbe-h", 159),
    game: "darbe-h",
    signoff: null,
  });
  assert.equal(partial.ok, false);
  assert.match(partial.reason, /159\/300/);
  const full = makePack("darbe-h", 300);
  const noQa = planRelease({ repoRoot, packRoot: full, game: "darbe-h", signoff: null });
  assert.equal(noQa.ok, false);
  assert.match(noQa.releaseId, /^r[0-9a-f]{12}$/);
  const wrong = planRelease({
    repoRoot,
    packRoot: full,
    game: "darbe-h",
    signoff: {
      game: "darbe-h",
      releaseId: "r000000000000",
      verdict: "PASS",
      reviewer: "x",
      date: "d",
    },
  });
  assert.equal(wrong.ok, false);
  const ok = planRelease({
    repoRoot,
    packRoot: full,
    game: "darbe-h",
    signoff: {
      game: "darbe-h",
      releaseId: noQa.releaseId,
      verdict: "PASS",
      reviewer: "x",
      date: "d",
    },
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.pointer, {
    id: noQa.releaseId,
    status: "accepted",
    count: 300,
    kind: "webp",
    width: 400,
    height: 560,
  });
  assert.equal(Object.keys(ok.manifest.cards).length, 300);
});

test("release id is content-addressed: changing one image changes every URL of the release", () => {
  const rows = source("gett-oh").map((c, i) => ({
    id: c.id,
    sha256: sha256(Buffer.from(String(i))),
  }));
  const a = releaseIdFor(rows);
  assert.equal(releaseIdFor([...rows].reverse()), a);
  rows[150] = { ...rows[150], sha256: sha256(Buffer.from("changed")) };
  assert.notEqual(releaseIdFor(rows), a);
});

test("production keeps legacy art until a release is accepted: no theme has a release pointer yet", () => {
  assert.deepEqual(ART_RELEASES, { "veto-h": null, "gett-oh": null, "darbe-h": null });
  const card = { id: "DRB-001" };
  assert.equal(cardArt("darbe-h", card).src, "/games/darbe-h/assets/cards/DRB-001.svg");
  assert.equal(cardArt("veto-h", { id: "SND-001" }).src, "/games/veto-h/assets/cards/SND-001.webp");
  assert.equal(
    cardArt("gett-oh", { id: "RCN-001" }).src,
    "/games/gett-oh/assets/cards/RCN-001.webp",
  );
  assert.equal(themeMeta("darbe-h").art.kind, "svg");
});

test("DARBE SVG→WebP switch happens only as one accepted 300/300 release, in a new content-addressed directory", () => {
  const art = themeMeta("darbe-h").art;
  const accepted = {
    "darbe-h": {
      id: "r0123456789ab",
      status: "accepted",
      count: 300,
      kind: "webp",
      width: 400,
      height: 560,
    },
  };
  const served = resolveCardArt("darbe-h", { id: "DRB-042" }, art, accepted);
  assert.deepEqual(served, {
    src: "/games/darbe-h/assets/card-art-releases/r0123456789ab/DRB-042.webp",
    width: 400,
    height: 560,
  });
  // A new URL never equals any legacy URL, so per-URL SW cache entries cannot mix old and new bytes.
  assert.notEqual(served.src, resolveCardArt("darbe-h", { id: "DRB-042" }, art, {}).src);
  for (const bad of [
    { ...accepted["darbe-h"], count: 159 },
    { ...accepted["darbe-h"], status: "pending" },
    { ...accepted["darbe-h"], id: "latest" },
    { ...accepted["darbe-h"], kind: "svg" },
  ]) {
    assert.equal(acceptedRelease("darbe-h", { "darbe-h": bad }), null);
    assert.equal(
      resolveCardArt("darbe-h", { id: "DRB-042" }, art, { "darbe-h": bad }).src,
      "/games/darbe-h/assets/cards/DRB-042.svg",
    );
  }
  // Other themes are unaffected by a DARBE release.
  assert.equal(
    resolveCardArt("veto-h", { id: "SND-001" }, themeMeta("veto-h").art, accepted).src,
    "/games/veto-h/assets/cards/SND-001.webp",
  );
});

test("setPointer flips exactly one theme entry in art-release.js", () => {
  const src = readFileSync(join(repoRoot, "public/games/duel-core/art-release.js"), "utf8");
  const next = setPointer(src, "darbe-h", {
    id: "r0123456789ab",
    status: "accepted",
    count: 300,
    kind: "webp",
    width: 400,
    height: 560,
  });
  assert.match(next, /"darbe-h": \{id: "r0123456789ab"/);
  assert.match(next, /"veto-h": null,/);
  assert.match(next, /"gett-oh": null,/);
});

test("any committed release directory is complete: 300 files matching its manifest, and the pointer names it", () => {
  for (const game of Object.keys(GAMES)) {
    const base = join(repoRoot, "public/games", game, "assets/card-art-releases");
    const pointer = ART_RELEASES[game];
    if (pointer)
      assert.ok(existsSync(join(base, pointer.id)), `${game} pointer names a missing release dir`);
    if (!existsSync(base)) continue;
    const ids = source(game)
      .map((c) => c.id)
      .sort();
    for (const rel of readdirSync(base)) {
      const manifest = JSON.parse(readFileSync(join(base, rel, "manifest.json"), "utf8"));
      assert.equal(manifest.releaseId, rel);
      assert.deepEqual(Object.keys(manifest.cards).sort(), ids);
      const rows = [];
      for (const id of ids) {
        const buf = readFileSync(join(base, rel, `${id}.webp`));
        assert.equal(sha256(buf), manifest.cards[id].sha256, `${game}/${rel}/${id}`);
        const p = parseWebp(buf);
        assert.deepEqual([p.width, p.height], [GAMES[game].width, GAMES[game].height]);
        rows.push({ id, sha256: manifest.cards[id].sha256 });
      }
      assert.equal(releaseIdFor(rows), rel);
    }
  }
});

test("the offline precache never lists card art and cards load lazily, so opening the portal does not download 900 images", () => {
  const sw = readFileSync(join(repoRoot, "public/sw.js"), "utf8");
  const shell = sw.match(/const SHELL = (\[[^\]]*\])/)[1];
  assert.doesNotMatch(shell, /games|cards|card-art/);
  const app = readFileSync(join(repoRoot, "public/games/duel-core/app.js"), "utf8");
  assert.match(app, /src: cardArt\(theme, card\)\.src,\s*alt: "",\s*loading: "lazy"/);
  assert.doesNotMatch(app, /new Image\(|prefetch|preload/);
});
