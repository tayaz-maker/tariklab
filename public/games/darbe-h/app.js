import { startApp } from "../duel-core/app.js";
import { designs } from "./designs.js";
import { cardFace } from "./card-face.js";
// The card faces are DARBE-H!'s own; load their stylesheet before first paint.
await new Promise((resolve) => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./card-face.css", import.meta.url).href;
  link.onload = link.onerror = resolve;
  document.head.append(link);
});
await startApp("darbe-h", designs, { cardFace });
document.querySelector("#app").removeAttribute("aria-busy");
