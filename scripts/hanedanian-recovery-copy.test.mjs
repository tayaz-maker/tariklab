import assert from 'node:assert/strict';
import test from 'node:test';
import {translate} from '../public/games/hanedanian/i18n.js';

test('recovered-campaign button and journal warning render in TR/EN/PL without changing their source receipt',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 let locale='tr';
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>locale}});
 const source=['Kurtarılan kampanyayı aç','Son kapanış kaydın kurtarıldı. Kalıcı kayıt için yeniden kaydet.'];
 const expected={tr:source,en:['Open recovered campaign','Your last session was recovered. Save again to keep a permanent copy.'],pl:['Otwórz odzyskaną kampanię','Odzyskano zapis z ostatniego zamknięcia gry. Zapisz ponownie, aby zachować go na stałe.']};
 try{for(locale of['tr','en','pl'])assert.deepEqual(source.map(translate),expected[locale]);
 assert.equal(source[0],'Kurtarılan kampanyayı aç');assert.equal(source[1],'Son kapanış kaydın kurtarıldı. Kalıcı kayıt için yeniden kaydet.');
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});


test('uppercase resource HUD and goals button use the selected TR/EN/PL presentation',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let locale='tr';
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>locale}});
 const source=['ERZAK','KERESTE','TAŞ','DEMİR','NÜFUZ','Hedefler →'];
 const expected={tr:source,en:['FOOD','TIMBER','STONE','IRON','INFLUENCE','Goals →'],pl:['ŻYWNOŚĆ','DREWNO','KAMIEŃ','ŻELAZO','WPŁYWY','Cele →']};
 try{for(locale of['tr','en','pl'])assert.deepEqual(source.map(translate),expected[locale]);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
