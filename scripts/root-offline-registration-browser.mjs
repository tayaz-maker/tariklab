import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer, request as httpRequest } from "node:http";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { waitForHttp } from "./ci-readiness.mjs";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
export async function rootOfflineRegistrationBrowser({
  baseURL,
  sourcePublic,
  out: output = "../offline-quality-evidence",
}) {
  const values = { "base-url": baseURL, "source-public": sourcePublic, out: output };
  assert.ok(values["base-url"]);
  let origin = new URL(values["base-url"]).origin,
    proxy;
  if (values["source-public"]) {
    const source = createStaticGameServer(values["source-public"]),
      upstream = new URL(origin);
    proxy = createServer((req, res) => {
      if (/^\/(games|i18n)\//.test(req.url)) {
        source.emit("request", req, res);
        return;
      }
      const remote = httpRequest(
        new URL(req.url, upstream),
        { method: req.method, headers: { ...req.headers, host: upstream.host } },
        (r) => {
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        },
      );
      remote.on("error", () => res.writeHead(502).end());
      req.pipe(remote);
    });
    await new Promise((done) => proxy.listen(0, "127.0.0.1", done));
    origin = `http://127.0.0.1:${proxy.address().port}`;
  }
  const out = resolve(values.out);
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const rows = [];
  const gameFrame = async (page) => {
    await page.waitForFunction(
      () => {
        const f = document.querySelector("iframe");
        return f?.contentDocument?.body?.innerText.trim().length > 50;
      },
      null,
      { timeout: 15000 },
    );
    return page.frames().find((f) => new URL(f.url()).pathname.startsWith("/games/"));
  };
  const facts = (page) =>
    page.evaluate(async () => ({
      storage: Object.fromEntries(Object.entries(localStorage)),
      sentinel: await (
        await (await caches.open("offline-preserve-sentinel")).match("/keep-sentinel")
      ).text(),
      controller: navigator.serviceWorker.controller?.scriptURL,
    }));
  try {
    // Keep both vanilla and ES-module offline coverage on currently shipped games.
    for (const slug of ["racon", "son-kasaba"])
      for (const lang of ["tr", "en", "pl"])
        for (const width of [1280, 390]) {
          console.log(slug, lang, width);
          const context = await browser.newContext({ viewport: { width, height: 844 } }),
            page = await context.newPage(),
            errors = [];
          page.setDefaultTimeout(15000);
          page.on("pageerror", (e) => errors.push(e.message));
          page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
          });
          page.on("requestfailed", (request) =>
            console.error("REQUESTFAILED", request.url(), request.failure()?.errorText),
          );
          await page.goto(`${origin}/favicon.svg`);
          await page.evaluate(async (lang) => {
            localStorage.setItem("tariklab.language", lang);
            localStorage.setItem("offline-preserve-sentinel", "keep-existing-save");
            localStorage.setItem(
              "tlab.tektas.v1",
              JSON.stringify({ remaining: 1, moves: 31, center: true }),
            );
            await (
              await caches.open("offline-preserve-sentinel")
            ).put("/keep-sentinel", new Response("keep-existing-cache"));
          }, lang);
          assert.equal(
            await page.evaluate(
              async () => (await navigator.serviceWorker.getRegistrations()).length,
            ),
            0,
          );
          await page.goto(`${origin}/oyna/${slug}`, { waitUntil: "networkidle" });
          let frame = await gameFrame(page);
          await page.waitForFunction(
            () => navigator.serviceWorker.controller?.scriptURL === location.origin + "/sw.js",
            null,
            { timeout: 15000 },
          );
          assert.equal(
            await page.getByText("Ana ekrana ekle", { exact: true }).count(),
            0,
            "root registration does not mount Cete install UI",
          );
          if (slug === "racon") {
            await frame.locator('#menu-home [data-act="menu"][data-go="nick"]').click();
            await frame.locator("#lakap").fill("Offline QA");
            await frame.locator('#menu-nick [data-go="origin"]').click();
            await frame.locator('[data-act="origin"][data-id="koy"]').click();
            await frame.locator('[data-act="night"][data-id="kahve"]').click();
            assert.ok(await frame.evaluate(() => localStorage.getItem("tariklab::racon:1")));
          } else {
            await frame.locator("#menu-new").click();
            await frame.locator("#confirm-start").click();
            await frame.locator("#town-advance").waitFor();
            assert.equal(await frame.evaluate(() => JSON.parse(localStorage.getItem("tariklab.nextwave.son-kasaba.slot1")).month), 1);
          }
          const saved = await facts(page);
          await page.reload({ waitUntil: "networkidle" });
          frame = await gameFrame(page);
          await page.waitForFunction(
            async ({ slug, lang }) => {
              const urls = new Set();
              for (const key of await caches.keys())
                for (const r of await (await caches.open(key)).keys())
                  urls.add(new URL(r.url).pathname);
              return (
                urls.has("/oyna/" + slug) &&
                urls.has("/games/" + slug + "/index.html") &&
                urls.has("/i18n/pl-body.js") &&
                (lang !== "pl" || urls.has("/i18n/pl/" + slug + ".json"))
              );
            },
            { slug, lang },
            { timeout: 15000 },
          );
          const onlineText = await frame.locator("body").innerText();
          const heading = slug === "son-kasaba" ? ".front-menu__heading" : "#menu-home";
          const onlineHeading = await frame.locator(heading).innerText();
          const onlineLabel =
            slug === "son-kasaba"
              ? await frame.locator("#menu-continue").textContent()
              : await frame.locator("#btn-devam").textContent();
          assert.deepEqual(
            (await facts(page)).storage,
            saved.storage,
            "warm load preserves all existing saves",
          );
          await context.setOffline(true);
          const response = await page.reload({ waitUntil: "networkidle" });
          assert.equal(response.status(), 200);
          try {
            frame = await gameFrame(page);
          } catch (error) {
            console.error(
              "OFFLINE_DIAGNOSTIC",
              JSON.stringify(
                await page.evaluate(async () => {
                  const items = [];
                  for (const key of await caches.keys())
                    for (const req of await (await caches.open(key)).keys()) {
                      if (/games\/racon\/(?:index.html)?$/.test(new URL(req.url).pathname)) {
                        const r = await (await caches.open(key)).match(req);
                        items.push({
                          key,
                          url: req.url,
                          responseURL: r.url,
                          redirected: r.redirected,
                          status: r.status,
                        });
                      }
                    }
                  return {
                    frames: [...document.querySelectorAll("iframe")].map((f) => ({
                      src: f.src,
                      text: f.contentDocument?.body?.innerText,
                    })),
                    items,
                  };
                }),
              ),
            );
            throw error;
          }
          if (lang === "pl")
            await frame.waitForFunction(() => window.tlabPlBody?.translate("Save") !== null);
          assert.equal(await frame.evaluate(() => localStorage.getItem("tariklab.language")), lang);
          const offlineLabel =
            slug === "son-kasaba"
              ? await frame.locator("#menu-continue").textContent()
              : await frame.locator("#btn-devam").textContent();
          assert.equal(offlineLabel, onlineLabel);
          const body = await frame.locator("body").innerText();
          assert.ok(body.trim().length > 50);
          assert.equal(
            await frame.locator(heading).innerText(),
            onlineHeading,
            "offline menu stays in the selected language",
          );
          assert.equal(
            body.includes("Çevrimdışı") && body.trim().length < 100,
            false,
            "not a fallback error page",
          );
          assert.deepEqual(
            (await facts(page)).storage,
            saved.storage,
            "offline reload preserves all existing saves",
          );
          assert.equal((await facts(page)).sentinel, "keep-existing-cache");
          if (slug === "son-kasaba") {
            await frame.locator("#menu-continue").click();
            await frame.locator("#town-advance").click();
            assert.equal(await frame.evaluate(() => JSON.parse(localStorage.getItem("tariklab.nextwave.son-kasaba.slot1")).month), 2);
          } else {
            await frame.locator("#btn-devam").click();
            assert.equal(await frame.locator("#btn-ilerlet").isVisible(), true);
          }
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
            ),
            false,
          );
          assert.equal(
            await frame.evaluate(
              () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
            ),
            false,
          );
          assert.deepEqual(errors, []);
          await page.screenshot({ path: `${out}/${slug}-${lang}-${width}.png`, fullPage: false });
          rows.push({
            slug,
            lang,
            width,
            status: "PASS",
            onlineTextLength: onlineText.length,
            offlineTextLength: body.length,
            controller: (await facts(page)).controller,
          });
          await context.close();
        }
  } finally {
    await browser.close();
    proxy?.close();
    writeFileSync(
      `${out}/results.json`,
      JSON.stringify(
        {
          status: rows.length === 12 ? "PASS" : "FAIL",
          origin,
          sourcePublic: values["source-public"] || null,
          rows,
        },
        null,
        2,
      ) + "\n",
    );
  }
  console.log(JSON.stringify({ status: "PASS", cases: rows.length }));

  return { status: "PASS", rows };
}

export async function rootOfflineRegistrationCI(out) {
  const port = process.env.ROOT_OFFLINE_PORT || "8106";
  const baseURL = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["scripts/ci-built-preview.mjs", port], {
    stdio: "inherit",
    detached: true,
  });
  try {
    await waitForHttp(baseURL, {
      timeoutMs: 90000,
      stopped: () => server.exitCode !== null || server.signalCode !== null,
    });
    return await rootOfflineRegistrationBrowser({ baseURL, out });
  } finally {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* already stopped */
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      "base-url": { type: "string" },
      "source-public": { type: "string" },
      out: { type: "string", default: "../offline-quality-evidence" },
    },
  });
  await rootOfflineRegistrationBrowser({
    baseURL: values["base-url"],
    sourcePublic: values["source-public"],
    out: values.out,
  });
}
