import { build } from "esbuild";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
const entry = `import {createRenderer} from './src/games/social-engine/rendering/renderer.ts';import {initializeWorld} from './src/games/social-engine/simulation/population.ts';const state=initializeWorld(20261103);const renderer=await createRenderer(document.querySelector('#world'),p=>console.log('destination',p));const projection=()=>({tick:state.tick,minute:state.minute,player:state.player,npcs:state.npcs.filter(n=>n.local),vehicles:state.vehicles,businesses:state.businesses,quests:[],events:[],relations:[],balance:state.accounts.player,notices:[],population:1100,simMs:0});renderer.render(projection());window.preview={renderer,state,refresh:()=>renderer.render(projection())};`;
const root = process.cwd();
const bundle = await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: "render-preview.ts", loader: "ts" },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
});
const code = bundle.outputFiles[0].contents;
const server = http.createServer(async (req, res) => {
  if (req.url === "/preview.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.end(code);
    return;
  }
  if (req.url.startsWith("/games/social-engine/assets/")) {
    try {
      const data = await fs.readFile(path.join(root, "public", req.url));
      res.setHeader("Content-Type", req.url.endsWith(".png") ? "image/png" : "application/json");
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end();
    }
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end(
    '<body style="margin:0;background:#102528"><div id="world" style="width:1280px;height:720px"></div><script type="module" src="/preview.js"></script>',
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}`);
await page.waitForFunction(() => window.preview);
await page.waitForTimeout(1500);
await page.screenshot({ path: "../acceptance-planning/renderer-outside.png" });
await page.evaluate(() => {
  window.preview.state.tick++;
  window.preview.state.player.location = { x: 7, y: 9, scene: "b-market" };
  window.preview.refresh();
});
await page.waitForTimeout(500);
await page.screenshot({ path: "../acceptance-planning/renderer-interior.png" });
const metrics = await page.evaluate(() => window.preview.renderer.metrics());
const contextLoss = await page.evaluate(async () => {
  const host = document.querySelector("#world"),
    events = [];
  host.addEventListener("social-engine-render-error", (e) => events.push(e.detail));
  host.addEventListener("social-engine-render-restored", (e) => events.push(e.detail));
  const canvas = host.querySelector("canvas"),
    gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  const extension = gl?.getExtension("WEBGL_lose_context");
  if (!extension) return { status: "UNVERIFIED", reason: "WEBGL_lose_context unavailable" };
  extension.loseContext();
  await new Promise((r) => setTimeout(r, 300));
  extension.restoreContext();
  await new Promise((r) => setTimeout(r, 800));
  return {
    status:
      events.includes("WEBGL_CONTEXT_LOST") && events.includes("WEBGL_CONTEXT_RESTORED")
        ? "PASS"
        : "FAIL",
    events,
  };
});
await page.screenshot({ path: "../acceptance-planning/renderer-context-restored.png" });
await page.evaluate(() => window.preview.renderer.destroy());
await fs.writeFile(
  "../acceptance-planning/renderer-preview.json",
  JSON.stringify({ errors, metrics, contextLoss }, null, 2),
);
console.log(JSON.stringify({ errors, metrics, contextLoss }));
await browser.close();
server.close();
