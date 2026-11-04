// Build-time specialization of immutable ESM simulation modules. Every generation
// instantiates its own module state and receives bindings from its original imports.
import { transform } from "esbuild";
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";

const prefix = "rules-initializer:";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const generations = [
  ["candidate5", "35078dc1e6d5097fa7345be13961a3a83088d0e2b8cb178a0a5b5ca10cd9b520"],
  ["candidate6", "3d31faaa66e3e43a05257d6d24ed3b9a6bf40036bb74fdc644e30bd94fc5444a"],
];
// The active DAG uses candidate 6 hashes except for these reviewed sources.
// Changing a runtime dependency opts its consumers out of sharing until reviewed.
const activeChanges = {
  "simulation/traffic.ts": "13f54116c00908989652b7356c487c1e602ed27da620c3a4ac683a1da4f38b70",
  "domain/traffic.ts": "0deab9cd0b65045b4244fd990229c8c5e6424f79bcba86857ebc223d39b56585",
  "domain/content.ts": "3defcd895ea8358661926d002ad7dd29b5dc40ed54dfa66b36eb165cb2943ab9",
  "simulation/engine.ts": "e872cd83f8fd5ef992bc7bce1511c36d1af738a09515f791781bcb03712d2f52",
  "simulation/ledger.ts": "1c452c4b3b03cdce566fc189c798e04efa3b0ca5497cb97d40689be1e8e711e0",
  "simulation/meal-membership.ts":
    "3381b57b0385727e7c434c43dc11154387e7982adc730a4a3b30a28ce91979eb",
  "simulation/pedestrian-navigation.ts":
    "7751da2bd9233bffe520e38a6c2d3d4f88bf91027f3c51af2a65a1c58aa51ab4",
  "simulation/society.ts": "0319cda2d390394701b3088138c62789cd21ac5b86259d3e8c64ac07c0b00081",
};
async function readRules(dir, expected) {
  const manifest = await readFile(join(dir, "provenance.json"));
  if (hash(manifest) !== expected) throw Error("Unexpected frozen manifest at " + dir);
  const { files } = JSON.parse(manifest);
  for (const [name, digest] of Object.entries(files)) {
    if (hash(await readFile(join(dir, name))) !== digest)
      throw Error("Frozen source mismatch: " + name);
  }
  return files;
}
async function parseModule(input, name) {
  const { code } = await transform(input, {
    loader: "ts",
    format: "esm",
    target: "es2022",
    charset: "utf8",
    legalComments: "none",
  });
  const file = ts.createSourceFile(name, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const outer = [],
    bindings = [],
    functions = new Map(),
    rest = [],
    exports = [],
    dependencies = [];
  for (const statement of file.statements) {
    const text = statement.getText(file);
    if (ts.isImportDeclaration(statement)) {
      outer.push(text);
      dependencies.push(statement.moduleSpecifier.text);
      for (const s of statement.importClause.namedBindings.elements) bindings.push(s.name.text);
    } else if (ts.isExportDeclaration(statement)) {
      for (const s of statement.exportClause.elements)
        exports.push([(s.propertyName ?? s.name).text, s.name.text]);
    } else if (ts.isFunctionDeclaration(statement)) {
      functions.set(statement.name.text, text);
    } else if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.length === 1 &&
      ((name === "domain/content.ts" &&
        ["ENGINE_VERSION", "SCHEMA_VERSION", "RULES_VERSION"].includes(
          statement.declarationList.declarations[0].name.text,
        )) ||
        (name === "domain/world.ts" &&
          statement.declarationList.declarations[0].name.text === "BUILDINGS"))
    ) {
      const key = statement.declarationList.declarations[0].name.text;
      outer.push(text);
      bindings.push(key);
    } else {
      rest.push(text);
    }
  }
  return { outer, bindings, functions, rest, exports, dependencies };
}
// Each group already has identical top-level data/initialization statements and
// exports. Hoist declarations as in ordinary ESM. The few differing functions
// are chosen once, when a ruleset instantiates the module, before any data is
// initialized. Arguments and stateful objects still belong to that ruleset.
function compileFamily(parts, id) {
  const params = [...new Set(parts.flatMap((v) => v.bindings))].sort();
  const funcNames = [...new Set(parts.flatMap((v) => [...v.functions.keys()]))];
  if (funcNames.some((k) => params.includes(k))) return null;
  const body = [];
  for (const name of funcNames) {
    const choices = parts.map((part) => part.functions.get(name) ?? "undefined");
    if (choices.every((code) => code === choices[0])) body.push(choices[0]);
    else {
      const groups = new Map();
      choices.forEach((code, index) => groups.set(code, [...(groups.get(code) ?? []), index]));
      const cases = [...groups].map(([code, indices], index) =>
        index === groups.size - 1
          ? code
          : indices.map((i) => "$generation===" + i).join(" || ") + " ? " + code + " : ",
      );
      body.push("const " + name + " = " + cases.join("") + ";");
    }
  }
  body.push(...parts[0].rest);
  const bindings = parts[0].exports.map(([local]) => local);
  const init = `export default function($generation,${params}) {\n${body.join("\n")}\nreturn [${bindings}];\n}`;
  return {
    init,
    wrappers: parts.map((part, index) => {
      const args = params.map((name) => (part.bindings.includes(name) ? name : "undefined"));
      const names = part.exports.map(([, name]) => "$" + name);
      return [
        ...part.outer,
        `import instantiate from "${id}";`,
        `const [${names}]=instantiate(${index},${args});`,
        `export {${part.exports.map(([, name], i) => names[i] + " as " + name)}};`,
      ].join("\n");
    }),
  };
}

export function sharedReplay(root) {
  const base = join(root, "src/games/social-engine");
  const inits = new Map(),
    wrappers = new Map();
  return {
    name: "share-frozen-replay-bodies",
    async buildStart() {
      const variants = [];
      for (const [generation, sha] of generations) {
        const dir = join(base, "persistence/historical", generation);
        variants.push({ dir, expected: await readRules(dir, sha) });
      }
      variants.push({ dir: base, expected: { ...variants.at(-1).expected, ...activeChanges } });
      const candidates = new Map();
      for (const { dir, expected } of variants) {
        const known = new Map();
        async function checked(name) {
          if (known.has(name)) return known.get(name);
          if (!expected[name]) return null;
          const bytes = await readFile(join(dir, name)).catch((error) => {
            if (dir === base && error.code === "ENOENT") return null;
            throw error;
          });
          if (!bytes) return null;
          if (hash(bytes) !== expected[name]) return null;
          const part = await parseModule(bytes, name);
          known.set(name, null); // A cyclic graph retains native ESM initialization.
          for (const path of part.dependencies) {
            if (!(await checked(relative(dir, resolve(dir, dirname(name), path))))) return null;
          }
          known.set(name, part);
          return part;
        }
        for (const name of Object.keys(expected).filter(
          (n) =>
            n.startsWith("simulation/") ||
            ["domain/content.ts", "domain/world.ts", "domain/traffic.ts"].includes(n),
        )) {
          const part = await checked(name);
          if (!part) {
            this.warn("Using independent ESM for unreviewed replay dependency of " + name);
            continue;
          }
          const key = JSON.stringify([name, part.rest, part.exports]);
          const group = candidates.get(key) ?? [];
          group.push({ path: join(dir, name), part });
          candidates.set(key, group);
        }
      }
      for (const [key, group] of candidates) {
        if (group.length < 2) continue;
        const id = prefix + hash(key).slice(0, 20);
        const family = compileFamily(
          group.map((v) => v.part),
          id,
        );
        if (!family) continue;
        inits.set(id, family.init);
        group.forEach((v, i) => wrappers.set(v.path, family.wrappers[i]));
      }
    },
    resolveId(id) {
      if (id.startsWith(prefix)) return "\0" + id;
    },
    load(id) {
      if (id.startsWith("\0" + prefix)) return inits.get(id.slice(1));
    },
    transform(_code, id) {
      return wrappers.get(id);
    },
  };
}
