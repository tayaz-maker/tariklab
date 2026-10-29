import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polishLog } from './cete-pl-log';

test('Polish log rendering retains dynamic amounts and leaves stored text untouched', () => {
 const source = 'Kasaya 12.345 ₺ indi. Sokak bunu gasp etmez.';
 assert.equal(polishLog(source), 'Wpłacono 12.345 ₺ do kasy. Tam pieniądze są bezpieczne przed napadem.');
 assert.equal(source, 'Kasaya 12.345 ₺ indi. Sokak bunu gasp etmez.');
 assert.equal(polishLog('Yeni gün. 17. gün sokakta.'), 'Nowy dzień. Dzień 17 na ulicy.');
 assert.equal(polishLog('Kırık Efes Şişesi alındı.'), 'Kupiono: Rozbita butelka Efes.');
 assert.match(polishLog('Naci Bey aradı: Pavyon çıkışı kirlendi. Sarhoşu sen temizle, hesap bende.'), /^Naci Bey dzwoni: Pod lokalem/);
 assert.equal(polishLog('Nieznany stary wpis'), 'Nieznany stary wpis');
});
