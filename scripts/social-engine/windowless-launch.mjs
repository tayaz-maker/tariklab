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
