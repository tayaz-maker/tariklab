/** Frozen released-v7 migration and writer isolation, not a player journey. */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { loadExpansionRuntime, resolveAction, validateState } from "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame, importGame, loadExpansionLocked, saveExpansionLocked } from "../public/games/tc-sim-boardworld/persistence.mjs";
import { getPlace } from "../public/games/tc-sim-boardworld/expansion-districts.mjs";

const released = "d2c1810da439dd831fff07992c1c278788a64a4c";
const directory = mkdtempSync(join(tmpdir(), "boardworld-ds3-released-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const archive = spawnSync("git", ["archive", released, "public/games/tc-sim-boardworld"], {cwd:resolve("."),maxBuffer:8e6});
assert.equal(archive.status,0,archive.stderr?.toString());
const unpack = spawnSync("tar",["-x","-C",directory],{input:archive.stdout});
assert.equal(unpack.status,0,unpack.stderr?.toString());
const frozen = name => import(pathToFileURL(join(directory,"public/games/tc-sim-boardworld",name)).href);
const old = await frozen("engine.mjs"), oldIo = await frozen("persistence.mjs");
await old.loadExpansionRuntime();
await loadExpansionRuntime();
const act = (engine,s,id) => {const r=engine.resolveAction(s,id);assert.ok(r.ok,`${id}: ${r.message}`);return r.state;};
const original = () => ["event:welcome:work","world:move:ankara","district:visit:ankara:kizilay:social","world:meal"].reduce((s,id)=>act(old,s,id),old.createGame({seed:49,expansion:true}));

test("DS3 imports released LW2 without changing balances, family or history",()=>{
  for (const center of [false,true]) {
    const s=original();
    if(center)s.expansion.districts.place.venueId=null;
    assert.ok(old.validateState(s));
    const bytes=oldIo.exportGame(s), a=importGame(bytes), b=importGame(bytes);
    assert.ok(a.state,a.message);assert.equal(a.state.expansion.deepSociety,3);assert.ok(validateState(a.state));
    assert.deepEqual(a.state,b.state);assert.equal(a.state.expansion.livingWorld,2);
    assert.equal(getPlace(a.state).districtId,"ankara:cankaya");
    assert.equal(getPlace(a.state).neighborhoodId,getPlace(s).neighborhoodId);
    assert.equal(a.state.cash,s.cash);assert.equal(a.state.bank,s.bank);
    assert.deepEqual(a.state.expansion.family,s.expansion.family);
    assert.deepEqual(a.state.expansion.events,s.expansion.events);
    for(const [id,ledger] of Object.entries(s.expansion.districts.foodMarkets))
      assert.deepEqual(a.state.expansion.districts.foodMarkets[id],ledger);
    let left=a.state,right=b.state;
    for(let i=0;i<8;i++) {left=act({resolveAction},left,"wait:15");right=act({resolveAction},right,"wait:15");}
    assert.equal(exportGame(left),exportGame(right));
    assert.equal(oldIo.importGame(exportGame(left)).state,null,"released runtime refuses the new capability");
  }
});

test("DS3 promotion preserves LW2 slots and rejects stale LW2 writers",async()=>{
  const s=original(), bytes=oldIo.exportGame(s), oldKey="tariklab.boardworld.v7.living-world-2", newKey="tariklab.boardworld.v7.living-world-3";
  let slots=new Map([[oldKey,bytes],[`${oldKey}.backup`,bytes]]),generation=0;
  const locks={request:(_key,fn)=>fn()};
  const transact=(_storage,operation)=>{
    const next=new Map(slots);
    const result=operation({getItem:key=>next.get(key)??null,setItem:(key,value)=>next.set(key,value)},generation);
    if(result.ok===true){slots=next;generation++;}
    if(result.token)result.token.generation=generation;
    return result;
  };
  const prior=await oldIo.loadExpansionLocked(undefined,locks,transact);
  const current=await loadExpansionLocked(undefined,locks,transact);
  const moved=act({resolveAction},current.state,"wait:15");
  assert.ok((await saveExpansionLocked(moved,undefined,current.token,locks,transact)).ok);
  const canonical=slots.get(newKey);
  assert.equal(slots.get(oldKey),bytes);assert.equal(slots.get(`${oldKey}.backup`),bytes);
  assert.equal(slots.get(`${newKey}.backup`),bytes);
  assert.equal((await oldIo.saveExpansionLocked(prior.state,undefined,prior.token,locks,transact)).conflict,true);
  const refreshed=await oldIo.loadExpansionLocked(undefined,locks,transact);
  assert.ok(refreshed.state);
  const oldNext=act(old,refreshed.state,"wait:15");
  assert.ok((await oldIo.saveExpansionLocked(oldNext,undefined,refreshed.token,locks,transact)).ok);
  assert.equal(slots.get(newKey),canonical,"unknown canonical slot survives released client's branch write");
  const resumed=await loadExpansionLocked(undefined,locks,transact);
  assert.deepEqual(resumed.state,moved);
});

// A capability cannot be hidden by merely relabelling its envelope.
test("DS3 capability rejects downgrade, missing domains and malformed marker",()=>{
  const state=importGame(oldIo.exportGame(original())).state;
  const bytes=exportGame(state);
  for(const format of ["tc-sim-boardworld-living-world-2-dictionary-1","tc-sim-boardworld-living-dictionary-1"]) {
    const envelope=JSON.parse(bytes); envelope.format=format;
    assert.equal(importGame(JSON.stringify(envelope)).state,null);
  }
  for(const field of ["society","stories","deepSociety"]) {
    const broken=structuredClone(state);delete broken.expansion[field];
    assert.equal(validateState(broken),false,field);
  }
  const broken=structuredClone(state); broken.expansion.deepSociety=4;
  assert.equal(validateState(broken),false);
});
