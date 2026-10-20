import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createStaticGameServer} from './static-game-server.mjs';
import {loadGame} from './racon-harness.mjs';
import {checkedUrl} from './browser-guard.mjs';

const source = process.argv.includes('--source');
const label = process.env.RACON_LABEL || (source ? 'source' : 'built');
const out = `${process.env.RUNNER_TEMP || '/workspace'}/screenshots/racon-language/${label}`;
mkdirSync(out, {recursive: true});
const h = loadGame();
h.ev('blank("Dil");enterPlay();S.stage="baba";S.week=6;S.kasa=10000;cashNormalize(S);S.komiser={ad:"Komiser Test",baglilik:50,risk:10,acgoz:40,kilitli:false};S.flags.cavusKapali=0;S.dosya=80;S.inbox.unshift({id:"language-tip",kind:"tuyo",week:6,title:"Tüyo",body:"Bu hafta kapıyı çalarlar.",kapali:false,read:false});S.inbox.unshift({id:"language-story",week:6,title:"Sokak seni gördü.",body:"Kırık Avlu ağzında durdun. Heat ince ince yürüdü.",read:false});writeSave();');
const weather = "Sis Haliç'ten yürüdü. Son Kepenk görünmüyor.";
h.ev(`S.flags.bugun=${JSON.stringify(weather)};writeSave();`);
const fixture = h.localStorage.getItem('tariklab::racon:1');
const server = process.env.RACON_BASE ? null : createStaticGameServer(source ? 'public' : '.output/public');
if (server) await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = checkedUrl(process.env.RACON_BASE || `http://127.0.0.1:${server.address().port}`);
const copy = {
  tr: {empty: 'Boş.', cash: 'Haftada ₺800 kirli kasadan temiz kasaya geçer. Dosya artmaz.', saved: 'Kaydedildi', seated: 'oturuyor.', clear: 'Boşalt', story: 'Kırık Avlu ağzında durdun. Heat ince ince yürüdü.', title: 'Kepenk indi.', body: /İş durdu, .*2\.200.* gitti\. Baskın gelirse eli boş döner\./},
  en: {empty: 'Empty.', cash: 'Each week ₺800 moves from dirty to clean cash. The dossier does not rise.', saved: 'Saved', seated: 'is seated.', clear: 'Clear', story: 'You stood at the mouth of Kırık Avlu. Heat crept up.', title: 'Shutters closed.', body: /Work stopped; cash change .*2\.200.*\. A raid this week finds nothing\./},
  pl: {empty: 'Puste.', cash: 'Co tydzień ₺800 przechodzi z brudnej do czystej kasy. Teczka nie rośnie.', saved: 'Zapisano', seated: 'zajmuje miejsce.', clear: 'Zwolnij', story: 'Stanąłeś u wylotu Kırık Avlu. Presja powoli rosła.', title: 'Okiennice zamknięte.', body: /Praca stanęła; zmiana gotówki .*2\.200.*\. Nalot w tym tygodniu nic nie znajdzie\./},
};
const rows = [];
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox']});
try {
  for (const lang of ['tr', 'en', 'pl']) for (const width of [390, 1280]) {
    const context = await browser.newContext({viewport: {width, height: 844}});
    try {
      await context.addInitScript(({lang, fixture}) => {
        localStorage.setItem('tariklab.language', lang);
        if (!localStorage.getItem('language-seeded')) {
          localStorage.setItem('tariklab::racon:1', fixture);
          localStorage.setItem('tariklab::racon:active', '1');
          localStorage.setItem('language-seeded', '1');
        }
      }, {lang, fixture});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
      await page.goto(origin + '/games/racon/index.html', {waitUntil: 'networkidle'});
      await page.locator('#btn-devam').click();
      const propertyName = {tr: 'Emlak', en: 'Property', pl: 'Nieruchomości'}[lang];
      assert.equal(await page.locator('.navbtn[data-id="emlak"]').getAttribute('aria-label'), propertyName);
      assert.equal(await page.locator('.navbtn[data-id="emlak"] span').innerText(), propertyName.toLocaleUpperCase(lang));
      const rivalryName = {tr: 'Husumet', en: 'Rivalry', pl: 'Rywalizacja'}[lang];
      assert.equal(await page.locator('.navbtn[data-id="husumet"]').getAttribute('aria-label'), rivalryName);
      const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('tariklab::racon:1')));
      const nav = async id => {
        const button = page.locator(`.navbtn[data-id="${id}"]`);
        if (!await button.isVisible()) await page.locator('[data-act="navdetay"]').click();
        await button.click();
      };
      await nav('ekip');
      await page.getByText(copy[lang].cash, {exact: true}).waitFor();
      assert.equal(await page.getByText(copy[lang].empty, {exact: true}).count(), 3);
      const initial = await saved();
      await page.locator('[data-act="org-ata"][data-id="kasa"]').first().click();
      const assigned = await saved();
      assert.equal(assigned.genisleme.crews.length, 1);
      assert.ok((await page.locator('#stage').innerText()).includes(copy[lang].seated));
      await page.getByRole('button', {name: copy[lang].clear, exact: true}).waitFor();
      await page.screenshot({path: `${out}/crew-${lang}-${width}.png`});
      await nav('olaylar');
      const localizedWeather = {tr: weather, en: 'Fog rolled in from Haliç. Son Kepenk is out of sight.', pl: 'Od Haliç nadciągnęła mgła. Son Kepenk zniknął z pola widzenia.'}[lang];
      await page.getByText(localizedWeather, {exact: true}).waitFor();
      assert.equal((await saved()).flags.bugun, weather);
      await page.locator('[data-act="inbox"][data-id="language-story"]').click();
      await page.getByText(copy[lang].story, {exact: true}).waitFor();
      await page.locator('[data-act="inbox"][data-id="language-tip"]').click();
      await page.locator('[data-act="kepenk-indir"]').click();
      const after = await saved();
      assert.equal(after.kasa, 7800);
      const paper = after.inbox.find(p => p.title === 'Kepenk indi.');
      assert.ok(paper);
      await page.locator(`[data-act="inbox"][data-id="${paper.id}"]`).click();
      await page.locator('.paper .ttl, .card .ttl').filter({hasText: copy[lang].title}).waitFor();
      assert.match(await page.locator('#stage').innerText(), copy[lang].body);
      assert.match(paper.body, /^İş durdu, .* gitti\. Baskın gelirse eli boş döner\.$/);
      await page.getByRole('heading', {name: {tr:'Kâğıt',en:'Paper',pl:'Dokument'}[lang], exact:true}).waitFor();
      await page.getByRole('button', {name: {tr:'Okundu, kaldır',en:'Read; file away',pl:'Przeczytane, usuń'}[lang], exact:true}).waitFor();
      await page.getByRole('button', {name: {tr:'Ağza bırak',en:'Spread the word',pl:'Puść wieść w obieg'}[lang], exact:true}).waitFor();
      await page.locator('[data-act="save"]').click();
      assert.equal(await page.locator('#save-status').textContent(), copy[lang].saved);
      assert.ok((await page.locator('#feedback').innerText()).includes({tr:'Kayıt güncel',en:'Save up to date',pl:'Zapis aktualny'}[lang]));
      const beforeReload = await saved();
      await page.screenshot({path: `${out}/paper-${lang}-${width}.png`});
      await page.reload({waitUntil: 'networkidle'});
      await page.locator('#btn-devam').click();
      const reloaded = await saved();
      // Resuming autosaves a new wall-clock timestamp; all gameplay data must match.
      assert.ok(reloaded.savedAt >= beforeReload.savedAt);
      const {savedAt: beforeTimestamp, ...beforeGameplay} = beforeReload;
      const {savedAt: afterTimestamp, ...afterGameplay} = reloaded;
      assert.ok(Number.isFinite(beforeTimestamp) && Number.isFinite(afterTimestamp));
      assert.deepEqual(afterGameplay, beforeGameplay);
      for (const key of ['seed', 'week', 'day']) assert.equal((await saved())[key], initial[key]);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      rows.push({lang, width, status: 'PASS', origin, canonicalStoryPreserved: true, assignmentAndCashReload: true});
    } finally {await context.close();}
  }
  assert.equal(rows.length, 6);
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify({chromium: browser.version(), rows}, null, 2));
  await browser.close();
  if (server) await new Promise(r => server.close(r));
}
console.log(JSON.stringify({label, rows}));
