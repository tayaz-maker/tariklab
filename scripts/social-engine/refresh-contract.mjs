// Preserve the original four-contract review; recalculate only the evidence for this candidate.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "artifacts/social-engine/",
  load = async (p) => JSON.parse(await readFile(root + p));
const prior = await load("contract-gap-history/schema5-source-review.json"),
  audit = structuredClone(prior);
const hash = (b) => createHash("sha256").update(b).digest("hex"),
  bytes = await readFile("public/games/social-engine/build-manifest.json"),
  manifest = JSON.parse(bytes);
const matrix = await load("results.json");
assert.equal(matrix.runtimeManifestSha256, hash(bytes));
const gates = matrix.required_evidence_status,
  unit = await load("acceptance-unit.json");
const ui = await load("ui-browser/results.json");
const uiCourse =
  JSON.stringify(ui.manifestAtStart) === JSON.stringify(manifest) &&
  JSON.stringify(ui.manifestAtEnd) === JSON.stringify(manifest)
    ? (ui.results.find((r) => r.name.includes("course cancellation"))?.status ?? "UNVERIFIED")
    : "UNVERIFIED";
const map = {
  "v4-browser/results.json": "integrated_lifecycle_mobility_social",
  "journal-browser/results.json": "journal_recovery",
  "asset-faults/results.json": "asset_fault_recovery",
  "renderer-lifecycle/results.json": "renderer_resource_teardown",
  "event-reachability/results.json": "twenty_event_branches",
  "capacity-10000/results.json": "synthetic_10000_citizens",
};
const aggregate = (checks) =>
  checks.includes("FAIL")
    ? "FAIL"
    : checks.length && checks.every((s) => s === "PASS")
      ? "PASS"
      : "UNVERIFIED";
audit.scope =
  "Current DARAMCIK build. Recalculated from the current isolated suite and named browser or simulation evidence; hardware, human and release gates stay separate.";
audit.generatedAt = new Date().toISOString();
audit.runtimeManifestSha256 = hash(bytes);
audit.sourceHashes = Object.fromEntries(
  await Promise.all(
    [
      ...new Set([
        ...Object.keys(prior.sourceHashes),
        "src/games/social-engine/simulation/property-crime.ts",
      ]),
    ].map(async (p) => [p, hash(await readFile(p))]),
  ),
);
for (const r of audit.requirements) {
  if (r.id === "C08") {
    r.classification = "Implemented integrity obligation";
    r.source_evidence = "simulation/property-crime.ts; UI shop and inventory; persistence fixtures";
    r.test_evidence =
      "property-crime.test.ts; property-browser-{chromium,firefox,webkit}/results.json";
    r.implemented_and_gap =
      "One existing stock unit is transferred without payment and linked to a real victim, item and incident. Only that unit can be returned once; a return does not erase evidence.";
    r.status = aggregate(
      [
        "stolen_stock_unit_invariants",
        ...["chromium", "firefox", "webkit"].map((b) => "stolen_stock_and_restitution_" + b),
      ].map((k) => gates[k]),
    );
  } else if (r.id === "C22" || r.id === "C24") {
    r.status = "UNVERIFIED";
    if (r.id === "C22")
      r.implemented_and_gap =
        "Earlier native zoom evidence is historical. Two human sessions are deferred, and reference hardware, low-end hardware and repeatable visibility on a dedicated host remain unverified. An unattended two-hour wall clock does not by itself satisfy the continuity requirement.";
    else r.implemented_and_gap =
      "The owner explicitly authorizes merge and the verified existing Cloudflare hook after all gates and release serialization. Draft PR #256 and a real local built route exist. No production traffic, live commit identity, deployment ID, or rollback trial is verified.";
  } else {
    const notes = r.test_evidence.split(";").map((s) => s.trim());
    const results = [gates.isolated_unit_sources];
    for (const name of notes) {
      if (name.endsWith(".test.ts"))
        results.push(
          unit.sourceFiles.some((f) => f.path.endsWith("/tests/" + name))
            ? gates.isolated_unit_sources
            : "UNVERIFIED",
        );
      else if (map[name]) results.push(gates[map[name]]);
      else if (name === "ui-browser/results.json") results.push(uiCourse);
      else if (name === "persistence-browser/results.json")
        results.push(matrix.results.find((x) => x.id === "SE-043")?.status);
      else if (!name.startsWith("ADR")) results.push("UNVERIFIED");
    }
    r.status = aggregate(results);
  }
  r.next_action =
    r.status === "PASS"
      ? "Retain evidence and rerun when its inputs change."
      : "Keep open; no waiver or inferred pass.";
}
audit.counts = Object.fromEntries(
  ["PASS", "FAIL", "SKIP", "UNVERIFIED"].map((k) => [
    k,
    audit.requirements.filter((r) => r.status === k).length,
  ]),
);
await writeFile(root + "contract-gap-audit.json", JSON.stringify(audit, null, 2) + "\n");
const notes = ["# Four-contract audit — SOCIAL ENGINE", "", audit.scope, ""];
for (const r of audit.requirements)
  notes.push(
    "## " + r.id + " — " + r.requirement,
    "",
    "**" + r.status + "** · " + r.contract,
    "",
    r.implemented_and_gap,
    "",
    "Code: " + r.source_evidence + ". Evidence: " + r.test_evidence + ".",
    "",
  );
await writeFile("docs/social-engine/CONTRACT_GAP_AUDIT.md", notes.join("\n"));
console.log(JSON.stringify(audit.counts));
