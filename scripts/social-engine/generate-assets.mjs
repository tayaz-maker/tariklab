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
    // Six architectural families share projection and atlas cells, not a common facade.
    // Their footprints stay inside the authoritative collision rectangles.
    let shelfX = 0,
      shelfY = 0;
    buildings.forEach((b, index) => {
      // Variable-width shelf packing preserves the exact world projection for wide buildings.
      const cellWidth = Math.ceil((b.w + b.h) * 24 + 56);
      if (shelfX + cellWidth > canv.width) {
        shelfX = 0;
        shelfY += 512;
      }
      const fx = shelfX,
        fy = shelfY;
      shelfX += cellWidth;
      if (fy + 512 > canv.height) throw new Error("Building atlas capacity exceeded");
      const ox = b.h * 24 + 22,
        oy = b.height * 24 + 28;
      frames[b.id] = { x: fx, y: fy, w: cellWidth, h: 512, pivot: { x: ox, y: oy } };
      c.save();
      c.beginPath();
      c.rect(fx + 1, fy + 1, cellWidth - 2, 510);
      c.clip();
      c.translate(fx + ox, fy + oy);
      const p = (x, y, z = 0) => [(x - y) * 24, (x + y) * 12 - z * 24];
      const face = (pts, fill, stroke = "#263e3b55") =>
        poly(
          pts.map((v) => p(...v)),
          fill,
          stroke,
        );
      const slab = (x, y, w, h, z0, z1, col) => {
        face(
          [
            [x + w, y, z0],
            [x + w, y + h, z0],
            [x + w, y + h, z1],
            [x + w, y, z1],
          ],
          shade(col, 0.67),
        );
        face(
          [
            [x, y + h, z0],
            [x + w, y + h, z0],
            [x + w, y + h, z1],
            [x, y + h, z1],
          ],
          shade(col, 0.88),
        );
        face(
          [
            [x, y, z1],
            [x + w, y, z1],
            [x + w, y + h, z1],
            [x, y + h, z1],
          ],
          shade(col, 1.04),
        );
      };
      const front = (x0, x1, z0, z1, color, y = b.h + 0.015) =>
        face(
          [
            [x0, y, z0],
            [x1, y, z0],
            [x1, y, z1],
            [x0, y, z1],
          ],
          color,
        );
      const side = (y0, y1, z0, z1, color, x = b.w + 0.015) =>
        face(
          [
            [x, y0, z0],
            [x, y1, z0],
            [x, y1, z1],
            [x, y0, z1],
          ],
          color,
        );
      const line = (a, d, color = "#263e3bcc", width = 1) => {
        c.beginPath();
        c.moveTo(...p(...a));
        c.lineTo(...p(...d));
        c.strokeStyle = color;
        c.lineWidth = width;
        c.stroke();
      };
      const pane = (x, z, w = 1.1, h = 1.6, style = "glass", y = b.h + 0.015) => {
        front(x - 0.08, x + w + 0.08, z - 0.08, z + h + 0.08, "#d8c8a5", y);
        front(x, x + w, z, z + h, style === "warm" ? "#7c7160" : "#304f54", y);
        front(
          x + 0.07,
          x + w - 0.07,
          z + h * 0.53,
          z + h - 0.08,
          style === "warm" ? "#d9aa75" : "#719095",
          y,
        );
        front(x + w * 0.48, x + w * 0.53, z, z + h, "#d4c9ac", y);
        front(x, x + w, z + h * 0.48, z + h * 0.52, "#d4c9ac", y);
      };
      const sidePane = (y, z, w = 1.1, h = 1.5) => {
        side(y - 0.08, y + w + 0.08, z - 0.08, z + h + 0.08, "#d8c8a5");
        side(y, y + w, z, z + h, "#35565a");
        side(y + 0.08, y + w - 0.08, z + h * 0.54, z + h - 0.08, "#789397");
        side(y + w * 0.48, y + w * 0.53, z, z + h, "#c9c6ae");
      };
      const balcony = (x, z, w = 2) => {
        face(
          [
            [x, b.h, z],
            [x + w, b.h, z],
            [x + w, b.h + 0.55, z],
            [x, b.h + 0.55, z],
          ],
          "#d7ccae",
        );
        face(
          [
            [x, b.h + 0.55, z],
            [x + w, b.h + 0.55, z],
            [x + w, b.h + 0.55, z + 0.55],
            [x, b.h + 0.55, z + 0.55],
          ],
          "#51636199",
        );
        for (let u = 0.15; u < w; u += 0.36)
          line([x + u, b.h + 0.56, z], [x + u, b.h + 0.56, z + 0.55], "#253b39", 1.2);
        line([x, b.h + 0.56, z + 0.55], [x + w, b.h + 0.56, z + 0.55], "#253b39", 2);
      };
      const sign = (text, z, color = "#273d3b") => {
        const q = p(b.w / 2, b.h + 0.07, z);
        c.save();
        c.translate(...q);
        c.rotate(Math.atan(0.5));
        const sw = Math.min(205, b.w * 27);
        c.fillStyle = color;
        c.fillRect(-sw / 2, -10, sw, 20);
        c.strokeStyle = "#d6b77e";
        c.lineWidth = 1;
        c.strokeRect(-sw / 2, -10, sw, 20);
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = "#f5ead0";
        c.font = `700 ${Math.min(13, sw / (text.length * 0.64))}px Arial`;
        c.fillText(text, 0, 0);
        c.restore();
      };
      const door = (x = b.w / 2, w = 1.3) => {
        front(x - w / 2 - 0.13, x + w / 2 + 0.13, 0.08, 2.8, "#d0c1a3");
        front(x - w / 2, x + w / 2, 0.12, 2.65, "#334844");
        front(x - w / 2 + 0.12, x + w / 2 - 0.12, 1.05, 2.48, "#597a79");
        const h = p(x + w * 0.3, b.h + 0.04, 1.05);
        c.fillStyle = "#ead6a2";
        c.fillRect(h[0] - 1, h[1] - 2, 3, 4);
      };
      const roofFlat = (color = "#777d75") => {
        face(
          [
            [0, 0, b.height],
            [b.w, 0, b.height],
            [b.w, b.h, b.height],
            [0, b.h, b.height],
          ],
          color,
        );
        face(
          [
            [0, b.h, b.height],
            [b.w, b.h, b.height],
            [b.w, b.h, b.height + 0.25],
            [0, b.h, b.height + 0.25],
          ],
          "#d0c2a7",
        );
        face(
          [
            [b.w, 0, b.height],
            [b.w, b.h, b.height],
            [b.w, b.h, b.height + 0.25],
            [b.w, 0, b.height + 0.25],
          ],
          "#a49f8e",
        );
        slab(b.w * 0.22, b.h * 0.28, 1.1, 1.1, b.height, b.height + 0.43, 0xaaa99a);
        line(
          [b.w * 0.22, b.h * 0.35, b.height + 0.45],
          [b.w * 0.85, b.h * 0.35, b.height + 0.45],
          "#53615c",
          2,
        );
      };
      const roofGable = (base, rise = 1.1, col = "#a4523d") => {
        const mid = b.h * 0.48;
        face(
          [
            [-0.12, -0.12, base],
            [b.w + 0.12, -0.12, base],
            [b.w + 0.12, mid, base + rise],
            [-0.12, mid, base + rise],
          ],
          shade(col, 1.08),
        );
        face(
          [
            [-0.12, mid, base + rise],
            [b.w + 0.12, mid, base + rise],
            [b.w + 0.12, b.h + 0.12, base],
            [-0.12, b.h + 0.12, base],
          ],
          col,
        );
        face(
          [
            [b.w + 0.12, -0.12, base],
            [b.w + 0.12, mid, base + rise],
            [b.w + 0.12, b.h + 0.12, base],
          ],
          shade(col, 0.8),
        );
        for (let y = mid + 0.55; y < b.h; y += 0.8) {
          const z = base + rise * (1 - (y - mid) / (b.h - mid));
          line([0, y, z], [b.w, y, z], "#dca17b88", 0.7);
        }
        line([-0.12, mid, base + rise], [b.w + 0.12, mid, base + rise], "#d49a78", 2);
      };
      const storefront = (zTop = 2.75) => {
        for (let x = 0.35; x < b.w - 0.8; x += 1.55) {
          front(x, x + 1.25, 0.28, zTop, "#254c4a");
          front(x + 0.12, x + 1.13, 0.35, 0.9, "#b39369");
          front(x + 0.12, x + 1.13, 1.05, 1.16, "#c9b287");
          for (let u = 0.2; u < 1.05; u += 0.25)
            front(x + u, x + u + 0.1, 1.16, 1.5, index % 2 ? "#b9c4a0" : "#e3b67e");
          line([x + 0.2, b.h + 0.04, 1.75], [x + 0.8, b.h + 0.04, 2.6], "#b5d2c799", 1.5);
        }
        door();
      };
      const canopy = (col) => {
        face(
          [
            [0.05, b.h, 3.02],
            [b.w - 0.05, b.h, 3.02],
            [b.w - 0.05, b.h + 0.65, 2.72],
            [0.05, b.h + 0.65, 2.72],
          ],
          col,
        );
        line([0.05, b.h + 0.65, 2.72], [b.w - 0.05, b.h + 0.65, 2.72], "#e0cfaa", 3);
      };
      const family =
        b.kind === "home"
          ? "apartment"
          : b.kind === "restaurant" || b.kind === "security"
            ? "house"
            : ["market", "sales", "cafe", "office"].includes(b.kind)
              ? "commercial"
              : ["garage", "taxi"].includes(b.kind)
                ? "workshop"
                : b.kind === "warehouse"
                  ? "warehouse"
                  : "civic";
      // Large directional shadows and a dark contact band tie the artwork to the ground.
      face(
        [
          [0.2, 0.2, 0],
          [b.w + 0.35, 0.2, 0],
          [b.w + 0.35, b.h + 0.35, 0],
          [0.2, b.h + 0.35, 0],
        ],
        "#1c373044",
        null,
      );
      slab(0, 0, b.w, b.h, 0, 0.25, 0x9d9888);
      if (family === "apartment") {
        slab(0, 0, b.w, b.h, 0.25, b.height, 0xc8b499);
        for (let z = 2.65; z < b.height - 1.1; z += 2.25) {
          front(0, b.w, z - 0.15, z + 0.08, "#e1d2b5");
          for (let x = 0.35; x < b.w - 1; x += 1.65)
            pane(x, z, 0.95, 1.55, index % 2 ? "warm" : "glass");
          balcony(0.28, z - 0.05, Math.min(b.w - 0.56, 3.4));
        }
        door();
        roofFlat("#777b72");
        sign(b.sign, 2.38, "#4b5b50");
      } else if (family === "house") {
        slab(0, 0, b.w, b.h, 0.25, b.height - 0.45, 0xb77e69);
        front(0, b.w, 0.25, 0.55, "#756d60");
        for (let x = 0.35; x < b.w - 1; x += 1.6) pane(x, 1.25, 1, 1.65, "warm");
        for (let y = 0.8; y < b.h - 1; y += 2.2) sidePane(y, 1.25, 1, 1.55);
        door();
        roofGable(b.height - 0.45, 1.15, "#a44f3b");
        canopy("#675145");
        sign(b.sign, 3.3, "#6a4435");
      } else if (family === "commercial") {
        const upperY = b.kind === "office" ? b.h : b.h - 0.55;
        slab(0, 0, b.w, b.h, 0.25, 3.15, index % 2 ? 0xb4937b : 0xc9ae85);
        slab(0, 0, b.w, upperY, 3.15, b.height, index % 2 ? 0xb4937b : 0xc9ae85);
        storefront();
        for (let z = 3.5; z < b.height - 1; z += 2.25) {
          front(0, b.w, z - 0.25, z - 0.09, "#ddd0b0", upperY + 0.015);
          for (let x = 0.3; x < b.w - 1; x += 1.65) pane(x, z, 1.15, 1.35, "glass", upperY + 0.015);
          if (b.height > 6) balcony(0.3, z - 0.2, Math.min(2.4, b.w - 0.6));
        }
        if (b.height <= 5) {
          canopy(index % 2 ? "#814c42" : "#537468");
        }
        if (b.kind === "cafe") roofGable(b.height, 0.65, "#9b5a45");
        else roofFlat(b.kind === "market" ? "#76796b" : "#696f6c");
        sign(b.sign, 3.05, "#354d49");
      } else if (family === "civic") {
        slab(0, 0, b.w, b.h, 0.25, b.height, 0xc5c9bd);
        front(0, b.w, 0.25, 1.0, "#a3aaa0");
        for (let z = 1.3; z < b.height - 1.3; z += 2.2)
          for (let x = 0.4; x < b.w - 1; x += 1.7) pane(x, z, 1.1, 1.5);
        for (let y = 0.8; y < b.h - 1.4; y += 2.2) sidePane(y, 1.35, 1.2, 1.8);
        const mid = b.w / 2;
        front(mid - 1, mid + 1, 0.25, 3.15, "#e2ddd0");
        door(mid, 1.25);
        front(0, b.w, b.height - 0.5, b.height - 0.18, "#ece4d0");
        roofFlat("#8a9088");
        sign(b.sign, 3.48, b.kind === "police" ? "#34556c" : "#416968");
      } else if (family === "workshop") {
        slab(0, 0, b.w, b.h, 0.25, b.height - 0.25, 0x8f9d95);
        for (let x = 0.4; x < b.w - 1.7; x += 3.2) {
          front(x, x + 2.4, 0.18, 2.8, "#536b68");
          for (let z = 0.45; z < 2.7; z += 0.32)
            line([x, b.h + 0.04, z], [x + 2.4, b.h + 0.04, z], "#aab4a0", 1.2);
        }
        door();
        face(
          [
            [0, 0, b.height - 0.25],
            [b.w, 0, b.height - 0.25],
            [b.w, b.h, b.height + 0.35],
            [0, b.h, b.height + 0.35],
          ],
          "#596e6c",
        );
        for (let x = 0.4; x < b.w; x += 0.7)
          line([x, 0, b.height - 0.24], [x, b.h, b.height + 0.36], "#9bad9d88", 1);
        sign(b.sign, 3.3, "#8c553c");
      } else {
        slab(0, 0, b.w, b.h, 0.25, b.height - 0.4, 0x9b8b79);
        for (let x = 0.3; x < b.w - 0.8; x += 1.25) {
          front(x, x + 0.06, 0.25, b.height - 0.5, "#6d6e65");
        }
        for (let x = 0.7; x < b.w - 2; x += 3.4) {
          front(x, x + 2.6, 0.15, 2.8, "#465f5b");
          for (let z = 0.4; z < 2.7; z += 0.4)
            line([x, b.h + 0.04, z], [x + 2.6, b.h + 0.04, z], "#8b9b8c", 1);
        }
        door();
        roofGable(b.height - 0.4, 0.85, "#687d78");
        sign(b.sign, 3.15, "#725747");
      }
      // Reusable local facade details, with positions chosen per building rather than random clutter.
      if (["apartment", "commercial", "civic"].includes(family)) {
        const y = b.h * 0.55,
          z = Math.min(b.height - 1.2, 3.7);
        side(y, y + 0.9, z, z + 0.65, "#d8d4c3");
        side(y + 0.1, y + 0.65, z + 0.1, z + 0.52, "#81918a");
        line([b.w + 0.04, y + 0.1, z + 0.32], [b.w + 0.04, y + 0.65, z + 0.32], "#d7d6c8", 1);
      }
      if (family === "house" || family === "apartment") {
        const y = b.h * 0.18;
        side(y, y + 0.9, 1.3, 2.9, "#728379");
        for (let z = 1.5; z < 2.9; z += 0.25)
          line([b.w + 0.04, y, z], [b.w + 0.04, y + 0.9, z], "#b4b69c", 1);
      }
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
    for (let running = 0; running < 2; running++)
      for (let appearance = 0; appearance < 8; appearance++)
        for (let direction = 0; direction < 4; direction++)
          for (let frame = 0; frame < 4; frame++) {
            const index = appearance * 16 + direction * 4 + frame,
              fx = (index % 16) * 64,
              fy = (running ? 1280 : 0) + Math.floor(index / 16) * 96;
            actorFrames[`person-${running ? "run-" : ""}${appearance}-${direction}-${frame}`] = {
              x: fx,
              y: fy,
              w: 64,
              h: 96,
              pivot: { x: 32, y: 84 },
            };
            c.save();
            c.translate(fx + 32, fy + 84);
            if (running) c.transform(1, 0, -0.12, 1, -3, 0);
            const stride = (frame === 1 ? 1 : frame === 3 ? -1 : 0) * (running ? 10 : 5),
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
            const coatWidth = appearance % 3 === 0 ? 12 : 10;
            const coatLength = appearance % 4 === 0 ? 32 : 28;
            c.roundRect(-coatWidth, -49, coatWidth * 2, coatLength, appearance % 2 ? 6 : 3);
            c.fill();
            c.fillStyle = "#ffffff25";
            c.fillRect(-7, -46, 3, 20);
            if (appearance % 3 === 1) {
              c.fillStyle = "#253b3f";
              c.fillRect(-2, -48, 4, 25);
            }
            if (appearance % 4 === 2) {
              c.fillStyle = "#e6d7b6";
              c.fillRect(-7, -39, 14, 2);
            }
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
            c.fillStyle = [
              "#544435",
              "#302d28",
              "#644736",
              "#292e31",
              "#806044",
              "#3b2d29",
              "#242d2d",
              "#685348",
            ][appearance];
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
            if (appearance === 2 || appearance === 6) {
              c.fillStyle = appearance === 2 ? "#d8b173" : "#536862";
              c.beginPath();
              c.ellipse(0, -65, 9, 4, 0, Math.PI, Math.PI * 2);
              c.fill();
              c.fillRect(-9, -65, 18, 2);
            }
            if (appearance === 4 && !back) {
              c.fillStyle = "#d6c2a1";
              c.fillRect(-9, -49, 18, 3);
            }
            if (appearance === 5) {
              c.strokeStyle = "#e3b878";
              c.lineWidth = 2;
              c.beginPath();
              c.moveTo(-8, -47);
              c.lineTo(8, -26);
              c.stroke();
            }
            c.restore();
          }
    // Eight world-space headings; a second set carries a roof cargo box.
    // Magenta body pixels are a renderer-only mask for the persisted paint color.
    for (let variant = 0; variant < 4; variant++)
      for (let direction = 0; direction < 8; direction++) {
        const fx = variant < 2 ? direction * 160 : 1280 + (direction % 4) * 160,
          fy =
            variant < 2
              ? variant
                ? 1152
                : 800
              : 800 + (variant - 2) * 256 + Math.floor(direction / 4) * 128;
        actorFrames[`${["car", "cargo", "van", "hatch"][variant]}-${direction}`] = {
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
          const length = variant === 2 ? 1.08 : variant === 3 ? 0.82 : 1;
          const height = variant === 2 ? 1.24 : variant === 3 ? 1.08 : 1;
          x *= length;
          z *= height;
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
        if (variant === 1) {
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
        if (variant === 2) {
          q(
            [
              [-0.95, -0.68, 1.55],
              [0.5, -0.68, 1.55],
              [0.5, 0.68, 1.55],
              [-0.95, 0.68, 1.55],
            ],
            "#cf00cf",
          );
        }
        if (variant === 3) {
          const stripe = p(-0.15, -0.81, 0.66);
          c.fillStyle = "#d8cdb5";
          c.fillRect(stripe[0] - 5, stripe[1] - 1, 10, 2);
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
