import { districtText } from "./district.ts";
import { createSaveQueue } from "./save-queue.ts";
import { resetMotionInput } from "./input-lifecycle.ts";
import type {
  Command,
  Person,
  Point,
  Profile,
  RenderProjection,
  WorldState,
} from "../domain/types.ts";
import { BUILDINGS, SPAWN } from "../rendering/world.ts";
import { createRenderer } from "../rendering/renderer.ts";
import { SaveRepository, SLOT_IDS } from "../persistence/index.ts";
import type { JournalHandle, JournalPoint } from "../persistence/index.ts";
import { LiveJournal, recoveryIsNewer } from "./live-journal.ts";
import type { LocalSimulationEndpoint } from "../worker/local-endpoint.ts";
import { JOBS, FACTIONS, ITEMS } from "../domain/content.ts";

const SOCIAL_WORKER_URL =
  document.querySelector<HTMLMetaElement>('meta[name="social-engine-worker"]')?.content ||
  "./worker.js";
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const skillName = (v: string) =>
  (
    ({
      driving: "Sürüş",
      combat: "Dövüş",
      communication: "İletişim",
      technical: "Teknik",
      trade: "Ticaret",
      academic: "Akademik",
      body: "Fizik",
      discipline: "Özdenetim",
    }) as Record<string, string>
  )[v] ?? v;
const statusName = (v: string) =>
  (
    ({
      offered: "Açık fırsat",
      active: "Üstlenildi",
      complete: "Tamamlandı",
      failed: "Başarısız",
      expired: "Süresi doldu",
      open: "Açık",
      distressed: "Ekonomik sıkıntıda",
      closed: "Kapalı",
      work: "Çalışıyor",
      sleep: "Dinleniyor",
      eat: "Yemek arıyor",
      heal: "İyileşiyor",
      socialize: "Sosyalleşiyor",
      seekJob: "İş arıyor",
      idle: "Mahallede",
      greet: "Sohbete açık",
      queued: "Sıra bekliyor",
      investigating: "İnceleniyor",
      pursuit: "Takip",
      custody: "İfade ve işlem",
      acquitted: "Şüphe kalktı",
      fined: "Ceza sonuçlandı",
      drive: "Yolda",
    }) as Record<string, string>
  )[v] ?? v;
const prettyKey = (v: string) => v.replace(/^Key/, "").replace(/^Digit/, "");
const money = (v: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(v / 100);
const db = new SaveRepository();
const snapshotPoints = new WeakMap<WorldState, JournalPoint>();
let liveJournal: LiveJournal | null = null;
let sessionJournalEpoch: string | null = null;
async function stopJournal() {
  const old = liveJournal;
  liveJournal = null;
  await old?.dispose();
}
function createJournal(expected: JournalHandle | null) {
  const controller = new LiveJournal(
    db,
    expected,
    async () => {
      const state = await snapshot();
      const point = snapshotPoints.get(state);
      if (!point) throw new Error("Kayıt günlüğü işaretçisi alınamadı.");
      return { state, point };
    },
    ({ state, point }) => {
      lastSnapshot = state;
      sessionJournalEpoch = point.epoch;
    },
    (error) => {
      toast(`Otomatik kayıt durdu: ${error.message} Kişisel slota kaydet veya dışa aktar.`);
    },
  );
  liveJournal = controller;
  return controller;
}
async function loadSlot(id: string) {
  await stopJournal();
  const state = await db.load(id);
  await start(undefined, state);
}
async function recover(compatibility: boolean) {
  await stopJournal();
  let state = lastSnapshot ?? initialSave;
  try {
    const handle = await db.inspectJournal();
    if (handle && handle.epoch === sessionJournalEpoch) {
      const restored = await db.load("auto");
      const restoredPoint = db.lastJournalHandle;
      if (
        !state ||
        recoveryIsNewer(state.tick, snapshotPoints.get(state), restored.tick, restoredPoint)
      ) {
        state = restored;
        if (restoredPoint) snapshotPoints.set(state, restoredPoint);
      }
    }
  } catch (error) {
    toast(`Son otomatik kayıt okunamadı: ${(error as Error).message}`);
  }
  renderer?.destroy();
  renderer = null;
  await start(initialProfile, state, compatibility);
}
let worker: Worker | LocalSimulationEndpoint | null = null,
  view: RenderProjection | null = null;
let renderer: Awaited<ReturnType<typeof createRenderer>> | null = null;
let session = crypto.randomUUID(),
  sequence = 0,
  panel = "",
  panelTab = "",
  selected = "";
let initialProfile: Profile | undefined;
let initialSave: WorldState | undefined;
let lastSnapshot: WorldState | null = null,
  paused = false,
  hidden = false,
  starting = false,
  saving = false;
let keyState = new Set<string>(),
  lastMotion = "",
  previousFocus: HTMLElement | null = null;
const snapshots = new Map<
  string,
  {
    resolve: (s: WorldState) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
const results = new Map<string, (result: { ok: boolean; reason: string }) => void>();
const perf = {
  frames: [] as number[],
  sim: [] as number[],
  ipc: [] as number[],
  save: [] as number[],
  errors: [] as string[],
};
let lastFrame = performance.now(),
  frameSamples = 0,
  lastHud = 0,
  toastTimer = 0;
const settings = {
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  contrast: false,
  scale: 100,
  interact: "KeyE",
  inventory: "KeyI",
  map: "KeyM",
  phone: "KeyP",
};
const reservedKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyF",
  "KeyG",
  "KeyB",
  "KeyT",
  "KeyJ",
]);
const configurableKey = (v: unknown): v is string =>
  typeof v === "string" && /^(Key[A-Z]|Digit[0-9])$/.test(v) && !reservedKeys.has(v);
try {
  const stored = JSON.parse(localStorage.getItem("social-engine:settings") || "{}");
  if (stored && typeof stored === "object") {
    if ([100, 125, 150, 200].includes(stored.scale)) settings.scale = stored.scale;
    if (typeof stored.reduced === "boolean") settings.reduced = stored.reduced;
    if (typeof stored.contrast === "boolean") settings.contrast = stored.contrast;
    const keys = ["interact", "inventory", "map", "phone"] as const;
    const proposed = keys.map((k) => (configurableKey(stored[k]) ? stored[k] : settings[k]));
    if (new Set(proposed).size === keys.length) keys.forEach((k, i) => (settings[k] = proposed[i]));
  }
} catch {
  /* Optional preferences never block a new game. */
}
function applySettings() {
  document.body.classList.toggle("reduce-motion", settings.reduced);
  document.body.classList.toggle("high-contrast", settings.contrast);
  document.body.style.fontSize = `${(15 * settings.scale) / 100}px`;
  try {
    localStorage.setItem("social-engine:settings", JSON.stringify(settings));
  } catch {
    /* Session settings still work when preference storage is unavailable. */
  }
}
applySettings();
function toast(text: string) {
  el("toast").textContent = text;
  el("toast").classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el("toast").classList.add("hidden"), 4200);
}
function send(command: Command) {
  worker?.postMessage({ v: 1, type: "COMMANDS", commands: [command] });
}
function command(
  type: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: boolean; reason: string }> {
  const id = `${session}:${++sequence}`;
  return new Promise((resolve) => {
    results.set(id, resolve);
    send({ v: 1, id, type, args });
    window.setTimeout(() => {
      if (results.delete(id)) resolve({ ok: false, reason: "Yanıt alınamadı; oyun duraklatıldı." });
    }, 5000);
  });
}
async function act(type: string, args: Record<string, unknown> = {}) {
  const r = await command(type, args);
  if (!r.ok) toast(r.reason);
  else if (r.reason) toast(r.reason);
  return r;
}
function setPause() {
  worker?.postMessage({ v: 1, type: "PAUSE", paused: paused || hidden });
}
function snapshot(): Promise<WorldState> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      snapshots.delete(requestId);
      reject(new Error("Dünya anlık görüntüsü alınamadı."));
    }, 6000);
    snapshots.set(requestId, { resolve, reject, timer });
    worker?.postMessage({ v: 1, type: "SNAPSHOT_REQUEST", requestId });
  });
}
const save = createSaveQueue(
  () => worker,
  performSave,
  () => toast("Kayıt kuyruğu dolu; devam eden kayıtları bekle."),
);
async function performSave(slotId: string): Promise<boolean> {
  if (saving || !worker) return false;
  saving = true;
  const t = performance.now();
  try {
    let state: WorldState;
    if (slotId === "auto") {
      const controller = liveJournal ?? createJournal(await db.inspectJournal());
      state = await controller.checkpoint();
    } else {
      state = await snapshot();
      await db.save(slotId, state);
    }
    lastSnapshot = state;
    perf.save.push(performance.now() - t);
    if (slotId !== "auto") toast("Kayıt doğrulandı ve güvenle saklandı.");
    return true;
  } catch (e) {
    toast(`Kayıt alınamadı: ${(e as Error).message}. Dışa aktarmayı kullanabilirsin.`);
    return false;
  } finally {
    saving = false;
  }
}
async function start(profile?: Profile, saveState?: WorldState, compatibility = false) {
  if (starting) return;
  starting = true;
  el<HTMLButtonElement>("continue").disabled = true;
  el<HTMLButtonElement>("character").querySelector<HTMLButtonElement>("[type=submit]")!.disabled =
    true;
  try {
    await stopJournal();
    if (worker) worker.terminate();
    // Capture ownership before INIT. A competing tab must not be silently overwritten.
    let expectedJournal: JournalHandle | null = null;
    let journalAvailable = true;
    try {
      expectedJournal = await db.inspectJournal();
    } catch (error) {
      journalAvailable = false;
      toast(`Otomatik kayıt açılamadı: ${(error as Error).message}`);
    }
    sessionJournalEpoch = null;
    session = crypto.randomUUID();
    sequence = 0;
    keyState.clear();
    lastMotion = "";
    lastSnapshot = saveState ?? null;
    initialProfile = profile;
    initialSave = saveState;
    if (!renderer)
      renderer = await createRenderer(el("world"), (point) => {
        if (!panel) void act("MOVE_TO", point);
      });
    if (!compatibility) {
      try {
        worker = new Worker(new URL(SOCIAL_WORKER_URL, location.href), { type: "module" });
      } catch {
        compatibility = true;
      }
    }
    if (compatibility) {
      const { createLocalEndpoint } = await import("../worker/local-endpoint.ts");
      worker = await createLocalEndpoint();
    }
    if (!worker) throw new Error("Simülasyon başlatılamadı.");
    worker.onerror = (event) => fatal(`Simülasyon durdu: ${event.message}`);
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.v !== 1) return;
      if (message.type === "READY" || message.type === "DELTA") {
        if (typeof message.sentAt === "number" && Number.isFinite(message.sentAt)) {
          const latency = performance.timeOrigin + performance.now() - message.sentAt;
          if (latency >= 0) {
            perf.ipc.push(latency);
            if (perf.ipc.length > 20000) perf.ipc.shift();
          }
        }
        if (message.projection) {
          view = message.projection;
          perf.sim.push(view!.simMs || 0);
          if (perf.sim.length > 20000) perf.sim.shift();
        }
        if (message.type === "READY") {
          starting = false;
          el("intro").classList.add("hidden");
          el("hud").classList.remove("hidden");
          closePanel();
          toast(
            compatibility
              ? "Uyumluluk modu: aynı dünya, daha az görünür komşu. E ile keşfe başla."
              : "DARAMCIK’a hoş geldin. E ile yakınındaki insanları ve kapıları keşfet.",
          );
          sessionJournalEpoch = message.journal?.epoch ?? null;
          if (journalAvailable) {
            const controller = createJournal(expectedJournal);
            void controller.checkpoint().catch(() => undefined);
          } else {
            void snapshot()
              .then((s) => {
                lastSnapshot = s;
              })
              .catch(() => undefined);
          }
        }
      }
      if (message.type === "JOURNAL_BATCH") liveJournal?.accept(message.batch);
      if (message.type === "RESULT") {
        results.get(message.id)?.(message.result);
        results.delete(message.id);
      }
      if (message.type === "SNAPSHOT") {
        const req = snapshots.get(message.requestId);
        if (req) {
          clearTimeout(req.timer);
          if (message.journal) snapshotPoints.set(message.state, message.journal);
          req.resolve(message.state);
          snapshots.delete(message.requestId);
        }
      }
      if (message.type === "ERROR") fatal(message.message || message.code || "Simülasyon hatası");
    };
    worker.postMessage({
      v: 1,
      type: "INIT",
      seed: 20261103,
      profile,
      save: saveState,
      qa: new URLSearchParams(location.search).get("qa") === "1",
    });
  } catch (e) {
    starting = false;
    el("form-error").textContent = (e as Error).message;
  } finally {
    el<HTMLButtonElement>("continue").disabled = false;
    el<HTMLButtonElement>("character").querySelector<HTMLButtonElement>("[type=submit]")!.disabled =
      false;
  }
}
function fatal(message: string) {
  starting = false;
  paused = true;
  panel = "fatal";
  keyState.clear();
  worker?.terminate();
  worker = null;
  for (const resolve of results.values())
    resolve({ ok: false, reason: "Simülasyon duraklatıldı." });
  results.clear();
  for (const request of snapshots.values()) {
    clearTimeout(request.timer);
    request.reject(new Error(message));
  }
  snapshots.clear();
  perf.errors.push(message);
  el("intro").classList.add("hidden");
  el("panel").classList.remove("hidden");
  el("panel").innerHTML =
    `<section class="sheet" role="alertdialog" aria-modal="true" aria-label="Oyun duraklatıldı"><p class="eyebrow">Güvenli duraklama</p><h2>Dünya duraklatıldı.</h2><p class="note">${esc(message)}</p><button id="restart-worker" class="primary" ${!lastSnapshot && !initialProfile && !initialSave ? "disabled" : ""}>Son sağlam noktadan devam et</button><button id="compatibility-mode" ${!lastSnapshot && !initialProfile && !initialSave ? "disabled" : ""}>Uyumluluk modunda devam et</button><button id="reload-saves">Kayıtlarımı aç</button></section>`;
  el("restart-worker").onclick = () => void recover(false);
  el("compatibility-mode").onclick = () => void recover(true);
  el("compatibility-mode").focus();
  el("reload-saves").onclick = () => void openSaves();
}
function nearby() {
  if (!view) return null;
  const p = view.player;
  let nearest: {
    kind: "person" | "building" | "vehicle" | "exit";
    id: string;
    name: string;
    d: number;
  } | null = null;
  const add = (
    kind: "person" | "building" | "vehicle" | "exit",
    id: string,
    name: string,
    q: Point,
  ) => {
    const d = Math.hypot(p.location.x - q.x, p.location.y - q.y);
    if (d <= 2.2 && (!nearest || d < nearest.d)) nearest = { kind, id, name, d };
  };
  // At the actual threshold, a passing pedestrian must not intercept the door.
  // Outside that small footprint the nearest person, door or vehicle still wins.
  const portals =
    p.location.scene === "outside"
      ? BUILDINGS.map((b) => ({ kind: "building", id: b.id, name: b.name, point: b.door }))
      : [{ kind: "exit", id: "exit", name: "Sokağa çık", point: { x: 7, y: 10 } }];
  for (const portal of portals) {
    const d = Math.hypot(p.location.x - portal.point.x, p.location.y - portal.point.y);
    if (d <= 0.55) return { kind: portal.kind, id: portal.id, name: portal.name, d };
  }
  for (const n of view.npcs)
    if (n.alive && n.location.scene === p.location.scene) add("person", n.id, n.name, n.location);
  if (p.location.scene === "outside") {
    for (const b of BUILDINGS) add("building", b.id, b.name, b.door);
    for (const v of view.vehicles) if (!v.driverId) add("vehicle", v.id, "Araca bin", v.location);
  } else {
    add("exit", "exit", "Sokağa çık", { x: 7, y: 10 });
  }
  return nearest as { kind: string; id: string; name: string; d: number } | null;
}
function hud() {
  if (!view) return;
  const root = el("hud");
  if (!el("minimap")) {
    root.innerHTML = `<div class="top"><div class="brand-block"><p class="brand">SOCIAL ENGINE</p><p class="district" id="hud-district"></p><small id="hud-pop"></small></div>
    <section class="vitals glass" aria-label="Karakter durumu"><header><span id="hud-name"></span><span id="hud-balance" data-testid="balance"></span></header><div class="bars">${["Sağlık", "Enerji", "Tokluk"].map((l, i) => `<label><span class="vital-heading"><span>${l}</span><span id="hud-vital-value-${i}"></span></span><span id="hud-vital-${i}" class="bar" role="meter" aria-label="${l}" aria-valuemin="0" aria-valuemax="100"><i></i></span></label>`).join("")}</div><p class="wanted" id="hud-reputation"></p></section>
    <div class="timebox glass"><strong id="hud-time"></strong><p><small id="hud-day"></small></p></div></div>
    <div class="left-bottom"><section class="quest-card glass"><span class="eyebrow" id="hud-quest-kind"></span><h3 id="hud-quest-title"></h3><p id="hud-quest-description"></p><p id="hud-quest-progress" class="quest-progress"></p></section>
    <div class="minimap glass"><canvas id="minimap" width="394" height="290" aria-label="DARAMCIK mini haritası"></canvas><footer><span>DARAMCIK</span><span id="hud-map-key"></span></footer></div></div>
    <div class="right-bottom"><p class="help-line" id="hud-help"></p><nav class="key-nav glass" aria-label="Oyun araçları"><button id="inside-services" class="hidden">Mekân</button>${[
      ["map", "Harita"],
      ["inventory", "Çanta"],
      ["phone", "Telefon"],
      ["missions", "Fırsatlar"],
      ["pause", "Menü"],
    ]
      .map(
        ([id, label]) =>
          `<button data-panel="${id}"><kbd id="hud-key-${id}"></kbd>${label}</button>`,
      )
      .join("")}</nav></div>
    <button id="context" class="interact glass"><kbd id="hud-interact-key"></kbd><span id="hud-interact-label"></span></button><div id="hud-no-context" class="interact glass"><small>Bir kapıya veya komşuna yaklaş · Haritada bir hedef seç</small></div>
    <div class="touch-controls">${[
      ["KeyA", "Sola", "←"],
      ["KeyW", "Yukarı", "↑"],
      ["KeyS", "Aşağı", "↓"],
      ["KeyD", "Sağa", "→"],
    ]
      .map(
        ([code, label, arrow]) =>
          `<button data-move="${code}" aria-label="${label}">${arrow}</button>`,
      )
      .join("")}</div>`;
    root
      .querySelectorAll<HTMLButtonElement>("[data-panel]")
      .forEach((b) => (b.onclick = () => void openPanel(b.dataset.panel!)));
    el("context").onclick = () => void interact();
    el("inside-services").onclick = () => {
      const interior = view?.player.location.scene;
      if (!interior || interior === "outside") return;
      selected = interior;
      beginPanel("building");
      showBuilding(interior);
    };
    root.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((b) => {
      b.onpointerdown = () => keyState.add(b.dataset.move!);
      b.onpointerup = b.onpointerleave = b.onpointercancel = () => keyState.delete(b.dataset.move!);
    });
  }
  // Update text and meters in place. Never detach controls, focused elements or the minimap canvas.
  const put = (id: string, value: string) => {
    const e = el(id);
    if (e.textContent !== value) e.textContent = value;
  };
  const p = view.player,
    n = nearby(),
    day = 1 + Math.floor(view.minute / 1440),
    min = ((view.minute % 1440) + 1440) % 1440;
  const active = view.quests.find((q) => q.status === "active"),
    interactKey = prettyKey(settings.interact);
  put(
    "hud-district",
    p.location.scene === "outside"
      ? "DARAMCIK"
      : (BUILDINGS.find((b) => b.id === p.location.scene)?.name ?? "İç mekân"),
  );
  el("inside-services").classList.toggle("hidden", p.location.scene === "outside");
  put("hud-pop", "KIYI MAHALLESİ · " + view.population + " YAŞAM");
  put("hud-name", p.name);
  put("hud-balance", money(view.balance));
  [p.health, p.stamina, 100 - p.hunger].forEach((v, i) => {
    const bar = el("hud-vital-" + i),
      value = String(Math.round(Math.max(0, Math.min(100, v))));
    put("hud-vital-value-" + i, value);
    bar.classList.toggle("bar-low", Number(value) <= 25);
    if (bar.getAttribute("aria-valuenow") !== value) {
      bar.setAttribute("aria-valuenow", value);
      (bar.firstElementChild as HTMLElement).style.width = value + "%";
    }
  });
  put(
    "hud-reputation",
    p.wanted
      ? "Aranıyorsun · " + p.wanted + " / 3"
      : "İtibar " +
          p.reputation +
          " · " +
          (p.jobId ? (JOBS.find((j) => j.id === p.jobId)?.name ?? "Çalışan") : "Serbest"),
  );
  put(
    "hud-time",
    String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"),
  );
  put(
    "hud-day",
    day +
      ". gün · " +
      (min >= 1080 || min < 360 ? "Gece" : "Gündüz") +
      (view.mobility
        ? " · " + view.mobility.weather.label + " · " + view.mobility.speed + "×"
        : ""),
  );
  put("hud-quest-kind", active ? "Aktif fırsat" : "İlk adımlar");
  put(
    "hud-quest-title",
    (active ? districtText(active.title) : null) ?? "Mahallede kendine bir yer bul",
  );
  put(
    "hud-quest-description",
    (active ? districtText(active.description) : null) ??
      "Haritadan iş yerlerini bul. İnsanlarla tanış; telefonundaki fırsatları takip et.",
  );
  put(
    "hud-quest-progress",
    active && active.required > 0
      ? `${Math.min(active.progress, active.required)} / ${active.required}`
      : "",
  );
  el("hud-quest-progress").classList.toggle("hidden", !active || active.required <= 0);
  for (const key of ["map", "inventory", "phone"] as const)
    put("hud-key-" + key, prettyKey(settings[key]));
  put("hud-key-missions", "J");
  put("hud-key-pause", "Esc");
  put("hud-map-key", prettyKey(settings.map) + " · Harita");
  put(
    "hud-help",
    "WASD yürü · Shift koş · " +
      interactKey +
      " etkileş · F/G saldır · B savun · Boşluk kaçın · T teslim ol",
  );
  const context = p.vehicleId ? "Araçtan in · W/S gaz/fren · A/D kavşak yönü" : (n?.name ?? "");
  el("context").classList.toggle("hidden", !context);
  el("hud-no-context").classList.toggle("hidden", Boolean(context));
  put("hud-interact-key", interactKey);
  put("hud-interact-label", context);
  drawMap(el<HTMLCanvasElement>("minimap"));
}
function drawMap(canvas: HTMLCanvasElement) {
  if (!canvas || !view) return;
  const c = canvas.getContext("2d")!,
    w = canvas.width,
    h = canvas.height,
    scale = Math.min(w / 68, h / 68),
    ox = (w - 64 * scale) / 2,
    oy = (h - 64 * scale) / 2;
  c.fillStyle = "#153d46";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#6a8275";
  c.fillRect(ox, oy, 64 * scale, 57 * scale);
  c.strokeStyle = "#c6b99a";
  c.lineWidth = 4 * scale;
  for (const y of [18, 36, 52]) {
    c.beginPath();
    c.moveTo(ox, oy + y * scale);
    c.lineTo(ox + 64 * scale, oy + y * scale);
    c.stroke();
  }
  for (const x of [18, 43]) {
    c.beginPath();
    c.moveTo(ox + x * scale, oy);
    c.lineTo(ox + x * scale, oy + 57 * scale);
    c.stroke();
  }
  for (const b of BUILDINGS) {
    c.fillStyle = "#ba805d";
    c.fillRect(ox + b.x * scale, oy + b.y * scale, b.w * scale, b.h * scale);
    c.fillStyle = "#f6d385";
    c.beginPath();
    c.arc(ox + b.door.x * scale, oy + b.door.y * scale, Math.max(2, scale), 0, Math.PI * 2);
    c.fill();
  }
  for (const n of view.npcs.slice(0, 100)) {
    if (n.location.scene !== "outside") continue;
    c.fillStyle = "#d7ded0";
    c.fillRect(ox + n.location.x * scale, oy + n.location.y * scale, 2, 2);
  }
  const p =
    view.player.location.scene === "outside"
      ? view.player.location
      : (BUILDINGS.find((b) => b.id === view!.player.location.scene)?.door ?? SPAWN);
  c.fillStyle = "#fff1a4";
  c.strokeStyle = "#153d46";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(ox + p.x * scale, oy + p.y * scale, 5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
}
function shell(title: string, content: string) {
  el("panel").classList.remove("hidden");
  el("panel").innerHTML =
    `<section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><div><p class="eyebrow">SOCIAL ENGINE / DARAMCIK</p><h2>${esc(title)}</h2></div><button id="close-panel" aria-label="Kapat">Kapat ×</button></header>${content}</section>`;
  el("close-panel").onclick = closePanel;
  el("close-panel").focus();
}
function closePanel() {
  panel = "";
  panelTab = "";
  paused = false;
  setPause();
  el("panel").classList.add("hidden");
  el("panel").innerHTML = "";
  previousFocus?.focus();
  keyState.clear();
  lastMotion = "";
}
function beginPanel(name: string) {
  previousFocus = document.activeElement as HTMLElement;
  panel = name;
  keyState.clear();
  void command("STOP"); /* Keep society running while shopping; explicit pause only stops time. */
}
async function openPanel(name: string) {
  if (!view && name !== "saves") return;
  beginPanel(name);
  if (name === "saves") {
    await openSaves();
    return;
  }
  const p = view!.player;
  if (name === "map") {
    shell(
      "Mahalle haritası",
      `<p class="note">Bir mekân seç; karakterin yürünebilir yoldan kapısına gitsin. İçeri girmek için kapıda E’ye bas.</p><canvas id="large-map" class="map-large" width="900" height="650" aria-label="Mahalle haritası"></canvas><div class="map-legend">${BUILDINGS.map((b) => `<button data-go="${b.id}">${esc(b.name)}</button>`).join("")}</div>`,
    );
    drawMap(el<HTMLCanvasElement>("large-map"));
    bindGo();
  }
  if (name === "inventory") {
    shell(
      "Çanta & karakter",
      `<div class="note">${esc(p.name)} · ${money(view!.balance)} · Borç ${money(p.debt)}<br>Sağlık ${Math.round(p.health)} · Enerji ${Math.round(p.stamina)} · Açlık ${Math.round(p.hunger)}</div><div class="rows">${
        Object.entries(p.inventory)
          .filter(([, q]) => q > 0)
          .map(
            ([item, q]) =>
              `<div class="row"><div><h3>${esc(itemName(item))} × ${q}</h3><p>${(ITEMS[item]?.weight ?? 1) * q} kg${view!.progression?.items[item]?.some((unit) => unit.sourceId.startsWith("stolen:")) ? " · Ödenmemiş eşya var; aldığın dükkâna geri verebilirsin." : ""}</p></div><button data-use="${esc(item)}">Kullan</button></div>`,
          )
          .join("") || '<p class="muted">Çantan boş. Marketten yiyecek ve içecek alabilirsin.</p>'
      }</div>${view!.progression ? `<p class="note">Çanta ${view!.progression.slotsUsed}/${view!.progression.slotLimit} yuva · Bugünkü beceri kazanımı ${view!.progression.gainedToday}/${view!.progression.dailyLimit}<br>${view!.progression.perks.map((p) => esc(p.name) + ": " + esc(p.effect)).join("<br>")}</p>` : ""}<h3 class="section">Beceriler</h3><div class="grid">${Object.entries(
        p.skills,
      )
        .map(
          ([k, v]) =>
            `<div class="row"><span>${esc(skillName(k))}</span><strong>${v}</strong></div>`,
        )
        .join("")}</div>`,
    );
    el("panel")
      .querySelectorAll<HTMLButtonElement>("[data-use]")
      .forEach(
        (b) =>
          (b.onclick = async () => {
            await act("USE_ITEM", { item: b.dataset.use });
            await openPanel("inventory");
          }),
      );
  }
  if (name === "phone") {
    renderPhone(panelTab || "news");
  }
  if (name === "missions") {
    renderMissions();
  }
  if (name === "pause") {
    paused = true;
    setPause();
    shell(
      "Bir nefes al",
      `<p class="note">Dünya duraklatıldı. Sekmeyi kapattığında toplum simülasyonu ilerlemez.</p><div class="rows"><button id="resume" class="primary">Oyuna devam et</button><button id="saves">Kayıtlar & dışa aktarım</button><button id="settings">Erişilebilirlik & kontroller</button><button id="help">Mahalle rehberi</button><button id="return-menu">Kaydet ve başlangıca dön</button></div>`,
    );
    el("resume").onclick = closePanel;
    el("saves").onclick = () => void openSaves();
    el("settings").onclick = showSettings;
    el("help").onclick = showHelp;
    el("return-menu").onclick = async () => {
      if (!(await save("auto"))) return;
      worker?.terminate();
      worker = null;
      view = null;
      closePanel();
      el("intro").classList.remove("hidden");
      el("hud").classList.add("hidden");
    };
  }
}
function itemName(item: string) {
  if (item.startsWith("parcel:")) return "Teslimat paketi";
  return (
    (
      {
        simit: "Simit",
        bread: "Ekmek",
        tea: "Çay",
        meal: "Sıcak yemek",
        water: "Su",
        medicine: "İlk yardım",
        parts: "Yedek parça",
        book: "Kitap",
        coffee: "Kahve",
      } as Record<string, string>
    )[item] ?? item
  );
}
function bindGo() {
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-go]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const target = BUILDINGS.find((x) => x.id === b.dataset.go)!;
          closePanel();
          if (view?.player.location.scene !== "outside") {
            toast("Önce sokağa çıkmalısın.");
            return;
          }
          await act("MOVE_TO", target.door);
        }),
    );
}
function renderPhone(tab: string) {
  if (tab === "circles" && view?.social) {
    renderCircles();
    return;
  }
  if (tab === "travel") {
    renderTravel();
    return;
  }
  if (tab === "life") {
    renderLife();
    return;
  }
  panelTab = tab;
  const tabs = `<nav class="tabs" aria-label="Telefon uygulamaları">${[
    ["news", "Mahalle akışı"],
    ["jobs", "İş ilanları"],
    ["contacts", "Rehber"],
    ["finance", "Hesaplar"],
    ["circles", "Çevreler"],
    ["life", "Ev & eğitim"],
    ["travel", "Ulaşım"],
  ]
    .map(
      ([id, t]) =>
        `<button data-tab="${id}" class="${tab === id ? "tab-active" : ""}">${t}</button>`,
    )
    .join("")}</nav>`;
  let body = "";
  if (tab === "news")
    body = `<div class="rows">${
      view!.events
        .slice(-15)
        .reverse()
        .map(
          (e) =>
            `<article class="row"><div><small>${1 + Math.floor(e.minute / 1440)}. gün · Mahalle haberi</small><p>${esc(districtText(e.text))}</p></div></article>`,
        )
        .join("") || "<p>Mahalle henüz güne hazırlanıyor.</p>"
    }</div>`;
  if (tab === "news" && view!.economy) {
    const e = view!.economy;
    body =
      `<p class="note">Mahalle ekonomisi · İşsizlik %${e.unemployment.toFixed(1)} · Ortalama ücret ${money(e.averageWage)}<br>Fiyat endeksi ${e.priceIndex.toFixed(1)} · ${e.shocks.length} süren toplumsal olay</p>` +
      body;
  }
  if (tab === "jobs")
    body = `<p class="note">İş başvurusu için iş yerine git. Maaşlar işletmenin gerçek bütçesine bağlıdır; kriz vardiya ücretini değiştirebilir.</p><div class="rows">${JOBS.map(
      (j) => {
        const business = view!.businesses.find((b) => b.id === j.businessId);
        return `<div class="row"><div><h3>${esc(j.name)}</h3><p>${money(j.wage)} taban ücret · ${esc(statusName(business?.status ?? "open"))}</p></div><button data-go="${business?.buildingId ?? ""}">İş yerine git</button></div>`;
      },
    ).join("")}</div>`;
  if (tab === "contacts")
    body = `<div class="rows">${
      view!.relations
        .filter((r) => r.from === "player" || r.to === "player")
        .map((r) => {
          const id = r.from === "player" ? r.to : r.from,
            n = view!.npcs.find((n) => n.id === id);
          return `<div class="row"><div><h3>${esc(n?.name ?? id)}</h3><p>Güven ${r.trust} · Yakınlık ${r.affection} · Kırgınlık ${r.resentment}</p></div><small>${esc(statusName(n?.goal ?? "idle"))}</small></div>`;
        })
        .join("") || '<p class="muted">Henüz bir bağ kurmadın. Bir komşuna selam ver.</p>'
    }</div>`;
  if (tab === "finance")
    body = `<div class="row"><span>Kullanılabilir para</span><strong>${money(view!.balance)}</strong></div><div class="row"><span>Kalan borç</span><strong>${money(view!.player.debt)}</strong></div><p class="note">Kredi ve geri ödeme için DARAMCIK Bankası’nı ziyaret et. Faiz ve kira oyun içi sözleşmelerdir.</p><button data-go="b-bank">Bankaya git</button>`;
  if (tab === "circles")
    body = `<p class="note">Bir çevreye katılmak için en az 5 itibar gerekir. Çevre değiştirmek nüfuzunu etkiler.</p><div class="rows">${FACTIONS.map((f) => `<div class="row"><div><h3>${esc(f.name)}</h3><p>${esc(f.approach)}</p></div><button data-faction="${f.id}">Katıl</button></div>`).join("")}</div>`;
  shell("Telefon", tabs + body);
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-faction]")
    .forEach(
      (btn) => (btn.onclick = () => void act("JOIN_FACTION", { factionId: btn.dataset.faction })),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-tab]")
    .forEach((b) => (b.onclick = () => renderPhone(b.dataset.tab!)));
  bindGo();
}

function renderCircles() {
  const social = view?.social;
  if (!social) return;
  beginPanel("circles");
  const membership = social.factions.find((f) => f.membership);
  shell(
    "Çevreler & dayanışma",
    `<p class="note">İnsanların güveni, ortak para ve mahalledeki hizmetler nüfuzu birlikte değiştirir. Çevreden ayrılmak geçmişini silmez.</p><div class="rows">${social.factions.map((f) => `<article class="row"><div><h3>${esc(f.name)}</h3><p>${esc(f.leaderName)} · ${f.memberCount} üye · Kasa ${money(f.treasury)}<br>Hukuki baskı ${f.heat}/100${f.membership ? ` · Sadakat ${f.membership.loyalty}/100 · ${f.membership.role === "officer" ? "Sözcü" : f.membership.role === "leader" ? "Lider" : "Üye"}` : ""}</p></div>${f.membership ? '<button data-social="LEAVE_FACTION">Çevreden ayrıl</button>' : `<button data-join-faction="${f.id}">Katıl</button>`}</article>`).join("")}</div>${membership ? '<div class="grid"><button data-social="FACTION_DONATE">Kasaya 100 ₺ katkı yap</button><button data-social="FACTION_PROMOTE">Sözcülük için başvur</button></div>' : ""}<h3 class="section">Mahallede nüfuz</h3><div class="rows">${social.territories.map((t) => `<article class="row"><div><h3>${esc(t.name)}</h3><p>${social.factions.map((f) => esc(f.name) + " " + t.influence[f.id] + "%").join(" · ")}</p></div><div class="actions"><button data-go="${t.buildingId}">Bölgeye git</button><button data-service="${t.id}" ${!membership ? "disabled" : ""}>Hizmet düzenle · kasadan 20 ₺</button></div></article>`).join("")}</div><h3 class="section">${esc(social.club.name)}</h3><p>${esc(social.club.leaderName)} · ${social.club.memberCount} öğrenci${social.club.membership ? " · Saygınlık " + social.club.membership.standing : ""}<br>Suç çevrelerinden bağımsız bir öğrenme topluluğu. Akademide 30 dakika birlikte çalış.</p><div class="grid"><button data-go="b-school">Akademiye git</button><button data-social="${social.club.membership ? "CLUB_SESSION" : "CLUB_JOIN"}">${social.club.membership ? "Çalışma grubuna katıl" : "Kulübe üye ol"}</button></div><h3 class="section">Hatırladıkların</h3><div class="rows">${
      social.memories
        .slice(-10)
        .reverse()
        .map(
          (m) =>
            `<article class="row"><p>${esc(districtText(m.text))}<br><small>${m.mode === "direct" ? "Doğrudan gördün" : "Duyum"} · Güvenilirlik ${m.confidence}%${m.critical ? " · Önemli anı" : ""}</small></p></article>`,
        )
        .join("") || "<p>Yeni bağlar kurdukça anıların burada birikir.</p>"
    }</div>`,
  );
  bindGo();
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-social]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const r = await act(b.dataset.social!, { amount: 10000 });
          if (r.ok && b.dataset.social === "CLUB_SESSION") closePanel();
          else setTimeout(renderCircles, 180);
        }),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-join-faction]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          await act("JOIN_FACTION", { factionId: b.dataset.joinFaction });
          setTimeout(renderCircles, 180);
        }),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-service]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          await act("FACTION_SERVICE", { territoryId: b.dataset.service });
          setTimeout(renderCircles, 180);
        }),
    );
}
function renderRetirement() {
  const p = view?.progression;
  if (!p) return;
  shell(
    "Hayat özeti",
    `<p class="note">${esc(view!.player.name)} · ${Math.floor(view!.minute / 1440) + 1}. gün<br>${money(view!.balance)} birikim · ${money(view!.player.debt)} borç<br>${p.shiftsCompleted} tamamlanmış vardiya · ${view!.player.reputation} itibar</p><p>Emeklilik, dünyayı kaldığı anda durdurur. Kayıtların korunur; istediğin zaman aynı hayata dönebilirsin.</p><button id="retirement-confirm" class="primary">${p.retired ? "Aynı hayata dön" : "Bu dönemi tamamla"}</button><button id="retirement-export">Kayıt menüsünü aç</button>`,
  );
  el("retirement-confirm").onclick = async () => {
    const r = await act(p.retired ? "RESUME_CAREER" : "RETIRE");
    if (r.ok) {
      await save("auto");
      if (p.retired) closePanel();
      else setTimeout(renderRetirement, 180);
    }
  };
  el("retirement-export").onclick = () => void openSaves();
}
function renderTravel() {
  const m = view?.mobility;
  if (!m) return;
  beginPanel("travel");
  shell(
    "DARAMCIK ulaşım",
    `<p class="note">${esc(m.weather.label)} · ${m.speed}× zaman${m.trip ? `<br>Otobüstesin · ${m.trip.remainingMinutes} oyun dakikası kaldı` : ""}</p><label>Zaman akışı<select id="time-speed">${[0.5, 1, 2].map((n) => `<option value="${n}" ${n === m.speed ? "selected" : ""}>${n}×</option>`).join("")}</select></label><h3 class="section">Mahalle otobüsü</h3><p>Bir durağa yürü; diğer durak için bilet al. Yolculuk sırasında yürüyemezsin.</p><div class="rows">${m.stops.map((stop) => `<article class="row"><div><h3>${esc(stop.name)}</h3><p>${money(stop.fare)} · ${stop.minutes} oyun dakikası${stop.nearby ? " · Bu duraktasın" : ""}</p></div><div class="actions"><button data-point="${stop.point.x},${stop.point.y}">Durağa yürü</button><button data-ride="${stop.id}" ${stop.nearby || m.trip ? "disabled" : ""}>Bilet al</button></div></article>`).join("")}</div><h3 class="section">Araç kiralama</h3><p>Kiralık aracın park ettiği yere yürü; sözleşme aracın yanında yapılır. Başlangıç aracı mahalle emanetidir; kiralık aracın ayrı sözleşmesi vardır.</p><div class="rows">${m.rentals.map((r) => `<article class="row"><div><h3>${esc(r.name)}</h3><p>${money(r.dailyFee)}/gün · ${money(r.deposit)} depozito<br>${r.status === "available" ? "Müsait" : r.status === "overdue" ? "Süre doldu; iade bekleniyor" : "Sözleşme sürüyor"}</p></div><div class="actions"><button data-point="${r.location.x},${r.location.y}">Araca yürü</button><button data-rental="${r.vehicleId}" data-action="${r.status === "available" ? "RENT_VEHICLE" : "RETURN_RENTAL"}">${r.status === "available" ? "1 gün kirala" : "Aracı iade et"}</button></div></article>`).join("")}</div><h3 class="section">Otoparklar</h3><div class="rows">${m.parking.map((lot) => `<article class="row"><div><h3>${esc(lot.name)}</h3><p>${lot.available}/${lot.capacity} boş yer</p></div><div class="actions"><button data-point="${lot.point.x},${lot.point.y}">Yerini göster / yürü</button><button data-park="${lot.id}" ${!view!.player.vehicleId ? "disabled" : ""}>Buraya park et</button></div></article>`).join("")}</div>`,
  );
  bindGo();
  el<HTMLSelectElement>("time-speed").onchange = async (e) => {
    await act("SET_TIME_SPEED", { speed: Number((e.target as HTMLSelectElement).value) });
    setTimeout(renderTravel, 180);
  };
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-point]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const [x, y] = b.dataset.point!.split(",").map(Number);
          if (view?.player.vehicleId) {
            toast("Park yerine aracı kendin sürmelisin.");
            return;
          }
          closePanel();
          await act("MOVE_TO", { x, y });
        }),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-ride]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const r = await act("TRANSIT_RIDE", { stopId: b.dataset.ride });
          if (r.ok) closePanel();
        }),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-rental]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          await act(b.dataset.action!, { vehicleId: b.dataset.rental, days: 1 });
          setTimeout(renderTravel, 180);
        }),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-park]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          await act("PARK_VEHICLE", { parkingId: b.dataset.park });
          setTimeout(renderTravel, 180);
        }),
    );
}

function renderLife() {
  const life = view?.life;
  if (!life) {
    toast("Hayat bilgileri yükleniyor.");
    return;
  }
  const h = life.household;
  const withdrawal = Math.min(10000, h.ownContribution, h.funds);
  const rentPayment = Math.min(10000, h.arrears, view!.balance);
  beginPanel("life");
  shell(
    "Ev, aile & eğitim",
    `<p class="note">${esc(h.homeName)}<br>${h.memberNames.map(esc).join(" · ")}<br>Haftalık kira ${money(h.rent)} · Gecikmiş kira ${money(h.arrears)}${life.partnership ? `<br>${esc(life.partnership.partnerName)} ile ${life.partnership.status === "married" ? "evli" : "ilişkide"}` : ""}</p>
  <h3 class="section">Hayatına bakış</h3><p>${view!.player.age} yaş · ${view!.progression?.shiftsCompleted ?? 0} vardiya · ${view!.player.reputation} itibar · ${life.certificateNames.length} sertifika</p><button data-retirement>${view!.progression?.retired ? "Hayata dön" : "Emeklilik özetini aç"}</button><h3 class="section">Ortak bütçe</h3><p>Hane parası ${money(h.funds)} · Kendi payın ${money(h.ownContribution)}</p><div class="grid"><button data-life="HOUSEHOLD_DEPOSIT">100 ₺ katkı yap</button><button data-life="HOUSEHOLD_WITHDRAW" ${withdrawal <= 0 ? "disabled" : ""}>Kendi payından ${money(withdrawal)} al</button><button data-life="PAY_RENT_ARREARS" ${rentPayment <= 0 ? "disabled" : ""}>${money(rentPayment)} kira borcu öde</button><button data-life="REQUEST_AID">Geçim desteğine başvur</button></div><p class="muted">Konut işlemleri evde, bankada veya kooperatifte; destek klinikte veya dayanışma merkezinde yapılır.</p>
  <h3 class="section">Konut seçenekleri</h3><div class="rows">${life.properties.map((p) => `<article class="row"><div><h3>${esc(p.name)}</h3><p>${p.capacity} kişilik · ${money(p.weeklyRent)} / hafta<br>${p.occupantHouseholdId === h.id ? "Mevcut evin" : p.reservation?.householdId === h.id ? "Senin için ayrıldı" : "Uygun konut"}</p></div><div class="actions">${p.occupantHouseholdId !== h.id ? `<button data-property="${p.id}" data-action="RESERVE_HOME">Yer ayır</button><button data-property="${p.id}" data-action="LEASE_HOME">${p.ownerId === "player" ? "Taşın" : "Kirala · " + money(p.weeklyRent) + " depozito"}</button>` : ""}${p.ownerId !== "player" ? `<button data-property="${p.id}" data-action="PROPERTY_BUY">Satın al · ${money(p.askingPrice)}</button>` : "<small>Mülk senin</small>"}</div></article>`).join("")}</div>
  <h3 class="section">Aile & bakım</h3><p>Çocuklar yalnız eğitim ve bakım düzenine katılır. Aile kararları karşılıklı onay ve uygun konut gerektirir.</p><button data-family="REQUEST_CHILD" ${!life.canRequestChild ? "disabled" : ""}>Ailemizi büyütmeyi konuş</button><div class="rows">${life.children
    .map(
      (c) =>
        `<article class="row"><div><h3>${esc(c.name)} · ${c.age} yaş</h3><p>Bakım: ${c.guardianNames.map(esc).join(", ")}</p><label>Yeni vasi<select id="guardian-${c.id}"><option value="player">Ben</option>${view!.npcs
          .filter((n) => n.alive && n.age >= 18)
          .map((n) => `<option value="${n.id}">${esc(n.name)}</option>`)
          .join(
            "",
          )}<option value="municipality">Belediye bakım desteği</option></select></label></div><button data-guardian-child="${c.id}">Vasi olarak belirle</button></article>`,
    )
    .join(
      "",
    )}</div>${life.estates.length ? `<h3 class="section">Miras kayıtları</h3><div class="rows">${life.estates.map((e) => `<article class="row"><p>${esc(e.personName)} · ${esc(e.status)}<br>Hesabına aktarılan ${money(e.receivedCash)} · ${e.assetIds.length} varlık</p></article>`).join("")}</div>` : ""}<div class="rows">${life.familyEvents
    .slice(-5)
    .map((e) => `<p class="muted">${esc(e)}</p>`)
    .join(
      "",
    )}</div><h3 class="section">Ufuk Akademi sertifikaları</h3><p class="note">İş açan sertifikalar için üç ayrı derse katıl. Dersten ayrılmak devam sayılmaz.</p><div class="rows">${life.courses.map((c) => `<article class="row"><div><h3>${esc(c.name)}</h3><p>${money(c.fee)} toplam · ${c.requiredSessions} × ${c.sessionMinutes} oyun dakikası<br>${c.certified ? "Belge alındı" : c.enrollment ? (c.enrollment.status === "cancelled" ? "Kayıt iptal edildi" : `${c.enrollment.attended}/${c.requiredSessions} ders · ${c.enrollment.activeUntil ? "Ders sürüyor" : c.enrollment.nextSessionAt > view!.minute ? "Sonraki derse " + (c.enrollment.nextSessionAt - view!.minute) + " oyun dakikası" : "Sonraki ders hazır"}`) : "Kayıt açık"}</p></div><div class="actions">${c.certified ? "" : !c.enrollment || c.enrollment.status === "cancelled" ? `<button data-course="${c.id}" data-action="COURSE_ENROLL">Kayıt ol</button>` : `<button data-course="${c.id}" data-action="COURSE_ATTEND">Derse katıl</button><button data-course="${c.id}" data-action="COURSE_CANCEL">Kaydı bırak</button>`}<button data-go="b-school">Akademiye git</button></div></article>`).join("")}</div>`,
  );
  bindGo();
  const refresh = () => setTimeout(renderLife, 180);
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-family]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          await act(b.dataset.family!);
          refresh();
        }),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-guardian-child]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          await act("ASSIGN_GUARDIAN", {
            childId: b.dataset.guardianChild,
            guardianId: el<HTMLSelectElement>("guardian-" + b.dataset.guardianChild).value,
          });
          refresh();
        }),
    );
  const retirementButton = el("panel").querySelector<HTMLButtonElement>("[data-retirement]");
  if (retirementButton) retirementButton.onclick = () => renderRetirement();
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-life]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          await act(b.dataset.life!, {
            amount:
              b.dataset.life === "HOUSEHOLD_WITHDRAW"
                ? withdrawal
                : b.dataset.life === "PAY_RENT_ARREARS"
                  ? rentPayment
                  : 10000,
          });
          refresh();
        }),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-property]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          await act(b.dataset.action!, { propertyId: b.dataset.property });
          refresh();
        }),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-course]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const r = await act(b.dataset.action!, { courseId: b.dataset.course });
          if (r.ok && b.dataset.action === "COURSE_ATTEND") closePanel();
          else refresh();
        }),
    );
}
function renderMissions() {
  shell(
    "Mahallenin fırsatları",
    `<p class="note">Fırsatlar işletmelerin ve komşuların gerçek ihtiyaçlarından doğar. Son teslim tarihini ve gerekli koşulları takip et.</p><div class="rows">${
      view!.quests
        .filter((q) => q.status !== "expired")
        .slice(-18)
        .reverse()
        .map(
          (q) =>
            `<article class="row"><div><small>${esc(statusName(q.status))} · ${money(q.reward)}</small><h3>${esc(districtText(q.title))}</h3><p>${esc(districtText(q.description))}</p><p>${q.progress}/${q.required} · Son gün ${Math.floor(q.deadline / 1440) + 1}</p></div><div class="actions">${q.status === "offered" ? `<button data-accept="${q.id}">Üstlen</button><button data-decline="${q.id}">Reddet</button>` : ""}${q.status === "active" ? `<button data-go="${q.buildingId}">Hedefe git</button><button data-complete="${q.id}">Teslim et</button>` : ""}</div></article>`,
        )
        .join("") || "<p>Şimdilik açık fırsat yok. Bir süre sonra telefonunu tekrar kontrol et.</p>"
    }</div>`,
  );
  bindGo();
  for (const [attr, type] of [
    ["accept", "ACCEPT_QUEST"],
    ["complete", "COMPLETE_QUEST"],
    ["decline", "DECLINE_QUEST"],
  ])
    el("panel")
      .querySelectorAll<HTMLButtonElement>(`[data-${attr}]`)
      .forEach(
        (b) =>
          (b.onclick = async () => {
            await act(type, { questId: b.dataset[attr] });
            setTimeout(renderMissions, 150);
          }),
      );
}
async function interact() {
  if (!view) return;
  if (view.player.vehicleId) {
    await act("VEHICLE_EXIT");
    return;
  }
  const target = nearby();
  if (!target) {
    toast("Etkileşim için biraz daha yaklaş.");
    return;
  }
  if (target.kind === "exit") {
    await act("EXIT");
    return;
  }
  if (target.kind === "vehicle") {
    await act("VEHICLE_ENTER", { vehicleId: target.id });
    return;
  }
  if (target.kind === "person") {
    selected = target.id;
    beginPanel("person");
    showPerson(view.npcs.find((n) => n.id === selected)!);
    return;
  }
  if (target.kind === "building") {
    const r = await act("ENTER", { buildingId: target.id });
    if (r.ok) {
      selected = target.id;
      beginPanel("building");
      setTimeout(() => showBuilding(selected), 120);
    }
  }
}
function attack(heavy: boolean) {
  const n = nearby();
  if (n?.kind === "person") void act("ATTACK", { npcId: n.id, heavy });
  else toast("Dövüş için hedefe yaklaş.");
}
function showPerson(n: Person) {
  const rel = view!.relations.find((r) => r.from === n.id && r.to === "player");
  shell(
    n.name,
    `<small>${esc(statusName(n.goal))} · ${esc(JOBS.find((j) => j.id === n.jobId)?.name ?? "Kendi yolunda")} · Güven ${rel?.trust ?? 0}</small><p class="dialogue">“${esc(n.memories.length ? "Mahallede olanları unutmak kolay değil. Senin de anlatacakların vardır." : "Yeni bir yüz görmek güzel. DARAMCIK küçük; yollarımız yine kesişir.")}”</p><div class="grid"><button data-topic="greet">Selam ver / sohbet et</button><button data-topic="help">Yardım teklif et</button><button data-topic="askJob">İş sor</button><button data-topic="insult" class="danger">Ters konuş</button><button data-topic="date">Buluşma teklif et</button><button data-topic="marry">Evlilik teklif et</button><button data-topic="separate">İlişkiyi sonlandır</button></div>${
      view!.social?.memories.length
        ? `<h3 class="section">Duyduklarını paylaş</h3><label>Bir anı seç<select id="rumor-event">${view!.social.memories
            .slice(-8)
            .reverse()
            .map(
              (m) =>
                `<option value="${m.eventId}">${esc(districtText(m.text.slice(0, 100)))} · ${m.confidence}%</option>`,
            )
            .join("")}</select></label><button id="share-rumor">Kaynağını belirterek anlat</button>`
        : ""
    }<p class="section">Her sözün bir karşılığı var.</p><button id="challenge" class="danger">Saldır · suç ve yaralanma riski</button>`,
  );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-topic]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const topic = b.dataset.topic!;
          const lifeCommand = (
            { date: "ASK_DATE", marry: "PROPOSE_MARRIAGE", separate: "SEPARATE" } as Record<
              string,
              string
            >
          )[topic];
          const dialog = el("close-panel");
          b.disabled = true;
          try {
            const r = await act(lifeCommand ?? "TALK", { npcId: n.id, topic });
            if (r.ok && dialog === el("close-panel")) closePanel();
          } finally {
            b.disabled = false;
          }
        }),
    );
  if (el("share-rumor"))
    el("share-rumor").onclick = () =>
      void act("SHARE_RUMOR", { npcId: n.id, eventId: el<HTMLSelectElement>("rumor-event").value });
  el("challenge").onclick = async () => {
    closePanel();
    await act("ATTACK", { npcId: n.id });
  };
}
function showBuilding(id: string) {
  if (!view) return;
  const b = BUILDINGS.find((b) => b.id === id),
    business = view.businesses.find((x) => x.buildingId === id),
    jobs = JOBS.filter((j) => j.businessId === business?.id);
  let body = `<p class="note">${esc(b?.name ?? "Mekân")} · ${business?.status === "distressed" ? "İşletme zor durumda; ücretler baskı altında." : "Mahalle hayatı burada devam ediyor."}</p>`;
  const service = view.economy?.services.find((s) => s.businessId === business?.id);
  if (service) {
    const hour = (v: number) =>
      `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
    body += `<p class="note">Tezgâh ${service.open ? "açık" : "kapalı"} · ${hour(service.opens)}–${hour(service.closes)} · Sırada ${service.waiting} kişi. Sıra ilerlerken mahallede zaman akmaya devam eder.</p>`;
  }
  if (business)
    body += `<div class="rows">${Object.entries(business.stock)
      .map(
        ([item, q]) =>
          `<div class="row"><div><h3>${esc(itemName(item))}</h3><p>${money(business.prices[item] ?? 0)} · Stok ${q}</p></div><button data-buy="${item}" ${q <= 0 ? "disabled" : ""}>Satın al</button></div>`,
      )
      .join("")}</div>`;
  if (business && service?.open && view.player.location.scene === id) {
    const available = Object.entries(business.stock).filter(
      ([kind, count]) => count > 0 && Object.hasOwn(ITEMS, kind),
    );
    if (available.length && business.ownerId !== "player")
      body += `<details><summary>Ödemeden almak</summary><p>Bu ürün raftan eksilir. Seni gören biri olayı polise bildirebilir.</p><label>Raftaki ürün<select id="unpaid-item">${available.map(([k]) => `<option value="${esc(k)}">${esc(itemName(k))}</option>`).join("")}</select></label><button id="take-stock">Bir tane ödemeden al</button></details>`;
    const returns = (view.crimes ?? []).filter(
      (c) =>
        c.propertyLoss?.businessId === business.id &&
        c.propertyLoss.returnedTick === null &&
        view!.progression?.items[c.propertyLoss.kind]?.some((i) => i.id === c.propertyLoss!.itemId),
    );
    if (returns.length)
      body += `<h3 class="section">Malı geri ver</h3><p>Aldığın eşyayı aynı dükkâna geri koyabilirsin. Daha önce verilmiş bir tanık ifadesi geçerliliğini korur.</p>${returns.map((c) => `<button data-give-back="${esc(c.id)}">${esc(itemName(c.propertyLoss!.kind))} geri ver</button>`).join("")}`;
  }
  if (jobs.length)
    body += `<h3 class="section">İş & kariyer</h3><div class="rows">${jobs.map((j) => `<div class="row"><div><h3>${esc(j.name)}</h3><p>${money(j.wage)} taban ücret · ${j.duration} dk</p></div><button data-job="${j.id}">Başvur</button></div>`).join("")}<button id="shift" class="primary">Vardiyaya başla</button><button id="quit-job">İşten ayrıl</button></div>`;
  if (view.player.shift && view.player.shift.businessId === business?.id)
    body += `<p class="note">Vardiya ücreti: ${money(view.player.shift.wage)} · Kalan süre: ${Math.max(0, view.player.shift.endsAt - view.minute)} oyun dakikası</p>`;
  const order =
    view.player.shift?.businessId === business?.id ? view.player.shift?.order : undefined;
  if (order === "retail" || order === "mechanic")
    body += `<h3 class="section">Vardiya defteri</h3><p>${order === "retail" ? "Stoku düşük bir komşu işletmeye en fazla altı simit gönder. Ödemeyi alıcı karşılar." : "Atölye bütçesinden metal alıp satılabilir parça işle. Her parça için bir birim metal gerekir."}</p>${(order ===
    "retail"
      ? [
          ["tea", "Çayevine gönder"],
          ["restaurant", "Lokantaya gönder"],
        ]
      : [
          ["single", "Bir parça işle"],
          ["batch", "Üç parça işle"],
        ]
    )
      .map(([v, label]) => `<button data-work-order="${v}">${label}</button>`)
      .join("")}`;
  else if (order === "done")
    body += '<p class="note">İş emri tamamlandı. Ücretin vardiya sonunda ödenir.</p>';
  if (id === "b-home" || id === "b-clinic")
    body += '<h3 class="section">Dinlenme</h3><button id="rest">Dinlen ve toparlan</button>';
  if (id === "b-school" || id === "b-garage")
    body += `<h3 class="section">Eğitim · 25 ₺ / 20 dakika</h3><div class="grid">${(id === "b-school" ? ["academic", "technical", "communication", "trade", "driving", "combat"] : ["technical"]).map((skill) => `<button data-train="${skill}">${skillName(skill)} dersi</button>`).join("")}</div>`;
  if (id === "b-bank")
    body +=
      '<h3 class="section">Borç sözleşmesi</h3><p class="note">Oyun içi kredi: haftalık %1 faiz; tekrar borçlanma sınırı uygulanır.</p><div class="grid"><button id="borrow">500 ₺ borç al</button><button id="repay">500 ₺ geri öde</button></div>';
  if (business)
    body += `<h3 class="section">İşletme</h3><button id="acquire">İşletmeyi devral · ${money(business.status === "distressed" ? 600000 : 1200000)}</button>`;
  if (id === "b-security")
    body +=
      '<h3 class="section">Geçim güvencesi</h3><button id="support">Dayanışma desteğine başvur</button>';
  if (id === "b-police")
    body += `<h3 class="section">Polis dosyaları</h3><p class="note">Yalnızca bildiğin, tanık kaydı bulunan olaylar için ifade verebilirsin.</p><div class="rows">${(
      view.crimes ?? []
    )
      .filter((c) => c.status !== "resolved")
      .map(
        (c) =>
          `<div class="row"><p>${c.witnesses.length} tanık · ${c.reported ? "Bildirildi" : "Henüz bildirilmedi"}</p><button data-report="${c.id}">İfade ver</button></div>`,
      )
      .join("")}</div><button id="surrender">Teslim ol / dosyayı sonuçlandır</button>`;
  if (id === "b-police" && view.social) {
    const police = view.social.police;
    body += `<h3 class="section">Başvurularım & soruşturmalar</h3><p class="note">${police.activeDispatches}/${police.capacity} ekip görevde. Beyan, delille doğrulanana kadar iddiadır.${police.custody ? `<br>İfade işlemin sürüyor: ${Math.max(0, police.custody.releaseAt - view.minute)} oyun dakikası.` : ""}</p><div class="rows">${police.cases.map((c) => `<article class="row"><div><h3>${esc(statusName(c.status))}</h3><p>${esc(c.knownSuspectName ?? "Şüpheli henüz bilinmiyor")} · ${c.knownEvidence.length} doğrulanmış kayıt${c.outcome ? "<br>" + esc(c.outcome) : ""}</p></div><div class="actions"><button data-case="${c.id}" data-action="POLICE_REVIEW">Dosyayı incelet</button><button data-case="${c.id}" data-action="POLICE_ATTEND">İfade işlemine katıl</button></div></article>`).join("")}</div><h3 class="section">Beyan kaydı</h3><p>Bir iddiayı iletmek, kişiyi suçlu yapmaz. Çelişen beyanlar güvenilirliğini etkiler.</p>${(
      view.crimes ?? []
    )
      .map(
        (c) =>
          `<div class="row"><label>Şüphelendiğin kişi<select id="accused-${c.id}"><option value="player">Ben</option>${view!.npcs
            .filter((n) => n.alive && n.age >= 18)
            .map((n) => `<option value="${n.id}">${esc(n.name)}</option>`)
            .join("")}</select></label><button data-testimony="${c.id}">Beyan sun</button></div>`,
      )
      .join("")}`;
  }
  if (["b-home", "b-school", "b-bank", "b-office"].includes(id))
    body +=
      '<h3 class="section">Hayatını kur</h3><button id="open-life">Konut, ortak bütçe & sertifikalar</button>';
  body += '<h3 class="section">Sokağa dön</h3><button id="leave-building">Kapıdan çık</button>';
  shell(b?.name ?? "Mekân", body);
  const refreshProperty = async (
    button: HTMLButtonElement,
    type: string,
    args: Record<string, unknown>,
  ) => {
    button.disabled = true;
    try {
      await act(type, args);
      // A command reply and a projection are separate messages. Refresh only this still-open panel.
      setTimeout(() => {
        if (selected === id && panel === "building") showBuilding(id);
      }, 150);
    } finally {
      button.disabled = false;
    }
  };
  const take = el<HTMLButtonElement>("take-stock");
  if (take)
    take.onclick = () =>
      void refreshProperty(take, "TAKE_STOCK", {
        businessId: business!.id,
        item: el<HTMLSelectElement>("unpaid-item").value,
      });
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-give-back]")
    .forEach(
      (btn) =>
        (btn.onclick = () =>
          void refreshProperty(btn, "RETURN_STOCK", {
            businessId: business!.id,
            crimeId: btn.dataset.giveBack,
          })),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-buy]")
    .forEach(
      (btn) =>
        (btn.onclick = async () => {
          await act("BUY", { businessId: business!.id, item: btn.dataset.buy, quantity: 1 });
          setTimeout(() => showBuilding(id), 150);
        }),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-job]")
    .forEach((btn) => (btn.onclick = () => void act("APPLY_JOB", { jobId: btn.dataset.job })));
  const bind = (id: string, type: string, args: Record<string, unknown> = {}, close = false) => {
    const button = el(id);
    if (button)
      button.onclick = async () => {
        const r = await act(type, args);
        if (close && r.ok) closePanel();
      };
  };
  const shiftButton = el<HTMLButtonElement>("shift");
  if (shiftButton) {
    shiftButton.disabled = Boolean(view.player.shift);
    shiftButton.onclick = async () => {
      if (["retail", "mechanic"].includes(view?.player.jobId ?? "")) {
        await refreshProperty(shiftButton, "START_SHIFT", { workOrder: true });
      } else if ((await act("START_SHIFT")).ok) closePanel();
    };
  }
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-work-order]")
    .forEach(
      (btn) =>
        (btn.onclick = () =>
          void refreshProperty(btn, "FINISH_WORK_ORDER", { choice: btn.dataset.workOrder })),
    );
  bind("quit-job", "QUIT_JOB");
  bind("rest", "REST", {}, true);
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-train]")
    .forEach((btn) => (btn.onclick = () => void act("TRAIN", { skill: btn.dataset.train })));
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-report]")
    .forEach((btn) => (btn.onclick = () => void act("REPORT", { crimeId: btn.dataset.report })));
  bind("support", "REQUEST_AID");
  if (el("open-life")) el("open-life").onclick = renderLife;
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-case]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const r = await act(b.dataset.action!, { caseId: b.dataset.case });
          if (r.ok && b.dataset.action === "POLICE_ATTEND") closePanel();
          else setTimeout(() => showBuilding(id), 180);
        }),
    );
  el("panel")
    .querySelectorAll<HTMLButtonElement>("[data-testimony]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          await act("FILE_TESTIMONY", {
            crimeId: b.dataset.testimony,
            accusedId: el<HTMLSelectElement>("accused-" + b.dataset.testimony).value,
          });
          setTimeout(() => showBuilding(id), 180);
        }),
    );
  bind("surrender", "SURRENDER");
  bind("borrow", "BORROW", { amount: 50000 });
  bind("repay", "REPAY", { amount: 50000 });
  bind("acquire", "BUY_BUSINESS", { businessId: business?.id });
  bind("leave-building", "EXIT", {}, true);
}
async function openSaves() {
  beginPanel("saves");
  paused = true;
  setPause();
  let slots: Awaited<ReturnType<typeof db.list>> = [];
  try {
    slots = await db.list();
  } catch (e) {
    toast((e as Error).message);
  }
  shell(
    "Kayıtlar",
    `<p class="note">Üç kişisel slot ve ayrı otomatik kayıt. Son sağlam sürüm korunur. Dışa aktarma ile başka tarayıcıya taşıyabilirsin.</p><div class="rows">${SLOT_IDS.map(
      (id) => {
        const s = slots.find((s) => s.slotId === id);
        return `<div class="row slot"><div><h3>${id === "auto" ? "Otomatik kayıt" : `Kayıt ${id.slice(-1)}`}</h3><p>${s ? `${new Date(s.updatedAt).toLocaleString("tr-TR")} · ${Math.floor(s.tick / 14400) + 1}. gün` : "Boş slot"}</p></div><div class="actions"><button data-save="${id}" ${!view ? "disabled" : ""}>Kaydet</button><button data-load="${id}" ${!s ? "disabled" : ""}>Yükle</button><button data-export="${id}" ${!s ? "disabled" : ""}>Dışa aktar</button><button data-copy="${id}" ${!s ? "disabled" : ""}>Kopyala</button><button data-delete="${id}" ${!s ? "disabled" : ""}>Sil</button><button data-import="${id}">İçe aktar</button></div></div>`;
      },
    ).join(
      "",
    )}</div><input id="import-file" type="file" accept="application/json,.json" class="hidden">`,
  );
  for (const type of ["save", "load", "export", "copy", "delete", "import"])
    el("panel")
      .querySelectorAll<HTMLButtonElement>(`[data-${type}]`)
      .forEach(
        (btn) =>
          (btn.onclick = async () => {
            const id = btn.dataset[type]!;
            try {
              if (type === "save") {
                await save(id);
                await openSaves();
              }
              if (type === "load") {
                await loadSlot(id);
              }
              if (type === "export") {
                download(await db.export(id), `social-engine-${id}.json`);
              }
              if (type === "delete") {
                if (confirm("Bu slot silinsin mi? Diğer slotlar korunur.")) {
                  if (id === "auto") await stopJournal();
                  await db.delete(id);
                  await openSaves();
                }
              }
              if (type === "copy") {
                const target = SLOT_IDS.find((s) => s !== id && !slots.some((x) => x.slotId === s));
                if (!target) {
                  toast("Kopyalamak için boş bir slot gerekli.");
                  return;
                }
                if (target === "auto") await stopJournal();
                await db.copy(id, target);
                await openSaves();
              }
              if (type === "import") {
                const input = el<HTMLInputElement>("import-file");
                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 20_000_000) throw new Error("Dosya 20 MB sınırını aşıyor.");
                    if (
                      slots.some((s) => s.slotId === id) &&
                      !confirm(
                        "Bu slota doğrulanmış dosya aktarılsın mı? Önceki sağlam sürüm korunur.",
                      )
                    )
                      return;
                    if (id === "auto") await stopJournal();
                    await db.import(id, await file.text());
                    await openSaves();
                  } catch (e) {
                    toast((e as Error).message);
                  }
                };
                input.click();
              }
            } catch (e) {
              toast((e as Error).message);
            }
          }),
      );
}
function download(text: string, name: string) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showSettings() {
  shell(
    "Erişilebilirlik & kontroller",
    `<div class="rows"><label>Arayüz ölçeği<select id="ui-scale">${[100, 125, 150, 200].map((n) => `<option ${settings.scale === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><label><span><input id="reduced" type="checkbox" ${settings.reduced ? "checked" : ""} style="width:auto;min-height:auto"> Hareket efektlerini azalt</span></label><label><span><input id="contrast" type="checkbox" ${settings.contrast ? "checked" : ""} style="width:auto;min-height:auto"> Yüksek kontrast</span></label></div><h3 class="section">Kısayollar</h3><div class="controls-table">${(["interact", "inventory", "map", "phone"] as const).map((k) => `<label>${{ interact: "Etkileşim", inventory: "Çanta", map: "Harita", phone: "Telefon" }[k]}<input data-key="${k}" value="${prettyKey(settings[k])}" readonly aria-label="${k} için tuşa bas"></label>`).join("")}</div><p class="note">Gerçek zamanlı dünya görsel bir tuvaldir. Menü ve işlemler klavye ile kullanılabilir; dünya hareketi tam ekran okuyucu desteği sunmaz.</p>`,
  );
  el("ui-scale").onchange = () => {
    settings.scale = Number(el<HTMLSelectElement>("ui-scale").value);
    applySettings();
  };
  for (const k of ["reduced", "contrast"] as const)
    el(k).onchange = () => {
      settings[k] = el<HTMLInputElement>(k).checked;
      applySettings();
    };
  el("panel")
    .querySelectorAll<HTMLInputElement>("[data-key]")
    .forEach(
      (input) =>
        (input.onkeydown = (e) => {
          if (e.code === "Tab" || e.code === "Escape") return;
          e.preventDefault();
          if (!configurableKey(e.code)) {
            toast("Bu tuş hareket veya gezinme için ayrılmış.");
            return;
          }
          const k = input.dataset.key as "interact";
          if (Object.values(settings).includes(e.code) && settings[k] !== e.code) {
            toast("Bu tuş başka bir eyleme atanmış.");
            return;
          }
          settings[k] = e.code;
          input.value = prettyKey(e.code);
          applySettings();
        }),
    );
}
function showHelp() {
  shell(
    "DARAMCIK rehberi",
    `<div class="rows"><article><h3>01 / Yolunu bul</h3><p>WASD ve ok tuşları ekrandaki yönlerde hareket eder. Shift koşar. Yürünebilir yere tıklayabilir veya M haritasından mekân seçebilirsin. Tekerlek zoom yapar.</p></article><article><h3>02 / Geçimini kur</h3><p>İş yerine gir, başvur ve vardiyaya başla. İşletme bütçesi ücretleri etkiler. İş değiştirerek, eğitim alarak ve esnafla bağ kurarak ilerle.</p></article><article><h3>03 / Bağ kur</h3><p>Yakındaki yetişkin komşuna E ile selam ver. Yardım güveni artırır; hakaret ve şiddet kalıcı sonuçlar doğurur. Telefonunda ilişkileri ve mahalle olaylarını izle.</p></article><article><h3>04 / Sonuçları yaşa</h3><p>F hafif saldırı, G ağır saldırı, B blok, Boşluk kaçınma, T teslim olma. Tanıklar ve deliller polis takibini başlatabilir. Araçta W/S gaz/fren, A/D kavşakta yön seçme, E inme. Kavşak ışıkları yönlere sırayla yol verir; dolu geçitte ve yayaların önünde araç bekler. Yasal kariyerle de gelişebilirsin.</p></article><article><h3>05 / Yarına hazırlan</h3><p>Çantandan yiyecek kullan, evde dinlen, görevleri süresinde teslim et. Her dakika otomatik kayıt; Esc menüsünde kişisel slotlar ve dışa aktarım.</p></article></div>`,
  );
}
function motion() {
  if (!view || !worker || paused || hidden || panel) return;
  const x =
      Number(keyState.has("KeyD") || keyState.has("ArrowRight")) -
      Number(keyState.has("KeyA") || keyState.has("ArrowLeft")),
    y =
      Number(keyState.has("KeyS") || keyState.has("ArrowDown")) -
      Number(keyState.has("KeyW") || keyState.has("ArrowUp"));
  const args = view.player.vehicleId
    ? { throttle: -y, steer: x }
    : {
        x: (x + y) / Math.max(1, Math.abs(x + y), Math.abs(y - x)),
        y: (y - x) / Math.max(1, Math.abs(x + y), Math.abs(y - x)),
        sprint: keyState.has("ShiftLeft") || keyState.has("ShiftRight"),
      };
  const next = JSON.stringify(args);
  if (next !== lastMotion) {
    lastMotion = next;
    void command(view.player.vehicleId ? "DRIVE" : "MOVE", args);
  }
}
document.addEventListener("keydown", (e) => {
  if (e.code === "Tab" && panel) {
    const focusables = [
      ...el("panel").querySelectorAll<HTMLElement>(
        'button:not(:disabled),input,select,[tabindex="0"]',
      ),
    ];
    const index = focusables.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && index <= 0) {
      e.preventDefault();
      focusables.at(-1)?.focus();
    } else if (!e.shiftKey && index === focusables.length - 1) {
      e.preventDefault();
      focusables[0]?.focus();
    }
    return;
  }
  if (e.code === "Escape") {
    e.preventDefault();
    if (panel === "fatal") return;
    if (panel) closePanel();
    else void openPanel("pause");
    return;
  }
  if ((e.target as HTMLElement).matches("input,select,textarea")) return;
  if (!view || e.repeat) return;
  const actions: Record<string, () => void> = {
    [settings.interact]: () => void interact(),
    [settings.inventory]: () => void openPanel("inventory"),
    [settings.map]: () => void openPanel("map"),
    [settings.phone]: () => void openPanel("phone"),
    KeyJ: () => void openPanel("missions"),
    KeyF: () => attack(false),
    KeyG: () => attack(true),
    Space: () => void act("DODGE"),
    KeyB: () => void command("BLOCK", { active: true }),
    KeyT: () => void act("SURRENDER"),
  };
  if (actions[e.code] && !panel) {
    e.preventDefault();
    actions[e.code]();
    return;
  }
  if (!panel) {
    keyState.add(e.code);
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    motion();
  }
});
document.addEventListener("keyup", (e) => {
  keyState.delete(e.code);
  if (e.code === "KeyB") void command("BLOCK", { active: false });
  motion();
});
window.addEventListener("blur", () => {
  lastMotion = resetMotionInput(keyState, () => void command("STOP"));
});
document.addEventListener("visibilitychange", () => {
  hidden = document.hidden;
  lastMotion = resetMotionInput(keyState, () => void command("STOP"));
  setPause();
});
window.addEventListener("resize", () => renderer?.resize());
el("world").addEventListener("social-engine-render-error", () => {
  fatal("Görüntü işlemcisi bağlantısı kesildi. Son sağlam kayıttan yeniden başlatabilirsin.");
});
el<HTMLFormElement>("character").onsubmit = (e) => {
  e.preventDefault();
  const data = new FormData(e.currentTarget as HTMLFormElement),
    attributes = {
      body: Number(data.get("body")),
      mind: Number(data.get("mind")),
      social: Number(data.get("social")),
      discipline: Number(data.get("discipline")),
    };
  const name = String(data.get("name") ?? "").trim();
  if (!/^[\p{L}\p{N} '-]{2,24}$/u.test(name)) {
    el("form-error").textContent =
      "Ad 2–24 harf veya rakam içermeli; işaretler ve HTML kabul edilmez.";
    return;
  }
  if (
    Object.values(attributes).some((n) => !Number.isInteger(n) || n < 1 || n > 6) ||
    Object.values(attributes).reduce((a, b) => a + b, 0) !== 12
  ) {
    el("form-error").textContent = "Her özellik 1–6 arasında, toplam tam 12 olmalı.";
    return;
  }
  el("form-error").textContent = "";
  void start({
    name,
    attributes,
    background: data.get("background") as Profile["background"],
    appearance: Number(data.get("appearance")),
  });
};
el("continue").onclick = () => void openSaves();
// The form is parsed before this module and its imports finish loading.
// Keep the entered profile local even if Enter is pressed on a slow first visit.
el<HTMLFormElement>("character").querySelector<HTMLButtonElement>("[type=submit]")!.disabled =
  false;
el<HTMLButtonElement>("continue").disabled = false;
el("boot-status").hidden = true;
function frame(now: number) {
  const dt = now - lastFrame;
  lastFrame = now;
  if (view && !hidden) {
    if (frameSamples++ > 60) {
      perf.frames.push(dt);
      if (perf.frames.length > 120000) perf.frames.shift();
    }
    renderer?.render(view);
    if (now - lastHud > 350 && !panel) {
      lastHud = now;
      hud();
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(() => {
  if (view && !paused && !hidden && liveJournal) void save("auto", true);
}, 60000);
const query = new URLSearchParams(location.search);
if (query.get("qa") === "1") {
  Object.assign(window, {
    __socialEngine: {
      state: () => snapshot(),
      projection: () => view,
      command: act,
      metrics: () => ({
        ...perf,
        renderer: renderer?.metrics(),
        heap: (performance as Performance & { memory?: unknown }).memory,
      }),
      save,
      load: loadSlot,
      journalStatus: () => liveJournal?.status() ?? null,
      flushJournal: () => liveJournal?.checkpoint(),
      pause: (v: boolean) => {
        paused = v;
        setPause();
      },
      step: (count: number) => worker?.postMessage({ v: 1, type: "STEP", count }),
      slots: () => db.list(),
      export: (id: string) => db.export(id),
      import: async (id: string, text: string) => {
        if (id === "auto") await stopJournal();
        return db.import(id, text);
      },
    },
    __controlsTest: {
      getYaw: () => view?.vehicles.find((v) => v.id === view?.player.vehicleId)?.heading ?? 0,
      getSpeed: () => view?.vehicles.find((v) => v.id === view?.player.vehicleId)?.speed ?? 0,
      setKeys: (codes: string[]) => {
        keyState = new Set(codes);
        motion();
      },
    },
  });
}
