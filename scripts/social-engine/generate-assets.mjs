import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {
  BUILDINGS,
  ROADS,
  SPAWN,
  isWalkable,
  isRoad,
  ROAD_CENTERS,
} from "../../src/games/social-engine/domain/world.ts";
const output = path.resolve("public/games/social-engine/assets");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.SE_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage();
const generated = await page.evaluate(
  ({ buildings }) => {
    const canv = document.createElement("canvas");
    canv.width = 2048;
    canv.height = 2048;
    const c = canv.getContext("2d");
    const frames = {};
    const shade = (hex, k) => {
      const n = typeof hex === "number" ? hex : parseInt(hex.replace("#", ""), 16);
      return `rgb(${Math.min(255, Math.round((n >> 16) * k))},${Math.min(255, Math.round(((n >> 8) & 255) * k))},${Math.min(255, Math.round((n & 255) * k))})`;
    };
    const poly = (pts, fill, stroke = "#2e3a3430", width = 1) => {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };
    buildings.forEach((b, index) => {
      const fx = (index % 4) * 512,
        fy = Math.floor(index / 4) * 512;
      const ox = b.h * 24 + 12,
        oy = b.height * 24 + 28;
      frames[b.id] = { x: fx, y: fy, w: 512, h: 512, pivot: { x: ox, y: oy } };
      c.save();
      c.translate(fx + ox, fy + oy);
      const p = (x, y, z = 0) => [(x - y) * 24, (x + y) * 12 - z * 24];
      const box = (x, y, w, h, z, color) => {
        poly([p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h)], shade(color, 0.76));
        poly([p(x + w, y), p(x + w, y + h), p(x + w, y + h, z), p(x + w, y, z)], shade(color, 0.7));
        poly(
          [p(x, y + h), p(x + w, y + h), p(x + w, y + h, z), p(x, y + h, z)],
          shade(color, 0.95),
        );
        poly([p(x, y, z), p(x + w, y, z), p(x + w, y + h, z), p(x, y + h, z)], shade(color, 1.06));
      };
      // Ground-contact shadow and masonry plinth.
      poly(
        [p(0.2, 0.1), p(b.w + 0.8, 0.1), p(b.w + 0.8, b.h + 1.1), p(0.2, b.h + 1.1)],
        "#152c2730",
        null,
      );
      box(0, 0, b.w, b.h, 0.3, 0xaaa28b);
      box(0, 0, b.w, b.h, b.height, b.color);
      for (let z = 0.45; z < b.height; z += 0.85) {
        poly(
          [p(0, b.h, z), p(b.w, b.h, z), p(b.w, b.h, z + 0.035), p(0, b.h, z + 0.035)],
          "#ffffff10",
          null,
        );
        poly(
          [p(b.w, 0, z), p(b.w, b.h, z), p(b.w, b.h, z + 0.035), p(b.w, 0, z + 0.035)],
          "#0000000d",
          null,
        );
      }
      // Window bays with recessed trim, reflections, mullions, shutters and balcony rails.
      const window = (x, y, z, side = false) => {
        const q = (u, v) => (side ? p(b.w, y + u, z + v) : p(x + u, b.h, z + v));
        poly([q(-0.12, -0.1), q(1.3, -0.1), q(1.3, 1.8), q(-0.12, 1.8)], "#f5dfb0");
        poly([q(0, 0), q(1.16, 0), q(1.16, 1.65), q(0, 1.65)], "#273d45");
        poly([q(0.08, 0.82), q(1.08, 0.82), q(1.08, 1.58), q(0.08, 1.58)], "#67848b");
        poly([q(0.1, 0.05), q(0.53, 0.05), q(0.53, 0.72), q(0.1, 0.72)], "#bc9465");
        poly([q(0.58, 0), q(0.64, 0), q(0.64, 1.65), q(0.58, 1.65)], "#ece1be");
        poly([q(0, 0.77), q(1.16, 0.77), q(1.16, 0.84), q(0, 0.84)], "#ece1be");
        if (!side && z > 3) {
          const a = q(-0.2, -0.12),
            d = q(1.4, -0.12);
          c.strokeStyle = "#31433b";
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(a[0], a[1]);
          c.lineTo(d[0], d[1]);
          c.stroke();
          for (let u = 0; u < 1.4; u += 0.22) {
            const v = q(u, -0.1),
              w = q(u, 0.36);
            c.beginPath();
            c.moveTo(...v);
            c.lineTo(...w);
            c.stroke();
          }
        }
      };
      for (let z = 3.1; z < b.height - 1; z += 2.6) {
        for (let x = 0.65; x < b.w - 1.3; x += 2.05) window(x, b.h, z);
        for (let y = 0.7; y < b.h - 1.4; y += 2.4) window(b.w, y, z, true);
      }
      // Storefront glass, brass door handles and stone thresholds.
      for (let x = 0.5; x < b.w - 1.2; x += 1.7) {
        poly(
          [p(x, b.h, 0.45), p(x + 1.25, b.h, 0.45), p(x + 1.25, b.h, 2.7), p(x, b.h, 2.7)],
          "#284b49",
        );
        poly(
          [
            p(x + 0.08, b.h, 0.55),
            p(x + 0.4, b.h, 0.55),
            p(x + 1.1, b.h, 2.55),
            p(x + 0.8, b.h, 2.55),
          ],
          "#a6c1b330",
        );
      }
      const dx = b.w / 2;
      poly(
        [
          p(dx - 0.65, b.h, 0.2),
          p(dx + 0.65, b.h, 0.2),
          p(dx + 0.65, b.h, 2.7),
          p(dx - 0.65, b.h, 2.7),
        ],
        "#233c38",
      );
      poly(
        [
          p(dx - 0.55, b.h, 0.3),
          p(dx + 0.5, b.h, 0.3),
          p(dx + 0.5, b.h, 2.6),
          p(dx - 0.55, b.h, 2.6),
        ],
        "#665544",
      );
      const hand = p(dx + 0.35, b.h, 1.2);
      c.fillStyle = "#edce83";
      c.fillRect(hand[0] - 1, hand[1] - 3, 2, 6);
      // Awnings cast a coherent shadow and add recognizable local shop identity.
      const awning = ["market", "cafe", "restaurant", "sales"].includes(b.kind);
      if (awning) {
        const aw = b.kind === "market" ? "#657f47" : b.kind === "sales" ? "#356960" : "#933e35";
        for (let x = 0.1; x < b.w - 0.1; x += 0.55) {
          poly(
            [
              p(x, b.h, 3),
              p(Math.min(b.w, x + 0.55), b.h, 3),
              p(Math.min(b.w, x + 0.55), b.h + 0.9, 2.65),
              p(x, b.h + 0.9, 2.65),
            ],
            Math.round(x / 0.55) % 2 ? "#ecd6ac" : aw,
          );
        }
      }
      // Roof: textured clay tile courses, ridge caps and chimney.
      const roofRise = [0.55, 1.1, 1.4, 1.8][index % 4];
      const roofColors = [
        ["#ba6143", "#a64f38"],
        ["#95705a", "#795849"],
        ["#8b6658", "#704c42"],
        ["#b47e58", "#936247"],
      ][index % 4];
      const ridge = b.height + roofRise;
      poly(
        [
          p(-0.25, -0.2, b.height),
          p(b.w + 0.25, -0.2, b.height),
          p(b.w + 0.25, b.h / 2, ridge),
          p(-0.25, b.h / 2, ridge),
        ],
        roofColors[0],
      );
      poly(
        [
          p(-0.25, b.h / 2, ridge),
          p(b.w + 0.25, b.h / 2, ridge),
          p(b.w + 0.25, b.h + 0.25, b.height),
          p(-0.25, b.h + 0.25, b.height),
        ],
        roofColors[1],
      );
      for (let y = b.h / 2; y < b.h + 0.3; y += 0.37) {
        const z = ridge - ((y - b.h / 2) / (b.h / 2 + 0.25)) * roofRise;
        const a = p(-0.25, y, z),
          d = p(b.w + 0.25, y, z);
        c.strokeStyle = "#efad6b60";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(...a);
        c.lineTo(...d);
        c.stroke();
        for (let x = -0.1; x < b.w; x += 0.55) {
          const q = p(x, y, z);
          c.strokeStyle = "#74372370";
          c.beginPath();
          c.moveTo(...q);
          c.lineTo(q[0] - 5, q[1] + 3);
          c.stroke();
        }
      }
      const ridgeA = p(-0.3, b.h / 2, ridge + 0.05),
        ridgeB = p(b.w + 0.3, b.h / 2, ridge + 0.05);
      c.strokeStyle = "#dc8652";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(...ridgeA);
      c.lineTo(...ridgeB);
      c.stroke();
      const ch = p(b.w * 0.7, b.h * 0.3, b.height + 0.9);
      c.fillStyle = "#b6997e";
      c.fillRect(ch[0] - 6, ch[1] - 21, 12, 22);
      c.fillStyle = "#dcc3a0";
      c.fillRect(ch[0] - 8, ch[1] - 23, 16, 4);
      c.fillStyle = "#604536";
      c.fillRect(ch[0] - 5, ch[1] - 22, 10, 2);
      // The lettering is original and remains readable at normal zoom.
      const label = p(b.w / 2, b.h + 0.04, 3.4);
      c.save();
      c.translate(...label);
      c.rotate(Math.atan(0.5));
      c.fillStyle = ["clinic", "police", "bank"].includes(b.kind) ? "#34565a" : "#403e2c";
      const sw = Math.min(180, b.w * 27);
      c.fillRect(-sw / 2, -11, sw, 22);
      c.strokeStyle = "#d3b373";
      c.strokeRect(-sw / 2, -11, sw, 22);
      c.fillStyle = "#f3e2b8";
      c.font = `600 ${Math.min(13, sw / (b.sign.length * 0.65))}px Arial`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(b.sign, 0, 0);
      c.restore();
      c.restore();
    });
    const buildingsPng = canv.toDataURL("image/png");
    // Shared actor/prop atlas: all animation cells have identical feet pivots.
    c.clearRect(0, 0, 2048, 2048);
    const actorFrames = {};
    const palettes = [
      "#c5a26c",
      "#477a74",
      "#b65b45",
      "#426078",
      "#97714c",
      "#7a4d68",
      "#57744b",
      "#c29a38",
    ];
    for (let appearance = 0; appearance < 8; appearance++)
      for (let direction = 0; direction < 4; direction++)
        for (let frame = 0; frame < 4; frame++) {
          const index = appearance * 16 + direction * 4 + frame,
            fx = (index % 16) * 64,
            fy = Math.floor(index / 16) * 96;
          actorFrames[`person-${appearance}-${direction}-${frame}`] = {
            x: fx,
            y: fy,
            w: 64,
            h: 96,
            pivot: { x: 32, y: 84 },
          };
          c.save();
          c.translate(fx + 32, fy + 84);
          const stride = frame === 1 ? 5 : frame === 3 ? -5 : 0,
            side = direction % 2 === 1,
            back = direction >= 2;
          c.fillStyle = "#102c292e";
          c.beginPath();
          c.ellipse(0, -1, 12, 5, 0, 0, Math.PI * 2);
          c.fill();
          c.lineCap = "round";
          c.strokeStyle = "#283c43";
          c.lineWidth = 7;
          c.beginPath();
          c.moveTo(-4, -24);
          c.lineTo(-5 - stride, -6 - stride * 0.45);
          c.moveTo(4, -24);
          c.lineTo(5 - stride, -6 + stride * 0.45);
          c.stroke();
          c.strokeStyle = "#29312e";
          c.lineWidth = 5;
          c.beginPath();
          c.moveTo(-6 - stride, -3 - stride * 0.45);
          c.lineTo(-2 - stride, -3 - stride * 0.45);
          c.moveTo(3 - stride, -3 + stride * 0.45);
          c.lineTo(8 - stride, -3 + stride * 0.45);
          c.stroke();
          c.fillStyle = palettes[appearance];
          c.beginPath();
          c.roundRect(-10, -49, 20, 28, 5);
          c.fill();
          c.fillStyle = "#ffffff16";
          c.fillRect(-7, -46, 3, 20);
          c.strokeStyle = palettes[appearance];
          c.lineWidth = 6;
          c.beginPath();
          c.moveTo(-8, -44);
          c.lineTo(-12 + stride, -27);
          c.moveTo(8, -44);
          c.lineTo(12 - stride, -27);
          c.stroke();
          c.strokeStyle = "#d8a57d";
          c.lineWidth = 5;
          c.beginPath();
          c.moveTo(-12 + stride, -27);
          c.lineTo(-12 + stride, -24);
          c.moveTo(12 - stride, -27);
          c.lineTo(12 - stride, -24);
          c.stroke();
          c.fillStyle = "#d5a17b";
          c.beginPath();
          c.ellipse(side ? 2 : 0, -58, 8, 10, side ? -0.12 : 0, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = appearance % 3 === 0 ? "#524435" : "#302d28";
          c.beginPath();
          c.ellipse(0, -64, 8, 5, 0, Math.PI, Math.PI * 2);
          c.lineTo(8, -58);
          c.lineTo(5, -62);
          c.lineTo(-6, -60);
          c.fill();
          if (back) {
            c.beginPath();
            c.ellipse(0, -60, 7.5, 8, 0, 0, Math.PI * 2);
            c.fill();
          } else {
            c.fillStyle = "#3e362c";
            c.fillRect(side ? 5 : -3, -58, 1.5, 2);
            if (!side) c.fillRect(3, -58, 1.5, 2);
            c.strokeStyle = "#9f674d";
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(0, -52);
            c.lineTo(4, -52);
            c.stroke();
          }
          c.restore();
        }
    // Eight world-space headings; a second set carries a roof cargo box.
    // Magenta body pixels are a renderer-only mask for the persisted paint color.
    for (let variant = 0; variant < 2; variant++)
      for (let direction = 0; direction < 8; direction++) {
        const fx = direction * 160,
          fy = variant ? 1152 : 800;
        actorFrames[`${variant ? "cargo" : "car"}-${direction}`] = {
          x: fx,
          y: fy,
          w: 160,
          h: 128,
          pivot: { x: 80, y: 90 },
        };
        c.save();
        c.translate(fx + 80, fy + 90);
        // Rotate the long axis in world space, then project into isometric screen space.
        const angle = (direction * Math.PI) / 4,
          co = Math.cos(angle),
          si = Math.sin(angle);
        const p = (x, y, z = 0) => {
          const wx = x * co - y * si,
            wy = x * si + y * co;
          return [(wx - wy) * 19, (wx + wy) * 9 - z * 19];
        };
        const q = (pts, fill) =>
          poly(
            pts.map((v) => p(...v)),
            fill,
            "#2a373855",
          );
        q(
          [
            [-1.8, -0.8, 0],
            [1.8, -0.8, 0],
            [1.8, 0.8, 0],
            [-1.8, 0.8, 0],
          ],
          "#1f2c3040",
        );
        for (const x of [-1.15, 1.15])
          for (const y of [-0.75, 0.75]) {
            const pt = p(x, y, 0.2);
            c.fillStyle = "#24343a";
            c.beginPath();
            c.ellipse(pt[0], pt[1], 6, 9, -0.5, 0, Math.PI * 2);
            c.fill();
          }
        // Paint the two camera-facing sides for each world-space rotation.
        const frontX = co + si >= 0 ? 1.8 : -1.8;
        const frontY = co - si >= 0 ? 0.8 : -0.8;
        q(
          [
            [-1.8, frontY, 0.3],
            [1.8, frontY, 0.3],
            [1.8, frontY, 0.85],
            [-1.8, frontY, 0.85],
          ],
          "#b800b8",
        );
        q(
          [
            [frontX, -0.8, 0.3],
            [frontX, 0.8, 0.3],
            [frontX, 0.8, 0.85],
            [frontX, -0.8, 0.85],
          ],
          "#c500c5",
        );
        q(
          [
            [-1.8, -0.8, 0.85],
            [1.8, -0.8, 0.85],
            [1.8, 0.8, 0.85],
            [-1.8, 0.8, 0.85],
          ],
          "#f000f0",
        );
        q(
          [
            [-0.9, -0.7, 0.85],
            [0.7, -0.7, 0.85],
            [0.45, -0.6, 1.6],
            [-0.6, -0.6, 1.6],
          ],
          "#72929a",
        );
        q(
          [
            [-0.9, 0.7, 0.85],
            [0.7, 0.7, 0.85],
            [0.45, 0.6, 1.6],
            [-0.6, 0.6, 1.6],
          ],
          "#355762",
        );
        q(
          [
            [0.7, -0.7, 0.85],
            [0.7, 0.7, 0.85],
            [0.45, 0.6, 1.6],
            [0.45, -0.6, 1.6],
          ],
          "#81a1a6",
        );
        q(
          [
            [-0.6, -0.6, 1.6],
            [0.45, -0.6, 1.6],
            [0.45, 0.6, 1.6],
            [-0.6, 0.6, 1.6],
          ],
          "#df00df",
        );
        // Fixed-color lamps and plate remain independent of body paint.
        for (const y of [-0.55, 0.55]) {
          const lamp = p(1.82, y, 0.63);
          c.fillStyle = "#fff0b0";
          c.beginPath();
          c.arc(lamp[0], lamp[1], 2.5, 0, Math.PI * 2);
          c.fill();
        }
        const plate = p(1.83, 0, 0.42);
        c.fillStyle = "#f0eee0";
        c.fillRect(plate[0] - 3, plate[1] - 1, 6, 2);
        if (variant) {
          q(
            [
              [-0.52, -0.42, 1.62],
              [0.38, -0.42, 1.62],
              [0.38, 0.42, 1.62],
              [-0.52, 0.42, 1.62],
            ],
            "#263d43",
          );
          q(
            [
              [-0.48, -0.38, 1.9],
              [0.34, -0.38, 1.9],
              [0.34, 0.38, 1.9],
              [-0.48, 0.38, 1.9],
            ],
            "#8b765c",
          );
        }
        c.restore();
      }
    // Trees, benches, bollards and lamps share the atlas with actors.
    for (let kind = 0; kind < 4; kind++) {
      const fx = kind * 128,
        fy = 960;
      const name = ["tree", "bench", "lamp", "planter"][kind];
      actorFrames[name] = { x: fx, y: fy, w: 128, h: 192, pivot: { x: 64, y: 170 } };
      c.save();
      c.translate(fx + 64, fy + 170);
      c.fillStyle = "#15352b24";
      c.beginPath();
      c.ellipse(0, 0, 30, 12, 0, 0, Math.PI * 2);
      c.fill();
      if (kind === 0) {
        c.fillStyle = "#725c3b";
        c.fillRect(-4, -80, 8, 81);
        c.strokeStyle = "#725c3b";
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(0, -50);
        c.lineTo(-15, -90);
        c.moveTo(0, -65);
        c.lineTo(18, -98);
        c.stroke();
        for (let i = 0; i < 24; i++) {
          const a = i * 2.399,
            r = 12 + (i % 5) * 6,
            x = Math.cos(a) * r,
            y = -93 + Math.sin(a) * r * 0.8;
          c.fillStyle = ["#4b6c3e", "#65864b", "#7c9556", "#537642"][i % 4];
          c.beginPath();
          c.arc(x, y, 15 + (i % 3) * 3, 0, Math.PI * 2);
          c.fill();
        }
      } else if (kind === 1) {
        c.strokeStyle = "#344a42";
        c.lineWidth = 4;
        for (const x of [-23, 23]) {
          c.beginPath();
          c.moveTo(x, -4);
          c.lineTo(x, -31);
          c.stroke();
        }
        for (let i = 0; i < 4; i++) {
          c.fillStyle = i % 2 ? "#a67d4b" : "#bc945c";
          c.fillRect(-30, -33 + i * 5, 60, 4);
        }
        c.fillStyle = "#b18a50";
        c.fillRect(-30, -43, 60, 7);
      } else if (kind === 2) {
        c.strokeStyle = "#344840";
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, -105);
        c.quadraticCurveTo(0, -125, 18, -125);
        c.stroke();
        c.fillStyle = "#f5d795";
        c.beginPath();
        c.arc(20, -119, 7, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#344840";
        c.fillRect(12, -131, 17, 5);
        c.fillRect(-7, -4, 14, 5);
      } else {
        c.fillStyle = "#9a7756";
        c.fillRect(-24, -18, 48, 20);
        for (let i = 0; i < 9; i++) {
          c.fillStyle = ["#628047", "#bc735d", "#d6a261"][i % 3];
          c.beginPath();
          c.arc(-19 + i * 5, -22 - (i % 3) * 4, 7, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.restore();
    }
    return {
      buildingsPng,
      actorsPng: canv.toDataURL("image/png"),
      buildingFrames: frames,
      actorFrames,
    };
  },
  { buildings: BUILDINGS },
);
for (const [filename, data] of [
  ["buildings.png", generated.buildingsPng],
  ["people-props.png", generated.actorsPng],
])
  await fs.writeFile(path.join(output, filename), Buffer.from(data.split(",")[1], "base64"));
await fs.writeFile(
  path.join(output, "atlas.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      creator: "Original procedural artwork authored for SOCIAL ENGINE",
      license: "Project-owned original artwork; no third-party source images used",
      buildings: {
        image: "buildings.png",
        width: 2048,
        height: 2048,
        frames: generated.buildingFrames,
      },
      actors: {
        image: "people-props.png",
        width: 2048,
        height: 2048,
        frames: generated.actorFrames,
      },
    },
    null,
    2,
  ),
);
const chunks = [];
for (let cy = 0; cy < 64; cy += 32)
  for (let cx = 0; cx < 64; cx += 32) {
    const ground = [],
      collision = [];
    for (let y = cy; y < cy + 32; y++)
      for (let x = cx; x < cx + 32; x++) {
        const p = { x: x + 0.5, y: y + 0.5 };
        ground.push(
          y >= 57
            ? 3
            : isRoad(p)
              ? 1
              : ROAD_CENTERS.vertical.some((v) => Math.abs(p.x - v) <= 3.5) ||
                  ROAD_CENTERS.horizontal.some((v) => Math.abs(p.y - v) <= 3.5) ||
                  y >= 54
                ? 2
                : 0,
        );
        collision.push(isWalkable(p) ? 0 : 1);
      }
    chunks.push({ x: cx, y: cy, width: 32, height: 32, ground, collision });
  }
const nav = [];
for (let y = 0; y <= 128; y++) {
  let row = "";
  for (let x = 0; x <= 128; x++) row += isWalkable({ x: x / 2, y: y / 2 }) ? "1" : "0";
  nav.push(row);
}
await fs.writeFile(
  path.join(output, "kiyiyaka-map.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      name: "DARAMCIK",
      units: "metres",
      width: 64,
      height: 64,
      coastline: 57,
      spawn: SPAWN,
      groundLegend: { grass: 0, road: 1, pavement: 2, water: 3 },
      chunks,
      collisionPolygons: BUILDINGS.map((b) => ({
        id: b.id,
        points: [
          { x: b.x, y: b.y },
          { x: b.x + b.w, y: b.y },
          { x: b.x + b.w, y: b.y + b.h },
          { x: b.x, y: b.y + b.h },
        ],
      })),
      buildings: BUILDINGS,
      vehicleLanes: ROADS,
      pedestrianGrid: { resolution: 0.5, rows: nav, diagonalCornerCutting: false },
      portals: BUILDINGS.map((b) => ({
        id: b.id + "-portal",
        from: { ...b.door, scene: "outside" },
        to: { x: 7, y: 9, scene: b.id },
      })),
      interiors: BUILDINGS.map((b) => ({
        id: b.id,
        width: 14,
        height: 12,
        spawn: { x: 7, y: 9 },
        exit: { x: 7, y: 10 },
        outsideDoor: b.door,
        solidFurniture: [
          { x: 1, y: 1, w: 2.3, h: 3.8 },
          { x: 10, y: 1, w: 3, h: 3.8 },
        ],
      })),
    },
    null,
    2,
  ),
);
await browser.close();
console.log(
  JSON.stringify({
    generated: ["buildings.png", "people-props.png", "atlas.json", "kiyiyaka-map.json"],
    buildings: BUILDINGS.length,
    actorFrames: Object.keys(generated.actorFrames).length,
  }),
);
