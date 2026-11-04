// A 1-ULP atan2 difference in a saved vehicle heading changed the world hash on tick 2592074.
import { chromium, firefox, webkit } from "playwright";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdirSync,writeFileSync } from "node:fs";
import { trafficPose } from "../../src/games/social-engine/domain/traffic.ts";
import { ROADS } from "../../src/games/social-engine/domain/world.ts";
const input = ROADS.flatMap((points,lane)=>{
  const length=points.reduce((n,a,i)=>n+Math.hypot(a.x-points[(i+1)%points.length].x,a.y-points[(i+1)%points.length].y),0);
  return Array.from({length:Math.ceil(length/.07213)},(_,i)=>[lane, i*.07213]);
});
const expected=input.map(([lane,d])=>trafficPose(lane,d).heading);
assert.ok(new Set(expected).size>50);
const js=(await build({entryPoints:["src/games/social-engine/domain/traffic.ts"],format:"iife",globalName:"traffic",bundle:true,write:false,target:"es2022"})).outputFiles[0].text;
const selected=process.env.SE_BROWSER, cases=[];
for(const [name,launcher] of Object.entries({chromium,firefox,webkit})){
 if(selected && name!==selected)continue;
 const b=await launcher.launch({headless:true,...(name==="chromium"&&process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 try{const p=await b.newPage();await p.addScriptTag({content:js});
 const actual=await p.evaluate(inputs=>inputs.map(([l,d])=>globalThis.traffic.trafficPose(l,d).heading),input);assert.equal(actual.length,expected.length);
 const i=actual.findIndex((v,i)=>v!==expected[i]);
 assert.equal(i,-1,`${name} sample ${i} lane,progress=${JSON.stringify(input[i])}: expected ${expected[i]}, got ${actual[i]}`);
 cases.push({engine:name,version:b.version(),samples:actual.length});}finally{await b.close();}
}
assert.ok(cases.length);
const dir="artifacts/social-engine/traffic-parity";mkdirSync(dir,{recursive:true});
const evidence={status:"PASS",cases,sha256:createHash("sha256").update(JSON.stringify(expected)).digest("hex")};writeFileSync(dir+"/"+(selected||"all")+".json",JSON.stringify(evidence,null,2)+"\n");console.log(JSON.stringify(evidence));
