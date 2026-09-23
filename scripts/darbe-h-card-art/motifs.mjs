// Drawing vocabulary for the DARBE-H! card illustrations. Every motif is a
// small, flat SVG fragment on a 240x160 stage, drawn only with the existing
// DARBE-H! palette so the art sits inside the game's current colour world.
export const P = {
  ink: "#121820",
  surface: "#1a2433",
  raised: "#243044",
  cream: "#e8dcc4",
  paper: "#d8dde4",
  brass: "#c4a574",
  steel: "#7a93a8",
  red: "#c17a72",
  wood: "#8a6a3a",
  muted: "#b7c0c9",
};

const f = (n) => (Math.round(n * 10) / 10).toString();
export const tr = (x, y, s = 1, r = 0) =>
  `translate(${f(x)} ${f(y)})${r ? ` rotate(${f(r)})` : ""}${s !== 1 ? ` scale(${f(s)})` : ""}`;
const stroke = (c = P.ink, w = 1.6) =>
  `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
export const g = (t, body, extra = "") => `<g transform="${t}"${extra}>${body}</g>`;

/* ---------- paper goods ---------- */
export function sheet(
  w = 40,
  h = 52,
  { fill = P.paper, lines = 5, seal = null, fold = true } = {},
) {
  let s = `<path d="M0 0H${w - (fold ? 9 : 0)}L${w} ${fold ? 9 : 0}V${h}H0Z" fill="${fill}" ${stroke()}/>`;
  if (fold) s += `<path d="M${w - 9} 0V9H${w}" fill="none" ${stroke(P.ink, 1.2)}/>`;
  for (let i = 0; i < lines; i++) {
    const y = 10 + i * ((h - 16) / Math.max(1, lines));
    const len = (w - 12) * (i === lines - 1 ? 0.55 : 0.9 - (i % 3) * 0.12);
    s += `<path d="M6 ${f(y)}h${f(len)}" ${stroke(P.surface, 1.3)} opacity=".55"/>`;
  }
  if (seal) s += `<circle cx="${w - 11}" cy="${h - 11}" r="6" fill="none" ${stroke(seal, 1.8)}/>`;
  return s;
}
export function folder(w = 56, h = 40, fill = P.brass) {
  return (
    `<path d="M0 6H${f(w * 0.35)}L${f(w * 0.42)} 0H${w}V${h}H0Z" fill="${fill}" ${stroke()}/>` +
    `<path d="M0 12H${w}" ${stroke(P.ink, 1)} opacity=".5"/>` +
    `<rect x="${f(w * 0.12)}" y="18" width="${f(w * 0.36)}" height="7" fill="${P.paper}" ${stroke(P.ink, 1)}/>`
  );
}
export function envelope(w = 52, h = 34, { open = false, seal = P.red, fill = P.paper } = {}) {
  let s = `<rect width="${w}" height="${h}" fill="${fill}" ${stroke()}/>`;
  s += open
    ? `<path d="M0 0L${w / 2} ${f(-h * 0.55)}L${w} 0" fill="${fill}" ${stroke()}/><path d="M4 ${f(h * 0.2)}h${w - 8}" ${stroke(P.surface, 1)} opacity=".5"/>`
    : `<path d="M0 0L${w / 2} ${f(h * 0.58)}L${w} 0" fill="none" ${stroke()}/>`;
  if (seal)
    s += `<circle cx="${w / 2}" cy="${f(open ? h * 0.55 : h * 0.58)}" r="5" fill="${seal}" ${stroke(P.ink, 1.2)}/>`;
  return s;
}
export function stack(n = 4, w = 44, h = 30, fill = P.paper) {
  let s = "";
  for (let i = n - 1; i >= 0; i--)
    s += `<rect x="${i * 2}" y="${-i * 4}" width="${w}" height="${h}" fill="${fill}" ${stroke(P.ink, 1.3)}/>`;
  return s;
}
export function ledger(w = 50, h = 34) {
  return (
    `<path d="M0 4Q${w / 4} 0 ${w / 2} 4Q${(3 * w) / 4} 0 ${w} 4V${h}Q${(3 * w) / 4} ${h - 4} ${w / 2} ${h}Q${w / 4} ${h - 4} 0 ${h}Z" fill="${P.paper}" ${stroke()}/>` +
    `<path d="M${w / 2} 4V${h}" ${stroke(P.ink, 1.2)}/>` +
    [10, 16, 22]
      .map(
        (y) =>
          `<path d="M5 ${y}h${w / 2 - 10}M${w / 2 + 5} ${y}h${w / 2 - 10}" ${stroke(P.surface, 1)} opacity=".5"/>`,
      )
      .join("")
  );
}
export function indexCards(n = 3) {
  let s = "";
  for (let i = 0; i < n; i++)
    s += g(
      tr(i * 10, -i * 3, 1, -8 + i * 8),
      `<rect width="30" height="20" fill="${P.cream}" ${stroke(P.ink, 1.2)}/><path d="M3 6h22" ${stroke(P.red, 1.2)}/><path d="M3 12h16" ${stroke(P.surface, 1)} opacity=".5"/>`,
    );
  return s;
}
export function table(cols = 2, rows = 4, w = 50, h = 42) {
  let s = `<rect width="${w}" height="${h}" fill="${P.paper}" ${stroke()}/>`;
  for (let c = 1; c < cols; c++)
    s += `<path d="M${f((w / cols) * c)} 0V${h}" ${stroke(P.ink, 1)}/>`;
  for (let r = 1; r < rows; r++)
    s += `<path d="M0 ${f((h / rows) * r)}H${w}" ${stroke(P.ink, 1)} opacity=".6"/>`;
  s += `<rect width="${w}" height="${f(h / rows)}" fill="${P.steel}" opacity=".45"/>`;
  return s;
}
export function scroll(w = 30, h = 60) {
  return `<rect x="0" y="4" width="${w}" height="${h - 8}" fill="${P.paper}" ${stroke()}/><rect x="-3" y="0" width="${w + 6}" height="6" rx="3" fill="${P.brass}" ${stroke(P.ink, 1.2)}/><rect x="-3" y="${h - 6}" width="${w + 6}" height="6" rx="3" fill="${P.brass}" ${stroke(P.ink, 1.2)}/>${[14, 20, 26, 32, 38, 44].map((y) => `<path d="M4 ${y}h${w - 8}" ${stroke(P.surface, 1)} opacity=".5"/>`).join("")}`;
}
export function clip() {
  return `<path d="M0 0V-10a4 4 0 0 1 8 0V6a2.5 2.5 0 0 1-5 0V-6" fill="none" ${stroke(P.muted, 1.6)}/>`;
}
export function ribbon(w = 70, color = P.red) {
  return `<path d="M0 0H${w}L${w - 6} 5L${w} 10H0L6 5Z" fill="${color}" ${stroke(P.ink, 1.2)}/>`;
}
export function signature(w = 40, color = P.ink) {
  return `<path d="M0 6c6-10 8 8 14-2s6 6 10 0 6-6 8 2 4-4 ${w - 32} -2" fill="none" ${stroke(color, 1.6)}/>`;
}

/* ---------- desk objects ---------- */
export function typewriter(s = 1) {
  return g(
    tr(0, 0, s),
    `<rect x="-6" y="-26" width="44" height="22" fill="${P.paper}" ${stroke()}/>` +
      `<path d="M-2 -20h36M-2 -14h26" ${stroke(P.surface, 1)} opacity=".5"/>` +
      `<rect x="-14" y="-6" width="60" height="8" rx="3" fill="${P.raised}" ${stroke()}/>` +
      `<path d="M-18 2H50L56 22H-24Z" fill="${P.surface}" ${stroke()}/>` +
      Array.from(
        { length: 8 },
        (_, i) =>
          `<circle cx="${-12 + i * 8.5}" cy="10" r="2.6" fill="${P.cream}" ${stroke(P.ink, 1)}/><circle cx="${-8 + i * 8}" cy="16" r="2.6" fill="${P.cream}" ${stroke(P.ink, 1)}/>`,
      ).join(""),
  );
}
export function telephone(s = 1) {
  return g(
    tr(0, 0, s),
    `<path d="M-20 14L-14 -2H14L20 14Z" fill="${P.ink}" ${stroke(P.muted, 1.2)}/>` +
      `<circle cx="0" cy="5" r="6" fill="${P.raised}" ${stroke(P.muted, 1)}/>` +
      `<path d="M-22 -6Q-24 -14 -14 -14H14Q24 -14 22 -6L16 -4Q14 -9 0 -9Q-14 -9 -16 -4Z" fill="${P.ink}" ${stroke(P.muted, 1.2)}/>` +
      `<path d="M20 12Q34 18 30 30" fill="none" ${stroke(P.muted, 1.2)}/>`,
  );
}
export function telex(s = 1, { broken = false } = {}) {
  const tape = broken
    ? `<path d="M10 -18Q16 -40 30 -44L34 -40" fill="none" ${stroke(P.paper, 5)}/><path d="M40 -46Q52 -50 60 -44" fill="none" ${stroke(P.paper, 5)}/>`
    : `<path d="M10 -18Q16 -40 34 -44T64 -34" fill="none" ${stroke(P.paper, 5)}/>`;
  return g(
    tr(0, 0, s),
    `<rect x="-24" y="-18" width="52" height="30" rx="3" fill="${P.raised}" ${stroke()}/>` +
      `<rect x="-18" y="-12" width="22" height="10" fill="${P.ink}"/>` +
      `<circle cx="16" cy="-4" r="5" fill="${P.brass}" ${stroke(P.ink, 1.2)}/>` +
      tape +
      Array.from(
        { length: 6 },
        (_, i) =>
          `<circle cx="${16 + i * 7}" cy="${-38 + Math.sin(i) * 3}" r="1" fill="${P.ink}"/>`,
      ).join(""),
  );
}
export function stamp(s = 1, color = P.red) {
  return g(
    tr(0, 0, s),
    `<ellipse cx="0" cy="-26" rx="7" ry="6" fill="${P.wood}" ${stroke()}/><rect x="-3" y="-21" width="6" height="12" fill="${P.wood}" ${stroke()}/>` +
      `<rect x="-14" y="-10" width="28" height="8" rx="2" fill="${P.raised}" ${stroke()}/><rect x="-15" y="-2" width="30" height="4" fill="${color}" ${stroke(P.ink, 1)}/>`,
  );
}
export function stampMark(r = 16, color = P.red, rot = -12) {
  return g(
    tr(0, 0, 1, rot),
    `<circle r="${r}" fill="none" ${stroke(color, 2.4)}/><circle r="${r - 5}" fill="none" ${stroke(color, 1.2)}/><path d="M${-r + 7} 0h${2 * r - 14}M${-r + 9} -5h${2 * r - 18}M${-r + 9} 5h${2 * r - 18}" ${stroke(color, 1.6)}/>`,
    ` opacity=".9"`,
  );
}
export function pen(len = 46, rot = -35) {
  return g(
    tr(0, 0, 1, rot),
    `<rect x="0" y="-3" width="${len}" height="6" rx="3" fill="${P.ink}" ${stroke(P.brass, 1.2)}/><path d="M0 -3L-9 0L0 3Z" fill="${P.brass}" ${stroke(P.ink, 1)}/><rect x="${len - 10}" y="-3" width="3" height="6" fill="${P.brass}"/>`,
  );
}
export function gavel(s = 1) {
  return g(
    tr(0, 0, s),
    g(
      tr(0, 0, 1, -30),
      `<rect x="-14" y="-8" width="28" height="14" rx="3" fill="${P.wood}" ${stroke()}/><rect x="-2" y="6" width="4" height="30" fill="${P.wood}" ${stroke()}/>`,
    ) + `<rect x="-6" y="30" width="36" height="7" rx="2" fill="${P.wood}" ${stroke()}/>`,
  );
}
export function scales(s = 1, tilt = 0) {
  const a = tilt * 7;
  return g(
    tr(0, 0, s),
    `<path d="M0 -40V20M-14 20h28" ${stroke(P.brass, 2.4)}/>` +
      g(tr(0, -36, 1, tilt * 8), `<path d="M-30 0H30" ${stroke(P.brass, 2.4)}/>`) +
      `<path d="M${-30} ${-36 + a}l-9 20h18z" fill="${P.brass}" opacity=".85" ${stroke(P.ink, 1.2)}/><path d="M30 ${-36 - a}l-9 20h18z" fill="${P.brass}" opacity=".85" ${stroke(P.ink, 1.2)}/>`,
  );
}
export function easel(s = 1, bars = [0.4, 0.7, 0.55, 0.9]) {
  const chart = bars
    .map(
      (b, i) =>
        `<rect x="${6 + i * 11}" y="${f(38 - b * 30)}" width="7" height="${f(b * 30)}" fill="${i === bars.length - 1 ? P.red : P.steel}"/>`,
    )
    .join("");
  return g(
    tr(0, 0, s),
    `<path d="M8 44L-4 90M44 44L56 90M26 44V88" ${stroke(P.wood, 3)}/><rect x="0" y="0" width="52" height="44" fill="${P.paper}" ${stroke()}/>${chart}<path d="M4 40h44" ${stroke(P.ink, 1)}/>`,
  );
}
export function roundTable(s = 1, seats = 6, lit = -1) {
  let chairs = "";
  for (let i = 0; i < seats; i++) {
    const t = (i / seats) * Math.PI * 2;
    chairs += `<circle cx="${f(Math.cos(t) * 42)}" cy="${f(Math.sin(t) * 22)}" r="6.5" fill="${i === lit ? P.brass : P.raised}" ${stroke(P.ink, 1.2)}/>`;
  }
  return g(
    tr(0, 0, s),
    chairs +
      `<ellipse rx="34" ry="16" fill="${P.wood}" ${stroke()}/><ellipse rx="26" ry="11" fill="none" ${stroke(P.brass, 1)} opacity=".6"/>`,
  );
}
export function chairs(n = 5, gap = 26, lit = -1) {
  let s = "";
  for (let i = 0; i < n; i++)
    s += g(
      tr(i * gap, 0),
      `<path d="M0 0Q0 -30 10 -34Q20 -30 20 0Z" fill="${i === lit ? P.brass : P.raised}" ${stroke()}/><rect x="-2" y="0" width="24" height="6" fill="${P.surface}" ${stroke()}/>`,
    );
  return s;
}
export function shelves(w = 70, h = 70, rows = 3, rng = Math.random) {
  let s = `<rect width="${w}" height="${h}" fill="${P.surface}" ${stroke()}/>`;
  for (let r = 0; r < rows; r++) {
    const y = ((r + 1) * h) / rows;
    s += `<path d="M0 ${f(y)}H${w}" ${stroke(P.wood, 2.4)}/>`;
    let x = 4;
    while (x < w - 10) {
      const bw = 7 + Math.floor(rng() * 8);
      const bh = h / rows - 5 - Math.floor(rng() * 6);
      s += `<rect x="${x}" y="${f(y - bh)}" width="${bw}" height="${f(bh)}" fill="${rng() > 0.7 ? P.brass : rng() > 0.4 ? P.paper : P.steel}" ${stroke(P.ink, 1)} opacity=".9"/>`;
      x += bw + 2;
    }
  }
  return s;
}
export function drawers(w = 40, h = 64, open = 1) {
  let s = `<rect width="${w}" height="${h}" fill="${P.raised}" ${stroke()}/>`;
  for (let i = 0; i < 3; i++) {
    const y = 4 + i * ((h - 8) / 3);
    const dh = (h - 8) / 3 - 3;
    if (i === open)
      s += `<rect x="-6" y="${f(y)}" width="${w + 12}" height="${f(dh)}" fill="${P.surface}" ${stroke()}/><path d="M-2 ${f(y + 3)}h${w + 4}" ${stroke(P.paper, 3)}/>`;
    else
      s += `<rect x="4" y="${f(y)}" width="${w - 8}" height="${f(dh)}" fill="${P.surface}" ${stroke(P.ink, 1.2)}/><rect x="${w / 2 - 5}" y="${f(y + dh / 2 - 1.5)}" width="10" height="3" fill="${P.brass}"/>`;
  }
  return s;
}
export function mapBoard(w = 80, h = 52, pins = 4, rng = Math.random) {
  let s = `<rect width="${w}" height="${h}" fill="${P.paper}" ${stroke()}/>`;
  s += `<path d="M8 ${h * 0.6}Q${w * 0.3} ${h * 0.2} ${w * 0.55} ${h * 0.45}T${w - 8} ${h * 0.3}" fill="none" ${stroke(P.steel, 1.6)}/>`;
  s += `<path d="M${w * 0.2} 6Q${w * 0.35} ${h * 0.5} ${w * 0.25} ${h - 6}" fill="none" ${stroke(P.steel, 1.2)} opacity=".6"/>`;
  const pts = [];
  for (let i = 0; i < pins; i++) {
    const x = 10 + rng() * (w - 20);
    const y = 8 + rng() * (h - 16);
    pts.push([x, y]);
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="${i === 0 ? P.red : P.brass}" ${stroke(P.ink, 1)}/>`;
  }
  if (pts.length > 1)
    s += `<path d="M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}" fill="none" ${stroke(P.red, 1)} stroke-dasharray="3 2"/>`;
  return s;
}
export function pigeonholes(cols = 4, rows = 3, fillRate = 0.6, rng = Math.random) {
  let s = `<rect width="${cols * 14}" height="${rows * 12}" fill="${P.wood}" ${stroke()}/>`;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      s += `<rect x="${c * 14 + 2}" y="${r * 12 + 2}" width="10" height="8" fill="${P.ink}"/>`;
      if (rng() < fillRate)
        s += `<rect x="${c * 14 + 3}" y="${r * 12 + 4}" width="8" height="6" fill="${rng() > 0.8 ? P.red : P.paper}"/>`;
    }
  return s;
}
export function columns(n = 4, h = 70) {
  let s = `<path d="M-6 0H${n * 22 - 4}L${n * 11 - 5} -18Z" fill="${P.surface}" ${stroke()}/>`;
  for (let i = 0; i < n; i++)
    s += `<rect x="${i * 22}" y="2" width="10" height="${h}" fill="${P.raised}" ${stroke()}/>`;
  return (
    s +
    `<rect x="-6" y="${h + 2}" width="${n * 22 + 2}" height="6" fill="${P.surface}" ${stroke()}/>`
  );
}
export function clock(r = 16, hour = 3, cracked = false) {
  const a = (hour / 12) * Math.PI * 2 - Math.PI / 2;
  return (
    `<circle r="${r}" fill="${P.paper}" ${stroke()}/>` +
    Array.from({ length: 12 }, (_, i) => {
      const t = (i / 12) * Math.PI * 2;
      return `<path d="M${f(Math.cos(t) * (r - 2))} ${f(Math.sin(t) * (r - 2))}L${f(Math.cos(t) * (r - 5))} ${f(Math.sin(t) * (r - 5))}" ${stroke(P.ink, 1)}/>`;
    }).join("") +
    `<path d="M0 0L${f(Math.cos(a) * r * 0.5)} ${f(Math.sin(a) * r * 0.5)}M0 0L0 ${f(-r * 0.75)}" ${stroke(P.ink, 1.8)}/>` +
    (cracked
      ? `<path d="M${-r * 0.8} ${-r * 0.3}l6 4-3 5 7 3" fill="none" ${stroke(P.red, 1.4)}/>`
      : "")
  );
}
export function hourglass(s = 1) {
  return g(
    tr(0, 0, s),
    `<path d="M-10 -16H10M-10 16H10" ${stroke(P.wood, 3)}/><path d="M-8 -14Q-8 -2 0 0Q-8 2 -8 14H8Q8 2 0 0Q8 -2 8 -14Z" fill="${P.paper}" opacity=".85" ${stroke(P.ink, 1.2)}/><path d="M-5 12H5L0 4Z" fill="${P.brass}"/>`,
  );
}
export function padlock(s = 1) {
  return g(
    tr(0, 0, s),
    `<path d="M-8 0V-8a8 8 0 0 1 16 0V0" fill="none" ${stroke(P.muted, 3)}/><rect x="-12" y="0" width="24" height="18" rx="3" fill="${P.brass}" ${stroke()}/><circle cy="8" r="2.5" fill="${P.ink}"/>`,
  );
}
export function door(w = 36, h = 70, open = 0.0) {
  let s = `<rect width="${w}" height="${h}" fill="${open > 0 ? P.cream : P.surface}" ${stroke()}/>`;
  if (open > 0)
    s += `<rect width="${w}" height="${h}" fill="${P.cream}" opacity=".5"/><path d="M0 0L${f(w * (1 - open))} 6V${h - 6}L0 ${h}Z" fill="${P.raised}" ${stroke()}/>`;
  else
    s += `<rect x="5" y="6" width="${w - 10}" height="${h / 2 - 10}" fill="none" ${stroke(P.ink, 1)}/><circle cx="${w - 7}" cy="${h / 2 + 4}" r="2" fill="${P.brass}"/>`;
  return s;
}
export function magnifier(s = 1) {
  return g(
    tr(0, 0, s),
    `<circle r="12" fill="${P.paper}" fill-opacity=".25" ${stroke(P.brass, 3)}/><path d="M9 9L22 22" ${stroke(P.wood, 5)}/>`,
  );
}
export function microphone(s = 1) {
  return g(
    tr(0, 0, s),
    `<rect x="-6" y="-22" width="12" height="20" rx="6" fill="${P.raised}" ${stroke(P.muted, 1.4)}/><path d="M0 -2V20M-10 20H10" ${stroke(P.muted, 2)}/>`,
  );
}
export function lamp(s = 1) {
  return g(
    tr(0, 0, s),
    `<path d="M-10 26H10M0 26L4 4L18 -8" fill="none" ${stroke(P.brass, 2.4)}/><path d="M10 -18L30 -4L18 4Z" fill="${P.brass}" ${stroke()}/>`,
  );
}
export function satchel(s = 1) {
  return g(
    tr(0, 0, s),
    `<path d="M-14 -18Q0 -34 14 -18" fill="none" ${stroke(P.wood, 3)}/><rect x="-18" y="-18" width="36" height="26" rx="4" fill="${P.wood}" ${stroke()}/><path d="M-18 -10H18V-4H-18Z" fill="${P.brass}" opacity=".7"/>`,
  );
}
export function typeBlocks(n = 6, rng = Math.random) {
  let s = "";
  for (let i = 0; i < n; i++)
    s += `<rect x="${(i % 3) * 11}" y="${Math.floor(i / 3) * 11}" width="9" height="9" fill="${rng() > 0.5 ? P.muted : P.brass}" ${stroke(P.ink, 1)}/><path d="M${(i % 3) * 11 + 3} ${Math.floor(i / 3) * 11 + 3}h3v3" fill="none" ${stroke(P.ink, 1)}/>`;
  return s;
}
export function ladder(h = 80) {
  let s = `<path d="M0 0L-8 ${h}M18 0L26 ${h}" ${stroke(P.wood, 3)}/>`;
  for (let y = 10; y < h; y += 14)
    s += `<path d="M${-y / 10} ${y}H${18 + y / 10}" ${stroke(P.wood, 2.4)}/>`;
  return s;
}
export function coins(n = 3) {
  let s = "";
  for (let i = 0; i < n; i++)
    s += `<ellipse cx="0" cy="${-i * 4}" rx="10" ry="4" fill="${P.brass}" ${stroke(P.ink, 1.2)}/>`;
  return s;
}

/* ---------- the people ---------- */
// Stylised, featureless busts: lit from the lamp side, never portraits of
// anyone. Hair, headwear and eyewear vary deterministically per card.
const ARMS = {
  none: null,
  salute: [
    [26, 24],
    [42, 2],
    [14, -16],
  ],
  phone: [
    [26, 24],
    [36, 6],
    [15, -6],
  ],
  point: [
    [26, 24],
    [50, 4],
    [66, -20],
  ],
  hold: [
    [26, 24],
    [46, 36],
    [58, 16],
  ],
  carry: [
    [26, 24],
    [36, 40],
    [14, 34],
  ],
  write: [
    [26, 24],
    [46, 40],
    [58, 40],
  ],
  stamp: [
    [26, 24],
    [54, 6],
    [62, 24],
  ],
};
// Stylised, featureless figures: lit from the lamp side, never portraits of
// anyone. Hair, headwear, eyewear and the working arm vary with the card.
// Returns the drawing and where the working hand ends up on the stage.
export function figure({
  x = 0,
  y = 0,
  scale = 1,
  hair = 0,
  glasses = false,
  cap = false,
  tie = P.steel,
  jacket = P.raised,
  level = 0,
  flip = false,
  lit = P.paper,
  arm = "none",
} = {}) {
  const hairs = [
    `<path d="M-15 -4Q-16 -22 0 -22Q16 -22 15 -4Q12 -14 0 -14Q-12 -14 -15 -4Z" fill="${P.ink}"/>`,
    `<path d="M-16 -2Q-18 -24 2 -23Q17 -21 15 -6L6 -15Q-6 -12 -16 -2Z" fill="${P.ink}"/>`,
    `<path d="M-15 -4Q-16 -22 0 -22Q16 -22 15 -4Q12 -14 0 -14Q-12 -14 -15 -4Z" fill="${P.ink}"/><circle cx="0" cy="-24" r="6" fill="${P.ink}"/>`,
    `<path d="M-14 -8Q-12 -21 0 -21Q12 -21 14 -8Q8 -16 0 -16Q-8 -16 -14 -8Z" fill="${P.muted}"/>`,
    `<path d="M-16 8Q-19 -24 0 -23Q19 -24 16 8Q14 -12 0 -13Q-14 -12 -16 8Z" fill="${P.ink}"/>`,
    "",
  ];
  let head = `<ellipse cx="0" cy="-6" rx="14" ry="17" fill="${lit}" ${stroke()}/>`;
  head += `<path d="M2 -22Q16 -18 14 -4Q12 10 0 11Q10 -2 2 -22Z" fill="${P.ink}" opacity=".35"/>`;
  head += hairs[hair % hairs.length];
  if (glasses)
    head += `<circle cx="-5" cy="-5" r="4" fill="none" ${stroke(P.ink, 1.4)}/><circle cx="6" cy="-5" r="4" fill="none" ${stroke(P.ink, 1.4)}/><path d="M-1 -5h3" ${stroke(P.ink, 1.2)}/>`;
  if (cap)
    head += `<path d="M-16 -14Q0 -30 16 -14Z" fill="${P.raised}" ${stroke()}/><path d="M-18 -13H14Q20 -12 22 -9H-18Z" fill="${P.ink}"/>`;
  let body = `<path d="M-42 64C-40 30 -24 18 0 18C24 18 40 30 42 64Z" fill="${jacket}" ${stroke()}/>`;
  body += `<path d="M-9 18L0 38L9 18Z" fill="${P.paper}" ${stroke(P.ink, 1.2)}/><path d="M-3 22L0 44L3 22Z" fill="${tie}"/>`;
  body += `<path d="M-9 18L-16 40M9 18L16 40" ${stroke(P.ink, 1.2)} opacity=".6"/>`;
  for (let i = 0; i < Math.min(level, 8); i++)
    body += `<rect x="${-34 + (i % 4) * 5}" y="${f(34 + Math.floor(i / 4) * 5)}" width="3.4" height="3.4" fill="${P.brass}"/>`;
  const pts = ARMS[arm];
  let armSvg = "";
  let hand = null;
  if (pts) {
    const d = `M${pts[0][0]} ${pts[0][1]}Q${pts[1][0]} ${pts[1][1]} ${pts[2][0]} ${pts[2][1]}`;
    armSvg = `<path d="${d}" fill="none" stroke="${P.ink}" stroke-width="12" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${jacket}" stroke-width="9" stroke-linecap="round"/><circle cx="${pts[2][0]}" cy="${pts[2][1]}" r="5" fill="${lit}" ${stroke(P.ink, 1.2)}/>`;
    hand = [x + (flip ? -1 : 1) * pts[2][0] * scale, y + pts[2][1] * scale];
  }
  const inner = arm === "salute" || arm === "phone" ? body + head + armSvg : body + armSvg + head;
  const svg = g(`${tr(x, y, scale)}${flip ? " scale(-1 1)" : ""}`, inner);
  return { svg, hand };
}

/* ---------- effect cues ---------- */
export function burst(r = 18, color = P.red) {
  let d = "";
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? "L" : "M"}${f(Math.cos(t) * rr)} ${f(Math.sin(t) * rr)}`;
  }
  return `<path d="${d}Z" fill="${color}" opacity=".85" ${stroke(P.ink, 1.2)}/>`;
}
export function tear(w = 60) {
  return `<path d="M0 0l8 6-5 6 9 5-6 7 10 6" transform="scale(${f(w / 40)} 1)" fill="none" ${stroke(P.ink, 2.6)}/><path d="M0 0l8 6-5 6 9 5-6 7 10 6" transform="scale(${f(w / 40)} 1)" fill="none" ${stroke(P.red, 1.2)}/>`;
}
export function strike(w = 80, color = P.red) {
  return `<path d="M0 0L${w} ${-w * 0.45}" ${stroke(color, 5)} opacity=".85"/><path d="M0 0L${w} ${-w * 0.45}" ${stroke(P.ink, 1)} opacity=".6"/>`;
}
export function cross(r = 14, color = P.red) {
  return `<path d="M${-r} ${-r}L${r} ${r}M${r} ${-r}L${-r} ${r}" ${stroke(color, 4.5)}/>`;
}
export function question(s = 1, color = P.brass) {
  return g(
    tr(0, 0, s),
    `<path d="M-8 -10Q-8 -22 2 -22Q12 -22 12 -12Q12 -4 2 0V8" fill="none" ${stroke(color, 4.5)}/><circle cx="2" cy="17" r="3" fill="${color}"/>`,
  );
}
export function strings(xs = [0, 20, 40], len = 40) {
  return (
    xs.map((x) => `<path d="M${x} 0V${len}" ${stroke(P.muted, 1)} opacity=".8"/>`).join("") +
    `<rect x="${xs[0] - 8}" y="-6" width="${xs[xs.length - 1] - xs[0] + 16}" height="6" fill="${P.wood}" ${stroke()}/>`
  );
}
export function arrow(d = "M0 0Q30 -30 60 0", color = P.brass) {
  return `<path d="${d}" fill="none" ${stroke(color, 2.6)}/>`;
}
export function chevrons(up = true, color = up ? P.cream : P.red) {
  const d = up ? "M0 8L8 0L16 8" : "M0 0L8 8L16 0";
  return `<path d="${d}" fill="none" ${stroke(color, 3)}/><path d="${d}" transform="translate(0 ${up ? 9 : -9})" fill="none" ${stroke(color, 3)} opacity=".6"/>`;
}
export function cycle(r = 12) {
  return `<path d="M${r} 0A${r} ${r} 0 1 1 ${f(r * 0.3)} ${f(-r * 0.95)}" fill="none" ${stroke(P.brass, 2.6)}/><path d="M${f(r * 0.3 - 2)} ${f(-r * 0.95 - 6)}l6 5-7 3" fill="none" ${stroke(P.brass, 2.6)}/>`;
}
export function barrier(w = 60) {
  let s = `<rect width="${w}" height="8" fill="${P.paper}" ${stroke()}/>`;
  for (let x = 4; x < w; x += 12) s += `<path d="M${x} 8L${x + 6} 0" ${stroke(P.red, 4)}/>`;
  return s + `<path d="M4 8V26M${w - 4} 8V26" ${stroke(P.muted, 2.4)}/>`;
}
export function eye(closed = false) {
  return closed
    ? `<path d="M-12 0Q0 8 12 0" fill="none" ${stroke(P.cream, 2)}/><path d="M-12 -8L12 8" ${stroke(P.red, 2)}/>`
    : `<path d="M-12 0Q0 -10 12 0Q0 10 -12 0Z" fill="${P.paper}" ${stroke()}/><circle r="4" fill="${P.ink}"/>`;
}
export function noise(w = 30) {
  return [0, 6, 12]
    .map(
      (y) =>
        `<path d="M0 ${y}l5 -4 5 4 5 -4 5 4 5 -4" transform="scale(${f(w / 30)} 1)" fill="none" ${stroke(P.cream, 1.4)} opacity="${1 - y / 20}"/>`,
    )
    .join("");
}
export function drip() {
  return `<path d="M0 0Q-5 8 0 12Q5 8 0 0Z" fill="${P.steel}" ${stroke(P.ink, 1)}/><path d="M8 6Q4 12 8 15Q12 12 8 6Z" fill="${P.steel}" opacity=".7"/>`;
}
export function chain(n = 4) {
  return Array.from(
    { length: n },
    (_, i) =>
      `<ellipse cx="${i * 11}" cy="0" rx="7" ry="4.5" fill="none" ${stroke(i % 2 ? P.muted : P.brass, 2.4)}/>`,
  ).join("");
}
export function hazard(x, y, w, h) {
  let s = `<clipPath id="hz"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#hz)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.ink}"/>`;
  for (let i = -h; i < w; i += 10)
    s += `<path d="M${x + i} ${y + h}L${x + i + h} ${y}" stroke="${P.red}" stroke-width="4"/>`;
  return s + `</g>`;
}
export function moon() {
  return `<path d="M0 -10A10 10 0 1 0 8 6A8 8 0 1 1 0 -10Z" fill="${P.cream}" opacity=".85"/>`;
}
export function sun() {
  return `<circle r="11" fill="${P.brass}" opacity=".7"/>`;
}
