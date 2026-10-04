import {REGIONS, ROUTES, spillRisk} from './basin-network.js';
const NS='http://www.w3.org/2000/svg';
const node=(name,attrs={},text='')=>{const n=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;return n;};
const center=p=>[p.reduce((s,v)=>s+v[0],0)/p.length,p.reduce((s,v)=>s+v[1],0)/p.length];
// Half-plane clipping gives these seven fictional basins their own shared edges.
function cell(site) {
  let polygon=[[12,12],[308,12],[308,308],[12,308]];
  for(const other of REGIONS) {
    if(site.id===other.id)continue;
    const a=other.x-site.x,b=other.y-site.y,c=(other.x**2+other.y**2-site.x**2-site.y**2)/2;
    const next=[];
    for(let i=0;i<polygon.length;i++) {
      const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=a*p[0]+b*p[1]-c,dq=a*q[0]+b*q[1]-c;
      if(dp<=0)next.push(p);
      if((dp<=0)!==(dq<=0)){const t=dp/(dp-dq);next.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
    }
    polygon=next;
  }
  const [cx,cy]=center(polygon);
  return polygon.map(([x,y])=>[cx+(x-cx)*.95,cy+(y-cy)*.95]);
}
const SHAPES=new Map(REGIONS.map(r=>[r.id,cell(r)]));
const pointMap=new Map(REGIONS.map(r=>[r.id,r]));
function fill(value,layer) {
  const danger=(layer==='strain'||layer==='tension')?value:100-value;
  return danger>=65?'#744333':danger>=45?'#5d5340':'#384f4c';
}
export function basinRenderModel(state,{layer='strain',lang='tr',plan=null}={}) {
  const affected=new Set(plan?.regional?.filter(r=>Object.values(r.delta).some(Boolean)).map(r=>r.id)||[]);
  return {layer,lang,period:state.period,
    regions:REGIONS.map(r=>{const live=state.regions.find(v=>v.id===r.id);return {...r,shape:SHAPES.get(r.id),value:live[layer],color:fill(live[layer],layer),selected:r.id===state.selected,risk:spillRisk(live),affected:affected.has(r.id)};}),
    links:ROUTES.map(r=>{const mode=state.network.links.find(l=>l.id===r.id).mode,pulses=state.network.pulses.filter(p=>p.via===r.id);
      return {...r,from:pointMap.get(r.a),to:pointMap.get(r.b),mode,delay:r.delay+(mode==='buffered'?1:0),active:r.a===state.selected||r.b===state.selected,
        forward:pulses.some(p=>p.from===r.a),backward:pulses.some(p=>p.from===r.b),pulses:pulses.length,due:pulses.length?Math.min(...pulses.map(p=>p.due)):null,
        preview:plan?.waves?.some(p=>p.via===r.id)||false};}),
  };
}

/** SVG remains the accessible command surface; optional Pixi shares its geometry/model. */
export function createBasinMap(onSelect) {
  const element=document.createElement('div');element.className='basin-surface';element.dataset.renderer='svg';
  const gpu=document.createElement('div');gpu.className='basin-gpu';gpu.setAttribute('aria-hidden','true');
  const svg=node('svg',{viewBox:'0 0 320 320',class:'basin-map',role:'group'});element.append(gpu,svg);
  let scene=null,disposed=false,forced=false,model=null,layer=null,contextCanvas=null;
  function paint() {
    if(!scene||disposed||!model)return;
    const g=layer;g.clear();
    for(const r of model.regions) {
      g.poly(r.shape.flat()).fill(Number.parseInt(r.color.slice(1),16)).stroke({color:r.selected?0xefcb87:0x78664c,width:r.selected?2:1});
      const [cx,cy]=center(r.shape);
      for(const factor of [.66,.82])g.poly(r.shape.flatMap(([x,y])=>[cx+(x-cx)*factor,cy+(y-cy)*factor])).stroke({color:0xc2b18e,width:.5,alpha:.18});
    }
    scene.render();
  }
  function resize() {
    if(!scene||disposed)return;
    const width=Math.max(1,Math.round(element.getBoundingClientRect().width));
    scene.app.renderer.resize(width,width);scene.app.stage.scale.set(width/320);paint();
  }
  function fallback() {
    forced=true;
    if(contextCanvas)contextCanvas.removeEventListener('webglcontextlost',lost);
    contextCanvas=null;scene?.destroy();scene=null;layer=null;gpu.replaceChildren();
    element.classList.remove('has-basin-pixi');element.dataset.renderer='svg';
  }
  function lost(event) {event.preventDefault();fallback();}
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
  observer?.observe(element);
  function update(next) {
    if(disposed)return;
    const started=performance.now();model=next;
    const active=document.activeElement?.closest?.('[data-basin]')?.getAttribute('data-basin');
    svg.replaceChildren();svg.setAttribute('aria-label',next.lang==='tr'?'İHTİLÂL havzaları, bağlantılar ve yoldaki etkiler':'İHTİLÂL basins, routes and effects in transit');
    for(const r of model.regions) {
      const group=node('g');const polygon=node('polygon',{points:r.shape.map(p=>p.join(',')).join(' '),fill:r.color,class:'basin-fill',stroke:r.selected?'#efcb87':'#78664c','stroke-width':r.selected?2:1});group.append(polygon);
      const [cx,cy]=center(r.shape);
      for(const factor of [.66,.82])group.append(node('polygon',{points:r.shape.map(([x,y])=>`${cx+(x-cx)*factor},${cy+(y-cy)*factor}`).join(' '),fill:'none',stroke:'#c2b18e','stroke-width':.5,opacity:.18,class:'basin-contour'}));
      svg.append(group);
    }
    for(const route of model.links) {
      const a=route.from,b=route.to;
      const group=node('g',{'data-route':route.id});
      group.append(node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:route.preview?'#f4d58e':route.active?'#d5bd91':'#73664f','stroke-width':route.preview?3:route.active?2:1,'stroke-dasharray':route.mode==='buffered'?'3 4':'none',class:'basin-link'}));
      for(const [from,to,visible] of [[a,b,route.forward],[b,a,route.backward]]) {
        if(!visible)continue;
        const angle=Math.atan2(to.y-from.y,to.x-from.x),x=from.x+(to.x-from.x)*.7,y=from.y+(to.y-from.y)*.7;
        group.append(node('polyline',{points:`${x-5*Math.cos(angle-.6)},${y-5*Math.sin(angle-.6)} ${x},${y} ${x-5*Math.cos(angle+.6)},${y-5*Math.sin(angle+.6)}`,fill:'none',stroke:'#f4d58e','stroke-width':1.5}));
      }
      const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      group.append(node('rect',{x:mx-14,y:my-8,width:28,height:16,rx:4,fill:'#1b211e'}));
      group.append(node('text',{x:mx,y:my+3,'text-anchor':'middle',class:'route-number'},route.pulses?`${route.pulses}·${route.due}`:`${route.delay}d`));
      const title=next.lang==='tr'?`${route.delay} dönem yol · ${route.pulses} etki yolda`:`${route.delay} periods travel · ${route.pulses} in transit`;
      group.append(node('title',{},title));svg.append(group);
    }
    for(const r of model.regions) {
      const label=r[model.lang]||r.en;
      const group=node('g',{role:'button',tabindex:0,'data-basin':r.id,'data-focus-key':`basin-${r.id}`,'aria-label':`${label}: ${r.value}${r.risk?' !':''}`,'aria-pressed':r.selected,class:`basin-node${r.affected?' planned':''}`});
      const hit=node('rect',{x:r.x-25,y:r.y-25,width:50,height:50,rx:12,fill:'#1b211e',stroke:r.selected?'#f4d58e':r.affected?'#b6c5b2':'#a08b66','stroke-width':r.selected?2:1});group.append(hit);
      group.append(node('text',{x:r.x,y:r.y+1,'text-anchor':'middle',class:'basin-value'},`${r.risk?'! ':''}${r.value}`));
      group.append(node('text',{x:r.x,y:r.y+16,'text-anchor':'middle',class:'basin-name'},label.split(' ')[0]));
      group.append(node('title',{},label));
      group.addEventListener('click',()=>onSelect(r.id,{keyboard:false}));
      group.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();onSelect(r.id,{keyboard:true});}});
      svg.append(group);
    }
    if(active)svg.querySelector(`[data-basin="${active}"]`)?.focus({preventScroll:true});
    paint();element.dataset.renderMs=(performance.now()-started).toFixed(2);
  }
  async function enhance() {
    try {
      const adapter=await import('../shared/pixi-adapter.js');
      if(disposed||forced)return;
      let probe,gl,supported=false;
      try {
        supported=adapter.supportsPixi({createCanvas:()=>{probe=document.createElement('canvas');return probe;}});
        if(probe)gl=probe.getContext('webgl2')||probe.getContext('webgl');
      } finally { try {gl?.getExtension('WEBGL_lose_context')?.loseContext();} catch { /* optional */ } }
      if(!supported)return;
      const mounted=await adapter.mountPixiScene({container:gpu,width:320,height:320,background:0x18201c,antialias:true,
        build({app,PIXI}){layer=new PIXI.Graphics();app.stage.addChild(layer);}});
      if(disposed||forced){mounted?.destroy();return;}
      if(!mounted)return;
      scene=mounted;contextCanvas=scene.app.canvas;contextCanvas.addEventListener('webglcontextlost',lost);
      element.classList.add('has-basin-pixi');element.dataset.renderer='pixi';resize();
    } catch { if(!disposed)fallback(); }
  }
  // No ticker, no animation loop, no WebGL work on the initial interaction path.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!disposed)enhance();}));
  return {element,update,useSVG:fallback,destroy(){if(disposed)return;disposed=true;observer?.disconnect();fallback();element.remove();}};
}
