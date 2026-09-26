import test from 'node:test';
import assert from 'node:assert/strict';
import { StrategyMap, roadSegments, riverCrossings } from '../public/games/hanedanian/map.js';

const world = (points) => ({ size: 5, tiles: Array.from({length:25},(_,i)=>({x:i%5,y:Math.floor(i/5),terrain:points.some(([x,y])=>x===i%5&&y===Math.floor(i/5))?'road':'plain'})) });

test('road endpoints connected from west or north never invent an isolated stub', () => {
  const horizontal = world([[1,2],[2,2],[3,2]]);
  assert.deepEqual(roadSegments(horizontal),[[1.5,2.5,2.5,2.5],[2.5,2.5,3.5,2.5]]);
  assert.equal(roadSegments(world([[2,1],[2,2],[2,3]])).length,2);
  assert.equal(roadSegments(world([[2,2]])).length,1,'a genuinely isolated road remains visible');
});

test('road topology keeps diagonal travel without drawing shortcuts through a right angle', () => {
  assert.equal(roadSegments(world([[1,1],[2,2],[3,3]])).length,2);
  assert.equal(roadSegments(world([[1,1],[2,1],[2,2]])).length,2);
  const square = world([[1,1],[1,2],[2,1],[2,2]]);
  assert.equal(roadSegments(square).length,4,'a four-way ring has no crossed diagonals');
  const mountainRoute=world([[1,2],[2,2],[3,2]]);
  mountainRoute.tiles[12].terrain='pass';
  assert.equal(roadSegments(mountainRoute).length,2,'a generated mountain pass continues the trade road');
});

test('bridge marks only real road/river intersections and deduplicates shared endpoints', () => {
  const river = [{x:2,y:0},{x:2,y:1},{x:2,y:2},{x:2,y:3}];
  assert.deepEqual(riverCrossings([[1.5,1.5,2.5,1.5],[2.5,1.5,3.5,1.5]],river),[{x:2.5,y:1.5,angle:0}]);
  assert.equal(riverCrossings([[0,0,1,0]],river).length,0);
  assert.equal(riverCrossings([[1,3,4,3]],[{x:2,y:0},{x:2,y:6}]).length,0,'river gaps do not invent bridge sites');
});

function context() {
  const ops=[];
  return new Proxy({ops,measureText:t=>({width:String(t).length*6})},{get:(o,k)=>k in o?o[k]:(...args)=>ops.push([k,...args]),set:(o,k,v)=>{o[k]=v;return true;}});
}
globalThis.document = {createElement(){const c={width:0,height:0};c.context=context();c.getContext=()=>c.context;return c;}};

test('all original object silhouettes cache and stay independent of campaign ownership', () => {
  const map=Object.create(StrategyMap.prototype);
  map.state={world:world([]),settlements:[]};
  const before=JSON.stringify(map.state);
  const types=['capital','settlement','watchtower','caravanserai','ruins','quarry','iron','pasture','forest','pass'];
  for (const type of types) {
    const glyph=map.objectGlyph(type,true,2,true,true);
    assert.equal(glyph.width,128);
    assert.equal(glyph,map.objectGlyph(type,true,2,true,true));
    assert.ok(glyph.context.ops.length>15,`${type} has a complete silhouette`);
    assert.notEqual(glyph,map.objectGlyph(type,false,2,true,true),'mobile/region detail is separate');
  }
  assert.equal(JSON.stringify(map.state),before,'drawing never changes saves or RNG');
  assert.equal(map.objectGlyphs.size,20,'bounded variants are reused across settlements and factions');
});

test('a completed atlas never retraces its static transport on pan', () => {
  const map=Object.create(StrategyMap.prototype);
  map.ctx=context(); map.terrainCaches=new Map([['world',{}]]);
  map.transportSegments=[[0,0,1,1]];
  map.drawConnections({minX:0,minY:0,maxX:5,maxY:5},0,0,56);
  assert.equal(map.ctx.ops.length,0);
});

test('tiny cached glyphs use inexpensive resampling without changing the terrain setting', () => {
  const map=Object.create(StrategyMap.prototype);
  let glyphQuality;
  map.ctx={imageSmoothingQuality:'high',drawImage(){glyphQuality=this.imageSmoothingQuality;}};
  map.drawObjectGlyph('quarry',{x:100,y:100},18,true);
  assert.equal(glyphQuality,'low');
  assert.equal(map.ctx.imageSmoothingQuality,'high');
});

test('a selected route preserves the straight travel corridor and marks unseen intervals', () => {
  const map=Object.create(StrategyMap.prototype);
  map.width=320; map.height=440; map.zoom=1; map.center={x:2.5,y:2.5};map.ctx=context();
  map.guide={from:{x:0,y:0},target:{x:4,y:2},route:{label:'12 dk'},logistics:{tiles:[{x:0,y:0,visible:true},{x:1,y:1,visible:true},{x:2,y:1,visible:false},{x:4,y:2,visible:false}]}};
  map.drawGuideRoute(56);
  const a=map.tileToScreen(0,0),b=map.tileToScreen(4,2);
  const segments=map.ctx.ops.filter(([op])=>op==='lineTo').slice(1,4);
  for (const [,x,y] of segments) assert.ok(Math.abs((y-a.y)*(b.x-a.x)-(x-a.x)*(b.y-a.y))<1e-6,'route stays on the engine corridor');
  assert.ok(map.ctx.ops.some(([op,dash])=>op==='setLineDash'&&dash?.[0]===3&&dash?.[1]===6));
});

test('a 320px map gives POI labels only to the active destination', () => {
  const map=Object.create(StrategyMap.prototype);
  map.width=320; map.height=440; map.zoom=1.3; map.center={x:2.5,y:2.5};
  map.state={world:world([])}; map.settlements=new Map(); map.ctx=context();
  map.state.world.tiles[12].poi={type:'quarry'};
  const bounds={minX:0,minY:0,maxX:4,maxY:4};
  map.drawZoomLabels(bounds,72.8);
  assert.equal(map.ctx.ops.filter(([op])=>op==='fillText').length,0);
  map.selected={x:2,y:2}; map.drawZoomLabels(bounds,72.8);
  assert.equal(map.ctx.ops.filter(([op])=>op==='fillText').length,1);
});
