/* Presentation lifecycle only. Games own their models, layout and artwork.
 * No storage, audio, simulation calls, frame loop or external dependencies. */
(function (scope) {
  'use strict';
  function create({host, render, fallbackFocus}) {
    const seen = new Set();
    let card = null, origin = null, timer = null, cleanup = null, lastAt = -Infinity, destroyed = false;
    let hovered = false, focused = false;
    const query = scope.matchMedia('(prefers-reduced-motion: reduce)');
    const status = document.createElement('p');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    status.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;pointer-events:none';
    function clear({restore = false} = {}) {
      scope.clearTimeout(timer); timer = null;
      if (restore && card?.contains(document.activeElement)) {
        const target = origin?.isConnected && !origin.matches(':disabled') ? origin : fallbackFocus?.();
        target?.focus?.({preventScroll: true});
      }
      cleanup?.(); cleanup = null; card?.remove(); card = null; hovered = false; focused = false;
    }
    function arm() {
      scope.clearTimeout(timer);
      if (card) card.dataset.reducedMotion = String(query.matches);
      if (card && !query.matches && !hovered && !focused) timer = scope.setTimeout(() => clear(), 2200);
    }
    query.addEventListener('change', arm);
    function show(model, options = {}) {
      if (destroyed) return false;
      clear();
      if (!model?.id || seen.has(model.id)) return false;
      seen.add(model.id);
      if (seen.size > 64) seen.delete(seen.values().next().value);
      const now = performance.now();
      if (now - lastAt < 2500) return false;
      const parent = typeof host === 'function' ? host() : host;
      if (!parent) return false;
      lastAt = now; origin = options.origin || document.activeElement;
      card = render(model); if (!card.hasAttribute('data-outcome-moment')) card.setAttribute('data-outcome-moment', '');
      const click = event => { if (event.target.closest('[data-outcome-close]')) clear({restore: true}); };
      const key = event => {
        if (event.key === 'Escape' && !event.defaultPrevented && !document.activeElement?.closest('dialog[open],[role="dialog"]')) {
          event.preventDefault(); clear({restore: true});
        }
      };
      const enter = () => { hovered = true; arm(); }, leave = () => { hovered = false; arm(); };
      const focus = () => { focused = true; arm(); };
      const blur = event => { if (!card?.contains(event.relatedTarget)) { focused = false; arm(); } };
      card.addEventListener('click', click); card.addEventListener('mouseenter', enter); card.addEventListener('mouseleave', leave);
      card.addEventListener('focusin', focus); card.addEventListener('focusout', blur); document.addEventListener('keydown', key);
      const current = card;
      cleanup = () => {
        current.removeEventListener('click', click); current.removeEventListener('mouseenter', enter); current.removeEventListener('mouseleave', leave);
        current.removeEventListener('focusin', focus); current.removeEventListener('focusout', blur); document.removeEventListener('keydown', key);
      };
      parent.append(card);
      if (!status.isConnected) document.body.append(status);
      status.textContent = model.announcement || model.summary || '';
      arm(); return true;
    }
    return {show, clear, destroy() { if (destroyed) return; clear(); destroyed = true; query.removeEventListener('change', arm); status.remove(); seen.clear(); }};
  }
  scope.TarikOutcome = {create};
})(typeof window !== 'undefined' ? window : globalThis);
