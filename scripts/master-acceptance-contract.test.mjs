import test from 'node:test';
import assert from 'node:assert/strict';
import {widthsFrom,languagesFrom,acceptedAssetPath,gamePathMatches,exactEntryPath,readSaveEvidence,assertPreparedSave,assertSavedProgress} from './master-acceptance-contract.mjs';
test('critical captures remain distinct from canonical release viewports',()=>{
 assert.deepEqual(widthsFrom(),[390,1280]);assert.deepEqual(widthsFrom(undefined,true),[320,1440]);assert.throws(()=>widthsFrom('390,390'));assert.throws(()=>widthsFrom('0,1440'));
});
test('exact-main asset checks cannot escape build root or accept another host/game',()=>{
 assert.throws(()=>acceptedAssetPath('/accepted/public','/../../secret'));assert.throws(()=>acceptedAssetPath('/accepted/public','/%2e%2e/%2e%2e/secret'));
 assert.equal(acceptedAssetPath('/accepted/public','/games/peg-solitaire/index.html'),'/accepted/public/games/peg-solitaire/index.html');
 assert.equal(gamePathMatches('https://wrong.example/games/racon/','https://accepted.example','racon'),false);
 assert.equal(gamePathMatches('https://accepted.example/games/racon-old/','https://accepted.example','racon'),false);
 assert.equal(exactEntryPath('https://accepted.example/games/racon/','https://accepted.example','racon'),'/games/racon/index.html');
});
test('offline evidence detects lost or altered game progress while allowing only wall-clock savedAt metadata',()=>{
 const before=readSaveEvidence('racon',{'tariklab::racon:1':JSON.stringify({version:1,day:4,week:2,savedAt:20}), 'tariklab.language':'pl'});
 const metadataOnly=readSaveEvidence('racon',{'tariklab::racon:1':JSON.stringify({version:1,day:4,week:2,savedAt:40})});assert.doesNotThrow(()=>assertSavedProgress(before,metadataOnly));
 assert.throws(()=>assertSavedProgress(before,{}));
 assert.throws(()=>assertSavedProgress(before,readSaveEvidence('racon',{'tariklab::racon:1':JSON.stringify({version:1,day:5,week:2,savedAt:20})})));
 assert.throws(()=>assertSavedProgress(before,readSaveEvidence('racon',{'tariklab::racon:1':JSON.stringify({version:2,day:4,week:2,savedAt:20})})));
});

test('nested event timestamps remain part of saved progress',()=>{
 const before=readSaveEvidence('racon',{'tariklab::racon:1':JSON.stringify({savedAt:20,event:{savedAt:15}})});
 const after=readSaveEvidence('racon',{'tariklab::racon:1':JSON.stringify({savedAt:40,event:{savedAt:16}})});
 assert.throws(()=>assertSavedProgress(before,after));
});

test('limited language diagnostics cannot silently expand or duplicate a release matrix',()=>{
 assert.deepEqual(languagesFrom(),['tr','en','pl']);assert.deepEqual(languagesFrom('pl'),['pl']);
 assert.throws(()=>languagesFrom('pl,pl'));assert.throws(()=>languagesFrom('de'));
});

test('authored aliases include legacy scores and exact management/duel namespaces only',()=>{
 const cases=[['peg-solitaire','tlab.tektas.v1'],['labirent','tlab.labirent.v1'],['kayip-telefon','tariklab.nextwave.kayip-telefon.slot1'],['tc-sim-devlet','tariklab.nextwave.tc-sim-devlet.slot2'],['son-100-gun','tariklab.son100.pov.v1.slot1'],['gett-oh','tariklab.gett-oh.duel'],['veto-h','tariklab.veto-h.duel'],['tc-sim','tariklab::tc-sim:1']];
 for(const [game,key] of cases){
  const evidence=readSaveEvidence(game,{[key]:'{"day":4}',[game+'-settings']:'{"day":8}',['unrelated-'+key]:'{"day":9}'});
  assert.deepEqual(Object.keys(evidence),[key]);assert.doesNotThrow(()=>assertPreparedSave(game,evidence));
 }
});
test('resumable games cannot pass on missing, null, malformed, backup-only or preferences saves',()=>{
 for(const entries of [{},{'tariklab.gett-oh.duel':'null'},{'tariklab.gett-oh.duel':'{}'},{'tariklab.gett-oh.duel':'invalid'},{'tariklab.gett-oh.duel.backup':'{"day":4}'},{'gett-oh-settings':'{"day":4}'}])assert.throws(()=>assertPreparedSave('gett-oh',readSaveEvidence('gett-oh',entries)));
 assert.deepEqual(Object.keys(readSaveEvidence('gett-oh',{'tariklab.gett-oh.duel':'{"day":4}','tariklab.gett-oh.duel.backup':'{"day":3}'})),['tariklab.gett-oh.duel','tariklab.gett-oh.duel.backup']);
 for(const game of ['peg-solitaire','labirent','satranc'])assert.equal(assertPreparedSave(game,{}).required,false);
 assert.throws(()=>readSaveEvidence('unknown-game',{}));
});
