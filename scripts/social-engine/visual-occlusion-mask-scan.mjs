// Synthetic regression against the 12 real-atlas positions that the previous
// 5x8 sampling grid missed. This does not claim to be gameplay evidence.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { BUILDINGS, project } from "../../src/games/social-engine/domain/world.ts";
import { alphaMask, masksOverlap } from "../../src/games/social-engine/rendering/occlusion.ts";
const base = process.env.SE_BASE || "http://127.0.0.1:18430";
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
try {
  const page = await browser.newPage();
  const response = await page.request.get(`${base}/games/social-engine/build-manifest.json`);
  assert.equal(response.status(), 200);
  const manifest = await response.body();
  const manifestSha256 = createHash("sha256").update(manifest).digest("hex");
  await page.goto(`${base}/games/social-engine/index.html`);
  const extracted = await page.evaluate(async () => {
    const manifest = await (await fetch("/games/social-engine/build-manifest.json")).json();
    const atlasPath = manifest.playableAssets.find((asset) => asset.file.endsWith(".json")).file;
    const atlas = await (await fetch(`/games/social-engine/${atlasPath}`)).json();
    const building = atlas.buildings.frames["b-home"], person = atlas.actors.frames["person-0-0-0"];
    async function cell(file, frame) {
      const image = new Image(); image.src = `/games/social-engine/assets/${file}`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = frame.w; canvas.height = frame.h;
      const context = canvas.getContext("2d"); context.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
      const data = context.getImageData(0, 0, frame.w, frame.h).data;
      return await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(new Blob([data])); });
    }
    return { building, person, buildingData: await cell(atlas.buildings.image, building), personData: await cell(atlas.actors.image, person) };
  });
  const unpack = (data) => new Uint8ClampedArray(Buffer.from(data.split(",")[1], "base64"));
  const b = extracted.building, p = extracted.person;
  const building = alphaMask(unpack(extracted.buildingData), b.w, b.h);
  const actor = alphaMask(unpack(extracted.personData), p.w, p.h, true);
  const home = BUILDINGS.find((item) => item.id === "b-home"); assert.ok(home);
  const origin = project(home);
  const positions = [[5.6,14.6],[5.8,14.6],[6,14.6],[6.2,14.6],[6.2,14.8],[6.4,14.6],[6.4,14.8],[6.6,14.6],[6.6,14.8],[6.8,14.6],[6.8,14.8],[7,14.6]];
  for (const [x, y] of positions) {
    const location = project({ x, y });
    assert.ok(masksOverlap(building, actor, location.x - origin.x + b.pivot.x, location.y - origin.y + b.pivot.y, p.pivot.x, p.pivot.y, 0.76, 0.76, 0), `${x},${y}`);
  }
  console.log(JSON.stringify({ status: "PASS", kind: "synthetic real-atlas regression, not gameplay", cases: positions.length, manifestSha256 }));
} finally { await browser.close(); }
