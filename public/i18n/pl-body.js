/* TarikLab Polish body text.
 * Games render their English content for Polish readers (see tlab-i18n.js
 * contentLang). When the site language is "pl", this script loads the game's
 * Polish dictionary (/i18n/pl/<game>.json, built by scripts/pl/build.mjs) and
 * replaces English text on screen with its Polish translation. Text a game
 * still shows in Turkish in English mode (Apartman chains, the Bükücü log) is
 * keyed by its Turkish source. Lookup: whole text nodes first, then " · "
 * parts, then patterns such as "Draw {0} cards" ({0#} matches a number only).
 * Text without a translation stays as it is. Nothing in game state or saves
 * changes; switching away from Polish restores the originals.
 * Usage: <script src="/i18n/pl-body.js" data-game="veto-h" defer></script>
 */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var KEY = "tariklab.language";
  var script = document.currentScript;
  var game = (script && script.getAttribute("data-game")) || location.pathname.split("/")[2] || "";
  var ATTRS = ["aria-label", "title", "placeholder", "alt"];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1 };
  var dict = null;
  var patterns = [];
  var loading = null;
  var observer = null;
  var active = false;
  var textMemo = new WeakMap(); // text node -> { from, to }
  var attrMemo = new WeakMap(); // element -> { attr: { from, to } }

  function lang() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function compile(rows) {
    return rows.map(function (row) {
      // {0} matches any text, {0#} only a number (for "{0#}. seviye" style keys)
      var parts = row[0].split(/\{(\d+)(#?)\}/);
      var src = "^";
      var order = [];
      for (var i = 0; i < parts.length; i += 3) {
        src += escapeRe(parts[i]);
        if (i + 1 < parts.length) {
          src += parts[i + 2] ? "([\\d.,]+)" : "(.+?)";
          order.push(Number(parts[i + 1]));
        }
      }
      return { re: new RegExp(src + "$"), order: order, to: row[1] };
    });
  }

  function exact(text) {
    return Object.prototype.hasOwnProperty.call(dict, text) ? dict[text] : null;
  }

  function translate(text, depth) {
    var hit = exact(text);
    if (hit != null) return hit;
    if ((depth || 0) > 2) return null;
    if (text.indexOf(" · ") > 0) {
      var changed = false;
      var parts = text.split(" · ").map(function (part) {
        var t = translate(part, (depth || 0) + 1);
        if (t != null) changed = true;
        return t != null ? t : part;
      });
      if (changed) return parts.join(" · ");
    }
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      var m = p.re.exec(text);
      if (!m) continue;
      var args = [];
      for (var k = 0; k < p.order.length; k++) {
        var value = m[k + 1];
        var inner = translate(value, (depth || 0) + 1);
        args[p.order[k]] = inner != null ? inner : value;
      }
      return p.to.replace(/\{(\d+)\}/g, function (_, n) {
        return args[Number(n)] != null ? args[Number(n)] : "";
      });
    }
    return null;
  }

  function doText(node) {
    var value = node.nodeValue;
    if (!value || !/[A-Za-z]/.test(value)) return;
    var memo = textMemo.get(node);
    if (memo && memo.to === value) return;
    var core = value.replace(/\s+/g, " ").trim();
    if (!core) return;
    var out = translate(core);
    if (out == null || out === core) return;
    var lead = value.match(/^\s*/)[0];
    var tail = value.match(/\s*$/)[0];
    var next = lead + out + tail;
    textMemo.set(node, { from: value, to: next });
    node.nodeValue = next;
  }

  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var name = ATTRS[i];
      var value = el.getAttribute(name);
      if (!value || !/[A-Za-z]/.test(value)) continue;
      var memo = attrMemo.get(el) || {};
      if (memo[name] && memo[name].to === value) continue;
      var out = translate(value.replace(/\s+/g, " ").trim());
      if (out == null) continue;
      memo[name] = { from: value, to: out };
      attrMemo.set(el, memo);
      el.setAttribute(name, out);
    }
  }

  function walk(node) {
    if (node.nodeType === 3) return doText(node);
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    if (node.nodeType === 1) {
      if (SKIP[node.tagName] || (node.hasAttribute && node.hasAttribute("data-pl-skip"))) return;
      doAttrs(node);
    }
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function onMutations(list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doAttrs(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
  }

  function start() {
    if (active || !dict || !document.body) return;
    active = true;
    walk(document.body);
    var title = translate(document.title);
    if (title) document.title = title;
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
  }

  function stop() {
    if (!active) return;
    active = false;
    if (observer) observer.disconnect();
    observer = null;
    var restore = function (node) {
      if (node.nodeType === 3) {
        var memo = textMemo.get(node);
        if (memo && node.nodeValue === memo.to) node.nodeValue = memo.from;
        return;
      }
      if (node.nodeType !== 1) return;
      var am = attrMemo.get(node);
      if (am)
        for (var name in am)
          if (node.getAttribute(name) === am[name].to) node.setAttribute(name, am[name].from);
      for (var c = node.firstChild; c; c = c.nextSibling) restore(c);
    };
    if (document.body) restore(document.body);
  }

  function load() {
    if (dict) return Promise.resolve();
    if (loading) return loading;
    loading = fetch("/i18n/pl/" + encodeURIComponent(game) + ".json")
      .then(function (r) {
        return r.ok ? r.json() : { exact: {}, patterns: [] };
      })
      .then(function (data) {
        dict = data.exact || {};
        patterns = compile(data.patterns || []);
      })
      .catch(function () {
        dict = {};
      });
    return loading;
  }

  function sync() {
    if (lang() === "pl") {
      load().then(function () {
        if (lang() !== "pl") return;
        if (document.body) start();
        else document.addEventListener("DOMContentLoaded", start, { once: true });
      });
    } else stop();
  }

  window.tlabPlBody = {
    translate: function (text) {
      return dict ? translate(String(text)) : null;
    },
    ready: function () {
      return load();
    },
  };
  window.addEventListener("storage", function (e) {
    if (e.key === KEY || e.key === null) sync();
  });
  document.addEventListener("tlab-language", sync);
  sync();
})();
