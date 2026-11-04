// Measured optional Mac hardware path for the standalone windowless shell.
// Never select a graphical application or change a default for CI/non-Mac hosts.
export function windowlessRendererOptions() {
  if (process.env.SE_WINDOWLESS_GPU !== "metal") return {};
  if (
    process.platform !== "darwin" ||
    !process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.endsWith("/chrome-headless-shell")
  )
    throw new Error("The Metal QA path requires the standalone Mac headless shell.");
  return {
    ignoreDefaultArgs: ["--use-angle=swiftshader-webgl"],
    args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu"],
  };
}

// Inspect the actual game canvas instead of inferring the driver from launch flags.
export async function verifySoftwareRenderer(page) {
  const renderer = await page.evaluate(() => {
    for (const canvas of document.querySelectorAll("canvas")) {
      if (canvas.width < 300) continue;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      if (ext) return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    }
    return null;
  });
  if (!/swiftshader|llvmpipe|software rasterizer/i.test(renderer ?? ""))
    throw new Error("Software rasterizer not verified: " + renderer);
  return renderer;
}
