/** Game-local presentation. Language never enters simulation/save state. */
export const LANGUAGE_KEY = "tariklab.language";
const supported = new Set(["tr", "en", "pl"]);
let language = "tr",
  dictionary = {},
  patterns = [],
  changeHandler = null,
  requestVersion = 0;
let translatedValues = new Set();
const missing = new Set(),
  formats = new Map(),
  textCache = new Map();
const normalize = (v) => (supported.has(v) ? v : "tr");
const read = () => {
  try {
    return normalize(globalThis.localStorage?.getItem(LANGUAGE_KEY));
  } catch {
    return "tr";
  }
};
const escapePattern = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const locale = () => ({ tr: "tr-TR", en: "en-GB", pl: "pl-PL" })[language];
export const getLanguage = () => language;
export function number(value, digits = 0) {
  const n = Number(value) || 0,
    rounded = Math.round((n + Number.EPSILON) * 10 ** digits) / 10 ** digits;
  const key = `${language}:${digits}`;
  if (!formats.has(key))
    formats.set(key, new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }));
  return formats.get(key).format(Object.is(rounded, -0) ? 0 : rounded);
}
export const money = (value) => `${number(value)} ₺`;
export const signed = (value, digits = 1) =>
  `${Math.round(Number(value) * 10 ** digits) > 0 ? "+" : ""}${number(value, digits)}`;
export function t(key, vars = {}) {
  let text = language === "tr" ? key : dictionary[key] || key;
  for (const [name, value] of Object.entries(vars))
    text = text.replaceAll(`{${name}}`, String(value));
  return text;
}
function localizeSourceNumber(value) {
  const text = value.trim();
  if (!/^[+−-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(text)) return value;
  const parsed = Number(text.replaceAll(".", "").replace(",", ".").replace("−", "-"));
  const decimals = text.includes(",") ? Math.min(3, text.split(",")[1].length) : 0;
  return `${text.startsWith("+") && parsed > 0 ? "+" : ""}${number(parsed, decimals)}`;
}
export function translateText(value, depth = 0) {
  // Old save prose remains byte-preserved. Current visible cause summaries normalize
  // this former enum label before translation; original-record elements are excluded.
  const raw = String(value ?? "").replace(
    /ekip ihtiyacı (busy|quiet|balanced)\b/g,
    (_, id) => `ekip ihtiyacı ${{ busy: "yoğun", quiet: "sakin", balanced: "dengeli" }[id]}`,
  );
  if (depth || language === "tr") return translate(raw, depth);
  if (textCache.has(raw)) return textCache.get(raw);
  const result = translate(raw, 0);
  if (textCache.size >= 4096) textCache.delete(textCache.keys().next().value);
  textCache.set(raw, result);
  return result;
}
function translate(value, depth = 0) {
  const raw = String(value ?? "");
  if (language === "tr" || !raw.trim()) return raw;
  const text = raw.trim().replace(/\s+/g, " ");
  if (translatedValues.has(text)) return raw;
  let translated = dictionary[text];
  if (!translated && dictionary[text + "."]?.endsWith("."))
    translated = dictionary[text + "."].slice(0, -1);
  if (!translated && depth < 6) {
    for (const p of patterns) {
      if (p.prefix && !text.startsWith(p.prefix)) continue;
      const match = p.regex.exec(text);
      if (!match) continue;
      translated = p.target;
      p.names.forEach((name, i) => {
        translated = translated.replaceAll(
          `{${name}}`,
          p.numericFields[i]
            ? localizeSourceNumber(match[i + 1])
            : translateText(match[i + 1], depth + 1),
        );
      });
      break;
    }
  }
  if (!translated) {
    // Dates are composed by the unchanged engine; only their visible words change.
    const date = text.match(
      /^(\d+) (Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) (\d{4})$/,
    );
    if (date) translated = `${date[1]} ${dictionary[date[2]] || date[2]} ${date[3]}`;
  }
  if (!translated && depth < 5) {
    const punctuated = text.match(/^(.+?)([.!?])$/);
    if (punctuated && dictionary[punctuated[1]])
      translated = dictionary[punctuated[1]] + punctuated[2];
    // UI sentences compose finite catalog entries; preserve punctuation and user names.
    const decorated = text.match(/^([◈◷]\s*|·\s*)(.+)$|^(.+?)(\s*[↗→])$/);
    if (decorated)
      translated = decorated[1]
        ? decorated[1] + translateText(decorated[2], depth + 1)
        : translateText(decorated[3], depth + 1) + decorated[4];
    if (!translated) {
      const parts = text.split(/( · | → | \/ |(?<=[.!?])\s+)/);
      if (parts.length > 1)
        translated = parts
          .map((part, i) => (i % 2 ? part : translateText(part, depth + 1)))
          .join("");
    }
  }
  if (!translated) {
    if (/[A-Za-zçğıöşüİĞŞÖÇÜ]/.test(text) && !/^[A-Z0-9]{1,5}$/.test(text) && missing.size < 2500)
      missing.add(text);
    return raw;
  }
  return raw.replace(raw.trim(), translated);
}
export function localizeTree(root) {
  if (!root || language === "tr") return;
  const excluded = "script,style,textarea,[data-society],[data-person-name],[data-original-record]";
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    if (node.parentElement?.closest(excluded)) continue;
    const next = translateText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  for (const el of root.querySelectorAll("[aria-label],[title],[placeholder],[alt]")) {
    if (el.closest(excluded)) continue;
    for (const attr of ["aria-label", "title", "placeholder", "alt"]) {
      if (el.hasAttribute(attr)) el.setAttribute(attr, translateText(el.getAttribute(attr)));
    }
  }
}
export function markOriginalRecords(root) {
  if (!root || language === "tr") return;
  for (const el of root.querySelectorAll(
    ".journal-list,.news-column,.memory-note ul,.knowledge-file ol,.causal-history,.last-entry,.story-history ol",
  )) {
    el.dataset.originalRecord = "tr";
    if (el.previousElementSibling?.classList.contains("original-record-label")) continue;
    const label = document.createElement("p");
    label.className = "original-record-label tiny";
    label.textContent = t("Özgün kayıt metni · Türkçe");
    el.before(label);
  }
  for (const el of root.querySelectorAll(
    ".character-summary h3,.profile-head h3,.contact strong,.secondary-profile h3,.player-token,.map-player,.resident-player,.contact-avatar",
  ))
    el.dataset.personName = "true";
}
async function setLanguage(next, notify = true) {
  next = normalize(next);
  const request = ++requestVersion;
  const [keys, loaded] =
    next === "tr"
      ? [{ default: [] }, { default: [] }]
      : await Promise.all([
          import("./locale-keys.mjs"),
          next === "en" ? import("./locale-en.mjs") : import("./locale-pl.mjs"),
        ]);
  if (request !== requestVersion) return;
  language = next;
  dictionary = Object.fromEntries(keys.default.map((key, index) => [key, loaded.default[index]]));
  translatedValues = new Set(Object.values(dictionary));
  patterns = Object.entries(dictionary)
    .filter(([key]) => /\{\w+\}/.test(key))
    .map(([key, target]) => {
      let targetTemplate = target;
      const sourceKey = key.replace(/(?:\{\w+\}){2,}|\{\w+\}(?: \{\w+\})+$/g, (group) => {
        if (!targetTemplate.includes(group)) return group;
        const first = group.match(/\{\w+\}/)[0];
        targetTemplate = targetTemplate.replaceAll(group, first);
        return first;
      });
      const names = [],
        numericFields = [],
        parts = sourceKey.split(/(\{\w+\})/);
      const source = parts
        .map((part, index) => {
          if (!/^\{\w+\}$/.test(part)) return escapePattern(part);
          names.push(part.slice(1, -1));
          const before = parts[index - 1] || "",
            after = parts[index + 1] || "";
          const numeric =
            /[+−%]$/.test(before) ||
            /^(?:\. gün|\s+(?:TL|dk|dakika|saat|sa|gün|oturum|vardiya|ders|kişi|plan|belge|karar|işlem|eylem|puan)\b)/.test(
              after,
            ) ||
            (/^(Zanaat|Bilgi|Teknoloji|İletişim) $/.test(before) && !after);
          numericFields.push(numeric);
          return numeric ? "([+−-]?\\d[\\d., \\u00a0]*)" : "(.+)";
        })
        .join("");
      return {
        regex: new RegExp("^" + source + "$"),
        names,
        numericFields,
        target: targetTemplate,
        prefix: parts[0],
        size: key.replace(/\{\w+\}/g, "").length,
      };
    })
    .sort((a, b) => b.size - a.size || b.prefix.length - a.prefix.length);
  missing.clear();
  textCache.clear();
  if (typeof document !== "undefined") document.documentElement.lang = language;
  if (notify) changeHandler?.();
}
export async function initLocale(onChange) {
  changeHandler = onChange;
  await setLanguage(read(), false);
  addEventListener("storage", (event) => {
    if (event.key === LANGUAGE_KEY || event.key === null) void setLanguage(read());
  });
  addEventListener("tlab-language", () => {
    void setLanguage(read());
  });
  globalThis.boardworldLocaleReport = () => ({
    language,
    missing: [...missing].sort(),
    catalogSize: Object.keys(dictionary).length,
  });
}
export async function chooseLanguage(value) {
  const next = normalize(value);
  try {
    localStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    /* Language still works in this tab. */
  }
  await setLanguage(next);
}
