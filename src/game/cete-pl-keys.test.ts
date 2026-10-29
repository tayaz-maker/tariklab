import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { translate } from '../lib/i18n';
import { RISK_HEAT } from './data';
import { lakap } from './formulas';

test('literal Çete UI translation keys and dynamic risk/rank keys exist in Polish', () => {
 const keys=new Set<string>();
 for (const file of readdirSync('src/components/game').filter(x=>x.endsWith('.tsx'))) {
  const source=readFileSync(`src/components/game/${file}`,'utf8');
  for(const match of source.matchAll(/\bt\(\s*["']([^"']+)["']/g)) keys.add(match[1]);
 }
 for(const risk of Object.keys(RISK_HEAT))keys.add(`cete.risk.${risk}`);
 for(let level=1;level<=100;level++)keys.add(`cete.rank.${lakap(level)}`);
 for(const key of keys) assert.notEqual(translate('pl',key,'__MISSING__'),'__MISSING__',key);
 assert.ok(keys.size>=60);
 assert.match(translate('pl','cete.jobs.crewUnavailable','', {count:2}),/2/);
 assert.match(translate('pl','cete.jobs.bonusDeadline','', {bonus:'123 ₺'}),/123 ₺/);
});
