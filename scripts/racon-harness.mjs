// Node harness: index.html'in <script>'ini DOM shim ile yükler, closure'a eval erişimi verir.
import fs from "node:fs";

export function loadGame(file = "public/games/racon/index.html") {
  const html = fs.readFileSync(file, "utf8");
  let code = html.match(/<script>([\s\S]*)<\/script>/)[1];
  // closure içine eval kancası enjekte et (sadece testte, repo dosyası değişmiyor)
  code = code.replace(/\n\}\)\(\);\s*$/, '\n  window.__evalIn = function (c) { return eval(c); };\n})();\n');
  if (!/__evalIn/.test(code)) throw new Error("eval kancası enjekte edilemedi");

  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
  const mkEl = () => {
    const el = {
      innerHTML: "", textContent: "", value: "", hidden: false, disabled: false, inert: false,
      style: {}, dataset: {}, children: [],
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      setAttribute() {}, getAttribute: () => null, removeAttribute() {},
      appendChild() {}, removeChild() {}, focus() {}, blur() {}, click() {},
      addEventListener() {}, removeEventListener() {}, scrollIntoView() {},
      querySelector: () => mkEl(), querySelectorAll: () => [], contains: () => false,
      closest: () => null, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 })
    };
    return el;
  };
  const elements = new Map();
  const document = {
    body: mkEl(), documentElement: mkEl(), activeElement: null,
    getElementById: (id) => { if (!elements.has(id)) elements.set(id, mkEl()); return elements.get(id); }, querySelector: () => mkEl(), querySelectorAll: () => [],
    createElement: () => mkEl(), addEventListener() {}, removeEventListener() {}
  };
  const win = {
    document, localStorage, innerWidth: 1280, innerHeight: 800,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    setTimeout: (fn) => 0, clearTimeout() {}, requestAnimationFrame: () => 0,
    addEventListener() {}, removeEventListener() {}, navigator: { userAgent: "node" },
    location: { href: "file:///x" }, console
  };
  win.window = win;

  const depthCode = fs.readFileSync("public/games/shared/depth-framework.js", "utf8");
  new Function("window", depthCode)(win);

  new Function("window", fs.readFileSync("public/games/racon/network.js", "utf8"))(win);

  const contentPath = "public/games/racon/content.js";
  if (fs.existsSync(contentPath)) {
    const contentCode = fs.readFileSync(contentPath, "utf8");
    new Function("window", contentCode)(win);
  }

  const fn = new Function("window", "document", "localStorage", "setTimeout", "clearTimeout",
    "requestAnimationFrame", "navigator", "location", "console", "self", "globalThis2", code);
  fn(win, document, localStorage, win.setTimeout, win.clearTimeout, win.requestAnimationFrame,
    win.navigator, win.location, console, win, win);

  const ev = (c) => win.__evalIn(c);
  return { win, ev, localStorage, document };
}
