// Original schematic adult anatomy geometry, authored for this foundation.
// Coarse spatial relationships only: not an anatomical measurement model and
// not independently expert-reviewed. No downloaded mesh/image or exact counts.
export const GEOMETRY_VERSION = "yapi-foundation-geometry-1";
export const STRUCTURE_IDS = Object.freeze([
  "skull", "spine", "thoracic-cage", "shoulder-girdle", "pelvis", "upper-limbs", "lower-limbs",
  "brain", "heart", "lungs", "liver", "stomach", "kidneys",
]);
export const GEOMETRY_REVIEW = Object.freeze({ status: "not-expert-reviewed", representation: "schematic-adult-projection" });

// x is the subject's right, not the viewer's right. Front and back projection
// share the organ positions; posterior surface and bone details are separate.
export function projectPoint(x, y, view = "front") {
  return { x: 210 + (view === "back" ? x : -x), y };
}

export function buildAtlasGeometry({ variant = "male", view = "front" } = {}) {
  if (!["female", "male"].includes(variant) || !["front", "back"].includes(view)) throw new TypeError("Unknown atlas projection");
  const female = variant === "female";
  const shoulder = female ? 65 : 74;
  const hip = female ? 55 : 50;
  const waist = female ? 42 : 44;
  const paths = [];
  const round = (n) => Math.round(n * 100) / 100;
  function path(commands) {
    return commands.map(([cmd, ...values]) => cmd + values.map((n, index) => round(index % 2 ? n : projectPoint(n, 0, view).x)).join(" ")).join(" ");
  }
  function add(key, layer, structureId, tone, commands, extras = {}) {
    paths.push({ key, layer, structureId, tone, d: path(commands), ...extras });
  }
  function ellipse(key, layer, id, tone, cx, cy, rx, ry, extras = {}) {
    const k = 0.552285;
    add(key, layer, id, tone, [["M", cx + rx, cy], ["C", cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry], ["C", cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy], ["C", cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry], ["C", cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy], ["Z"]], extras);
  }
  function contour(key, layer, id, tone, commands, width = 1, opacity = 1) {
    add(key, layer, id, tone, commands, { fill: "none", stroke: tone, strokeWidth: width, opacity });
  }
  function bone(key, id, x1, y1, x2, y2, width) {
    const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy), nx = dy / length, ny = -dx / length;
    const p = (fraction, offset) => [x1 + dx * fraction + nx * offset, y1 + dy * fraction + ny * offset];
    const a = p(0, width), b = p(.08, width * .64), c = p(.78, width * .35), d = p(.91, width * .86), e = p(1, width * .7);
    const f = p(1, -width * .7), g = p(.91, -width * .86), h = p(.78, -width * .35), i = p(.08, -width * .64), j = p(0, -width);
    add(key, "skeleton", id, "bone", [["M", ...a], ["C", ...b, ...c, ...d], ["Q", ...p(1.04, width), ...e], ["Q", ...p(1.06, 0), ...f], ["Q", ...p(1.04, -width), ...g], ["C", ...h, ...i, ...j], ["Q", ...p(-.07, -width * .8), ...p(-.035, 0)], ["Q", ...p(-.07, width * .8), ...a], ["Z"]]);
    contour(`${key}-ridge`, "skeleton", id, "bone-highlight", [["M", ...p(.12, width * .25)], ["Q", ...p(.5, width * .15), ...p(.88, width * .3)]], .8, .8);
  }

  // Adult surface outline, with separately sculpted five-digit hand surfaces.
  // There are no identifying facial or genital surface details.
  add("adult-surface", "surface", null, "skin", [
    ["M", 0, 25], ["C", 25, 25, 34, 43, 34, 68], ["C", 34, 88, 29, 110, 17, 120],
    ["L", 17, 139], ["C", 28, 147, shoulder - 8, 145, shoulder, 160],
    ["C", shoulder + 14, 181, 86, 216, 92, 249], ["C", 95, 265, 103, 274, 105, 288],
    ["C", 109, 315, 119, 354, 121, 379], ["L", 105, 382], ["C", 99, 362, 91, 323, 88, 296],
    ["C", 85, 285, 83, 277, 80, 264], ["L", 61, 205], ["C", 54, 229, 51, 256, 47, 284],
    ["C", 42, 308, waist, 328, waist, 345], ["C", waist, 366, hip + 9, 388, hip + 6, 423],
    ["C", hip + 4, 456, 47, 502, 42, 541], ["C", 40, 551, 40, 560, 41, 572],
    ["C", 46, 604, 34, 664, 29, 704], ["L", 30, 724], ["C", 35, 734, 43, 742, 42, 747],
    ["C", 37, 754, 20, 754, 15, 748], ["C", 11, 742, 17, 730, 17, 717],
    ["C", 16, 680, 14, 623, 16, 584], ["C", 16, 569, 18, 553, 17, 536],
    ["C", 13, 510, 9, 466, 5, 435], ["Q", 0, 430, -5, 435],
    ["C", -9, 466, -13, 510, -17, 536], ["C", -18, 553, -16, 569, -16, 584],
    ["C", -14, 623, -16, 680, -17, 717], ["C", -17, 730, -11, 742, -15, 748],
    ["C", -20, 754, -37, 754, -42, 747], ["C", -43, 742, -35, 734, -30, 724], ["L", -29, 704],
    ["C", -34, 664, -46, 604, -41, 572], ["C", -40, 560, -40, 551, -42, 541],
    ["C", -47, 502, -hip - 4, 456, -hip - 6, 423], ["C", -hip - 9, 388, -waist, 366, -waist, 345],
    ["C", -waist, 328, -42, 308, -47, 284], ["C", -51, 256, -54, 229, -61, 205],
    ["L", -80, 264], ["C", -83, 277, -85, 285, -88, 296], ["C", -91, 323, -99, 362, -105, 382],
    ["L", -121, 379],
    ["C", -119, 354, -109, 315, -105, 288], ["C", -103, 274, -95, 265, -92, 249],
    ["C", -86, 216, -shoulder - 14, 181, -shoulder, 160], ["C", -shoulder + 8, 145, -28, 147, -17, 139],
    ["L", -17, 120], ["C", -29, 110, -34, 88, -34, 68], ["C", -34, 43, -25, 25, 0, 25], ["Z"],
  ], { strokeWidth: .75 });
  for (const side of [-1, 1]) {
    const s = (x) => x * side;
    const hand = (x) => s(114 + (x - 114) * .78);
    add(`hand-surface-${side}`, "surface", null, "skin", [
      ["M", s(121), 377], ["C", hand(124), 387, hand(125), 390, hand(130), 395],
      ["L", hand(137), 403], ["Q", hand(140), 408, hand(135), 409], ["Q", hand(132), 409, hand(125), 402],
      ["L", hand(128), 417], ["L", hand(131), 435], ["Q", hand(132), 441, hand(127), 442], ["Q", hand(124), 442, hand(122), 437], ["L", hand(119), 420],
      ["L", hand(121), 443], ["Q", hand(121), 450, hand(116), 450], ["Q", hand(112), 449, hand(112), 444], ["L", hand(110), 422],
      ["L", hand(110), 440], ["Q", hand(110), 447, hand(105), 447], ["Q", hand(101), 446, hand(102), 440], ["L", hand(102), 418],
      ["L", hand(99), 432], ["Q", hand(97), 437, hand(93), 434], ["Q", hand(90), 432, hand(93), 425], ["L", hand(97), 409],
      ["C", hand(97), 400, hand(101), 390, s(105), 379], ["Z"],
    ]);
    add(`palm-depth-${side}`, "surface", null, "skin-shadow", [["M", hand(104), 393], ["Q", hand(120), 390, hand(124), 412], ["Q", hand(112), 421, hand(102), 411], ["Z"]], { opacity: .34 });
    add(`ear-surface-${side}`, "surface", null, "skin", [["M", s(32), 71], ["C", s(40), 67, s(40), 81, s(36), 91], ["Q", s(31), 100, s(30), 87], ["Z"]]);
  }
  add("head-lateral-depth", "surface", null, "skin-shadow", [["M", 22, 36], ["C", 42, 52, 33, 105, 15, 119], ["L", 16, 103], ["C", 29, 83, 26, 61, 22, 36], ["Z"]], { opacity: .64 });
  add("neck-contact-depth", "surface", null, "skin-shadow", [["M", -15, 112], ["Q", 0, 126, 15, 112], ["L", 15, 143], ["Q", 0, 151, -15, 143], ["Z"]], { opacity: .5 });
  // Deep, soft-sided surface planes make the body legible without portraits or
  // fabricated superficial structures. Posterior planes differ from anterior.
  for (const side of [-1, 1]) {
    const s = (x) => x * side;
    add(`shoulder-plane-${side}`, "surface", null, "skin-highlight", [["M", s(20), 145], ["C", s(37), 149, s(shoulder - 7), 147, s(shoulder + 4), 171], ["C", s(shoulder + 11), 191, s(72), 221, s(74), 237], ["C", s(61), 205, s(60), 175, s(40), 166], ["Q", s(23), 157, s(20), 145], ["Z"]], { opacity: .38 });
    add(`limb-plane-${side}`, "surface", null, "skin-highlight", [["M", s(86), 283], ["C", s(102), 292, s(107), 342, s(114), 382], ["Q", s(101), 354, s(95), 326], ["Z"]], { opacity: .35 });
    add(`thigh-plane-${side}`, "surface", null, "skin-highlight", [["M", s(hip - 5), 420], ["C", s(hip), 455, s(42), 506, s(34), 545], ["Q", s(26), 541, s(22), 528], ["C", s(22), 477, s(30), 448, s(hip - 5), 420], ["Z"]], { opacity: .26 });
    add(`calf-plane-${side}`, "surface", null, "skin-shadow", [["M", s(39), 579], ["C", s(43), 617, s(31), 666, s(25), 705], ["L", s(23), 630], ["Q", s(24), 596, s(39), 579], ["Z"]], { opacity: .30 });
    add(`upper-arm-depth-${side}`, "surface", null, "skin-shadow", [["M", s(67), 199], ["C", s(72), 222, s(85), 254, s(91), 281], ["L", s(83), 277], ["C", s(77), 251, s(64), 224, s(61), 211], ["Z"]], { opacity: .48 });
    add(`torso-side-depth-${side}`, "surface", null, "skin-shadow", [["M", s(53), 232], ["C", s(48), 276, s(waist + 3), 302, s(waist), 338], ["Q", s(waist), 362, s(hip - 1), 389], ["L", s(hip - 10), 394], ["C", s(29), 358, s(29), 297, s(43), 261], ["Z"]], { opacity: .45 });
    add(`shin-volume-${side}`, "surface", null, "skin-highlight", [["M", s(21), 580], ["C", s(34), 580, s(29), 654, s(22), 709], ["L", s(20), 697], ["C", s(20), 648, s(17), 603, s(21), 580], ["Z"]], { opacity: .46 });
    add(`knee-volume-${side}`, "surface", null, "skin-shadow", [["M", s(18), 549], ["Q", s(29), 544, s(39), 552], ["Q", s(45), 565, s(35), 578], ["Q", s(23), 584, s(18), 569], ["Z"]], { opacity: .22 });
    if (view === "front") {
      add(`chest-plane-${side}`, "surface", null, "skin-highlight", [["M", s(5), 179], ["C", s(20), 171, s(47), 178, s(55), 202], ["L", s(46), 254], ["C", s(26), 258, s(8), 247, s(5), 228], ["Z"]], { opacity: .26 });
      contour(`clavicle-surface-${side}`, "surface", null, "skin-shadow", [["M", s(4), 163], ["Q", s(25), 174, s(51), 160]], 1.3, .36);
      contour(`abdomen-plane-${side}`, "surface", null, "skin-shadow", [["M", s(38), 295], ["Q", s(28), 333, s(34), 370]], 1.1, .23);
    } else {
      add(`back-scapular-plane-${side}`, "surface", null, "skin-highlight", [["M", s(12), 173], ["Q", s(39), 169, s(56), 188], ["Q", s(46), 228, s(25), 246], ["Q", s(16), 208, s(12), 173], ["Z"]], { opacity: .33 });
      contour(`back-scapular-edge-${side}`, "surface", null, "skin-shadow", [["M", s(16), 180], ["Q", s(20), 220, s(26), 245], ["Q", s(48), 216, s(52), 195]], 1.2, .32);
    }
  }
  contour(view === "front" ? "sternal-plane" : "posterior-midline", "surface", null, "skin-shadow", view === "front" ? [["M", 0, 180], ["Q", 1, 232, 0, 270]] : [["M", 0, 139], ["C", 3, 220, -3, 308, 0, 387]], 1.3, .28);
  ellipse("head-plane", "surface", null, "skin-highlight", 6, 61, 20, 27, { opacity: .22 });

  // Skeleton: deliberately coarse named groups, not a complete bone inventory.
  add("cranium", "skeleton", "skull", "bone", [["M", 0, 36], ["C", 21, 34, 30, 47, 29, 66], ["Q", 29, 79, 24, 85], ["L", 26, 91], ["L", 21, 95], ["L", 19, 106], ["Q", 12, 114, 0, 114], ["Q", -12, 114, -19, 106], ["L", -21, 95], ["L", -26, 91], ["L", -24, 85], ["Q", -29, 79, -29, 66], ["C", -30, 47, -21, 34, 0, 36], ["Z"]]);
  if (view === "front") {
    for (const side of [-1, 1]) add(`orbit-${side}`, "skeleton", "skull", "bone-shadow", [["M", side * 5, 77], ["Q", side * 14, 72, side * 22, 79], ["Q", side * 21, 88, side * 12, 88], ["Q", side * 5, 86, side * 5, 77], ["Z"]], { opacity: .72 });
    add("nasal-opening", "skeleton", "skull", "bone-shadow", [["M", 0, 83], ["Q", 5, 88, 4, 95], ["Q", 0, 97, -4, 95], ["Q", -5, 88, 0, 83], ["Z"]], { opacity: .7 });
    add("maxillary-plane", "skeleton", "skull", "bone-highlight", [["M", -11, 93], ["L", 11, 93], ["L", 10, 100], ["Q", 0, 103, -10, 100], ["Z"]], { opacity: .72 });
    contour("jaw-plane", "skeleton", "skull", "bone-shadow", [["M", 17, 97], ["L", 15, 105], ["Q", 0, 112, -15, 105], ["L", -17, 97]], 1.2, .6);
  } else contour("occipital-plane", "skeleton", "skull", "bone-shadow", [["M", 19, 84], ["Q", 0, 102, -19, 84]], 1.5, .45);
  add("vertebral-column", "skeleton", "spine", "bone", [["M", 4, 116], ["C", 10, 185, 7, 250, 10, 320], ["L", 10, 386], ["Q", 0, 400, -10, 386], ["L", -10, 320], ["C", -7, 250, -10, 185, -4, 116], ["Z"]]);
  for (let y = 129; y <= 373; y += 14) contour(`vertebral-separation-${y}`, "skeleton", "spine", "bone-shadow", [["M", -6, y], ["Q", 0, y + 2, 6, y]], 1, .56);
  if (view === "back") contour("posterior-column-ridge", "skeleton", "spine", "bone-highlight", [["M", 0, 128], ["L", 0, 382]], 2, .7);
  for (const side of [-1, 1]) {
    const s = (x) => x * side;
    // Each curved band is an illustrative rib-cage trace, not a numbered rib.
    for (let index = 0; index < 8; index++) {
      const y = 190 + index * 12, w = 37 + Math.sin(index / 7 * Math.PI) * 12;
      contour(`rib-shadow-${side}-${index}`, "skeleton", "thoracic-cage", "bone-shadow", [["M", s(7), y], ["C", s(w), y - 10, s(w + 9), y + 11, s(13 + index * 2), y + 18]], 5, .7);
      contour(`rib-${side}-${index}`, "skeleton", "thoracic-cage", "bone", [["M", s(7), y - 1], ["C", s(w), y - 11, s(w + 9), y + 10, s(13 + index * 2), y + 17]], 3.2);
    }
    contour(`clavicle-${side}`, "skeleton", "shoulder-girdle", "bone", [["M", s(4), 174], ["C", s(19), 169, s(32), 177, s(43), 166], ["Q", s(55), 160, s(shoulder - 8), 169]], 5);
    add(`scapula-${side}`, "skeleton", "shoulder-girdle", "bone", [["M", s(14), 182], ["Q", s(43), 170, s(shoulder - 12), 182], ["Q", s(43), 219, s(28), 237], ["Q", s(21), 204, s(14), 182], ["Z"]], { opacity: view === "back" ? .85 : .28 });
    const humeralX = shoulder - 7;
    bone(`humerus-${side}`, "upper-limbs", s(humeralX), 181, s(87), 282, 6);
    bone(`radius-${side}`, "upper-limbs", s(92), 292, s(113), 384, 3.5);
    bone(`ulna-${side}`, "upper-limbs", s(85), 291, s(106), 384, 3.2);
    add(`hand-group-${side}`, "skeleton", "upper-limbs", "bone", [["M", s(106), 388], ["L", s(117), 388], ["Q", s(121), 399, s(117), 412], ["L", s(105), 410], ["Z"]], { opacity: .9 });
    // Five coarse rays, without fabricated per-phalange counts or joint detail.
    for (const [ray, endX, endY] of [[0, 131, 404], [1, 124, 437], [2, 116, 444], [3, 108, 441], [4, 100, 430]]) {
      contour(`hand-ray-${side}-${ray}`, "skeleton", "upper-limbs", "bone", [["M", s(111 + (endX - 113) * .35), 397], ["Q", s(endX), 412, s(endX), endY]], 2, .95);
    }
    // Broad iliac wings and an obturator opening suggest pelvic depth without
    // reproductive anatomy. Width varies; no universal sex measurement claimed.
    const wing = hip - 6;
    add(`ilium-${side}`, "skeleton", "pelvis", "bone", [["M", s(7), 382], ["C", s(20), 372, s(wing - 5), 372, s(wing), 383], ["Q", s(wing + 7), 403, s(35), 417], ["Q", s(25), 430, s(14), 438], ["L", s(4), 431], ["Q", s(19), 416, s(15), 407], ["Z"]]);
    ellipse(`pelvic-opening-${side}`, "skeleton", "pelvis", "bone-shadow", s(24), 418, 8, 10, { opacity: .66 });
    bone(`femur-${side}`, "lower-limbs", s(36), 432, s(29), 566, 8);
    add(`patella-${side}`, "skeleton", "lower-limbs", view === "front" ? "bone-highlight" : "bone-shadow", [["M", s(24), 570], ["Q", s(30), 565, s(35), 571], ["Q", s(39), 579, s(29), 589], ["Q", s(20), 580, s(24), 570], ["Z"]], { opacity: view === "front" ? 1 : .55 });
    bone(`tibia-${side}`, "lower-limbs", s(26), 592, s(22), 716, 6);
    bone(`fibula-${side}`, "lower-limbs", s(36), 594, s(29), 713, 2.6);
    add(`foot-group-${side}`, "skeleton", "lower-limbs", "bone", [["M", s(18), 720], ["Q", s(23), 716, s(29), 723], ["L", s(36), 738], ["Q", s(34), 746, s(22), 744], ["L", s(16), 738], ["Z"]]);
  }
  if (view === "front") add("sternum", "skeleton", "thoracic-cage", "bone-highlight", [["M", -5, 181], ["L", 5, 181], ["L", 5, 264], ["L", 0, 276], ["L", -5, 264], ["Z"]]);
  add("sacral-plane", "skeleton", "pelvis", "bone", [["M", -10, 381], ["L", 10, 381], ["Q", 10, 408, 0, 421], ["Q", -10, 408, -10, 381], ["Z"]]);

  // The six organ illustrations are intentionally coarse translucent
  // projections. No simulated vessels, innervation, lesions or physiology.
  add("brain-mass", "organs", "brain", "brain", [["M", 0, 43], ["C", 14, 38, 24, 46, 24, 61], ["C", 26, 72, 18, 79, 4, 80], ["L", -4, 80], ["C", -18, 79, -26, 72, -24, 61], ["C", -24, 46, -14, 38, 0, 43], ["Z"]]);
  contour("brain-midline", "organs", "brain", "bone-shadow", [["M", 0, 45], ["Q", 2, 61, 0, 75]], 1.2, .6);
  for (const side of [-1, 1]) {
    const s = (x) => x * side;
    for (let i = 0; i < 3; i++) contour(`brain-fold-${side}-${i}`, "organs", "brain", "bone-shadow", [["M", s(4), 49 + i * 8], ["C", s(8), 45 + i * 8, s(12), 56 + i * 8, s(21 - i * 2), 53 + i * 8]], .9, .35);
    // Left lung leaves medial space for the heart. Subject-right is +x.
    add(`lung-${side}`, "organs", "lungs", "lung", side === 1 ? [
      ["M", 14, 185], ["C", 29, 183, 43, 205, 48, 234], ["Q", 56, 263, 48, 281],
      ["Q", 31, 292, 12, 281], ["C", 9, 259, 12, 237, 10, 216], ["Q", 9, 197, 14, 185], ["Z"],
    ] : [
      ["M", -14, 185], ["C", -29, 183, -43, 205, -48, 234], ["Q", -56, 263, -48, 281],
      ["Q", -36, 289, -27, 284], ["C", -35, 266, -18, 255, -12, 242], ["Q", -9, 215, -14, 185], ["Z"],
    ], { opacity: .90 });
    contour(`lung-contour-${side}`, "organs", "lungs", "bone-highlight", [["M", s(22), 198], ["Q", s(36), 226, s(40), 266]], 1.1, .23);
    // Kidneys remain posterior and bilateral in the same body coordinate
    // system. Vertical difference is not asserted by this foundation drawing.
    add(`kidney-${side}`, "organs", "kidneys", "kidney", [["M", s(29), 326], ["C", s(42), 325, s(43), 345, s(36), 358], ["C", s(30), 368, s(20), 361, s(20), 353], ["Q", s(29), 348, s(22), 341], ["C", s(19), 335, s(23), 328, s(29), 326], ["Z"]], { opacity: view === "back" ? .97 : .50 });
  }
  add("heart-mass", "organs", "heart", "heart", [["M", -7, 225], ["C", 2, 216, 13, 220, 15, 231], ["Q", 17, 241, 11, 251], ["C", 4, 263, -8, 280, -22, 287], ["C", -29, 278, -33, 261, -28, 250], ["Q", -27, 237, -18, 232], ["Q", -12, 229, -10, 231], ["Z"]]);
  add("liver-mass", "organs", "liver", "liver", [["M", 49, 298], ["C", 34, 290, 10, 291, -12, 299], ["L", -33, 306], ["Q", -15, 319, 3, 321], ["C", 23, 343, 49, 333, 51, 320], ["Q", 55, 307, 49, 298], ["Z"]], { opacity: view === "back" ? .64 : .97 });
  contour("liver-plane", "organs", "liver", "bone-highlight", [["M", 43, 302], ["Q", 20, 296, -10, 305]], 1.3, .25);
  add("stomach-mass", "organs", "stomach", "stomach", [["M", -13, 299], ["L", -15, 315], ["C", -25, 313, -37, 316, -40, 331], ["C", -44, 350, -34, 370, -17, 366], ["Q", -5, 364, -3, 351], ["Q", -10, 359, -17, 351], ["C", -21, 345, -17, 337, -12, 329], ["L", -7, 302], ["Z"]], { opacity: view === "back" ? .65 : .97 });
  contour("stomach-plane", "organs", "stomach", "bone-highlight", [["M", -33, 326], ["C", -39, 346, -32, 362, -20, 360]], 1.1, .36);

  const anchors = {
    skull: [0, 75], spine: [0, 316], "thoracic-cage": [0, 230], "shoulder-girdle": [0, 173], pelvis: [0, 410],
    "upper-limbs": [91, 285], "lower-limbs": [29, 578], brain: [0, 66], heart: [-9, 254], lungs: [32, 242],
    liver: [28, 311], stomach: [-27, 343], kidneys: [29, 344],
  };
  const landmarks = Object.fromEntries(Object.entries(anchors).map(([id, [x, y]]) => [id, projectPoint(x, y, view)]));
  return { version: GEOMETRY_VERSION, variant, view, review: GEOMETRY_REVIEW, viewBox: [0, 0, 420, 780], paths, landmarks };
}
