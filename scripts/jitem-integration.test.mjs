import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("JITEM ships from the reviewed standalone canonical build", () => {
  const source = JSON.parse(read("public/games/jitem-derin-ag/SOURCE.json"));
  assert.equal(source.standaloneSha, "0f01e80aa2a94f145a49f509598e26d74a06640e");
  assert.equal(source.saveKey, "jitem-derin-ag-v3");
  assert.equal(source.schemaVersion, 5);
  const assets = readdirSync(new URL("../public/games/jitem-derin-ag/assets/", import.meta.url));
  const js = assets.filter((name) => name.endsWith(".js")).map((name) => read(`public/games/jitem-derin-ag/assets/${name}`)).join("\n");
  assert.match(js, /jitem-derin-ag-v3/);
  assert.match(js, /schemaVersion/);
  assert.match(js, /derin-ag-locale/);
  assert.match(js, /EXPERIMENTAL LINE/);
  assert.match(js, /GAMEPLAY RECONSTRUCTION/);
  assert.match(js, /log\.open\.saha/);
  assert.match(js, /family\.variant/);
  for (const semanticId of [
    "fam_source_clash",
    "fam_chain_consequence",
    "clm_aygan_dogan_split",
    "clm_kutlu_vs_official",
    "clm_hanefi_emniyet_split",
  ]) assert.match(js, new RegExp(semanticId), semanticId);
  assert.match(js, /delil_zincir/);
  assert.match(js, /kismi_adalet/);
  assert.doesNotMatch(js, /["'`]\/images\/office\.jpg/);
});

test("TarikLab shell owns navigation and locale for embedded JITEM", () => {
  const route = read("src/routes/oyna.$slug.tsx");
  assert.match(route, /embed=1&lang=/);
  assert.match(route, /derin-ag-locale/);
  assert.match(route, /contentWindow\?\.postMessage/);
  const catalog = read("src/lib/games.ts");
  assert.match(catalog, /"jitem-derin-ag"/);
  assert.match(catalog, /href: "\/oyna\/jitem-derin-ag"/);
});
