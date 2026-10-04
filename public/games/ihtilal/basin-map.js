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
/** Selected metric as a literal bottom-up 0–100 fill, shared by SVG and Pixi. */
export function basinMetricBand(shape,value) {
  const amount=Math.max(0,Math.min(100,Number(value)||0));
  const minY=Math.min(...shape.map(p=>p[1])),maxY=Math.max(...shape.map(p=>p[1]));
  const level=maxY-(maxY-minY)*amount/100,polygon=[],crossings=[];
  for(let i=0;i<shape.length;i++) {
    const p=shape[i],q=shape[(i+1)%shape.length];
    if(p[1]>=level)polygon.push([...p]);
    if((p[1]>=level)!==(q[1]>=level)) {
      const x=p[0]+(q[0]-p[0])*(level-p[1])/(q[1]-p[1]);
      polygon.push([x,level]);crossings.push([x,level]);
    }
  }
  return {value:amount,fraction:amount/100,level,shape:amount===0?[]:polygon,trace:crossings.sort((a,b)=>a[0]-b[0])};
}
export function basinRenderModel(state,{layer='strain',lang='tr',plan=null}={}) {
  const affected=new Set(plan?.regional?.filter(r=>Object.values(r.delta).some(Boolean)).map(r=>r.id)||[]);
  return {layer,lang,period:state.period,
    regions:REGIONS.map(r=>{const live=state.regions.find(v=>v.id===r.id);return {...r,shape:SHAPES.get(r.id),band:basinMetricBand(SHAPES.get(r.id),live[layer]),value:live[layer],color:fill(live[layer],layer),selected:r.id===state.selected,risk:spillRisk(live),affected:affected.has(r.id)};}),
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
  const svgBase=node('g',{'data-map-base':'basins'}),svgSelection=node('g',{'data-map-overlay':'selection'}),svgOverlay=node('g',{'data-map-overlay':'routes-and-controls'});
  svg.append(svgBase,svgSelection,svgOverlay);
  let scene=null,disposed=false,forced=false,starting=false,model=null,baseGraphics=null,selectionGraphics=null,contextCanvas=null;
  let baseKey=null,overlayKey=null,selectionKey=null,gpuBaseKey=null,gpuSelectionKey=null,renderWidth=0;
  const baseInput=()=>JSON.stringify(model.regions.map(r=>[r.id,r.shape,r.color,r.band]));
  const selectionInput=()=>JSON.stringify(model.regions.filter(r=>r.selected).map(r=>[r.id,r.shape]));
  const overlayInput=()=>JSON.stringify([model.lang,model.links,model.regions.map(r=>[r.id,r.x,r.y,r[model.lang]||r.en,r.value,r.risk,r.selected,r.affected])]);
  const width=()=>Math.max(0,Math.round(element.getBoundingClientRect().width));
  function preferSVG() {
    const memory=Number(window.navigator?.deviceMemory),side=width()||320,dpr=window.devicePixelRatio||1;
    return (memory>0&&memory<=2)||side*side*dpr*dpr>2_000_000;
  }
  function paint() {
    if(!scene||disposed||!model||document.hidden)return;
    const side=width();
    if(!side)return; // Reparenting the persistent map must not allocate a 1px framebuffer.
    if(preferSVG()){fallback();return;}
    let changed=false;
    if(side!==renderWidth) {
      scene.app.renderer.resize(side,side);scene.app.stage.scale.set(side/320);renderWidth=side;changed=true;
    }
    const nextBase=baseInput(),nextSelection=selectionInput();
    if(gpuBaseKey!==nextBase) {
      const g=baseGraphics;g.clear();
      for(const r of model.regions) {
        g.poly(r.shape.flat()).fill(Number.parseInt(r.color.slice(1),16)).stroke({color:0x78664c,width:1});
        if(r.band.shape.length>=3)g.poly(r.band.shape.flat()).fill({color:0xc2b18e,alpha:.19});
        if(r.band.trace.length>=2)g.moveTo(...r.band.trace[0]).lineTo(...r.band.trace.at(-1)).stroke({color:0xefcb87,width:1,alpha:.65});
      }
      gpuBaseKey=nextBase;changed=true;
    }
    if(gpuSelectionKey!==nextSelection) {
      selectionGraphics.clear();
      for(const r of model.regions)if(r.selected)selectionGraphics.poly(r.shape.flat()).stroke({color:0xefcb87,width:2});
      gpuSelectionKey=nextSelection;changed=true;
    }
    if(changed)scene.render();
  }
  function resize() {if(!disposed&&!document.hidden){if(preferSVG())fallback();else paint();}}
  function fallback() {
    forced=true;
    if(contextCanvas)contextCanvas.removeEventListener('webglcontextlost',lost);
    contextCanvas=null;scene?.destroy();scene=null;baseGraphics=null;selectionGraphics=null;gpu.replaceChildren();
    gpuBaseKey=null;gpuSelectionKey=null;renderWidth=0;
    element.classList.remove('has-basin-pixi');element.dataset.renderer='svg';
  }
  function lost(event) {event.preventDefault();fallback();}
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
  observer?.observe(element);
  function flush() {
    if(disposed||!model||document.hidden)return;
    const started=performance.now(),next=model;
    const active=document.activeElement?.closest?.('[data-basin]')?.getAttribute('data-basin');
    const nextBase=baseInput(),nextSelection=selectionInput(),nextOverlay=overlayInput();
    if(baseKey!==nextBase) {
      svgBase.replaceChildren();
      for(const r of model.regions) {
        const group=node('g');const polygon=node('polygon',{points:r.shape.map(p=>p.join(',')).join(' '),fill:r.color,class:'basin-fill',stroke:'#78664c','stroke-width':1});group.append(polygon);
        if(r.band.shape.length>=3)group.append(node('polygon',{points:r.band.shape.map(p=>p.join(',')).join(' '),fill:'#c2b18e',opacity:.19,class:'basin-metric-band','data-metric-value':r.band.value}));
        if(r.band.trace.length>=2)group.append(node('polyline',{points:r.band.trace.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#efcb87','stroke-width':1,opacity:.65,class:'basin-state-trace'}));
        svgBase.append(group);
      }
      baseKey=nextBase;
    }
    if(selectionKey!==nextSelection) {
      svgSelection.replaceChildren();
      for(const r of model.regions)if(r.selected)svgSelection.append(node('polygon',{points:r.shape.map(p=>p.join(',')).join(' '),fill:'none',class:'basin-fill',stroke:'#efcb87','stroke-width':2}));
      selectionKey=nextSelection;
    }
    if(overlayKey!==nextOverlay) {
      svgOverlay.replaceChildren();svg.setAttribute('aria-label',next.lang==='tr'?'İHTİLÂL havzaları, bağlantılar ve yoldaki etkiler':'İHTİLÂL basins, routes and effects in transit');
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
      group.append(node('title',{},title));svgOverlay.append(group);
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
      svgOverlay.append(group);
    }
      overlayKey=nextOverlay;
      if(active)svg.querySelector(`[data-basin="${active}"]`)?.focus({preventScroll:true});
    }
    if(preferSVG())fallback();else paint();
    element.dataset.renderMs=(performance.now()-started).toFixed(2);
  }
  function update(next) {if(disposed)return;model=next;flush();}
  async function enhance() {
    if(disposed||forced||starting||scene||document.hidden)return;
    if(preferSVG()){fallback();return;}
    starting=true;
    try {
      const adapter=await import('../shared/pixi-adapter.js');
      if(disposed||forced||document.hidden)return;
      let probe,gl,supported=false;
      try {
        supported=adapter.supportsPixi({createCanvas:()=>{probe=document.createElement('canvas');return probe;}});
        if(probe)gl=probe.getContext('webgl2')||probe.getContext('webgl');
      } finally { try {gl?.getExtension('WEBGL_lose_context')?.loseContext();} catch { /* optional */ } }
      if(!supported){fallback();return;}
      const mounted=await adapter.mountPixiScene({container:gpu,width:320,height:320,background:0x18201c,antialias:true,
        build({app,PIXI}){baseGraphics=new PIXI.Graphics();baseGraphics.label='basin-base';selectionGraphics=new PIXI.Graphics();selectionGraphics.label='basin-selection';app.stage.addChild(baseGraphics,selectionGraphics);}});
      if(disposed||forced){mounted?.destroy();baseGraphics=null;selectionGraphics=null;return;}
      if(!mounted){fallback();return;}
      scene=mounted;contextCanvas=scene.app.canvas;contextCanvas.addEventListener('webglcontextlost',lost);
      element.classList.add('has-basin-pixi');element.dataset.renderer='pixi';resize();
    } catch { if(!disposed)fallback(); }
    finally {starting=false;}
  }
  function visibility() {if(disposed||document.hidden)return;flush();enhance();}
  document.addEventListener('visibilitychange',visibility);
  // Initial enhancement only; subsequent frames follow changes, never a ticker.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!disposed)enhance();}));
  return {element,update,useSVG:fallback,destroy(){if(disposed)return;disposed=true;observer?.disconnect();document.removeEventListener('visibilitychange',visibility);fallback();element.remove();}};
}
