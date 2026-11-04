import { Application, Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";
const percentile = (v: number[], q: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) * q)];
};
export async function benchmarkRenderer() {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = "/games/social-engine/assets/people-props.png";
  });
  const samples = 600,
    w = 1280,
    h = 720,
    count = 100;
  const result: Record<string, unknown> = {
    scenario: "100 identical atlas sprites; 1280x720 DPR1;600 animation frames each renderer",
    measurement:
      "main-thread submission CPU and requestAnimationFrame intervals; GPU completion time is not measured",
    environment: {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      dpr: devicePixelRatio,
      viewport: { width: w, height: h },
    },
  };
  const position = (i: number, frame: number) => ({
    x: 40 + (i % 10) * 120 + Math.sin(frame / 50 + i) * 15,
    y: 80 + Math.floor(i / 10) * 63 + Math.cos(frame / 40 + i) * 5,
  });
  for (const mode of ["canvas2d", "pixi-webgl"]) {
    const cpu: number[] = [],
      frames: number[] = [];
    let last = performance.now();
    let app: Application | undefined;
    let canvas: HTMLCanvasElement;
    let context: CanvasRenderingContext2D | null = null;
    const sprites: Sprite[] = [];
    const initStart = performance.now();
    if (mode === "pixi-webgl") {
      app = new Application();
      await app.init({
        width: w,
        height: h,
        resolution: 1,
        autoStart: false,
        antialias: true,
        background: 0x273f43,
        preference: "webgl",
      });
      canvas = app.canvas;
      const base = await Assets.load<Texture>("/games/social-engine/assets/people-props.png");
      const texture = new Texture({ source: base.source, frame: new Rectangle(0, 0, 64, 96) });
      const stage = new Container();
      for (let i = 0; i < count; i++) {
        const s = new Sprite(texture);
        s.anchor.set(0.5, 1);
        s.scale.set(0.65);
        stage.addChild(s);
        sprites.push(s);
      }
      app.stage.addChild(stage);
    } else {
      canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      context = canvas.getContext("2d");
    }
    document.body.appendChild(canvas);
    const initMs = performance.now() - initStart;
    for (let frame = 0; frame < samples; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const now = performance.now();
      if (frame > 30) frames.push(now - last);
      last = now;
      const start = performance.now();
      if (context) {
        context.fillStyle = "#273f43";
        context.fillRect(0, 0, w, h);
        for (let i = 0; i < count; i++) {
          const p = position(i, frame);
          context.drawImage(image, 0, 0, 64, 96, p.x - 20.8, p.y - 62.4, 41.6, 62.4);
        }
      } else {
        for (let i = 0; i < count; i++) {
          const p = position(i, frame);
          sprites[i].position.set(p.x, p.y);
        }
        app!.render();
      }
      if (frame > 30) cpu.push(performance.now() - start);
    }
    result[mode] = {
      initMs,
      count,
      samples: cpu.length,
      cpuMs: { p50: percentile(cpu, 0.5), p95: percentile(cpu, 0.95), p99: percentile(cpu, 0.99) },
      frameMs: {
        p50: percentile(frames, 0.5),
        p95: percentile(frames, 0.95),
        p99: percentile(frames, 0.99),
      },
    };
    if (app) app.destroy(true, { children: true, texture: false, textureSource: false });
    else canvas.remove();
  }
  result.decision =
    "PixiJS selected for batching, atlas ownership, depth sorting, and existing compatible dependency; this short equal-sprite PoC does not prove full-game performance acceptance.";
  return result;
}
