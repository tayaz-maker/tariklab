/** Build-time string sharing only; runtime exports and locale indices stay stable. */
import ts from "typescript";
import { build, transform } from "esbuild";
import { minify } from "terser";
import { createHash } from "node:crypto";

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
        if (!occurrences.has(n.text)) occurrences.set(n.text, new Set());
        occurrences.get(n.text).add(file);
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
      if (nodes.some((n) => n.text.includes(key))) occurrences.get(key).add(file);
  }
  const strings = [...occurrences]
    .filter(([, files]) => files.size >= 2)
    .map(([s]) => s)
    .sort();
  const ids = new Map(strings.map((s, i) => [s, i]));
  const regex = new RegExp(
    [...strings]
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
  const appAst = ts.createSourceFile("app.mjs", packed.get("app.mjs"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const imports = appAst.statements.filter(ts.isImportDeclaration).map(n => n.getText()).join("\n");
  const body = appAst.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText()).join("\n");
  packed.set("app.mjs", `${imports}\nexport async function startBoardworld(){${body}}`);
  const exports = new Map(
    [...parsed]
      .filter(([f]) => f !== "app.mjs" && !f.startsWith("locale-"))
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
            if (args.path.startsWith("./locale-")) return { path: args.path, external: true };
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
  packed.set("app.mjs", `import{${forwards.get("app.mjs")[0][1]} as start}from'./${name}';await start();`);
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
  packed.delete("shared-strings.mjs");
  packed.set(name, code);
  return { strings: strings.length, runtime: name };
}
