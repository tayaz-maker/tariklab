import { isArmyVisible } from './engine.js';
import { TERRAINS, POIS } from './data.js';

// World coordinates are tile edges; a settlement sits at (x + .5, y + .5).
// The map never mutates campaign state. A gesture updates the camera only.
const TILE = 56;
const MAX_ZOOM = 2.6;
const TAU = Math.PI * 2;
const atlasRandom = (i, salt) => { let h = Math.imul(i ^ salt, 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const COLORS = {
  paper: '#191f1a', ink: '#2a2218', muted: '#6a5c48', player: '#1e3d32',
  plain: '#81754b', forest: '#203e30', mountain: '#74746a', ore: '#745945',
  valley: '#3e6251', road: '#a08050', pass: '#6a655c', arid: '#8b734e',
  steppe: '#696747', water: '#3d6468', waterLight: '#8aa8a0', stone: '#4a4c48',
  walnut: '#4a3728', brass: '#b08a4a', oxblood: '#7a3228', ivory: '#f3ead4',
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const sameTile = (a, b) => a?.x === b?.x && a?.y === b?.y;
const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const variation = (x, y) => ((Math.imul(x + 31, 73856093) ^ Math.imul(y + 17, 19349663)) >>> 0) / 4294967295;
const variation2 = (x, y, salt) => ((Math.imul(x + 11 + salt, 83492791) ^ Math.imul(y + 23, 2971215073)) >>> 0) / 4294967295;

export function worldAtScreen(point, view) {
  const scale = TILE * view.zoom;
  return { x: view.center.x + (point.x - view.width / 2) / scale, y: view.center.y + (point.y - view.height / 2) / scale };
}

export function zoomAtPoint(view, zoom, point) {
  const anchor = worldAtScreen(point, view);
  return { zoom, center: { x: anchor.x - (point.x - view.width / 2) / (TILE * zoom), y: anchor.y - (point.y - view.height / 2) / (TILE * zoom) } };
}

export function visibleTileBounds(view, size, buffer = 1) {
  const left = worldAtScreen({ x: 0, y: 0 }, view);
  const right = worldAtScreen({ x: view.width, y: view.height }, view);
  return { minX: clamp(Math.floor(left.x) - buffer, 0, size - 1), minY: clamp(Math.floor(left.y) - buffer, 0, size - 1), maxX: clamp(Math.floor(right.x) + buffer, 0, size - 1), maxY: clamp(Math.floor(right.y) + buffer, 0, size - 1) };
}

function path(ctx, points, close = false) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (close) ctx.closePath();
}

export class StrategyMap {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('Bu tarayıcı harita çizimini desteklemiyor.');
    this.options = options;
    this.width = 1;
    this.height = 1;
    this.zoom = 1;
    this.center = { x: 24.5, y: 24.5 };
    this.selected = null;
    this.hover = null;
    this.state = null;
    this.pointers = new Map();
    this.gesture = null;
    this.frame = null;
    this.lastRenderMs = 0;
    this.drawnTiles = 0;
    this.terrainCache = null;
    this.terrainCacheWorld = null;
    this.terrainCacheMode = null;
    this.listeners = [];
    this.disposed = false;
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.cursor = 'grab';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-roledescription', 'Etkileşimli strateji haritası');
    this.updateAccessibleLabel();
    this.listen(canvas, 'pointerdown', (e) => this.pointerDown(e));
    this.listen(canvas, 'pointermove', (e) => this.pointerMove(e));
    this.listen(canvas, 'pointerup', (e) => this.pointerEnd(e, false));
    this.listen(canvas, 'pointercancel', (e) => this.pointerEnd(e, true));
    this.listen(canvas, 'lostpointercapture', (e) => this.pointerEnd(e, true));
    this.listen(canvas, 'pointerleave', () => { if (!this.pointers.size) this.setHover(null); });
    this.listen(canvas, 'wheel', (e) => this.wheel(e), { passive: false });
    this.listen(canvas, 'keydown', (e) => this.keyDown(e));
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    this.listen(window, 'blur', () => this.cancelGesture());
    this.listen(document, 'visibilitychange', () => { if (document.hidden) this.cancelGesture(); else this.invalidate(); });
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }
    this.listen(window, 'resize', () => this.resize());
    this.resize();
  }

  listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.listeners.push(() => target.removeEventListener(event, handler, options));
  }

  get minZoom() { return Math.min(0.55, Math.max(0.065, Math.min(this.width, this.height) / ((this.state?.world.size || 49) * TILE + 80))); }
  get mode() { return this.zoom <= Math.max(.28, this.minZoom * 1.12) ? 'world' : this.zoom < 0.76 ? 'region' : 'near'; }

  getView() {
    return { width: this.width, height: this.height, zoom: this.zoom, mode: this.mode, center: { ...this.center }, selected: this.selected ? { ...this.selected } : null, drawnTiles: this.drawnTiles, lastRenderMs: this.lastRenderMs };
  }

  setState(state) {
    const first = !this.state;
    const changedWorld = !this.state || this.state.world !== state.world;
    this.state = state;
    this.settlements = new Map((state.settlements || []).map((s) => [`${s.x},${s.y}`, s]));
    this.factions = new Map((state.factions || []).map((f) => [f.id, f]));
    // Visibility is simulation-dependent, so calculate once per state update,
    // never scan all watchtowers for every army on every pan/pinch frame.
    this.visibleArmies = (state.armies || []).filter((army) => isArmyVisible(state, army));
    if (changedWorld) {
      this.minimapTerrain = null;
      this.terrainCache = null;
      this.terrainCacheWorld = null;
      this.terrainCacheMode = null;
      // The generator's river valley is several tiles wide. Draw its centerline,
      // not a mesh connecting every fertile tile (which would suggest many rivers).
      this.riverPoints = [];
      for (let y = 0; y < state.world.size; y++) {
        let start = -1, bestStart = -1, bestLength = 1;
        for (let x = 0; x <= state.world.size; x++) {
          if (this.tile(x, y)?.terrain === 'valley') { if (start < 0) start = x; }
          else if (start >= 0) {
            if (x - start > bestLength) { bestStart = start; bestLength = x - start; }
            start = -1;
          }
        }
        if (bestStart >= 0) this.riverPoints.push({ x: bestStart + (bestLength - 1) / 2, y });
      }
    }
    if (first) {
      const home = state.settlements.find((s) => s.ownerId === state.playerId);
      if (home) this.center = { x: home.x + .5, y: home.y + .5 };
    }
    if (this.selected && !this.tile(this.selected.x, this.selected.y)) this.selected = null;
    this.clampView();
    this.updateAccessibleLabel();
    this.invalidate();
  }

  tile(x, y) {
    const world = this.state?.world;
    if (!world || x < 0 || y < 0 || x >= world.size || y >= world.size) return null;
    return world.tiles[y * world.size + x] || null;
  }

  landscapeTerrain(tile) {
    if (!tile) return 'plain';
    if (tile.terrain !== 'road') return tile.terrain;
    const counts = {};
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      const n = this.tile(tile.x + dx, tile.y + dy);
      if (!n || n.terrain === 'road') continue;
      counts[n.terrain] = (counts[n.terrain] || 0) + 1;
    }
    let best = 'plain', n = 0;
    for (const [k, v] of Object.entries(counts)) if (v > n) { best = k; n = v; }
    return best;
  }

  isCapital(settlement) {
    const own = (this.state?.settlements || []).filter((s) => s.ownerId === settlement.ownerId);
    return own[0]?.id === settlement.id;
  }

  ensureGrain() {
    if (this.grainPattern) return this.grainPattern;
    const surface = document.createElement('canvas');
    surface.width = 48;
    surface.height = 48;
    const g = surface.getContext('2d');
    g.fillStyle = 'rgba(42,34,24,0.045)';
    for (let i = 0; i < 220; i++) {
      const x = (i * 13) % 48, y = (i * 29) % 48;
      g.fillRect(x, y, i % 5 === 0 ? 2 : 1, 1);
    }
    g.strokeStyle = 'rgba(240,226,190,0.04)';
    g.beginPath();
    g.moveTo(0, 48);
    g.lineTo(48, 0);
    g.stroke();
    this.grainPattern = this.ctx.createPattern(surface, 'repeat');
    return this.grainPattern;
  }

  cachePpt(mode = this.mode) {
    // Each mode's terrain bitmap is cached once per world/mode and then
    // drawImage-scaled to the live TILE*zoom on-screen size (see render()).
    // 'near' used to cache at 40px/tile while zoom can reach MAX_ZOOM=2.6
    // (TILE*MAX_ZOOM ~= 146px/tile on screen) — a ~3.6x upscale of the
    // cached bitmap, which read as soft/blurry terrain at close zoom.
    // Raising the near/region caches keeps the same whole-world single
    // cache strategy (no viewport windowing, no extra redraw triggers)
    // while cutting that upscale to under 2x; canvas stays well inside
    // browser size limits for a 49x49 world (49*76 = 3724px).
    return mode === 'world' ? 16 : mode === 'region' ? 32 : 76;
  }

  collectClusters(pred) {
    const size = this.state.world.size;
    const seen = new Uint8Array(size * size);
    const clusters = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i0 = y * size + x;
      if (seen[i0] || !pred(this.tile(x, y))) continue;
      const cells = [];
      const stack = [x, y];
      seen[i0] = 1;
      while (stack.length) {
        const cy = stack.pop(), cx = stack.pop();
        cells.push([cx, cy]);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy, i = ny * size + nx;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size || seen[i]) continue;
          if (!pred(this.tile(nx, ny))) continue;
          seen[i] = 1;
          stack.push(nx, ny);
        }
      }
      clusters.push(cells);
    }
    return clusters;
  }

  ensureTerrainCache() {
    if (!this.state) return null;
    const mode = this.mode;
    const world = this.state.world;
    if (this.terrainCache && this.terrainCacheWorld === world && this.terrainCacheMode === mode) {
      return this.terrainCache;
    }
    const ppt = this.cachePpt(mode);
    const canvas = document.createElement('canvas');
    canvas.width = world.size * ppt;
    canvas.height = world.size * ppt;
    const g = canvas.getContext('2d');
    g.fillStyle = COLORS.paper;
    g.fillRect(0, 0, canvas.width, canvas.height);
    this.paintContinuousAtlas(g, ppt, mode);
    this.terrainCache = canvas;
    this.terrainCacheWorld = world;
    this.terrainCacheMode = mode;
    return canvas;
  }

  // A continuous, shaded material field replaces cell stamps. Simulation tiles
  // remain authoritative; interpolation is visual only and never consumes RNG.
  paintContinuousAtlas(g, ppt, mode) {
    const size = this.state.world.size;
    const materials = this.state.world.tiles.map(t => this.landscapeTerrain(t));
    const rgb = Object.fromEntries(Object.entries(COLORS).filter(([,v]) => /^#[0-9a-f]{6}$/i.test(v)).map(([k,v]) => [k,[1,3,5].map(i => parseInt(v.slice(i,i+2),16))]));
    const height = {plain:.12,forest:.25,mountain:1,ore:.8,pass:.58,steppe:.2,arid:.22,valley:0};
    const sample = (x,y) => {
      x = clamp(x,0,size-1); y = clamp(y,0,size-1);
      const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
      const u=fx*fx*(3-2*fx), v=fy*fy*(3-2*fy);
      const values=[materials[iy*size+ix],materials[iy*size+Math.min(size-1,ix+1)],materials[Math.min(size-1,iy+1)*size+ix],materials[Math.min(size-1,iy+1)*size+Math.min(size-1,ix+1)]];
      const weights=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];
      const c=[0,0,0,0];
      for(let i=0;i<4;i++){const col=rgb[values[i]]||rgb.plain; for(let j=0;j<3;j++) c[j]+=col[j]*weights[i];c[3]+=(height[values[i]]||0)*weights[i];}
      return c;
    };
    // Material plate is capped independently of close detail; the near pass
    // adds crisp vector landforms rather than magnifying the far bitmap.
    const res = mode==='world'?10:mode==='region'?14:18;
    const plate=document.createElement('canvas');plate.width=plate.height=size*res;
    const pg=plate.getContext('2d'), image=pg.createImageData(plate.width,plate.height);
    for(let py=0;py<plate.height;py++) for(let px=0;px<plate.width;px++) {
      const x=px/res-.5,y=py/res-.5;
      const wx=x+.19*Math.sin(y*2.9+x*.7)+.09*Math.sin(y*7.1);
      const wy=y+.18*Math.sin(x*2.1-y*.4)+.07*Math.cos(x*6.7);
      const c=sample(wx,wy), light=sample(wx-.13,wy-.16)[3]-sample(wx+.13,wy+.16)[3];
      const folds=Math.sin(wx*9+Math.sin(wy*4)*2)*Math.sin(wy*7+wx*2);
      const shade=.91+light*.9+folds*(.025+c[3]*.085);
      const i=(py*plate.width+px)*4;
      for(let j=0;j<3;j++) image.data[i+j]=clamp(c[j]*shade,0,255);
      image.data[i+3]=255;
    }
    pg.putImageData(image,0,0);g.drawImage(plate,0,0,size*ppt,size*ppt);
    // Contour engraving gives valleys and foothills a geographical silhouette.
    if(mode!=='world') {
      g.lineWidth=Math.max(.45,ppt*.008);g.strokeStyle='rgba(211,190,135,.16)';
      const step=.36;
      for(const level of [.16,.24,.34,.46,.6,.76]){
        g.beginPath();
        for(let y=0;y<size-step;y+=step)for(let x=0;x<size-step;x+=step){
          const pts=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]];
          const hs=pts.map(([a,b])=>sample(a-.5,b-.5)[3]);const cross=[];
          for(let k=0;k<4;k++){const n=(k+1)%4;if((hs[k]<level)===(hs[n]<level))continue;const t=(level-hs[k])/(hs[n]-hs[k]);cross.push([(pts[k][0]+(pts[n][0]-pts[k][0])*t)*ppt,(pts[k][1]+(pts[n][1]-pts[k][1])*t)*ppt]);}
          if(cross.length>=2){g.moveTo(...cross[0]);g.lineTo(...cross[1]);}
        }
        g.stroke();
      }
    }
    // Scatter is world-space, not one symbol per tile. Every mark is checked
    // against the authoritative underlying biome.
    const count = size*size*(mode==='world'?3:mode==='region'?8:22);
    for(let i=0;i<count;i++) {
      const x=atlasRandom(i,7171)*size, y=atlasRandom(i,113113)*size;
      const ix=Math.floor(x),iy=Math.floor(y),kind=materials[iy*size+ix];
      const px=x*ppt,py=y*ppt, r=atlasRandom(i,4949);
      if(kind==='forest') {
        const h=ppt*(.08+r*.14), w=h*.58;
        g.fillStyle='rgba(8,18,13,.35)';
        g.beginPath();g.ellipse(px+w*.6,py+h*.28,w*1.35,h*.38,-.4,0,TAU);g.fill();
        g.beginPath();g.moveTo(px,py-h);g.bezierCurveTo(px+w*.35,py-h*.5,px+w,py-h*.25,px+w,py);g.quadraticCurveTo(px,py+h*.3,px-w,py);g.quadraticCurveTo(px-w*.6,py-h*.5,px,py-h);
        g.fillStyle=r>.5?'#294b36':'#193829';g.fill();
        if(mode!=='world'){g.strokeStyle='rgba(161,163,101,.24)';g.lineWidth=.6;g.beginPath();g.moveTo(px,py-h*.88);g.lineTo(px-w*.55,py-h*.14);g.stroke();}
      } else if(kind==='plain' && mode!=='world' && r>.91) {
        const angle=Math.sin(x*.7+y*.21)*.6, w=ppt*(.28+r*.32),h=w*.38;
        g.save();g.translate(px,py);g.rotate(angle);
        g.fillStyle=r>.9?'rgba(181,155,90,.24)':'rgba(35,51,30,.18)';
        g.beginPath();g.moveTo(-w,-h);g.lineTo(w*.8,-h*.7);g.lineTo(w,h);g.lineTo(-w*.7,h*.8);g.closePath();g.fill();
        g.strokeStyle='rgba(206,178,113,.23)';g.lineWidth=.6;
        for(let k=-2;k<=2;k++){g.beginPath();g.moveTo(-w*.65,k*h/3);g.lineTo(w*.65,k*h/3);g.stroke();}g.restore();
      }
    }
    // Trace the long axis of each mountain belt, never the cell adjacency mesh.
    const rock=k=>k==='mountain'||k==='ore'||k==='pass';
    const chains=[];
    for(let y=0;y<size;y++) {
      for(let x=0;x<size;x++){
        if(!rock(materials[y*size+x]))continue;
        const first=x;while(x+1<size&&rock(materials[y*size+x+1]))x++;
        const center=(first+x+1)/2;
        let chain=chains.find(c=>c.at(-1).y===y-1&&Math.abs(c.at(-1).x-center)<3);
        if(!chain){chain=[];chains.push(chain);}
        chain.push({x:center+.18*Math.sin(y*.71),y,width:x-first+1});
      }
    }
    g.lineCap='round';g.lineJoin='round';
    for(const chain of chains){
      if(chain.length<3)continue;
      const trace=(offset=0)=>{g.beginPath();g.moveTo((chain[0].x+offset)*ppt,(chain[0].y+.5)*ppt);for(let i=1;i<chain.length;i++){const a=chain[i-1],b=chain[i];g.quadraticCurveTo((a.x+offset)*ppt,(a.y+.5)*ppt,((a.x+b.x)/2+offset)*ppt,((a.y+b.y)/2+.5)*ppt);}};
      for(const [width,color,offset]of [[1.1,'rgba(14,26,22,.2)',.22],[.65,'rgba(20,31,26,.3)',.16],[.22,'rgba(178,166,120,.32)',-.09],[.035,'rgba(215,203,159,.65)',-.16]]){trace(offset);g.strokeStyle=color;g.lineWidth=Math.max(.65,ppt*width);g.stroke();}
      for(let i=1;i<chain.length-1;i++){
        const c=chain[i],cx=c.x*ppt,cy=(c.y+.5)*ppt;
        for(const sign of [-1,1]){
          const length=ppt*Math.min(c.width*.42,.65+atlasRandom(i,23)*1.1),dy=ppt*(.35+atlasRandom(i,41)*.6);
          g.beginPath();g.moveTo(cx,cy);g.bezierCurveTo(cx+sign*length*.3,cy+dy*.2,cx+sign*length*.65,cy+dy*.35,cx+sign*length,cy+dy);
          g.strokeStyle=sign<0?'rgba(199,184,135,.45)':'rgba(20,33,27,.4)';g.lineWidth=Math.max(.5,ppt*(mode==='world'?.035:.055));g.stroke();
        }
      }
    }
    // Low warm light integrates materials without hiding the map's information.
    const wash=g.createLinearGradient(0,0,size*ppt,size*ppt);
    wash.addColorStop(0,'rgba(230,188,101,.08)');wash.addColorStop(.5,'rgba(0,0,0,0)');wash.addColorStop(1,'rgba(4,17,15,.2)');g.fillStyle=wash;g.fillRect(0,0,size*ppt,size*ppt);
  }


  tileToScreen(x, y) {
    return { x: this.width / 2 + (x + .5 - this.center.x) * TILE * this.zoom, y: this.height / 2 + (y + .5 - this.center.y) * TILE * this.zoom };
  }

  screenToTile(x, y) {
    const p = worldAtScreen({ x, y }, this.getView());
    return this.tile(Math.floor(p.x), Math.floor(p.y));
  }

  select(x, y, { notify = true, focus = false } = {}) {
    const tile = x == null || y == null ? null : this.tile(Math.floor(x), Math.floor(y));
    this.selected = tile ? { x: tile.x, y: tile.y } : null;
    if (focus && tile) this.focus(tile.x, tile.y);
    this.updateAccessibleLabel();
    this.invalidate();
    if (notify) this.options.onSelect?.(tile);
    return tile;
  }

  focus(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.center = { x: x + .5, y: y + .5 };
    this.clampView();
    this.invalidate();
  }

  setZoom(level) {
    const levels = { near: 1.22, region: .52, world: this.minZoom };
    const next = typeof level === 'string' ? levels[level] : level;
    if (!Number.isFinite(next)) return;
    this.zoom = clamp(next, this.minZoom, MAX_ZOOM);
    if (level === 'world' && this.state) this.center = { x: this.state.world.size / 2, y: this.state.world.size / 2 };
    this.clampView();
    this.invalidate();
  }

  zoomBy(factor, point = { x: this.width / 2, y: this.height / 2 }) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const next = zoomAtPoint(this.getView(), clamp(this.zoom * factor, this.minZoom, MAX_ZOOM), point);
    this.zoom = next.zoom;
    this.center = next.center;
    this.clampView();
    this.invalidate();
  }

  clampView() {
    const size = this.state?.world.size || 49;
    this.zoom = clamp(this.zoom, this.minZoom, MAX_ZOOM);
    for (const [key, pixels] of [['x', this.width], ['y', this.height]]) {
      const half = pixels / (2 * TILE * this.zoom);
      // At world view center the complete map; at close view allow a modest margin.
      this.center[key] = half >= size / 2 ? size / 2 : clamp(this.center[key], half - .8, size - half + .8);
    }
  }

  resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(this.width * this.dpr);
    const height = Math.round(this.height * this.dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.clampView();
    this.invalidate();
  }

  localPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  inMinimap(p) {
    const r = this.minimapRect;
    return r && p.x >= r.x && p.x <= r.x + r.size && p.y >= r.y && p.y <= r.y + r.size;
  }

  minimapFocus(p) {
    const r = this.minimapRect;
    if (!r || !this.state) return;
    this.center = { x: clamp((p.x - r.x) / r.size, 0, 1) * this.state.world.size, y: clamp((p.y - r.y) / r.size, 0, 1) * this.state.world.size };
    this.clampView();
    this.invalidate();
  }

  pointerDown(event) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault();
    const p = this.localPoint(event);
    this.canvas.focus({ preventScroll: true });
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* Detached canvas. */ }
    this.pointers.set(event.pointerId, p);
    this.setHover(null);
    if (this.pointers.size === 1) {
      this.gesture = { start: p, previous: p, center: { ...this.center }, moved: false, blocked: false, minimap: this.inMinimap(p) };
      if (this.gesture.minimap) this.minimapFocus(p);
    } else {
      this.gesture.blocked = true;
      this.gesture.moved = true;
      this.gesture.minimap = false;
      this.beginPinch();
    }
    this.canvas.style.cursor = 'grabbing';
  }

  beginPinch() {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.pinch = { distance: Math.max(1, pointDistance(a, b)), zoom: this.zoom, anchor: worldAtScreen(middle, this.getView()) };
  }

  pointerMove(event) {
    const p = this.localPoint(event);
    if (!this.pointers.has(event.pointerId)) {
      if (event.pointerType !== 'touch' && !this.pointers.size) this.setHover(this.inMinimap(p) ? null : this.screenToTile(p.x, p.y), p);
      return;
    }
    event.preventDefault();
    this.pointers.set(event.pointerId, p);
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (!this.pinch) this.beginPinch();
      this.zoom = clamp(this.pinch.zoom * pointDistance(a, b) / this.pinch.distance, this.minZoom, MAX_ZOOM);
      this.center = { x: this.pinch.anchor.x - (mid.x - this.width / 2) / (TILE * this.zoom), y: this.pinch.anchor.y - (mid.y - this.height / 2) / (TILE * this.zoom) };
    } else if (this.gesture) {
      if (this.gesture.minimap) { this.minimapFocus(p); return; }
      if (pointDistance(p, this.gesture.start) > 6) this.gesture.moved = true;
      if (!this.gesture.moved) return;
      this.center = { x: this.gesture.center.x - (p.x - this.gesture.start.x) / (TILE * this.zoom), y: this.gesture.center.y - (p.y - this.gesture.start.y) / (TILE * this.zoom) };
    }
    this.clampView();
    this.invalidate();
  }

  pointerEnd(event, cancelled) {
    if (!this.pointers.has(event.pointerId)) return;
    const point = this.localPoint(event);
    const shouldSelect = !cancelled && this.pointers.size === 1 && this.gesture && !this.gesture.moved && !this.gesture.blocked && !this.gesture.minimap && pointDistance(point, this.gesture.start) <= 6;
    this.pointers.delete(event.pointerId);
    try { if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId); } catch { /* Capture already released. */ }
    if (this.pointers.size === 1) {
      const remaining = [...this.pointers.values()][0];
      this.gesture = { start: remaining, previous: remaining, center: { ...this.center }, moved: false, blocked: true, minimap: false };
      this.pinch = null;
    } else if (this.pointers.size >= 2) this.beginPinch();
    else {
      this.gesture = null;
      this.pinch = null;
      this.canvas.style.cursor = 'grab';
    }
    if (shouldSelect) {
      const tile = this.screenToTile(point.x, point.y);
      this.select(tile?.x ?? null, tile?.y ?? null);
    }
  }

  cancelGesture() {
    const ids = [...this.pointers.keys()];
    this.pointers.clear();
    this.gesture = null;
    this.pinch = null;
    for (const id of ids) { try { this.canvas.releasePointerCapture(id); } catch { /* Nothing captured. */ } }
    this.canvas.style.cursor = 'grab';
  }

  wheel(event) {
    event.preventDefault();
    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1;
    this.zoomBy(Math.exp(-clamp(event.deltaY * multiplier, -200, 200) * .0022), this.localPoint(event));
  }

  keyDown(event) {
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dx, dy] = arrows[event.key];
      const current = this.selected || { x: Math.floor(this.center.x), y: Math.floor(this.center.y) };
      const size = this.state?.world.size || 49;
      const x = clamp(current.x + dx * (event.shiftKey ? 5 : 1), 0, size - 1);
      const y = clamp(current.y + dy * (event.shiftKey ? 5 : 1), 0, size - 1);
      this.select(x, y);
      const p = this.tileToScreen(x, y);
      if (p.x < 44 || p.x > this.width - 44 || p.y < 44 || p.y > this.height - 44) this.focus(x, y);
    } else if (event.key === 'Escape') { event.preventDefault(); this.select(null, null); }
    else if (event.key === '+' || event.key === '=' || event.key === 'PageUp') { event.preventDefault(); this.zoomBy(1.3); }
    else if (event.key === '-' || event.key === '_' || event.key === 'PageDown') { event.preventDefault(); this.zoomBy(1 / 1.3); }
    else if (event.key === 'Home') {
      event.preventDefault();
      const home = this.state?.settlements.find((s) => s.ownerId === this.state.playerId);
      if (home) this.select(home.x, home.y, { focus: true });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(this.selected?.x ?? Math.floor(this.center.x), this.selected?.y ?? Math.floor(this.center.y));
    }
  }

  setHover(tile, point) {
    if (sameTile(this.hover, tile)) return;
    this.hover = tile ? { x: tile.x, y: tile.y } : null;
    this.options.onHover?.(tile, point || null);
    this.invalidate();
  }

  updateAccessibleLabel() {
    const tile = this.selected && this.tile(this.selected.x, this.selected.y);
    const settlement = tile && this.settlements?.get(`${tile.x},${tile.y}`);
    const current = tile ? `Seçili: ${settlement?.name || POIS[tile.poi?.type]?.label || TERRAINS[tile.terrain]?.label || 'Arazi'}, ${tile.x}, ${tile.y}. ` : '';
    this.canvas.setAttribute('aria-label', `HANEDANIAN haritası. ${current}Ok tuşlarıyla karo seçin; artı ve eksi ile yakınlaşın; Home ile başkente dönün; Escape ile seçimi kaldırın.`);
  }

  invalidate() {
    if (this.frame !== null || this.disposed || document.hidden) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (!this.disposed) this.draw();
    });
  }

  draw() {
    const started = performance.now();
    const ctx = this.ctx;
    ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, this.width, this.height);
    if (!this.state) return;
    this.drawnTiles = 0;
    const scale = TILE * this.zoom;
    const ox = this.width / 2 - this.center.x * scale;
    const oy = this.height / 2 - this.center.y * scale;
    const bounds = visibleTileBounds(this.getView(), this.state.world.size);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, this.state.world.size * scale, this.state.world.size * scale);
    ctx.clip();
    const cache = this.ensureTerrainCache();
    if (cache) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = this.mode === 'near' ? 'high' : 'medium';
      ctx.drawImage(cache, ox, oy, this.state.world.size * scale, this.state.world.size * scale);
    }
    this.drawnTiles = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1);
    const grain = this.ensureGrain();
    if (grain) {
      ctx.save();
      ctx.globalAlpha = .16;
      ctx.fillStyle = grain;
      ctx.fillRect(ox, oy, this.state.world.size * scale, this.state.world.size * scale);
      ctx.restore();
    }
    this.drawConnections(bounds, ox, oy, scale);
    if (this.mode !== 'near') this.drawInfluence(scale);
    this.drawHighlights(scale);
    for (let y = bounds.minY; y <= bounds.maxY; y++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const tile = this.tile(x, y);
      if (tile?.poi && !this.settlements.has(`${x},${y}`)) this.drawPoi(tile, scale);
    }
    this.drawSettlements(scale);
    this.drawArmies(scale);
    this.drawMarkers(scale);
    ctx.restore();
    ctx.strokeStyle = '#c4b896';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, this.state.world.size * scale, this.state.world.size * scale);
    this.drawCompass();
    this.drawScale(scale);
    this.drawMinimap();
    this.lastRenderMs = Math.round((performance.now() - started) * 100) / 100;
    this.canvas.dataset.drawnTiles = String(this.drawnTiles);
    this.canvas.dataset.renderMs = String(this.lastRenderMs);
    this.canvas.dataset.mapMode = this.mode;
    this.canvas.dataset.zoom = this.zoom.toFixed(3);
    this.canvas.dataset.center = `${this.center.x.toFixed(3)},${this.center.y.toFixed(3)}`;
    this.options.onViewChange?.(this.getView());
  }

  drawConnections(bounds, ox, oy, scale) {
    const ctx = this.ctx;
    if (this.riverPoints?.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let pass = 0; pass < 4; pass++) {
        const widths = [0.31, 0.23, 0.14, 0.022];
        const colors = ['rgba(36,48,44,.42)', '#2a4a4c', COLORS.water, 'rgba(147,182,157,.5)'];
        ctx.strokeStyle = colors[pass];
        for (let i = 1; i < this.riverPoints.length; i++) {
          const a = this.riverPoints[i - 1], b = this.riverPoints[i];
          if (b.y - a.y > 3 || b.y < bounds.minY - 1 || a.y > bounds.maxY + 1) continue;
          const ax = ox + (a.x + .5) * scale, ay = oy + (a.y + .5) * scale;
          const bx = ox + (b.x + .5) * scale, by = oy + (b.y + .5) * scale;
          const wobble = (variation(a.x, a.y) - .5) * scale * .22;
          const swell = 0.82 + variation2(a.x, a.y, 3) * 0.45;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.bezierCurveTo(ax + wobble, (ay + by) / 2, bx - wobble, (ay + by) / 2, bx, by);
          ctx.lineWidth = Math.max(pass === 3 ? .7 : 2, scale * widths[pass] * swell);
          ctx.stroke();
        }
      }
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    const segments = [];
    for (let y = bounds.minY; y <= bounds.maxY; y++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (this.tile(x, y)?.terrain !== 'road') continue;
      const px = ox + (x + .5) * scale, py = oy + (y + .5) * scale;
      let connected = false;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        if (this.tile(x + dx, y + dy)?.terrain !== 'road') continue;
        const wobble = (variation(x, y) - .5) * scale * .22;
        segments.push([px, py, px + dx * scale, py + dy * scale, wobble]);
        connected = true;
      }
      if (!connected) segments.push([px - .16 * scale, py + .08 * scale, px + .16 * scale, py - .08 * scale, 0]);
    }
    for (const [width, color] of [[Math.max(4, scale * .22), 'rgba(54,37,25,.55)'], [Math.max(2.4, scale * .13), COLORS.road], [Math.max(.7, scale * .035), '#d4c08a']]) {
      ctx.beginPath();
      for (const [ax, ay, bx, by, wobble] of segments) {
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo((ax + bx) / 2 + wobble, (ay + by) / 2 - wobble * .4, bx, by);
      }
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    ctx.fillStyle = '#c4a574';
    for (const [ax, ay, bx, by] of segments) {
      ctx.beginPath(); ctx.arc(ax, ay, Math.max(1.2, scale * .045), 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(bx, by, Math.max(1.2, scale * .045), 0, TAU); ctx.fill();
    }
  }

  factionColor(id) { return this.factions.get(id)?.color || (id === this.state.playerId ? COLORS.player : '#946350'); }

  drawInfluence(scale) {
    const ctx = this.ctx;
    for (const settlement of this.state.settlements) {
      const p = this.tileToScreen(settlement.x, settlement.y);
      const radius = scale * (this.isCapital(settlement) ? 2.5 : 2.0);
      if (p.x + radius < 0 || p.y + radius < 0 || p.x - radius > this.width || p.y - radius > this.height) continue;
      ctx.save();
      ctx.globalAlpha = .08;
      ctx.fillStyle = this.factionColor(settlement.ownerId);
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.fill();
      ctx.globalAlpha = .42;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  drawHighlights(scale) {
    const ctx = this.ctx;
    for (const [tile, selected] of [[this.hover, false], [this.selected, true]]) {
      if (!tile) continue;
      const p = this.tileToScreen(tile.x, tile.y);
      const size = Math.max(12, scale - 2);
      ctx.fillStyle = selected ? 'rgba(30,61,50,.16)' : 'rgba(255,248,230,.28)';
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      ctx.strokeStyle = selected ? '#1e3d32' : '#8a7a52';
      ctx.lineWidth = selected ? 2.6 : 1.1;
      ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
      if (selected) {
        ctx.strokeStyle = '#f3ead4'; ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x - size / 2 - 2, p.y - size / 2 - 2, size + 4, size + 4);
        const c = Math.max(4, Math.min(9, size * .18));
        ctx.strokeStyle = COLORS.oxblood; ctx.lineWidth = 2.2;
        for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
          const cx = p.x + sx * (size / 2 + 5), cy = p.y + sy * (size / 2 + 5);
          ctx.beginPath(); ctx.moveTo(cx - sx * c, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sy * c); ctx.stroke();
        }
      }
    }
  }

  drawPoi(tile, scale) {
    const ctx = this.ctx;
    const poi = tile.poi;
    const p = this.tileToScreen(tile.x, tile.y);
    if (this.mode === 'world' && !poi.ownerId && !['caravanserai', 'watchtower', 'ruins'].includes(poi.type)) return;
    const r = clamp(scale * .22, 3.5, 13);
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(36,40,32,.18)'; ctx.beginPath(); ctx.ellipse(0, r * .7, r + 5, r * .4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = COLORS.ivory;
    ctx.strokeStyle = poi.ownerId ? this.factionColor(poi.ownerId) : '#6a5c48';
    ctx.lineWidth = poi.ownerId ? 2 : 1.15;
    const type = poi.type;
    if (type === 'watchtower') {
      path(ctx, [[-r * .45, r * .7], [-r * .45, -r * .2], [0, -r * 1.15], [r * .45, -r * .2], [r * .45, r * .7]], true);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.oxblood; ctx.fillRect(-r * .12, -r * .15, r * .24, r * .5);
    } else if (type === 'caravanserai') {
      ctx.fillRect(-r * .85, -r * .15, r * 1.7, r * .85);
      ctx.strokeRect(-r * .85, -r * .15, r * 1.7, r * .85);
      ctx.beginPath(); ctx.arc(0, -r * .15, r * .55, Math.PI, 0); ctx.fill(); ctx.stroke();
    } else if (type === 'ruins') {
      ctx.fillRect(-r * .7, -r * .1, r * .35, r * .8);
      ctx.fillRect(r * .15, r * .1, r * .4, r * .6);
      ctx.strokeRect(-r * .7, -r * .1, r * .35, r * .8);
      ctx.strokeRect(r * .15, r * .1, r * .4, r * .6);
      ctx.beginPath(); ctx.moveTo(-r * .7, -r * .1); ctx.lineTo(-r * .35, -r * .55); ctx.stroke();
    } else if (type === 'pass') {
      path(ctx, [[-r, r * .55], [0, -r], [r, r * .55]], true); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = COLORS.brass; ctx.lineWidth = 1.6;
      path(ctx, [[-r * .35, r * .2], [0, -r * .35], [r * .35, r * .2]]); ctx.stroke();
    } else if (type === 'forest') {
      path(ctx, [[-r * .7, r * .5], [0, -r], [r * .7, r * .5]], true); ctx.fill(); ctx.stroke();
      path(ctx, [[-r * .5, r * .75], [0, -r * .15], [r * .5, r * .75]], true); ctx.fill(); ctx.stroke();
      path(ctx, [[0, r * .5], [0, r]]); ctx.stroke();
    } else if (type === 'pasture') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#3d5344'; ctx.lineWidth = 1.3;
      for (const px of [-r * .45, 0, r * .45]) { path(ctx, [[px, r * .35], [px, -r * .35], [px - 3, -r * .1]]); ctx.stroke(); }
    } else if (type === 'quarry') {
      ctx.fillRect(-r * .7, -r * .45, r * 1.4, r * .95);
      ctx.strokeRect(-r * .7, -r * .45, r * 1.4, r * .95);
      ctx.strokeStyle = '#6a5c48';
      path(ctx, [[-r * .4, -r * .1], [r * .4, -r * .1], [-r * .2, r * .3], [r * .3, r * .3]]); ctx.stroke();
    } else if (type === 'iron') {
      path(ctx, [[0, -r], [r * .75, 0], [0, r], [-r * .75, 0]], true); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.ore; path(ctx, [[0, -r * .45], [r * .35, 0], [0, r * .45], [-r * .35, 0]], true); ctx.fill();
    } else {
      path(ctx, [[0, -r], [r, 0], [0, r], [-r, 0]], true); ctx.fill(); ctx.stroke();
    }
    if (this.mode === 'near' && scale >= 44) {
      if (type === 'watchtower') {
        ctx.fillStyle = '#4a3c30';
        ctx.fillRect(-r * .08, -r * 1.2, r * .16, r * .35);
        ctx.fillStyle = COLORS.brass;
        ctx.beginPath(); ctx.arc(0, -r * 1.22, r * .12, 0, TAU); ctx.fill();
      } else if (type === 'caravanserai') {
        ctx.fillStyle = '#6a5438';
        ctx.fillRect(-r * .35, .05 * r, r * .22, r * .4);
      } else if (type === 'pasture') {
        ctx.fillStyle = 'rgba(61,83,68,.35)';
        ctx.beginPath(); ctx.ellipse(-r * .15, r * .15, r * .35, r * .18, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    if (scale >= 48 && (sameTile(this.hover, tile) || sameTile(this.selected, tile))) this.label(POIS[poi.type]?.label || 'Stratejik nokta', p.x, p.y + r + 16, false);
  }

  drawSettlements(scale) {
    const ctx = this.ctx;
    const labels = [];
    const sorted = [...this.state.settlements].sort((a, b) => Number(a.ownerId === this.state.playerId) - Number(b.ownerId === this.state.playerId));
    for (const settlement of sorted) {
      const p = this.tileToScreen(settlement.x, settlement.y);
      if (p.x < -70 || p.y < -70 || p.x > this.width + 70 || p.y > this.height + 70) continue;
      const own = settlement.ownerId === this.state.playerId;
      const color = this.factionColor(settlement.ownerId);
      const capital = this.isCapital(settlement);
      const fortified = (settlement.buildings?.wall || 0) >= 2;
      const r = clamp(scale * (capital ? .42 : .34), capital ? 6 : 5, capital ? 26 : 22);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(55,64,47,.14)';
      ctx.beginPath(); ctx.ellipse(1, r * .49, r * 1.1, r * .42, 0, 0, TAU); ctx.fill();
      if (scale < 25) {
        ctx.fillStyle = COLORS.ivory; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, TAU); ctx.fill();
        if (capital) {
          ctx.fillStyle = color;
          path(ctx, [[0, -r - 2], [r * .72, -r * .2], [r * .45, r * .8], [-r * .45, r * .8], [-r * .72, -r * .2]], true);
          ctx.fill();
        } else {
          ctx.fillStyle = color; ctx.fillRect(-r * .8, -r * .8, r * 1.6, r * 1.6);
        }
        if (own) { ctx.strokeStyle = COLORS.ivory; ctx.lineWidth = 1; ctx.strokeRect(-r * .43, -r * .43, r * .86, r * .86); }
      } else {
        ctx.scale(r / 20, r / 20);
        ctx.fillStyle = '#e5dfc7'; ctx.strokeStyle = '#737563'; ctx.lineWidth = 1;
        path(ctx, [[-18, 7], [-18, -7], [-10, -11], [10, -11], [18, -7], [18, 7], [0, 16]], true); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#b6b198'; path(ctx, [[0, 4], [18, -7], [18, 7], [0, 16]], true); ctx.fill();
        ctx.fillStyle = '#c6c0a7'; path(ctx, [[-18, -7], [0, 4], [0, 16], [-18, 7]], true); ctx.fill();
        ctx.fillStyle = '#aa9d79'; ctx.fillRect(-8, -16, 15, 17);
        ctx.fillStyle = capital ? COLORS.oxblood : '#a87458'; path(ctx, [[-11, -16], [-1, -23], [11, -16], [4, -12]], true); ctx.fill();
        ctx.fillStyle = '#786f57'; ctx.fillRect(-2, -6, 5, 7);
        for (const tx of [-17, 12]) {
          ctx.fillStyle = '#8c896f'; ctx.fillRect(tx, -10, 6, 17);
          ctx.fillStyle = '#c9bd95'; ctx.fillRect(tx, -12, 2, 4); ctx.fillRect(tx + 4, -12, 2, 4);
        }
        if (fortified) {
          ctx.strokeStyle = '#4a4c48'; ctx.lineWidth = 1.4;
          path(ctx, [[-22, 8], [-22, -2], [-18, -6], [-14, -2], [-10, -6], [-6, -2], [-2, -6], [2, -2], [6, -6], [10, -2], [14, -6], [18, -2], [22, -6], [22, 8]]); ctx.stroke();
        }
        ctx.strokeStyle = '#5f6451'; ctx.lineWidth = 1.2; path(ctx, [[8, -14], [8, -32]]); ctx.stroke();
        ctx.fillStyle = color; path(ctx, [[8, -32], [23, -29], [8, -24]], true); ctx.fill();
        if (capital) {
          ctx.fillStyle = COLORS.brass;
          path(ctx, [[-6, -28], [-2, -36], [2, -28], [6, -36], [8, -26], [-8, -26]], true); ctx.fill();
        }
        if (own) { ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 6, 24, 15, 0, .1, Math.PI - .1); ctx.stroke(); }
      }
      ctx.restore();
      if (scale > 20 || own || capital) {
        const text = settlement.name || 'Yerleşim';
        const labelY = p.y + r * .85 + 15;
        const maxWidth = this.mode === 'near' ? 150 : 112;
        const collision = labels.some((l) => Math.abs(l.x - p.x) < maxWidth && Math.abs(l.y - labelY) < 22);
        if (!collision || own || capital || sameTile(this.selected, settlement)) {
          this.label(capital ? `★ ${text}` : text, p.x, labelY, own, maxWidth);
          labels.push({ x: p.x, y: labelY });
        }
      }
    }
  }

  label(text, x, y, own = false, maxWidth = 150) {
    const ctx = this.ctx;
    ctx.font = `${own ? '700' : '600'} 11px ui-sans-serif, system-ui, sans-serif`;
    const width = Math.min(ctx.measureText(text).width, maxWidth) + 12;
    ctx.fillStyle = own ? 'rgba(243,234,212,.95)' : 'rgba(236,226,196,.88)';
    ctx.fillRect(x - width / 2, y - 11, width, 17);
    if (own) { ctx.fillStyle = COLORS.player; ctx.fillRect(x - width / 2, y - 11, 2, 17); }
    ctx.fillStyle = own ? '#1e3d32' : '#3a3228';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y + 1, maxWidth);
  }

  drawArmies(scale) {
    const ctx = this.ctx;
    for (const army of this.visibleArmies || []) {
      if (!army.from || !army.to) continue;
      const from = this.tileToScreen(army.from.x, army.from.y);
      const to = this.tileToScreen(army.to.x, army.to.y);
      const progress = clamp((this.state.time - army.departAt) / Math.max(1, army.arriveAt - army.departAt), 0, 1);
      const p = { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
      const color = this.factionColor(army.ownerId);
      if (army.ownerId === this.state.playerId) {
        ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = .55; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
        path(ctx, [[from.x, from.y], [to.x, to.y]]); ctx.stroke(); ctx.restore();
      }
      if (p.x < -14 || p.y < -14 || p.x > this.width + 14 || p.y > this.height + 14) continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(to.y - from.y, to.x - from.x));
      ctx.fillStyle = color; ctx.strokeStyle = '#fff5dc'; ctx.lineWidth = 1.7;
      path(ctx, [[8, 0], [-5, -5], [-2, 0], [-5, 5]], true); ctx.fill(); ctx.stroke(); ctx.restore();
      if (scale >= 40 && army.ownerId === this.state.playerId) {
        const mission = army.returning ? 'Dönüş' : ({ scout: 'Keşif', expand: 'Yerleşim', settle: 'Yerleşim', attack: 'Sefer', raid: 'Akın', trade: 'Ticaret', claim: 'Bağlama', reinforce: 'Takviye' }[army.mission] || 'Sefer');
        this.label(`${mission} · ${Math.max(0, Math.ceil(army.arriveAt - this.state.time))} dk`, p.x, p.y - 15, false, 110);
      }
    }
  }

  drawMarkers(scale) {
    const markers = this.state.settings?.markers;
    if (!Array.isArray(markers)) return;
    const ctx = this.ctx;
    for (const marker of markers.slice(0, 24)) {
      if (!marker || !Number.isInteger(marker.x) || !Number.isInteger(marker.y) || !this.tile(marker.x, marker.y)) continue;
      const p = this.tileToScreen(marker.x, marker.y);
      if (p.x < -20 || p.y < -20 || p.x > this.width + 20 || p.y > this.height + 20) continue;
      const offset = clamp(scale * .32, 3, 24);
      ctx.save(); ctx.translate(p.x + offset, p.y - offset);
      ctx.fillStyle = '#8b4430'; ctx.strokeStyle = '#fbf3df'; ctx.lineWidth = 1.5;
      path(ctx, [[-4, -7], [5, -7], [5, 6], [.5, 3], [-4, 6]], true);
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  drawCompass() {
    const ctx = this.ctx;
    const x = this.width - 30, y = 76;
    if (this.height < 230) return;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#5a4a32'; ctx.strokeStyle = 'rgba(90,74,50,.5)'; ctx.lineWidth = .8;
    path(ctx, [[0, -12], [-4, 4], [0, 1], [4, 4]], true); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.stroke();
    ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('K', 0, -23);
    ctx.restore();
  }

  drawScale(scale) {
    const ctx = this.ctx;
    const tiles = scale > 65 ? 1 : scale > 28 ? 2 : scale > 12 ? 5 : 10;
    const width = scale * tiles;
    const x = 19, y = this.height - 24;
    if (this.height < 120) return;
    ctx.fillStyle = 'rgba(243,234,212,.9)'; ctx.fillRect(x - 7, y - 21, Math.max(width + 14, 76), 38);
    ctx.strokeStyle = '#6a5c48'; ctx.lineWidth = 1.2;
    path(ctx, [[x, y - 4], [x, y], [x + width, y], [x + width, y - 4]]); ctx.stroke();
    ctx.fillStyle = '#3a3228'; ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${tiles} karo`, x, y - 8);
    if (this.width > 480) {
      ctx.fillStyle = '#6a5c48'; ctx.textAlign = 'left';
      ctx.fillText(`${Math.floor(this.center.x)} : ${Math.floor(this.center.y)}`, x + width + 24, y - 1);
    }
  }

  drawMinimap() {
    this.minimapRect = null;
    if (this.width < 760 || this.height < 400 || this.mode === 'world') return;
    const size = 116, x = this.width - size - 18, y = this.height - size - 18;
    const ctx = this.ctx, worldSize = this.state.world.size;
    if (!this.minimapTerrain) {
      const surface = document.createElement('canvas');
      surface.width = worldSize; surface.height = worldSize;
      const mini = surface.getContext('2d');
      for (const tile of this.state.world.tiles) { mini.fillStyle = COLORS[tile.terrain] || COLORS.plain; mini.fillRect(tile.x, tile.y, 1, 1); }
      this.minimapTerrain = surface;
    }
    ctx.fillStyle = 'rgba(243,234,212,.94)'; ctx.fillRect(x - 6, y - 23, size + 12, size + 29);
    ctx.strokeStyle = '#c4b896'; ctx.lineWidth = 1; ctx.strokeRect(x - 6, y - 23, size + 12, size + 29);
    ctx.fillStyle = '#5a4a32'; ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('DÜNYA · GİTMEK İÇİN TIKLA', x, y - 9);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(this.minimapTerrain, x, y, size, size); ctx.imageSmoothingEnabled = true;
    for (const settlement of this.state.settlements) {
      ctx.fillStyle = this.factionColor(settlement.ownerId);
      ctx.fillRect(x + (settlement.x + .5) / worldSize * size - 2, y + (settlement.y + .5) / worldSize * size - 2, 4, 4);
    }
    const a = worldAtScreen({ x: 0, y: 0 }, this.getView()), b = worldAtScreen({ x: this.width, y: this.height }, this.getView());
    ctx.strokeStyle = '#f3ead4'; ctx.lineWidth = 3;
    const vx = x + clamp(a.x, 0, worldSize) / worldSize * size, vy = y + clamp(a.y, 0, worldSize) / worldSize * size;
    const vw = (clamp(b.x, 0, worldSize) - clamp(a.x, 0, worldSize)) / worldSize * size, vh = (clamp(b.y, 0, worldSize) - clamp(a.y, 0, worldSize)) / worldSize * size;
    ctx.strokeRect(vx, vy, vw, vh); ctx.strokeStyle = '#1e3d32'; ctx.lineWidth = 1; ctx.strokeRect(vx, vy, vw, vh);
    this.minimapRect = { x, y, size };
  }

  destroy() {
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.cancelGesture();
    this.observer?.disconnect();
    this.listeners.forEach((remove) => remove());
    this.listeners.length = 0;
    this.terrainCache = null;
    this.terrainCacheWorld = null;
    this.minimapTerrain = null;
  }
}

export function createMap(canvas, options) { return new StrategyMap(canvas, options); }
