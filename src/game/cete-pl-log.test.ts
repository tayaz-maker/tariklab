import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polishLog } from './cete-pl-log';
import { ALL_MISSIONS, JOB_FLAVOR } from './data';
import { PL_JOB_FLAVOR } from './cete-pl-job-flavor';

test('Polish log rendering retains dynamic amounts and leaves stored text untouched', () => {
 const source = 'Kasaya 12.345 ₺ indi. Sokak bunu gasp etmez.';
 assert.equal(polishLog(source), 'Wpłacono 12.345 ₺ do kasy. Tam pieniądze są bezpieczne przed napadem.');
 assert.equal(source, 'Kasaya 12.345 ₺ indi. Sokak bunu gasp etmez.');
 assert.equal(polishLog('Yeni gün. 17. gün sokakta.'), 'Nowy dzień. Dzień 17 na ulicy.');
 assert.equal(polishLog('Kırık Efes Şişesi alındı.'), 'Kupiono: Rozbita butelka Efes.');
 assert.match(polishLog('Mahalle Berberi / Tıraş kademe 1. Saatlik gelir şişti.'), /^Osiedlowy fryzjer: poziom 1/);
 assert.match(polishLog('Pavyon gecesi: sahne ışığı, rakı, kasa eridi. Adın masalarda döndü. Cansu haber aldı, bitti.'), /Cansu się dowiedziała — to koniec związku/);
 assert.match(polishLog('Ölüm listesi işledi: Rıza topuktan vuruldu, kliniğe kaldırıldı.'), /Rıza.*kliniki/);
 assert.match(polishLog('Tefeci Nuri 3.000 ₺ uzattı. İki güne 4.000 ₺.'), /3\.000 ₺.*4\.000 ₺/);
 assert.match(polishLog('Doktor sırtını sıvazladı: dikişler tuttu, kalk git. Klinikten çıktın.'), /Opuszczasz klinikę/);
 assert.match(polishLog('İhanet. İtibar düşükken Gözcü Selim defteri emniyete sızdırdı, 1.200 ₺ ile kayboldu.'), /Czujka Selim.*1\.200 ₺/);
 assert.match(polishLog('Naci Bey aradı: Pavyon çıkışı kirlendi. Sarhoşu sen temizle, hesap bende.'), /^Naci Bey dzwoni: Pod lokalem/);
 assert.match(polishLog('USDT fırladı. 31.5 → 32.7 ₺.'), /31,5 → 32,7 ₺/);
 assert.match(polishLog('1.5 gram altın alındı. 3.000 ₺.'), /Kupiono 1,5 g złota/);
 assert.match(polishLog('0.25 USDT satıldı. 10 ₺.'), /Sprzedano 0,25 USDT/);
 assert.equal(polishLog('Nieznany stary wpis'), 'Nieznany stary wpis');
});

test('every authored job result has a Polish counterpart and preserves outcome values', () => {
 for (const mission of ALL_MISSIONS) for (const result of ['win', 'lose'] as const) {
  const source = JOB_FLAVOR[mission.id][result];
  const translated = PL_JOB_FLAVOR[mission.id][result];
  assert.equal(translated.length, source.length, `${mission.id}/${result}`);
  for (const flavor of source) {
   const tail = result === 'win' ? ' +12.345 ₺. Naci Bey bonus 900 ₺. Emniyet 17.' : ' −7 can.';
   const rendered = polishLog(`${mission.name} — ${flavor}${tail}`);
   assert.notEqual(rendered, `${mission.name} — ${flavor}${tail}`);
   assert.ok(rendered.includes(result === 'win' ? '12.345 ₺' : '−7'), rendered);
   if (result === 'win') { assert.ok(rendered.includes('900 ₺')); assert.ok(rendered.includes('17')); }
  }
 }
});
