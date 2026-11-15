import { NPCS } from "./content.mjs";
import { getDistrictSimulation } from "./expansion-districts.mjs";
import { regionalMarkets, residentPersonality, underworldOrder } from "./expansion-economy.mjs";
import { districtById } from "./expansion-geography.mjs";
import {
  initOrganizationPolitics, organizationPolicyActions, organizationSocietyView,
  validateOrganizationPolitics,
} from "./expansion-underworld.mjs";

const goldIds = new Set(NPCS.map(({ id }) => id));
const day = (s) => Math.floor(s.time / 1440) + 1;
const bounded = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const memoryKind = /^[a-z][a-z0-9.-]{0,47}$/;
const identity = (s, id) => goldIds.has(id) ? 1
  : s.expansion?.economy?.residents?.[id]?.life?.generation;

export function initSociety(s) {
  s.expansion.society = { lastDay: day(s), connections: {}, organizations: initOrganizationPolitics(s) };
}

export function migrateSociety(s) {
  if (!s.expansion.society) initSociety(s);
}

export function recordSocietyMemory(s, id, kind, trustDelta = 0, districtId) {
  const society = s.expansion?.society;
  const generation = identity(s, id);
  if (!society || !generation || !memoryKind.test(kind) || !Number.isInteger(trustDelta) ||
      (districtId !== undefined && districtById(districtId)?.id !== districtId)) return false;
  const prior = society.connections[id];
  const row = prior?.generation === generation ? prior : { generation, trust: 0, memory: [] };
  if (goldIds.has(id)) s.npcs[id].trust = bounded(s.npcs[id].trust + trustDelta);
  else row.trust = bounded(row.trust + trustDelta, -100);
  row.memory.push({ kind, day: day(s), ...(districtId === undefined ? {} : { districtId }) });
  if (row.memory.length > 6) row.memory.shift();
  society.connections[id] = row;
  return true;
}

export function tickSociety(s) {
  const society = s.expansion?.society;
  const today = day(s);
  if (!society || society.lastDay >= today) return;
  society.lastDay = today;
  for (const [id, row] of Object.entries(society.connections))
    if (identity(s, id) !== row.generation) delete society.connections[id];
}

export function societyActions(s, api) {
  return organizationPolicyActions(s, api);
}

export function societyView(s, api = {}) {
  const society = s.expansion?.society;
  if (!society) return null;
  const localContacts = s.expansion.districts?.contacts;
  const residents = Object.values(regionalMarkets(s, true)).flatMap(({ residents }) =>
    residents.map(({ contacts, history, ...row }) => {
      const relationship = society.connections[row.id];
      const contact = localContacts?.[row.id];
      return {
        ...row, ...residentPersonality(s, row.id, row.generation),
        trust: bounded((contact?.generation === row.generation ? contact.score : 0) + (relationship?.trust ?? 0)),
        contacts,
        memory: history.filter(({ generation }) => generation === row.generation)
          .concat(relationship?.memory ?? []).sort((a, b) => a.day - b.day).slice(-8),
      };
    }),
  );
  const citizens = NPCS.map(({ id, name, role }) => {
    const { cash, savings, debt, employment, employer, skill, home, ties, knownFacts } = s.deep.npcs[id];
    return {
      id, name, role, generation: 1, ...residentPersonality(s, id, 1),
      districtId: home, locationId: api.getNpcLocation?.(s, id) ?? null,
      cash, savings, debt, employment, employer, skill, home, contacts: ties,
      trust: s.npcs[id].trust, memory: society.connections[id]?.memory ?? [],
      knownInformation: knownFacts,
    };
  });
  return {
    characters: residents.concat(citizens),
    organizations: organizationSocietyView(s, { getDistrictSimulation, underworldOrder }),
  };
}

const keys = (row, fields) => row && typeof row === "object" && !Array.isArray(row) &&
  Object.keys(row).length === fields.length && fields.every((field) => Object.hasOwn(row, field));
const range = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;

export function validateSociety(s) {
  const society = s.expansion.society;
  if (society === undefined) return s.expansion.deepSociety === undefined;
  const today = day(s);
  if (!keys(society, ["lastDay", "connections", "organizations"]) ||
      !range(society.lastDay, 1, today) || !society.connections ||
      typeof society.connections !== "object" || Array.isArray(society.connections) ||
      !validateOrganizationPolitics(s, society.organizations, today)) return false;
  return Object.entries(society.connections).every(([id, row]) =>
    keys(row, ["generation", "trust", "memory"]) && Number.isSafeInteger(row.generation) &&
    identity(s, id) === row.generation && range(row.trust, goldIds.has(id) ? 0 : -100, goldIds.has(id) ? 0 : 100) &&
    Array.isArray(row.memory) && row.memory.length > 0 && row.memory.length <= 6 &&
    row.memory.every((entry, index) => keys(entry, Object.hasOwn(entry ?? {}, "districtId")
      ? ["kind", "day", "districtId"] : ["kind", "day"]) &&
      typeof entry.kind === "string" && memoryKind.test(entry.kind) &&
      range(entry.day, index ? row.memory[index - 1].day : 1, today) &&
      (!Object.hasOwn(entry, "districtId") ||
        (typeof entry.districtId === "string" && districtById(entry.districtId)?.id === entry.districtId))),
  );
}
