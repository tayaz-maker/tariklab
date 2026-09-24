import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import { transform } from "lightningcss";
import { compactNavigation } from "../public/games/shared/compact-navigation.js";
import { bindSavePanel } from "../public/games/next-wave/shared/runtime.js";
import { create } from "../public/games/next-wave.js";

const root = new URL("../", import.meta.url).pathname;
const read = (path) => readFileSync(resolve(root, path), "utf8");
const games = ["apartman", "tc-sim-devlet", "son-100-gun", "kayip-telefon"];

// Unit doubles for DOM ownership and event wiring, NOT a layout/browser simulator.
function navFixture(count, active) {
  const doc = { createElement: (tag) => element(tag) };
  function element(tag) {
    const classes = new Set();
    return {
      tag, ownerDocument: doc, children: [], attrs: {}, listeners: {}, textContent: "",
      classList: {
        contains: (name) => classes.has(name), add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
      },
      append(...children) {
        for (const child of children) {
          if (child.parent) child.parent.children = child.parent.children.filter((item) => item !== child);
          child.parent = this; this.children.push(child);
        }
      },
      querySelectorAll() { return this.children.filter((child) => child.tag === "button"); },
      setAttribute(name, value) { this.attrs[name] = value; },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      focus() { this.focused = true; },
    };
  }
  const nav = element("nav");
  const buttons = Array.from({ length: count }, (_, i) => {
    const button = element("button"); button.textContent = `Section ${i}`;
    if (i === active) button.classList.add("is-active");
    button.addEventListener("click", () => i);
    return button;
  });
  nav.append(...buttons);
  return { nav, buttons };
}

test("compact navigation preserves original controls/listeners and exposes every secondary destination", () => {
  const { nav, buttons } = navFixture(13, 8);
  const handler = buttons[8].listeners.click;
  compactNavigation(nav, "More sections");
  const extra = nav.children.at(-1), toggle = nav.children.at(-2);
  assert.deepEqual(nav.children.slice(0, 4), buttons.slice(0, 4));
  assert.deepEqual(extra.children, buttons.slice(4));
  assert.equal(buttons[8].listeners.click, handler);
  assert.equal(handler(), 8);
  assert.equal(buttons[8].attrs["aria-current"], "page");
  assert.match(toggle.textContent, /More sections.*Section 8/);
  assert.equal(toggle.attrs["aria-controls"], extra.id);
  compactNavigation(nav);
  assert.equal(nav.children.length, 6, "rerunning enhancement must not duplicate controls");
});

test("navigation opens, closes and returns keyboard focus on Escape without an action", () => {
  const { nav } = navFixture(8, 0);
  compactNavigation(nav);
  const toggle = nav.children.at(-2);
  toggle.listeners.click();
  assert.equal(toggle.attrs["aria-expanded"], "true");
  let prevented = false;
  nav.listeners.keydown({ key: "Escape", preventDefault() { prevented = true; } });
  assert.equal(toggle.attrs["aria-expanded"], "false");
  assert.equal(toggle.focused, true);
  assert.equal(prevented, true);
  assert.equal(nav.classList.contains("is-expanded"), false);
  assert.doesNotThrow(() => compactNavigation(null));
});

test("cross-slot save asks before overwriting and cancellation does not touch active state", () => {
  const button = { dataset: { saveSlot: "2" }, addEventListener(_, fn) { this.click = fn; } };
  const session = { active: 1, slotSummaries: () => [{ number: 2, filled: true }], save(slot) { this.active = slot; this.writes++; }, writes: 0 };
  const host = { querySelectorAll: (selector) => selector === "[data-save-slot]" ? [button] : [] };
  const previous = globalThis.window;
  let confirmed = false, prompts = 0;
  globalThis.window = { confirm() { prompts++; return confirmed; } };
  try {
    bindSavePanel(host, session);
    button.click();
    assert.equal(session.active, 1); assert.equal(session.writes, 0);
    confirmed = true; button.click();
    assert.equal(session.active, 2); assert.equal(session.writes, 1);
    button.click();
    assert.equal(prompts, 2, "saving the current slot needs no overwrite prompt");
    assert.equal(session.writes, 2);
  } finally { globalThis.window = previous; }
});

test("all touched stylesheets parse as CSS and linked navigation rules follow game overrides", () => {
  for (const path of [
    ...games.map((id) => `public/games/${id}/style.css`),
    "public/games/next-wave/shared/base.css", "public/games/tc-sim/styles.css",
    "public/games/shared/compact-navigation.css", "public/games/shared/classics-ux.css",
  ]) assert.doesNotThrow(() => transform({ filename: path, code: Buffer.from(read(path)), errorRecovery: false }), path);
  for (const id of ["tc-sim-devlet", "tc-sim"]) {
    const html = read(`public/games/${id}/index.html`);
    assert.ok(html.indexOf("compact-navigation.css") > html.indexOf(id === "tc-sim" ? "./styles.css" : "./style.css"));
  }
});

test("mobile navigation has bounded expanded scrolling and does not hide desktop destinations", () => {
  const css = read("public/games/shared/compact-navigation.css");
  assert.match(css, /\.nav-secondary\s*\{\s*display: contents/);
  assert.match(css, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /max-height: 45dvh/);
  assert.match(css, /max-height: 500px[\s\S]*position: static/);
  assert.doesNotMatch(read("public/games/shared/compact-navigation.js"), /localStorage|session\.act|persist\(/);
});

test("new UI module graph and every Next Wave shell use fresh online assets, with offline fallback", async () => {
  const handlers = {}, network = [], cached = [];
  const cache = { put() {}, async match(req) { cached.push(req.url); return "offline"; } };
  const context = vm.createContext({
    self: { location: { origin: "https://www.tariklab.com" }, addEventListener(name, fn) { handlers[name] = fn; } },
    URL, Response, caches: { async open() { return cache; } },
    fetch: async (req) => { network.push(req.url); return { ok: true, clone: () => ({}) }; },
  });
  vm.runInContext(read("public/sw.js"), context);
  const paths = [...games.map((id) => `/games/${id}/app.js`), "/games/shared/compact-navigation.js", "/games/shared/classics-ux.css"];
  for (const path of paths) {
    assert.equal(vm.runInContext(`isModuleGameAsset(new URL('https://www.tariklab.com${path}'))`, context), true);
    let result;
    handlers.fetch({ request: { method: "GET", url: `https://www.tariklab.com${path}` }, respondWith(value) { result = value; } });
    await result;
  }
  assert.equal(network.length, paths.length); assert.equal(cached.length, 0);
  context.fetch = async () => { throw new Error("offline"); };
  assert.equal(await vm.runInContext("networkFirst({url:'https://www.tariklab.com/games/apartman/app.js'})", context), "offline");
});

test("20 live catalog destinations and static entrypoint assets exist", () => {
  const catalog = read("src/lib/games.ts").split("export const GAMES:")[1];
  assert.equal((catalog.match(/status: "live"/g) || []).length, 20);
  assert.equal((catalog.match(/status: "soon"/g) || []).length, 0);
  assert.match(catalog, /slug: "jitem-derin-ag"[\s\S]*?status: "live"[\s\S]*?href: "\/oyna\/jitem-derin-ag"/);
  const entries = [...catalog.matchAll(/slug: "([^"]+)"[\s\S]*?status: "live"/g)].map((match) => match[1]);
  for (const id of entries.filter((id) => id !== "cete-savaslari")) {
    const file = resolve(root, `public/games/${id}/index.html`);
    assert.ok(existsSync(file), id);
    const html = readFileSync(file, "utf8");
    for (const match of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^" ]*)?)"/g)) {
      const asset = match[1].split("?")[0];
      if (/^https?:/.test(asset)) continue;
      assert.ok(existsSync(asset.startsWith("/") ? resolve(root, `public${asset}`) : resolve(dirname(file), asset)), `${id}: ${asset}`);
    }
  }
});
