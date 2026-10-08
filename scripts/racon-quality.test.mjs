import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './racon-harness.mjs';
function game(){const g=loadGame();g.ev('blank("Kalite");enterPlay();S.seed=4242;UI.fastJob=true;');return g;}
function paper(g,node='hk-1') {g.ev(`S.inbox.unshift({id:"quality-paper",kind:"chain",title:"Hasanın kuzeni",body:"Bir aile meselesi.",chainId:"hasan-kuzen",nodeId:"${node}",week:S.week,choices:[{id:"zarf",label:"Zarfı kuzenine ver"},{id:"bekle",label:"Bekle"}]});`);}
test('paid chain choice is atomic when poor, then charges exactly once and survives reload',()=>{
 const g=game();paper(g);g.ev('S.kasa=2499;cashNormalize(S);');const before=g.ev('JSON.stringify(S)');
 assert.match(g.ev('actionReason("chain-choice",{id:"quality-paper",cid:"zarf"})'),/2.500/);
 g.ev('act("chain-choice",{id:"quality-paper",cid:"zarf"});');assert.equal(g.ev('JSON.stringify(S)'),before);
 g.ev('cashChange(1);act("chain-choice",{id:"quality-paper",cid:"zarf"});');
 assert.equal(g.ev('S.kasa'),0);assert.equal(g.ev('S.flags.chainFlags.kuzenZarf'),1);
 g.ev('S=parseSave(localStorage.getItem(KEY));enterPlay();');const once=g.ev('JSON.stringify(S)');
 g.ev('window.RaconContent.choose(inboxBy("quality-paper"),"zarf",S,raconContentH());');assert.equal(g.ev('JSON.stringify(S)'),once);
});
test('all paid chain options reject unaffordable benefits at the content boundary',()=>{
 const g=game();let count=0;
 for(const chain of g.win.RaconContent.CHAINS) for(const node of chain.stages) for(const choice of node.choices) if(choice.effects.cash<0){
  g.ev('blank("Maliyet");enterPlay();S.kasa=0;cashNormalize(S);');
  const paper={id:"test",kind:"chain",chainId:chain.id,nodeId:node.id};
  const before=g.ev('JSON.stringify(S)');g.ev(`window.RaconContent.choose(${JSON.stringify(paper)},${JSON.stringify(choice.id)},S,raconContentH());`);
  assert.equal(g.ev('JSON.stringify(S)'),before,node.id+'/'+choice.id);count++;
 }
 assert.ok(count>20);
});
test('negative dossier result persists through recomputation and save',()=>{
 const g=game();paper(g,'hk-3');g.ev('filePressure(20,"test");');const before=g.ev('S.dosya');
 g.ev('act("chain-choice",{id:"quality-paper",cid:"yumusat"});recalcDosya();');assert.equal(g.ev('S.dosya'),before-3);
 g.ev('writeSave();S=loadSave();recalcDosya();');assert.equal(g.ev('S.dosya'),before-3);
});
test('pending chain echo gates the next chapter, and old callbacks cannot rewind a saved chapter',()=>{
 const g=game();paper(g);g.ev('S.week=20;S.flags.chains={};window.RaconContent.CHAINS.forEach(function(c){if(c.id!=="hasan-kuzen")S.flags.chains[c.id]={stage:0,status:"dead"};});act("chain-choice",{id:"quality-paper",cid:"zarf"});');
 g.ev('UI.spawnLeft=2;window.RaconContent.tick(S,raconContentH(),UI);');
 assert.equal(g.ev('S.inbox.some(function(p){return p.kind==="chain"&&!p.kapali;})'),false);
 g.ev('writeSave();S=loadSave();S.week=23;depthSettle();UI.spawnLeft=2;window.RaconContent.tick(S,raconContentH(),UI);');
 assert.equal(g.ev('S.inbox.find(function(p){return p.kind==="chain"&&!p.kapali;}).nodeId'),'hk-2');
 g.ev('S.flags.chains["hasan-kuzen"].stage=2;window.RaconContent.resolve({type:"chain-echo",chainId:"hasan-kuzen",next:1},S,raconContentH());');
 assert.equal(g.ev('S.flags.chains["hasan-kuzen"].stage'),2);
});
test('withdrawal pays neither job bonus nor territorial progress',()=>{
 const g=game();g.ev('S.jobs.push({id:"bonus-job",kind:"tahsilat",streetId:S.streetHome,prepLeft:0,assigned:[S.men[0].id],tags:[],phase:"running",tickIndex:0,bonus:5000});UI.jobId="bonus-job";UI.jobOrders=["cekil"];');
 const before=g.ev('S.kasa');g.ev('finishJob();');assert.equal(g.ev('S.kasa'),before);assert.equal(g.ev('num(S.flags.touchJobs[S.streetHome],0)'),0);
 g.ev('finishJob();');assert.equal(g.ev('S.kasa'),before);
});
test('lost investment does not return for free after reclaiming a street',()=>{
 const g=game();g.ev('var st=S.streets[1];st.sahip="sen";st.yatirim=2;S.ag={orders:[{id:"pending",street:st.id,kind:"yatirim",left:1}],waves:[]};var c={id:"loss",status:"bekler",ref:{sokakId:st.id}};S.calendar.push(c);randevuKacir(c);');
 assert.equal(g.ev('S.streets[1].yatirim'),0);assert.equal(g.ev('S.ag.orders.length'),0);g.ev('S.streets[1].sahip="sen";writeSave();S=loadSave();');assert.equal(g.ev('S.streets[1].yatirim'),0);
});
test('cash outlook includes investment, lawyer, front and succession wage multiplier',()=>{
 const g=game();g.ev('S.streets[0].sahip="sen";S.streets[0].yatirim=2;S.flags.avukatTutuldu=true;S.flags.aklamaFront="dernek";S.throne.dead=true;');
 const expected=g.ev('(yevmiyeToplami()*2+6000+800).toLocaleString("tr-TR")');
 assert.ok(g.ev('drawKasa()').includes('gider ₺'+expected));assert.match(g.ev('drawKasa()'),/Yatırım geliri ₺1.200/);
 paper(g);g.ev('UI.inboxId="quality-paper";');assert.match(g.ev('drawOlaylar()'),/choice-cost.*2.500/);
});
