import { notes, systems } from "./content.js";
const $ = (s) => document.querySelector(s),
  stage = $("#stage");
let manifest,
  viewer = null,
  selected = null,
  isolated = false;
function list() {
  const q = $("#search").value.trim().toLocaleLowerCase("tr");
  const items = manifest.structures.filter((s) =>
    `${s.name} ${s.english} ${s.id}`.toLocaleLowerCase("tr").includes(q),
  );
  $("#list").replaceChildren(
    ...items.map((s) => {
      const b = document.createElement("button");
      b.textContent = s.name;
      b.dataset.id = s.id;
      b.setAttribute("aria-pressed", String(selected === s.id));
      b.onclick = () => select(s.id);
      return b;
    }),
  );
  $("#count").textContent = `${items.length} / 9 yapı grubu · ${manifest.meshCount} kaynak yüzey`;
}
function select(id) {
  selected = id;
  const s = manifest.structures.find((s) => s.id === id);
  if (!s) return;
  $("#detail-system").textContent = systems[s.system];
  $("#detail-name").textContent = s.name;
  $("#detail-description").textContent = notes[id][0];
  $("#detail-id").textContent = `${s.english} · ${id} · ${s.sources.length} kaynak mesh`;
  $("#fact-source").href = notes[id][1];
  $("#fact-source").hidden = false;
  $("#isolate").disabled = !viewer;
  list();
  viewer?.select(id, isolated);
}
async function load() {
  const button = $("#load");
  button.disabled = true;
  $("#load-status").textContent = "3D motoru ve doğrulanmış parçalar yükleniyor…";
  try {
    const { createViewer } = await import("./viewer.js");
    viewer = await createViewer(
      stage,
      manifest,
      select,
      (n, total) => ($("#load-status").textContent = `Gerçek geometri yükleniyor: ${n} / ${total}`),
    );
    document.body.dataset.ready = "true";
    $("#systems")
      .querySelectorAll("input")
      .forEach((i) => viewer.toggle(i.dataset.system, i.checked));
    if (selected) select(selected);
    viewer.explode(Number($("#explode").value));
  } catch (e) {
    stage.innerHTML =
      '<div class="loading"><h2>3D görünüm açılamadı.</h2><p id="failure"></p><a href="../yapi/">Hafif 2D atlasa geç ↗</a><button id="retry">Yeniden dene</button></div>';
    $("#failure").textContent = e.message;
    $("#retry").onclick = () => location.reload();
    document.body.dataset.ready = "error";
  }
}
$("#load").onclick = load;
$("#search").oninput = () => manifest && list();
$("#isolate").onclick = () => {
  isolated = !isolated;
  viewer?.select(selected, isolated);
  $("#isolate").textContent = isolated ? "Çevresini yeniden göster" : "Yalnız bu yapıyı göster";
};
$("#clear").onclick = () => {
  isolated = false;
  $("#isolate").textContent = "Yalnız bu yapıyı göster";
  viewer?.select(selected, false);
};
$("#systems").onchange = (e) => {
  if (e.target.dataset.system) viewer?.toggle(e.target.dataset.system, e.target.checked);
};
$("#explode").oninput = (e) => {
  $("#amount").textContent = e.target.value + "%";
  viewer?.explode(Number(e.target.value));
};
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => viewer?.view(b.dataset.view)));
$("#zoom-in").onclick = () => viewer?.zoom(0.8);
$("#zoom-out").onclick = () => viewer?.zoom(1.2);
$("#reset").onclick = () => {
  viewer?.reset();
  isolated = false;
  $("#explode").value = 0;
  $("#amount").textContent = "0%";
  document.querySelectorAll("[data-system]").forEach((i) => (i.checked = true));
  if (selected) select(selected);
  $("#isolate").textContent = "Yalnız bu yapıyı göster";
};
$("#offline").onclick = async () => {
  const b = $("#offline");
  b.disabled = true;
  $("#offline-status").textContent = "Paket indiriliyor ve dosyalar doğrulanıyor…";
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    const worker = registration.installing || registration.waiting || registration.active;
    if (!worker) throw new Error("Worker başlatılamadı");
    if (worker.state !== "activated")
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("İndirme zaman aşımı")), 120000);
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") {
            clearTimeout(timeout);
            resolve();
          }
          if (worker.state === "redundant") {
            clearTimeout(timeout);
            reject(new Error("Paket kurulamadı"));
          }
        });
      });
    const channel = new MessageChannel();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Paket doğrulanamadı")), 15000);
      channel.port1.onmessage = (e) => {
        clearTimeout(timer);
        e.data.ready ? resolve() : reject(new Error("Paket eksik"));
      };
      worker.postMessage("verify", [channel.port2]);
    });
    $("#offline-status").textContent =
      "Offline paket hazır. İnternet kapalıyken bu sayfayı yeniden açabilirsin.";
    b.textContent = "Offline paketi doğrula";
  } catch (e) {
    $("#offline-status").textContent = "Offline hazır değil: " + e.message;
  } finally {
    b.disabled = false;
  }
};
try {
  const response = await fetch("./models/manifest.json");
  if (!response.ok) throw new Error("Model listesi alınamadı");
  manifest = await response.json();
  list();
  $("#load").disabled = false;
} catch (e) {
  $("#load-status").textContent = e.message;
  $("#load").disabled = true;
}
window.addEventListener("pagehide", (e) => {
  if (!e.persisted) viewer?.dispose();
});
// Read-only diagnostics for bounded renderer and browser evidence; no user data.
window.atlas3d = { stats: () => viewer?.stats(), manifest: () => manifest };
