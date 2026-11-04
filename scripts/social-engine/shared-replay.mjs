// The save replayer imports a frozen engine next to the current one. Emit a shared
// initializer for audited modules only. Each ESM wrapper still imports its own
// dependencies and constructs its own maps, sets, functions and content objects.
import { transform } from "esbuild";
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";

const prefix = "candidate5-initializer:";
const audited = [
  "economy",
  "events",
  "family",
  "justice",
  "ledger",
  "life",
  "missions",
  "mobility",
  "progression",
  "property-crime",
  "random",
  "services",
  "social",
].map((name) => ["simulation/" + name + ".ts", []]);
// Each variant supplies its own version identifiers and named building definitions.
// These initializers are self-contained literals at the start of their modules.
audited.push(["domain/content.ts", ["ENGINE_VERSION", "SCHEMA_VERSION", "RULES_VERSION"]]);
audited.push(["domain/world.ts", ["BUILDINGS"]]);
// Pedestrian movement changed. Keep each version's schedule and movement functions
// in its module and share only the byte-identical daily economy and society tick.
audited.push(["simulation/society.ts", ["routineTarget", "npcMovement"]]);

async function parseModule(bytes, name) {
  const { code } = await transform(bytes, {
    loader: "ts",
    format: "esm",
    target: "es2022",
    charset: "utf8",
    legalComments: "none",
  });
  return ts.createSourceFile(name, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
}

function prepare(file, name, separate) {
  const outer = [],
    body = [],
    inputNames = [],
    locals = [],
    exports = [];
  const referenced = new Set();
  function recordIdentifiers(node) {
    if (ts.isIdentifier(node)) referenced.add(node.text);
    ts.forEachChild(node, recordIdentifiers);
  }
  for (const statement of file.statements) {
    const text = statement.getText(file);
    if (ts.isImportDeclaration(statement)) {
      outer.push(text);
      for (const spec of statement.importClause.namedBindings.elements)
        inputNames.push(spec.name.text);
    } else if (ts.isExportDeclaration(statement)) {
      for (const spec of statement.exportClause.elements) {
        exports.push(spec.name.text);
        locals.push((spec.propertyName ?? spec.name).text);
      }
    } else if (ts.isFunctionDeclaration(statement) && separate.includes(statement.name.text)) {
      outer.push(text);
      inputNames.push(statement.name.text);
    } else if (
      ts.isVariableStatement(statement) &&
      separate.includes(statement.declarationList.declarations[0].name.text)
    ) {
      outer.push(text);
      inputNames.push(statement.declarationList.declarations[0].name.text);
    } else {
      body.push(text);
      recordIdentifiers(statement);
    }
  }
  const inputs = inputNames.filter((name) => referenced.has(name) || locals.includes(name)).sort();
  const factory = `export default function(${inputs.join(",")}) {\n${body.join("\n")}\nreturn [${locals.join(",")}];\n}`;
  const outputs = exports.map((name) => "$" + name);
  const symbols = exports.map((name, index) => outputs[index] + " as " + name);
  const wrapper = [
    ...outer,
    `import instantiate from "${prefix}${name}";`,
    `const [${outputs.join(",")}] = instantiate(${inputs.join(",")});`,
    `export {${symbols.join(",")}};`,
  ].join("\n");
  return { factory, wrapper };
}

// This closed DAG only imports const/function bindings, and all caches are module-local.
// A changed dependency could introduce a live mutable binding or an import cycle. Fall
// back to normal ESM compilation until its graph and initializers are reviewed again.
const reviewedCurrent = {
  "domain/content.ts": "5ffab8f181ae99c913ad3194e56c71e19808b613cd52ca96d43c92772070146d",
  "domain/world.ts": "b1d511bf85ddd3704ef64f1b2b9487d8d690d37c4d146fe978500cb298d8b9c3",
  "simulation/population.ts": "352396a9b6ae8ea5e01516c98b897b6e48106917c8030e831f21bb42d455d7d9",
  "domain/traffic.ts": "4b87ed33914aa1b324a0a0ff4f4cc81d95f39719af99fe6f9e54fb7e036fdbf7",
  "simulation/society.ts": "d12ea3e4745146648491a2fc8fe5a7d5abe942b783b46de9ef869f607568bb0e",
  "simulation/mobility.ts": "1497d7b8bbe0dc6629df5c370295991e595f4776cf813202d5ea2f46b2f2538b",
  "simulation/npc-traits.ts": "fb29a8e343f8e0d5d46c60e6290d346d54a1e84ecf72f7d2626e54a23d92ce80",
  "simulation/pedestrian-navigation.ts":
    "240d56bbcf68e11b3ea8b7048f4e5efe4c99c244ac0ec89ec6e89f06bf0e0ad9",
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function sharedReplay(root) {
  const base = resolve(root, "src/games/social-engine");
  const old = join(base, "persistence/historical/candidate5");
  const factories = new Map(),
    wrappers = new Map();
  return {
    name: "share-frozen-replay-bodies",
    async buildStart() {
      const manifest = await readFile(join(old, "provenance.json"));
      if (hash(manifest) !== "35078dc1e6d5097fa7345be13961a3a83088d0e2b8cb178a0a5b5ca10cd9b520")
        throw Error("Unexpected candidate 5 provenance manifest");
      const { files } = JSON.parse(manifest);
      for (const [name, digest] of Object.entries(files)) {
        if (hash(await readFile(join(old, name))) !== digest)
          throw Error("Frozen candidate 5 source mismatch: " + name);
      }
      const currentGraph = {
        ...Object.fromEntries(audited.map(([name]) => [name, files[name]])),
        ...reviewedCurrent,
      };
      const modules = new Map();
      async function reviewedModule(name) {
        if (modules.has(name)) return modules.get(name);
        if (!currentGraph[name]) return null;
        const bytes = await readFile(join(base, name));
        if (hash(bytes) !== currentGraph[name]) return null;
        const file = await parseModule(bytes, name);
        // Mark in progress first. A cycle must retain native ESM initialization.
        modules.set(name, null);
        for (const statement of file.statements) {
          if (!statement.moduleSpecifier) continue;
          const path = relative(base, resolve(base, dirname(name), statement.moduleSpecifier.text));
          if (!(await reviewedModule(path))) return null;
        }
        modules.set(name, file);
        return file;
      }
      for (const [name, separate] of audited) {
        const current = await reviewedModule(name);
        if (!current) {
          this.warn("Independently compiling replay after dependency change: " + name);
          continue;
        }
        const historicalPath = join(old, name);
        let frozen = await readFile(historicalPath, "utf8");
        if (name === "simulation/mobility.ts") {
          // Local import alias only. The old wrapper still supplies pointOnLane
          // from its own world module, while the new one supplies trafficPose.
          frozen = frozen
            .replace(
              "hasLineOfSight, pointOnLane }",
              "hasLineOfSight, pointOnLane as trafficPose }",
            )
            .replaceAll("pointOnLane(", "trafficPose(");
        }
        const before = prepare(await parseModule(frozen, name), name, separate);
        const after = prepare(current, name, separate);
        if (before.factory !== after.factory) throw Error("Audited initializer differs: " + name);
        factories.set(name, before.factory);
        wrappers.set(historicalPath, before.wrapper);
        wrappers.set(join(base, name), after.wrapper);
      }
    },
    resolveId(id) {
      if (id.startsWith(prefix)) return "\0" + id;
    },
    load(id) {
      if (id.startsWith("\0" + prefix)) return factories.get(id.slice(1 + prefix.length));
    },
    transform(_code, id) {
      return wrappers.get(id);
    },
  };
}
