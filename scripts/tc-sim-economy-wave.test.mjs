import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, validateState } from '../public/games/tc-sim/js/state.js';
import { syncGameDate, dateAtWeek, ageOnDate } from '../public/games/tc-sim/js/game-date.js';
import { approximateNominal, economyYear, formatPeriodMoney } from '../public/games/tc-sim/js/period-economy.js';
import { getMonthlySummary } from '../public/games/tc-sim/js/life.js';
import { advanceWeek, applyDecision } from '../public/games/tc-sim/js/time.js';
import { resolveScenarioChoice } from '../public/games/tc-sim/js/historical-scenarios.js';
import { getEventDefinition, getEventChoiceAvailability, resolveEvent } from '../public/games/tc-sim/js/events.js';
import { MARKET, marketAvailableInYear, spendLifestyle } from '../public/games/tc-sim/js/wealth.js';
import { takeCredit, startBusiness, processBusinessMonth, BUSINESS_TYPES } from '../public/games/tc-sim/js/bank-business.js';
import { migrateState } from '../public/games/tc-sim/js/save.js';

function clearEvents(s) {
  if (s.world.scenario?.pendingEvent) assert.equal(resolveScenarioChoice(s, 'rest').ok, true);
  for (let i = 0; s.events.active && i < 30; i++) {
    const choices = getEventDefinition(s.events.active.eventId).choices;
    const choice = choices.find(c => getEventChoiceAvailability(s, c.id).ok);
    assert.ok(choice, s.events.active.eventId);
    assert.equal(resolveEvent(s, choice.id).ok, true);
  }
}
function tick(s) {
  clearEvents(s);
  applyDecision(s, 'rest');
  clearEvents(s);
  const result = advanceWeek(s);
  assert.equal(result.ok, true, JSON.stringify({date:s.time.date,messages:result.messages}));
}
for (const era of ['1999-04-18', '2017-04-18', 'present_day']) {
  test(`${era}: canonical dates, birthday, budget, debt, business and reload`, () => {
    let s = createNewGame({ eraId: era, seed: 42 });
    const initial = s.time.date;
    const birth = s.player.birthDate;
    assert.equal(s.player.age, 18);
    if (era === '2017-04-18') assert.equal(birth, '1999-04-18');
    const summary = getMonthlySummary(s);
    const year = economyYear(s);
    const salary = approximateNominal(summary.salary, year, initial);
    if (era === '2017-04-18') assert.equal(salary, 1404.06);
    if (era === '1999-04-18') assert.ok(Math.abs(salary - 58948065) < 0.001);
    assert.ok(summary.income > summary.expenses);
    const cost = MARKET.grocery.cost;
    clearEvents(s);
    const before = s.finances.balance;
    assert.equal(spendLifestyle(s, 'grocery').ok, true);
    assert.equal(s.finances.balance, before - cost);
    assert.equal(takeCredit(s, 'small').ok, true);
    assert.ok(getMonthlySummary(s).expenses > summary.expenses);
    assert.equal(startBusiness(s, 'repair').ok, true);
    const debt = s.wealth.debts[0].principal;
    for (let i = 0; i < 48; i++) tick(s);
    assert.equal(s.time.date, dateAtWeek(initial, 48));
    assert.equal(s.player.age, 19);
    assert.equal(s.player.birthDate, birth);
    assert.equal(s.time.year, Number(s.time.date.slice(0, 4)));
    if (s.world.scenario) assert.equal(s.world.scenario.currentDate, s.time.date);
    assert.ok(!s.wealth.debts.length || s.wealth.debts[0].principal < debt);
    const beforeLoad = structuredClone(s);
    const loaded = migrateState(JSON.parse(JSON.stringify(s)));
    assert.equal(loaded.ok, true);
    s = loaded.state;
    assert.equal(s.time.date, beforeLoad.time.date);
    assert.equal(s.finances.balance, beforeLoad.finances.balance);
    assert.equal(processBusinessMonth(s), '');
    assert.equal(validateState(s).ok, true);
    console.log('PERIOD_BUDGET', { era, date: initial, salary: formatPeriodMoney(summary.salary, year, initial), housing: formatPeriodMoney(summary.housing, year, initial), consumption: formatPeriodMoney(summary.otherExpenses, year, initial), saving: formatPeriodMoney(summary.income-summary.expenses, year, initial), business: formatPeriodMoney(BUSINESS_TYPES.repair.startup, year, initial) });
  });
}
test('date boundaries retain cadence without skipped birthdays or split year', () => {
  assert.equal(dateAtWeek('2017-04-18', 1), '2017-04-25');
  assert.equal(dateAtWeek('2017-04-18', 2), '2017-05-04');
  assert.equal(dateAtWeek('2017-04-18', 48), '2018-04-18');
  assert.equal(ageOnDate('1999-04-18', '2018-04-17'), 18);
  assert.equal(ageOnDate('1999-04-18', '2018-04-18'), 19);
  assert.equal(dateAtWeek('2024-02-29', 48), '2025-02-28');
  assert.equal(dateAtWeek('2024-01-31', 1), '2024-02-07');
});
test('old conflicting historical save anchors once without changing balances/deadlines', () => {
  const s = createNewGame({ eraId: '1999-04-18' });
  delete s.time.date; delete s.time.dateOrigin; delete s.time.dateOriginWeek; delete s.player.birthDate;
  s.time.absoluteWeek = 50; s.time.year = 2001; s.world.scenario.currentDate = '2000-04-25';
  const before = s.finances.balance;
  syncGameDate(s);
  assert.equal(s.time.year, 2000); assert.equal(s.time.month, 4); assert.equal(s.time.weekOfMonth, 4);
  assert.equal(s.finances.balance, before); assert.equal(s.time.absoluteWeek, 50);
  s.time.absoluteWeek++; syncGameDate(s); assert.equal(s.time.date, '2000-05-04');
});
test('1999 and 2017 advance to 2030, catalogue evolves and no early historical events', () => {
  for (const era of ['1999-04-18','2017-04-18']) {
    const s = createNewGame({ eraId: era, seed: 314 });
    let prior = s.time.date;
    let changed = false;
    const initial = Object.entries(MARKET).filter(([,x]) => marketAvailableInYear(s,x)).map(([id])=>id).join();
    for (let i = 0; i < 1600 && !s.world.scenario.completed; i++) {
      tick(s);
      assert.ok(s.time.date > prior); prior = s.time.date;
      assert.equal(s.time.year, economyYear(s));
      assert.equal(s.player.age, ageOnDate(s.player.birthDate, s.time.date));
      const event = s.world.scenario.pendingEvent;
      if (event) assert.ok(event.year <= s.time.year);
      const catalogue = Object.entries(MARKET).filter(([,x]) => marketAvailableInYear(s,x)).map(([id])=>id).join();
      changed ||= catalogue !== initial;
    }
    assert.equal(s.time.date, '2030-01-01'); assert.equal(s.world.scenario.completed, true);
    assert.ok(changed); assert.equal(s.world.scenario.final.date, s.time.date);
  }
});
test('business risk produces losses, and skill/fatigue alter the same period outcome', () => {
  for (const id of Object.keys(BUSINESS_TYPES)) {
    const s = createNewGame({ eraId: '2017-04-18', seed: 45 });
    s.finances.balance = 100000; assert.equal(startBusiness(s,id).ok,true);
    let losses = 0;
    for(let i=0;i<24;i++) { s.time.absoluteWeek += 4; syncGameDate(s); processBusinessMonth(s); losses += s.flags.business.lastResult.net < 0; }
    assert.ok(losses > 0, id);
  }
  const healthy = createNewGame({ eraId:'2017-04-18', seed:45 }); healthy.finances.balance=100000;startBusiness(healthy,'repair');
  const tired=structuredClone(healthy);tired.health.energy=10;tired.finances.arrears=100;
  processBusinessMonth(healthy);processBusinessMonth(tired);
  assert.ok(healthy.flags.business.lastResult.net > tired.flags.business.lastResult.net);
});
