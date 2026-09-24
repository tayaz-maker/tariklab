// Turns one VETO-H! or GETT-OH! card into one original, code-drawn picture.
// The picture is read from the card itself, never from an outside image:
//   setting  <- the card's series (ballot room, backstage corridor, tea house…)
//   subject  <- keywords in the card name (role for units, object for
//               spells and traps), falling back to the series' own object
//   emphasis <- level (spotlight and scale), kind (traps add a warning cue)
// A per-card seed only nudges placement, light and colour so no two cards
// match. Figures are featureless silhouettes: never portraits of anyone.
import * as D from "../darbe-h-card-art/motifs.mjs";
import * as M from "./motifs.mjs";

const { P, g, tr } = D;
const f = (n) => (Math.round(n * 10) / 10).toString();

export const PALETTES = {
  "veto-h": {
    ink: "#0d1411",
    surface: "#16241d",
    raised: "#22362b",
    cream: "#efe3c8",
    paper: "#ddd5c1",
    brass: "#caa15a",
    steel: "#6f9186",
    red: "#b4524a",
    wood: "#7a5934",
    muted: "#a8b3a8",
  },
  "gett-oh": {
    ink: "#120d0b",
    surface: "#211915",
    raised: "#33251e",
    cream: "#efdcbd",
    paper: "#dacbb2",
    brass: "#dc9a40",
    steel: "#5d7c8c",
    red: "#9d3b37",
    wood: "#6e4a2c",
    muted: "#b3a592",
  },
};
export const STAGE = { "veto-h": [240, 160], "gett-oh": [240, 180] };

export function seeded(id) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const norm = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/[âà]/g, "a")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[ıî]/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/[üû]/g, "u")
    .replace(/[“”"'’:.]/g, "");

const SERIES_KEYS = {
  "veto-h": [
    "kampanya",
    "skandal",
    "ritue",
    "genel merkez",
    "anket",
    "sandik",
    "kulis",
    "kursu",
    "basin",
    "kurum",
    "belediye",
    "lobi",
    "genclik",
    "hukuk",
    "koalisyon",
    "lojistik",
  ],
  "gett-oh": [
    "cayhane",
    "taksi",
    "insaat",
    "liman",
    "mertebe",
    "baba",
    "yemin",
    "racon",
    "ihbar",
    "sanayi",
    "carsi",
    "apartman",
    "aile",
    "dernek",
    "borc",
    "haber",
    "sokak",
  ],
};
export function seriesOf(theme, card) {
  const s = norm(card.series);
  return SERIES_KEYS[theme].find((k) => s.includes(k)) || SERIES_KEYS[theme][0];
}

/* ---------- backdrops ---------- */
function grad(id, top, bottom, x2 = 0, y2 = 1) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
}
function room(c, r, { wall = P.surface, wall2 = P.raised, floor = P.wood, floorY } = {}) {
  const fy = floorY ?? c.H - 34;
  return (
    `<defs>${grad("wall", wall2, wall)}${grad("flr", floor, P.ink)}</defs>` +
    `<rect width="${c.W}" height="${c.H}" fill="url(#wall)"/>` +
    `<rect y="${fy}" width="${c.W}" height="${c.H - fy}" fill="url(#flr)"/>` +
    `<path d="M0 ${fy}H${c.W}" stroke="${P.ink}" stroke-width="1.6"/>` +
    // wainscot line and a faint light pool from a random side
    `<path d="M0 ${f(fy - 26 - r() * 10)}H${c.W}" stroke="${P.ink}" stroke-width="1" opacity=".35"/>` +
    `<ellipse cx="${f(40 + r() * 160)}" cy="${f(fy * 0.45)}" rx="${f(70 + r() * 40)}" ry="${f(fy * 0.5)}" fill="${P.cream}" opacity=".06"/>`
  );
}
function night(c, r, { top = P.ink, bottom = P.surface, horizon, moon = true } = {}) {
  const hy = horizon ?? c.H * 0.62;
  let s = `<defs>${grad("sky", top, bottom)}</defs><rect width="${c.W}" height="${c.H}" fill="url(#sky)"/>`;
  for (let i = 0; i < 14; i++)
    s += `<circle cx="${f(r() * c.W)}" cy="${f(r() * hy * 0.6)}" r="${f(0.4 + r() * 0.7)}" fill="${P.cream}" opacity="${f(0.2 + r() * 0.5)}"/>`;
  if (moon && r() > 0.35) s += g(tr(20 + r() * 200, 14 + r() * 20), D.moon());
  return s;
}

/* ---------- settings: a full backdrop per series; props kept off c.side ---------- */
const away = (c, near, far) => (c.side === "left" ? far : near);
const SETTINGS = {
  "veto-h": {
    sandik: (c, r) =>
      room(c, r, { wall: "#1b2b25", wall2: "#2a3f35" }) +
      `<rect x="${away(c, 14, 150)}" y="16" width="76" height="46" fill="#23372d" stroke="${P.wood}" stroke-width="3"/>` +
      g(tr(away(c, 34, 170), c.H - 34, 0.9), M.booth(1, 0.2 + r() * 0.5)) +
      g(tr(away(c, 82, 214), c.H - 30, 0.55), M.ballotBox(1, { slip: false })),
    kulis: (c, r) =>
      room(c, r, { wall: "#1a2620", wall2: "#26382e", floor: "#5c4a33" }) +
      [0, 1, 2]
        .map((i) =>
          g(tr(10 + i * 80 + r() * 10, c.H - 34 - 76), D.door(34, 76, i === 1 ? r() * 0.5 : 0)),
        )
        .join("") +
      [0, 1, 2]
        .map(
          (i) =>
            `<circle cx="${f(58 + i * 80)}" cy="36" r="5" fill="${P.brass}" opacity=".85"/><path d="M${f(58 + i * 80)} 36L${f(40 + i * 80)} ${c.H - 34}H${f(76 + i * 80)}Z" fill="${P.brass}" opacity=".06"/>`,
        )
        .join(""),
    kursu: (c, r) =>
      room(c, r, { wall: "#16241d", wall2: "#243a30", floor: "#3a2b1c", floorY: c.H - 30 }) +
      [0, 1, 2]
        .map(
          (i) =>
            `<path d="M-10 ${f(60 + i * 18)}Q${c.W / 2} ${f(40 + i * 18)} ${c.W + 10} ${f(60 + i * 18)}" fill="none" stroke="${P.wood}" stroke-width="7" opacity="${f(0.5 + i * 0.15)}"/>`,
        )
        .join("") +
      g(tr(away(c, 40, 200), c.H - 30, 0.85), M.lectern(1, true)),
    "genel merkez": (c, r) =>
      night(c, r, { top: "#0b1511", bottom: "#1f3329", horizon: c.H - 30 }) +
      g(tr(away(c, 20, 124), 34), M.building(96, c.H - 64, r, { cols: 6, rows: 5, lit: 0.55 })) +
      g(tr(away(c, 16, 116), 40), M.banner(20, 50, P.red, P.cream)) +
      g(tr(away(c, 104, 208), 40), M.banner(20, 50, P.red, P.cream)) +
      `<rect y="${c.H - 30}" width="${c.W}" height="30" fill="${P.ink}"/>`,
    anket: (c, r) =>
      room(c, r, { wall: "#17251f", wall2: "#22352b" }) +
      g(
        tr(away(c, 12, 140), 18),
        M.screen(88, 56, ["bars", "line", "pie"][Math.floor(r() * 3)], r),
      ) +
      g(tr(away(c, 30, 160), 88), M.screen(50, 30, "line", r)),
    ritue: (c, r) =>
      `<defs>${grad("stg", "#0b120f", "#1d2d25")}</defs><rect width="${c.W}" height="${c.H}" fill="url(#stg)"/>` +
      M.spotlight(c.W / 2 + (r() - 0.5) * 60, -4, 150, c.H + 10, P.cream, 0.12) +
      `<rect y="${c.H - 26}" width="${c.W}" height="26" fill="${P.wood}"/>` +
      g(tr(0, 10), M.bunting(c.W, 12, [P.red, P.cream, P.brass])),
    kampanya: (c, r) =>
      night(c, r, { top: "#0f1a15", bottom: "#3a2f22", horizon: c.H - 40 }) +
      g(tr(0, c.H - 50), M.skyline(c.W, 0, r, "#16241d", 0.3)) +
      g(tr(0, 8), M.bunting(c.W, 10 + r() * 6)) +
      g(tr(-4, c.H - 18), M.crowd(c.W + 8, 2, r, P.ink, 0.35)),
    skandal: (c, r) =>
      room(c, r, { wall: "#1c1a18", wall2: "#2c2320", floor: "#2a201a" }) +
      `<rect width="${c.W}" height="${c.H}" fill="${P.red}" opacity=".08"/>` +
      [0, 1, 2, 3]
        .map((i) =>
          g(tr(away(c, 10, 130) + i * 22, 18 + (i % 2) * 10), M.photo(26, 20, -8 + r() * 16, r)),
        )
        .join("") +
      g(tr(away(c, 22, 142), 22), M.pin()) +
      g(tr(away(c, 88, 208), 30), M.pin(P.brass)),
    belediye: (c, r) =>
      night(c, r, { top: "#101c18", bottom: "#2a3b33", horizon: c.H - 34 }) +
      g(
        tr(away(c, 10, 130), 26),
        M.building(100, c.H - 58, r, { cols: 7, rows: 4, lit: 0.45, pediment: true }),
      ) +
      `<rect y="${c.H - 34}" width="${c.W}" height="34" fill="#27302b"/><path d="M0 ${c.H - 20}H${c.W}" stroke="${P.cream}" stroke-width="2" stroke-dasharray="12 10" opacity=".4"/>` +
      g(tr(away(c, 120, 6), c.H - 34), M.streetLamp(80)),
    basin: (c, r) =>
      room(c, r, { wall: "#18221d", wall2: "#26352d" }) +
      [0, 1, 2]
        .map((i) =>
          g(
            tr(away(c, 8, 128) + i * 36, 20 + (i % 2) * 6),
            M.screen(32, 24, i === 1 ? "live" : "static", r),
          ),
        )
        .join("") +
      g(tr(away(c, 20, 140), c.H - 58, 1, -4), M.newspaper(54, 38, P.red)),
    kurum: (c, r) =>
      room(c, r, { wall: "#1b2621", wall2: "#2b3a32" }) +
      g(tr(away(c, 14, 134), 14), D.columns(4, c.H - 50)) +
      g(tr(away(c, 20, 150), c.H - 70), D.drawers(40, 36, Math.floor(r() * 3))),
    lobi: (c, r) =>
      room(c, r, { wall: "#241e17", wall2: "#3a2f22", floor: "#4d3a24" }) +
      `<path d="M${c.W / 2 - 30} 0V12M${c.W / 2 - 40} 12H${c.W / 2 - 20}" stroke="${P.brass}" stroke-width="2"/>` +
      [0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<circle cx="${c.W / 2 - 40 + i * 5}" cy="${16 + (i % 2) * 4}" r="2.4" fill="${P.brass}"/>`,
        )
        .join("") +
      g(tr(away(c, 36, 196), c.H - 34, 0.9), M.armchair(1, P.red)) +
      g(tr(away(c, 90, 150), c.H - 50, 0.8), D.coins(3)),
    genclik: (c, r) =>
      night(c, r, { top: "#1a2c35", bottom: "#4a5a45", horizon: c.H - 36, moon: false }) +
      g(
        tr(away(c, 6, 120), 36),
        M.building(110, c.H - 70, r, { cols: 8, rows: 3, lit: 0.2, pediment: true }),
      ) +
      `<rect y="${c.H - 36}" width="${c.W}" height="36" fill="#2c3b2e"/>` +
      g(tr(away(c, 20, 150), c.H - 34), M.tree(1.1)) +
      g(tr(away(c, 90, 216), c.H - 22, 0.8), M.bicycle(1)),
    hukuk: (c, r) =>
      room(c, r, { wall: "#1d1a15", wall2: "#302a20", floor: "#3c2c1b" }) +
      `<rect x="${away(c, 8, 128)}" y="${c.H - 80}" width="104" height="46" fill="${P.wood}" stroke="${P.ink}" stroke-width="1.6"/>` +
      g(tr(away(c, 60, 180), 36, 1.05), D.scales(1, (r() - 0.5) * 0.8)) +
      g(tr(away(c, 30, 150), c.H - 90), D.gavel(1)),
    koalisyon: (c, r) =>
      room(c, r, { wall: "#1a2620", wall2: "#28382f" }) +
      g(tr(away(c, 60, 180), c.H - 44, 1.1), D.roundTable(1, 6, Math.floor(r() * 6))) +
      g(tr(away(c, 16, 136), 18), D.mapBoard(84, 40, 4, r)),
    lojistik: (c, r) =>
      night(c, r, { top: "#101915", bottom: "#28362d", horizon: c.H - 32 }) +
      `<rect y="${c.H - 32}" width="${c.W}" height="32" fill="#252b25"/>` +
      g(tr(away(c, 60, 186), c.H - 22, 0.9), M.bus(1, P.cream)) +
      g(tr(away(c, 10, 148), c.H - 34), M.containers(3, r)),
  },
  "gett-oh": {
    cayhane: (c, r) =>
      room(c, r, { wall: "#2a1c14", wall2: "#40291c", floor: "#3a2616" }) +
      g(tr(away(c, 14, 150), 18), M.window(44, 50, true, true)) +
      g(tr(away(c, 70, 206), 18), M.window(28, 50, false)) +
      `<rect x="${away(c, 10, 130)}" y="${c.H - 60}" width="100" height="10" fill="${P.wood}" stroke="${P.ink}" stroke-width="1.6"/>` +
      g(tr(away(c, 28, 150), c.H - 60, 0.7), M.teapot(1)) +
      g(tr(away(c, 70, 196), c.H - 60, 0.8), M.teaGlass(1)) +
      g(tr(away(c, 92, 214), c.H - 60, 0.8), M.teaGlass(1)) +
      g(tr(away(c, 40, 170), c.H - 24), M.stool(1)),
    taksi: (c, r) =>
      night(c, r, { top: "#0c1216", bottom: "#2b2a28", horizon: c.H - 44 }) +
      g(tr(0, c.H - 44), M.skyline(c.W, 0, r, "#1a1a1a", 0.25)) +
      `<rect y="${c.H - 44}" width="${c.W}" height="44" fill="#232120"/><path d="M0 ${c.H - 20}H${c.W}" stroke="${P.cream}" stroke-width="2" stroke-dasharray="14 10" opacity=".45"/>` +
      g(tr(away(c, 150, 30), c.H - 44), M.streetLamp(90)),
    insaat: (c, r) =>
      night(c, r, { top: "#141516", bottom: "#3a2e24", horizon: c.H - 30 }) +
      g(tr(away(c, 16, 140), c.H - 30), M.scaffold(80, 90)) +
      g(tr(away(c, 40, 160), c.H - 30), M.crane(c.H - 50, 70, c.side === "left")) +
      `<rect y="${c.H - 30}" width="${c.W}" height="30" fill="#2e261e"/>`,
    liman: (c, r) =>
      night(c, r, { top: "#0b141a", bottom: "#233640", horizon: c.H - 60 }) +
      g(tr(away(c, 20, 160), c.H - 60, 0.8), M.ship(1)) +
      M.water(c.H - 60, c.W, 30, r) +
      `<rect y="${c.H - 30}" width="${c.W}" height="30" fill="#2a2724"/>` +
      g(tr(away(c, 10, 130), c.H - 30), M.containers(3 + Math.floor(r() * 3), r)) +
      g(tr(away(c, 96, 226), c.H - 30), M.crane(c.H - 40, 60, c.side === "right")),
    mertebe: (c, r) =>
      night(c, r, { top: "#150e0c", bottom: "#3a221b", horizon: c.H - 34 }) +
      g(tr(away(c, 6, 128), 30), M.apartment(56, c.H - 64, r, 0.5)) +
      g(tr(away(c, 64, 186), 50), M.apartment(48, c.H - 84, r, 0.3)) +
      `<rect x="${away(c, 14, 136)}" y="44" width="36" height="12" rx="3" fill="${P.red}" opacity=".85"/>` +
      `<rect y="${c.H - 34}" width="${c.W}" height="34" fill="#261c17"/>`,
    baba: (c, r) =>
      room(c, r, { wall: "#26170f", wall2: "#3e2616", floor: "#2e1d12" }) +
      g(tr(away(c, 10, 130), 14), D.shelves(100, 60, 3, r)) +
      `<rect x="${away(c, 14, 134)}" y="${c.H - 64}" width="92" height="30" fill="${P.wood}" stroke="${P.ink}" stroke-width="1.6"/>` +
      g(tr(away(c, 90, 210), c.H - 64), D.lamp(0.9)) +
      g(tr(away(c, 40, 160), c.H - 72, 0.7), M.prayerBeads(1)),
    yemin: (c, r) =>
      `<defs>${grad("dk", "#0d0907", "#2c1a12")}</defs><rect width="${c.W}" height="${c.H}" fill="url(#dk)"/>` +
      `<rect y="${c.H - 36}" width="${c.W}" height="36" fill="${P.wood}"/>` +
      [0, 1, 2]
        .map((i) =>
          g(
            tr(away(c, 20, 150) + i * 24, c.H - 36 + (i % 2) * 4, 0.9 + (i % 2) * 0.2),
            M.candle(1),
          ),
        )
        .join(""),
    racon: (c, r) =>
      night(c, r, { top: "#0e0b0c", bottom: "#2b1f1c", horizon: c.H - 40 }) +
      g(tr(away(c, 0, 130), 20), M.apartment(50, c.H - 60, r, 0.3)) +
      g(tr(away(c, 56, 186), 40), M.apartment(54, c.H - 80, r, 0.25)) +
      `<rect y="${c.H - 40}" width="${c.W}" height="40" fill="#221a17"/>` +
      g(tr(away(c, 116, 10), c.H - 40), M.streetLamp(100)),
    ihbar: (c, r) =>
      night(c, r, { top: "#0a0c10", bottom: "#1f1c22", horizon: c.H - 40, moon: false }) +
      `<rect width="${c.W}" height="${c.H}" fill="${P.red}" opacity=".07"/>` +
      g(tr(away(c, 10, 130), 24), M.apartment(52, c.H - 64, r, 0.15)) +
      `<rect y="${c.H - 40}" width="${c.W}" height="40" fill="#1c1a1b"/>` +
      g(tr(away(c, 70, 190), 30, 1, c.side === "left" ? 10 : 170), M.cctv(1)),
    sanayi: (c, r) =>
      room(c, r, { wall: "#1f1e1d", wall2: "#33302b", floor: "#2c2824" }) +
      g(tr(away(c, 8, 128), 20), M.shutter(56, c.H - 54, 0.6)) +
      g(tr(away(c, 80, 200), 34), M.gear(12)) +
      g(tr(away(c, 96, 212), 58), M.gear(8, 6)) +
      g(tr(away(c, 20, 140), c.H - 44), M.wrench(0.9, 0)),
    carsi: (c, r) =>
      night(c, r, { top: "#1a1410", bottom: "#4a3526", horizon: c.H - 34, moon: false }) +
      [0, 1]
        .map((i) => g(tr(away(c, 6, 124) + i * 56, 30), M.shutter(50, c.H - 64, i ? 0.8 : 0.1)))
        .join("") +
      [0, 1]
        .map((i) => g(tr(away(c, 6, 124) + i * 56, 24), M.awning(48, i ? P.steel : P.red)))
        .join("") +
      `<rect y="${c.H - 34}" width="${c.W}" height="34" fill="#2f241b"/>`,
    apartman: (c, r) =>
      night(c, r, { top: "#0d1216", bottom: "#29313a", horizon: c.H - 30 }) +
      g(tr(away(c, 10, 124), 14), M.apartment(96, c.H - 44, r, 0.4)) +
      `<rect y="${c.H - 30}" width="${c.W}" height="30" fill="#2a2a2a"/>` +
      g(tr(away(c, 48, 162), c.H - 30), M.stairs(4, 36)),
    aile: (c, r) =>
      room(c, r, { wall: "#2b1d14", wall2: "#45301f", floor: "#3a2718" }) +
      `<path d="M${c.W / 2} 0V20" stroke="${P.ink}" stroke-width="1.4"/><path d="M${c.W / 2 - 14} 30L${c.W / 2} 18L${c.W / 2 + 14} 30Z" fill="${P.brass}"/><ellipse cx="${c.W / 2}" cy="${c.H - 40}" rx="100" ry="30" fill="${P.brass}" opacity=".08"/>` +
      g(tr(away(c, 14, 134), 20), M.photo(30, 24, -4, r)) +
      g(tr(away(c, 20, 140), c.H - 58), M.dinnerTable(80, r)),
    dernek: (c, r) =>
      room(c, r, { wall: "#1c1d22", wall2: "#2c2e36", floor: "#302620" }) +
      g(tr(away(c, 10, 130), 20), M.scarf(90, P.red, P.brass)) +
      [0, 1].map((i) => g(tr(away(c, 20, 140) + i * 40, 50), M.photo(28, 22, 0, r))).join("") +
      g(tr(away(c, 30, 150), c.H - 34), D.chairs(3, 24, Math.floor(r() * 3))),
    borc: (c, r) =>
      room(c, r, { wall: "#201a14", wall2: "#33281d" }) +
      `<rect x="${away(c, 10, 130)}" y="${c.H - 62}" width="100" height="28" fill="${P.wood}" stroke="${P.ink}" stroke-width="1.6"/>` +
      g(tr(away(c, 20, 140), c.H - 90), M.ledgerBook(52, 30)) +
      g(tr(away(c, 86, 206), c.H - 64), D.coins(4)),
    haber: (c, r) =>
      night(c, r, { top: "#0e1215", bottom: "#2c2a26", horizon: c.H - 34, moon: false }) +
      `<rect x="${away(c, 10, 130)}" y="30" width="96" height="${c.H - 64}" fill="#3a2b1e" stroke="${P.ink}" stroke-width="1.6"/>` +
      [0, 1, 2, 3]
        .map((i) =>
          g(
            tr(away(c, 16, 136) + (i % 2) * 44, 38 + Math.floor(i / 2) * 42),
            M.newspaper(40, 34, i % 2 ? P.red : P.ink),
          ),
        )
        .join("") +
      `<rect y="${c.H - 34}" width="${c.W}" height="34" fill="#23211f"/>`,
    sokak: (c, r) =>
      night(c, r, { top: "#0b0e12", bottom: "#262a2c", horizon: c.H - 36 }) +
      g(tr(away(c, 0, 132), 16), M.apartment(48, c.H - 52, r, 0.3)) +
      g(tr(away(c, 52, 184), 34), M.apartment(52, c.H - 70, r, 0.2)) +
      `<rect y="${c.H - 36}" width="${c.W}" height="36" fill="#1f2224"/>` +
      g(tr(away(c, 20, 150), c.H - 36), M.stairs(5, 50)),
  },
};

/* ---------- things: hand-sized (held) and stage-sized (centre of a spell/trap) ---------- */
// hand(x, y, r) draws at a hand; big(x, y, r, s) draws centred on (x, y).
const THINGS = {
  sheet: {
    hand: (x, y) => g(tr(x - 12, y - 30, 1, -8), D.sheet(28, 36, { lines: 4 })),
    big: (x, y, r, s) =>
      g(
        tr(x - 30 * s, y - 36 * s, 1.3 * s, -4 + r() * 8),
        D.sheet(44, 54, { lines: 5, seal: r() > 0.5 ? P.red : null }),
      ),
  },
  envelope: {
    hand: (x, y) => g(tr(x - 16, y - 18, 1, -12), D.envelope(34, 22, { seal: P.red })),
    big: (x, y, r, s) =>
      g(
        tr(x - 36 * s, y - 22 * s, 1.4 * s, -6 + r() * 12),
        D.envelope(52, 34, { open: r() > 0.5, seal: P.red }),
      ),
  },
  ballot: {
    hand: (x, y) =>
      g(
        tr(x - 6, y - 22, 1, -10),
        `<rect width="14" height="20" fill="${P.cream}" stroke="${P.ink}" stroke-width="1.2"/><circle cx="7" cy="9" r="3" fill="none" stroke="${P.red}" stroke-width="1.4"/>`,
      ),
    big: (x, y, r, s) => g(tr(x, y + 16 * s, 1.35 * s), M.ballotBox(1, { slip: true })),
  },
  mic: {
    hand: (x, y) => g(tr(x, y - 2, 0.9, -20), D.microphone(1)),
    big: (x, y, r, s) => g(tr(x, y + 26 * s, 1.3 * s), M.micCluster(1, 4 + Math.floor(r() * 3), r)),
  },
  megaphone: {
    hand: (x, y) => g(tr(x + 8, y - 8, 1), M.megaphone(1)),
    big: (x, y, r, s) => g(tr(x, y, 2 * s, -10), M.megaphone(1)),
  },
  camera: {
    hand: (x, y) =>
      g(
        tr(x + 4, y - 10, 0.8),
        `<rect x="-14" y="-10" width="26" height="18" rx="3" fill="${P.raised}" stroke="${P.ink}" stroke-width="1.4"/><circle cx="-1" cy="-1" r="6" fill="${P.steel}" stroke="${P.ink}" stroke-width="1.4"/>`,
      ),
    big: (x, y, r, s) => g(tr(x, y - 6 * s, 1.5 * s), M.tvCamera(1)),
  },
  newspaper: {
    hand: (x, y) => g(tr(x - 20, y - 26, 0.8, -8), M.newspaper(50, 36, P.red)),
    big: (x, y, r, s) =>
      g(
        tr(x - 40 * s, y - 30 * s, 1.5 * s, -5 + r() * 10),
        M.newspaper(54, 38, r() > 0.5 ? P.red : P.ink),
      ),
  },
  screen: {
    hand: (x, y, r) => g(tr(x - 14, y - 22, 0.6), M.screen(46, 32, "bars", r)),
    big: (x, y, r, s) =>
      g(
        tr(x - 44 * s, y - 30 * s, 1.1 * s),
        M.screen(80, 54, ["bars", "line", "pie", "live"][Math.floor(r() * 4)], r),
      ),
  },
  chart: {
    hand: (x, y, r) =>
      g(
        tr(x - 10, y - 30, 0.55),
        D.easel(
          1,
          [r(), r(), r(), r()].map((v) => 0.2 + v * 0.7),
        ),
      ),
    big: (x, y, r, s) =>
      g(
        tr(x - 20 * s, y - 50 * s, 1.3 * s),
        D.easel(
          1,
          [r(), r(), r(), r()].map((v) => 0.2 + v * 0.7),
        ),
      ),
  },
  pie: {
    hand: (x, y, r) => g(tr(x + 6, y - 12, 0.6), M.pieChart(18, 0.2 + r() * 0.6)),
    big: (x, y, r, s) => g(tr(x, y, 1.6 * s), M.pieChart(20, 0.2 + r() * 0.6)),
  },
  folder: {
    hand: (x, y) => g(tr(x - 16, y - 20, 0.7, -6), D.folder(50, 36, P.steel)),
    big: (x, y, r, s) =>
      g(
        tr(x - 40 * s, y - 30 * s, 1.5 * s, -6 + r() * 10),
        D.folder(56, 40, r() > 0.5 ? P.brass : P.steel),
      ),
  },
  gavel: {
    hand: (x, y) => g(tr(x, y - 6, 0.8, -20), D.gavel(1)),
    big: (x, y, r, s) => g(tr(x - 10 * s, y, 1.6 * s), D.gavel(1)),
  },
  scales: {
    hand: (x, y) => g(tr(x + 4, y - 20, 0.6), D.scales(1, 0.3)),
    big: (x, y, r, s) => g(tr(x, y - 24 * s, 1.5 * s), D.scales(1, (r() - 0.5) * 1.2)),
  },
  stamp: {
    hand: (x, y) => g(tr(x, y + 10, 0.9), D.stamp(1)),
    big: (x, y, r, s) =>
      g(tr(x - 10 * s, y + 10 * s, 1.5 * s), D.stamp(1)) +
      g(tr(x + 40 * s, y + 10 * s), D.stampMark(14 * s)),
  },
  phone: {
    hand: (x, y) => g(tr(x - 2, y - 4, 0.9), M.cellphone(1)),
    big: (x, y, r, s) => g(tr(x, y, 1.6 * s), D.telephone(1)),
  },
  cellphone: {
    hand: (x, y) => g(tr(x - 2, y - 4, 0.9), M.cellphone(1)),
    big: (x, y, r, s) => g(tr(x, y, 2 * s, -10 + r() * 20), M.cellphone(1)),
  },
  walkie: {
    hand: (x, y) => g(tr(x, y - 6, 0.9), M.walkie(1)),
    big: (x, y, r, s) => g(tr(x, y, 1.8 * s), M.walkie(1)),
  },
  handshake: { hand: (x, y) => "", big: (x, y, r, s) => g(tr(x, y, 1.3 * s), M.handshake(1)) },
  coins: {
    hand: (x, y) => g(tr(x, y + 4, 0.8), D.coins(3)),
    big: (x, y, r, s) =>
      g(tr(x - 20 * s, y + 14 * s, 1.4 * s), D.coins(4)) +
      g(tr(x + 16 * s, y + 18 * s, 1.2 * s), D.coins(2)),
  },
  cash: {
    hand: (x, y) => g(tr(x - 16, y - 14, 0.7), M.banknotes(3)),
    big: (x, y, r, s) => g(tr(x - 30 * s, y - 14 * s, 1.4 * s), M.banknotes(4)),
  },
  envelopeCash: {
    hand: (x, y) => g(tr(x - 16, y - 16, 0.8), M.envelopeCash(1)),
    big: (x, y, r, s) => g(tr(x - 30 * s, y - 20 * s, 1.5 * s, -6), M.envelopeCash(1)),
  },
  bus: {
    hand: (x, y) => "",
    big: (x, y, r, s) => g(tr(x, y + 10 * s, 1.1 * s), M.bus(1, r() > 0.5 ? P.cream : P.brass)),
  },
  banner: {
    hand: (x, y) =>
      g(
        tr(x - 2, y - 44),
        `<path d="M0 0V50" stroke="${P.wood}" stroke-width="2"/>` +
          g(tr(2, 0), M.banner(22, 28, P.red, P.cream)),
      ),
    big: (x, y, r, s) =>
      g(tr(x - 44 * s, y - 40 * s, s), M.banner(36, 60, P.red, P.cream)) +
      g(tr(x + 8 * s, y - 34 * s, s), M.banner(36, 60, P.steel, P.cream)),
  },
  building: {
    hand: () => "",
    big: (x, y, r, s) =>
      g(
        tr(x - 44 * s, y - 40 * s, s),
        M.building(88, 70, r, { cols: 6, rows: 4, lit: 0.5, pediment: true }),
      ),
  },
  clock: {
    hand: (x, y) => g(tr(x + 4, y - 8, 0.7), D.clock(14, 4)),
    big: (x, y, r, s) => g(tr(x, y - 6 * s, s), D.clock(30, Math.floor(r() * 12))),
  },
  hourglass: {
    hand: (x, y) => g(tr(x, y - 10, 0.7), D.hourglass(1)),
    big: (x, y, r, s) => g(tr(x, y, 1.6 * s), D.hourglass(1)),
  },
  padlock: {
    hand: (x, y) => g(tr(x, y - 6, 0.8), D.padlock(1)),
    big: (x, y, r, s) => g(tr(x, y - 10 * s, 1.8 * s), D.padlock(1)),
  },
  door: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x - 20 * s, y - 50 * s, 1.2 * s), D.door(34, 76, r() * 0.6)),
  },
  map: {
    hand: (x, y, r) => g(tr(x - 20, y - 26, 0.5), D.mapBoard(80, 52, 3, r)),
    big: (x, y, r, s) => g(tr(x - 50 * s, y - 32 * s, 1.2 * s), D.mapBoard(84, 54, 5, r)),
  },
  magnifier: {
    hand: (x, y) => g(tr(x, y - 6, 0.9), D.magnifier(1)),
    big: (x, y, r, s) =>
      g(tr(x - 30 * s, y - 20 * s, 1.2 * s), D.sheet(44, 54, { lines: 5 })) +
      g(tr(x + 10 * s, y, 1.6 * s), D.magnifier(1)),
  },
  table: {
    hand: (x, y) => g(tr(x - 14, y - 24, 0.6), D.table(3, 4, 40, 36)),
    big: (x, y, r, s) => g(tr(x - 34 * s, y - 34 * s, 1.3 * s), D.table(3, 5, 52, 50)),
  },
  round: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x, y + 12 * s, 1.3 * s), D.roundTable(1, 6, Math.floor(r() * 6))),
  },
  chairs: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x - 56 * s, y + 20 * s, s), D.chairs(5, 26, Math.floor(r() * 5))),
  },
  bike: { hand: () => "", big: (x, y, r, s) => g(tr(x, y + 16 * s, 1.5 * s), M.bicycle(1)) },
  tea: {
    hand: (x, y) => g(tr(x + 2, y + 4, 0.7), M.tray(1, 3)),
    big: (x, y, r, s) =>
      g(tr(x, y + 18 * s, 1.5 * s), M.tray(1, 3)) +
      g(tr(x - 44 * s, y + 18 * s, 0.9 * s), M.teapot(1)),
  },
  teaglass: {
    hand: (x, y) => g(tr(x + 2, y + 2, 0.9), M.teaGlass(1)),
    big: (x, y, r, s) =>
      g(tr(x - 16 * s, y + 20 * s, 2 * s), M.teaGlass(1, r() > 0.25)) +
      g(tr(x + 26 * s, y + 20 * s, 1.5 * s), M.teaGlass(1)),
  },
  teapot: {
    hand: (x, y) => g(tr(x, y + 10, 0.6), M.teapot(1)),
    big: (x, y, r, s) => g(tr(x, y + 30 * s, 1.4 * s), M.teapot(1)),
  },
  tavla: {
    hand: (x, y, r) => g(tr(x, y, 0.4), M.backgammon(1, r)),
    big: (x, y, r, s) => g(tr(x, y + 6 * s, 1.3 * s), M.backgammon(1, r)),
  },
  car: {
    hand: (x, y) => g(tr(x + 4, y + 2, 0.6), M.key(1)),
    big: (x, y, r, s) =>
      g(tr(x, y + 20 * s, 1.2 * s), M.car(1, r() > 0.5 ? P.brass : P.muted, { sign: false })),
  },
  taxi: {
    hand: (x, y) => g(tr(x + 4, y + 2, 0.6), M.key(1)),
    big: (x, y, r, s) => g(tr(x, y + 20 * s, 1.2 * s), M.car(1, P.brass, { sign: true })),
  },
  key: {
    hand: (x, y) => g(tr(x, y, 0.8, -20), M.key(1)),
    big: (x, y, r, s) => g(tr(x - 10 * s, y, 1.8 * s, -20 + r() * 40), M.key(1)),
  },
  keyring: {
    hand: (x, y) => g(tr(x, y, 0.8), M.keyring(1, 3)),
    big: (x, y, r, s) => g(tr(x, y - 10 * s, 1.8 * s), M.keyring(1, 4)),
  },
  wrench: {
    hand: (x, y) => g(tr(x + 4, y - 4, 0.6, -50), M.wrench(1, 0)),
    big: (x, y, r, s) =>
      g(tr(x, y, 1.4 * s), M.wrench(1, -30)) + g(tr(x + 30 * s, y - 24 * s, s), M.gear(12)),
  },
  gear: {
    hand: (x, y) => g(tr(x + 6, y - 4, 0.6), M.gear(12)),
    big: (x, y, r, s) =>
      g(tr(x - 14 * s, y, 1.4 * s), M.gear(14)) + g(tr(x + 22 * s, y - 16 * s, s), M.gear(10, 7)),
  },
  crane: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x - 20 * s, y + 50 * s, 0.8 * s), M.crane(110, 80)),
  },
  containers: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x - 56 * s, y + 30 * s, s), M.containers(6, r)),
  },
  ship: { hand: () => "", big: (x, y, r, s) => g(tr(x, y + 10 * s, 1.3 * s), M.ship(1)) },
  scaleW: {
    hand: (x, y) => g(tr(x, y + 12, 0.6), M.weighScale(1, 0.5)),
    big: (x, y, r, s) => g(tr(x, y + 24 * s, 1.5 * s), M.weighScale(1, (r() - 0.5) * 1.4)),
  },
  awning: {
    hand: () => "",
    big: (x, y, r, s) =>
      g(tr(x - 34 * s, y - 30 * s, 1.2 * s), M.awning(56, P.red)) +
      g(tr(x - 34 * s, y - 14 * s, 1.2 * s), M.shutter(56, 40, 0.5)),
  },
  shutter: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x - 30 * s, y - 34 * s, 1.2 * s), M.shutter(50, 56, r() * 0.3)),
  },
  ledger: {
    hand: (x, y) => g(tr(x - 20, y - 18, 0.7), M.ledgerBook(50, 30)),
    big: (x, y, r, s) => g(tr(x - 40 * s, y - 24 * s, 1.5 * s), M.ledgerBook(52, 34)),
  },
  apartment: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x - 30 * s, y - 50 * s, s), M.apartment(60, 100, r, 0.4)),
  },
  rings: {
    hand: (x, y) => g(tr(x, y - 4, 0.8), M.rings(1)),
    big: (x, y, r, s) => g(tr(x, y, 2 * s), M.rings(1)),
  },
  dinner: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x - 60 * s, y + 10 * s, s), M.dinnerTable(120, r)),
  },
  photo: {
    hand: (x, y, r) => g(tr(x - 14, y - 16, 0.8), M.photo(30, 24, -8, r)),
    big: (x, y, r, s) =>
      g(tr(x - 40 * s, y - 26 * s, 1.2 * s), M.photo(38, 30, -8, r)) +
      g(tr(x + 2 * s, y - 20 * s, 1.2 * s), M.photo(38, 30, 7, r)),
  },
  jersey: {
    hand: (x, y) => g(tr(x, y - 6, 0.6), M.jersey(1)),
    big: (x, y, r, s) =>
      g(tr(x, y - 4 * s, 1.6 * s), M.jersey(1, r() > 0.5 ? P.red : P.steel, P.cream)),
  },
  scarf: {
    hand: (x, y) => g(tr(x - 20, y - 6, 0.5), M.scarf(80)),
    big: (x, y, r, s) => g(tr(x - 60 * s, y - 10 * s, 1.5 * s), M.scarf(80, P.red, P.brass)),
  },
  candle: {
    hand: (x, y) => g(tr(x, y + 8, 0.6), M.candle(1)),
    big: (x, y, r, s) =>
      g(tr(x - 20 * s, y + 30 * s, 1.3 * s), M.candle(1)) +
      g(tr(x + 20 * s, y + 34 * s, 1.1 * s), M.candle(1)),
  },
  beads: {
    hand: (x, y) => g(tr(x, y - 6, 0.6), M.prayerBeads(1)),
    big: (x, y, r, s) => g(tr(x, y - 12 * s, 1.5 * s), M.prayerBeads(1)),
  },
  armchair: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x, y + 40 * s, 1.1 * s), M.armchair(1, P.red)),
  },
  flashlight: {
    hand: (x, y) =>
      `<rect x="${f(x - 2)}" y="${f(y - 4)}" width="14" height="6" rx="2" fill="${P.muted}" stroke="${P.ink}" stroke-width="1.2"/>` +
      M.flashlight(x + 12, y - 1, -8, 80),
    big: (x, y, r, s) =>
      M.flashlight(x - 60 * s, y + 20 * s, -15, 170 * s) +
      g(
        tr(x - 64 * s, y + 18 * s, 1.4 * s),
        `<rect x="-2" y="-4" width="14" height="6" rx="2" fill="${P.muted}" stroke="${P.ink}" stroke-width="1.2"/>`,
      ),
  },
  cctv: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x - 30 * s, y - 20 * s, 1.5 * s, 10), M.cctv(1)),
  },
  siren: { hand: () => "", big: (x, y, r, s) => g(tr(x, y + 10 * s, 1.6 * s), M.siren(1)) },
  lamp: {
    hand: (x, y) => g(tr(x, y + 6, 0.8), D.lamp(1)),
    big: (x, y, r, s) => g(tr(x, y + 30 * s, 1.1 * s), M.streetLamp(80)),
  },
  tree: { hand: () => "", big: (x, y, r, s) => g(tr(x, y + 40 * s, 1.4 * s), M.tree(1)) },
  stairs: {
    hand: () => "",
    big: (x, y, r, s) =>
      g(tr(x - 40 * s, y + 40 * s, 1.4 * s), M.stairs(5, 60)) +
      g(tr(x - 20 * s, y + 10 * s, s), M.footprints(4)),
  },
  lectern: {
    hand: () => "",
    big: (x, y, r, s) => g(tr(x, y + 34 * s, 1.1 * s), M.lectern(1, true)),
  },
  eye: { hand: () => "", big: (x, y, r, s) => g(tr(x, y, 1.8 * s), D.eye(r() > 0.7)) },
  chain: { hand: () => "", big: (x, y, r, s) => g(tr(x - 30 * s, y, 1.4 * s), D.chain(5)) },
  crack: { hand: () => "", big: (x, y, r, s) => g(tr(x - 40 * s, y, 1.3 * s), M.crack(60, r)) },
};

// Keyword -> things. First match wins; order is from specific to general.
const WORDS = [
  [/cay|dem|ocak|simit/, ["tea", "teaglass"]],
  [/okey|tavla|kahve oturumu|kahvehane|masa toplay/, ["tavla", "teaglass"]],
  [
    /taksi|sofor|durak|minibus|servis|hat |hat$|plaka|korsan|sefer|yol |yol$|transfer araci|kacis arabasi|makam arabasi|araba yak/,
    ["taxi", "key"],
  ],
  [/otobus/, ["bus", "ballot"]],
  [/araba|oto |garaj|cekici|kurtarici/, ["car", "wrench"]],
  [
    /usta|tamirci|kaynak|motor|atolye|parca|hurda|takim|ekspertiz|sanayi|demirci|demir cubuk/,
    ["wrench", "gear"],
  ],
  [/vinc|santiye|muteahhit|insaat/, ["crane", "sheet"]],
  [/liman|rihtim|ambar|gemi|iskele|yuk|manifesto|istif|tir kapisi|gumruk/, ["containers", "sheet"]],
  [/kaptan/, ["ship", "walkie"]],
  [/kasap|hal |hal$|esnaf|toptanci|pazar|terzi|tarti|dukkan|kepenk|carsi/, ["scaleW", "awning"]],
  [/kuyumcu/, ["rings", "coins"]],
  [
    /tefeci|tahsilat|veresiye|senet|taksit|odeme|alacak|kefil|kefalet|borc|hesap|kasa|haraç|harac|para|payi|rusvet|bagis|sponsor|hazine|butce|is insani|patronu$/,
    ["cash", "ledger"],
  ],
  [
    /anahtar|kilit|aidat|kapici|sayac|site|bina|kat malik|merdiven|apartman/,
    ["keyring", "apartment"],
  ],
  [/dugun|nikah|nisan|ceyiz|aile|teyze|sofra|evlatlik|kan bagi/, ["rings", "dinner"]],
  [/dernek|kulup|forma|tribun|atki|uye|spor/, ["jersey", "scarf"]],
  [/kamera|kayit|montaj|goruntu/, ["camera", "cctv"]],
  [
    /gazete|haber|kupur|editor|muhabir|basin|baski|bulten|tekzip|yayin|medya|yorumcu|manset/,
    ["newspaper", "camera"],
  ],
  [/telsiz/, ["walkie", "map"]],
  [/telefon|ihbar hatti|fisilti|mesaj|randevu/, ["cellphone", "phone"]],
  [
    /muhbir|ihbar|komsu gordu|tanik|kulakci|gozcu|bekci|nobet|koruyucu|iz suru|radar|kor nokta/,
    ["flashlight", "eye"],
  ],
  [/kurye|haberci|tasiyici|dagitici|emanet|davetiye|tebligat|zarf/, ["envelope", "bike"]],
  [/harita|rota|sokak|kose|arka sokak|mahalle|semt/, ["map", "lamp"]],
  [
    /yemin|ant|soz |soz$|eski soz|mutabakat|konsey|birlik|ortak kasa|birlesik/,
    ["candle", "handshake"],
  ],
  [/baba|reis|aga|kral|patron|agir abi|isim|buyuk|eski defter/, ["beads", "armchair"]],
  [/sandik|oy |oy$|pusula|musahit|secmen|sayim|tutanak|muhur|delege/, ["ballot", "stamp"]],
  [
    /anket|orneklem|veri|exit poll|kirilim|hata payi|oran|yoklama|analist|arastirma|katilim|dip dalga|cogunluk|kararsiz|taktik/,
    ["chart", "screen"],
  ],
  [
    /miting|kursu|sozcu|lider|konusma|slogan|vaad|kampus sozcusu|meclis|oturum|onerge|genel baskan|aday|milletvekili|bakan/,
    ["mic", "lectern"],
  ],
  [/broşur|brosur|afis|reklam|bant|bildiri|liste/, ["newspaper", "banner"]],
  [/gonullu|ekip|genclik|ogrenci|kampus|forum|bisiklet/, ["megaphone", "bike"]],
  [
    /avukat|hukuk|dava|dilekce|itiraz|tedbir|mahkeme|yargi|yargic|anayasa|kurul karari|durdurma|hak savun/,
    ["gavel", "scales"],
  ],
  [
    /protokol|ittifak|koalisyon|uzlas|mutabakat|pazarlik|muzakere|masa|heyet|calistay/,
    ["round", "handshake"],
  ],
  [/lobi|cikar|sektor|sendika|odalar/, ["handshake", "cash"]],
  [
    /evrak|arsiv|dosya|belge|makbuz|rapor|imar|ruhsat|denetim|denetc|mufettis|etik|memur|sekreter|yazman|katib|kayitci|yazici/,
    ["folder", "sheet"],
  ],
  [/belediye|park|afet|fen isleri|kent|havza|ihale/, ["building", "map"]],
  [/otobus|lojistik|depo|akaryakit|sahne|ses kontrol|operasyon|organizator/, ["bus", "walkie"]],
  [/sure|takvim|gece|sabah|aksam|zaman|mola|son dakika|bekleyin/, ["clock", "hourglass"]],
  [/kapali|kapi|gizli|sessiz/, ["door", "padlock"]],
  [/skandal|sizinti|kayit|tweet|diploma|iddia/, ["photo", "magnifier"]],
  [/canli|stüdyo|studyo|kusak|baglanti/, ["screen", "camera"]],
  [/danisman|direktor|koordinator|uzman|strateji|mimar/, ["chart", "map"]],
  [/pasa|vali|asker|eski devlet|koruma|konvoy/, ["map", "walkie"]],
];
const SERIES_THINGS = {
  "veto-h": {
    sandik: ["ballot", "stamp"],
    kulis: ["cellphone", "envelope"],
    kursu: ["mic", "lectern"],
    "genel merkez": ["map", "building"],
    anket: ["chart", "screen"],
    ritue: ["handshake", "banner"],
    kampanya: ["banner", "megaphone"],
    skandal: ["photo", "magnifier"],
    belediye: ["building", "map"],
    basin: ["newspaper", "camera"],
    kurum: ["folder", "stamp"],
    lobi: ["handshake", "cash"],
    genclik: ["megaphone", "bike"],
    hukuk: ["gavel", "scales"],
    koalisyon: ["round", "handshake"],
    lojistik: ["bus", "walkie"],
  },
  "gett-oh": {
    cayhane: ["tea", "teaglass"],
    taksi: ["taxi", "key"],
    insaat: ["crane", "wrench"],
    liman: ["containers", "walkie"],
    mertebe: ["beads", "cash"],
    baba: ["beads", "armchair"],
    yemin: ["candle", "handshake"],
    racon: ["handshake", "car"],
    ihbar: ["cellphone", "flashlight"],
    sanayi: ["wrench", "gear"],
    carsi: ["scaleW", "awning"],
    apartman: ["keyring", "apartment"],
    aile: ["rings", "dinner"],
    dernek: ["jersey", "scarf"],
    borc: ["ledger", "cash"],
    haber: ["newspaper", "cellphone"],
    sokak: ["map", "lamp"],
  },
};
export function thingsFor(theme, card) {
  const name = norm(card.name);
  for (const [re, things] of WORDS) if (re.test(name)) return things;
  return SERIES_THINGS[theme][seriesOf(theme, card)];
}

// Arm pose that suits what the figure holds.
const POSE = {
  sheet: "hold",
  envelope: "hold",
  ballot: "hold",
  mic: "point",
  megaphone: "point",
  camera: "hold",
  newspaper: "hold",
  screen: "hold",
  chart: "point",
  pie: "hold",
  folder: "carry",
  gavel: "stamp",
  scales: "hold",
  stamp: "stamp",
  phone: "phone",
  cellphone: "phone",
  walkie: "phone",
  coins: "hold",
  cash: "hold",
  envelopeCash: "hold",
  banner: "hold",
  clock: "hold",
  hourglass: "hold",
  padlock: "hold",
  map: "point",
  magnifier: "hold",
  table: "hold",
  tea: "carry",
  teaglass: "hold",
  teapot: "hold",
  tavla: "write",
  car: "hold",
  taxi: "hold",
  key: "hold",
  keyring: "hold",
  wrench: "hold",
  gear: "hold",
  scaleW: "write",
  ledger: "write",
  rings: "hold",
  photo: "hold",
  jersey: "hold",
  scarf: "hold",
  candle: "hold",
  beads: "hold",
  flashlight: "point",
  lamp: "hold",
};

/* ---------- cues on top ---------- */
function warning(c, r, cx, cy) {
  const pick = Math.floor(r() * 4);
  if (pick === 0) return g(tr(cx + 34, cy - 30), D.burst(16 + r() * 6, P.red));
  if (pick === 1) return g(tr(cx - 50, cy + 30), D.strike(100, P.red));
  if (pick === 2) return g(tr(cx + 30, cy - 26), D.cross(12, P.red));
  return g(tr(cx - 40, cy - 10), M.crack(80, r));
}

export function compose(theme, card) {
  Object.assign(P, PALETTES[theme]);
  const [W, H] = STAGE[theme];
  const r = seeded(`${theme}:${card.id}`);
  const side = r() > 0.5 ? "left" : "right";
  const c = { W, H, side };
  const key = seriesOf(theme, card);
  const things = thingsFor(theme, card);
  const level = Number(card.level || 0);
  const high = level >= 7;
  const mid = level >= 5;
  let body = SETTINGS[theme][key](c, r);

  if (card.kind === "unit") {
    const x = side === "left" ? 64 + r() * 22 : 176 - r() * 22;
    const scale = high ? 1.22 : mid ? 1.12 : 1.02;
    const y = H - 58 * scale + r() * 6;
    const held = things[0];
    const arm = POSE[held] || "none";
    const flip = side === "right";
    if (mid) body += M.spotlight(x, -6, 120 * scale, H + 10, P.cream, high ? 0.16 : 0.1);
    // Units of a merged / ritual kind stand as a pair.
    if (card.subtype === "fusion" || card.subtype === "ritual") {
      const partner = D.figure({
        x: x + (flip ? 44 : -44),
        y: y + 8,
        scale: scale * 0.86,
        hair: Math.floor(r() * 6),
        flip: !flip,
        jacket: P.surface,
        lit: P.muted,
      });
      body += partner.svg;
    }
    const fig = D.figure({
      x,
      y,
      scale,
      hair: Math.floor(r() * 6),
      glasses: r() > 0.72,
      cap:
        /bekci|nobet|pasa|asker|sofor|kaptan|vardiya|isci|usta|santiye/.test(norm(card.name)) ||
        r() > 0.9,
      tie: [P.red, P.steel, P.brass][Math.floor(r() * 3)],
      jacket: [P.raised, P.surface, P.wood][Math.floor(r() * 3)],
      level: Math.min(level, 8),
      flip,
      lit: P.paper,
      arm,
    });
    body += fig.svg;
    if (fig.hand && THINGS[held]) body += THINGS[held].hand(fig.hand[0], fig.hand[1], r);
    // the second thing sits on the far side of the stage, clear of the arm
    const side2 = things[1];
    if (THINGS[side2]) {
      const sx = side === "left" ? W - 40 - r() * 12 : 40 + r() * 12;
      body += THINGS[side2].big(sx, H * 0.56, r, 0.5);
    }
    if (high)
      body += `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" fill="none" stroke="${P.brass}" stroke-width="1.4" opacity=".55"/>`;
  } else {
    const cx = W / 2 + (r() - 0.5) * 24;
    const cy = H * 0.52 + (r() - 0.5) * 10;
    body += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(W * 0.34)}" ry="${f(H * 0.36)}" fill="${P.ink}" opacity=".32"/>`;
    const [a, b] = things;
    if (THINGS[b]) body += THINGS[b].big(cx + (r() > 0.5 ? 46 : -46), cy + 10, r, 0.62);
    if (THINGS[a]) body += THINGS[a].big(cx, cy, r, 1);
    if (card.kind === "trap") {
      body += `<rect width="${W}" height="${H}" fill="${P.red}" opacity=".1"/>`;
      body += warning(c, r, cx, cy);
    } else if (card.subtype === "field") {
      body += `<rect width="${W}" height="${H}" fill="${P.brass}" opacity=".05"/>`;
    } else if (card.subtype === "equip") {
      body += g(tr(cx - 30, cy - 40), D.chevrons(true, P.brass));
    } else if (card.subtype === "quick") {
      body += [0, 1, 2]
        .map(
          (i) =>
            `<path d="M${f(cx - 70)} ${f(cy - 12 + i * 12)}h${f(26 - i * 6)}" stroke="${P.cream}" stroke-width="2" opacity=".5" stroke-linecap="round"/>`,
        )
        .join("");
    } else if (card.subtype === "continuous") {
      body += g(tr(cx + 50, cy - 40), D.cycle(10));
    }
  }
  body += M.vignette(W, H, "vg", 0.6);
  // fine paper grain so flat fills print less digitally
  body += `<filter id="gr"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${Math.floor(r() * 999)}"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 .08 0"/></filter><rect width="${W}" height="${H}" filter="url(#gr)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
}

/* ---------- table backgrounds (behind a dark overlay in the duel) ---------- */
export function atmosphere(theme) {
  Object.assign(P, PALETTES[theme]);
  const W = 1600;
  const H = 900;
  const r = seeded(`${theme}:atmosphere`);
  let s = `<defs>${grad("a", theme === "veto-h" ? "#0a1410" : "#120c09", theme === "veto-h" ? "#1f3128" : "#2e1d14")}</defs><rect width="${W}" height="${H}" fill="url(#a)"/>`;
  s += g(tr(0, 560, 6.7), M.skyline(240, 0, r, theme === "veto-h" ? "#132019" : "#1c130e", 0.22));
  if (theme === "veto-h") {
    s += g(tr(0, 60, 6.7), M.bunting(240, 10, [P.red, P.cream, P.brass]));
    s += g(tr(0, 900, 6.7), M.crowd(240, 2, r, P.ink, 0.3));
  } else {
    s += M.water(560, W, 140, r).replace(/stroke-width="1"/g, 'stroke-width="3"');
    s += g(tr(1200, 560, 3), M.crane(110, 80, true));
    s += g(tr(0, 900, 6.7), `<rect y="-40" width="240" height="40" fill="#1a1411"/>`);
    s += g(tr(260, 760, 3), M.streetLamp(80)) + g(tr(1340, 760, 3), M.streetLamp(80));
  }
  s += `<rect width="${W}" height="${H}" fill="${P.ink}" opacity=".25"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${s}</svg>`;
}
