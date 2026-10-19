// Launch the same Wrangler command recorded by Nitro, without Nitro's fixed
// 20x500ms proxy-start deadline. The caller polls real HTTP readiness instead.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export function builtPreviewArgs(metadata, port) {
  if (metadata.preset !== "cloudflare-module" || metadata.commands?.preview !== "npx wrangler --cwd ./ dev")
    throw new Error("unsupported built preview command; inspect the build metadata");
  if (!Number.isInteger(Number(port)) || Number(port) < 1024 || Number(port) > 65535)
    throw new Error("invalid preview port");
  return ["scripts/with-app-env.mjs", "npx", "wrangler", "--cwd", "./", "dev", "--port", String(port), "--host", "127.0.0.1"];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const metadata = JSON.parse(readFileSync(".output/nitro.json", "utf8"));
  const child = spawn(process.execPath, builtPreviewArgs(metadata, process.argv[2]), { stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => child.kill(signal));
  child.on("error", error => { console.error(error); process.exit(1); });
  child.on("exit", code => process.exit(code ?? 1));
}
