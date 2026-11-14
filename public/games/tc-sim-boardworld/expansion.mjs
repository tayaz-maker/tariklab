import { closeHousehold } from "./life-systems.mjs";
import { EXPANSION_SAVE_VERSION, createGame } from "./engine.mjs";
import {
  initFamily,
  familyActions,
  tickFamily,
  validateFamily,
  familyView,
  familyCanAct,
  familyIsRetired,
  familyBlocksRomance,
  afterFamilyAction,
} from "./expansion-family.mjs";
import {
  initEconomy,
  economyActions,
  tickEconomy,
  validateEconomy,
  economyView,
  regionalMarkets,
  regionalShift,
  payBusinessOverhead,
  adaptEconomyActions,
  afterEconomyAction,
  economyNpcHousingCost,
  underworldOrder,
  fulfillUnderworldOrder,
} from "./expansion-economy.mjs";
import {
  initInstitutions,
  institutionActions,
  tickInstitutions,
  validateInstitutions,
  institutionsView,
  adaptInstitutionActions,
  afterInstitutionAction,
  onInstitutionSuccession,
  creditMunicipalTax,
} from "./expansion-institutions.mjs";
import {
  initWorld,
  worldActions,
  tickRegions,
  validateWorld,
  adaptWorldActions,
  calendarPlanningReason,
} from "./expansion-world.mjs";
import {
  getPlace,
  getDistrictSimulation,
  districtActions,
  adaptDistrictActions,
  afterDistrictAction,
  tickDistricts,
  validateDistricts,
  districtView,
} from "./expansion-districts.mjs";
import {
  underworldActions,
  adaptUnderworldActions,
  afterUnderworldAction,
  tickUnderworld,
  validateUnderworld,
  underworldView,
  underworldDistrictModifiers,
  nextUnderworldAt,
  reconcileUnderworldTime,
} from "./expansion-underworld.mjs";

export { familyCanAct };
export { EXPANSION_SAVE_VERSION, createGame };
const HISTORY_LIMIT = 240;
let runtimeApi;

// Install expansion-only adapters once; all adapters retain Gold semantics for v6 states.
export function attachExpansion(api) {
  runtimeApi = api;
  const housingCost = api.npcHousingCost;
  const present = api.playerPresent;
  api.npcHousingCost = (s, id, base) => {
    const cost = housingCost(s, id, base);
    return s.expansion ? economyNpcHousingCost(s, id, cost) : cost;
  };
  api.playerPresent = (s, district) =>
    present(s, district) && (!s.expansion || s.expansion.world.region === "istanbul");
  api.planningReason = calendarPlanningReason;
  api.regionalShift = regionalShift;
  api.payBusinessOverhead = (s) => payBusinessOverhead(s, api);
  api.expansionEvent = expansionEvent;
  api.creditMunicipalTax = creditMunicipalTax;
  api.getPlace = getPlace;
  api.getDistrictSimulation = getDistrictSimulation;
  api.underworldDistrictModifiers = underworldDistrictModifiers;
  api.underworldOrder = underworldOrder;
  api.fulfillUnderworldOrder = fulfillUnderworldOrder;
  api.regionalResidents = (s, region) => regionalMarkets(s, true)[region]?.residents ?? [];
  api.closeHousehold = (s, reason) => closeHousehold(s, reason, api);
  api.settleCareer = (s) => {
    if (s.job) api.receive(s, s.job.earned, "İşten ayrılma · kazanılmış ücret", "bank");
    s.job = null;
    Object.assign(s.deep.career, { employerJobId: null, negotiatedBonus: 0, noticeDay: 0 });
  };
  // Property and enterprise stay in the household estate across successors.
}

export function initExpansion(s) {
  s.version = EXPANSION_SAVE_VERSION;
  s.expansion = { playerId: "player:1", nextEvent: 1, events: [] };
  initWorld(s);
  initFamily(s);
  initEconomy(s);
  initInstitutions(s);
}

export function expansionEvent(s, type, subject, detail) {
  const e = s.expansion;
  e.events.push({ id: e.nextEvent++, at: s.time, type, subject, detail });
  if (e.events.length > HISTORY_LIMIT) e.events.shift();
}

export function tickExpansion(s, api) {
  tickEconomy(s, api);
  tickInstitutions(s, api);
  tickFamily(s, api);
  if ((api.dayOf(s) - s.expansion.world.startedDay) % 30 === 0)
    tickRegions(s, api, regionalMarkets(s));
  tickDistricts(s, api);
  tickUnderworld(s, api);
}

export const nextExpansionAt = nextUnderworldAt;
export const afterExpansionTime = reconcileUnderworldTime;

export function expansionActions(s, actions, api) {
  if (!familyCanAct(s)) return familyActions(s, api);
  const adapted = adaptEconomyActions(s, actions, api);
  const combined = adapted.concat(
    familyActions(s, api),
    economyActions(s, api),
    institutionActions(s, api),
    worldActions(s, api),
    districtActions(s, api),
    underworldActions(s, api),
  );
  const retired = familyIsRetired(s);
  const eligible = combined.filter((a) => {
    if (retired && /^(work$|apply:|world:shift$|district:(apply|shift)$)/.test(a.id)) return false;
    const romance = /^(?:date:|partner:|life:romance:)([^:]+)$/.exec(a.id);
    return !romance || !familyBlocksRomance(s, romance[1]);
  });
  return adaptUnderworldActions(
    s,
    adaptDistrictActions(s, adaptWorldActions(s, adaptInstitutionActions(s, eligible, api)), api),
    api,
  );
}

export function afterExpansionAction(s, id, before, api, action) {
  if (s.expansion.playerId !== before.expansion.playerId) onInstitutionSuccession(s, api);
  afterFamilyAction(s, id, api);
  afterEconomyAction(s, before, api, action);
  const districtMessage = afterDistrictAction(s, id, before, api, action);
  afterInstitutionAction(s, id, before, api);
  const underworldMessage = afterUnderworldAction(s, id, before, api, action);
  return underworldMessage || districtMessage;
}

export function getExpansionView(s) {
  if (!s.expansion) return null;
  return {
    world: s.expansion.world,
    events: s.expansion.events,
    family: familyView(s),
    economy: economyView(s),
    institutions: institutionsView(s),
    districts: districtView(s, runtimeApi),
    underworld: underworldView(s, runtimeApi),
  };
}

export function validateExpansion(s) {
  const e = s.expansion;
  if (
    !e ||
    typeof e !== "object" ||
    Array.isArray(e) ||
    typeof e.playerId !== "string" ||
    !/^(player:1|family:[1-9]\d*)$/.test(e.playerId) ||
    !Number.isSafeInteger(e.nextEvent) ||
    e.nextEvent < 1 ||
    !Array.isArray(e.events) ||
    e.events.length > HISTORY_LIMIT
  )
    return false;
  let prior = 0;
  for (const row of e.events) {
    if (
      !row ||
      !Number.isSafeInteger(row.id) ||
      row.id <= prior ||
      row.id >= e.nextEvent ||
      !Number.isSafeInteger(row.at) ||
      row.at < 0 ||
      row.at > s.time ||
      typeof row.type !== "string" ||
      !/^[a-z][a-z.-]{0,63}$/.test(row.type) ||
      ![row.subject, row.detail].every((value) => typeof value === "string" && value.length <= 180)
    )
      return false;
    prior = row.id;
  }
  return (
    validateWorld(s) &&
    validateFamily(s) &&
    validateEconomy(s) &&
    validateInstitutions(s) &&
    validateDistricts(s) &&
    validateUnderworld(s)
  );
}
