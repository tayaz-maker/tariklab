import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
const temp = path.resolve("node_modules/.cache/terra-eight"),
  out = path.resolve("screenshots/terra-eight");
await mkdir(`${temp}/games/social-engine/assets`, { recursive: true });
await mkdir(out, { recursive: true });
for (const n of ["atlas.json", "buildings.png", "people-props.png"])
  await copyFile(
    `public/games/social-engine/assets/${n}`,
    `${temp}/games/social-engine/assets/${n}`,
  );
for (const n of ["index.html", "styles.css"])
  await copyFile(`src/games/social-engine/ui/${n}`, `${temp}/games/social-engine/${n}`);
await build({
  entryPoints: {
    app: "src/games/social-engine/ui/app.ts",
    worker: "src/games/social-engine/worker/entry.ts",
  },
  outdir: `${temp}/games/social-engine`,
  bundle: true,
  format: "esm",
  splitting: true,
  target: "es2022",
  alias: { "pixi.js": path.resolve("scripts/social-engine/pixi-entry.mjs") },
  define: { SOCIAL_ATLAS_URL: JSON.stringify("/games/social-engine/assets/atlas.json") },
  plugins: [
    {
      name: "fixture",
      setup(b) {
        b.onLoad({ filter: /rendering\/renderer\.ts$/ }, async (a) => {
          let s = await readFile(a.path, "utf8");
          const marker = "    current = projection;";
          assert(s.includes(marker));
          s = s.replace(
            marker,
            `    if ((window as any).__eightFixture) { const base = projection.vehicles[0]; if (base) { const colors = [0xd9ae54,0xc96f59,0xa5b8c4,0x67a5a0,0xe0d9c4,0xc96f59,0x67a5a0,0xa5b8c4]; const vehicles = Array.from({length:8}, (_, i) => { const sx = ((i % 4) - 1.5) * 210, sy = (Math.floor(i / 4) - .5) * 180; return {...base,id:'fixture'+i,heading:i*Math.PI/4,color:colors[i],location:{...projection.player.location,x:projection.player.location.x+sx/48+sy/24,y:projection.player.location.y-sx/48+sy/24}}; }); projection = {...projection,player:{...projection.player,vehicleId:'fixture0'},npcs:[],vehicles}; } }\n` +
              marker,
          );
          const draw = "    if (!initialized) {\n      camera = { ...focus };";
          assert(s.includes(draw));
          s = s.replace(
            draw,
            `    (window as any).__eightInfo = { actors:[...actors].filter(([id])=>id.startsWith('fixture')).map(([id,v])=>({id,x:v.sprite.x,y:v.sprite.y,frame:[...paintedVehicles].find(([key,t])=>t===v.sprite.texture)?.[0], visible:v.sprite.visible})), frame:(angle:number)=>vehicleFrame(angle), paint:paintedVehicle, raw:actorBase.source.resource, rawFrame:atlas.actors.frames['car-0'], colors:[...paintedVehicles].map(([key,t])=>({key, resource:t.source.resource})) };\n` +
              draw,
          );
          return { contents: s, loader: "ts", resolveDir: path.dirname(a.path) };
        });
      },
    },
  ],
});
const server = spawn(
  "python3",
  ["-m", "http.server", "8232", "--bind", "127.0.0.1", "--directory", temp],
  { stdio: "ignore" },
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const errors = [];
try {
  await new Promise((r) => setTimeout(r, 500));
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8232/games/social-engine/index.html?qa=1");
  await page.locator("[name=name]").fill("Deniz QA");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
  await page.evaluate(() => (window.__eightFixture = true));
  await page.waitForFunction(() => window.__eightInfo?.actors.length === 8);
  await page.waitForTimeout(2000);
  const result = await page.evaluate(() => {
    const info = window.__eightInfo;
    const actors = info.actors;
    let worst = 0,
      worstHeading = 0;
    for (let j = 0; j < 3600; j++) {
      let heading = (j * Math.PI * 2) / 3600,
        frame = info.frame(heading),
        a = (frame * Math.PI) / 4;
      let x = Math.cos(heading) - Math.sin(heading),
        y = (Math.cos(heading) + Math.sin(heading)) / 2,
        ax = Math.cos(a) - Math.sin(a),
        ay = (Math.cos(a) + Math.sin(a)) / 2;
      let dot = (x * ax + y * ay) / Math.hypot(x, y) / Math.hypot(ax, ay);
      let error = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
      if (error > worst) {
        worst = error;
        worstHeading = heading;
      }
    }
    const pixels = info.colors.map(({ key, resource }) => {
      const c = resource.getContext("2d");
      const a = c.getImageData(0, 0, resource.width, resource.height).data;
      let magenta = 0,
        opaque = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] > 200) {
          opaque++;
          if (a[i] > 80 && a[i + 2] > 80 && a[i] > a[i + 1] * 1.8 && a[i + 2] > a[i + 1] * 1.8)
            magenta++;
        }
      }
      return { key, magenta, opaque };
    });
    return { actors, worstDegrees: worst, worstHeading, pixels };
  });
  result.errors = errors;
  assert.equal(result.actors.length, 8);
  for (let i = 0; i < 8; i++)
    assert.match(
      result.actors.find((a) => a.id === "fixture" + i).frame,
      new RegExp(`^(?:car|cargo)-${i}:`),
    );
  assert(result.worstDegrees < 32);
  assert.equal(errors.length, 0);
  await page.screenshot({ path: `${out}/eight-headings-player.png` });
  result.paintComparison = await page.evaluate(() => {
    const info = window.__eightInfo;
    const a = info.paint("car-0", 0xc96f59).source.resource,
      b = info.paint("car-0", 0x67a5a0).source.resource;
    const ap = a.getContext("2d").getImageData(0, 0, a.width, a.height).data,
      bp = b.getContext("2d").getImageData(0, 0, b.width, b.height).data;
    const rawCanvas = document.createElement("canvas");
    rawCanvas.width = a.width;
    rawCanvas.height = a.height;
    const rawContext = rawCanvas.getContext("2d");
    const f = info.rawFrame;
    rawContext.drawImage(info.raw, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    const raw = rawContext.getImageData(0, 0, a.width, a.height).data;
    let unmaskedChanges = 0;
    for (let i = 0; i < raw.length; i += 4) {
      const r = raw[i],
        g = raw[i + 1],
        b = raw[i + 2];
      const masked = r > 40 && b > 40 && r > g * 1.35 && b > g * 1.35 && Math.abs(r - b) < 70;
      if (
        !masked &&
        (raw[i] !== ap[i] ||
          raw[i + 1] !== ap[i + 1] ||
          raw[i + 2] !== ap[i + 2] ||
          raw[i + 3] !== ap[i + 3])
      )
        unmaskedChanges++;
    }
    let changed = 0,
      unchanged = 0;
    for (let i = 0; i < ap.length; i += 4)
      if (ap[i + 3]) {
        if (ap[i] !== bp[i] || ap[i + 1] !== bp[i + 1] || ap[i + 2] !== bp[i + 2]) changed++;
        else unchanged++;
      }
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 550;
    canvas.style.cssText = "position:fixed;inset:0;width:1280px;height:550px;z-index:99999";
    document.body.append(canvas);
    const c = canvas.getContext("2d");
    c.fillStyle = "#e7e1d0";
    c.fillRect(0, 0, 1280, 550);
    c.font = "bold 20px Arial";
    for (let i = 0; i < 8; i++) {
      const actor = info.actors.find((v) => v.id === "fixture" + i),
        texture = info.colors.find((v) => v.key === actor.frame).resource,
        x = 160 + (i % 4) * 320,
        y = 95 + Math.floor(i / 4) * 250,
        angle = (i * Math.PI) / 4,
        dx = (Math.cos(angle) - Math.sin(angle)) * 24,
        dy = (Math.cos(angle) + Math.sin(angle)) * 12,
        len = Math.hypot(dx, dy);
      c.fillStyle = "#183b40";
      c.fillText(`${i * 45}°${i === 0 ? " · PLAYER / CARGO" : ""}`, x - 90, y - 36);
      c.drawImage(texture, x - 120, y - 20, 240, 192);
      c.strokeStyle = "#b32c22";
      c.fillStyle = "#b32c22";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x - 50, y + 190);
      c.lineTo(x - 50 + (dx / len) * 65, y + 190 + (dy / len) * 65);
      c.stroke();
      c.beginPath();
      c.arc(x - 50 + (dx / len) * 65, y + 190 + (dy / len) * 65, 5, 0, Math.PI * 2);
      c.fill();
    }
    return { changedPixels: changed, unchangedPixels: unchanged, unmaskedChanges };
  });
  assert(result.paintComparison.changedPixels > 500);
  assert(result.paintComparison.unchangedPixels > 500);
  assert.equal(result.paintComparison.unmaskedChanges, 0);
  await page.screenshot({ path: `${out}/eight-headings-contact-sheet.png` });
  await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  server.kill();
}
