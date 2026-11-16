import { recordSocietyMemory } from "./expansion-society.mjs";
import { calendarConflict, integer } from "./expansion-world.mjs";
import { canFundResidentStory, fundResidentStory } from "./expansion-economy.mjs";
// Stories attach to actual meetings. They hold no money; the resolver pays costs.
const LIMIT = 24, DAY = 1440;
const unavailable = 'Hikâye kararı tamamlanamadı.';
const fundingUnavailable = 'Bu destek şu anda kabul edilemiyor.';
const resolutions = {
  train: ['helped', 10, 'Belediye eğitim ücretini aldı. Komşunun mesleki becerisi gelişti.'],
  relocate: ['helped', 10, 'Taşınan komşunun borcuna destek oldun.'],
  repay: ['helped', 10, 'Komşunun borcuna destek oldun.'],
  help: ['helped', 10, 'Komşunun hane kasasına 100 TL aktardın. Bağınız güçlendi.'],
  listen: ['listened', 3, 'Komşunu dinledin; bağınız güçlendi.'],
  decline: ['declined', -5, 'Desteği reddettin; bağınız zayıfladı.'],
};
const init = () => ({ arcs: [], family: [], business: [], justice: [] });
export function initStories(s) { s.expansion.stories = init(); }
export function migrateStories(s) { if (!s.expansion.stories) initStories(s); else { s.expansion.stories.family ||= []; s.expansion.stories.business ||= []; s.expansion.stories.justice ||= []; for (const a of s.expansion.stories.arcs) a.kind ||= 'loyalty'; } }
export function tickStories(s) {
  const x = s.expansion.stories;
  if (!x) return;
  const today = Math.floor(s.time / DAY) + 1;
  const people = new Set(s.expansion.family.people.map(p=>p.id));
  for (const group of ['arcs','business']) x[group] = x[group].filter(a=>people.has(a.owner));
  x.family = x.family.filter(a=>people.has(a.owner) && people.has(a.person));
  x.justice = x.justice.filter(a=>s.expansion.underworld?.cases?.some(c=>c.id===a.id) && s.expansion.underworld?.incidents?.some(i=>i.id===a.id && i.personId===a.owner));
  const room = rows => { if (rows.length < 8) return true; const i = rows.findIndex(a=>a.status !== 'open'); if (i < 0) return false; rows.splice(i,1); return true; };
  for (const arc of [...(x.family || []), ...(x.business || [])]) if (arc.status === 'open' && s.time > arc.until) arc.status = 'expired';
  // A school-age child creates a choice between care and paid study, using the
  // family system's own actions and persistent care/learning values.
  for (const child of s.expansion.family.people) {
    const age = Math.floor((today - child.born) / 30);
    if (child.died !== null || !child.parents.includes(s.expansion.playerId) || age < 6 || age >= 18 || x.family.some(a => a.person === child.id)) continue;
    if (!room(x.family)) break;
    x.family.push({person:child.id, owner:s.expansion.playerId, name:child.name, status:'open', startedAt:s.time, until:s.time + 7*DAY});
  }
  const enterprise = s.deep?.business;
  if (enterprise?.status === 'active' && s.living?.enterprise?.capital < 500 && !x.business.some(a => a.owner === s.expansion.playerId && a.business === enterprise.id) && room(x.business))
    x.business.push({owner:s.expansion.playerId,business:enterprise.id,status:'open',startedAt:s.time,until:s.time+7*DAY});
  const law = s.expansion.underworld;
  for (const row of law?.cases || []) {
    const incident = law.incidents.find(i => i.id === row.id);
    if (!incident || row.reportedAt === null) continue;
    let arc = x.justice.find(a => a.id === row.id && a.owner === incident.personId);
    if (!arc && incident.personId !== s.expansion.playerId) continue;
    if (!arc && x.justice.length >= 12) {
      const i = x.justice.findIndex(a => ['convicted','acquitted','dismissed','closed'].includes(a.stage));
      if (i >= 0) x.justice.splice(i,1);
    }
    if (!arc && x.justice.length < 12) { arc = {id:row.id, owner:incident.personId, startedAt:row.reportedAt}; x.justice.push(arc); }
    if (arc) { arc.stage = row.status; arc.evidence = incident.evidence.filter(e => e.learnedAt !== null).length; }
  }
  for (const arc of s.expansion.stories?.arcs || []) {
    if (arc.status === 'open' && s.time > arc.until) { arc.status = 'expired'; arc.resolvedAt = s.time; }
  }
}
export function storyActions(s, api) {
  const arcs = s.expansion.stories?.arcs || [];
  const place = api.getPlace(s);
  const present = new Set((api.regionalResidents?.(s, place.regionId) || []).filter(p => localResident(p, place)).map(p => p.id));
  const active = arcs.filter(a => present.has(a.person) && a.owner === s.expansion.playerId && a.district === place.districtId && s.expansion.districts?.contacts?.[a.person]?.generation === a.generation);
  const actions = [];
  const add = (arc, choice, label, description, minutes, cost) => {
    const reason = calendarConflict(s, minutes) ||
      (arc.status === 'open' && s.time + minutes > arc.until ? 'Bu görüşme bitmeden destek süresi doluyor.'
        : cost > s.bank + s.cash ? 'Bu destek için yeterli bakiye yok.'
        : isFundedAid(choice) && !canFundResidentStory(s, arc.person, place.regionId, choice, cost) ? fundingUnavailable : '');
    actions.push({id:`story:${choice}:${arc.person}`, label, description, category:'world', minutes, cost, pay:'total', disabled:!!reason, reason, run:() => unavailable});
  };
  for (const arc of active) {
    if (arc.status === 'open' && s.time <= arc.until) {
      const resident = s.expansion.economy.residents[arc.person];
      const primary = arc.kind === 'ambition'
        ? ['train','Mesleki eğitime destek ol','Belediyeye 100 TL eğitim ücreti öde. Komşunun mesleki becerisi gelişir.',60,100]
        : arc.kind === 'migration' && resident.debt > 0
          ? ['relocate','Taşınan komşunun borcuna destek ol','Komşunun taşınma sonrası borcuna doğrudan ödeme yap.',60,Math.min(100,resident.debt)]
          : ['help','Komşuya destek ol','Komşunun hane kasasına 100 TL aktar. Bağınız güçlenir.',60,100];
      const debtChoice = arc.kind !== 'migration' && resident.debt > 0
        ? [['repay','Komşunun borcuna destek ol','Borç sahibinin yükümlülüğüne doğrudan ödeme yap.',60,Math.min(100,resident.debt)]] : [];
      for (const [choice,label,description,minutes,cost] of [
        primary, ...debtChoice,
        ['listen','Komşuyu dinle','Zaman ayır; bağ biraz güçlenir.',30,0],
        ['decline','Desteği reddet','Zaman kazan; bağ zayıflar.',10,0],
      ]) add(arc, choice, label, description, minutes, cost);
    }
    if (['helped','listened'].includes(arc.status) && (s.expansion.districts.contacts[arc.person].score >= 10) && s.time >= arc.resolvedAt + DAY && s.time >= arc.nextSupportAt) {
      if (s.player.skills.knowledge < 100) add(arc,'referral','İş bilgisi iste','Güvenin sayesinde mesleki bilgi edin; bilgi becerin artar.',30,0);
      add(arc,'support','Komşundan destek iste','Güçlü bağın sayesinde birlikte vakit geçir ve stresi azalt.',30,0);
    }
  }
  return actions;
}

const localResident = (person, place) => person.health > 0 && person.presentDistrictId === place.districtId;
const isFundedAid = (kind) => kind === 'help' || kind === 'train';

function refundStoryPayment(s, before, api, cost, paid = 0, label = 'Hikâye gideri iadesi') {
  // The resolver debits the bank first for a total-balance payment.
  const refund = cost - paid;
  const bankShare = Math.max(0, Math.min(before.bank, cost) - paid);
  const cashRoom = 1e9 - s.cash;
  const bank = Math.min(1e9 - s.bank, Math.max(bankShare, refund - cashRoom));
  const cash = Math.min(cashRoom, refund - bank);
  if (bank) api.receive(s, bank, label, 'bank');
  if (cash) api.receive(s, cash, label, 'cash');
  return bank + cash;
}

export function afterStoryAction(s, id, before, api, action) {
  const choice = /^story:(help|train|relocate|repay|listen|decline|support|referral):(resident:.+)$/.exec(id);
  if (choice) {
    const [, kind, person] = choice;
    const contact = s.expansion.districts?.contacts?.[person];
    const arc = s.expansion.stories?.arcs.find(a => a.owner === before.expansion.playerId && a.person === person && a.generation === contact?.generation);
    const life = s.expansion.economy?.residents?.[person]?.life;
    const owner = s.expansion.family?.people?.find(p => p.id === before.expansion.playerId);
    const place = api.getPlace(s);
    const followUp = kind === 'referral' || kind === 'support';
    const cancel = () => {
      const refunded = refundStoryPayment(s, before, api, action.cost);
      return refunded && refunded === action.cost ? 'Destek tamamlanamadı. Ödeme iade edildi.' : unavailable;
    };
    if (!arc || !contact || !owner || owner.died !== null || !life || life.health <= 0 || life.generation !== arc.generation ||
        s.expansion.playerId !== before.expansion.playerId || s.time !== before.time + action.minutes || place.districtId !== arc.district ||
        (!followUp && (arc.status !== 'open' || s.time > arc.until)) ||
        !api.regionalResidents?.(s, place.regionId)?.some(p => p.id === person && p.generation === arc.generation && localResident(p, place))) return cancel();
    if (followUp) {
      arc.nextSupportAt = s.time + 7 * DAY; arc.supportCount = Math.min(99, arc.supportCount + 1);
      if (kind === 'referral') api.skill(s,'knowledge',2);
      else api.change(s,{stress:-8});
      recordSocietyMemory(s,person,`story.${kind}`,1,arc.district);
      return kind === 'referral' ? 'Komşunun iş bilgisi becerini geliştirdi.'
        : 'Komşunla vakit geçirmek stresini azalttı.';
    }
    if (isFundedAid(kind) && !fundResidentStory(s, api, person, place, kind, action.cost)) return cancel();
    if (kind === 'relocate' || kind === 'repay') {
      const paid = api.payResidentDebt?.(s, person, action.cost) || 0;
      if (!paid) return cancel();
      refundStoryPayment(s, before, api, action.cost, paid, 'Borç desteği iadesi');
    }
    const [status, trust, message] = resolutions[kind];
    arc.status = status; arc.resolvedAt = s.time;
    contact.score = Math.max(1,Math.min(100,contact.score + trust));
    recordSocietyMemory(s,person,`story.${status}`,trust,arc.district);
    return message;
  }
  if (/^underworld:(report|inspect|fine|compensation):/.test(id)) tickStories(s);
  const business = s.expansion.stories?.business || [];
  if (/^business:(fund:|pause$)/.test(id)) {
    const prior = before.expansion.stories?.business?.find(a => a.status === 'open' && a.owner === before.expansion.playerId && before.time <= a.until);
    const arc = prior && business.find(a => a.owner === prior.owner && a.business === prior.business);
    if (arc && s.expansion.playerId === before.expansion.playerId) arc.status = id.startsWith('business:fund:') ? 'funded' : 'paused';
  }
  const family = s.expansion.stories?.family || [];
  const match = /^family:(care|focus):(family:\d+)(?::.*)?$/.exec(id);
  if (match) {
    const wasOpen = before.expansion.stories?.family?.some(a => a.person === match[2] && a.owner === before.expansion.playerId && a.status === 'open' && before.time <= a.until);
    const arc = wasOpen && family.find(a => a.person === match[2] && a.owner === s.expansion.playerId && ['open','expired'].includes(a.status));
    if (arc) arc.status = match[1] === 'care' ? 'care' : 'study';
  }
  if (!id.startsWith('district:meet:') || before.expansion.playerId !== s.expansion.playerId) return;
  const person = id.slice('district:meet:'.length), contact = s.expansion.districts?.contacts?.[person];
  if (!contact) return;
  const x = s.expansion.stories, owner = s.expansion.playerId;
  if (x.arcs.some(a => a.person === person && a.generation === contact.generation && a.owner === owner)) return;
  if (x.arcs.length >= LIMIT) { const i = x.arcs.findIndex(a => a.status !== 'open'); if (i < 0) return; x.arcs.splice(i,1); }
  const place = api.getPlace(before);
  const resident = api.regionalResidents?.(s,place.regionId)?.find(p => p.id === person);
  const recentMove = resident?.history?.some(h => h.generation === contact.generation && h.kind === 'move' && h.day >= Math.floor(s.time / DAY) + 1 - 7);
  const kind = recentMove && resident.debt > 0 ? 'migration' : resident?.employment === 'searching' && resident.skill < 100 ? 'ambition' : 'loyalty';
  x.arcs.push({kind,id:`${owner}|${person}|${contact.generation}`, owner, person, name:contact.name, generation:contact.generation, district:api.getPlace(before).districtId, status:'open', startedAt:s.time, until:s.time + 3*DAY, resolvedAt:0, nextSupportAt:0, supportCount:0});
}
export function storyView(s) { return { arcs:(s.expansion.stories?.arcs || []).map(a => ({...a})), family:(s.expansion.stories?.family || []).map(a => ({...a})), business:(s.expansion.stories?.business || []).map(a => ({...a})), justice:(s.expansion.stories?.justice || []).map(a => ({...a})) }; }
export function validateStories(s) {
  const x = s.expansion.stories;
  if (!x) return s.expansion.deepSociety !== 3;
  const within = (rows, limit) => Array.isArray(rows) && rows.length <= limit;
  if (typeof x !== 'object' || !within(x.arcs,LIMIT) || !within(x.family,8) || !within(x.business,8) || !within(x.justice,12)) return false;
  const named = (row, keys) => keys.every(k => typeof row[k] === 'string' && row[k].length > 0 && row[k].length <= 160);
  const timed = (a) => integer(a.startedAt,0,s.time) && a.until === a.startedAt + 7*DAY;
  if (!x.family.every(a => a && named(a,['person','owner','name']) && s.expansion.family?.people?.some(p => p.id === a.person && p.parents.includes(a.owner)) && ['open','care','study','expired'].includes(a.status) && timed(a))) return false;
  if (!x.business.every(a => a && named(a,['owner','business']) && ['open','funded','paused','expired'].includes(a.status) && timed(a))) return false;
  if (!x.justice.every(a => a && integer(a.id,1,Infinity) && typeof a.owner === 'string' && integer(a.startedAt,0,s.time) && integer(a.evidence,0,2) && typeof a.stage === 'string' && s.expansion.underworld?.incidents?.some(i=>i.id===a.id && i.personId===a.owner && i.evidence.filter(e=>e.learnedAt!==null).length===a.evidence) && s.expansion.underworld?.cases?.some(c=>c.id===a.id && c.reportedAt===a.startedAt && c.status===a.stage))) return false;
  const ids = new Set();
  return x.arcs.every(a => {
    if (!a || typeof a !== 'object' || !named(a,['id','owner','person','name','district']) || ids.has(a.id)) return false;
    ids.add(a.id);
    const resident = s.expansion.economy?.residents?.[a.person];
    const owner = s.expansion.family?.people?.some(p => p.id === a.owner);
    if (!['loyalty','ambition','migration'].includes(a.kind) || !resident || !owner || a.generation > resident.life.generation || a.id !== `${a.owner}|${a.person}|${a.generation}` || a.startedAt > s.time || a.until !== a.startedAt + 3*DAY || a.resolvedAt > s.time || a.nextSupportAt > s.time + 7*DAY) return false;
    if (a.status === 'open' ? a.resolvedAt !== 0 : a.resolvedAt < a.startedAt) return false;
    return ['open','helped','listened','declined','expired'].includes(a.status) && ['generation','startedAt','until','resolvedAt','nextSupportAt','supportCount'].every(k => Number.isSafeInteger(a[k]) && a[k] >= 0) && a.until >= a.startedAt && a.supportCount <= 99;
  });
}
