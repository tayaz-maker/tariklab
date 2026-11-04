import { JUNCTIONS, signalAxis } from "../domain/traffic.ts";
import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import type { Person, Point, RenderProjection, Vehicle } from "../domain/types";
import { retargetMotion, sampleMotion } from "./interpolation";
import { cameraTranslation } from "./camera";
import { BUILDINGS, LAND_HEIGHT, ROAD_CENTERS, isRoad, project, unproject } from "./world";

// Physics headings stay in world coordinates; compare projected tangents to eight authored axes.
function vehicleFrame(heading: number): number {
  const origin = project({ x: 0, y: 0 });
  const end = project({ x: Math.cos(heading), y: Math.sin(heading) });
  const dx = end.x - origin.x,
    dy = end.y - origin.y;
  let best = 0,
    score = -Infinity;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const axis = project({ x: Math.cos(angle), y: Math.sin(angle) });
    const ax = axis.x - origin.x,
      ay = axis.y - origin.y;
    const dot = (dx * ax + dy * ay) / Math.hypot(ax, ay);
    if (dot > score) {
      score = dot;
      best = i;
    }
  }
  return best;
}
function vehicleVariant(id: string): string {
  const n = Number(id.match(/\d+$/)?.[0] ?? 0);
  return ["car", "cargo", "van", "hatch"][n % 4];
}
function animationOffset(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 540;
}
type Frame = { x: number; y: number; w: number; h: number; pivot: Point };
type Atlas = {
  buildings: { image: string; frames: Record<string, Frame> };
  actors: { image: string; frames: Record<string, Frame> };
};
type ActorView = {
  sprite: Sprite;
  label: Text;
  from: Point;
  to: Point;
  direction: number;
  moving: boolean;
  updatedAt: number;
  duration: number;
  person?: Person;
  vehicle?: Vehicle;
  fadeSprite?: Sprite;
  vehicleFrameName?: string;
  fadeStartedAt?: number;
};
export type WorldRenderer = {
  render: (projection: RenderProjection) => void;
  resize: () => void;
  setZoom: (delta: number) => void;
  destroy: () => void;
  metrics: () => unknown;
};
declare const SOCIAL_ATLAS_URL: string;
const BASE = "/games/social-engine/assets/";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function groundTexture(cx: number, cy: number): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1560;
  canvas.height = 800;
  const c = canvas.getContext("2d")!;
  const drawTile = (x: number, y: number, color: string) => {
    const p = project({ x: x - cx, y: y - cy });
    const px = p.x + 780,
      py = p.y + 8;
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px + 24, py + 12);
    c.lineTo(px, py + 24);
    c.lineTo(px - 24, py + 12);
    c.closePath();
    c.fillStyle = color;
    c.fill();
    return { x: px, y: py };
  };
  for (let y = cy; y < cy + 32; y++)
    for (let x = cx; x < cx + 32; x++) {
      const p = { x: x + 0.5, y: y + 0.5 },
        water = y >= LAND_HEIGHT;
      const nearRoad =
        ROAD_CENTERS.horizontal.some((v) => Math.abs(p.y - v) <= 3.5) ||
        ROAD_CENTERS.vertical.some((v) => Math.abs(p.x - v) <= 3.5);
      const nearBuilding = BUILDINGS.some(
        (b) => x >= b.x - 1 && x <= b.x + b.w + 1 && y >= b.y - 1 && y <= b.y + b.h + 1,
      );
      const coastal = y >= 54 && y < 57;
      const road = isRoad(p);
      const stone = !road && (nearRoad || nearBuilding || coastal);
      const n = (x * 17 + y * 31) % 7;
      const color = water
        ? ["#376b72", "#396e75", "#3c7278"][n % 3]
        : road
          ? ["#626e6c", "#636f6d", "#64706e"][n % 3]
          : stone
            ? ["#bebba9", "#c0bdab", "#c2bfad"][n % 3]
            : ["#829371", "#859673", "#899974"][n % 3];
      const q = drawTile(x, y, color);
      if (stone) {
        c.strokeStyle = "#a59f8a55";
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(q.x - 23, q.y + 12);
        c.lineTo(q.x, q.y + 23);
        c.lineTo(q.x + 23, q.y + 12);
        c.stroke();
        c.beginPath();
        c.moveTo(q.x, q.y + 12);
        c.lineTo(q.x + 12, q.y + 6);
        c.stroke();
      }
      if (stone) {
        // Street curbs follow the actual road boundary; no collision data is changed.
        const edges: [number, number, number, number, number, number][] = [
          [1, 0, 24, 12, 0, 24],
          [-1, 0, 0, 0, -24, 12],
          [0, 1, 0, 24, -24, 12],
          [0, -1, 0, 0, 24, 12],
        ];
        c.strokeStyle = "#e0d7bd";
        c.lineWidth = 2;
        for (const [dx, dy, x1, y1, x2, y2] of edges) {
          if (!isRoad({ x: p.x + dx, y: p.y + dy })) continue;
          c.beginPath();
          c.moveTo(q.x + x1, q.y + y1);
          c.lineTo(q.x + x2, q.y + y2);
          c.stroke();
        }
      }
      if (road && (x * 19 + y * 23) % 53 === 0) {
        // Restrained asphalt repair seam, deterministic and baked once per chunk.
        c.strokeStyle = "#45565344";
        c.lineWidth = 1.1;
        c.beginPath();
        c.moveTo(q.x - 7, q.y + 10);
        c.lineTo(q.x + 4, q.y + 15);
        c.stroke();
      }
      if (water && n % 2 === 0) {
        c.strokeStyle = "#b6d3c02b";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(q.x - 7, q.y + 10);
        c.lineTo(q.x + 10, q.y + 14);
        c.stroke();
      }
      if (
        road &&
        ((ROAD_CENTERS.vertical.includes(x) && y % 3 === 0) ||
          (ROAD_CENTERS.horizontal.includes(y) && x % 3 === 0))
      ) {
        c.strokeStyle = "#e2d5acb0";
        c.lineWidth = 1.5;
        c.beginPath();
        if (ROAD_CENTERS.vertical.includes(x)) {
          c.moveTo(q.x + 4, q.y + 7);
          c.lineTo(q.x - 8, q.y + 13);
        } else {
          c.moveTo(q.x - 4, q.y + 7);
          c.lineTo(q.x + 8, q.y + 13);
        }
        c.stroke();
      }
      if (road && (x * 11 + y * 7) % 43 === 0) {
        c.strokeStyle = "#485956aa";
        c.lineWidth = 1.2;
        c.beginPath();
        c.ellipse(q.x, q.y + 12, 4.5, 2.2, 0, 0, Math.PI * 2);
        c.stroke();
      }
      if (stone && (x * 13 + y * 7) % 31 === 0) {
        c.strokeStyle = "#827f7055";
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(q.x - 4, q.y + 10);
        c.lineTo(q.x + 3, q.y + 14);
        c.stroke();
      }
      if (y === 56) {
        c.strokeStyle = "#f0d9a5";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(q.x - 24, q.y + 12);
        c.lineTo(q.x, q.y + 24);
        c.stroke();
      }
      // Painted pedestrian crossings occur at defined intersections.
      if (
        road &&
        ((x >= 15 && x <= 20 && [15, 21, 33, 39, 49, 55].includes(y)) ||
          (x >= 40 && x <= 45 && [15, 21, 33, 39, 49, 55].includes(y)))
      ) {
        c.strokeStyle = "#e5dfc9";
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(q.x - 11, q.y + 9);
        c.lineTo(q.x + 2, q.y + 15);
        c.stroke();
      }
    }
  return Texture.from(canvas);
}
function interiorTexture(scene: string): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 640;
  const c = canvas.getContext("2d")!;
  const b = BUILDINGS.find((v) => v.id === scene)!;
  const p = (x: number, y: number, z = 0) => {
    const q = project({ x, y }, z);
    return { x: q.x + 360, y: q.y + 160 };
  };
  const poly = (points: Point[], fill: string, stroke?: string) => {
    c.beginPath();
    points.forEach((v, i) => (i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 1;
      c.stroke();
    }
  };
  const cuboid = (x: number, y: number, w: number, h: number, z: number, color: string) => {
    poly([p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h)], "#5e594c");
    poly([p(x, y + h), p(x + w, y + h), p(x + w, y + h, z), p(x, y + h, z)], "#846b4f");
    poly([p(x + w, y), p(x + w, y + h), p(x + w, y + h, z), p(x + w, y, z)], "#6e614e");
    poly([p(x, y, z), p(x + w, y, z), p(x + w, y + h, z), p(x, y + h, z)], color);
  };
  const clinical = b.kind === "clinic" || b.kind === "police";
  const floor = clinical
    ? ["#cfcec2", "#c4c7bc"]
    : b.kind === "home" || b.kind === "cafe"
      ? ["#bea17a", "#b59971"]
      : ["#cbbd9f", "#c3b495"];
  for (let y = 1; y < 11; y++)
    for (let x = 1; x < 13; x++)
      poly([p(x, y), p(x + 1, y), p(x + 1, y + 1), p(x, y + 1)], floor[(x + y) % 2], "#4b553313");
  poly([p(1, 1), p(13, 1), p(13, 1, 4), p(1, 1, 4)], clinical ? "#a8bcb3" : "#bfae8f");
  poly([p(1, 1), p(1, 11), p(1, 11, 4), p(1, 1, 4)], clinical ? "#c6d4c7" : "#d2c5a7");
  // A window, skirting and framed local artwork give every cutaway room a real interior scale.
  poly([p(1, 1, 0.2), p(13, 1, 0.2), p(13, 1, 0.35), p(1, 1, 0.35)], "#7b7058");
  poly([p(1, 1, 0.2), p(1, 11, 0.2), p(1, 11, 0.35), p(1, 1, 0.35)], "#8e7f60");
  poly([p(1, 5, 1.4), p(1, 8, 1.4), p(1, 8, 3.4), p(1, 5, 3.4)], "#f0e0b8");
  poly([p(1, 5.15, 1.55), p(1, 7.85, 1.55), p(1, 7.85, 3.25), p(1, 5.15, 3.25)], "#779e99");
  poly([p(1, 6.45, 1.55), p(1, 6.55, 1.55), p(1, 6.55, 3.25), p(1, 6.45, 3.25)], "#f0e0b8");
  // All solid furnishings stay within the collision regions in domain/world.ts.
  for (const [x, y, w, h] of [
    [1, 1, 2.3, 3.8],
    [10, 1, 3, 3.8],
  ]) {
    if (b.kind === "home" || b.kind === "clinic") {
      cuboid(x, y, w, h, 0.7, b.kind === "clinic" ? "#dce3ce" : "#8b6570");
      poly(
        [
          p(x + 0.15, y + 0.2, 0.75),
          p(x + w - 0.15, y + 0.2, 0.75),
          p(x + w - 0.15, y + 1.1, 0.75),
          p(x + 0.15, y + 1.1, 0.75),
        ],
        "#f2e5c7",
      );
      poly(
        [
          p(x + 0.1, y + 1.5, 0.76),
          p(x + w - 0.1, y + 1.5, 0.76),
          p(x + w - 0.1, y + h - 0.1, 0.76),
          p(x + 0.1, y + h - 0.1, 0.76),
        ],
        b.kind === "clinic" ? "#9fb9ae" : "#b67a6a",
      );
    } else {
      cuboid(x, y, w, h, 1.2, b.kind === "garage" ? "#81958b" : "#b99768");
      if (["office", "security", "bank", "police"].includes(b.kind)) {
        const q = p(x + w / 2, y + 1, 1.3);
        c.fillStyle = "#344a45";
        c.fillRect(q.x - 14, q.y - 27, 28, 22);
        c.fillStyle = "#7da49a";
        c.fillRect(q.x - 11, q.y - 24, 22, 16);
        c.fillStyle = "#354a42";
        c.fillRect(q.x - 3, q.y - 6, 6, 7);
        c.fillRect(q.x - 10, q.y, 20, 3);
      } else if (["cafe", "restaurant"].includes(b.kind)) {
        for (let j = 0; j < 3; j++) {
          const q = p(x + w / 2, y + 0.6 + j, 1.25);
          c.fillStyle = "#ebe0c6";
          c.beginPath();
          c.ellipse(q.x, q.y, 11, 5, 0, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "#a05232";
          c.beginPath();
          c.ellipse(q.x, q.y - 3, 5, 3, 0, 0, Math.PI * 2);
          c.fill();
        }
      } else
        for (let j = 0; j < 5; j++) {
          const q = p(x + 0.7 + (j % 2) * 0.8, y + 0.5 + Math.floor(j / 2), 1.3);
          c.fillStyle = ["#bd7252", "#67836a", "#d7b569", "#69818d", "#a56860"][j];
          if (b.kind === "market") {
            c.beginPath();
            c.ellipse(q.x, q.y - 4, 8, 6, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = "#e2b65c";
            c.beginPath();
            c.arc(q.x + 2, q.y - 5, 3, 0, Math.PI * 2);
            c.fill();
          } else {
            c.fillRect(q.x - 7, q.y - 11, 14, 14);
            c.fillStyle = "#f5dfb455";
            c.fillRect(q.x - 5, q.y - 9, 10, 2);
          }
        }
    }
  }
  if (b.kind === "clinic") {
    const q = p(7, 1, 2.1);
    c.fillStyle = "#b1574c";
    c.fillRect(q.x - 4, q.y - 12, 8, 24);
    c.fillRect(q.x - 12, q.y - 4, 24, 8);
  } else {
    const q = p(7, 1, 1.8);
    c.fillStyle = "#7d6143";
    c.fillRect(q.x - 24, q.y - 17, 48, 30);
    c.fillStyle = "#7e9d8b";
    c.fillRect(q.x - 20, q.y - 13, 40, 22);
    c.fillStyle = "#d7b670";
    c.beginPath();
    c.arc(q.x + 10, q.y - 7, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#466f68";
    c.beginPath();
    c.moveTo(q.x - 20, q.y + 9);
    c.lineTo(q.x - 2, q.y - 3);
    c.lineTo(q.x + 20, q.y + 9);
    c.fill();
  }
  const door = p(7, 10);
  c.strokeStyle = "#74a99a";
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(door.x, door.y, 28, 13, 0, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "#29463e";
  c.font = "bold 14px sans-serif";
  c.textAlign = "center";
  c.fillText("ÇIKIŞ", door.x, door.y + 5);
  const title = p(7, 1, 3.5);
  c.fillStyle = "#3c4f43";
  c.fillRect(title.x - 105, title.y - 18, 210, 32);
  c.fillStyle = "#f1ddb5";
  c.font = "600 16px sans-serif";
  c.fillText(b.name, title.x, title.y + 4);
  return Texture.from(canvas);
}

async function loadAtlasImage(url: string): Promise<Texture> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const img = new Image();
    img.decoding = "async";
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          img.src = "";
          reject(new Error("Görsel indirme zaman aşımı."));
        }, 12000);
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Görsel yüklenemedi."));
        };
        img.src = url;
      });
      return Texture.from(img);
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error("Görsel yüklenemedi.");
}
export async function createRenderer(
  host: HTMLElement,
  onDestination: (point: Point) => void,
): Promise<WorldRenderer> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    background: 0x254b50,
    preference: "webgl",
    skipExtensionImports: true,
  });
  app.canvas.setAttribute("aria-label", "DARAMCIK izometrik oyun dünyası");
  app.canvas.style.display = "block";
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  app.canvas.style.touchAction = "none";
  host.appendChild(app.canvas);
  let atlas: Atlas, buildingBase: Texture, actorBase: Texture;
  try {
    const response = await fetch(
      typeof SOCIAL_ATLAS_URL === "string" ? SOCIAL_ATLAS_URL : `${BASE}atlas.json`,
    );
    if (!response.ok) throw new Error("Oyun görselleri yüklenemedi.");
    atlas = (await response.json()) as Atlas;
    const loaded = await Promise.allSettled([
      loadAtlasImage(`${BASE}${atlas.buildings.image}`),
      loadAtlasImage(`${BASE}${atlas.actors.image}`),
    ]);
    const failed = loaded.find((item) => item.status === "rejected");
    if (failed) {
      for (const item of loaded) if (item.status === "fulfilled") item.value.destroy(true);
      throw failed.reason;
    }
    [buildingBase, actorBase] = loaded.map(
      (item) => (item as PromiseFulfilledResult<Texture>).value,
    );
  } catch (error) {
    app.destroy(true, { children: true });
    throw error;
  }
  const textures = new Map<string, Texture>();
  for (const [name, frame] of Object.entries(atlas.buildings.frames))
    textures.set(
      name,
      new Texture({
        source: buildingBase.source,
        frame: new Rectangle(frame.x, frame.y, frame.w, frame.h),
      }),
    );
  for (const [name, frame] of Object.entries(atlas.actors.frames))
    textures.set(
      name,
      new Texture({
        source: actorBase.source,
        frame: new Rectangle(frame.x, frame.y, frame.w, frame.h),
      }),
    );
  // Atlas vehicle body uses a magenta mask. Recolor only that mask, leaving
  // glass, wheels, lamps, plate and cargo untouched. Cache and own each texture.
  const paintedVehicles = new Map<string, Texture>();
  const paintedVehicle = (name: string, color: number) => {
    const paint = Number.isFinite(color) ? color & 0xffffff : 0xd9ae54;
    const key = `${name}:${paint}`;
    const cached = paintedVehicles.get(key);
    if (cached) return cached;
    const frame = atlas.actors.frames[name];
    if (!frame) throw new Error("Gerekli araç görseli eksik: " + name);
    const canvas = document.createElement("canvas");
    canvas.width = frame.w;
    canvas.height = frame.h;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(
      actorBase.source.resource as HTMLImageElement,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      frame.w,
      frame.h,
    );
    const pixels = context.getImageData(0, 0, frame.w, frame.h);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i],
        g = pixels.data[i + 1],
        b = pixels.data[i + 2];
      if (r > 40 && b > 40 && r > g * 1.35 && b > g * 1.35 && Math.abs(r - b) < 70) {
        const shade = (r + b) / 510;
        pixels.data[i] = ((paint >> 16) & 255) * shade;
        pixels.data[i + 1] = ((paint >> 8) & 255) * shade;
        pixels.data[i + 2] = (paint & 255) * shade;
      }
    }
    context.putImageData(pixels, 0, 0);
    const texture = Texture.from(canvas);
    paintedVehicles.set(key, texture);
    return texture;
  };
  const world = new Container(),
    ground = new Container(),
    objects = new Container(),
    overlay = new Graphics();
  objects.sortableChildren = true;
  world.addChild(ground, objects);
  app.stage.addChild(world, overlay);
  const actors = new Map<string, ActorView>(),
    buildings = new Map<string, Sprite>(),
    doors = new Map<string, Graphics>(),
    decor: Sprite[] = [],
    groundTextures: Texture[] = [];
  let interior: Texture | null = null;
  let current: RenderProjection | null = null,
    lastTick = -1,
    zoom = 0.9,
    scene = "",
    destroyed = false,
    camera = { x: 0, y: 0 },
    initialized = false;
  const stopMarkers: Container[] = [];
  const trafficSignals: Graphics[] = [];
  const streetLines: Graphics[] = [];
  const lampGlows: Graphics[] = [];
  const optionalTextures: Texture[] = [];
  const sceneZoom: Record<string, number> = { outside: 0.9 };
  const frameSamples: number[] = [],
    drawSamples: number[] = [];
  let lastFrame = performance.now(),
    frameCount = 0,
    sceneChanges = 0,
    visibleActors = 0;
  const sprite = (name: string, point: Point, scale = 1) => {
    let f = atlas.actors.frames[name] ?? atlas.buildings.frames[name];
    if (!f && ["tree", "lamp", "bench", "planter"].includes(name)) {
      const canvas = document.createElement("canvas");
      canvas.width = 48;
      canvas.height = 48;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#607a60";
      c.beginPath();
      c.ellipse(24, 22, 16, 13, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#795f45";
      c.fillRect(21, 27, 6, 19);
      const texture = Texture.from(canvas);
      optionalTextures.push(texture);
      textures.set(name, texture);
      f = { x: 0, y: 0, w: 48, h: 48, pivot: { x: 24, y: 46 } };
      atlas.actors.frames[name] = f;
    }
    if (!f || !textures.has(name)) throw new Error("Gerekli oyun görseli eksik: " + name);
    const s = new Sprite(textures.get(name)!);
    s.anchor.set(f.pivot.x / f.w, f.pivot.y / f.h);
    const p = project(point);
    s.position.set(p.x, p.y);
    s.scale.set(scale);
    s.zIndex = p.y;
    objects.addChild(s);
    return s;
  };
  const resetScene = (next: string) => {
    sceneChanges++;
    for (const marker of stopMarkers) marker.destroy({ children: true });
    stopMarkers.length = 0;
    for (const light of trafficSignals) light.destroy();
    trafficSignals.length = 0;
    for (const line of streetLines) line.destroy();
    streetLines.length = 0;
    for (const glow of lampGlows) glow.destroy();
    lampGlows.length = 0;
    if (scene) sceneZoom[scene] = zoom;
    scene = next;
    zoom = sceneZoom[next] ?? 1.25;
    for (const v of actors.values()) {
      v.sprite.destroy();
      v.fadeSprite?.destroy();
      v.label.destroy();
    }
    actors.clear();
    for (const texture of paintedVehicles.values()) texture.destroy(true);
    paintedVehicles.clear();
    for (const s of buildings.values()) s.destroy();
    buildings.clear();
    for (const d of doors.values()) d.destroy();
    doors.clear();
    for (const s of decor) s.destroy();
    decor.length = 0;
    ground.removeChildren().forEach((v) => v.destroy());
    for (const t of groundTextures) t.destroy(true);
    groundTextures.length = 0;
    if (interior) {
      interior.destroy(true);
      interior = null;
    }
    if (scene === "outside") {
      for (const junction of JUNCTIONS) {
        const light = new Graphics(),
          p = project({ x: junction.x + 0.65, y: junction.y + 0.65 });
        light.position.set(p.x, p.y);
        light.zIndex = p.y + 0.3;
        objects.addChild(light);
        trafficSignals.push(light);
      }
      for (let cy = 0; cy < 64; cy += 32)
        for (let cx = 0; cx < 64; cx += 32) {
          const t = groundTexture(cx, cy);
          groundTextures.push(t);
          const s = new Sprite(t);
          const p = project({ x: cx, y: cy });
          s.position.set(p.x - 780, p.y - 8);
          ground.addChild(s);
        }
      for (const b of BUILDINGS) {
        const s = sprite(b.id, { x: b.x, y: b.y });
        s.zIndex = project({ x: b.x + b.w, y: b.y + b.h }).y - 2;
        buildings.set(b.id, s);
        const d = new Graphics();
        const p = project(b.door);
        d.ellipse(0, 0, 14, 7)
          .fill({ color: 0xbde2cb, alpha: 0.25 })
          .stroke({ color: 0xe7ce8e, width: 1.5 });
        d.position.set(p.x, p.y);
        d.zIndex = p.y + 0.5;
        objects.addChild(d);
        doors.set(b.id, d);
      }
      // Greens and furniture are placed beside the walkable pavement, never across portals.
      for (const p of [
        { x: 2.5, y: 10 },
        { x: 2.7, y: 25 },
        { x: 2.8, y: 43 },
        { x: 21, y: 4 },
        { x: 40.7, y: 6 },
        { x: 45.8, y: 7 },
        { x: 61.5, y: 8 },
        { x: 21, y: 27 },
        { x: 40.7, y: 26 },
        { x: 45.8, y: 28 },
        { x: 61.5, y: 25 },
        { x: 21, y: 44 },
        { x: 40.8, y: 43 },
        { x: 2.6, y: 50 },
      ])
        decor.push(sprite("tree", p, 1.15));
      for (const p of [
        { x: 15.1, y: 9 },
        { x: 21.6, y: 9 },
        { x: 40.1, y: 9 },
        { x: 46.2, y: 9 },
        { x: 15.1, y: 27 },
        { x: 21.6, y: 27 },
        { x: 40.1, y: 27 },
        { x: 46.2, y: 27 },
        { x: 15.1, y: 45 },
        { x: 21.6, y: 45 },
        { x: 40.1, y: 45 },
        { x: 46.2, y: 45 },
      ]) {
        const lamp = sprite("lamp", p, 0.65);
        decor.push(lamp);
        const glow = new Graphics()
          .ellipse(0, 0, 22, 9)
          .fill({ color: 0xf3bc68, alpha: 0.12 })
          .circle(13, -77, 13)
          .fill({ color: 0xffd18a, alpha: 0.12 })
          .circle(13, -77, 6)
          .fill({ color: 0xffe0a5, alpha: 0.24 });
        glow.position.set(lamp.x, lamp.y);
        glow.zIndex = lamp.zIndex + 0.1;
        glow.alpha = 0;
        objects.addChild(glow);
        lampGlows.push(glow);
      }
      for (let x = 4; x < 63; x += 7) {
        decor.push(sprite("lamp", { x, y: 55.5 }, 0.85));
        if (x % 2 === 0) decor.push(sprite("bench", { x: x + 2, y: 55.5 }, 0.7));
      }
      for (const b of BUILDINGS) {
        decor.push(sprite("planter", { x: b.door.x - 1.5, y: b.door.y + 0.1 }, 0.65));
        if (b.kind === "cafe" || b.kind === "restaurant")
          decor.push(sprite("bench", { x: b.door.x + 1.7, y: b.door.y + 0.2 }, 0.6));
      }
      // One restrained overhead cable run per block, behind actors and outside portals.
      for (const [a, b] of [
        [
          { x: 15.1, y: 9 },
          { x: 15.1, y: 27 },
        ],
        [
          { x: 40.1, y: 9 },
          { x: 40.1, y: 27 },
        ],
        [
          { x: 15.1, y: 27 },
          { x: 15.1, y: 45 },
        ],
        [
          { x: 40.1, y: 27 },
          { x: 40.1, y: 45 },
        ],
      ] as [Point, Point][]) {
        const pa = project(a),
          pb = project(b),
          line = new Graphics();
        line
          .moveTo(pa.x, pa.y - 72)
          .quadraticCurveTo((pa.x + pb.x) / 2, (pa.y + pb.y) / 2 - 58, pb.x, pb.y - 72)
          .stroke({ color: 0x263e3b, width: 1.2, alpha: 0.65 });
        line.zIndex = Math.min(pa.y, pb.y) - 2;
        objects.addChild(line);
        streetLines.push(line);
      }
      // A distant ferry is decorative; travel interactions remain part of simulation.
      const boat = new Graphics();
      boat
        .poly([-48, 0, 35, -13, 60, -4, 26, 14, -30, 19])
        .fill(0xd6d7bc)
        .stroke({ color: 0x263f41, width: 2 });
      boat.rect(-25, -17, 53, 22).fill(0xf3e8cc);
      boat.rect(-18, -13, 39, 8).fill(0x567b83);
      boat.rect(1, -29, 9, 14).fill(0xaa5c40);
      const bp = project({ x: 48, y: 61 });
      boat.position.set(bp.x, bp.y);
      ground.addChild(boat);
    } else {
      interior = interiorTexture(scene);
      const floor = new Sprite(interior);
      floor.position.set(-360, -160);
      ground.addChild(floor);
    }
    initialized = false;
  };
  const update = (projection: RenderProjection) => {
    if (destroyed) return;
    const time = performance.now();
    current = projection;
    if (scene !== projection.player.location.scene) resetScene(projection.player.location.scene);
    if (lastTick === projection.tick) return;
    lastTick = projection.tick;
    trafficSignals.forEach((light, index) => {
      const axis = signalAxis(projection.tick, JUNCTIONS[index]);
      light
        .clear()
        .rect(-1, -28, 2, 28)
        .fill(0x263f41)
        .roundRect(-9, -40, 18, 15, 3)
        .fill(0x162c31);
      light.circle(-4, -33, 3).fill(axis === "horizontal" ? 0x72d49a : 0xe78365);
      light.circle(4, -33, 3).fill(axis === "vertical" ? 0x72d49a : 0xe78365);
    });
    const cadence = new Map<string, number>([[projection.player.id, 100]]);
    let detailed = 0;
    for (const person of projection.npcs) {
      if (!person.alive || person.goal === "drive") continue;
      if (person.id === "n0" && projection.minute < 490) {
        cadence.set(person.id, 100);
        continue;
      }
      const near =
        person.location.scene === projection.player.location.scene &&
        Math.hypot(
          person.location.x - projection.player.location.x,
          person.location.y - projection.player.location.y,
        ) < 16 &&
        detailed < 25;
      if (near) detailed++;
      cadence.set(person.id, near ? 100 : 1000);
    }
    const transition = (view: ActorView, target: Point, duration: number, orientPerson = true) => {
      const dx = target.x - view.to.x,
        dy = target.y - view.to.y;
      if (!retargetMotion(view, target, duration, time)) return;
      view.moving = Math.hypot(target.x - view.from.x, target.y - view.from.y) > 0.001;
      if (!orientPerson) return;
      if (Math.abs(dx) > Math.abs(dy)) view.direction = dx >= 0 ? 0 : 2;
      else view.direction = dy >= 0 ? 1 : 3;
    };
    const visiblePeople = projection.npcs.filter((p) => p.location.scene === scene);
    if ((projection.visualAgentLimit ?? 100) < 100)
      visiblePeople.sort(
        (a, b) =>
          Math.hypot(
            a.location.x - projection.player.location.x,
            a.location.y - projection.player.location.y,
          ) -
          Math.hypot(
            b.location.x - projection.player.location.x,
            b.location.y - projection.player.location.y,
          ),
      );
    const people = [
      projection.player,
      ...visiblePeople.slice(0, projection.visualAgentLimit ?? 100),
    ];
    if (scene === "outside" && projection.mobility && !stopMarkers.length) {
      for (const stop of projection.mobility.stops) {
        const marker = new Container(),
          p = project(stop.point);
        const sign = new Graphics()
          .roundRect(-2, -47, 4, 47, 2)
          .fill(0xc9c1a8)
          .roundRect(-14, -58, 28, 20, 4)
          .fill(0x194b50)
          .stroke({ color: 0xf0d6a1, width: 1.5 });
        const label = new Text({
          text: "D",
          style: { fontFamily: "Arial", fontSize: 14, fontWeight: "bold", fill: 0xf4e8cc },
        });
        label.anchor.set(0.5, 0.5);
        label.y = -48;
        marker.addChild(sign, label);
        marker.position.set(p.x, p.y);
        marker.zIndex = p.y;
        objects.addChild(marker);
        stopMarkers.push(marker);
      }
    }
    const keep = new Set<string>();
    for (const person of people) {
      if (
        person.location.scene !== scene ||
        !person.alive ||
        (person.id !== projection.player.id && person.goal === "drive")
      )
        continue;
      keep.add(person.id);
      let view = actors.get(person.id);
      const target = { x: person.location.x, y: person.location.y };
      if (!view) {
        const s = sprite(`person-${person.appearance % 8}-0-0`, target, 0.76);
        const label = new Text({
          text: person.id === projection.player.id ? person.name : "",
          style: {
            fontFamily: "Arial",
            fontSize: 12,
            fill: 0xf5e8c4,
            fontWeight: "600",
            stroke: { color: 0x253a32, width: 3 },
          },
        });
        label.anchor.set(0.5, 1);
        objects.addChild(label);
        view = {
          sprite: s,
          label,
          from: target,
          to: target,
          direction: 0,
          moving: false,
          updatedAt: time,
          duration: cadence.get(person.id) ?? 1000,
        };
        actors.set(person.id, view);
      }
      transition(view, target, cadence.get(person.id) ?? 1000);
      view.person = person;
      const important =
        person.id !== projection.player.id &&
        projection.quests.some(
          (q) =>
            (q.status === "active" || q.status === "offered") &&
            (q.targetId === person.id || q.issuerId === person.id),
        ) &&
        Math.hypot(
          person.location.x - projection.player.location.x,
          person.location.y - projection.player.location.y,
        ) < 12;
      view.label.text =
        person.id === projection.player.id ? person.name : important ? `◆ ${person.name}` : "";
      view.sprite.visible =
        person.id !== projection.player.id ||
        (!projection.player.vehicleId && !projection.mobility?.trip);
      view.label.visible =
        (person.id === projection.player.id || important) && !projection.mobility?.trip;
    }
    for (const vehicle of projection.vehicles) {
      if (vehicle.location.scene !== scene) continue;
      keep.add(vehicle.id);
      const direction = vehicleFrame(vehicle.heading);
      const variant = vehicleVariant(vehicle.id);
      const frameName = `${variant}-${direction}`;
      let view = actors.get(vehicle.id);
      const target = { x: vehicle.location.x, y: vehicle.location.y };
      if (!view) {
        const s = sprite(frameName, target, 1);
        const fadeSprite = sprite(frameName, target, 1);
        fadeSprite.visible = false;
        const label = new Text({ text: "", style: { fontSize: 10 } });
        label.visible = false;
        objects.addChild(label);
        view = {
          sprite: s,
          label,
          from: target,
          to: target,
          direction,
          moving: false,
          updatedAt: time,
          duration: 100,
          fadeSprite,
          vehicleFrameName: frameName,
        };
        actors.set(vehicle.id, view);
      }
      transition(view, target, 100, false);
      view.vehicle = vehicle;
    }
    for (const [id, v] of actors)
      if (!keep.has(id)) {
        v.sprite.destroy();
        v.fadeSprite?.destroy();
        v.label.destroy();
        actors.delete(id);
      }
  };
  const playerRing = new Graphics();
  playerRing
    .ellipse(0, 0, 15, 7)
    .stroke({ color: 0x92e6c5, width: 2.2 })
    .ellipse(0, 0, 19, 9)
    .stroke({ color: 0x92e6c5, width: 0.7, alpha: 0.4 });
  objects.addChild(playerRing);
  playerRing.zIndex = 100000;
  const playerMarker = new Graphics();
  playerMarker
    .poly([0, -64, 5, -70, 0, -76, -5, -70])
    .fill(0xe9bd70)
    .stroke({ color: 0x193b39, width: 1.5 });
  playerMarker.zIndex = 100003;
  objects.addChild(playerMarker);
  // An occlusion-only ghost preserves player readability without moving the real actor.
  const playerGhost = new Sprite(Texture.EMPTY);
  playerGhost.anchor.set(0.5, 84 / 96);
  playerGhost.tint = 0xf4d89a;
  playerGhost.alpha = 0.78;
  playerGhost.zIndex = 100002;
  playerGhost.visible = false;
  objects.addChild(playerGhost);
  const pointer = (event: PointerEvent) => {
    if (!current) return;
    const rect = app.canvas.getBoundingClientRect();
    const p = unproject({
      x: (event.clientX - rect.left - world.x) / zoom,
      y: (event.clientY - rect.top - world.y) / zoom,
    });
    onDestination(p);
  };
  app.canvas.addEventListener("pointerdown", pointer);
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    zoom = clamp(zoom - event.deltaY * 0.0006, 0.75, 1.75);
  };
  app.canvas.addEventListener("wheel", wheel, { passive: false });
  const contextLost = (event: Event) => {
    event.preventDefault();
    app.ticker.stop();
    host.dispatchEvent(
      new CustomEvent("social-engine-render-error", { detail: "WEBGL_CONTEXT_LOST" }),
    );
  };
  const contextRestored = () => {
    app.ticker.start();
    host.dispatchEvent(
      new CustomEvent("social-engine-render-restored", { detail: "WEBGL_CONTEXT_RESTORED" }),
    );
  };
  app.canvas.addEventListener("webglcontextlost", contextLost);
  app.canvas.addEventListener("webglcontextrestored", contextRestored);
  const draw = () => {
    if (!current || destroyed) return;
    const started = performance.now(),
      delta = started - lastFrame;
    lastFrame = started;
    if (delta < 1000) frameSamples.push(delta);
    if (frameSamples.length > 18000) frameSamples.shift();
    frameCount++;
    const player = actors.get(current.player.id);
    let focus = project(current.player.location);
    for (const [id, v] of actors) {
      const pos = sampleMotion(v, started),
        moving = pos.moving,
        p = project(pos);
      if (v.vehicle) {
        // Heading follows the displacement actually presented since the previous draw.
        // The newest physics tangent can lead the interpolated position at a turn.
        const previousRotation = v.sprite.rotation;
        const dx = p.x - v.sprite.x,
          dy = p.y - v.sprite.y;
        if (Math.hypot(dx, dy) > 0.01) {
          const worldDelta = unproject({ x: dx, y: dy });
          v.direction = vehicleFrame(Math.atan2(worldDelta.y, worldDelta.x));
          // Residual screen-space angle follows the visible interpolated displacement.
          // The simulation's heading and position are never changed by this treatment.
          const axis = project({
            x: Math.cos((v.direction * Math.PI) / 4),
            y: Math.sin((v.direction * Math.PI) / 4),
          });
          const angle = Math.atan2(dy, dx) - Math.atan2(axis.y, axis.x);
          const residual = Math.atan2(Math.sin(angle), Math.cos(angle));
          // Combined atlas-axis plus residual is exactly the presented movement direction.
          // Smoothing the residual itself causes a jump whenever the base frame changes.
          v.sprite.rotation = residual;
        } else if (v.vehicle.speed <= 0) {
          v.direction = vehicleFrame(v.vehicle.heading);
          v.sprite.rotation *= Math.exp(-Math.min(delta, 100) / 120);
        }
        const variant = vehicleVariant(id);
        const nextFrame = `${variant}-${v.direction}`;
        if (v.fadeSprite && v.vehicleFrameName && nextFrame !== v.vehicleFrameName) {
          v.fadeSprite.texture = v.sprite.texture;
          v.fadeSprite.rotation = previousRotation;
          v.fadeStartedAt = started;
        }
        v.vehicleFrameName = nextFrame;
        v.sprite.texture = paintedVehicle(nextFrame, v.vehicle.color);
        const blend =
          v.fadeStartedAt === undefined ? 1 : clamp((started - v.fadeStartedAt) / 120, 0, 1);
        v.sprite.alpha = blend;
        if (v.fadeSprite) {
          v.fadeSprite.visible = blend < 1;
          v.fadeSprite.alpha = 1 - blend;
          v.fadeSprite.position.set(p.x, p.y);
          v.fadeSprite.zIndex = p.y - 0.01;
        }
      }
      v.sprite.position.set(p.x, p.y);
      v.sprite.zIndex = p.y;
      v.label.position.set(p.x, p.y - 56);
      v.label.zIndex = id === current.player.id ? 100004 : p.y + 0.1;
      if (v.person) {
        const phase = started + animationOffset(id);
        const apparentSpeed =
          (Math.hypot(v.to.x - v.from.x, v.to.y - v.from.y) * 1000) / Math.max(1, v.duration);
        const running = moving && apparentSpeed > 2.4;
        const frame = moving ? Math.floor(phase / (running ? 85 : 135)) % 4 : 0;
        const playerAction =
          id === current.player.id
            ? current.player.attackUntil > current.tick
              ? "punch"
              : current.player.blocking
                ? "block"
                : null
            : null;
        const textureName = playerAction
          ? `person-${playerAction}-${v.person.appearance % 8}-${v.direction}`
          : `person-${running ? "run-" : ""}${v.person.appearance % 8}-${v.direction}-${frame}`;
        v.sprite.texture = textures.get(textureName)!;
        // Independent idle breathing is presentation only, with a fixed foot anchor.
        const breath = moving ? 1 : 1 + Math.sin(phase / 620) * 0.014;
        v.sprite.scale.set(0.76, 0.76 * breath);
        if (id === current.player.id) focus = p;
        v.sprite.tint = v.person.health <= 20 ? 0xe9a292 : 0xffffff;
      }
    }
    let obscured = false;
    if (player && player.sprite.visible) {
      for (const [id, other] of actors) {
        if (id === current.player.id || !other.sprite.visible) continue;
        if (
          other.sprite.y >= player.sprite.y - 5 &&
          Math.abs(other.sprite.x - player.sprite.x) < 24 &&
          Math.abs(other.sprite.y - player.sprite.y) < 18
        ) {
          obscured = true;
          break;
        }
      }
      playerGhost.texture = player.sprite.texture;
      playerGhost.position.copyFrom(player.sprite.position);
      playerGhost.scale.copyFrom(player.sprite.scale);
    }
    playerGhost.visible =
      obscured && !!player && !current.player.vehicleId && !current.mobility?.trip;
    if (!initialized) {
      camera = { ...focus };
      initialized = true;
    } else {
      const factor = 1 - Math.exp(-Math.min(delta, 100) / 100);
      camera.x += (focus.x - camera.x) * factor;
      camera.y += (focus.y - camera.y) * factor;
    }
    const translation = cameraTranslation(camera, app.screen, zoom, scene);
    world.position.set(translation.x, translation.y);
    world.scale.set(zoom);
    visibleActors = 0;
    for (const v of actors.values()) {
      const sx = v.sprite.x * zoom + world.x,
        sy = v.sprite.y * zoom + world.y;
      v.sprite.renderable =
        sx > -160 && sx < app.screen.width + 160 && sy > -120 && sy < app.screen.height + 120;
      if (v.sprite.renderable) visibleActors++;
      v.label.renderable = v.sprite.renderable;
      if (v.fadeSprite) v.fadeSprite.renderable = v.sprite.renderable;
    }
    playerRing.position.set(focus.x, focus.y);
    playerRing.visible = !!player && !current.player.vehicleId;
    playerMarker.position.set(focus.x, focus.y);
    playerMarker.visible = !!player && !current.player.vehicleId && !current.mobility?.trip;
    for (const b of BUILDINGS) {
      const s = buildings.get(b.id);
      if (!s) continue;
      const f = project({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
      const blocks =
        current.player.location.x <= b.x + b.w &&
        current.player.location.y <= b.y + b.h &&
        focus.x > f.x - (b.w + b.h) * 12 &&
        focus.x < f.x + (b.w + b.h) * 12 &&
        focus.y < s.y + (b.w + b.h) * 12 &&
        focus.y > s.y - b.height * 24;
      const targetAlpha = blocks ? 0.35 : 1;
      s.alpha += (targetAlpha - s.alpha) * 0.12;
      const d = doors.get(b.id)!;
      const distance = Math.hypot(
        current.player.location.x - b.door.x,
        current.player.location.y - b.door.y,
      );
      d.alpha = distance < 2 ? 1 : 0.45;
    }
    const hour = (current.minute % 1440) / 60;
    const darkness =
      hour < 5
        ? 0.42
        : hour < 7
          ? (0.42 * (7 - hour)) / 2
          : hour > 20
            ? 0.3
            : hour > 17
              ? (hour - 17) * 0.1
              : 0;
    for (const glow of lampGlows) glow.alpha = Math.min(1, darkness * 4);
    overlay
      .clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({
        color: 0x12243d,
        alpha:
          scene === "outside"
            ? Math.min(
                0.5,
                darkness +
                  (current.mobility?.weather.kind === "rain"
                    ? 0.12
                    : current.mobility?.weather.kind === "cloudy"
                      ? 0.06
                      : 0),
              )
            : 0.04,
      });
    // Warm light at dawn and dusk layers over the cool ambient shade without bloom.
    if (scene === "outside") {
      const dusk = hour >= 17 && hour < 20 ? Math.sin(((hour - 17) / 3) * Math.PI) : 0;
      const dawn = hour >= 5 && hour < 8 ? Math.sin(((hour - 5) / 3) * Math.PI) : 0;
      const warmth = Math.max(dusk, dawn) * 0.11;
      if (warmth > 0.001)
        overlay
          .rect(0, 0, app.screen.width, app.screen.height)
          .fill({ color: 0xe4a366, alpha: warmth });
    }
    if (
      scene === "outside" &&
      !document.body.classList.contains("reduce-motion") &&
      current.mobility?.weather.kind === "rain"
    ) {
      for (let i = 0; i < 45; i++) {
        const x = (i * 97 + frameCount * 2) % app.screen.width,
          y = (i * 163 + frameCount * 8) % app.screen.height;
        overlay.moveTo(x, y).lineTo(x - 4, y + 13);
      }
      overlay.stroke({ color: 0xc8e6e6, width: 1, alpha: 0.24 });
    }
    drawSamples.push(performance.now() - started);
    if (drawSamples.length > 18000) drawSamples.shift();
  };
  app.ticker.add(draw);
  const resize = () => {
    app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const quantile = (arr: number[], q: number) => {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  };
  return {
    render: update,
    resize,
    setZoom: (delta) => {
      zoom = clamp(zoom + delta, 0.75, 1.75);
    },
    metrics: () => ({
      renderer: "PixiJS 8.21.0 WebGL",
      frameCount,
      frameMs: {
        p50: quantile(frameSamples, 0.5),
        p95: quantile(frameSamples, 0.95),
        p99: quantile(frameSamples, 0.99),
      },
      renderPreparationMs: {
        p50: quantile(drawSamples, 0.5),
        p95: quantile(drawSamples, 0.95),
        p99: quantile(drawSamples, 0.99),
      },
      samples: frameSamples.length,
      visibleActors,
      sceneChanges,
      zoom,
      cameraTransform: { x: world.x, y: world.y, zoom },
      currentScene: scene,
      worldBounds:
        scene === "outside"
          ? { minX: 1, maxX: 63, minY: 1, maxY: 57 }
          : { minX: 1, maxX: 13, minY: 1, maxY: 11 },
      dpr: app.renderer.resolution,
      viewport: { width: app.screen.width, height: app.screen.height },
    }),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      for (const t of optionalTextures) t.destroy(true);
      for (const t of paintedVehicles.values()) t.destroy(true);
      observer.disconnect();
      app.canvas.removeEventListener("pointerdown", pointer);
      app.canvas.removeEventListener("wheel", wheel);
      app.canvas.removeEventListener("webglcontextlost", contextLost);
      app.canvas.removeEventListener("webglcontextrestored", contextRestored);
      app.ticker.remove(draw);
      for (const texture of groundTextures) texture.destroy(true);
      interior?.destroy(true);
      for (const texture of textures.values()) texture.destroy(false);
      // Frame textures share these two owned sources. Disposing frames alone leaves
      // Texture.from(image) entries in Pixi's resource cache across recovery/restart.
      buildingBase.destroy(true);
      actorBase.destroy(true);
      app.destroy(true, { children: true, texture: false, textureSource: false });
    },
  };
}
