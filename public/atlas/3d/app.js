import { notes } from "./content.js";

const $ = (selector) => document.querySelector(selector);
const stage = $("#stage");
const labels = {
  surface: "Yüzey", skeleton: "İskelet", muscular: "Kaslar", nervous: "Sinir sistemi",
  circulatory: "Dolaşım", respiratory: "Solunum", digestive: "Sindirim",
  urinary: "Üriner sistem", lymphatic: "Lenfatik", reproductive: "Üreme anatomisi",
};
const basic2d = { surface: "Yüzey", skeleton: "İskelet grupları", organs: "Büyük organ örnekleri" };
const coreMap = {
  FMA7480: ["skeleton", "thoracic-cage"], FMA7088: ["circulatory", "heart"],
  FMA7309: ["respiratory", "lungs"], FMA7310: ["respiratory", "lungs"],
  FMA7197: ["digestive", "liver"], FMA7148: ["digestive", "stomach"],
  FMA7204: ["urinary", "kidneys"], FMA7205: ["urinary", "kidneys"],
  FMA13295: ["muscular", null],
};
const params = new URL(location.href).searchParams;
let mode = params.get("mode") === "2d" ? "2d" : "3d";
let sex = params.get("variant") === "female" ? "female" : "male";
let core, expansion, foundation, atlasView, atlasState, viewer = null;
let selected = null, loading = false, loaded3d = false, isolated = false, direction = "front";
const enabled3d = new Set(["surface", "skeleton", "muscular", "circulatory", "respiratory"]);
const enabled2d = new Set(["surface", "skeleton", "organs"]);

function structures3d() {
  if (!core) return [];
  const original = sex === "male" ? core.structures.map((s) => ({
    ...s, system: coreMap[s.id][0], twoD: coreMap[s.id][1],
  })) : [];
  return [...original, ...(expansion?.[sex]?.structures || [])].sort((a, b) =>
    Object.keys(labels).indexOf(a.system) - Object.keys(labels).indexOf(b.system)
    || a.name.localeCompare(b.name, "tr"));
}
function saveUrl() {
  const next = new URL(location.href);
  next.searchParams.set("mode", mode);
  next.searchParams.set("variant", sex);
  next.hash = selected ? `structure=${encodeURIComponent(selected)}` : "";
  history.replaceState(null, "", next);
}
function list() {
  const query = $("#search").value.trim().toLocaleLowerCase("tr");
  const all = mode === "2d" ? foundation?.structures || [] : structures3d();
  const shown = all.filter((s) => {
    const name = mode === "2d" ? s.label.tr : s.name;
    const available = mode === "2d" ? enabled2d.has(s.systems[0]) : enabled3d.has(s.system);
    return available && `${name} ${s.english || ""} ${s.id}`.toLocaleLowerCase("tr").includes(query);
  });
  $("#list").replaceChildren(...shown.map((s) => {
    const button = document.createElement("button");
    button.textContent = mode === "2d" ? s.label.tr : s.name;
    button.dataset.id = s.id;
    button.setAttribute("aria-pressed", String(selected === s.id));
    button.onclick = () => select(s.id);
    return button;
  }));
  $("#count").textContent = `${shown.length} / ${all.length} yapı grubu`;
}
function detail() {
  const s = mode === "2d" ? foundation?.structures.find((x) => x.id === selected)
    : structures3d().find((x) => x.id === selected);
  if (!s) {
    $("#detail-system").textContent = "ANATOMİ NOTU";
    $("#detail-name").textContent = "Bir yapı seç.";
    $("#detail-description").textContent = "Görünümdeki bir yapıya veya listedeki adına dokun.";
    $("#detail-id").textContent = "";
    $("#fact-source").hidden = true;
    $("#isolate").disabled = true;
    return;
  }
  let link;
  if (mode === "2d") {
    $("#detail-system").textContent = basic2d[s.systems[0]];
    $("#detail-name").textContent = s.label.tr;
    $("#detail-description").textContent = `${s.description.tr} ${s.function.tr} ${s.location.tr}`;
    $("#detail-id").textContent = `${s.id} · Yaklaşık 2D çizim · Uzman incelemesi yok`;
    link = foundation.sources.find((entry) => entry.id === s.sourceRefs[0])?.url;
  } else {
    $("#detail-system").textContent = labels[s.system];
    $("#detail-name").textContent = s.name;
    const related = foundation.structures.find((entry) => entry.id === s.twoD);
    $("#detail-description").textContent = notes[s.id]?.[0]
      || (related ? `${related.description.tr} ${related.function.tr}`
        : "Kaynak modelden alınan yüzeyler bir grup olarak gösterilir. Sistem içindeki bütün yapılar burada mevcut değildir.");
    $("#detail-id").textContent = `${s.english} · ${s.id} · ${s.sources.length} kaynak yüzey · Uzman incelemesi yok`;
    link = notes[s.id]?.[1] || (related
      ? foundation.sources.find((entry) => entry.id === related.sourceRefs[0])?.url
      : expansion[sex].source);
  }
  $("#fact-source").href = link;
  $("#fact-source").hidden = !link;
  $("#isolate").disabled = mode !== "3d" || !viewer;
}
function select(id) {
  selected = id;
  if (mode === "2d") update2d();
  else viewer?.select(id, isolated);
  detail(); list(); saveUrl();
}
function renderSystems() {
  const all = mode === "2d" ? foundation.systems.map((s) => s.id)
    : Object.keys(labels).filter((id) => structures3d().some((s) => s.system === id));
  const enabled = mode === "2d" ? enabled2d : enabled3d;
  $("#systems").replaceChildren(...all.map((id) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox"; input.dataset.system = id; input.checked = enabled.has(id);
    input.onchange = async () => {
      if (input.checked) enabled.add(id);
      else enabled.delete(id);
      if (mode === "2d") update2d();
      else if (loaded3d) await load3d();
      list(); detail(); coverage();
    };
    const text = document.createElement("span");
    text.textContent = mode === "2d" ? basic2d[id] : labels[id];
    const count = document.createElement("small");
    count.textContent = mode === "2d" && id === "surface" ? "beden konturu"
      : `${mode === "2d"
        ? foundation.structures.filter((s) => s.systems[0] === id).length
        : structures3d().filter((s) => s.system === id).length} grup`;
    label.append(input, text, count);
    return label;
  }));
}
function coverage() {
  const active = structures3d().filter((s) => enabled3d.has(s.system));
  const mb = (active.reduce((total, s) => total + s.bytes, 0) / 1048576).toFixed(1);
  $("#coverage").textContent = mode === "2d"
    ? "2D: kadın/erkek tam vücut çizimi · 13 yaklaşık yapı grubu"
    : sex === "female"
      ? `Kadın: tam vücut yüzeyi, kısmi iç sistemler · Seçili 3D veri ${mb} MB`
      : `Erkek: tam vücut yüzeyi, seçilmiş sistemler · Seçili 3D veri ${mb} MB`;
  $("#scope").textContent = mode === "2d"
    ? "Bu görünüm şematik eğitsel çizimdir; kaynak 3D modelin kesin karşılığı değildir."
    : sex === "female" ? "Kadın kaynak modelinde kol, kafatası ve kaburga iskeleti ile kol/gövde kaslarının çoğu yoktur. Eksiksiz anatomi modeli değildir."
      : "Genişletilmiş kaynak model, bütün anatomik yapıların eksiksiz temsili değildir.";
  const loadButton = $("#load");
  if (loadButton) loadButton.textContent = `3D modeli aç · ${mb} MB`;
}
function update2d() {
  if (!atlasView) return;
  atlasState = {
    variant: sex, view: direction === "back" ? "back" : "front",
    layers: Object.fromEntries(Object.keys(basic2d).map((id) => [id, enabled2d.has(id)])),
    selectedId: selected, zoom: atlasState?.zoom || 1,
    panX: atlasState?.panX || 0, panY: atlasState?.panY || 0,
  };
  atlasView.update(atlasState);
}
async function show2d() {
  viewer?.dispose(); viewer = null; loaded3d = false;
  if (!atlasView) {
    const { createAtlasView } = await import("../yapi/svg-view.js");
    atlasView = createAtlasView({ onSelect: select });
  }
  const previous = structures3d().find((s) => s.id === selected);
  selected = previous?.twoD || (foundation.structures.some((s) => s.id === selected) ? selected : "heart");
  stage.replaceChildren(atlasView.element);
  stage.dataset.mode = "2d";
  $(".explode").hidden = true; $("#isolate").hidden = true; $("#clear").hidden = true;
  $("#offline-system").hidden = true;
  $("#gesture").textContent = "Seç: incele · + / −: yakınlaş · Ön/arka: bakış yönü";
  renderSystems(); update2d(); list(); detail(); coverage(); saveUrl();
}
function show3dPrompt(message = "Büyük geometri istenmeden indirilmez.") {
  stage.dataset.mode = "3d";
  stage.innerHTML = '<div class="loading"><p class="eyebrow">KAYNAKLI / ETKİLEŞİMLİ</p><h2>3D kaynak modeli</h2><p>İstediğin sistemleri seçip modeli aç.</p><button id="load" class="primary">3D modeli aç</button><p id="load-status" role="status"></p></div>';
  $("#load").onclick = load3d;
  $("#load-status").textContent = message;
  $(".explode").hidden = false; $("#isolate").hidden = false; $("#clear").hidden = false;
  $("#offline-system").hidden = false;
  $("#gesture").textContent = "Sürükle: döndür · İki parmak: yakınlaş/kaydır · Tıkla: incele";
  coverage();
}
async function load3d() {
  if (loading) return;
  const chosen = structures3d().filter((s) => enabled3d.has(s.system));
  if (!chosen.length) { show3dPrompt("Önce en az bir sistem seç."); return; }
  loading = true;
  viewer?.dispose(); viewer = null;
  stage.replaceChildren();
  const progress = document.createElement("p");
  progress.className = "model-progress";
  progress.setAttribute("role", "status");
  progress.textContent = "Model dosyaları doğrulanıyor…";
  stage.append(progress);
  try {
    const { createViewer } = await import("./viewer.js");
    viewer = await createViewer(stage, { structures: chosen }, select, (done, total) => {
      progress.textContent = `Geometri: ${done} / ${total}`;
    });
    loaded3d = true;
    isolated = false;
    if (selected && chosen.some((s) => s.id === selected)) viewer.select(selected);
    viewer.explode(Number($("#explode").value));
    if (direction !== "front") viewer.view(direction);
    detail();
  } catch (error) {
    loaded3d = false;
    show3dPrompt(`3D açılamadı: ${error.message}. 2D görünüm kullanılabilir.`);
  } finally { loading = false; }
}
async function setMode(next) {
  if (loading || mode === next) return;
  mode = next;
  $("#mode-3d").setAttribute("aria-pressed", String(mode === "3d"));
  $("#mode-2d").setAttribute("aria-pressed", String(mode === "2d"));
  if (mode === "2d") await show2d();
  else {
    const previous = foundation.structures.find((s) => s.id === selected);
    selected = previous ? structures3d().find((s) => s.twoD === previous.id)?.id || null : selected;
    show3dPrompt(); renderSystems(); list(); detail(); saveUrl();
  }
}
function setSex(next) {
  if (loading || sex === next) return;
  const previous = structures3d().find((s) => s.id === selected);
  sex = next;
  $("#sex-male").setAttribute("aria-pressed", String(sex === "male"));
  $("#sex-female").setAttribute("aria-pressed", String(sex === "female"));
  if (mode === "2d") update2d();
  else {
    selected = previous?.twoD
      ? structures3d().find((s) => s.twoD === previous.twoD)?.id || null : null;
    viewer?.dispose(); viewer = null; loaded3d = false; show3dPrompt();
  }
  renderSystems(); list(); detail(); coverage(); saveUrl();
}

$("#mode-3d").onclick = () => setMode("3d");
$("#mode-2d").onclick = () => setMode("2d");
$("#sex-male").onclick = () => setSex("male");
$("#sex-female").onclick = () => setSex("female");
$("#search").oninput = list;
$("#isolate").onclick = () => {
  isolated = !isolated; viewer?.select(selected, isolated);
  $("#isolate").textContent = isolated ? "Çevresini yeniden göster" : "Yalnız bu yapıyı göster";
};
$("#clear").onclick = () => {
  isolated = false; viewer?.select(selected, false);
  $("#isolate").textContent = "Yalnız bu yapıyı göster";
};
$("#explode").oninput = (event) => {
  $("#amount").textContent = event.target.value + "%";
  viewer?.explode(Number(event.target.value));
};
document.querySelectorAll("[data-view]").forEach((button) => button.onclick = () => {
  direction = button.dataset.view;
  if (mode === "2d") update2d(); else viewer?.view(direction);
});
$("#zoom-in").onclick = () => mode === "2d"
  ? (atlasState.zoom = Math.min(3, atlasState.zoom + .25), update2d()) : viewer?.zoom(.8);
$("#zoom-out").onclick = () => mode === "2d"
  ? (atlasState.zoom = Math.max(1, atlasState.zoom - .25), update2d()) : viewer?.zoom(1.2);
$("#reset").onclick = () => {
  $("#explode").value = 0; $("#amount").textContent = "0%"; direction = "front";
  if (mode === "2d") {
    atlasState.zoom = 1; atlasState.panX = 0; atlasState.panY = 0; update2d();
  } else viewer?.reset();
};

$("#offline").onclick = async () => {
  const button = $("#offline"); button.disabled = true;
  $("#offline-status").textContent = "Temel paket indiriliyor ve doğrulanıyor…";
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    const worker = registration.installing || registration.waiting || registration.active;
    if (!worker) throw Error("Offline hizmeti başlatılamadı");
    if (worker.state !== "activated") await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Zaman aşımı")), 120000);
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") { clearTimeout(timer); resolve(); }
        if (worker.state === "redundant") { clearTimeout(timer); reject(Error("Kurulum başarısız")); }
      });
    });
    const channel = new MessageChannel();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Doğrulama zaman aşımı")), 15000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        if (event.data.ready) resolve();
        else reject(Error("Paket eksik"));
      };
      worker.postMessage("verify", [channel.port2]);
    });
    $("#offline-status").textContent = "Temel atlas paketi offline hazır.";
  } catch (error) { $("#offline-status").textContent = "Offline hazır değil: " + error.message; }
  finally { button.disabled = false; }
};
$("#offline-system").onclick = async () => {
  const button = $("#offline-system"); button.disabled = true;
  $("#offline-status").textContent = "Seçili sistemler indiriliyor…";
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
    if (!registration.active) throw Error("Offline hizmeti etkin değil");
    const channel = new MessageChannel();
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("İndirme zaman aşımı")), 180000);
      channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
      registration.active.postMessage({ type: "cache-system", sex, systems: [...enabled3d] }, [channel.port2]);
    });
    if (!result.ready) throw Error(result.error || "Paket eksik");
    $("#offline-status").textContent = `${result.files} model dosyası doğrulanıp offline saklandı.`;
  } catch (error) { $("#offline-status").textContent = "Sistem paketi hazır değil: " + error.message; }
  finally { button.disabled = false; }
};

try {
  const [basic, extra] = await Promise.all([
    fetch("./models/manifest.json"), fetch("./models/expansion/manifest.json"),
  ]);
  if (!basic.ok || !extra.ok) throw Error("Model kataloğu alınamadı");
  core = await basic.json(); expansion = await extra.json();
  const { FOUNDATION } = await import("../yapi/content.js");
  foundation = FOUNDATION;
  const fromHash = new URLSearchParams(location.hash.slice(1)).get("structure");
  selected = fromHash && (structures3d().some((s) => s.id === fromHash)
    || foundation.structures.some((s) => s.id === fromHash)) ? fromHash : null;
  $("#sex-male").setAttribute("aria-pressed", String(sex === "male"));
  $("#sex-female").setAttribute("aria-pressed", String(sex === "female"));
  if (mode === "2d") await show2d();
  else { show3dPrompt(); renderSystems(); list(); detail(); coverage(); }
} catch (error) {
  $("#coverage").textContent = "Katalog yüklenemedi";
  $("#load-status").textContent = error.message;
  $("#load").disabled = true;
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) { viewer?.dispose(); atlasView?.destroy(); }
});
window.atlas3d = { stats: () => viewer?.stats(), manifest: () => ({ core, expansion }), mode: () => mode };
