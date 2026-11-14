import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame, loadExpansionRuntime } from '../public/games/tc-sim-boardworld/engine.mjs';
import { renderExpansion } from '../public/games/tc-sim-boardworld/expansion-ui.mjs';
import { chooseLanguage } from '../public/games/tc-sim-boardworld/i18n.mjs';

const { getExpansionView } = await loadExpansionRuntime();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('unknown historical union is localized without leaking its identifier or changing history', () => {
  const state = createGame({ expansion: true, scenario: 'restart', seed: 14 });
  const view = getExpansionView(state);
  const row = { at: 0, type: 'family', subject: 'union:unknown-secret', detail: 'Arşiv' };
  view.events.push(row);
  for (const [language, label] of Object.entries({ tr: 'Aile birliği', en: 'Family union', pl: 'Związek rodzinny' })) {
    chooseLanguage(language);
    const html = renderExpansion({ view, actions: [], actionCard: () => '', sectionHeader: () => '', money: String, esc, language, section: 'world' });
    assert.ok(html.includes(label), `${language}: missing neutral union label`);
    assert.ok(!html.includes(row.subject), `${language}: leaked union ID`);
    assert.equal(row.subject, 'union:unknown-secret');
  }
});
