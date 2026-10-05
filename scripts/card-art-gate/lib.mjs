// Card-art release gate: pure validation logic shared by the CLI
// (validate.mjs), the release builder (release.mjs) and the unit tests.
// Nothing here writes into public/ or touches card data; it only reads a
// candidate art pack and the canonical source-cards.json files.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

export const GAMES = Object.freeze({
  "veto-h": {
    prefix: "SND",
    width: 576,
    height: 384,
    sourceSha256: "b876fdb69eeb4ddcfd1d06e397df14e14070cf3131ad4d210b4608e8fe7b4acd",
  },
  "gett-oh": {
    prefix: "RCN",
    width: 400,
    height: 300,
    sourceSha256: "e385808c632851e5110e47950af4c33f33e6f9784ca235ca7d70c5a1e6dd99a3",
  },
  "darbe-h": {
    prefix: "DRB",
    width: 400,
    height: 560,
    sourceSha256: "222916020ef176ced6ad72d4c61038bf045757e7ae9d7a6bfa6d8f99c657f3f9",
  },
});

export const CARDS_PER_GAME = 300;

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/**
 * Structural WebP parse (RIFF container + VP8/VP8L/VP8X headers). Returns
 * { ok, width, height, codec } or { ok:false, reason }. Pixel decode is a
 * separate, browser-backed step (validate.mjs --decode).
 */
export function parseWebp(buf) {
  if (buf.length < 30) return { ok: false, reason: "webp:too-short" };
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
    return { ok: false, reason: "webp:not-riff-webp" };
  }
  const riffSize = buf.readUInt32LE(4);
  if (riffSize + 8 !== buf.length) {
    return { ok: false, reason: `webp:riff-size-mismatch(${riffSize + 8}!=${buf.length})` };
  }
  let off = 12;
  let canvas = null;
  let image = null;
  while (off + 8 <= buf.length) {
    const tag = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const start = off + 8;
    const end = start + size;
    if (end > buf.length) return { ok: false, reason: `webp:truncated-chunk(${tag.trim()})` };
    const p = buf.subarray(start, end);
    if (tag === "VP8X") {
      if (size < 10) return { ok: false, reason: "webp:bad-vp8x" };
      if (p[0] & 0x02) return { ok: false, reason: "webp:animated" };
      canvas = { width: p.readUIntLE(4, 3) + 1, height: p.readUIntLE(7, 3) + 1 };
    } else if (tag === "VP8 " && !image) {
      if (size < 10 || p[3] !== 0x9d || p[4] !== 0x01 || p[5] !== 0x2a) {
        return { ok: false, reason: "webp:bad-vp8-keyframe" };
      }
      image = {
        codec: "VP8",
        width: p.readUInt16LE(6) & 0x3fff,
        height: p.readUInt16LE(8) & 0x3fff,
      };
    } else if (tag === "VP8L" && !image) {
      if (size < 5 || p[0] !== 0x2f) return { ok: false, reason: "webp:bad-vp8l-signature" };
      const bits = p.readUInt32LE(1);
      image = { codec: "VP8L", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    } else if (tag === "ANIM" || tag === "ANMF") {
      return { ok: false, reason: "webp:animated" };
    }
    off = end + (size & 1);
  }
  if (!image) return { ok: false, reason: "webp:no-image-chunk" };
  if (canvas && (canvas.width !== image.width || canvas.height !== image.height)) {
    return { ok: false, reason: "webp:canvas-image-size-mismatch" };
  }
  return { ok: true, codec: image.codec, width: image.width, height: image.height };
}

/** Deterministic release id: any changed byte in any of the 300 files moves every URL. */
export function releaseIdFor(rows) {
  const lines = [...rows]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => `${r.id}:${r.sha256}\n`);
  return `r${sha256(Buffer.from(lines.join(""))).slice(0, 12)}`;
}

export function loadSourceCards(repoRoot, game) {
  const path = join(repoRoot, "public/games", game, "source-cards.json");
  const raw = readFileSync(path);
  return { sha256: sha256(raw), cards: JSON.parse(raw.toString("utf8")) };
}

function readJsonl(path, issues) {
  if (!existsSync(path)) return null;
  const rows = [];
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (!line.trim()) return;
      try {
        rows.push(JSON.parse(line));
      } catch {
        issues.push({
          level: "error",
          code: "provenance:bad-jsonl-line",
          detail: `${basename(path)}:${i + 1}`,
        });
      }
    });
  return rows;
}

function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

/**
 * Validate one game's slice of a candidate pack.
 * packRoot: extracted pack root (contains public/games/<game>/assets/cards,
 * provenance/<game>.jsonl, prompts/<game>.json, provenance/MISSING.json).
 * decoded: optional Map(id -> {width,height} | {error}) from a real decoder.
 */
export function validateGame({ repoRoot, packRoot, game, decoded = null }) {
  const spec = GAMES[game];
  const issues = [];
  const source = loadSourceCards(repoRoot, game);
  if (source.sha256 !== spec.sourceSha256) {
    issues.push({
      level: "error",
      code: "source:sha-mismatch",
      detail: `source-cards.json ${source.sha256} != canonical ${spec.sourceSha256}`,
    });
  }
  const expected = source.cards.map((c) => c.id);
  const byId = new Map(source.cards.map((c) => [c.id, c]));
  if (expected.length !== CARDS_PER_GAME || byId.size !== CARDS_PER_GAME) {
    issues.push({
      level: "error",
      code: "source:id-count",
      detail: `${expected.length} cards / ${byId.size} unique, expected ${CARDS_PER_GAME}`,
    });
  }

  const cardsDir = join(packRoot, "public/games", game, "assets/cards");
  const nameRe = new RegExp(`^${spec.prefix}-\\d{3}\\.webp$`);
  const files = new Map();
  for (const name of existsSync(cardsDir) ? readdirSync(cardsDir).sort() : []) {
    const full = join(cardsDir, name);
    if (statSync(full).isDirectory()) {
      issues.push({ level: "error", code: "pack:unexpected-dir", detail: name });
    } else if (!nameRe.test(name)) {
      issues.push({ level: "error", code: "pack:misnamed-file", detail: name });
    } else if (!byId.has(name.slice(0, -5))) {
      issues.push({ level: "error", code: "pack:orphan-file", detail: name });
    } else {
      files.set(name.slice(0, -5), full);
    }
  }

  const provRows = readJsonl(join(packRoot, "provenance", `${game}.jsonl`), issues);
  if (!provRows)
    issues.push({ level: "error", code: "provenance:file-missing", detail: `${game}.jsonl` });
  const provById = new Map();
  for (const row of provRows || []) {
    if (!byId.has(row.id)) {
      issues.push({ level: "error", code: "provenance:unknown-id", detail: String(row.id) });
      continue;
    }
    if (!provById.has(row.id)) provById.set(row.id, []);
    provById.get(row.id).push(row);
  }
  const prompts = readJson(join(packRoot, "prompts", `${game}.json`));
  if (!prompts)
    issues.push({ level: "error", code: "prompts:file-missing", detail: `${game}.json` });
  const promptById = new Map((prompts || []).map((p) => [p.id, p]));
  const freeze = readJson(join(packRoot, "provenance", "MISSING.json"));
  const frozenMissing = new Set(freeze?.missing?.[game] || []);

  const cards = [];
  for (const id of expected) {
    const card = byId.get(id);
    const entry = {
      id,
      name: card.name,
      kind: card.kind,
      status: "missing",
      reasons: [],
      warnings: [],
    };
    cards.push(entry);
    const rows = provById.get(id) || [];
    const file = files.get(id);
    if (!file) {
      if (rows.length) entry.warnings.push(`provenance:row-without-file(${rows.length})`);
      continue;
    }
    const buf = readFileSync(file);
    entry.bytes = buf.length;
    entry.sha256 = sha256(buf);
    const parsed = parseWebp(buf);
    if (!parsed.ok) entry.reasons.push(parsed.reason);
    else {
      entry.codec = parsed.codec;
      entry.width = parsed.width;
      entry.height = parsed.height;
      if (parsed.width !== spec.width || parsed.height !== spec.height) {
        entry.reasons.push(`size:${parsed.width}x${parsed.height}!=${spec.width}x${spec.height}`);
      }
    }
    if (decoded) {
      const d = decoded.get(id);
      if (!d || d.error) entry.reasons.push(`decode:failed(${d?.error || "not-decoded"})`);
      else if (d.width !== spec.width || d.height !== spec.height) {
        entry.reasons.push(`decode:size ${d.width}x${d.height}`);
      }
    }
    if (!rows.length) entry.reasons.push("provenance:no-row");
    else {
      const match = rows.filter((r) => r.sha256 === entry.sha256);
      if (rows.length > 1) entry.warnings.push(`provenance:${rows.length}-rows`);
      if (!match.length)
        entry.reasons.push(`provenance:sha-mismatch(${rows.length} rows, none match file)`);
      else {
        const row = match[match.length - 1];
        if (row.name !== card.name) entry.reasons.push(`provenance:name-mismatch(${row.name})`);
        if (row.kind !== card.kind) entry.reasons.push(`provenance:kind-mismatch(${row.kind})`);
        if (row.bytes !== buf.length) entry.reasons.push(`provenance:bytes-mismatch(${row.bytes})`);
        if (row.width !== spec.width || row.height !== spec.height) {
          entry.reasons.push(`provenance:size-mismatch(${row.width}x${row.height})`);
        }
        if (!String(row.output || "").endsWith(`/games/${game}/assets/cards/${id}.webp`)) {
          entry.reasons.push(`provenance:output-path(${row.output})`);
        }
        if (!row.tool) entry.reasons.push("provenance:no-tool");
        if (!row.licenseNote && !row.note) entry.warnings.push("provenance:no-license-note");
        entry.sceneClass = row.sceneClass;
      }
    }
    const prompt = promptById.get(id);
    if (!prompt) entry.reasons.push("prompt:no-record");
    else {
      if (prompt.name !== card.name) entry.reasons.push(`prompt:name-mismatch(${prompt.name})`);
      if (prompt.w !== spec.width || prompt.h !== spec.height)
        entry.reasons.push("prompt:size-mismatch");
      entry.sceneClass ??= prompt.sceneClass;
    }
    if (freeze && frozenMissing.has(id)) {
      entry.reasons.push(`freeze:written-after-freeze(${freeze.frozenAt} lists it missing)`);
    }
    // Byte size is reported, never scored: a >8 KB file can still be the wrong card or a bad image.
    entry.status = entry.reasons.length ? "rejected" : "manifest-pass";
  }

  if (freeze) {
    const frozenCount = freeze.counts?.[game];
    issues.push({
      level: "info",
      code: "freeze:counts",
      detail: `MISSING.json frozenAt ${freeze.frozenAt}: ${frozenCount}/300 done, ${frozenMissing.size} missing; pack has ${files.size} files`,
    });
  } else {
    issues.push({
      level: "warning",
      code: "freeze:no-missing-json",
      detail: "no MISSING.json in pack",
    });
  }
  return {
    game,
    spec,
    sourceSha256: source.sha256,
    cards,
    issues,
    fileCount: files.size,
    legacyBytes: legacyBytes(repoRoot, game),
  };
}

// Asset weight: what a full 300-card release would add, next to today's production art.
function weightOf(r) {
  const sizes = r.cards.filter((c) => c.bytes != null).map((c) => c.bytes);
  const total = sizes.reduce((a, b) => a + b, 0);
  const avg = sizes.length ? Math.round(total / sizes.length) : 0;
  return {
    packBytes: total,
    avgBytes: avg,
    maxBytes: sizes.length ? Math.max(...sizes) : 0,
    projected300Bytes: avg * CARDS_PER_GAME,
    legacy300Bytes: r.legacyBytes ?? null,
  };
}

function legacyBytes(repoRoot, game) {
  const path = join(repoRoot, "public/games", game, "assets/art-manifest.json");
  if (!existsSync(path)) return null;
  const cards = Object.values(JSON.parse(readFileSync(path, "utf8")).cards || {});
  return cards.reduce((a, c) => a + (c.bytes || 0), 0);
}

/** Cross-game checks + summary. Mutates card entries for duplicate bytes. */
export function finalizeReport(results, { packLabel, decodeMode }) {
  const bySha = new Map();
  for (const r of results) {
    for (const c of r.cards) {
      if (!c.sha256) continue;
      if (!bySha.has(c.sha256)) bySha.set(c.sha256, []);
      bySha.get(c.sha256).push(`${r.game}/${c.id}`);
    }
  }
  for (const r of results) {
    for (const c of r.cards) {
      const same = c.sha256 ? bySha.get(c.sha256).filter((k) => k !== `${r.game}/${c.id}`) : [];
      if (same.length) {
        c.reasons.push(`duplicate-bytes:with(${same.join(",")})`);
        c.status = "rejected";
      }
    }
  }
  const games = {};
  for (const r of results) {
    const count = (s) => r.cards.filter((c) => c.status === s).length;
    const pass = count("manifest-pass");
    const blocking = r.issues.filter((i) => i.level === "error");
    games[r.game] = {
      expected: r.cards.length,
      filesInPack: r.fileCount,
      manifestPass: pass,
      rejected: count("rejected"),
      missing: count("missing"),
      under8KB: r.cards.filter((c) => c.bytes != null && c.bytes < 8192).length,
      weight: weightOf(r),
      packIssues: r.issues,
      releaseGate: pass === 300 && !blocking.length ? "READY_FOR_VISUAL_QA" : "BLOCKED",
      visualQa: "PENDING",
      sourceSha256: r.sourceSha256,
      missingIds: r.cards.filter((c) => c.status === "missing").map((c) => c.id),
      rejectedCards: r.cards
        .filter((c) => c.status === "rejected")
        .map((c) => ({ id: c.id, reasons: c.reasons })),
    };
  }
  return {
    schema: "card-art-gate/1",
    pack: packLabel,
    decode: decodeMode,
    note: "manifest-pass is an integrity check only. It is NOT a visual-quality or release acceptance; byte size (<8 KB / >8 KB) is never a quality signal.",
    line: Object.entries(games)
      .map(([g, s]) => `${g.split("-")[0].toUpperCase()} ${s.manifestPass}/300`)
      .join("; "),
    games,
    cards: Object.fromEntries(results.map((r) => [r.game, r.cards])),
  };
}

export function renderMarkdown(report) {
  const out = [];
  out.push("# Card art gate report", "");
  out.push(`- Pack: \`${report.pack}\``, `- Decode: ${report.decode}`, `- **${report.line}**`, "");
  out.push(`> ${report.note}`, "");
  const kb = (n) => (n == null ? "—" : `${Math.round(n / 1024)} KB`);
  out.push(
    "| Game | Files in pack | Manifest pass | Rejected | Missing | <8 KB | Avg / max | 300-card est. | Legacy 300 | Gate | Visual QA |",
  );
  out.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|");
  for (const [g, s] of Object.entries(report.games)) {
    const w = s.weight;
    out.push(
      `| ${g} | ${s.filesInPack} | ${s.manifestPass}/300 | ${s.rejected} | ${s.missing} | ${s.under8KB} | ${kb(w.avgBytes)} / ${kb(w.maxBytes)} | ${kb(w.projected300Bytes)} | ${kb(w.legacy300Bytes)} | ${s.releaseGate} | ${s.visualQa} |`,
    );
  }
  for (const [g, s] of Object.entries(report.games)) {
    out.push("", `## ${g}`, "");
    for (const i of s.packIssues) out.push(`- ${i.level}: \`${i.code}\` — ${i.detail}`);
    if (s.rejectedCards.length) {
      out.push("", "Rejected:", "");
      for (const c of s.rejectedCards) out.push(`- ${c.id}: ${c.reasons.join("; ")}`);
    }
    out.push("", `Missing (${s.missingIds.length}): ${s.missingIds.join(", ") || "—"}`);
  }
  return out.join("\n") + "\n";
}
