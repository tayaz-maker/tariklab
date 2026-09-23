// Turns one DARBE-H! card into one illustration. The picture is read from the
// card itself, never picked at random:
//   setting  <- the card's bureau (series)
//   subject  <- Görevli: the officer's role word; Emirname/İhtar: the document
//               or object named in the title
//   modifiers<- adjectives in the title (Kırmızı, Gizli, Geç, Çift, Kopuk…)
//   event    <- the card's strongest effect (destroy, control, draw, …)
//   warning  <- İhtar cards add the failure the title names (iade, kilit…)
// A per-card seed only nudges placement so no two plates are identical.
import * as M from "./motifs.mjs";

const { P, g, tr } = M;
export const W = 240;
export const H = 160;

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

const norm = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/[âà]/g, "a")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[ıî]/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/[üû]/g, "u")
    .replace(/[“”"':]/g, "");
export const bureauOf = (card) => {
  const s = Array.isArray(card.series)
    ? card.series[0]
    : String(card.series || "")
        .split("—")
        .pop();
  return norm(s).trim();
};

/* ---------- settings (one per bureau), drawn inside box x0..x0+112 ---------- */
const SETTINGS = {
  dosya: (r, x) =>
    g(tr(x + 6, 18), M.drawers(40, 82, Math.floor(r() * 3))) +
    g(tr(x + 56, 18), M.drawers(40, 82, 3)),
  paraf: (r, x) =>
    g(tr(x + 10, 26, 1.1), M.sheet(52, 60, { lines: 4 })) +
    g(tr(x + 20, 72), M.signature(40, P.steel)) +
    g(tr(x + 88, 40), M.lamp(1.1)),
  heyet: (r, x) => g(tr(x + 56, 62, 1.05), M.roundTable(1, 7, Math.floor(r() * 7))),
  karargah: (r, x) => g(tr(x + 4, 12), M.mapBoard(104, 70, 5, r)),
  telex: (r, x) => g(tr(x + 40, 92, 1.3), M.telex(1)) + g(tr(0, 16), M.ribbon(240, P.surface)),
  muhtira: (r, x) =>
    `<rect x="${x + 4}" y="10" width="104" height="80" fill="${P.wood}" opacity=".55"/>` +
    g(tr(x + 14, 18, 1, -4), M.sheet(36, 46, { lines: 5, seal: P.red })) +
    g(tr(x + 58, 22, 1, 5), M.sheet(34, 40, { lines: 4 })) +
    `<circle cx="${x + 30}" cy="20" r="3" fill="${P.red}"/><circle cx="${x + 74}" cy="24" r="3" fill="${P.red}"/>`,
  zeyil: (r, x) =>
    g(
      tr(x + 12, 14, 1, -3),
      M.sheet(48, 64, { lines: 6 }) +
        g(tr(22, 56, 1, 4), M.sheet(40, 30, { lines: 2, fold: false })),
    ) + g(tr(x + 36, 14), M.clip()),
  brifing: (r, x) =>
    `<rect x="${x + 4}" y="10" width="104" height="66" fill="${P.paper}" opacity=".85" stroke="${P.ink}" stroke-width="1.6"/>` +
    [0, 1, 2, 3]
      .map(
        (i) =>
          `<rect x="${x + 16 + i * 22}" y="${70 - (10 + r() * 44)}" width="14" height="${60 - (70 - (10 + r() * 44)) + 10}" fill="${i === 3 ? P.red : P.steel}"/>`,
      )
      .join(""),
  kabine: (r, x) =>
    [0, 1]
      .map(
        (i) =>
          `<rect x="${x + 8 + i * 54}" y="8" width="44" height="78" fill="${P.steel}" opacity=".35" stroke="${P.ink}" stroke-width="1.6"/>` +
          [1, 2, 3, 4, 5, 6]
            .map(
              (k) =>
                `<path d="M${x + 8 + i * 54} ${8 + k * 11}h44" stroke="${P.ink}" stroke-width="1.4" opacity=".6"/>`,
            )
            .join(""),
      )
      .join(""),
  arsiv: (r, x) => g(tr(x + 4, 8), M.shelves(104, 96, 3, r)),
  tebligat: (r, x) => g(tr(x + 6, 14, 1.8), M.pigeonholes(4, 4, 0.7, r)),
  mesruiyet: (r, x) => g(tr(x + 16, 22), M.columns(4, 74)),
  ihtar: (r, x) => g(tr(x + 10, 14, 1.6), M.pigeonholes(3, 3, 0.4, r)),
};

/* ---------- Görevli: role -> pose, prop in the working hand, desk or not ---------- */
// prop(hand, r, word) draws at the hand; desk(r, x) draws on the desk in front.
const at = (h, dx, dy, s = 1, rot = 0) => tr(h[0] + dx, h[1] + dy, s, rot);
const ROLES = [
  [
    /katib/,
    { arm: "write", desk: true, deskProp: (r, x) => g(tr(x - 16, 138, 1.1), M.typewriter(1)) },
  ],
  [
    /raportor/,
    {
      arm: "hold",
      prop: (h) =>
        g(
          at(h, -6, -34, 1, -6),
          M.sheet(40, 48, { lines: 2 }) + g(tr(6, 20), M.table(3, 2, 28, 18)),
        ),
    },
  ],
  [
    /mustesar/,
    {
      arm: "phone",
      glasses: true,
      desk: true,
      prop: (h) =>
        g(
          at(h, -4, -6, 1, -30),
          `<path d="M-4 -12Q-10 -12 -10 -4V6Q-10 14 -4 14" fill="none" stroke="${P.ink}" stroke-width="6" stroke-linecap="round"/>`,
        ),
      deskProp: (r, x) =>
        g(tr(x, 132, 1.2), M.telephone(1)) +
        g(
          tr(x - 40, 146),
          `<rect width="40" height="9" fill="${P.brass}" stroke="${P.ink}" stroke-width="1.4"/>`,
        ),
    },
  ],
  [/musavir/, { arm: "point", prop: (h) => g(at(h, 6, -14), M.noise(30)) }],
  [
    /kurye/,
    {
      arm: "hold",
      prop: (h) => g(at(h, -8, -18, 1, -12), M.envelope(38, 24, { seal: P.red })),
      extra: (r, x, flip) =>
        g(tr(flip ? x + 40 : x - 80, 70), M.arrow("M0 0H34M26 -8L34 0L26 8", P.muted)) +
        g(tr(flip ? x + 30 : x - 30, 156, 1.1), M.satchel(1)),
    },
  ],
  [
    /arsivci/,
    {
      arm: "carry",
      prop: (h) => g(at(h, -24, -20), M.stack(3, 44, 12, P.brass)),
      extra: (r, x, flip) => g(tr(flip ? x - 70 : x + 50, 40), M.ladder(110)),
    },
  ],
  [
    /dizgici/,
    {
      arm: "write",
      glasses: true,
      desk: true,
      deskProp: (r, x) => g(tr(x - 20, 118, 1.3), M.typeBlocks(6, r)),
    },
  ],
  [/\beri$/, { arm: "salute", cap: true, standing: true }],
  [
    /baskan/,
    {
      arm: "stamp",
      desk: true,
      prop: (h) =>
        g(
          at(h, 0, -6, 0.9),
          g(
            tr(0, 0, 1, -30),
            `<rect x="-14" y="-8" width="28" height="14" rx="3" fill="${P.wood}" stroke="${P.ink}" stroke-width="1.6"/>`,
          ),
        ),
      deskProp: (r, x) =>
        g(
          tr(x, 144),
          `<rect x="-6" y="0" width="36" height="7" rx="2" fill="${P.wood}" stroke="${P.ink}" stroke-width="1.6"/>`,
        ),
    },
  ],
  [
    /ciragi/,
    { arm: "carry", standing: true, prop: (h) => g(at(h, -24, -26), M.stack(5, 46, 8, P.paper)) },
  ],
  [
    /ustasi/,
    {
      arm: "stamp",
      desk: true,
      prop: (h) => g(at(h, 0, 20, 1.1), M.stamp(1)),
      deskProp: (r, x) => g(tr(x - 34, 146), M.stampMark(10)),
    },
  ],
  [
    /yazman/,
    {
      arm: "write",
      desk: true,
      prop: (h) => g(at(h, 2, 0), M.pen(30, 210)),
      deskProp: (r, x) => g(tr(x - 30, 128), M.ledger(56, 30)),
    },
  ],
  [
    /sozcu/,
    {
      arm: "point",
      standing: true,
      extra: (r, x, flip) => g(tr(flip ? x - 58 : x + 58, 132, 1.5), M.microphone(1)),
    },
  ],
  [
    /nobetci/,
    { arm: "hold", cap: true, standing: true, prop: (h) => g(at(h, 2, 6, 0.9), M.lamp(1)) },
  ],
];
function deskPropForWord(word, r, x) {
  if (/fihrist/.test(word)) return g(tr(x - 30, 130), M.indexCards(3));
  if (/klasor|ciltci/.test(word)) return g(tr(x - 30, 118), M.folder(56, 40, P.steel));
  if (/cetvel|yoklama|tutanak/.test(word)) return g(tr(x - 30, 110, 1, -6), M.table(2, 5, 50, 44));
  if (/suret/.test(word)) return g(tr(x - 26, 124), M.stack(3, 40, 26, P.paper));
  if (/seritci/.test(word)) return g(tr(x - 50, 128, 1, -8), M.ribbon(90, P.brass));
  if (/dipnot/.test(word))
    return g(tr(x - 30, 112), M.sheet(44, 46, { lines: 4 })) + g(tr(x + 20, 140), M.magnifier(1.1));
  if (/protokol/.test(word))
    return (
      g(tr(x - 30, 124), M.envelope(50, 30, { seal: P.brass })) +
      g(tr(x - 38, 118), M.ribbon(66, P.red))
    );
  if (/serh/.test(word))
    return (
      g(tr(x - 26, 110), M.sheet(44, 50, { lines: 5 })) + g(tr(x - 20, 146), M.strike(40, P.red))
    );
  if (/tutucu/.test(word))
    return g(tr(x - 22, 116), M.sheet(40, 40, { lines: 3 })) + g(tr(x - 8, 110), M.clip());
  if (/evrak|taslak/.test(word))
    return (
      g(tr(x - 28, 112, 1, -5), M.sheet(44, 50, { lines: 4 })) +
      g(tr(x - 10, 118, 1, 6), M.sheet(40, 44, { lines: 3 }))
    );
  return g(tr(x - 26, 112), M.sheet(44, 50, { lines: 4 }));
}

/* ---------- Emirname / İhtar: title noun -> centre object ---------- */
const NOUNS = [
  [/telex/, (r, m) => g(tr(118, 118, 1.5), M.telex(1, { broken: m.broken }))],
  [
    /tebligat|tebli|havale|yazisma|cevabi|ust yazi|dis yazi|geri cekme|yazisi/,
    (r, m) =>
      g(tr(94, 74, 1.5, -4 + r() * 8), M.envelope(52, 34, { open: m.open, seal: m.tint || P.red })),
  ],
  [
    /brifing|defter/,
    (r, m) => g(tr(96, 30, 1.05), M.easel(1, [0.3, 0.6, 0.45, m.low ? 0.15 : 0.95])),
  ],
  [
    /imza|paraf|emir|vize/,
    (r, m) =>
      g(tr(78, 64, 1.4, -3), M.sheet(56, 46, { lines: 3, fill: m.tint })) +
      g(tr(94, 118), M.signature(46, m.dashed ? P.red : P.ink)) +
      g(tr(150, 96), M.pen(52, -30)),
  ],
  [
    /zeyil|ek |ek$|eki/,
    (r, m) =>
      g(
        tr(86, 36, 1.2, -4),
        M.sheet(48, 58, { lines: 6 }) +
          g(tr(12, 44, 1, 6), M.sheet(40, 30, { lines: 2, fold: false, fill: m.tint || P.cream })) +
          g(tr(26, 2), M.clip()),
      ),
  ],
  [/arsiv|fis/, (_r, _m) => g(tr(100, 34, 1.2), M.drawers(40, 64, 1))],
  [
    /kagit sira|sira/,
    (_r, _m) =>
      [0, 1, 2, 3]
        .map((i) =>
          g(tr(40 + i * 40, 50 + (i % 2) * 6, 1, -4 + i * 3), M.sheet(34, 46, { lines: 3 })),
        )
        .join(""),
  ],
  [
    /heyet|istisare|toplanti|gundem/,
    (r, m) => g(tr(120, 104, 1.35), M.roundTable(1, m.empty ? 0 : 6, Math.floor(r() * 6))),
  ],
  [/kabine/, (r, m) => g(tr(60, 126), M.chairs(5, 30, m.loud ? 2 : -1))],
  [
    /redaksiyon|duzeltme|yeniden|izi/,
    (_r, _m) =>
      g(tr(84, 32, 1.4, 2), M.sheet(54, 64, { lines: 6 })) +
      g(tr(88, 104), M.strike(64, P.red)) +
      g(tr(96, 86), M.strike(52, P.red)),
  ],
  [/mesruiyet/, (r, m) => g(tr(120, 104, 1.4), M.scales(1, m.doubt ? 1 : r() > 0.5 ? 0.5 : -0.5))],
  [/dosya/, (r, m) => g(tr(76, 68, 1.6, -6), M.folder(56, 40, m.tint || P.brass))],
  [
    /kase|muhur/,
    (r, m) =>
      g(tr(112, 116, 1.6), M.stamp(1, m.tint || P.red)) +
      g(tr(160, 110), M.stampMark(14, m.tint || P.red)),
  ],
  [
    /tevzi|dagitim|liste|cizelge|cetvel|sutun/,
    (r, m) => g(tr(80, 30, 1.45), M.table(m.cols || 3, 6, 56, 64)),
  ],
  [/gerekce/, (_r, _m) => g(tr(104, 18, 1.2), M.scroll(34, 110))],
  [
    /bant|serit/,
    (r, m) =>
      g(tr(56, 40, 1.4, -8), M.folder(60, 40, P.steel)) +
      g(tr(40, 76, 1, -12), M.ribbon(150, m.tint || P.red)),
  ],
  [/suret/, (r, m) => g(tr(84, 70, 1.3), M.stack(m.double ? 2 : 4, 50, 40, m.tint || P.paper))],
  [
    /protokol/,
    (_r, _m) =>
      g(tr(76, 64, 1.4), M.envelope(56, 36, { seal: P.brass })) +
      g(tr(66, 88), M.ribbon(100, P.red)),
  ],
  [/tempo|erken|gec |kisa|uzun/, (r, m) => g(tr(118, 80), M.clock(34, m.hour ?? 3, m.broken))],
  [/saha|karargah/, (r, _m) => g(tr(62, 40, 1.35), M.mapBoard(84, 54, 5, r))],
  [
    /masa/,
    (r, m) =>
      `<path d="M40 112H200L220 150H20Z" fill="${P.wood}" stroke="${P.ink}" stroke-width="1.6"/>` +
      (m.empty ? "" : g(tr(96, 96), M.stack(3, 44, 12))),
  ],
  [/kapi/, (r, m) => g(tr(102, 22, 1.5), M.door(36, 80, m.locked ? 0 : 0.5))],
  [
    /sirt/,
    (_r, _m) =>
      g(
        tr(90, 24),
        `<rect width="22" height="100" fill="${P.steel}" stroke="${P.ink}" stroke-width="1.6"/><rect x="24" width="22" height="100" fill="${P.brass}" stroke="${P.ink}" stroke-width="1.6"/><rect x="48" width="22" height="100" fill="${P.raised}" stroke="${P.ink}" stroke-width="1.6"/>`,
      ),
  ],
  [
    /kriz/,
    (_r, _m) => g(tr(80, 30, 1.4), M.table(3, 5, 56, 56)) + g(tr(160, 54), M.burst(16, P.red)),
  ],
  [
    /muzekkere|\bnot|genelge|metin|taslak|kesin|nihai|karar|bilgi|sayfa|dipnot|kagit/,
    (r, m) =>
      g(
        tr(84, 26, 1.35, -2 + r() * 4),
        M.sheet(52, 72, {
          lines: m.short ? 3 : 7,
          fill: m.tint || P.paper,
          seal: m.final ? P.red : null,
        }),
      ) +
      (m.draft
        ? g(
            tr(98, 60),
            `<path d="M0 0h40M0 8h30M0 16h36" stroke="${P.steel}" stroke-width="1.4" stroke-dasharray="3 3"/>`,
          )
        : ""),
  ],
];

/* ---------- adjectives ---------- */
function modifiers(name) {
  const n = norm(name);
  const m = {};
  if (/kirmizi/.test(n)) m.tint = P.red;
  if (/sari/.test(n)) m.tint = P.brass;
  if (/gizli|kapali/.test(n)) m.hidden = true;
  if (/acik/.test(n)) m.open = true;
  if (/erken/.test(n)) {
    m.dawn = true;
    m.hour = 6;
  }
  if (/\bgec\b|gece|gecikme/.test(n)) {
    m.night = true;
    m.hour = 11;
  }
  if (/dahili|\bic\b/.test(n)) m.inner = true;
  if (/harici|\bdis\b/.test(n)) m.outer = true;
  if (/sessiz/.test(n)) m.quiet = true;
  if (/gurultulu/.test(n)) m.loud = true;
  if (/cift|fazla/.test(n)) {
    m.double = true;
    m.cols = 2;
  }
  if (/\btek\b/.test(n)) {
    m.single = true;
    m.cols = 1;
  }
  if (/bos|yok\b|bosaldi/.test(n)) m.empty = true;
  if (/dolu/.test(n)) m.full = true;
  if (/eksik/.test(n)) m.dashed = true;
  if (/kisa/.test(n)) m.short = true;
  if (/taslak/.test(n)) m.draft = true;
  if (/kesin|nihai/.test(n)) m.final = true;
  if (/kopuk|kirigi/.test(n)) m.broken = true;
  if (/kilitli|kapali/.test(n)) m.locked = true;
  if (/iade|reddi|iptal|degil|tutmaz|uyusmaz|hatasi|yok\b/.test(n)) m.fail = true;
  if (/suphe|sanildi/.test(n)) m.doubt = true;
  if (/kaymasi/.test(n)) m.slide = true;
  if (/sizinti/.test(n)) m.leak = true;
  if (/erteleme|gecikme/.test(n)) m.wait = true;
  if (/zinciri/.test(n)) m.chain = true;
  if (/sert/.test(n)) m.harsh = true;
  if (/dusuk|dususu|dusumu/.test(n)) m.low = true;
  return m;
}

/* ---------- effects -> event cue ---------- */
const OP_PRIORITY = [
  "destroy",
  "control",
  "negate",
  "negateResponse",
  "targetOrBattleNegate",
  "cancelAttack",
  "cancelSummonToGrave",
  "skipBattle",
  "flag",
  "summon",
  "draw",
  "drawSetTrap",
  "modifier",
  "points",
  "look",
  "reveal",
  "shuffle",
  "discard",
  "token",
  "set",
  "move",
];
export function primaryOp(card) {
  const ops = [
    ...(card.effects || []).map((e) => e.op),
    ...(card.triggers || []).flatMap((t) => (t.effects || []).map((e) => e.op)),
    ...(card.costs || []).map((e) => e.op),
  ];
  for (const op of OP_PRIORITY) if (ops.includes(op)) return op;
  if (card.traits && Object.keys(card.traits).length) return "trait";
  return null;
}
function pointsSign(card) {
  const all = [...(card.effects || []), ...(card.triggers || []).flatMap((t) => t.effects || [])];
  const p = all.find((e) => e.op === "points");
  return p && Number(p.amount) < 0 ? -1 : 1;
}
function eventCue(op, card, _r) {
  switch (op) {
    case "destroy":
      return g(tr(178, 44), M.burst(20, P.red)) + g(tr(90, 60, 1, 12), M.tear(50));
    case "control":
      return g(tr(84, 0), M.strings([0, 30, 60], 44));
    case "negate":
    case "negateResponse":
    case "targetOrBattleNegate":
    case "cancelSummonToGrave":
      return g(tr(56, 132), M.strike(130, P.red));
    case "cancelAttack":
    case "skipBattle":
    case "flag":
      return g(tr(150, 118), M.barrier(70));
    case "summon":
      return g(tr(24, 26), M.door(30, 70, 0.6));
    case "draw":
    case "drawSetTrap":
      return g(
        tr(184, 56),
        [0, 1, 2]
          .map((i) =>
            g(
              tr(i * 7, i * 4, 1, -20 + i * 18),
              `<rect width="18" height="24" fill="${P.cream}" stroke="${P.ink}" stroke-width="1.2"/>`,
            ),
          )
          .join(""),
      );
    case "modifier":
      return g(tr(196, 40), M.chevrons(true)) + g(tr(196, 78), M.chevrons(false));
    case "points":
      return (
        g(tr(200, 70), M.coins(pointsSign(card) < 0 ? 1 : 4)) +
        (pointsSign(card) < 0 ? g(tr(200, 48), M.chevrons(false)) : "")
      );
    case "look":
    case "reveal":
      return g(tr(192, 50), M.eye(false));
    case "shuffle":
      return g(tr(196, 48), M.cycle(14));
    case "discard":
      return g(
        tr(184, 104),
        `<path d="M0 0H26L22 30H4Z" fill="${P.raised}" stroke="${P.ink}" stroke-width="1.6"/><path d="M-3 0H29" stroke="${P.muted}" stroke-width="2.4"/>`,
      );
    case "token":
      return g(
        tr(196, 44),
        `<circle r="10" fill="${P.brass}" stroke="${P.ink}" stroke-width="1.4"/><circle r="5" fill="none" stroke="${P.ink}" stroke-width="1.2"/>`,
      );
    case "move":
      return g(tr(170, 40), M.arrow("M0 0Q24 -18 44 6M36 0L44 6L36 12"));
    case "trait":
      return g(
        tr(200, 34),
        `<path d="M0 -10L3 -3H10L4 1L6 9L0 4L-6 9L-4 1L-10 -3H-3Z" fill="${P.brass}" stroke="${P.ink}" stroke-width="1.2"/>`,
      );
    default:
      return "";
  }
}

function modifierCues(m, _r) {
  let s = "";
  if (m.inner) s += g(tr(18, 40, 0.8), M.door(30, 64, 0));
  if (m.outer)
    s +=
      g(tr(18, 60), M.door(30, 64, 0.7)) +
      g(tr(50, 90), M.arrow("M0 0H30M22 -8L30 0L22 8", P.cream));
  if (m.night) s += g(tr(26, 24), M.moon());
  if (m.dawn) s += g(tr(28, 30), M.sun());
  if (m.hidden) s += g(tr(30, 128), M.eye(true));
  if (m.quiet)
    s += g(
      tr(30, 124),
      `<path d="M-6 -4H0L6 -10V10L0 4H-6Z" fill="${P.muted}"/>` + M.cross(7, P.red),
    );
  if (m.loud) s += g(tr(22, 110), M.noise(34));
  if (m.locked) s += g(tr(200, 118), M.padlock(1.3));
  if (m.fail) s += g(tr(196, 122), M.cross(14, P.red));
  if (m.doubt) s += g(tr(198, 116), M.question(1));
  if (m.slide)
    s += `<path d="M16 60h26M10 72h30M18 84h22" stroke="${P.muted}" stroke-width="2" opacity=".7"/>`;
  if (m.leak) s += g(tr(60, 128), M.drip());
  if (m.wait) s += g(tr(34, 118), M.hourglass(1.2));
  if (m.chain) s += g(tr(22, 138), M.chain(5));
  if (m.harsh) s += g(tr(40, 146), M.strike(160, P.red));
  return s;
}

/* ---------- plate ---------- */
const KIND_LIGHT = { unit: P.steel, spell: P.brass, trap: P.red };

export function compose(card) {
  const r = seeded(card.id);
  const kind = card.kind;
  const name = card.name?.tr || card.name;
  const n = norm(name);
  const bureau = kind === "trap" ? "ihtar" : bureauOf(card);
  const m = modifiers(name);
  const light = KIND_LIGHT[kind] || P.brass;
  const lx = 60 + r() * 120;
  const parts = [];

  // Stage: wall, lamp pool, floor/desk line. Kind colour tints the light.
  parts.push(
    `<defs><radialGradient id="l" cx="${(lx / W).toFixed(2)}" cy="0.15" r="0.8"><stop offset="0" stop-color="${P.cream}" stop-opacity="${m.night ? 0.16 : 0.34}"/><stop offset=".5" stop-color="${light}" stop-opacity=".12"/><stop offset="1" stop-color="${P.ink}" stop-opacity="0"/></radialGradient><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.surface}"/><stop offset="1" stop-color="${P.raised}"/></linearGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#w)"/>`,
    `<rect width="${W}" height="${H}" fill="url(#l)"/>`,
  );
  // Bureau setting sits behind the subject, dimmed.
  const setting = SETTINGS[bureau] || SETTINGS.dosya;

  if (kind === "unit") {
    const role = norm(name.split(" ").slice(-1)[0]);
    const spec = (ROLES.find(([re]) => re.test(role)) || [
      null,
      { arm: r() > 0.5 ? "hold" : "write", desk: true, glasses: true, generic: true },
    ])[1];
    const fusion = card.subtype === "fusion";
    const level = Math.min(Math.max(card.level || 1, 1), 8);
    // Rank sets the shot: juniors stand small in a wide room, seniors fill
    // the frame under a spotlight.
    const s = [1.02, 1.07, 1.12, 1.18, 1.24, 1.3, 1.4, 1.5][level - 1];
    const left = r() > 0.5;
    const x = left ? 58 + r() * 14 : 182 - r() * 14;
    const y = H - 62 * s + 2;
    parts.push(`<g opacity=".9">${setting(r, left ? 120 : 8)}</g>`);
    if (level >= 7)
      parts.push(
        `<path d="M${x - 30} 0H${x + 30}L${x + 70} ${H}H${x - 70}Z" fill="${P.cream}" opacity=".09"/>`,
      );
    const person = {
      x,
      y,
      scale: s,
      hair: Math.floor(r() * 6),
      glasses: !!spec.glasses || r() > 0.8,
      cap: !!spec.cap,
      tie: [P.steel, P.red, P.brass][Math.floor(r() * 3)],
      jacket: [P.raised, P.surface, P.wood, P.raised][Math.floor(r() * 4)],
      level,
      flip: !left,
      arm: spec.arm,
    };
    if (fusion)
      parts.push(
        M.figure({
          ...person,
          x: x + (left ? 40 : -40),
          y: y - 6,
          hair: (person.hair + 2) % 6,
          jacket: P.surface,
          arm: "none",
          level: 0,
          scale: s * 0.92,
        }).svg,
      );
    const fig = M.figure(person);
    parts.push(fig.svg);
    if (fusion)
      parts.push(
        `<path d="M${x - 50} ${H}Q${x + (left ? 20 : -20)} 40 ${x + (left ? 90 : -90)} ${H}" fill="none" stroke="${P.brass}" stroke-width="2.4" opacity=".8"/>`,
      );
    if (spec.desk)
      parts.push(
        `<path d="M0 ${H - 11}H${W}V${H}H0Z" fill="${P.wood}" stroke="${P.ink}" stroke-width="1.6"/><path d="M0 ${H - 11}H${W}" stroke="${P.brass}" stroke-width="1" opacity=".5"/>`,
      );
    const deskX = left ? x + 50 : x - 50;
    if (spec.deskProp) parts.push(spec.deskProp(r, deskX));
    else if (spec.generic) parts.push(deskPropForWord(role, r, deskX));
    if (spec.prop && fig.hand) parts.push(spec.prop(fig.hand, r, role));
    if (spec.extra) parts.push(spec.extra(r, x, !left));
  } else {
    parts.push(`<g opacity=".45">${setting(r, r() > 0.5 ? 124 : 4)}</g>`);
    parts.push(
      `<path d="M0 ${112 + Math.round(r() * 6)}H${W}V${H}H0Z" fill="${P.wood}" opacity=".4"/>`,
    );
    const noun = NOUNS.find(([re]) => re.test(n));
    parts.push(
      noun
        ? noun[1](r, m)
        : g(tr(90, 30, 1.3), M.sheet(52, 70, { lines: 6, fill: m.tint || P.paper })),
    );
    if (m.double && noun && !/tevzi|dagitim|liste|cizelge|cetvel|sutun|sira|suret/.test(n))
      parts.push(
        `<g transform="translate(18 -10)" opacity=".45">${noun[1](seeded(card.id + "b"), m)}</g>`,
      );
  }

  parts.push(modifierCues(m, r));
  parts.push(eventCue(primaryOp(card), card, r));

  if (kind === "trap") {
    parts.push(`<rect width="${W}" height="${H}" fill="${P.red}" opacity=".10"/>`);
    parts.push(M.hazard(0, H - 12, W, 12));
  }
  // Soft vignette keeps edges calm so the card frame reads cleanly.
  parts.push(
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="${P.ink}" stroke-width="6" opacity=".35"/>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join("")}</svg>\n`;
}
