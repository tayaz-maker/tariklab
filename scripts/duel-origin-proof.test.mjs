import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import vm from "node:vm";
import { assertSameOrigin } from "./duel-origin-proof.mjs";

const body = "exact accepted asset bytes";
const hash = (value) => createHash("sha256").update(value).digest("hex");
function verifier() {
  const source = readFileSync(new URL("./duel-production.mjs", import.meta.url), "utf8");
  const fn = source.slice(
    source.indexOf("async function verifyAssets(origin) {"),
    source.indexOf("\nconst out ="),
  );
  // Run the production function itself, with real HTTP and matching asset bytes.
  return vm.runInNewContext(`${fn};verifyAssets`, {
    paths: ["probe"],
    expected: new Map([["probe", hash(body)]]),
    hash,
    fetch,
    AbortSignal,
    Buffer,
    assert,
    assertSameOrigin,
    setTimeout: () => {
      throw new Error("Origin mismatch must not enter deployment retry");
    },
  });
}
async function server(t, handler) {
  const instance = createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    instance.closeAllConnections();
    await new Promise((resolve) => instance.close(resolve));
  });
  return `http://127.0.0.1:${instance.address().port}`;
}

test("production asset verifier rejects real cross-origin 302 despite a matching hash", async (t) => {
  let hits = 0;
  const landing = await server(t, (_, response) => {
    hits++;
    response.end(body);
  });
  const origin = await server(t, (_, response) => {
    response.writeHead(302, { location: `${landing}/accepted?revision=1` });
    response.end();
  });
  await assert.rejects(verifier()(origin), /cross-origin proof redirect/);
  assert.equal(hits, 1, "mismatch fails immediately rather than entering retry");
});

test("production asset verifier permits real same-origin path/query redirect", async (t) => {
  let hits = 0;
  const origin = await server(t, (request, response) => {
    if (request.url === "/probe") response.writeHead(302, { location: "/accepted?revision=1" });
    else {
      hits++;
      response.end(body);
      return;
    }
    response.end();
  });
  await verifier()(origin);
  assert.equal(hits, 1);
});

test("page/frame origin assertion ignores path/query but rejects changed host, protocol or port", () => {
  assert.equal(
    assertSameOrigin("https://www.tariklab.com/game?q=1", "https://www.tariklab.com/", "frame"),
    "https://www.tariklab.com",
  );
  for (const actual of [
    "https://tariklab.tayaz29.workers.dev/game",
    "http://www.tariklab.com/game",
    "https://www.tariklab.com:444/game",
  ])
    assert.throws(
      () => assertSameOrigin(actual, "https://www.tariklab.com", "page"),
      /cross-origin proof redirect/,
    );
});
