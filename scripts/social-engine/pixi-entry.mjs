// Selective adapter for the exact locked PixiJS 8.21.0 package.
// Native DOM handles input/accessibility; PNG atlases use browser image decoding.
// Renderer backends and Pixi's actual sprite/graphics/text implementations stay intact.
// Register only static image/canvas/buffer sources used by this PNG-only game.
// Keep the upstream rendering and mask implementations byte-for-byte unchanged.
import { extensions } from "../../node_modules/pixi.js/lib/extensions/Extensions.mjs";
import { AlphaMask } from "../../node_modules/pixi.js/lib/rendering/mask/alpha/AlphaMask.mjs";
import { ColorMask } from "../../node_modules/pixi.js/lib/rendering/mask/color/ColorMask.mjs";
import { StencilMask } from "../../node_modules/pixi.js/lib/rendering/mask/stencil/StencilMask.mjs";
import { BufferImageSource } from "../../node_modules/pixi.js/lib/rendering/renderers/shared/texture/sources/BufferImageSource.mjs";
import { CanvasSource } from "../../node_modules/pixi.js/lib/rendering/renderers/shared/texture/sources/CanvasSource.mjs";
import { ImageSource } from "../../node_modules/pixi.js/lib/rendering/renderers/shared/texture/sources/ImageSource.mjs";
import "../../node_modules/pixi.js/lib/rendering/renderers/shared/texture/utils/textureFrom.mjs";
import "../../node_modules/pixi.js/lib/rendering/mask/MaskEffectManager.mjs";
extensions.add(AlphaMask, ColorMask, StencilMask, ImageSource, CanvasSource, BufferImageSource);
export { Application } from "../../node_modules/pixi.js/lib/app/Application.mjs";
export { Container } from "../../node_modules/pixi.js/lib/scene/container/Container.mjs";
export { Graphics } from "../../node_modules/pixi.js/lib/scene/graphics/shared/Graphics.mjs";
export { Rectangle } from "../../node_modules/pixi.js/lib/maths/shapes/Rectangle.mjs";
export { Sprite } from "../../node_modules/pixi.js/lib/scene/sprite/Sprite.mjs";
export { Text } from "../../node_modules/pixi.js/lib/scene/text/Text.mjs";
export { Texture } from "../../node_modules/pixi.js/lib/rendering/renderers/shared/texture/Texture.mjs";
