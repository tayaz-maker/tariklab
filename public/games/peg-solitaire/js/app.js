import { resultLabel, scoreCopy } from './presentation.js';
/**
 * Tek Taş — TLab Edition · arayüz katmanı.
 * TarikLab özgün uygulaması. Kurallar `solitaire.js` içinde.
 */
import {
  CENTER,
  EMPTY,
  PEG,
  SIZE,
  applyMove,
  cellAt,
  createGame,
  gameStatus,
  isPlayable,
  movesFrom,
  pegCount,
  restart,
  suggestMove,
  undoMove,
} from "./solitaire.js?v=1";

const language = () => window.tlabI18n?.getLang?.() || 'tr';

const STORAGE_KEY = "tlab.tektas.v1";
const STEP = 10;
const PAD = 5;

const el = (id) => document.getElementById(id);
const board = el("board");
const statusLine = el("board-status");
const dialog = el("result");

const game = createGame();
let selected = null;
let hinted = null;
let lastMove = null;
let finished = false;

/* ---------- yerel kayıt ---------- */

function readBest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const remaining = Number(parsed.remaining);
    if (!Number.isFinite(remaining) || remaining < 1 || remaining > 32) return null;
    const moves = Number(parsed.moves);
    return {
      remaining: Math.floor(remaining),
      moves: Number.isFinite(moves) && moves >= 0 ? Math.floor(moves) : 0,
      center: parsed.center === true,
    };
  } catch {
    return null;
  }
}

function writeBest(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* depolama kapalıysa oyun yine oynanır */
  }
}

function renderBest() {
  const best = readBest();
  el("stat-best").textContent = best ? String(best.remaining) : "—";
  el("best-line").textContent = best
    ? scoreCopy("best", best, language())
    : "Henüz kayıtlı bir derecen yok.";
}

/* ---------- çizim ---------- */

const cx = (col) => PAD + col * STEP + STEP / 2;
const cy = (row) => PAD + row * STEP + STEP / 2;

function svgEl(name, attrs, className) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (className) node.setAttribute("class", className);
  return node;
}

function draw() {
  // <defs> korunur, geri kalan her şey yeniden çizilir.
  const defs = board.querySelector("defs");
  board.replaceChildren();
  if (defs) board.append(defs);

  const targets = selected ? movesFrom(game, selected.row, selected.col) : [];
  const targetKeys = new Set(targets.map((move) => `${move.to.row},${move.to.col}`));

  if (lastMove) {
    board.append(
      svgEl(
        "circle",
        { cx: cx(lastMove.from.col), cy: cy(lastMove.from.row), r: STEP * 0.4 },
        "last-from",
      ),
    );
    board.append(
      svgEl("circle", { cx: cx(lastMove.to.col), cy: cy(lastMove.to.row), r: STEP * 0.42 }, "last-to"),
    );
  }

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!isPlayable(row, col)) continue;
      const value = cellAt(game, row, col);
      board.append(
        svgEl("circle", { cx: cx(col), cy: cy(row), r: STEP * 0.24 }, "hole"),
      );

      if (value === PEG) {
        const group = svgEl("g", { role: "button", tabindex: "0" }, "peg");
        const isSelected = selected && selected.row === row && selected.col === col;
        const isHinted = hinted && hinted.from.row === row && hinted.from.col === col;
        if (isSelected) group.classList.add("selected");
        if (isHinted) group.classList.add("hinted");
        group.dataset.row = String(row);
        group.dataset.col = String(col);
        group.dataset.kind = "peg";
        group.setAttribute(
          "aria-label",
          `${row + 1}. sıra ${col + 1}. sütundaki taş${isSelected ? ", seçili" : ""}`,
        );
        group.append(svgEl("circle", { cx: cx(col), cy: cy(row), r: STEP * 0.36 }, "peg-body"));
        group.append(
          svgEl(
            "ellipse",
            { cx: cx(col) - STEP * 0.09, cy: cy(row) - STEP * 0.12, rx: STEP * 0.11, ry: STEP * 0.07 },
            "peg-shine",
          ),
        );
        board.append(group);
      }

      if (value === EMPTY && targetKeys.has(`${row},${col}`)) {
        const group = svgEl("g", { role: "button", tabindex: "0" }, "target");
        group.dataset.row = String(row);
        group.dataset.col = String(col);
        group.dataset.kind = "target";
        group.setAttribute("aria-label", `${row + 1}. sıra ${col + 1}. sütuna atla`);
        group.append(svgEl("circle", { cx: cx(col), cy: cy(row), r: STEP * 0.38 }, "target-ring"));
        group.append(svgEl("circle", { cx: cx(col), cy: cy(row), r: STEP * 0.1 }, "target-dot"));
        board.append(group);
      }
    }
  }

  el("stat-pegs").textContent = String(pegCount(game));
  el("stat-moves").textContent = String(game.moves);
  el("undo").disabled = game.history.length === 0;
  el("hint").disabled = finished;
}

function setStatus(text) {
  statusLine.textContent = text;
}

/* ---------- oyun akışı ---------- */

function checkEnd() {
  const status = gameStatus(game);
  if (!status.over) return;
  finished = true;
  selected = null;
  hinted = null;
  draw();

  const best = readBest();
  const better =
    !best ||
    status.remaining < best.remaining ||
    (status.remaining === best.remaining && game.moves < best.moves);
  if (better) {
    writeBest({
      remaining: status.remaining,
      moves: game.moves,
      center: status.remaining === 1 && cellAt(game, CENTER.row, CENTER.col) === PEG,
    });
  }
  renderBest();

  el("result-grade").textContent = resultLabel(status.grade, language());
  el("result-note").textContent = scoreCopy("note", { ...status, better }, language());
  el("result-pegs").textContent = String(status.remaining);
  el("result-moves").textContent = String(game.moves);
  setStatus(
    status.reason === "solved"
      ? language() === "pl" ? `Pozostał jeden pionek — ${resultLabel(status.grade, language())}.` : language() === "en" ? `One peg remains — ${resultLabel(status.grade, language())}.` : `Tek taş kaldı — ${status.grade}.`
      : scoreCopy("terminal", status, language()),
  );
  if (typeof dialog.showModal === "function") dialog.showModal();
}

function selectPeg(row, col) {
  const options = movesFrom(game, row, col);
  if (!options.length) {
    selected = null;
    draw();
    setStatus("Bu taşın oynayabileceği bir atlayış yok.");
    return;
  }
  selected = { row, col };
  hinted = null;
  draw();
  setStatus(`Taş seçildi — ${options.length} olası atlayış.`);
}

function playTo(row, col) {
  if (!selected) return;
  const result = applyMove(game, selected, { row, col });
  if (!result.ok) {
    setStatus(result.reason);
    return;
  }
  lastMove = result.move;
  selected = null;
  hinted = null;
  draw();
  setStatus(`Atladın. Kalan taş: ${pegCount(game)}.`);
  checkEnd();
}

function handleCell(target) {
  if (finished) return;
  const node = target.closest("[data-kind]");
  if (!node) return;
  const row = Number(node.dataset.row);
  const col = Number(node.dataset.col);
  if (node.dataset.kind === "target") {
    playTo(row, col);
    return;
  }
  if (selected && selected.row === row && selected.col === col) {
    selected = null;
    draw();
    setStatus("Seçim bırakıldı.");
    return;
  }
  selectPeg(row, col);
}

board.addEventListener("click", (event) => handleCell(event.target));
board.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const node = event.target.closest?.("[data-kind]");
  if (!node) return;
  event.preventDefault();
  handleCell(event.target);
});

el("undo").addEventListener("click", () => {
  const result = undoMove(game);
  if (!result.ok) {
    setStatus(result.reason);
    return;
  }
  finished = false;
  selected = null;
  hinted = null;
  lastMove = game.history[game.history.length - 1] || null;
  draw();
  setStatus("Son hamle geri alındı.");
});

el("hint").addEventListener("click", () => {
  const move = suggestMove(game);
  if (!move) {
    setStatus("Önerilecek hamle kalmadı.");
    return;
  }
  selected = { row: move.from.row, col: move.from.col };
  hinted = move;
  draw();
  setStatus("Bu taş tahtayı en az kilitleyen atlayışı yapabilir.");
});

el("restart").addEventListener("click", () => {
  restart(game);
  selected = null;
  hinted = null;
  lastMove = null;
  finished = false;
  draw();
  setStatus("Tahta yeniden kuruldu.");
});

dialog.addEventListener("close", () => {
  if (dialog.returnValue !== "again") return;
  restart(game);
  selected = null;
  hinted = null;
  lastMove = null;
  finished = false;
  draw();
  setStatus("Tahta yeniden kuruldu.");
});

renderBest();
draw();
