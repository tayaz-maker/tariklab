// IP gate: asset register shape, third-party notices coverage and a blocked-terms
// scan over shipped product text. See docs/ip/README.md. Engineering control only;
// it does not replace counsel review.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");

export function parseCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") endCell();
    else if (c === "\n") {
      endCell();
      rows.push(row);
      row = [];
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    endCell();
    rows.push(row);
  }
  const [head, ...body] = rows;
  return body
    .filter((r) => r.some(Boolean))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const COLUMNS = [
  "id",
  "path",
  "title",
  "kind",
  "count",
  "creator",
  "created",
  "source_type",
  "license",
  "commercial_use",
  "modification",
  "evidence",
  "status",
  "note",
];

test("asset register has the required columns, unique ids and honest statuses", () => {
  const text = read("docs/ip/ASSET_REGISTER.csv");
  assert.deepEqual(text.split("\n")[0].split(","), COLUMNS);
  const rows = parseCsv(text);
  assert.ok(rows.length >= 15);
  const ids = rows.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate register id");
  for (const r of rows) {
    assert.match(r.id, /^A\d{3}$/);
    assert.ok(["CLEARED", "REVIEW", "BLOCKED"].includes(r.status), `${r.id} status ${r.status}`);
    assert.ok(r.path && r.title && r.kind, `${r.id} incomplete`);
    // Unknown commercial-use rights can never be recorded as cleared.
    if (/unknown/i.test(r.commercial_use))
      assert.notEqual(r.status, "CLEARED", `${r.id} cleared with unknown rights`);
    // New titles are cleared only with a written counsel reference.
    if (/slice/i.test(r.title) && r.status === "CLEARED")
      assert.match(r.note, /counsel:\s*\S+/i, `${r.id} lacks counsel ref`);
    // Audio is out of scope for TarikLab.
    if (r.kind === "audio") assert.equal(Number(r.count || 0), 0, "audio asset registered");
  }
});

test("every client package has a notice entry at the locked version with an allowed license", () => {
  const { packages } = JSON.parse(read("docs/ip/client-packages.json"));
  const lock = JSON.parse(read("package-lock.json")).packages;
  const notices = read("docs/ip/THIRD_PARTY_NOTICES.md");
  const allowed = /^(MIT|ISC|Apache-2\.0|0BSD|BSD-2-Clause|BSD-3-Clause)$/;
  assert.ok(packages.length >= 40);
  for (const name of packages) {
    const locked = lock[`node_modules/${name}`];
    assert.ok(locked, `${name} not in package-lock`);
    const row = notices.match(
      new RegExp(`^\\| ${name.replace(/[/.]/g, "\\$&")} \\| ([^|]+) \\| ([^|]+) \\|$`, "m"),
    );
    assert.ok(row, `${name} missing from THIRD_PARTY_NOTICES.md`);
    assert.equal(
      row[1].trim(),
      locked.version,
      `${name} notice version is stale; rerun scripts/ip/third-party-notices.mjs`,
    );
    assert.match(row[2].trim(), allowed, `${name} license`);
  }
});

// Third-party product names that must never appear in TarikLab product text.
// Legacy occurrences are counted per file so the number can only go down.
const BLOCKED = /mini ?metro|dinosaur polo|apartman y[öo]neticisi|\binkle\b|extreme last 100/gi;
const LEGACY = {
  "public/credits.html": 2,
  "public/games/apartman/help.js": 1,
  "public/games/next-wave.js": 1,
  "public/i18n/tlab-i18n.js": 6,
  "src/lib/i18n.ts": 2,
  "src/lib/games.ts": 1,
};
const SHIPPED = /\.(js|mjs|ts|tsx|html|css|json|webmanifest|xml|svg|txt)$/;

function* walk(dir) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) yield* walk(rel);
    else if (SHIPPED.test(name)) yield rel;
  }
}

test("no blocked third-party names in shipped product text beyond the recorded legacy count", () => {
  const found = {};
  for (const dir of ["public", "src"])
    for (const file of walk(dir)) {
      if (file.startsWith("public/__grok/") || file.includes("/__grok/")) continue;
      const n = (read(file).match(BLOCKED) || []).length;
      if (n) found[file] = n;
    }
  for (const [file, n] of Object.entries(found))
    assert.ok(
      n <= (LEGACY[file] ?? 0),
      `${file}: ${n} blocked-name occurrence(s), legacy allowance ${LEGACY[file] ?? 0}`,
    );
});
