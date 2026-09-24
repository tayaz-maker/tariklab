// Collects the English text every TarikLab game can show, so it can be given a
// Polish translation. Reads exactly the files each game page loads
// (scripts/pl/games.json), parses JS with acorn and walks JSON, and keeps
// string literals that read as English prose or labels. Template literals
// become patterns: `Draw ${n} cards` -> "Draw {0} cards".
// Output: scripts/pl/source/en-strings.json  [{ id, en, pattern, games }]
// Usage: node scripts/pl/extract-en.mjs
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "acorn";

const ROOT = new URL("../../", import.meta.url);
const games = JSON.parse(readFileSync(new URL("scripts/pl/games.json", ROOT), "utf8"));

export const idOf = (en) => createHash("sha1").update(en).digest("hex").slice(0, 12);
const TURKISH = /[çğıöşüÇĞİÖŞÜâîû]/;
const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const COMMON =
  /\b(the|and|you|your|of|to|is|are|with|for|this|that|on|in|from|an?|it|be|not|no|when|each|if|or|by|at|as|has|have|will|can|was|all|more|less|than|one|two|three|until|after|before|then|their|them|its|who|what|how|why|may|must|only|any|both|into|out|up|down|per|lose|gain|draw|pay|add)\b/i;

// Optional word list (one lowercase word per line) that separates English
// from Turkish written without Turkish letters, e.g. "Kervan kapasitesi".
// EN_WORDS=/path/to/words.txt node scripts/pl/extract-en.mjs
const WORDS = process.env.EN_WORDS
  ? new Set(readFileSync(process.env.EN_WORDS, "utf8").split("\n"))
  : null;
const TR_WORDS =
  /\b(ve|bir|bu|ile|icin|yok|var|olarak|daha|gibi|kadar|sonra|once|degil|mi|mu|ama|veya|her|hic|cok|az|en|olan|oldu|olur|artar|azalir|kazan|kaybet|yeni|eski|kart|karti|sira|tur|oyun|oyna|sehir|koy|ev|is|para|gun|hafta|yil|ay)\b/i;
function englishWord(w) {
  if (WORDS.has(w)) return true;
  for (const [suffix, repl] of [
    ["'s", ""],
    ["ies", "y"],
    ["es", ""],
    ["s", ""],
    ["ed", ""],
    ["ed", "e"],
    ["ing", ""],
    ["ing", "e"],
    ["ly", ""],
    ["er", ""],
    ["ers", ""],
    ["est", ""],
    ["ied", "y"],
  ])
    if (w.endsWith(suffix) && WORDS.has(w.slice(0, -suffix.length) + repl)) return true;
  return false;
}
function mostlyEnglish(s) {
  if (!WORDS) return true;
  const words = (s.toLowerCase().match(/[a-z']+/g) || []).filter((w) => w.length >= 3);
  if (!words.length) return !TR_WORDS.test(s);
  const hits = words.filter(englishWord).length;
  return hits / words.length >= 0.7 && !(TR_WORDS.test(s) && hits / words.length < 0.9);
}

function englishLike(raw) {
  const s = raw.replace(/\{\d+\}/g, "").trim();
  if (s.length < 2 || s.length > 1200) return false;
  if (TURKISH.test(raw) || POLISH.test(raw)) return false;
  if (!/[A-Za-z]{2}/.test(s)) return false;
  // code, markup, css, urls, paths, keys
  if (
    /[{}=<>\\]|=>|\bfunction\b|\breturn\b|^\s*[#.@]|https?:|\.(js|json|css|svg|png|webp|jpg)\b/.test(
      s,
    )
  )
    return false;
  if (/^[a-z0-9]+([_.:/-][a-z0-9]+)+$/i.test(s)) return false; // keys, ids, paths
  if (/^[a-z-]+\s*:[^;]*;/.test(s) || /;\s*$/.test(s)) return false; // css declarations
  if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(s)) return false; // camelCase
  if (/^[a-z0-9_-]+$/.test(s)) return false; // lowercase single token (keys, css)
  if (/^[A-Z0-9_]+$/.test(s) && s.length > 1 && !/^[A-Z]{2,}[A-Z ]*$/.test(s)) return false;
  if (/^\s*[\d\s.,:%+\-–—×x/()]+\s*$/.test(s)) return false;
  if (/\b(px|rem|vh|vw|rgba?|hsla?|var)\(|\d+px\b|!important/.test(s)) return false;
  if (/^(Arial|Georgia|Helvetica|Inter|system-ui|monospace|serif|sans-serif)/.test(s)) return false;
  if (!mostlyEnglish(s)) return false;
  const words = s.split(/\s+/);
  if (words.length >= 3) return COMMON.test(s) || /^[A-Z][a-z]/.test(s);
  // one or two words: labels like "Ballot Officer", "Normal", "Next"
  return /^[A-Z][A-Za-z'’&-]*( [A-Za-z][A-Za-z'’&-]*)?[.!?:]?$/.test(s) || COMMON.test(s);
}

function collectJs(src, out) {
  let ast;
  try {
    ast = parse(src, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true });
  } catch {
    try {
      ast = parse(src, { ecmaVersion: "latest", sourceType: "script" });
    } catch {
      return;
    }
  }
  const walk = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "Literal" && typeof node.value === "string") out.push(node.value);
    else if (node.type === "TemplateLiteral") {
      let pattern = "";
      node.quasis.forEach((q, i) => {
        pattern += q.value.cooked ?? q.value.raw;
        if (i < node.expressions.length) pattern += `{${i}}`;
      });
      out.push(pattern);
    }
    // skip import/export sources and property keys
    for (const [k, v] of Object.entries(node)) {
      if (k === "source" && (node.type === "ImportDeclaration" || node.type.startsWith("Export")))
        continue;
      if (k === "key" && node.type === "Property" && !node.computed) continue;
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(ast);
}

function collectJson(value, out) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectJson(v, out));
  else if (value && typeof value === "object")
    Object.values(value).forEach((v) => collectJson(v, out));
}

const byEn = new Map();
const cache = new Map();
for (const [slug, files] of Object.entries(games)) {
  for (const file of files) {
    if (!cache.has(file)) {
      const src = readFileSync(new URL(`public${file}`, ROOT), "utf8");
      const raw = [];
      if (file.endsWith(".json")) collectJson(JSON.parse(src), raw);
      else collectJs(src, raw);
      cache.set(file, raw);
    }
    for (const str of cache.get(file)) {
      const en = str.replace(/\s+/g, " ").trim();
      if (!englishLike(en)) continue;
      const row = byEn.get(en) || {
        id: idOf(en),
        en,
        pattern: /\{\d+\}/.test(en),
        games: [],
        order: byEn.size,
      };
      if (!row.games.includes(slug)) row.games.push(slug);
      byEn.set(en, row);
    }
  }
}
const rows = [...byEn.values()]
  .sort((a, b) => a.order - b.order)
  .map(({ order: _order, ...r }) => r);
mkdirSync(new URL("scripts/pl/source/", ROOT), { recursive: true });
writeFileSync(
  new URL("scripts/pl/source/en-strings.json", ROOT),
  JSON.stringify(rows, null, 1) + "\n",
);
const words = rows.reduce((n, r) => n + r.en.split(/\s+/).length, 0);
console.log(
  `${rows.length} English strings (${rows.filter((r) => r.pattern).length} patterns), ${words} words`,
);
