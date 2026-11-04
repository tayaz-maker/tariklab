// Guard against artwork escaping or being clipped at a neighboring atlas cell.
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = "public/games/social-engine/assets/";
const atlas = JSON.parse(await readFile(root + "atlas.json", "utf8"));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  const page = await browser.newPage();
  for (const kind of ["buildings", "actors"]) {
    const bytes = await readFile(root + atlas[kind].image);
    const clipped = await page.evaluate(
      async ({ base64, frames }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const c = canvas.getContext("2d");
        c.drawImage(image, 0, 0);
        const pixels = c.getImageData(0, 0, canvas.width, canvas.height).data;
        const alpha = (x, y) => pixels[(y * canvas.width + x) * 4 + 3];
        return Object.entries(frames)
          .filter(([, f]) => {
            for (let x = f.x + 1; x < f.x + f.w - 1; x++)
              if (alpha(x, f.y + 1) || alpha(x, f.y + f.h - 2)) return true;
            for (let y = f.y + 1; y < f.y + f.h - 1; y++)
              if (alpha(f.x + 1, y) || alpha(f.x + f.w - 2, y)) return true;
            return false;
          })
          .map(([name]) => name);
      },
      { base64: bytes.toString("base64"), frames: atlas[kind].frames },
    );
    assert.deepEqual(clipped, [], `${kind}: artwork reaches the frame boundary`);
    console.log(`${kind}: ${Object.keys(atlas[kind].frames).length} frames clear`);
  }
} finally {
  await browser.close();
}
