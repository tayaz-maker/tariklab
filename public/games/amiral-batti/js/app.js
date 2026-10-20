/**
 * Amiral Battı — arayüz. TLab Classics.
 */
import {
  FLEET,
  SIZE,
  DIFFICULTIES,
  createMatch,
  validateMatch,
  placeShip,
  removeShip,
  rotateDir,
  autoPlace,
  startMatch,
  playerShoot,
  applyEnemyShot,
  remainingShips,
  key,
  lcg,
} from "./engine.js";
import { chooseShot } from "./ai.js";

const STORE = "tariklab.amiral-batti.match";
const STATS = "tariklab.amiral-batti.stats";

const $ = (id) => document.getElementById(id);
const P = (s) => (typeof window !== "undefined" && window.tlabPhrase ? window.tlabPhrase(s) : s);

let state = null;
let selected = FLEET[0].id;
let dir = "h";
let hover = null;
let loadIssue = null;

const SAVE_COPY = {
  tr: {
    invalid: "Kayıt açılamadı; mevcut veri korundu. Yeni oyun düğmesiyle yeni bir bilgisayar oyunu başlatıp bu kaydın üzerine yazabilirsin.",
    hotseat: "Sırayla oyun şu anda kullanılamıyor. Kaydın korundu. Yeni oyun düğmesi yeni bir bilgisayar oyunuyla bu kaydın üzerine yazar.",
    unavailable: "Kayıt alanına erişilemiyor. Tarayıcı izinlerini kontrol et veya Yeni oyun ile devam et; ilerleme kaydedilemeyebilir.",
    option: "Sırayla — kullanılamıyor",
  },
  en: {
    invalid: "This save could not be opened; its data was kept. New game starts a new CPU game and replaces this save.",
    hotseat: "Hotseat is currently unavailable. Your save was kept. New game starts a new CPU game and replaces this save.",
    unavailable: "Save storage is unavailable. Check browser permissions or choose New game; progress may not be saved.",
    option: "Hotseat — unavailable",
  },
  pl: {
    invalid: "Nie można otworzyć zapisu; dane zostały zachowane. Nowa gra rozpocznie grę z komputerem i zastąpi ten zapis.",
    hotseat: "Hotseat jest obecnie niedostępny. Zapis został zachowany. Nowa gra rozpocznie grę z komputerem i zastąpi ten zapis.",
    unavailable: "Pamięć zapisu jest niedostępna. Sprawdź uprawnienia przeglądarki lub wybierz Nowa gra; postęp może nie zostać zapisany.",
    option: "Hotseat — niedostępny",
  },
};
function saveCopy(name) {
  const lang = window.tlabI18n?.getLang?.() || "tr";
  return (SAVE_COPY[lang] || SAVE_COPY.tr)[name];
}

function loadStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS));
    const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    return { win: count(raw?.win), loss: count(raw?.loss) };
  } catch {
    return { win: 0, loss: 0 };
  }
}
function saveStats(s) {
  try {
    localStorage.setItem(STATS, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
function persist() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
function resume() {
  state = null;
  loadIssue = null;
  let stored;
  try {
    stored = localStorage.getItem(STORE);
  } catch {
    loadIssue = "unavailable";
    return false;
  }
  if (stored === null) return false;
  try {
    const raw = JSON.parse(stored);
    if (!validateMatch(raw)) loadIssue = "invalid";
    else if (raw.mode === "hotseat") loadIssue = "hotseat";
    else {
      state = raw;
      return true;
    }
  } catch {
    loadIssue = "invalid";
  }
  return false;
}

function seedNow() {
  return (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
}

function newGame() {
  const difficulty = DIFFICULTIES.includes($("diff").value) ? $("diff").value : "orta";
  state = createMatch({ seed: seedNow(), difficulty, mode: "cpu" });
  loadIssue = null;
  $("mode").value = "cpu";
  selected = FLEET[0].id;
  dir = "h";
  hover = null;
  persist();
  render();
}

function cpuTurn() {
  if (!state || state.phase !== "play" || state.winner) return;
  if (state.turn !== "cpu") return;
  const shot = chooseShot(state, lcg(state.seed + state.log.length * 7919 + 17));
  if (!shot) return;
  applyEnemyShot(state, shot[0], shot[1]);
  if (state.winner) recordEnd();
  persist();
  render();
}

function recordEnd() {
  const s = loadStats();
  if (state.winner === "player") s.win += 1;
  if (state.winner === "cpu") s.loss += 1;
  saveStats(s);
}

function cellClass(kind, r, c, ships, shots, hideShips) {
  const k = key(r, c);
  const shot = shots[k];
  const ship = ships.find((s) => s.cells.some(([rr, cc]) => rr === r && cc === c));
  const cls = ["cell"];
  if (shot === "miss") cls.push("miss");
  if (shot === "hit") cls.push("hit");
  if (ship && ship.sunk) cls.push("sunk");
  if (ship && !hideShips) cls.push("ship");
  if (kind === "own" && hover && state.phase === "place") {
    const spec = FLEET.find((f) => f.id === selected);
    const preview = spec
      ? Array.from({ length: spec.len }, (_, i) => [dir === "v" ? hover[0] + i : hover[0], dir === "h" ? hover[1] + i : hover[1]])
      : [];
    if (preview.some(([rr, cc]) => rr === r && cc === c)) cls.push("preview");
  }
  return cls.join(" ");
}

function boardHtml(kind) {
  const ships = kind === "own" ? state.playerShips : state.enemyShips;
  const shots = kind === "own" ? state.enemyShots : state.playerShots;
  const hide = kind === "enemy" && state.phase !== "over";
  const label = kind === "own" ? P("Senin filon") : P("Rakip denizi");
  let html = `<div class="board-wrap"><p class="board-label" id="lbl-${kind}">${label}</p><div class="board" role="grid" aria-labelledby="lbl-${kind}">`;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const aria = `${kind === "own" ? "kendi" : "rakip"} ${r + 1}-${c + 1}`;
      html += `<button type="button" class="${cellClass(kind, r, c, ships, shots, hide)}" data-kind="${kind}" data-r="${r}" data-c="${c}" aria-label="${aria}"></button>`;
    }
  }
  html += `</div></div>`;
  return html;
}

function render() {
  if (!state) {
    $("status").setAttribute("data-i18n-skip", "");
    $("status").textContent = saveCopy(loadIssue || "invalid");
    $("place-bar").hidden = true;
    $("place-note").hidden = true;
    $("fleet-line").innerHTML = "";
    $("play-hint").textContent = "";
    $("log").innerHTML = "";
    $("arena").innerHTML = `<p class='muted'>${P("Yeni oyun başlat.")}</p>`;
    return;
  }
  $("status").removeAttribute("data-i18n-skip");
  const phaseLabel =
    state.phase === "place"
      ? P("Yerleşim")
      : state.phase === "over"
        ? state.winner === "player"
          ? P("Zafer — rakip filo battı")
          : P("Kayıp — filon battı")
        : state.turn === "player"
          ? P("Sıra sende")
          : P("Rakip ateş ediyor");
  $("status").textContent = phaseLabel;
  $("fleet-line").innerHTML = FLEET.map((f) => {
    const placed = state.playerShips.some((s) => s.id === f.id);
    const aliveE = remainingShips(state.enemyShips).some((s) => s.id === f.id);
    return `<button type="button" class="ship-btn ${selected === f.id ? "on" : ""} ${placed ? "set" : ""}" data-ship="${f.id}">${f.name} (${f.len})${state.phase !== "place" ? (aliveE ? "" : " · battı") : placed ? " · kondu" : ""}</button>`;
  }).join("");
  $("arena").innerHTML = boardHtml("enemy") + boardHtml("own");
  $("place-bar").hidden = state.phase !== "place";
  $("play-hint").textContent =
    state.phase === "place"
      ? `Gemiler yan yana durabilir. Dön: ${dir === "h" ? "yatay" : "dikey"}.`
      : state.phase === "over"
        ? "Yeni oyun ile tekrar dene."
        : "Bir kareye ateş et. İsabet, ıska, battı.";
  const st = loadStats();
  $("record").textContent = `Kayıt: ${st.win} galibiyet · ${st.loss} mağlubiyet`;
  $("log").innerHTML = state.log
    .slice(-8)
    .map((x) => `<li>${x.who === "player" ? "Sen" : "Rakip"} ${x.r + 1},${x.c + 1} — ${x.result === "sunk" ? "battı" : x.result === "hit" ? "isabet" : "ıska"}</li>`)
    .join("");
}

function onBoardClick(kind, r, c) {
  if (!state || state.winner) return;
  if (kind === "own" && state.phase === "place") {
    const spec = FLEET.find((f) => f.id === selected);
    const existing = state.playerShips.find((s) => s.id === spec.id);
    let ships = existing ? removeShip(state.playerShips, spec.id) : state.playerShips.slice();
    const res = placeShip(ships, spec, r, c, dir);
    const note = $("place-note");
    if (!res.ok) {
      note.textContent = res.reason;
      note.hidden = false;
      return;
    }
    note.hidden = true;
    state.playerShips = res.ships;
    persist();
    render();
    return;
  }
  if (kind === "enemy" && state.phase === "play" && state.turn === "player") {
    const res = playerShoot(state, r, c);
    const note = $("place-note");
    if (!res.ok) {
      note.textContent = res.reason;
      note.hidden = false;
      persist();
      return;
    }
    note.hidden = true;
    if (state.winner) recordEnd();
    persist();
    render();
    if (state.turn === "cpu" && !state.winner) {
      setTimeout(cpuTurn, 320);
    }
  }
}

function bind() {
  $("new").onclick = newGame;
  $("diff").onchange = () => {
    if (state && state.phase === "place") state.difficulty = $("diff").value;
  };
  $("rotate").onclick = () => {
    dir = rotateDir(dir);
    render();
  };
  $("auto").onclick = () => {
    if (!state || state.phase !== "place") return;
    const res = autoPlace(lcg(state.seed ^ 0xa5a5));
    if (res.ok) {
      state.playerShips = res.ships;
      $("place-note").hidden = true;
      persist();
      render();
    }
  };
  $("reset-fleet").onclick = () => {
    if (!state || state.phase !== "place") return;
    state.playerShips = [];
    persist();
    render();
  };
  $("start").onclick = () => {
    if (!state) return;
    const res = startMatch(state);
    const note = $("place-note");
    if (!res.ok) {
      note.textContent = res.reason;
      note.hidden = false;
      return;
    }
    note.hidden = true;
    persist();
    render();
  };
  $("help-open").onclick = () => $("help").showModal();
  $("help-close").onclick = () => $("help").close();
  $("fleet-line").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ship]");
    if (b && state?.phase === "place") {
      selected = b.dataset.ship;
      render();
    }
  });
  $("arena").addEventListener("click", (e) => {
    const b = e.target.closest("button.cell");
    if (!b) return;
    onBoardClick(b.dataset.kind, +b.dataset.r, +b.dataset.c);
  });
  $("arena").addEventListener("pointerover", (e) => {
    const b = e.target.closest("button.cell");
    if (!b || b.dataset.kind !== "own") return;
    hover = [+b.dataset.r, +b.dataset.c];
    if (state?.phase === "place") render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") {
      dir = rotateDir(dir);
      render();
    }
  });
}

function boot() {
  $("hotseat-option").disabled = true;
  $("hotseat-option").textContent = saveCopy("option");
  $("mode").value = "cpu";
  if (!resume()) {
    if (!loadIssue) state = createMatch({ seed: 1, difficulty: "orta" });
  } else {
    $("diff").value = DIFFICULTIES.includes(state.difficulty) ? state.difficulty : "orta";
    $("mode").value = state.mode === "hotseat" ? "hotseat" : "cpu";
  }
  bind();
  render();
  if (state?.turn === "cpu" && state.phase === "play" && !state.winner) setTimeout(cpuTurn, 200);
}

if (typeof window !== "undefined") window.addEventListener("DOMContentLoaded", boot);

export { newGame, cpuTurn };
