import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
function worker(entries, fetch) {
  const context = vm.createContext({
    URL,
    Response,
    fetch,
    caches: {
      open: async () => ({
        match: async (r) => {
          const stored = entries.get(
            new URL(typeof r === "string" ? r : r.url, "https://example.test").href,
          );
          if (!stored) return undefined;
          const cloned = stored.clone();
          // Native CacheStorage clones retain a fetch response's redirect flag.
          if (stored.redirected) Object.defineProperty(cloned, "redirected", { value: true });
          return cloned;
        },
        put: async (r, v) => entries.set(typeof r === "string" ? r : r.url, v),
      }),
    },
    self: { addEventListener() {}, location: { origin: "https://example.test" } },
  });
  vm.runInContext(source, context);
  return context;
}
test("offline game index navigation uses the exact cached canonical directory and retains its query", async () => {
  const entries = new Map([
    ["https://example.test/", new Response("portal")],
    [
      "https://example.test/games/racon/?embed=1",
      new Response("actual saved game", {
        headers: { "content-type": "text/html", "x-version": "exact" },
      }),
    ],
  ]);
  const c = worker(entries, async () => {
    throw Error("offline");
  });
  c.req = { url: "https://example.test/games/racon/index.html?embed=1", mode: "navigate" };
  const r = await vm.runInContext("networkFirst(req)", c);
  assert.equal(await r.text(), "actual saved game");
  assert.equal(r.headers.get("x-version"), "exact");
  c.req = { url: "https://example.test/games/racon/index.html?embed=2", mode: "navigate" };
  assert.equal(
    await (await vm.runInContext("networkFirst(req)", c)).text(),
    "portal",
    "a different query must not reuse another game entry",
  );
});
test("navigation cache strips redirect history while preserving status, headers and exact body", async () => {
  const entries = new Map(),
    fresh = new Response("<main>game</main>", {
      status: 200,
      headers: { "content-type": "text/html", "x-version": "exact" },
    });
  Object.defineProperty(fresh, "redirected", { value: true });
  Object.defineProperty(fresh, "clone", {
    value() {
      const cloned = Response.prototype.clone.call(this);
      Object.defineProperty(cloned, "redirected", { value: true });
      return cloned;
    },
  });

  const c = worker(entries, async () => fresh);
  c.req = { url: "https://example.test/games/racon/index.html", mode: "navigate" };
  assert.equal(
    await vm.runInContext("networkFirst(req)", c),
    fresh,
    "online response behavior is preserved",
  );
  const saved = entries.get(c.req.url);
  assert.equal(saved.redirected, false);
  assert.equal(saved.status, 200);
  assert.equal(saved.headers.get("content-type"), "text/html");
  assert.equal(saved.headers.get("x-version"), "exact");
  assert.equal(await saved.text(), "<main>game</main>");
});
test("unrelated navigation retains the existing portal fallback and leaves cache data intact", async () => {
  const entries = new Map([
    ["https://example.test/", new Response("portal")],
    ["https://example.test/other/", new Response("unrelated")],
  ]);
  const c = worker(entries, async () => {
    throw Error("offline");
  });
  c.req = { url: "https://example.test/other/index.html", mode: "navigate" };
  assert.equal(await (await vm.runInContext("networkFirst(req)", c)).text(), "portal");
  assert.equal(entries.size, 2);
});

test("failed cache writes do not replace a successful network response", async () => {
  const fresh = new Response("current online game");
  const context = vm.createContext({
    URL,
    Response,
    fetch: async () => fresh,
    caches: {
      open: async () => ({
        put: async () => {
          throw new Error("quota");
        },
        match: async () => new Response("old cached page"),
      }),
    },
    self: { addEventListener() {}, location: { origin: "https://example.test" } },
  });
  vm.runInContext(source, context);
  context.req = { url: "https://example.test/games/racon/index.html", mode: "navigate" };
  assert.equal(await vm.runInContext("networkFirst(req)", context), fresh);
});

for (const [name, requestURL, cachedURL] of [
  [
    "direct game hit",
    "https://example.test/games/racon/index.html",
    "https://example.test/games/racon/index.html",
  ],
  [
    "canonical directory hit",
    "https://example.test/games/racon/index.html?embed=1",
    "https://example.test/games/racon/?embed=1",
  ],
  ["portal fallback", "https://example.test/missing", "https://example.test/"],
])
  test(`legacy redirected navigation is safe after worker update: ${name}`, async () => {
    const legacy = new Response("<main>retained legacy game</main>", {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/html", "x-legacy": "retained" },
    });
    Object.defineProperty(legacy, "redirected", { value: true });
    const entries = new Map([[cachedURL, legacy]]);
    const c = worker(entries, async () => {
      throw new Error("offline");
    });
    c.req = { url: requestURL, mode: "navigate" };
    const result = await vm.runInContext("networkFirst(req)", c);
    assert.equal(
      result.redirected,
      false,
      "cached redirect history must not escape into a navigation response",
    );
    assert.equal(result.status, 200);
    assert.equal(result.statusText, "OK");
    assert.equal(result.headers.get("content-type"), "text/html");
    assert.equal(result.headers.get("x-legacy"), "retained");
    assert.equal(await result.text(), "<main>retained legacy game</main>");
    assert.equal(entries.size, 1);
    assert.equal(
      entries.get(cachedURL),
      legacy,
      "existing cache entries must not be purged or replaced",
    );
  });

test("a non-navigation cached response retains its original redirect metadata", async () => {
  const legacy = new Response("module bytes");
  Object.defineProperty(legacy, "redirected", { value: true });
  const c = worker(new Map([["https://example.test/games/racon/app.js", legacy]]), async () => {
    throw new Error("offline");
  });
  c.req = { url: "https://example.test/games/racon/app.js", mode: "cors" };
  const result = await vm.runInContext("networkFirst(req)", c);
  assert.equal(result.redirected, true);
  assert.equal(await result.text(), "module bytes");
});
