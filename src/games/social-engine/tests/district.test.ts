import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { districtText } from "../ui/district.ts";
import { BUILDINGS } from "../domain/world.ts";
test("historical narrative is translated for display without changing the saved record or its IDs", () => {
  const saved = {
    scene: "b-clinic",
    text: "Kıyıyaka’dan Kıyıyaka Kliniği’ne. KIYIYAKA'ya hoş geldin.",
  };
  const before = JSON.stringify(saved);
  assert.equal(
    districtText(saved.text),
    "DARAMCIK’tan DARAMCIK Kliniği’ne. DARAMCIK’a hoş geldin.",
  );
  assert.equal(districtText("Kıyıyaka’da bir gün"), "DARAMCIK’ta bir gün");
  assert.equal(JSON.stringify(saved), before);
  assert.equal(BUILDINGS.find((b) => b.id === saved.scene)?.name, "DARAMCIK Kliniği");
});
test("playable map, shell, outer route and catalogue identify the same game and district", () => {
  const file = (path: string) => readFileSync(path, "utf8");
  const shell = file("src/games/social-engine/ui/index.html"),
    route = file("src/routes/oyna.social-engine.tsx");
  assert.match(shell, /<title>SOCIAL ENGINE<\/title>/);
  assert.match(route, /title: "SOCIAL ENGINE"/);
  assert.equal(
    JSON.parse(file("public/games/social-engine/assets/kiyiyaka-map.json")).name,
    "DARAMCIK",
  );
  for (const source of [shell, route, file("src/games/social-engine/ui/app.ts")])
    assert.doesNotMatch(source, /k[ıi]y[ıi]yaka/iu);
  assert.match(
    file("src/lib/games.ts"),
    /slug: "social-engine",\s*title: "SOCIAL ENGINE",\s*subtitle: "DARAMCIK/,
  );
});
