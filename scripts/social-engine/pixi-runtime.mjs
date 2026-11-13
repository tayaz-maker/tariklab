// The game builds textures from decoded atlases and draws ordinary Pixi
// containers. It never uses renderer extraction, masks, or custom renderables.
// Limit the registrations in this game's bundle, including its fallback backends.
const omitted = {
  "rendering/renderers/shared/system/SharedSystems.mjs": [
    "GenerateTextureSystem",
    "ExtractSystem",
    "AlphaMaskPipe",
    "StencilMaskPipe",
    "ColorMaskPipe",
    "CustomRenderPipe",
  ],
  "rendering/renderers/canvas/CanvasRenderer.mjs": [
    "AlphaMaskPipe",
    "CanvasStencilMaskPipe",
    "CanvasColorMaskPipe",
    "CustomRenderPipe",
  ],
  "rendering/renderers/gl/WebGLRenderer.mjs": ["GlStencilSystem", "GlColorMaskSystem"],
  "rendering/renderers/gpu/WebGPURenderer.mjs": ["GpuStencilSystem", "GpuColorMaskSystem"],
};

export function pixiRuntime() {
  return {
    name: "social-engine-pixi-runtime",
    transform(code, id) {
      const module = id.split("/pixi.js/lib/").at(-1);
      if (module === "scene/container/RenderGroupSystem.mjs") {
        const reset = "    renderPipes.colorMask.buildStart();\n";
        if (!code.includes(reset)) throw new Error("Review Pixi color-mask initialization");
        return code.replace(reset, "");
      }
      const names = omitted[module];
      if (!names) return;
      for (const name of names) {
        const imported = new RegExp(`^import \\{ ${name} \\} from '[^']+';\\n`, "m");
        const registered = new RegExp(`^  ${name},?$`, "m");
        if (!imported.test(code) || !registered.test(code))
          throw new Error(`Review SOCIAL ENGINE's Pixi registration: ${name}`);
        code = code.replace(imported, "").replace(registered, "");
      }
      return code;
    },
  };
}
