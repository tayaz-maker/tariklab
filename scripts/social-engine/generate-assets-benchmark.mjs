import { build } from "esbuild";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { chromium } from "playwright";
const root = process.cwd();
const bundle = await build({
  entryPoints: ["src/games/social-engine/rendering/benchmark.ts"],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "SEBenchmark",
  platform: "browser",
  minify: true,
});
const code = bundle.outputFiles[0].contents;
const server = http.createServer(async (req, res) => {
  if (req.url === "/bench.js") {
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
  res.end('<body style="margin:0;background:#102528"><script src="/bench.js"></script>');
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
await page.goto(`http://127.0.0.1:${port}`);
const result = await page.evaluate(() => window.SEBenchmark.benchmarkRenderer());
result.bundle = { bytes: code.length, gzip: zlib.gzipSync(code).length };
result.browser = await browser.version();
await fs.writeFile(
  "../acceptance-planning/renderer-benchmark.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
await browser.close();
server.close();
