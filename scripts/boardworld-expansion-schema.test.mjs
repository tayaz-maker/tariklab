import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../public/games/tc-sim-boardworld/engine.mjs";
import { validateFamily } from "../public/games/tc-sim-boardworld/expansion-family.mjs";
import { validateEconomy } from "../public/games/tc-sim-boardworld/expansion-economy.mjs";

await engine.loadExpansionRuntime();
// Controls and malformed variants were independently checked against released
// schema-7 semantics before the shared field-validator refactor.
const game = { engine, family: validateFamily, economy: validateEconomy };
const start = game.engine.createGame({ seed: 303, scenario: "restart", expansion: true });
const day = (s) => Math.floor(s.time / 1440) + 1;
const economy = (s) => s.expansion.economy;
const family = (s) => s.expansion.family;
const p = (s, id) => economy(s).properties[id];
const n = (s, city = "ankara", i = 0) => economy(s).residents[`resident:${city}:${i}`];
const firm = (s, id = "ankara:repair") => economy(s).firms[id];
const person = (s, id = "player:1") => family(s).people.find((row) => row.id === id);
const child = (s) => person(s, "family:2");
const npcs = (s, i) => family(s).background[i].residents;
const home = (s, i = 0) => family(s).background[i];
const lease = (s, tenant) => ({
  tenant,
  rent: 1000,
  deposit: 1000,
  dueDay: day(s) + 30,
  arrears: 0,
  missed: 0,
});
const mortgage = (s) => ({ principal: 30000, interest: 0, dueDay: day(s) + 30, missed: 0 });
const union = (s, second = "npc:mert", status = "married") => ({
  id: "union:1",
  first: "player:1",
  second,
  status,
  since: 1,
  changed: 1,
});
const expected = (s) => ({ parents: ["player:1", "npc:mert"], due: day(s) + 24 });
const defineNpc = (s, id, name) => {
  const npc = {
    ...child(s),
    id: `npc:${id}`,
    name,
    npcId: id,
    parents: [],
    born: -30 * 30,
    died: null,
    retired: false,
  };
  family(s).people.push(npc);
  return npc;
};
function check(kind, description, setup = () => {}, mutation = () => {}, expectedValue = false) {
  test(`${kind} validation: ${description}`, () => {
    const original = structuredClone(start);
    setup(original);
    assert.equal(game[kind](original), true, `bad control for ${description}`);
    const probe = structuredClone(original);
    mutation(probe);
    const originalBytes = JSON.stringify(probe);
    assert.equal(game[kind](probe), expectedValue, description);
    assert.equal(JSON.stringify(probe), originalBytes, `validator mutated ${description}`);
  });
}

const ec = (...args) => check("economy", ...args);
const fa = (...args) => check("family", ...args);

const ownedResident = (s) => (p(s, "ankara:room").owner = "resident:ankara:0");
const ownedHousehold = (s) => (p(s, "ankara:room").owner = "household");
const residentLease = (s) => {
  ownedHousehold(s);
  p(s, "ankara:room").lease = lease(s, "resident:ankara:0");
};
const occupy = (s) => {
  economy(s).home = "ankara:room";
  Object.assign(s.housing, { id: "room", rent: 0, deposit: 0 });
};
const householdLease = (s) => {
  occupy(s);
  p(s, "ankara:room").lease = lease(s, "household");
};
const ownedHome = (s) => {
  ownedHousehold(s);
  occupy(s);
};
const withMortgage = (s) => {
  ownedHousehold(s);
  p(s, "ankara:room").mortgage = mortgage(s);
};
const legacy = (s) => {
  for (const account of Object.values(economy(s).residents)) delete account.life;
};
function actorMove(s) {
  n(s).life.region = "izmir";
  n(s).life.employer = "izmir:repair";
  firm(s, "izmir:repair").workers++;
}
const unassign = (s) => {
  n(s).employment = "searching";
  n(s).life.employer = "";
};
const opening = (s) => {
  let next = s;
  while (next.pendingEvents.length) {
    const action = game.engine
      .getActions(next)
      .find((a) => a.id.startsWith("event:") && !a.disabled);
    next = game.engine.resolveAction(next, action.id).state;
  }
  const result = game.engine.resolveAction(next, "business:start:repair");
  assert.ok(result.ok, result.message);
  Object.assign(s, result.state);
};
const credit = (s) => {
  opening(s);
  Object.assign(economy(s).business, { principal: 3000, installmentDay: day(s) + 30 });
};
const partner = (s) => defineNpc(s, "mert", "Mert Aksoy");
const married = (s) => {
  partner(s);
  family(s).unions.push(union(s));
};
const pregnancy = (s) => {
  married(s);
  family(s).expected = expected(s);
};
const estate = (s) => {
  person(s).died = 1;
  s.expansion.playerId = child(s).id;
  s.player.name = child(s).name;
  s.flags.workDays = 12;
  family(s).lastEstate = {
    from: "player:1",
    to: child(s).id,
    day: 1,
    cash: s.cash,
    bank: s.bank,
    debt: s.debt,
    workDays: 8,
  };
};
const justAncestors = (s) => {
  const [parent, kid] = npcs(s, 0);
  const [other] = npcs(s, 1);
  parent.born = -76 * 30;
  kid.born = -25 * 30;
  kid.parents = [parent.id];
  home(s).ancestors = [{ id: parent.id, born: parent.born, died: 1 }];
  home(s).residents = [kid];
  other.parents = [];
};

ec("all-six optional profiles absent remains a valid legacy economy", legacy, undefined, true);
ec("one optional life absent with five present", undefined, (s) => delete n(s).life);
ec("legacy property owner valid by its original encoded region", legacy, ownedResident, true);
ec(
  "legacy title cannot identify an actor from another original region",
  legacy,
  (s) => (p(s, "izmir:room").owner = "resident:ankara:0"),
);
ec("duplicate stable property account replaced by unexpected key", undefined, (s) => {
  const lots = economy(s).properties;
  lots["ankara:unknown"] = lots["ankara:room"];
  delete lots["ankara:room"];
});
ec("firm ID substituted with unknown region at same map size", undefined, (s) => {
  const stocks = economy(s).firms;
  stocks["denizli:repair"] = stocks["ankara:repair"];
  delete stocks["ankara:repair"];
});
ec("resident account missing despite same count", undefined, (s) => {
  const actors = economy(s).residents;
  actors["resident:ankara:3"] = actors["resident:ankara:0"];
  delete actors["resident:ankara:0"];
});
ec("employer in another city", undefined, (s) => (n(s).life.employer = "izmir:repair"));
ec(
  "employer is unknown though region-like",
  undefined,
  (s) => (n(s).life.employer = "ankara:unknown"),
);
ec("employed account without employer", undefined, (s) => (n(s).life.employer = ""));
ec("searching account with assigned employer", undefined, (s) => (n(s).employment = "searching"));
ec(
  "local actor lacks qualification for assigned business",
  undefined,
  (s) => (n(s).life.skill = 0),
);
ec("valid firm shape but closed firm retains named employee", undefined, (s) =>
  Object.assign(firm(s), {
    status: "closed",
    workers: 0,
    stock: 0,
    reopenDay: day(s) + 30,
    failed: 3,
  }),
);
ec(
  "two named employees exceed staffed capacity",
  actorMove,
  (s) => firm(s, "izmir:repair").workers--,
);
ec("two named employees match capacity", actorMove, undefined, true);
ec("age 67 cannot keep an employer", undefined, (s) => (n(s).life.born = day(s) - 30 * 67));
ec(
  "age 67 may retire without an employer",
  unassign,
  (s) => (n(s).life.born = day(s) - 30 * 67),
  true,
);
ec(
  "age 66 can retain an employer",
  undefined,
  (s) => (n(s).life.born = day(s) - 30 * 67 + 1),
  true,
);
ec(
  "age below 18 cannot take over regional account",
  unassign,
  (s) => (n(s).life.born = day(s) - 30 * 18 + 1),
);
ec("age exactly 18 can be unemployed", unassign, (s) => (n(s).life.born = day(s) - 30 * 18), true);
ec(
  "age exactly 90 valid without an employer",
  unassign,
  (s) => (n(s).life.born = day(s) - 30 * 90),
  true,
);
ec(
  "regional age maximum uses birth-day precision",
  unassign,
  (s) => (n(s).life.born = day(s) - 30 * 90 - 1),
);
ec(
  "generation must stay within persisted count bounds",
  undefined,
  (s) => (n(s).life.generation = 400001),
);
ec(
  "high valid generation is not derived from current age",
  undefined,
  (s) => (n(s).life.generation = 400000),
  true,
);
ec(
  "title follows current migrated resident region",
  actorMove,
  (s) => (p(s, "izmir:room").owner = "resident:ankara:0"),
  true,
);
ec("former region title after resident movement", actorMove, ownedResident);
ec(
  "Istanbul NPC cannot hold regional title",
  undefined,
  (s) => (p(s, "ankara:room").owner = "mert"),
);
ec(
  "Istanbul NPC can hold Istanbul title",
  undefined,
  (s) => (p(s, "istanbul:room").owner = "mert"),
  true,
);
ec(
  "same resident cannot own two titles",
  ownedResident,
  (s) => (p(s, "ankara:studio").owner = "resident:ankara:0"),
);
ec(
  "household can own multiple titles",
  ownedHousehold,
  (s) => (p(s, "ankara:studio").owner = "household"),
  true,
);
ec(
  "mortgage cannot be carried by market",
  withMortgage,
  (s) => (p(s, "ankara:room").owner = "market"),
);
ec("mortgage cannot be carried by NPC", withMortgage, ownedResident);
ec(
  "mortgage due today is unsettled and invalid",
  withMortgage,
  (s) => (p(s, "ankara:room").mortgage.dueDay = day(s)),
);
ec(
  "mortgage due beyond one settlement interval",
  withMortgage,
  (s) => (p(s, "ankara:room").mortgage.dueDay = day(s) + 31),
);
ec(
  "NPC lease holder cannot equal owner",
  residentLease,
  (s) => (p(s, "ankara:room").owner = "resident:ankara:0"),
);
ec(
  "NPC tenant cannot rent market inventory directly",
  residentLease,
  (s) => (p(s, "ankara:room").owner = "market"),
);
ec(
  "NPC tenant cannot rent across region",
  residentLease,
  (s) => (p(s, "ankara:room").lease.tenant = "resident:izmir:0"),
);
ec(
  "Istanbul NPC tenant must reside in Istanbul",
  residentLease,
  (s) => (p(s, "ankara:room").lease.tenant = "mert"),
);
ec("NPC cannot rent multiple homes", residentLease, (s) => {
  p(s, "ankara:studio").owner = "household";
  p(s, "ankara:studio").lease = lease(s, "resident:ankara:0");
});
ec(
  "NPC cannot own another title while leasing",
  residentLease,
  (s) => (p(s, "ankara:studio").owner = "resident:ankara:0"),
);
ec(
  "household lease and title on different properties coexist",
  householdLease,
  (s) => (p(s, "izmir:room").owner = "household"),
  true,
);
ec("household market lease is allowed as home", householdLease, undefined, true);
ec(
  "household lease must agree with the selected home ID",
  householdLease,
  (s) => (economy(s).home = ""),
);
ec(
  "household occupied title cannot be let simultaneously",
  ownedHome,
  (s) => (p(s, "ankara:room").lease = lease(s, "resident:ankara:0")),
);
ec(
  "household leased home must agree with Gold home anchor",
  householdLease,
  (s) => (s.housing.id = "studio"),
);
ec(
  "household leased home cannot retain duplicate Gold rent",
  householdLease,
  (s) => (s.housing.rent = 3000),
);
ec(
  "household leased home cannot retain duplicate Gold deposit",
  householdLease,
  (s) => (s.housing.deposit = 3000),
);
ec(
  "remote previous home stays valid after player moves",
  householdLease,
  (s) => (s.expansion.world.region = "izmir"),
  true,
);
ec(
  "business expansion ledger exists without a core company",
  opening,
  (s) => (s.deep.business = null),
);
ec("core company exists without expansion ledger", opening, (s) => (economy(s).business = null));
ec(
  "business tax point cannot exceed cumulative company revenue",
  opening,
  (s) => (economy(s).business.lastTaxRevenue = s.deep.business.revenue + 1),
);
ec(
  "paid principal must clear next installment",
  credit,
  (s) => (economy(s).business.principal = 0),
);
ec(
  "outstanding principal requires future installment",
  credit,
  (s) => (economy(s).business.installmentDay = 0),
);
ec(
  "business installment outside 30-day window",
  credit,
  (s) => (economy(s).business.installmentDay = day(s) + 31),
);
ec(
  "open enterprise cannot have a pending reopen date",
  undefined,
  (s) => (firm(s).reopenDay = day(s) + 30),
);
ec(
  "open enterprise must have at least one worker even without named staff",
  unassign,
  (s) => (firm(s).workers = 0),
);
ec("open firm must close at the third missed settlement", undefined, (s) => (firm(s).failed = 3));
ec(
  "closed firm can have a historic reopen date",
  unassign,
  (s) => {
    s.time += 60 * 1440;
    economy(s).lastDay = day(s);
    Object.assign(firm(s), { status: "closed", workers: 0, stock: 0, reopenDay: 1, failed: 3 });
  },
  true,
);
ec(
  "closed firm may keep failure count below 3 in legacy validated state",
  unassign,
  (s) =>
    Object.assign(firm(s), {
      status: "closed",
      workers: 0,
      stock: 0,
      reopenDay: day(s) + 30,
      failed: 0,
    }),
  true,
);
ec("closed firm cannot hold production inventory", unassign, (s) =>
  Object.assign(firm(s), {
    status: "closed",
    workers: 0,
    stock: 1,
    reopenDay: day(s) + 30,
    failed: 3,
  }),
);
ec("closed firm cannot retain aggregate workers", unassign, (s) =>
  Object.assign(firm(s), {
    status: "closed",
    workers: 1,
    stock: 0,
    reopenDay: day(s) + 30,
    failed: 3,
  }),
);
ec("closed firm reopen deadline may not exceed today plus 30", unassign, (s) =>
  Object.assign(firm(s), {
    status: "closed",
    workers: 0,
    stock: 0,
    reopenDay: day(s) + 31,
    failed: 3,
  }),
);

fa(
  "Gold without expansion remains allowed by family validator",
  undefined,
  (s) => delete s.expansion,
  true,
);
fa("founder required after changing active successor", estate, (s) =>
  family(s).people.splice(family(s).people.indexOf(person(s)), 1),
);
fa(
  "active ID must reference a family person",
  undefined,
  (s) => (s.expansion.playerId = "family:89"),
);
fa(
  "current character may be dead and awaiting a successor",
  undefined,
  (s) => (person(s).died = 1),
  true,
);
fa("active name must match core player name", undefined, (s) => (person(s).name += " X"));
fa("active age below eighteen", undefined, (s) => (person(s).born = day(s) - 18 * 30 + 1));
fa("exact minimum active adult age", undefined, (s) => (person(s).born = day(s) - 18 * 30), true);
fa("retirement age floor even after death", undefined, (s) => (person(s).retired = true));
fa("duplicate first-generation ID", undefined, (s) => family(s).people.push({ ...person(s) }));
fa(
  "future numeric family ID cannot equal nextPerson",
  undefined,
  (s) => (child(s).id = `family:${family(s).nextPerson}`),
);
fa("parent must exist", undefined, (s) => (child(s).parents = ["family:88"]));
fa("one parent cannot appear twice", undefined, (s) => child(s).parents.push(child(s).parents[0]));
fa("parent cannot be their own child", undefined, (s) => (person(s).parents = [person(s).id]));
fa(
  "cyclic parentage has at least one impossible age edge",
  undefined,
  (s) => (person(s, "family:1").parents = ["player:1"]),
);
fa(
  "parent under eighteen on child's birthday",
  undefined,
  (s) => (person(s, "family:1").born = child(s).born - 18 * 30 + 1),
);
fa(
  "parent age exactly eighteen accepted for biological tree",
  undefined,
  (s) => {
    const parent = person(s, "family:1");
    parent.born = child(s).born - 18 * 30;
    person(s).born = child(s).born;
  },
  true,
);
fa(
  "founder ancestor can predate recorded day one",
  undefined,
  (s) => (person(s, "family:1").born = -10000),
  true,
);
fa(
  "child can be born up to 24 days after recorded parent death",
  undefined,
  (s) => {
    const parent = person(s, "family:1");
    parent.died = 1;
    s.time = 24 * 1440;
    child(s).born = 25;
  },
  true,
);
fa("child cannot be born 25 days after recorded parent death", undefined, (s) => {
  const parent = person(s, "family:1");
  parent.died = 1;
  s.time = 25 * 1440;
  child(s).born = 26;
});
fa(
  "NPC ID must correspond to exact authored name",
  partner,
  (s) => (person(s, "npc:mert").name = "Someone else"),
);
fa("NPC cannot be marked dead in family tree", partner, (s) => (person(s, "npc:mert").died = 1));
fa("NPC cannot be retired in family tree", partner, (s) => {
  const npc = person(s, "npc:mert");
  npc.born = -62 * 30;
  npc.retired = true;
});
fa("NPC cannot become active playable person", partner, (s) => {
  s.expansion.playerId = "npc:mert";
  s.player.name = "Mert Aksoy";
});
fa(
  "union second must address an authored NPC partner",
  married,
  (s) => (family(s).unions[0].second = "family:2"),
);
fa("union first must be a non-NPC family person", married, (s) => {
  const u = family(s).unions[0];
  [u.first, u.second] = [u.second, u.first];
});
fa("union ID unique across current and historical partners", married, (s) =>
  family(s).unions.push({ ...union(s, "npc:mert", "divorced") }),
);
fa("one authored NPC cannot be in two active unions", married, (s) =>
  family(s).unions.push({ ...union(s), id: "union:2", first: "family:2", status: "separated" }),
);
fa("one spouse cannot be in two active unions", married, (s) => {
  defineNpc(s, "aylin", "Aylin Demir");
  family(s).unions.push({ ...union(s, "npc:aylin", "married"), id: "union:2" });
});
fa(
  "divorce history can refer to a spouse also in active union",
  married,
  (s) => family(s).unions.push({ ...union(s, "npc:mert", "divorced"), id: "union:2" }),
  true,
);
fa("deceased person cannot remain actively married", married, (s) => (person(s).died = 1));
fa(
  "deceased person's widowed union valid",
  married,
  (s) => {
    person(s).died = 1;
    family(s).unions[0].status = "widowed";
  },
  true,
);
fa("union formation predates adulthood", married, (s) => (person(s, "npc:mert").born = -17 * 30));
fa(
  "pregnancy exactly two distinct known parents",
  pregnancy,
  (s) => (family(s).expected.parents = ["player:1", "player:1"]),
);
fa("pregnancy unknown parent", pregnancy, (s) => (family(s).expected.parents[1] = "family:88"));
fa(
  "pregnancy cannot remain due at current day",
  pregnancy,
  (s) => (family(s).expected.due = day(s)),
);
fa(
  "pregnancy cannot be due beyond 24 days",
  pregnancy,
  (s) => (family(s).expected.due = day(s) + 25),
);
fa(
  "adult relatives can be expected parents without active union in validator",
  pregnancy,
  (s) => (family(s).unions = []),
  true,
);
fa(
  "estate grandfathered without workDays snapshot",
  estate,
  (s) => delete family(s).lastEstate.workDays,
  true,
);
fa(
  "estate workDays cannot exceed cumulative tenure",
  estate,
  (s) => (family(s).lastEstate.workDays = s.flags.workDays + 1),
);
fa(
  "estate workDays can equal cumulative tenure",
  estate,
  (s) => (family(s).lastEstate.workDays = s.flags.workDays),
  true,
);
fa(
  "estate cannot transfer back to same person",
  estate,
  (s) => (family(s).lastEstate.from = family(s).lastEstate.to),
);
fa("estate grantor must have been deceased", estate, (s) => (person(s).died = null));
fa(
  "estate recipient must be active current life",
  estate,
  (s) => (family(s).lastEstate.to = "family:1"),
);
fa("estate transfer cannot occur before grantor's death", estate, (s) => {
  s.time = 1440;
  person(s).died = 2;
});
fa(
  "estate transfer can occur days after death",
  estate,
  (s) => {
    s.time = 1440;
    family(s).lastEstate.day = 2;
  },
  true,
);
fa("household IDs unique globally", undefined, (s) => (home(s, 1).id = home(s).id));
fa(
  "resident IDs unique across background households",
  undefined,
  (s) => (npcs(s, 1)[0].id = npcs(s, 0)[0].id),
);
fa("ancestor cannot appear with same ID as alive resident", justAncestors, (s) =>
  home(s).residents.push({ ...home(s).residents[0], id: home(s).ancestors[0].id, parents: [] }),
);
fa(
  "archived ancestor must remain referenced by living children",
  justAncestors,
  (s) => (home(s).residents[0].parents = []),
);
fa("two ancestors cannot share a resident ID", justAncestors, (s) =>
  home(s).ancestors.push({ ...home(s).ancestors[0] }),
);
fa(
  "background ancestor must be at least 72 at death",
  justAncestors,
  (s) => (home(s).ancestors[0].born = -70 * 30),
);
fa("background child cannot have parent from another household", undefined, (s) => {
  const kid = npcs(s, 1)[0];
  kid.parents = [npcs(s, 0)[0].id];
  kid.born = -100;
});
fa(
  "background same-household lower ID and adult parent accepted",
  undefined,
  (s) => {
    const [parent, kid] = npcs(s, 0);
    kid.parents = [parent.id];
    kid.born = parent.born + 18 * 30;
  },
  true,
);
fa("background parent needs lower ID even if older", undefined, (s) => {
  const [kid, parent] = npcs(s, 0);
  kid.parents = [parent.id];
  kid.born = parent.born + 18 * 30;
});
fa(
  "backdated background child can be born on ancestor death date",
  justAncestors,
  (s) => (home(s).residents[0].born = 1),
  true,
);
fa("background child cannot be born after ancestor's death", justAncestors, (s) => {
  s.time = 1440;
  home(s).residents[0].born = 2;
});
fa("background ancestor cannot exceed next resident ID allocation", justAncestors, (s) => {
  const id = `resident:${family(s).nextResident}`;
  home(s).ancestors[0].id = id;
  home(s).residents[0].parents = [id];
});
