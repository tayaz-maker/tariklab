import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createWorld, stepWorld, canonicalState, validateState } from "../simulation/engine.ts";
import { advanceTraffic } from "../simulation/traffic.ts";
import { trafficPose } from "../domain/traffic.ts";
import { packRecords } from "../persistence/records.ts";
import { canonical } from "../simulation/random.ts";
import { decodeSave, encodeSave, migrateState, sha256, archivedRules8Digest } from "../persistence/codec.ts";
import { newJournalMeta, decodeJournal, replayJournal, type JournalOperation } from "../persistence/journal.ts";

test("seed 920 blockers stop authoritative speed and resumed traffic never jumps to stored cruise speed", () => {
  const s = createWorld(920);
  let stops = 0, resumes = 0;
  for (let tick = 0; tick < 300; tick++) {
    const before = structuredClone(s.vehicles);
    stepWorld(s);
    for (const v of s.vehicles.filter(v => v.driverId)) {
      const old = before.find(old => old.id === v.id)!;
      const d = Math.hypot(v.location.x-old.location.x,v.location.y-old.location.y);
      if (d === 0) { assert.equal(v.speed,0, `tick ${s.tick}: ${v.id}`); stops++; }
      if (old.speed === 0 && d > 0) { assert.ok(v.speed <= 0.22); resumes++; }
    }
  }
  assert.ok(stops > 0 && resumes > 0);
  assert.deepEqual(validateState(s),[]);
});

test("collision hold persists cruise intent, releases gradually and survives exact mid-hold save/journal replay", async () => {
  const s = createWorld(920), car = s.vehicles[1], blocker = s.vehicles[2];
  for (const p of [s.player,...s.npcs]) p.location = {x:7,y:9,scene:"b-home"};
  for (const v of s.vehicles) {v.driverId=null;v.location={x:60,y:55,scene:"outside"};}
  car.driverId="n81"; car.lane=0;car.progress=5;car.speed=2;
  const pose=trafficPose(car.lane,car.progress);car.heading=pose.heading;car.location={x:pose.x,y:pose.y,scene:"outside"};
  blocker.location={x:car.location.x+1,y:car.location.y,scene:"outside"};
  const before={...car.location};advanceTraffic(s);
  assert.deepEqual(car.location,before);assert.equal(car.speed,0);assert.equal(car.resumeSpeed,2);
  blocker.location={x:60,y:55,scene:"outside"};advanceTraffic(s);
  assert.equal(car.speed,0.22);assert.ok(Math.hypot(car.location.x-before.x,car.location.y-before.y)<0.024);
  // Use a full valid naturally blocked world for exact persistence and runtime replay.
  const a=createWorld(920);for(let i=0;i<12;i++)stepWorld(a);
  assert.equal(a.vehicles[3].speed,0);assert.equal(a.vehicles[3].resumeSpeed,1.8);
  const b=(await decodeSave(await encodeSave("auto",a))).state;
  const operations:JournalOperation[]=[];
  for(let i=0;i<90;i++){stepWorld(a);operations.push({cursor:i+1,type:"TICK",endingTick:a.tick,commands:[]});}
  assert.equal(canonicalState(replayJournal(b,{epoch:"hold",cursor:0},operations)),canonicalState(a));
  for(let i=0;i<90;i++)stepWorld(b);
  assert.equal(canonicalState(a),canonicalState(b));
});

test("authenticated rules8 fixture replays unchanged before lossless schema9 migration", async () => {
  const path=new URL("../persistence/fixtures/v8-auto-with-tail.json.gz",import.meta.url),bytes=readFileSync(path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),"c5507dc0274fad3615a270b31d1d59b7dbaf73ead9f256cd1b1765918902e2ff");
  const f=JSON.parse(gunzipSync(bytes).toString("utf8")),decoded=await decodeSave(f.envelope);
  const point={epoch:f.meta.epoch,cursor:f.meta.baseCursor};
  const batch=await decodeJournal(await newJournalMeta(f.envelope,point),f.record);
  const old=replayJournal(decoded.sourceState!,point,batch.operations,8);
  assert.equal(await sha256(canonicalState(old)),f.expectedCanonicalSha256);
  const upgraded=migrateState(old), inverse={...upgraded,schemaVersion:8,engineVersion:"1.0.0-candidate.7"};
  assert.equal(canonicalState(inverse),canonicalState(old));
  assert.deepEqual(validateState(upgraded),[]);
  assert.equal(await archivedRules8Digest(old),
    await sha256(canonical({...packRecords(old),rulesVersion:"social-engine-rules-8"})));
});

test("rules8 frozen source authority matches the pinned release bytes", () => {
  const root=new URL("../persistence/historical/candidate7/",import.meta.url),bytes=readFileSync(new URL("provenance.json",root));
  assert.equal(createHash("sha256").update(bytes).digest("hex"),"6b9447f511e6cd49d5cbf347f20a84c716a55036e9fe2c1a8e520806c9a18730");
  const manifest=JSON.parse(bytes.toString());
  for(const [name,hash] of Object.entries(manifest.files))
    assert.equal(createHash("sha256").update(readFileSync(new URL(name,root))).digest("hex"),hash,name);
});
