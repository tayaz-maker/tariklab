// Pure, in-memory atlas controls. This module has no persistence, clinical
// inference, DOM, renderer or game dependency. Labels and review status come from supplied content.
export const STRUCTURE_IDS = Object.freeze([
  "skull", "spine", "thoracic-cage", "shoulder-girdle", "pelvis", "upper-limbs", "lower-limbs",
  "brain", "heart", "lungs", "liver", "stomach", "kidneys",
]);

const structureIds = new Set(STRUCTURE_IDS);
const layerIds = ["surface", "skeleton", "organs"];
const locales = ["tr", "en", "pl"];
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const queryText = (value) => typeof value === "string"
  ? Array.from(value).slice(0, 200).map((character) => {
    const code = character.codePointAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("")
  : "";
// Match the renderer's 420 x 780 viewBox so a zoomed edge can return into view.
const panLimits = (zoom) => ({ x: (zoom - 1) * 210, y: (zoom - 1) * 390 });

export function createAtlasState(overrides = {}) {
  const input = overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides : {};
  const zoom = finite(input.zoom) ? clamp(input.zoom, 1, 3) : 1;
  const limit = panLimits(zoom);
  return {
    variant: input.variant === "male" ? "male" : "female",
    view: input.view === "back" ? "back" : "front",
    layers: Object.fromEntries(layerIds.map((id) => [id,
      typeof input.layers?.[id] === "boolean" ? input.layers[id] : true,
    ])),
    selectedId: input.selectedId === null || structureIds.has(input.selectedId) ? input.selectedId : "heart",
    query: queryText(input.query),
    zoom,
    panX: finite(input.panX) ? clamp(input.panX, -limit.x, limit.x) : 0,
    panY: finite(input.panY) ? clamp(input.panY, -limit.y, limit.y) : 0,
    lessonIndex: finite(input.lessonIndex) ? clamp(Math.trunc(input.lessonIndex), 0, 2) : 0,
    sourceOpen: input.sourceOpen === true,
    locale: locales.includes(input.locale) ? input.locale : "tr",
  };
}

export function reduceAtlasState(state, action) {
  if (!action || typeof action !== "object") return state;
  switch (action.type) {
    case "set-variant": {
      const variant = action.variant ?? action.value;
      return ["female", "male"].includes(variant) && variant !== state.variant ? { ...state, variant } : state;
    }
    case "set-view": {
      const view = action.view ?? action.value;
      return ["front", "back"].includes(view) && view !== state.view ? { ...state, view } : state;
    }
    case "toggle-layer": {
      const layer = action.layer ?? action.value;
      return layerIds.includes(layer)
        ? { ...state, layers: { ...state.layers, [layer]: !state.layers[layer] } }
        : state;
    }
    case "set-selection": {
      const selectedId = Object.hasOwn(action, "id") ? action.id : action.value;
      return (selectedId === null || structureIds.has(selectedId)) && selectedId !== state.selectedId
        ? { ...state, selectedId }
        : state;
    }
    case "search": {
      const value = action.query ?? action.value;
      if (typeof value !== "string") return state;
      const query = queryText(value);
      return query !== state.query ? { ...state, query } : state;
    }
    case "zoom": {
      const requested = action.zoom ?? action.value ?? (finite(action.delta) ? state.zoom + action.delta : undefined);
      if (!finite(requested)) return state;
      const zoom = clamp(requested, 1, 3), limit = panLimits(zoom);
      const panX = clamp(state.panX, -limit.x, limit.x), panY = clamp(state.panY, -limit.y, limit.y);
      return zoom === state.zoom && panX === state.panX && panY === state.panY
        ? state : { ...state, zoom, panX, panY };
    }
    case "pan": {
      const requestedX = action.x ?? (finite(action.dx) ? state.panX + action.dx : state.panX);
      const requestedY = action.y ?? (finite(action.dy) ? state.panY + action.dy : state.panY);
      if (!finite(requestedX) || !finite(requestedY)) return state;
      const limit = panLimits(state.zoom);
      const panX = clamp(requestedX, -limit.x, limit.x), panY = clamp(requestedY, -limit.y, limit.y);
      return panX === state.panX && panY === state.panY ? state : { ...state, panX, panY };
    }
    case "reset-view":
      return state.zoom === 1 && state.panX === 0 && state.panY === 0
        ? state : { ...state, zoom: 1, panX: 0, panY: 0 };
    case "lesson-next":
    case "lesson-prev": {
      const lessonIndex = clamp(state.lessonIndex + (action.type === "lesson-next" ? 1 : -1), 0, 2);
      return lessonIndex === state.lessonIndex ? state : { ...state, lessonIndex };
    }
    case "set-locale": {
      const locale = action.locale ?? action.value;
      return locales.includes(locale) && locale !== state.locale ? { ...state, locale } : state;
    }
    case "sources": {
      const requested = action.open ?? action.value;
      const sourceOpen = requested === undefined ? !state.sourceOpen : requested;
      return typeof sourceOpen === "boolean" && sourceOpen !== state.sourceOpen ? { ...state, sourceOpen } : state;
    }
    default:
      return state;
  }
}

function normalizeSearch(value) {
  return String(value).toLocaleLowerCase("tr").normalize("NFD")
    .replace(/\p{M}/gu, "").replace(/ı/g, "i").replace(/ł/g, "l");
}

export function visibleStructures(state, structures = []) {
  if (!Array.isArray(structures)) return [];
  const terms = normalizeSearch(state.query).trim().split(/\s+/).filter(Boolean);
  const languageOrder = [state.locale, ...locales.filter((locale) => locale !== state.locale)];
  return structures.filter((structure) => {
    if (!structure || !structureIds.has(structure.id) || !Array.isArray(structure.systems)) return false;
    if (!structure.systems.some((system) => layerIds.includes(system) && state.layers[system])) return false;
    if (Array.isArray(structure.views) && !structure.views.includes(state.view)) return false;
    const searchable = [structure.id];
    for (const locale of languageOrder) {
      if (typeof structure.label?.[locale] === "string") searchable.push(structure.label[locale]);
      const synonyms = structure.searchTerms?.[locale];
      if (Array.isArray(synonyms)) searchable.push(...synonyms.filter((term) => typeof term === "string"));
    }
    const haystack = normalizeSearch(searchable.join(" "));
    return terms.every((term) => haystack.includes(term));
  });
}
