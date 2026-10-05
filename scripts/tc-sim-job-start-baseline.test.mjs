import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { archiveTcBaseline, archiveTcSource, TC_BASELINE_PATHS } from "./tc-sim-job-start-baseline.mjs";
test("pinned archive verifies git blob bytes and carries all source entry/import dependencies", t => {
  // A synthetic git repository makes the ordinary test suite independent of
  // checkout depth. The real immutable baseline is required by the PR driver.
  const tmp=mkdtempSync(join(tmpdir(),"tc-baseline-"));t.after(()=>rmSync(tmp,{recursive:true,force:true}));
  const repo=join(tmp,"repository");mkdirSync(repo);execFileSync("git",["init","--quiet",repo]);
  const paths=execFileSync("git",["ls-files","--",...TC_BASELINE_PATHS]).toString().trim().split("\n");
  for(const path of paths){mkdirSync(dirname(join(repo,path)),{recursive:true});writeFileSync(join(repo,path),readFileSync(path));}
  execFileSync("git",["add","public"],{cwd:repo});
  execFileSync("git",["-c","user.name=TC fixture","-c","user.email=fixture@example.invalid","commit","--quiet","-m","Synthetic static route"],{cwd:repo});
  const commit=execFileSync("git",["rev-parse","HEAD"],{cwd:repo}).toString().trim();
  const result=archiveTcSource(join(tmp,"baseline"),repo,commit);assert.equal(result.commit,commit);assert.ok(result.files.length>40);
  for(const path of paths.filter(p=>p.endsWith(".js")||p.endsWith("index.html"))) {
    const source=readFileSync(join(tmp,"baseline",path),"utf8");
    const matches=path.endsWith(".js") ? [...source.matchAll(/^\s*import\s+(?:[^;]*?\sfrom\s*)?["']([^"']+)["']/gm)] : [...source.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/g)];
    if(!path.startsWith("public/games/tc-sim/"))continue;
    for(const [,asset] of matches){const target="public"+new URL(asset,"http://localhost/"+path.replace(/^public\//,"")).pathname;assert.ok(result.files.some(file=>file.path===target),`${path} needs ${target}`);}
  }
  assert.throws(()=>archiveTcSource(join(tmp,"baseline"),repo,commit),/EEXIST/);
});
test("missing immutable baseline never falls back to the available branch",t=>{
  const tmp=mkdtempSync(join(tmpdir(),"tc-baseline-missing-"));t.after(()=>rmSync(tmp,{recursive:true,force:true}));
  execFileSync("git",["init","--quiet",tmp]);assert.throws(()=>archiveTcBaseline(join(tmp,"out"),tmp));
});
