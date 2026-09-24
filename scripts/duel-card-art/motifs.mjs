// Extra drawing vocabulary for the VETO-H! and GETT-OH! card illustrations.
// Flat SVG fragments drawn only with the active palette (P from the DARBE-H!
// motif set, swapped per theme by compose.mjs). No text, no logos, no real
// people, places or party symbols: every shape is written here by hand.
import { P, g, tr } from "../darbe-h-card-art/motifs.mjs";

const f = (n) => (Math.round(n * 10) / 10).toString();
export const stroke = (c = P.ink, w = 1.6) =>
  `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

/* ---------- civic / election ---------- */
export function ballotBox(s = 1, { slip = true, seal = P.red } = {}) {
  let b = `<path d="M-26 -30H26L30 22H-30Z" fill="${P.paper}" fill-opacity=".38" ${stroke()}/>`;
  b += `<path d="M-26 -30L-30 22M26 -30L30 22" ${stroke(P.cream, 1)} opacity=".5"/>`;
  b += `<path d="M-30 -36H30V-30H-30Z" fill="${P.raised}" ${stroke()}/><path d="M-12 -34H12" ${stroke(P.ink, 2.4)}/>`;
  for (let i = 0; i < 5; i++)
    b += `<rect x="${-20 + i * 8}" y="${6 - (i % 2) * 5}" width="12" height="8" fill="${P.cream}" ${stroke(P.ink, 0.8)} transform="rotate(${-20 + i * 11} ${-14 + i * 8} ${10})"/>`;
  if (slip)
    b += `<rect x="-6" y="-52" width="12" height="18" fill="${P.cream}" ${stroke(P.ink, 1)}/>`;
  if (seal) b += `<circle cx="18" cy="-4" r="4" fill="${seal}" ${stroke(P.ink, 1)}/>`;
  return g(tr(0, 0, s), b);
}
export function booth(s = 1, open = 0.4) {
  let b = `<rect x="-24" y="-70" width="48" height="70" fill="${P.surface}" ${stroke()}/>`;
  b += `<path d="M-26 -72H26" ${stroke(P.muted, 3)}/>`;
  const w = 48 * (1 - open);
  let d = `M-24 -70`;
  for (let i = 0; i <= 6; i++)
    d += `Q${f(-24 + (w * (i + 0.5)) / 7)} ${i % 2 ? -34 : -36} ${f(-24 + (w * (i + 1)) / 7)} -70`;
  b += `<path d="M-24 -70H${f(-24 + w)}V-2H-24Z" fill="${P.red}" opacity=".85" ${stroke()}/>`;
  for (let i = 1; i < 6; i++)
    b += `<path d="M${f(-24 + (w * i) / 6)} -68V-4" ${stroke(P.ink, 1)} opacity=".45"/>`;
  return g(tr(0, 0, s), b);
}
export function lectern(s = 1, mic = true) {
  let b = `<path d="M-22 -34H22L16 26H-16Z" fill="${P.wood}" ${stroke()}/><path d="M-26 -40H26V-32H-26Z" fill="${P.raised}" ${stroke()}/>`;
  b += `<circle cy="-6" r="8" fill="none" ${stroke(P.brass, 1.6)}/>`;
  if (mic)
    b += `<path d="M6 -40Q10 -52 4 -60" fill="none" ${stroke(P.muted, 1.6)}/><rect x="0" y="-66" width="6" height="8" rx="3" fill="${P.ink}"/>`;
  return g(tr(0, 0, s), b);
}
export function banner(w = 40, h = 60, color = P.red, band = P.cream, wave = 0) {
  let b = `<path d="M0 0H${w}V${h}L${w / 2} ${h - 10}L0 ${h}Z" fill="${color}" ${stroke()}/>`;
  b += `<path d="M0 ${h * 0.3}H${w}M0 ${h * 0.3 + 6}H${w}" ${stroke(band, 2.6)} opacity=".9"/>`;
  b += `<circle cx="${w / 2}" cy="${h * 0.58}" r="${w * 0.16}" fill="none" ${stroke(band, 2.2)}/>`;
  if (wave)
    b += `<path d="M0 0Q${w / 2} ${wave} ${w} 0" fill="none" ${stroke(P.ink, 1)} opacity=".5"/>`;
  return b;
}
export function bunting(w = 240, sag = 14, colors = [P.red, P.cream, P.brass]) {
  let b = `<path d="M0 0Q${w / 2} ${sag * 2} ${w} 0" fill="none" ${stroke(P.ink, 1)}/>`;
  const n = Math.floor(w / 14);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = t * w;
    const y = 4 * sag * t * (1 - t) * 1.0;
    b += `<path d="M${f(x - 5)} ${f(y)}L${f(x + 5)} ${f(y)}L${f(x)} ${f(y + 9)}Z" fill="${colors[i % colors.length]}" opacity=".9"/>`;
  }
  return b;
}
export function crowd(w = 240, rows = 2, rng = Math.random, tone = P.ink, arms = 0.2) {
  let b = "";
  for (let r = 0; r < rows; r++) {
    const y = r * 10;
    let x = -6 + rng() * 6;
    while (x < w + 6) {
      const s = 0.8 + rng() * 0.35 + r * 0.12;
      const hx = x;
      b += `<circle cx="${f(hx)}" cy="${f(y - 10 * s)}" r="${f(5 * s)}" fill="${tone}"/>`;
      b += `<path d="M${f(hx - 9 * s)} ${f(y + 14)}Q${f(hx - 8 * s)} ${f(y - 4 * s)} ${f(hx)} ${f(y - 4 * s)}Q${f(hx + 8 * s)} ${f(y - 4 * s)} ${f(hx + 9 * s)} ${f(y + 14)}Z" fill="${tone}"/>`;
      if (rng() < arms) {
        const up = rng() > 0.5 ? 1 : -1;
        b += `<path d="M${f(hx + 5 * s * up)} ${f(y - 2)}L${f(hx + 9 * s * up)} ${f(y - 20 * s)}" stroke="${tone}" stroke-width="${f(3.4 * s)}" stroke-linecap="round"/>`;
      }
      x += 11 + rng() * 6;
    }
  }
  return b;
}
export function megaphone(s = 1) {
  return g(
    tr(0, 0, s),
    `<path d="M-14 -5L10 -14V14L-14 5Z" fill="${P.cream}" ${stroke()}/><rect x="-20" y="-6" width="7" height="12" rx="2" fill="${P.raised}" ${stroke()}/><path d="M-16 6L-12 16" ${stroke(P.ink, 3)}/>` +
      `<path d="M16 -10Q22 0 16 10M22 -16Q31 0 22 16" fill="none" ${stroke(P.brass, 1.6)} opacity=".8"/>`,
  );
}
export function tvCamera(s = 1) {
  return g(
    tr(0, 0, s),
    `<rect x="-20" y="-12" width="32" height="20" rx="3" fill="${P.raised}" ${stroke()}/><path d="M12 -8L24 -14V14L12 8Z" fill="${P.surface}" ${stroke()}/>` +
      `<circle cx="-6" cy="-2" r="4" fill="${P.red}"/><rect x="-16" y="-20" width="16" height="8" fill="${P.surface}" ${stroke(P.ink, 1.2)}/>` +
      `<path d="M-6 8L-16 40M-4 8V40M-2 8L8 40" ${stroke(P.muted, 1.8)}/>`,
  );
}
export function micCluster(s = 1, n = 4, rng = Math.random) {
  let b = "";
  for (let i = 0; i < n; i++) {
    const a = -40 + (i * 80) / Math.max(1, n - 1) + rng() * 8;
    const len = 26 + rng() * 10;
    const c = [P.red, P.steel, P.brass, P.cream][i % 4];
    b += g(
      `rotate(${f(a)})`,
      `<path d="M0 0V${f(-len)}" ${stroke(P.ink, 2.6)}/><rect x="-4" y="${f(-len - 12)}" width="8" height="12" rx="4" fill="${P.raised}" ${stroke(P.ink, 1)}/><rect x="-4.5" y="${f(-len - 2)}" width="9" height="5" fill="${c}"/>`,
    );
  }
  return g(tr(0, 0, s), b);
}
export function newspaper(w = 54, h = 38, headline = P.ink) {
  let b = `<rect width="${w}" height="${h}" fill="${P.paper}" ${stroke()}/>`;
  b += `<rect x="4" y="4" width="${w - 8}" height="7" fill="${headline}"/>`;
  b += `<rect x="4" y="14" width="${w * 0.42}" height="${h - 18}" fill="${P.muted}" opacity=".7"/>`;
  for (let y = 15; y < h - 3; y += 4)
    b += `<path d="M${f(w * 0.5)} ${y}H${w - 4}" ${stroke(P.surface, 1)} opacity=".6"/>`;
  return b;
}
export function screen(w = 60, h = 40, content = "bars", rng = Math.random) {
  let b = `<rect width="${w}" height="${h}" rx="3" fill="${P.ink}" ${stroke(P.muted, 1.4)}/><rect x="3" y="3" width="${w - 6}" height="${h - 6}" fill="${P.surface}"/>`;
  if (content === "bars")
    for (let i = 0; i < 4; i++) {
      const bh = 6 + rng() * (h - 16);
      b += `<rect x="${f(8 + i * ((w - 16) / 4))}" y="${f(h - 5 - bh)}" width="${f((w - 16) / 4 - 3)}" height="${f(bh)}" fill="${i === 3 ? P.red : P.brass}"/>`;
    }
  else if (content === "line") {
    let d = `M6 ${f(h * 0.7)}`;
    for (let i = 1; i <= 6; i++) d += `L${f(6 + (i * (w - 12)) / 6)} ${f(6 + rng() * (h - 14))}`;
    b += `<path d="${d}" fill="none" ${stroke(P.brass, 1.8)}/>`;
  } else if (content === "pie") {
    const a = 0.3 + rng() * 0.5;
    const r = Math.min(w, h) * 0.32;
    const cx = w / 2;
    const cy = h / 2;
    b += `<circle cx="${cx}" cy="${cy}" r="${f(r)}" fill="${P.steel}"/>`;
    b += `<path d="M${cx} ${cy}V${f(cy - r)}A${f(r)} ${f(r)} 0 ${a > 0.5 ? 1 : 0} 1 ${f(cx + r * Math.sin(a * Math.PI * 2))} ${f(cy - r * Math.cos(a * Math.PI * 2))}Z" fill="${P.red}"/>`;
  } else if (content === "live") {
    b += `<circle cx="10" cy="10" r="3" fill="${P.red}"/><rect x="8" y="${h - 12}" width="${w - 16}" height="5" fill="${P.brass}" opacity=".8"/>`;
    b += `<circle cx="${w / 2}" cy="${h / 2 - 2}" r="6" fill="${P.muted}"/><path d="M${w / 2 - 11} ${h - 13}Q${w / 2} ${h / 2 + 3} ${w / 2 + 11} ${h - 13}Z" fill="${P.muted}"/>`;
  } else if (content === "static") {
    for (let i = 0; i < 12; i++)
      b += `<path d="M4 ${f(5 + i * ((h - 10) / 12))}h${f(w - 8)}" ${stroke(i % 2 ? P.muted : P.steel, 1.4)} opacity="${f(0.3 + rng() * 0.6)}"/>`;
  }
  return b;
}
export function building(
  w = 70,
  h = 60,
  rng = Math.random,
  { cols = 5, rows = 4, lit = 0.4, pediment = false } = {},
) {
  let b = `<rect width="${w}" height="${h}" fill="${P.raised}" ${stroke()}/>`;
  if (pediment) b += `<path d="M-4 0L${w / 2} -16L${w + 4} 0Z" fill="${P.raised}" ${stroke()}/>`;
  const cw = w / cols;
  const rh = h / (rows + 0.6);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      b += `<rect x="${f(c * cw + cw * 0.25)}" y="${f(6 + r * rh)}" width="${f(cw * 0.5)}" height="${f(rh * 0.55)}" fill="${rng() < lit ? P.brass : P.surface}" opacity="${rng() < lit ? 0.9 : 0.8}"/>`;
  return b;
}
export function skyline(w = 240, base = 100, rng = Math.random, tone = P.surface, lit = 0.25) {
  let b = "";
  let x = -4;
  while (x < w) {
    const bw = 12 + rng() * 22;
    const bh = 14 + rng() * 38;
    b += `<rect x="${f(x)}" y="${f(base - bh)}" width="${f(bw)}" height="${f(bh + 2)}" fill="${tone}"/>`;
    for (let wy = base - bh + 4; wy < base - 4; wy += 6)
      for (let wx = x + 3; wx < x + bw - 3; wx += 5)
        if (rng() < lit)
          b += `<rect x="${f(wx)}" y="${f(wy)}" width="2" height="2.6" fill="${P.brass}" opacity=".8"/>`;
    if (rng() < 0.15)
      b += `<path d="M${f(x + bw / 2)} ${f(base - bh)}V${f(base - bh - 10)}" ${stroke(tone, 1.4)}/>`;
    x += bw + rng() * 3;
  }
  return b;
}
export function bus(s = 1, color = P.cream) {
  return g(
    tr(0, 0, s),
    `<rect x="-46" y="-26" width="92" height="30" rx="5" fill="${color}" ${stroke()}/><rect x="-42" y="-21" width="70" height="11" fill="${P.surface}"/>` +
      [0, 1, 2, 3, 4]
        .map((i) => `<path d="M${-28 + i * 14} -21V-10" ${stroke(color, 1.6)}/>`)
        .join("") +
      `<rect x="32" y="-21" width="10" height="22" fill="${P.surface}"/><path d="M-46 -4H46" ${stroke(P.red, 3)}/>` +
      `<circle cx="-28" cy="4" r="7" fill="${P.ink}"/><circle cx="28" cy="4" r="7" fill="${P.ink}"/><circle cx="-28" cy="4" r="2.5" fill="${P.muted}"/><circle cx="28" cy="4" r="2.5" fill="${P.muted}"/>`,
  );
}
export function car(s = 1, color = P.brass, { sign = false, lights = true } = {}) {
  let b = `<path d="M-40 0V-12Q-38 -16 -30 -17L-20 -28Q-16 -31 -8 -31H12Q18 -31 22 -27L30 -17Q40 -16 42 -10V0Z" fill="${color}" ${stroke()}/>`;
  b += `<path d="M-17 -18L-10 -27H0V-18ZM4 -18V-27H11Q15 -27 18 -24L23 -18Z" fill="${P.surface}"/>`;
  if (sign)
    b += `<rect x="-6" y="-37" width="14" height="6" rx="1.5" fill="${P.cream}" ${stroke(P.ink, 1)}/><path d="M-3 -34H5" ${stroke(P.ink, 1.2)}/>`;
  if (lights)
    b += `<path d="M42 -9L80 -18V4Z" fill="${P.cream}" opacity=".18"/><circle cx="40" cy="-8" r="2.4" fill="${P.cream}"/>`;
  b += `<circle cx="-24" cy="0" r="7" fill="${P.ink}"/><circle cx="24" cy="0" r="7" fill="${P.ink}"/><circle cx="-24" cy="0" r="2.6" fill="${P.muted}"/><circle cx="24" cy="0" r="2.6" fill="${P.muted}"/>`;
  return g(tr(0, 0, s), b);
}
export function tree(s = 1, tone = P.steel) {
  return g(
    tr(0, 0, s),
    `<path d="M0 0V-24" ${stroke(P.wood, 3)}/><circle cy="-34" r="14" fill="${tone}"/><circle cx="-9" cy="-26" r="9" fill="${tone}"/><circle cx="9" cy="-27" r="10" fill="${tone}"/>`,
  );
}
export function bicycle(s = 1) {
  return g(
    tr(0, 0, s),
    `<circle cx="-16" r="10" fill="none" ${stroke(P.muted, 2)}/><circle cx="16" r="10" fill="none" ${stroke(P.muted, 2)}/>` +
      `<path d="M-16 0L-4 -16H12L16 0M-4 -16L2 0H-16M12 -16L10 -22H4M-6 -20H0" fill="none" ${stroke(P.brass, 2)}/>`,
  );
}
export function pieChart(r = 18, share = 0.4) {
  const a = share * Math.PI * 2;
  return (
    `<circle r="${r}" fill="${P.steel}" ${stroke()}/>` +
    `<path d="M0 0V${-r}A${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${f(r * Math.sin(a))} ${f(-r * Math.cos(a))}Z" fill="${P.red}" ${stroke(P.ink, 1.2)}/>`
  );
}
export function handshake(s = 1) {
  return g(
    tr(0, 0, s),
    `<path d="M-44 10Q-24 6 -12 -2" fill="none" stroke="${P.ink}" stroke-width="13" stroke-linecap="round"/><path d="M-44 10Q-24 6 -12 -2" fill="none" stroke="${P.raised}" stroke-width="10" stroke-linecap="round"/>` +
      `<path d="M44 10Q24 6 12 -2" fill="none" stroke="${P.ink}" stroke-width="13" stroke-linecap="round"/><path d="M44 10Q24 6 12 -2" fill="none" stroke="${P.surface}" stroke-width="10" stroke-linecap="round"/>` +
      `<path d="M-14 -8Q0 -12 14 -4Q10 6 -2 8Q-12 6 -14 -8Z" fill="${P.paper}" ${stroke(P.ink, 1.4)}/><path d="M-6 -6Q2 -2 8 -4" fill="none" ${stroke(P.ink, 1)}/>`,
  );
}
export function spotlight(x, y, w, h, color = P.cream, o = 0.16) {
  return `<path d="M${f(x - 6)} ${f(y)}H${f(x + 6)}L${f(x + w / 2)} ${f(y + h)}H${f(x - w / 2)}Z" fill="${color}" opacity="${o}"/>`;
}

/* ---------- Istanbul night / neighbourhood ---------- */
export function teaGlass(s = 1, full = true) {
  return g(
    tr(0, 0, s),
    `<path d="M-7 -20Q-4 -12 -6 -8Q-8 -2 -5 0H5Q8 -2 6 -8Q4 -12 7 -20Z" fill="${P.cream}" fill-opacity=".35" ${stroke(P.ink, 1.2)}/>` +
      (full
        ? `<path d="M-6 -16Q-4 -11 -5.5 -8Q-7 -2 -4.5 -0.8H4.5Q7 -2 5.5 -8Q4 -11 6 -16Z" fill="${P.red}" opacity=".9"/>`
        : "") +
      `<ellipse cy="1.5" rx="10" ry="2.6" fill="${P.muted}" ${stroke(P.ink, 1)}/>`,
  );
}
export function teapot(s = 1) {
  return g(
    tr(0, 0, s),
    `<path d="M-16 0Q-20 -16 -10 -22H10Q20 -16 16 0Z" fill="${P.muted}" ${stroke()}/><path d="M16 -12Q26 -14 28 -22" fill="none" ${stroke(P.muted, 3)}/>` +
      `<path d="M-10 -22Q-14 -36 -6 -40H6Q14 -36 10 -22Z" fill="${P.steel}" ${stroke()}/><path d="M10 -32Q18 -34 18 -40" fill="none" ${stroke(P.steel, 2.4)}/><circle cy="-42" r="2.4" fill="${P.ink}"/>` +
      `<path d="M-2 -48Q-6 -56 0 -62Q6 -68 2 -76" fill="none" ${stroke(P.cream, 1.4)} opacity=".45"/>`,
  );
}
export function tray(s = 1, glasses = 3) {
  let b = `<ellipse rx="30" ry="7" fill="${P.muted}" ${stroke()}/><path d="M-22 -4Q0 -30 22 -4" fill="none" ${stroke(P.muted, 2)}/>`;
  for (let i = 0; i < glasses; i++)
    b += g(tr(-16 + i * (32 / Math.max(1, glasses - 1)), -2, 0.8), teaGlass(1));
  return g(tr(0, 0, s), b);
}
export function backgammon(s = 1, rng = Math.random) {
  let b = `<rect x="-36" y="-22" width="72" height="44" fill="${P.wood}" ${stroke()}/><path d="M0 -22V22" ${stroke(P.ink, 2)}/>`;
  for (let i = 0; i < 6; i++) {
    const x = -33 + i * 5.5;
    b += `<path d="M${f(x)} -20L${f(x + 2.7)} -4L${f(x + 5.4)} -20Z" fill="${i % 2 ? P.cream : P.red}" opacity=".85"/>`;
    b += `<path d="M${f(x)} 20L${f(x + 2.7)} 4L${f(x + 5.4)} 20Z" fill="${i % 2 ? P.red : P.cream}" opacity=".85"/>`;
    b += `<path d="M${f(x + 36)} -20L${f(x + 38.7)} -4L${f(x + 41.4)} -20Z" fill="${i % 2 ? P.cream : P.red}" opacity=".85"/>`;
    b += `<path d="M${f(x + 36)} 20L${f(x + 38.7)} 4L${f(x + 41.4)} 20Z" fill="${i % 2 ? P.red : P.cream}" opacity=".85"/>`;
  }
  for (let i = 0; i < 5; i++)
    b += `<circle cx="${f(-30 + rng() * 60)}" cy="${f(-16 + rng() * 32)}" r="3" fill="${i % 2 ? P.cream : P.ink}" ${stroke(P.ink, 0.8)}/>`;
  return g(tr(0, 0, s), b);
}
export function stool(s = 1) {
  return g(
    tr(0, 0, s),
    `<rect x="-11" y="-16" width="22" height="4" fill="${P.wood}" ${stroke()}/><path d="M-8 -12L-11 10M8 -12L11 10M-9 0H9" ${stroke(P.wood, 2)}/>`,
  );
}
export function streetLamp(h = 80, glow = true) {
  let b = `<path d="M0 0V${-h}Q0 ${-h - 8} 10 ${-h - 8}" fill="none" ${stroke(P.ink, 3)}/><path d="M6 ${-h - 10}H16L14 ${-h - 4}H8Z" fill="${P.brass}" ${stroke(P.ink, 1.2)}/>`;
  if (glow)
    b =
      `<path d="M11 ${-h - 4}L-14 0H36Z" fill="${P.brass}" opacity=".12"/><circle cx="11" cy="${-h - 5}" r="10" fill="${P.brass}" opacity=".22"/>` +
      b;
  return b;
}
export function apartment(w = 60, h = 90, rng = Math.random, lit = 0.35) {
  let b = `<rect width="${w}" height="${h}" fill="${P.raised}" ${stroke()}/>`;
  const floors = Math.floor(h / 16);
  for (let i = 0; i < floors; i++) {
    const y = 6 + i * 16;
    b += `<path d="M0 ${y + 11}H${w}" ${stroke(P.ink, 1)} opacity=".5"/>`;
    for (let c = 0; c < 3; c++) {
      const on = rng() < lit;
      b += `<rect x="${f(6 + c * ((w - 12) / 3))}" y="${y}" width="${f((w - 12) / 3 - 5)}" height="8" fill="${on ? P.brass : P.surface}" opacity="${on ? 0.9 : 1}"/>`;
    }
  }
  b += `<rect x="${w / 2 - 7}" y="${h - 16}" width="14" height="16" fill="${P.surface}" ${stroke(P.ink, 1.2)}/>`;
  return b;
}
export function awning(w = 60, color = P.red) {
  let b = `<path d="M0 0H${w}L${w + 6} 14H-6Z" fill="${color}" ${stroke()}/>`;
  for (let x = 6; x < w; x += 12)
    b += `<path d="M${x} 0L${x - 2} 14" ${stroke(P.cream, 4)} opacity=".7"/>`;
  let d = `M-6 14`;
  for (let x = -6; x < w + 6; x += 8) d += `Q${x + 4} 20 ${x + 8} 14`;
  return b + `<path d="${d}" fill="${color}" ${stroke(P.ink, 1.2)}/>`;
}
export function shutter(w = 50, h = 44, up = 0) {
  const open = h * up;
  let b = `<rect width="${w}" height="${h}" fill="${P.surface}" ${stroke()}/>`;
  b += `<rect width="${w}" height="${f(h - open)}" fill="${P.muted}" ${stroke(P.ink, 1.2)}/>`;
  for (let y = 4; y < h - open; y += 4)
    b += `<path d="M0 ${y}H${w}" ${stroke(P.ink, 0.8)} opacity=".45"/>`;
  return b;
}
export function crane(h = 110, arm = 90, flip = false) {
  const s = flip ? -1 : 1;
  let b = `<path d="M0 0V${-h}" ${stroke(P.brass, 4)}/>`;
  for (let y = 0; y > -h + 8; y -= 12)
    b += `<path d="M-4 ${y}L4 ${y - 12}M4 ${y}L-4 ${y - 12}" ${stroke(P.brass, 1)} opacity=".8"/>`;
  b += `<path d="M${-20 * s} ${-h}H${arm * s}" ${stroke(P.brass, 3)}/><path d="M0 ${-h - 12}L${arm * s} ${-h}M0 ${-h - 12}L${-20 * s} ${-h}" ${stroke(P.brass, 1)}/>`;
  b += `<path d="M${arm * 0.7 * s} ${-h}V${-h + 40}" ${stroke(P.muted, 1)}/><rect x="${f(arm * 0.7 * s - 6)}" y="${-h + 40}" width="12" height="8" fill="${P.red}" ${stroke(P.ink, 1)}/>`;
  return b;
}
export function containers(n = 3, rng = Math.random) {
  let b = "";
  const cols = [P.red, P.steel, P.brass, P.muted];
  for (let i = 0; i < n; i++) {
    const x = (i % 3) * 38;
    const y = -Math.floor(i / 3) * 16;
    b += `<rect x="${x}" y="${y - 16}" width="36" height="16" fill="${cols[Math.floor(rng() * cols.length)]}" ${stroke()}/>`;
    for (let k = 4; k < 36; k += 4)
      b += `<path d="M${x + k} ${y - 14}V${y - 2}" ${stroke(P.ink, 0.8)} opacity=".4"/>`;
  }
  return b;
}
export function ship(s = 1) {
  return g(
    tr(0, 0, s),
    `<path d="M-50 0H46L36 12H-42Z" fill="${P.surface}" ${stroke()}/><rect x="-30" y="-12" width="44" height="12" fill="${P.raised}" ${stroke()}/><rect x="-14" y="-22" width="18" height="10" fill="${P.raised}" ${stroke()}/><path d="M-4 -22V-34" ${stroke(P.ink, 2)}/>` +
      [0, 1, 2, 3]
        .map((i) => `<rect x="${-26 + i * 10}" y="-8" width="4" height="4" fill="${P.brass}"/>`)
        .join(""),
  );
}
export function water(y, w = 240, h = 60, rng = Math.random) {
  let b = `<rect x="0" y="${y}" width="${w}" height="${h}" fill="${P.surface}"/>`;
  for (let i = 0; i < 14; i++) {
    const yy = y + 4 + rng() * (h - 6);
    const xx = rng() * w;
    b += `<path d="M${f(xx)} ${f(yy)}h${f(8 + rng() * 22)}" ${stroke(P.steel, 1)} opacity="${f(0.2 + rng() * 0.4)}"/>`;
  }
  return b;
}
export function gear(r = 14, teeth = 8) {
  let d = "";
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.28;
    d += `${i ? "L" : "M"}${f(Math.cos(a) * rr)} ${f(Math.sin(a) * rr)}`;
  }
  return `<path d="${d}Z" fill="${P.muted}" ${stroke()}/><circle r="${f(r * 0.4)}" fill="${P.surface}" ${stroke(P.ink, 1.2)}/>`;
}
export function wrench(s = 1, rot = -30) {
  return g(
    tr(0, 0, s, rot),
    `<path d="M-30 -3H14V3H-30Z" fill="${P.muted}" ${stroke()}/><path d="M14 -8Q28 -10 30 0Q28 10 14 8L20 3V-3Z" fill="${P.muted}" ${stroke()}/>`,
  );
}
export function key(s = 1, rot = 0) {
  return g(
    tr(0, 0, s, rot),
    `<circle r="8" fill="none" ${stroke(P.brass, 3.4)}/><path d="M8 0H34M26 0V7M31 0V6" fill="none" ${stroke(P.brass, 3.4)}/>`,
  );
}
export function keyring(s = 1, n = 3) {
  let b = `<circle r="9" fill="none" ${stroke(P.muted, 2)}/>`;
  for (let i = 0; i < n; i++) b += g(tr(0, 9, 0.55, 60 + i * 30), key(1));
  return g(tr(0, 0, s), b);
}
export function banknotes(n = 3, w = 40, h = 20) {
  let b = "";
  for (let i = 0; i < n; i++)
    b += g(
      tr(i * 3, -i * 3, 1, -6 + i * 5),
      `<rect width="${w}" height="${h}" fill="${P.steel}" ${stroke(P.ink, 1.2)}/><circle cx="${w / 2}" cy="${h / 2}" r="${h * 0.28}" fill="none" ${stroke(P.cream, 1.2)}/><rect x="3" y="3" width="${w - 6}" height="${h - 6}" fill="none" ${stroke(P.cream, 0.8)} opacity=".6"/>`,
    );
  return b;
}
export function walkie(s = 1) {
  return g(
    tr(0, 0, s),
    `<rect x="-8" y="-16" width="16" height="30" rx="3" fill="${P.raised}" ${stroke()}/><path d="M4 -16V-30" ${stroke(P.ink, 2.6)}/><rect x="-5" y="-12" width="10" height="7" fill="${P.steel}"/>` +
      [0, 1, 2].map((i) => `<path d="M-5 ${f(-1 + i * 4)}H5" ${stroke(P.ink, 1.2)}/>`).join("") +
      `<path d="M12 -26Q18 -20 12 -14M16 -30Q26 -20 16 -10" fill="none" ${stroke(P.brass, 1.4)} opacity=".8"/>`,
  );
}
export function cellphone(s = 1, lit = true) {
  return g(
    tr(0, 0, s),
    `<rect x="-8" y="-14" width="16" height="28" rx="3" fill="${P.ink}" ${stroke(P.muted, 1.2)}/><rect x="-6" y="-11" width="12" height="20" fill="${lit ? P.steel : P.surface}"/>` +
      (lit ? `<path d="M-4 -6h8M-4 -2h6M-4 2h7" ${stroke(P.cream, 1)} opacity=".8"/>` : ""),
  );
}
export function cctv(s = 1, rot = 0) {
  return g(
    tr(0, 0, s, rot),
    `<path d="M0 0V-10H6" fill="none" ${stroke(P.muted, 2)}/><rect x="4" y="-18" width="26" height="12" rx="2" fill="${P.muted}" ${stroke()}/><circle cx="30" cy="-12" r="3.4" fill="${P.red}"/>` +
      `<path d="M32 -12L70 6V-30Z" fill="${P.cream}" opacity=".1"/>`,
  );
}
export function candle(s = 1) {
  return g(
    tr(0, 0, s),
    `<circle cy="-34" r="16" fill="${P.brass}" opacity=".18"/><rect x="-5" y="-26" width="10" height="26" fill="${P.cream}" ${stroke()}/><path d="M0 -28Q-4 -34 0 -42Q4 -34 0 -28Z" fill="${P.brass}"/>`,
  );
}
export function rings(s = 1) {
  return g(
    tr(0, 0, s),
    `<circle cx="-6" r="9" fill="none" ${stroke(P.brass, 3)}/><circle cx="6" r="9" fill="none" ${stroke(P.brass, 3)}/><path d="M-2 -18L2 -12L6 -18" fill="${P.cream}" ${stroke(P.ink, 1)}/>`,
  );
}
export function scarf(w = 80, a = P.red, b = P.brass) {
  let s = `<path d="M0 0Q${w / 2} 14 ${w} 0V12Q${w / 2} 26 0 12Z" fill="${a}" ${stroke()}/>`;
  for (let x = 10; x < w; x += 12)
    s += `<path d="M${x} ${f(2 + Math.sin((x / w) * Math.PI) * 6)}v10" ${stroke(b, 4)} opacity=".85"/>`;
  s += `<path d="M0 12l-3 8M4 13l-1 8M${w} 12l3 8M${w - 4} 13l1 8" ${stroke(a, 1.6)}/>`;
  return s;
}
export function jersey(s = 1, a = P.red, b = P.cream) {
  return g(
    tr(0, 0, s),
    `<path d="M-14 -24L-26 -16L-20 -4L-14 -8V20H14V-8L20 -4L26 -16L14 -24Q0 -16 -14 -24Z" fill="${a}" ${stroke()}/><path d="M-4 -20V20M4 -20V20" ${stroke(b, 3)} opacity=".8"/>`,
  );
}
export function dinnerTable(w = 120, rng = Math.random) {
  let b = `<path d="M0 0H${w}L${w + 14} 20H-14Z" fill="${P.cream}" ${stroke()}/><path d="M-14 20V26H${w + 14}V20" fill="${P.muted}" ${stroke()}/>`;
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * ((w - 28) / 3);
    b += `<ellipse cx="${f(x)}" cy="10" rx="9" ry="3.4" fill="${P.paper}" ${stroke(P.ink, 1)}/>`;
    if (rng() > 0.4) b += g(tr(x + 10, 9, 0.6), teaGlass(1));
  }
  return b;
}
export function ledgerBook(w = 50, h = 34, open = true) {
  if (!open)
    return `<rect width="${w}" height="${h}" fill="${P.red}" ${stroke()}/><rect x="4" y="${h / 2 - 3}" width="${w - 8}" height="6" fill="${P.brass}" opacity=".8"/>`;
  let b = `<path d="M0 2Q${w / 4} -2 ${w / 2} 2Q${(3 * w) / 4} -2 ${w} 2V${h}Q${(3 * w) / 4} ${h - 4} ${w / 2} ${h}Q${w / 4} ${h - 4} 0 ${h}Z" fill="${P.paper}" ${stroke()}/><path d="M${w / 2} 2V${h}" ${stroke(P.ink, 1)}/>`;
  for (let y = 8; y < h - 3; y += 4)
    b += `<path d="M4 ${y}H${w / 2 - 4}M${w / 2 + 4} ${y}H${w - 4}" ${stroke(P.surface, 0.9)} opacity=".6"/>`;
  b += `<path d="M${w / 2 + 6} ${h - 8}H${w - 6}" ${stroke(P.red, 1.6)}/>`;
  return b;
}
export function prayerBeads(s = 1) {
  let b = "";
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 1.6 + 0.7;
    b += `<circle cx="${f(Math.cos(a) * 12)}" cy="${f(Math.sin(a) * 16)}" r="2.6" fill="${P.brass}" ${stroke(P.ink, 0.7)}/>`;
  }
  b += `<path d="M${f(Math.cos(0.7) * 12)} ${f(Math.sin(0.7) * 16)}L6 26M6 26l-3 6M6 26l3 6" fill="none" ${stroke(P.brass, 1.6)}/>`;
  return g(tr(0, 0, s), b);
}
export function armchair(s = 1, color = P.red) {
  return g(
    tr(0, 0, s),
    `<path d="M-26 -50Q-26 -60 -16 -60H16Q26 -60 26 -50V-6H-26Z" fill="${color}" ${stroke()}/><rect x="-34" y="-24" width="12" height="24" rx="4" fill="${color}" ${stroke()}/><rect x="22" y="-24" width="12" height="24" rx="4" fill="${color}" ${stroke()}/>` +
      `<rect x="-24" y="-12" width="48" height="12" fill="${color}" ${stroke()}/><path d="M-28 0V8M28 0V8" ${stroke(P.wood, 3)}/>`,
  );
}
export function window(w = 44, h = 50, lit = true, moon = false) {
  let b = `<rect width="${w}" height="${h}" fill="${lit ? P.steel : P.surface}" ${stroke()}/>`;
  if (moon) b += `<circle cx="${w * 0.7}" cy="${h * 0.3}" r="5" fill="${P.cream}" opacity=".85"/>`;
  b += `<path d="M${w / 2} 0V${h}M0 ${h / 2}H${w}" ${stroke(P.ink, 2)}/>`;
  return b;
}
export function flashlight(x, y, angle = 20, len = 90) {
  const a = (angle * Math.PI) / 180;
  const ex = x + Math.cos(a) * len;
  const ey = y + Math.sin(a) * len;
  const nx = -Math.sin(a) * len * 0.28;
  const ny = Math.cos(a) * len * 0.28;
  return `<path d="M${f(x)} ${f(y)}L${f(ex + nx)} ${f(ey + ny)}L${f(ex - nx)} ${f(ey - ny)}Z" fill="${P.cream}" opacity=".16"/>`;
}
export function footprints(n = 4) {
  let b = "";
  for (let i = 0; i < n; i++)
    b += `<ellipse cx="${i * 14}" cy="${i % 2 ? 5 : -5}" rx="4" ry="2.4" fill="${P.muted}" opacity="${f(0.3 + i * 0.12)}"/>`;
  return b;
}
export function crack(w = 60, rng = Math.random) {
  let d = `M0 0`;
  let x = 0;
  let y = 0;
  while (x < w) {
    x += 6 + rng() * 8;
    y += (rng() - 0.5) * 14;
    d += `L${f(x)} ${f(y)}`;
  }
  return `<path d="${d}" fill="none" ${stroke(P.ink, 3)}/><path d="${d}" fill="none" ${stroke(P.red, 1.2)}/>`;
}
export function siren(s = 1) {
  return g(
    tr(0, 0, s),
    `<circle cy="-8" r="22" fill="${P.red}" opacity=".16"/><path d="M-9 0V-10Q-9 -18 0 -18Q9 -18 9 -10V0Z" fill="${P.red}" ${stroke()}/><rect x="-12" y="0" width="24" height="5" fill="${P.muted}" ${stroke()}/>`,
  );
}
export function stairs(n = 5, w = 60) {
  let d = `M0 0`;
  for (let i = 0; i < n; i++) d += `H${f((i + 1) * (w / n))}V${-(i + 1) * 8}`;
  d += `V0Z`;
  return `<path d="${d}" fill="${P.raised}" ${stroke()}/>`;
}
export function scaffold(w = 70, h = 80) {
  let b = "";
  for (let x = 0; x <= w; x += w / 3) b += `<path d="M${f(x)} 0V${-h}" ${stroke(P.muted, 2)}/>`;
  for (let y = 0; y >= -h; y -= h / 4) b += `<path d="M0 ${f(y)}H${w}" ${stroke(P.muted, 2)}/>`;
  for (let y = 0; y > -h; y -= h / 4)
    b += `<path d="M0 ${f(y)}L${f(w / 3)} ${f(y - h / 4)}" ${stroke(P.muted, 1)} opacity=".6"/>`;
  return b;
}
export function weighScale(s = 1, tilt = 0) {
  return g(
    tr(0, 0, s),
    `<rect x="-22" y="-6" width="44" height="12" fill="${P.muted}" ${stroke()}/><rect x="-18" y="-14" width="36" height="8" fill="${P.brass}" ${stroke()}/>` +
      `<circle cy="-28" r="12" fill="${P.paper}" ${stroke()}/><path d="M0 -28L${f(Math.sin(tilt) * 9)} ${f(-28 - Math.cos(tilt) * 9)}" ${stroke(P.red, 2)}/>`,
  );
}
export function envelopeCash(s = 1) {
  return g(
    tr(0, 0, s),
    `<rect x="-2" y="-12" width="34" height="16" fill="${P.steel}" ${stroke(P.ink, 1)} transform="rotate(-8)"/><rect width="40" height="26" fill="${P.paper}" ${stroke()}/><path d="M0 0L20 14L40 0" fill="none" ${stroke()}/>`,
  );
}
export function photo(w = 34, h = 26, rot = 0, rng = Math.random) {
  return g(
    tr(0, 0, 1, rot),
    `<rect width="${w}" height="${h}" fill="${P.cream}" ${stroke()}/><rect x="3" y="3" width="${w - 6}" height="${h - 9}" fill="${P.steel}"/>` +
      `<circle cx="${f(w * (0.35 + rng() * 0.3))}" cy="${f(h * 0.38)}" r="${f(h * 0.13)}" fill="${P.surface}"/><path d="M${f(w * 0.2)} ${h - 6}Q${w / 2} ${f(h * 0.45)} ${f(w * 0.8)} ${h - 6}Z" fill="${P.surface}"/>`,
  );
}
export function pin(color = P.red) {
  return `<circle r="3" fill="${color}" ${stroke(P.ink, 1)}/>`;
}
export function vignette(w, h, id = "vg", o = 0.55) {
  return `<defs><radialGradient id="${id}" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="${P.ink}" stop-opacity="0"/><stop offset="1" stop-color="${P.ink}" stop-opacity="${o}"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#${id})"/>`;
}
