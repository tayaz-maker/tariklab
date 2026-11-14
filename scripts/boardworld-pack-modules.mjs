/** Build-time string sharing only; runtime exports and locale indices stay stable. */
import ts from "typescript";
import { build, transform } from "esbuild";
import { minify } from "terser";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

const literal = (n) =>
  ts.isStringLiteral(n) ||
  ts.isNoSubstitutionTemplateLiteral(n) ||
  ts.isTemplateHead(n) ||
  ts.isTemplateMiddle(n) ||
  ts.isTemplateTail(n);
const options = { loader: "js", minify: true, charset: "utf8", target: "es2022" };
function exportName(index) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_";
  let name = "";
  do {
    name = alphabet[index % alphabet.length] + name;
    index = Math.floor(index / alphabet.length) - 1;
  } while (index >= 0);
  return name;
}
async function compact(code) {
  return (
    await minify(code, {
      module: true,
      ecma: 2022,
      compress: { passes: 5 },
      mangle: true,
      format: { comments: false, ascii_only: false },
    })
  ).code;
}
async function shareDistantLiterals(text) {
  const ast = ts.createSourceFile(
    "expansion-bundle.mjs",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const groups = new Map();
  function visit(node) {
    const parent = node.parent;
    if (
      ts.isStringLiteral(node) &&
      node.text !== "__proto__" &&
      !ts.isImportDeclaration(parent) &&
      !ts.isExportDeclaration(parent) &&
      !ts.isExpressionStatement(parent) &&
      (parent.name !== node || ts.isPropertyAssignment(parent)) &&
      !(ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword)
    ) {
      if (!groups.has(node.text)) groups.set(node.text, []);
      groups.get(node.text).push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  // Nearby repetition is already cheap in gzip. Share only literals separated
  // beyond its sliding window, leaving module paths, directives and prototypes alone.
  const selected = [...groups].filter(
    ([value, nodes]) =>
      value.length >= 12 &&
      nodes.length > 1 &&
      nodes.at(-1).getStart() - nodes[0].getStart() > 32000,
  );
  if (!selected.length) return text;
  let prefix = "__bwLiteral";
  while (text.includes(prefix)) prefix += "_";
  const values = selected.map(([value]) => value).sort();
  const ids = new Map(values.map((value, index) => [value, `${prefix}${index}`]));
  let code = text;
  for (const node of selected
    .flatMap(([, nodes]) => nodes)
    .sort((a, b) => b.getStart() - a.getStart())) {
    const name = ids.get(node.text);
    const replacement = node.parent.name === node ? `[${name}]` : name;
    code = code.slice(0, node.getStart()) + replacement + code.slice(node.end);
  }
  const declarations = values
    .map((value) => `${ids.get(value)}=${JSON.stringify(value)}`)
    .join(",");
  const pooled = (
    await minify(`const ${declarations};${code}`, {
      module: true,
      ecma: 2022,
      compress: { passes: 2, reduce_vars: false },
      mangle: true,
      format: { comments: false, ascii_only: false },
    })
  ).code;
  return gzipSync(pooled).length < gzipSync(text).length ? pooled : text;
}

export async function packModules(packed, keys) {
  const parsed = new Map(),
    occurrences = new Map();
  for (const [file, text] of packed) {
    if (!file.endsWith(".mjs")) continue;
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = [],
      exports = [];
    function visit(n) {
      const p = n.parent;
      // Tagged templates expose raw spelling. Import paths, directives and keys
      // are syntax, not interchangeable value expressions.
      if (
        literal(n) &&
        n.text.length >= 12 &&
        !ts.isImportDeclaration(p) &&
        !ts.isExportDeclaration(p) &&
        p.name !== n &&
        !ts.isExpressionStatement(p) &&
        !ts.isTaggedTemplateExpression(p) &&
        !ts.isTaggedTemplateExpression(p.parent) &&
        !(ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.ImportKeyword)
      ) {
        nodes.push(n);
        if (!file.startsWith("expansion")) {
          if (!occurrences.has(n.text)) occurrences.set(n.text, new Set());
          occurrences.get(n.text).add(file);
        }
      }
      ts.forEachChild(n, visit);
    }
    visit(ast);
    for (const n of ast.statements) {
      if (ts.isExportDeclaration(n)) {
        if (!n.exportClause || !ts.isNamedExports(n.exportClause))
          throw Error(`Unsupported export in ${file}`);
        exports.push(...n.exportClause.elements.map((e) => e.name.text));
      } else if (n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        if (ts.isFunctionDeclaration(n)) exports.push(n.name.text);
        else if (ts.isVariableStatement(n)) {
          for (const d of n.declarationList.declarations) {
            if (!ts.isIdentifier(d.name)) throw Error(`Unsupported export pattern in ${file}`);
            exports.push(d.name.text);
          }
        }
      }
    }
    parsed.set(file, { text, nodes, exports: exports.sort() });
  }
  // A key also occurs inside HTML/template prose, not only as a whole literal.
  for (const key of keys.filter((k) => k.length >= 12)) {
    if (!occurrences.has(key)) occurrences.set(key, new Set());
    for (const [file, { nodes }] of parsed)
      if (!file.startsWith("expansion") && nodes.some((n) => n.text.includes(key)))
        occurrences.get(key).add(file);
  }
  // Locale keys occupy stable slots, allowing the deferred key module to reuse
  // their order directly. Unused keys stay deferred rather than enlarging Gold
  // startup; only their slots (null) exist in the shared runtime dictionary.
  const missingKeys = {};
  const keySlots = keys.map((key, index) => {
    if ([...(occurrences.get(key) ?? [])].some((file) => !file.startsWith("locale-"))) return key;
    missingKeys[index] = key;
    return null;
  });
  const strings = [
    ...keySlots,
    ...[...occurrences]
      .filter(([value, files]) => files.size >= 2 && !keys.includes(value))
      .map(([value]) => value)
      .sort(),
  ];
  const ids = new Map(strings.map((value, i) => [value, i]).filter(([value]) => value !== null));
  const regex = new RegExp(
    strings
      .filter((value) => value !== null)
      .sort((a, b) => b.length - a.length)
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|"),
    "g",
  );
  for (const [file, { text, nodes }] of parsed) {
    let result = text,
      used = false;
    for (const n of [...nodes].reverse()) {
      let replacement;
      if (ids.has(n.text)) replacement = `__bwS[${ids.get(n.text)}]`;
      else {
        let pos = 0;
        const parts = [],
          roundTrip = [];
        for (const match of n.text.matchAll(regex)) {
          if (!ids.has(match[0])) throw Error("Nonliteral dictionary match");
          if (match.index > pos) {
            parts.push(JSON.stringify(n.text.slice(pos, match.index)));
            roundTrip.push(n.text.slice(pos, match.index));
          }
          parts.push(`__bwS[${ids.get(match[0])}]`);
          roundTrip.push(strings[ids.get(match[0])]);
          pos = match.index + match[0].length;
        }
        if (!pos) continue;
        if (pos < n.text.length) {
          parts.push(JSON.stringify(n.text.slice(pos)));
          roundTrip.push(n.text.slice(pos));
        }
        if (roundTrip.join("") !== n.text) throw Error("String sharing changed content");
        replacement = parts.join("+");
        if (replacement.length >= JSON.stringify(n.text).length) continue;
      }
      let code = `(${replacement})`;
      if (ts.isTemplateHead(n)) code = "`${" + replacement + "}${";
      if (ts.isTemplateMiddle(n)) code = "}${" + replacement + "}${";
      if (ts.isTemplateTail(n)) code = "}${" + replacement + "}`";
      result = result.slice(0, n.getStart()) + code + result.slice(n.end);
      used = true;
    }
    if (used) result = "import {s as __bwS} from './shared-strings.mjs';\n" + result;
    packed.set(file, (await transform(result, options)).code);
  }
  packed.set("shared-strings.mjs", `export const s=${JSON.stringify(strings)};`);
  // The UI is started only by app.mjs. Importing an engine/locale URL must not
  // start a second UI in an already-open older tab or require a DOM in Node.
  const appAst = ts.createSourceFile(
    "app.mjs",
    packed.get("app.mjs"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const imports = appAst.statements
    .filter(ts.isImportDeclaration)
    .map((n) => n.getText())
    .join("\n");
  const body = appAst.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText())
    .join("\n");
  packed.set("app.mjs", `${imports}\nexport async function startBoardworld(){${body}}`);
  const exports = new Map(
    [...parsed]
      .filter(([f]) => f !== "app.mjs" && !f.startsWith("locale-") && !f.startsWith("expansion"))
      .map(([file, data]) => [file, data.exports]),
  );
  exports.set("shared-strings.mjs", ["s"]);
  exports.set("app.mjs", ["startBoardworld"]);
  let index = 0,
    entry = "";
  const forwards = new Map();
  for (const [file, names] of exports) {
    const pairs = names.map((name) => [name, exportName(index++)]);
    entry += `export {${pairs.map(([name, alias]) => `${name} as ${alias}`).join(",")}} from './${file}';\n`;
    forwards.set(file, pairs);
  }
  const bundle = await build({
    stdin: { contents: entry, sourcefile: "entry.mjs" },
    write: false,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    charset: "utf8",
    legalComments: "none",
    plugins: [
      {
        name: "boardworld-memory",
        setup(b) {
          b.onResolve({ filter: /^\.\// }, (args) => {
            if (args.path.startsWith("./locale-") || args.path.startsWith("./expansion"))
              return { path: args.path, external: true };
            return { path: args.path.slice(2), namespace: "boardworld" };
          });
          b.onLoad({ filter: /.*/, namespace: "boardworld" }, (args) => {
            if (!packed.has(args.path)) throw Error(`Missing module: ${args.path}`);
            return { contents: packed.get(args.path), loader: "js" };
          });
        },
      },
    ],
  });
  const code = await compact(bundle.outputFiles[0].text);
  const name = `bw-runtime-${createHash("sha256").update(code).digest("hex").slice(0, 16)}.mjs`;
  for (const [file, pairs] of forwards)
    packed.set(
      file,
      `export {${pairs.map(([original, alias]) => `${alias} as ${original}`).join(",")}} from './${name}';`,
    );
  packed.set(
    "app.mjs",
    `import{${forwards.get("app.mjs")[0][1]} as start}from'./${name}';await start();`,
  );
  // Never put an unstable dictionary index behind an unhashed import URL.
  const dictionaryExport = forwards.get("shared-strings.mjs")[0][1];
  for (const file of ["locale-keys.mjs", "locale-en.mjs", "locale-pl.mjs"]) {
    let text = packed.get(file);
    text = text.replace(
      /import\{s as ([\w$]+)\}from["']\.\/shared-strings\.mjs["'];?/g,
      (_, local) => `import{${dictionaryExport} as ${local}}from'./${name}';`,
    );
    packed.set(file, await compact(text));
  }
  // Restore deferred keys into their stable null slots without carrying a
  // second index table. Old cached catalogs retain exactly the same ordering.
  const missing = Object.values(missingKeys);
  const missingCode = missing.every((key) => !key.includes("|"))
    ? `${JSON.stringify(missing.join("|"))}.split("|")`
    : JSON.stringify(missing);
  packed.set(
    "locale-keys.mjs",
    await compact(
      `import{${dictionaryExport} as s}from'./${name}';const missing=${missingCode};let i=0;export default s.slice(0,${keys.length}).map(value=>value??missing[i++]);`,
    ),
  );
  // Preview and persistence stay independent: visiting the opt-in explanation
  // must not download simulation. The six activated modules share one deferred
  // content-hashed bundle and the exact same Gold engine instance. Stable public
  // module URLs remain forwarders, just as for Gold.
  for (const file of packed.keys()) {
    if (!file.startsWith("expansion") || !file.endsWith(".mjs")) continue;
    packed.set(
      file,
      packed
        .get(file)
        .replace(
          /import\{s as ([\w$]+)\}from["']\.\/shared-strings\.mjs["'];?/g,
          (_, local) => `import{${dictionaryExport} as ${local}}from'./${name}';`,
        ),
    );
  }
  const deferred = [...parsed].filter(
    ([file]) =>
      file.startsWith("expansion") &&
      !["expansion-preview.mjs", "expansion-persistence.mjs"].includes(file),
  );
  const deferredForwards = new Map();
  let deferredEntry = "",
    deferredIndex = 0;
  for (const [file, data] of deferred) {
    const pairs = data.exports.map((original) => [original, exportName(deferredIndex++)]);
    deferredForwards.set(file, pairs);
    deferredEntry += `export {${pairs.map(([original, alias]) => `${original} as ${alias}`).join(",")}} from './${file}';\n`;
  }
  const deferredBundle = await build({
    stdin: { contents: deferredEntry, sourcefile: "expansion-entry.mjs" },
    write: false,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    charset: "utf8",
    legalComments: "none",
    plugins: [
      {
        name: "boardworld-deferred",
        setup(b) {
          b.onResolve({ filter: /^\.\// }, (args) =>
            deferredForwards.has(args.path.slice(2))
              ? { path: args.path.slice(2), namespace: "expansion" }
              : { path: args.path, external: true },
          );
          b.onLoad({ filter: /.*/, namespace: "expansion" }, (args) => ({
            contents: packed.get(args.path),
            loader: "js",
          }));
        },
      },
    ],
  });
  const deferredCode = await shareDistantLiterals(
    await compact(deferredBundle.outputFiles[0].text),
  );
  const deferredName = `expansion-runtime-${createHash("sha256").update(deferredCode).digest("hex").slice(0, 16)}.mjs`;
  for (const [file, pairs] of deferredForwards)
    packed.set(
      file,
      `export {${pairs.map(([original, alias]) => `${alias} as ${original}`).join(",")}} from './${deferredName}';`,
    );
  packed.set(deferredName, deferredCode);
  packed.delete("shared-strings.mjs");
  packed.set(name, code);
  return { strings: strings.length, runtime: name, expansionRuntime: deferredName };
}
