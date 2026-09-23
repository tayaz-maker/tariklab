// Novella reading state: pure functions, no DOM.
import { PASSAGES, endingFor } from "./story.js";

export const VERSION = 1;
export const SIZES = [16, 18, 20, 23, 26];
export const THEMES = ["manila", "night", "contrast"];

export function createRead() {
  return { v: VERSION, path: ["start"], took: [], vars: { evidence: 0, resolve: 0 }, endings: [] };
}

export function defaultSettings() {
  return { size: 2, spacing: "normal", theme: "manila", font: "serif", letters: "normal" };
}

export const current = (r) => r.path[r.path.length - 1];

/** Choices on the current passage, each with whether it can be taken and why not. */
export function options(r) {
  const p = PASSAGES[current(r)];
  return (p.choices || []).map((c) => {
    const blocked = c.needs && c.needs.took && !r.took.includes(c.needs.took);
    return { ...c, ok: !blocked, reason: blocked ? c.why : null };
  });
}

function advance(r, id) {
  let next = id;
  if (next === "fork") next = endingFor(r);
  r.path.push(next);
  const p = PASSAGES[next];
  if (p.ending && !r.endings.includes(next)) r.endings.push(next);
  if (!p.choices && !p.ending && p.next) advance(r, p.next);
}

/** Take a choice. Returns false if it is not on offer or not possible. */
export function choose(r, choiceId) {
  const c = options(r).find((x) => x.id === choiceId);
  if (!c || !c.ok) return false;
  r.took.push(c.id);
  for (const [k, v] of Object.entries(c.effect || {})) r.vars[k] = (r.vars[k] || 0) + v;
  advance(r, c.next);
  return true;
}

export const finished = (r) => Boolean(PASSAGES[current(r)].ending);

/** Paragraphs of a passage for this reading: base text, path variants, ending extras. */
export function paragraphs(r, id, lang) {
  const p = PASSAGES[id];
  const out = [...p[lang]];
  for (const [took, v] of Object.entries(p.variants || {}))
    if (r.took.includes(took)) out.push(v[lang]);
  for (const [took, v] of Object.entries(p.extra || {}))
    if (r.took.includes(took)) out.push(v[lang]);
  return out;
}

/** Restart the story but remember which endings the reader has seen. */
export function restart(r) {
  const endings = [...(r.endings || [])];
  return { ...createRead(), endings };
}

export function normalize(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== VERSION || !Array.isArray(raw.took)) return null;
  // Replay the recorded choices so the path and variables are always consistent.
  const r = createRead();
  r.endings = Array.isArray(raw.endings) ? raw.endings.filter((e) => PASSAGES[e]?.ending) : [];
  for (const id of raw.took) if (!choose(r, id)) break;
  return r;
}

export function normalizeSettings(raw) {
  const d = defaultSettings();
  if (!raw || typeof raw !== "object") return d;
  return {
    size:
      Number.isInteger(raw.size) && raw.size >= 0 && raw.size < SIZES.length ? raw.size : d.size,
    spacing: raw.spacing === "wide" ? "wide" : "normal",
    theme: THEMES.includes(raw.theme) ? raw.theme : d.theme,
    font: raw.font === "sans" ? "sans" : "serif",
    letters: raw.letters === "wide" ? "wide" : "normal",
  };
}
