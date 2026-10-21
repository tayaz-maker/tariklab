// At most two optional directions, projected from existing simulation state.
import { getEducationProgress } from './education.js?v=10';
import { bankTotals } from './bank-accounts.js?v=10';
import { getMonthlySummary } from './life.js?v=10';
const cap = n => Math.max(0, Math.min(100, Number(n) || 0));
const bond = (closeness, social = {}) => cap(Math.min(closeness || 0, social.trust || 0, 100 - (social.tension || 0)) / 0.75);

export function yearlyGoals(state, debt = 0) {
  if (state.yearlyPlan?.year !== state.time.year) return [];
  const liquid = Math.max(0, state.finances.balance + bankTotals(state).personal);
  return [...new Set(state.yearlyPlan.priorities || [])].slice(0, 2).flatMap(priority => {
    let arc, label, progress;
    if (priority === 'education') {
      arc = 'education';label = 'Eğitim ve beceri birikimini geliştir';
      progress = getEducationProgress(state)?.percent ?? (state.education.level !== 'lise' || state.education.fields.length ? 100 : 0);
    } else if (priority === 'career') {
      arc = 'career';const business = state.flags.business;
      label = business ? 'İşletmeni kalıcı bir düzene taşı' : 'İşinde deneyim ve performans kazan';
      progress = business ? (business.level - 1) * 25 + Math.min(3, business.months || 0) / 3 * 25 : state.career.jobId ? Math.min(50, cap(state.career.performance / 70 * 50)) + Math.min(12, state.career.weeksInRole || 0) / 12 * 50 : 0;
    } else if (priority === 'health') {
      arc = 'health';label = 'Sağlık, enerji ve stres dengesini koru';
      progress = Math.min(state.health.health / 80, state.health.energy / 70, (100 - state.health.stress) / 65) * 100;
    } else if (priority === 'relationship') {
      const children = (state.parenthood?.children || []).filter(c => c.alive !== false);
      const partner = state.people.find(p => p.id === state.social?.currentPartnerNpcId && p.available !== false && !p.deceased);
      arc = children.length ? 'family' : partner ? 'relationship' : 'social';
      label = children.length ? 'Çocuklarınla güven ve yakınlığı sürdür' : partner ? 'Partnerinle güven ve yakınlığı sürdür' : 'Yakınlarınla güven ve yakınlığı sürdür';
      const scores = children.length ? children.map(c => bond(c.relationship?.closeness, c.relationship)) : partner ? [bond(state.relationships[partner.id], partner.social)] : state.people.filter(p => p.available !== false && !p.deceased && ['family', 'friend'].includes(p.roleId)).map(p => bond(state.relationships[p.id], p.social));
      progress = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    } else if (priority === 'money') {
      arc = 'finance';label = 'Borcu azalt ve 10.000 TL nakit payı oluştur';
      progress = debt > 0 ? Math.min(99, 50 * liquid / (liquid + debt) + Math.min(50, liquid / 200)) : 50 + Math.min(50, liquid / 200);
    } else if (priority === 'independence') {
      arc = 'housing';label = 'Ayrı yaşamı sürdürülebilir bir bütçeyle kur';
      const monthly = getMonthlySummary(state);
      progress = state.household.homeId === 'family' ? Math.min(50, liquid / 200) : 50 + (monthly.income >= monthly.expenses ? 25 : 0) + (liquid >= monthly.expenses ? 25 : 0);
    } else return [];
    return [{id: `yearly-${priority}`, priority, arc, label, progress: cap(progress)}];
  });
}
