import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const target={sha:"9b5a06e349131d912baee1a7bb5ba86ced4a9b1e",prefix:"de08ead6",rollback:"1a0557a0",origin:"https://de08ead6-tariklab.tayaz29.workers.dev",account:"1c23838a8ed57b3cabd47e117b6ebb62",worker:"tariklab",runs:[39462047238,39462047566]};
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.ok(token,"Existing Workers Builds managed token unavailable; no login or token creation attempted");
async function gh(path){const r=await fetch("https://api.github.com/repos/tayaz-maker/tariklab/"+path,{headers:{"Accept":"application/vnd.github+json","User-Agent":"TarikLab-verified-release"}});assert.equal(r.status,200,"Public GitHub release guard response");return r.json();}
assert.equal((await gh("branches/main")).commit.sha,target.sha,"Main moved; refuse stale release");
for(const id of target.runs){const r=await gh("actions/runs/"+id);assert.equal(r.head_sha,target.sha);assert.equal(r.status,"completed","Mandatory main CI is not complete");assert.equal(r.conclusion,"success","Mandatory main CI must PASS");}
const pr=await gh("pulls/212");assert.equal(pr.merged,true);assert.equal(pr.merge_commit_sha,target.sha);
const hashes=JSON.parse(await readFile("tools/release-proof/b-candidate-hashes.json","utf8"));
for(const h of hashes){const r=await fetch(target.origin+"/"+h.file.slice(7));assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash("sha256").update(bytes).digest("hex"),h.sha256,"Immutable candidate hash");}
const base="https://api.cloudflare.com/client/v4/accounts/"+target.account+"/workers/scripts/"+target.worker;
async function cf(path,method="GET",body){const r=await fetch(base+path,{method,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok,"Cloudflare managed-token operation HTTP "+r.status);const j=await r.json();assert.equal(j.success,true,"Cloudflare operation must succeed");return j.result;}
const listed=await cf("/versions");
const versions=Array.isArray(listed)?listed:listed.items??listed.versions;
assert.ok(Array.isArray(versions),"Known Cloudflare versions shape");
const matches=versions.filter(v=>v.id?.startsWith(target.prefix));assert.equal(matches.length,1,"Exact accepted candidate must resolve uniquely");
const version=matches[0].id;
const previous=await cf("/deployments");
const rows=Array.isArray(previous)?previous:previous.deployments??previous.items;
assert.ok(Array.isArray(rows)&&rows.length>0,"Current deployment must be visible");
const prior=rows[0].versions;assert.equal(prior.length,1,"Do not overwrite a split deployment");assert.equal(prior[0].percentage,100);
assert.ok(prior[0].version_id.startsWith(target.rollback)||prior[0].version_id===version,"Unexpected production changed; refuse overwrite");
let deployment=rows[0];
if(prior[0].version_id!==version)deployment=await cf("/deployments","POST",{strategy:"percentage",versions:[{version_id:version,percentage:100}]});
assert.ok(deployment.id,"Deployment receipt required");
console.log(JSON.stringify({release:"Racon B",canonicalMain:target.sha,versionId:version,deploymentId:deployment.id,rollbackVersionId:prior[0].version_id,requiredMainRuns:target.runs,candidateHashes:hashes.length,productionPromotion:"PASS",method:"existing Workers Builds managed token; no secret disclosed"}));
