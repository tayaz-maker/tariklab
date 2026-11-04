import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("public"),
  port = Number(process.env.SOCIAL_ENGINE_PORT || 8097);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (pathname === "/oyna/social-engine") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(
          '<!doctype html><html lang="tr"><title>SOCIAL ENGINE</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;display:block}</style><iframe title="SOCIAL ENGINE" src="/games/social-engine/index.html"></iframe></html>',
        );
        return;
      }
      let file = resolve(root, "." + pathname);
      if (!file.startsWith(root + sep)) throw Error("Forbidden");
      if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
      res.writeHead(200, {
        "content-type": mime[extname(file)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Isolated static preview http://127.0.0.1:${port}/oyna/social-engine`),
  );
