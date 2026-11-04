import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,applyCommand,stepWorld,advanceMinutes,validateState,transfer}from'../simulation/engine.ts';
import {BUILDINGS,SPAWN}from'../domain/world.ts';
import type{WorldState}from'../domain/types.ts';
test('C23 combined debt, unemployment, wanted status, poverty and injury have a funded legal recovery path',()=>{
 const s=createWorld(),p=s.player;let sequence=0;
 const act=(type:string,args:Record<string,unknown>={})=>{const result=applyCommand(s,{v:1,id:'recovery:'+sequence++,type,args});assert.equal(result.ok,true,type+': '+result.reason);return result;};
 // Setup uses valid financial/employment commands. Low health/needs are a declared adverse-state fixture.
 p.location={x:7,y:9,scene:'b-market'};act('APPLY_JOB',{jobId:'retail'});act('QUIT_JOB');p.location={x:7,y:9,scene:'b-bank'};act('BORROW',{amount:100000});assert.equal(transfer(s,'crisis-cost','player','external',s.accounts.player,'adverse-expense-fixture'),true);
 p.health=10;p.hunger=95;p.fatigue=95;p.location={...SPAWN,scene:'outside'};act('BLOCK',{active:true});act('ATTACK',{npcId:'n0'});for(let i=0;i<85;i++)stepWorld(s);act('BLOCK',{active:false});
 assert.ok(p.debt>0);assert.equal(p.jobId,null);assert.equal(s.accounts.player,0);assert.ok(p.wanted>0);assert.ok(p.health>0&&p.health<20);assert.deepEqual(validateState(s),[]);
 act('SURRENDER');assert.equal(p.wanted,0);assert.ok(p.debt>=115000);act('USE_ITEM',{item:'simit'});act('USE_ITEM',{item:'simit'});
 const enter=(id:string)=>{if(p.location.scene!=='outside')act('EXIT');const door=BUILDINGS.find(b=>b.id===id)!.door;act('MOVE_TO',door);for(let i=0;p.path.length&&i<4000;i++)stepWorld(s);assert.equal(p.path.length,0);act('ENTER',{buildingId:id});};
 enter('b-home');act('REST');advanceMinutes(s,60);assert.ok(p.health>=60);assert.ok(p.fatigue<20);
 enter('b-security');act('SUPPORT');assert.equal(s.accounts.player,20000);assert.equal(applyCommand(s,{v:1,id:'duplicate-aid-new-command',type:'SUPPORT',args:{}}).ok,false);
 enter('b-warehouse');act('APPLY_JOB',{jobId:'courier'});act('START_SHIFT');const ends=p.shift!.endsAt;advanceMinutes(s,ends-s.minute);assert.equal(p.shift,null);assert.ok(p.income>0);assert.ok(s.accounts.player>20000);
 enter('b-bank');const before=p.debt;act('REPAY',{amount:5000});assert.equal(p.debt,before-5000);assert.equal(p.wanted,0);assert.ok(p.health>0);assert.equal(p.jobId,'courier');assert.deepEqual(validateState(s),[]);
});
