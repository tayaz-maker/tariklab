/**
 * Vanilla page boot: set lang, mount TR/EN/PL toggle.
 * Language change reloads the page so static Turkish source is never rewritten
 * in place. Gameplay saves live in other localStorage keys and stay intact.
 */
(function () {
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  ready(function () {
    var I = window.tlabI18n;
    if (!I) return;
    I.applyHtmlLang();
    var header = document.querySelector("header") || document.querySelector(".top") || document.querySelector("main") || document.body;
    I.mountLangToggle(header);
    if (I.getLang() !== "tr") I.applyPhrases(document.body);
    I.onLang(function () {
      location.reload();
    });
    // Classic game renderers replace text after every move. Translate those
    // new nodes too; disconnect during our writes to avoid observer loops.
    var observer = new MutationObserver(function () {
      if (I.getLang() === "tr") return;
      observer.disconnect();
      I.applyPhrases(document.body);
      observe();
    });
    function observe() {
      observer.observe(document.body, {
        subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ["aria-label", "title", "placeholder", "alt"],
      });
    }
    observe();
  });
})();
