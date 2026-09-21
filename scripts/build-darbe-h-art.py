#!/usr/bin/env python3
"""DARBE-H! institutional crisis-archive SVG faces.

Series-first documentary collage, not a recolored geometric template.
IDs, stats and text come from source-cards.json and are never invented.
Illustrative / editorial only — no fake historical photographs.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/games/darbe-h/source-cards.json"
OUT_SVG = ROOT / "public/games/darbe-h/assets/cards"
MANIFEST = ROOT / "public/games/darbe-h/assets/art-manifest.json"

CREAM = "#e6d5b4"
PAPER = "#efe4c6"
IVORY = "#f3ead4"
INK = "#2a2218"
NAVY = "#161d28"
OX = "#7a2e28"
BRASS = "#c4a574"
CHAR = "#221e1a"
GREEN = "#3d5344"

SERIES_INK = {
    "Dosya": "#3d5a73",
    "Paraf": "#4e6a45",
    "Heyet": "#5a4460",
    "Karargah": "#3e4a58",
    "Telex": "#8a6a3a",
    "Muhtira": "#7a3d3d",
    "Zeyil": "#3d6a6a",
    "Brifing": "#3d5e7a",
    "Kabine": "#5a4a3a",
    "Arsiv": "#4a5a4a",
    "Tebligat": "#6a5a32",
    "Mesruiyet": "#3a4a6a",
    "İhtar": "#8a4a32",
    "Ihtar": "#8a4a32",
}

KIND_LABEL = {"unit": "GÖREVLİ", "spell": "EMİRNAME", "trap": "İHTAR"}


def series_key(raw: str) -> str:
    if not raw:
        return "Dosya"
    if "—" in raw:
        return raw.split("—")[-1].strip()
    return raw.strip()


def esc(s: str) -> str:
    amp = chr(38)
    table = {"&": amp + "amp;", "<": amp + "lt;", ">": amp + "gt;", '"': amp + "quot;"}
    return "".join(table.get(ch, ch) for ch in str(s))


def bits(card_id: str) -> list[int]:
    return list(hashlib.sha256(card_id.encode()).digest())


def rot_g(x, y, w, h, deg, inner: str) -> str:
    cx, cy = x + w / 2, y + h / 2
    return f'<g transform="rotate({deg:.1f} {cx:.1f} {cy:.1f})">{inner}</g>'


def rect(x, y, w, h, fill, stroke="#6f5b43", sw=1.2, rx=0, opacity=None) -> str:
    r = f' rx="{rx}"' if rx else ""
    op = f' opacity="{opacity}"' if opacity else ""
    return (
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"{r} '
        f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{op}/>'
    )


def paper(x, y, w, h, deg, fill, stroke="#6f5b43", sw=1.2) -> str:
    return rot_g(x, y, w, h, deg, rect(x, y, w, h, fill, stroke, sw))


def typed_lines(x, y, w, n, gap, color="#5d503e", skip=-1, seed=0) -> str:
    parts = []
    for i in range(n):
        if i == skip:
            continue
        ww = w * (0.48 + ((seed + i * 17) % 47) / 100)
        parts.append(f'<path d="M{x:.1f} {y + i * gap:.1f} h{ww:.1f}" stroke="{color}" stroke-width="1.25"/>')
    return "".join(parts)


def stamp(cx, cy, label, tint, deg=-12, r=28) -> str:
    return (
        f'<g transform="rotate({deg} {cx} {cy})">'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{tint}" stroke-width="3.4"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r - 7}" fill="none" stroke="{tint}" stroke-width="1.1"/>'
        f'<text x="{cx}" y="{cy + 4}" text-anchor="middle" fill="{tint}" '
        f'font-family="Georgia,serif" font-size="9" font-weight="700">{esc(label)}</text></g>'
    )


def wax(cx, cy, letter="YD") -> str:
    return (
        f'<circle cx="{cx}" cy="{cy}" r="22" fill="#6b241f" stroke="#c4a574" stroke-width="2"/>'
        f'<circle cx="{cx}" cy="{cy}" r="14" fill="none" stroke="#e8c48a" stroke-width="1"/>'
        f'<text x="{cx}" y="{cy + 5}" text-anchor="middle" fill="#e8c48a" '
        f'font-family="Georgia,serif" font-size="11">{esc(letter)}</text>'
    )


def redactions(x, y, n, seed) -> str:
    out = []
    for i in range(n):
        s = seed[i % len(seed)]
        out.append(
            f'<rect x="{x + (s % 36)}" y="{y + i * 15}" width="{64 + s % 96}" '
            f'height="7.5" fill="#1a1814" opacity=".84"/>'
        )
    return "".join(out)


def clip_pin(x, y) -> str:
    return (
        f'<path d="M{x} {y} v22 q0 8 8 8 q8 0 8 -8 v-18" fill="none" stroke="#8a7a5a" stroke-width="2.4"/>'
        f'<path d="M{x + 4} {y + 2} v18 q0 4 4 4" fill="none" stroke="#c4b48a" stroke-width="1.4"/>'
    )


def folder(x, y, w, h, tab, fill, tabw=54) -> str:
    return (
        f'<path d="M{x} {y + 14} h{tab} l8 -14 h{tabw} l8 14 h{w - tab - tabw - 16} v{h} h-{w} z" '
        f'fill="{fill}" stroke="#5c4a32" stroke-width="1.4"/>'
    )


def telex_tape(x, y, w, seed) -> str:
    holes = "".join(
        f'<rect x="{x + 6 + i * 9}" y="{y + 4 + (seed[i % 8] % 5)}" width="5" height="5" fill="#2a2218"/>'
        for i in range(max(4, int(w // 10)))
    )
    return f'{rect(x, y, w, 16, "#d8c9a4", "#6a5a3a", 1)}{holes}'


def typewriter(x, y) -> str:
    keys = "".join(f'<rect x="{x + 8 + i * 11}" y="{y + 28}" width="8" height="8" rx="1" fill="#c4b48a"/>' for i in range(9))
    return (
        f'{rect(x, y, 118, 54, "#2c2a26", "#8a7a5a", 1.2, 4)}'
        f'{rect(x + 10, y - 16, 98, 18, CREAM, "#6a5a3a")}'
        f'{keys}<path d="M{x + 20} {y + 8} h80" stroke="#1a1814" stroke-width="6"/>'
    )


def phone(x, y) -> str:
    return (
        f'{rect(x, y, 52, 28, "#2a2e28", "#8a7a5a", 1.2, 4)}'
        f'<path d="M{x + 6} {y - 8} q20 -16 40 0" fill="none" stroke="#c4a574" stroke-width="5" stroke-linecap="round"/>'
        f'<circle cx="{x + 16}" cy="{y + 14}" r="3" fill="#e4d4b4"/>'
        f'<circle cx="{x + 36}" cy="{y + 14}" r="3" fill="#e4d4b4"/>'
    )


def radio(x, y) -> str:
    return (
        f'{rect(x, y, 64, 38, "#2a2620", "#8a7a5a")}'
        f'<circle cx="{x + 18}" cy="{y + 19}" r="10" fill="none" stroke="#c4a574" stroke-width="2"/>'
        f'{rect(x + 36, y + 8, 20, 6, CREAM)}'
        f'<path d="M{x + 48} {y} v-16" stroke="#c4a574" stroke-width="2"/>'
    )


def tape_deck(x, y) -> str:
    return (
        f'{rect(x, y, 78, 36, "#26221c", "#8a7a5a", 1.2, 2)}'
        f'<circle cx="{x + 22}" cy="{y + 18}" r="10" fill="none" stroke="#c4a574" stroke-width="2"/>'
        f'<circle cx="{x + 54}" cy="{y + 18}" r="10" fill="none" stroke="#c4a574" stroke-width="2"/>'
        f'<path d="M{x + 22} {y + 18} h32" stroke="#e4d4b4" stroke-width="2"/>'
    )


def map_frag(x, y, w, h, tint) -> str:
    return (
        f'{rect(x, y, w, h, "#c5cbb0", "#5a4a32")}'
        f'<path d="M{x + 8} {y + h * 0.62:.1f} c{w * 0.28:.1f} -{h * 0.38:.1f} {w * 0.5:.1f} {h * 0.18:.1f} {w - 16:.1f} -{h * 0.14:.1f}" '
        f'fill="none" stroke="{tint}" stroke-width="2.2"/>'
        f'<circle cx="{x + w * 0.34:.1f}" cy="{y + h * 0.38:.1f}" r="4" fill="{OX}"/>'
        f'<path d="M{x + 12} {y + 10} h{w * 0.2:.1f} M{x + 12} {y + 18} h{w * 0.14:.1f}" stroke="#4a5a44" stroke-width="1"/>'
    )


def silhouette(x, y, s=1.0) -> str:
    return (
        f'<g transform="translate({x} {y}) scale({s})">'
        f'<circle cx="0" cy="-18" r="7" fill="#1f1c18"/>'
        f'<path d="M-11 -8 q11 6 22 0 v18 h-22z" fill="#1f1c18"/></g>'
    )


def archive_box(x, y, w, h, label) -> str:
    return (
        f'{rect(x, y, w, h, "#6a5438", "#3a2a18")}'
        f'{rect(x, y, w, 10, "#8a6a42", "#3a2a18")}'
        f'{rect(x + 8, y + h / 2 - 6, w - 16, 12, CREAM, "#3a2a18")}'
        f'<text x="{x + w / 2:.1f}" y="{y + h / 2 + 3:.1f}" text-anchor="middle" fill="#2a2218" '
        f'font-family="ui-monospace,monospace" font-size="8">{esc(label)}</text>'
    )


def envelope(x, y, w=110, h=62) -> str:
    return (
        f'{rect(x, y, w, h, "#e8dcc0", "#6a5a3a")}'
        f'<path d="M{x} {y} L{x + w / 2:.1f} {y + 28} L{x + w} {y}" fill="none" stroke="#6a5a3a" stroke-width="1.4"/>'
    )


def lamp(x, y) -> str:
    return (
        f'<rect x="{x}" y="{y + 40}" width="10" height="36" fill="#6a5a3a"/>'
        f'<path d="M{x - 16} {y + 40} h42 l-8 -28 h-26z" fill="#c4a574"/>'
        f'<circle cx="{x + 5}" cy="{y + 8}" r="6" fill="#efe4c4" opacity=".55"/>'
    )


def newspaper(x, y, w, h, kicker) -> str:
    cols = "".join(
        f'<path d="M{x + 8 + c * (w / 3):.1f} {y + 28} v{h - 36}" stroke="#6a5a3a" opacity=".35"/>'
        for c in range(1, 3)
    )
    lines = typed_lines(x + 10, y + 34, w * 0.26, 6, 9, "#5a4a32", seed=int(x))
    return (
        f'{rect(x, y, w, h, "#efe6cc", "#5a4a32")}'
        f'<text x="{x + 10}" y="{y + 16}" fill="{OX}" font-family="Georgia,serif" font-size="9" font-weight="700">{esc(kicker)}</text>'
        f'{cols}{lines}'
    )


def corridor(tint) -> str:
    return (
        f'<rect x="28" y="88" width="344" height="330" fill="#1c2228"/>'
        f'<path d="M28 418 L168 220 L232 220 L372 418" fill="#2a323c"/>'
        f'<path d="M168 220 L232 220 L232 88 L168 88 Z" fill="#24303a"/>'
        f'<rect x="186" y="140" width="28" height="80" fill="#1a1814" stroke="{tint}"/>'
        f'<path d="M28 418 L168 220 M232 220 L372 418" stroke="#8a7a5a" opacity=".45"/>'
    )


def paraf_flourish(name: str, x: float, y: float, tint: str) -> str:
    h = hashlib.sha256(name.encode("utf-8")).digest()
    d = [h[i] for i in range(12)]
    x1, y1 = x + 20 + d[0] % 30, y - 20 - d[1] % 40
    x2, y2 = x + 70 + d[2] % 40, y + 10 - d[3] % 30
    x3, y3 = x + 120 + d[4] % 50, y - 8 + d[5] % 24
    x4, y4 = x + 170 + d[6] % 30, y + 18 - d[7] % 20
    return (
        f'<path d="M{x:.1f} {y:.1f} C{x1:.1f} {y1:.1f} {x2:.1f} {y2:.1f} {x3:.1f} {y3:.1f} '
        f'S{x4:.1f} {y4:.1f} {x + 200:.1f} {y + (d[8] % 16) - 8:.1f}" fill="none" stroke="{tint}" '
        f'stroke-width="2.6" stroke-linecap="round"/>'
        f'<path d="M{x + 24:.1f} {y + 8:.1f} C{x + 50:.1f} {y - 12:.1f} {x + 90:.1f} {y + 16:.1f} {x + 140:.1f} {y:.1f}" '
        f'fill="none" stroke="{tint}" stroke-width="1.4" opacity=".7"/>'
    )


def accession(x, y, cid, n) -> str:
    return (
        f'<text x="{x}" y="{y}" fill="#5a4a32" font-family="ui-monospace,monospace" font-size="8">'
        f'ESAS {esc(cid)} · KAYIT {1000 + n}</text>'
    )


def grain_def() -> str:
    return (
        '<pattern id="grain" width="7" height="7" patternUnits="userSpaceOnUse">'
        '<path d="M0 7 L7 0" stroke="#2a2218" opacity=".055"/>'
        "</pattern>"
    )


def well_bg(fill: str) -> str:
    return f'<rect x="28" y="88" width="344" height="330" fill="{fill}"/>'


# --- series painters ---------------------------------------------------------

def paint_dosya(b, tint, n, name, cid) -> str:
    v = b[0] % 4
    tabs = "".join(
        folder(
            52 + i * 16,
            112 + i * 26,
            248 - i * 10,
            148,
            10 + (b[i] % 36),
            ["#c8b48a", "#d4c4a0", "#bba678", "#cfc09a"][i % 4],
            38 + b[i] % 22,
        )
        for i in range(3)
    )
    if v == 0:
        body = well_bg("#3a4550") + rect(40, 100, 320, 300, CREAM) + tabs + clip_pin(72, 118)
        body += typed_lines(90, 176, 176, 7, 14, skip=3, seed=b[2]) + stamp(304, 214, "DOSYA", tint, -18)
        body += accession(86, 390, cid, n)
    elif v == 1:
        body = well_bg("#2c333c")
        body += "".join(
            folder(58 + i * 6, 118 + i * 30, 276, 68, 18 + b[i] % 28, ["#d8c9a8", "#cbb892", "#b8a678", "#d2c4a3"][i], 46)
            for i in range(4)
        )
        body += clip_pin(92, 130) + typed_lines(86, 206, 188, 5, 11, seed=b[3]) + stamp(296, 348, "GİZLİ", OX, 12, 26)
    elif v == 2:
        body = well_bg("#24303a") + paper(68, 118, 210, 248, -5, CREAM) + paper(148, 138, 184, 226, 7, "#d2c4a3")
        body += typed_lines(166, 168, 140, 8, 16, skip=2, seed=b[4]) + redactions(168, 252, 3, b)
        body += clip_pin(78, 126) + stamp(118, 348, "KAYIT", tint, -8)
    else:
        body = corridor(tint) + paper(70, 200, 200, 170, -3, CREAM) + tabs[:200]
        body += clip_pin(80, 208) + stamp(300, 250, "DOSYA", tint, 8, 24) + lamp(300, 110)
    if n > 180:
        body += wax(322, 368)
    return body


def paint_telex(b, tint, n, name, cid) -> str:
    v = b[1] % 4
    tapes = "".join(telex_tape(40, 108 + i * 20, 270 + (b[i] % 44), b[i:]) for i in range(5))
    if v == 0:
        body = well_bg("#2a241c") + tapes + typewriter(138, 276)
        body += paper(48, 228, 154, 86, -3, IVORY) + typed_lines(60, 244, 128, 4, 12, INK, seed=b[5])
        body += stamp(314, 366, "TELEX", tint, 8, 24)
    elif v == 1:
        body = well_bg("#1f1c18") + rect(44, 108, 312, 248, PAPER)
        body += "".join(f'<path d="M56 {128 + i * 18} h{210 + (b[i] % 72)}" stroke="#2a2218" stroke-width="1.1"/>' for i in range(12))
        body += telex_tape(56, 368, 300, b) + stamp(304, 158, "ONAY", tint, -14)
    elif v == 2:
        body = well_bg("#262018") + radio(48, 126) + tape_deck(138, 124)
        body += paper(66, 186, 264, 176, 2, CREAM) + typed_lines(84, 206, 220, 8, 15, seed=b[6])
        body += telex_tape(78, 370, 246, b)
    else:
        body = well_bg("#1a1612") + tapes
        body += newspaper(48, 220, 180, 150, "TELEX BÜLTEN") + typewriter(240, 280) + phone(250, 220)
    body += accession(48, 404, cid, n)
    return body


def paint_karargah(b, tint, n, name, cid) -> str:
    v = b[2] % 4
    table = (
        '<path d="M40 300 L360 268 L360 418 L40 418Z" fill="#4a3828"/>'
        '<path d="M40 300 L360 268" stroke="#8a6a42" stroke-width="2"/>'
    )
    if v == 0:
        body = well_bg("#1e242c") + '<rect x="28" y="88" width="344" height="140" fill="#2a3340"/>'
        body += map_frag(68, 108, 204, 112, tint) + phone(286, 126) + table
        body += paper(90, 312, 118, 68, -6, CREAM) + paper(220, 300, 100, 80, 8, "#d2c4a3")
        body += stamp(322, 362, "KRİZ", tint)
    elif v == 1:
        body = well_bg("#1a2228") + table
        body += "".join(silhouette(88 + i * 50, 292, 0.88 + (b[i] % 3) * 0.08) for i in range(5))
        body += paper(148, 318, 90, 50, 4, CREAM) + radio(48, 118) + lamp(300, 108) + stamp(300, 200, "KRİZ", tint, 10)
    elif v == 2:
        body = well_bg("#202830") + map_frag(48, 108, 304, 164, tint)
        body += phone(58, 292) + tape_deck(138, 290) + paper(240, 280, 110, 90, -5, CREAM)
        body += stamp(304, 198, "KARAR", tint, 20)
    else:
        body = well_bg("#181e26") + table + map_frag(56, 112, 160, 100, tint)
        body += "".join(silhouette(70 + i * 55, 300, 1.0) for i in range(4))
        body += phone(280, 126) + paper(230, 310, 110, 70, 6, CREAM) + lamp(50, 110)
    return body


def paint_heyet(b, tint, n, name, cid) -> str:
    chairs = "".join(silhouette(70 + i * 48, 252 + (i % 2) * 10, 1.02) for i in range(6))
    oval = '<ellipse cx="200" cy="250" rx="140" ry="58" fill="#4d392d" stroke="#aa8b61" stroke-width="3"/>'
    v = b[3] % 3
    if v == 0:
        body = well_bg("#2a2430") + oval + chairs + paper(176, 228, 50, 36, 8, CREAM)
        body += stamp(314, 138, "HEYET", tint, -10) + lamp(50, 108)
    elif v == 1:
        body = well_bg("#241e28") + rect(60, 138, 280, 16, "#6a5438")
        body += "".join(silhouette(90 + i * 44, 136, 1) for i in range(5))
        body += paper(80, 196, 240, 164, -2, CREAM) + typed_lines(100, 216, 200, 7, 16, seed=b[7])
        body += stamp(284, 336, "TUTANAK", tint, 6, 30)
    else:
        body = well_bg("#201a26") + oval
        body += "".join(silhouette(86 + i * 46, 248, 0.95) for i in range(5))
        body += paper(60, 320, 160, 70, -4, CREAM) + newspaper(230, 118, 120, 90, "HEYET")
        body += stamp(300, 360, "OY", tint, 14, 22)
    return body


def paint_kabine(b, tint, n, name, cid) -> str:
    cols = "".join(
        f'{rect(70 + i * 90, 110, 28, 220, "#d8c9a8", "#6a5a3a")}{rect(64 + i * 90, 100, 40, 14, BRASS, "#6a5a3a")}'
        for i in range(3)
    )
    if b[4] % 3 == 0:
        body = well_bg("#2c241c") + cols + paper(120, 200, 160, 140, 3, CREAM)
        body += typed_lines(136, 220, 130, 6, 14, seed=b[8]) + stamp(304, 344, "KABİNE", tint)
    elif b[4] % 3 == 1:
        body = well_bg("#262018") + rect(48, 250, 304, 90, "#3a2e22")
        body += "".join(silhouette(90 + i * 55, 248, 1.1) for i in range(4))
        body += paper(80, 118, 200, 110, -4, CREAM) + typed_lines(96, 138, 160, 5, 14, seed=b[9])
        body += stamp(304, 158, "KARAR", tint, -16)
    else:
        body = corridor(tint) + cols + paper(90, 250, 180, 120, 2, CREAM) + stamp(300, 180, "BAKAN", tint, 8)
    return body


def paint_paraf(b, tint, n, name, cid) -> str:
    flourish = paraf_flourish(name, 70, 300, tint)
    v = b[5] % 4
    if v == 0:
        body = well_bg("#1e241c") + paper(58, 118, 284, 244, -2, CREAM)
        body += typed_lines(80, 148, 230, 6, 18, skip=4, seed=b[1]) + flourish
        body += stamp(284, 198, "PARAF", tint, -22, 36) + clip_pin(68, 126)
    elif v == 1:
        body = well_bg("#22281e") + rect(90, 138, 140, 90, "#3a2a18") + stamp(160, 183, "P", tint, 0, 40)
        body += paper(70, 248, 250, 120, 4, CREAM) + flourish
    elif v == 2:
        body = well_bg("#1c221a") + paper(50, 108, 200, 264, -7, CREAM) + paper(158, 148, 180, 204, 9, "#d2c4a3")
        body += flourish + stamp(244, 218, "ONAY", tint, 14, 32)
    else:
        body = well_bg("#182016") + paper(48, 120, 300, 220, 1, IVORY)
        body += typed_lines(70, 150, 250, 5, 20, skip=2, seed=b[2]) + flourish
        body += wax(300, 160, "P") + accession(70, 360, cid, n)
    return body


def paint_brifing(b, tint, n, name, cid) -> str:
    easel = (
        '<path d="M120 360 L200 120 L280 360" fill="none" stroke="#6a5a3a" stroke-width="6"/>'
        '<rect x="148" y="140" width="104" height="14" fill="#8a6a42"/>'
    )
    v = b[6] % 3
    if v == 0:
        body = well_bg("#1c2430") + easel + map_frag(150, 154, 100, 70, tint)
        body += silhouette(80, 340, 1.28) + paper(260, 220, 90, 120, 8, CREAM)
        body += typed_lines(270, 236, 70, 5, 14, seed=b[0]) + stamp(304, 138, "BRİF", tint, -8, 22)
    elif v == 1:
        body = well_bg("#182028") + map_frag(48, 108, 304, 164, tint)
        body += f'<path d="M80 280 L200 140" stroke="{OX}" stroke-width="3"/>'
        body += paper(70, 292, 160, 88, -3, CREAM) + silhouette(284, 344, 1.18) + stamp(60, 140, "BRİF", tint, -12, 20)
    else:
        body = well_bg("#141c26") + easel + newspaper(48, 118, 110, 90, "BRİFİNG")
        body += paper(250, 200, 100, 140, -6, CREAM) + lamp(48, 250) + stamp(300, 140, "NOT", tint, 10, 20)
    return body


def paint_arsiv(b, tint, n, name, cid) -> str:
    boxes = "".join(
        archive_box(48 + (i % 3) * 110, 118 + (i // 3) * 92, 96, 72, f"{100 + (b[i] % 90)}")
        for i in range(6)
    )
    if b[7] % 3 == 0:
        body = well_bg("#1c221c") + boxes + clip_pin(60, 116) + stamp(200, 392, "ARŞİV", tint, 0, 24)
    elif b[7] % 3 == 1:
        body = well_bg("#22261e") + rect(50, 108, 18, 284, "#6a5438") + rect(330, 108, 18, 284, "#6a5438")
        body += "".join(rect(70, 118 + i * 52, 258, 44, "#4a3a28", "#2a1c10") for i in range(5))
        body += "".join(archive_box(80 + i * 80, 124, 70, 32, "K") for i in range(3))
        body += paper(140, 280, 140, 90, 6, CREAM) + stamp(304, 362, "KAYIT", tint)
    else:
        body = corridor(tint)
        body += "".join(archive_box(60 + i * 100, 240, 88, 70, f"A{n % 90 + i}") for i in range(3))
        body += paper(80, 120, 160, 90, -4, CREAM) + clip_pin(90, 128) + stamp(300, 150, "ARŞİV", tint, -12)
    return body


def paint_muhtira(b, tint, n, name, cid) -> str:
    v = b[8] % 3
    body = well_bg("#2a1e1e")
    body += paper(54, 108, 204, 274, -3, CREAM) + paper(138, 128, 204, 254, 5, IVORY)
    body += typed_lines(158, 158, 164, 9, 18, skip=1, seed=b[3])
    body += typewriter(48, 304) + stamp(304, 158, "MUHTIRA", tint, -16, 28)
    if v:
        body += redactions(162, 248, 2 + v, b)
    if v == 2:
        body += newspaper(230, 300, 120, 80, "TEBLİĞ")
    body += accession(148, 150, cid, n)
    return body


def paint_tebligat(b, tint, n, name, cid) -> str:
    bag = (
        f'<path d="M80 200 h80 v120 h-80z" fill="#4a3828" stroke="#c4a574"/>'
        f'<path d="M80 200 q40 -40 80 0" fill="none" stroke="#c4a574" stroke-width="4"/>'
    )
    v = b[9] % 3
    if v == 0:
        body = well_bg("#241c14") + envelope(90, 138, 220, 120) + wax(200, 198)
        body += paper(70, 272, 240, 110, -2, CREAM) + typed_lines(90, 292, 200, 4, 14, seed=b[4])
        body += stamp(314, 366, "TEBLİĞ", tint, 10, 24)
    elif v == 1:
        body = well_bg("#1e1812") + bag + envelope(180, 158, 160, 90)
        body += paper(60, 304, 280, 86, 3, CREAM) + stamp(304, 128, "SEVK", tint, -12)
    else:
        body = well_bg("#22180e") + envelope(60, 130, 160, 90) + envelope(160, 170, 180, 100)
        body += wax(250, 220) + paper(70, 300, 240, 90, -3, CREAM) + stamp(80, 360, "TEBLİĞ", tint, -8, 22)
    return body


def paint_zeyil(b, tint, n, name, cid) -> str:
    v = b[10] % 3
    body = well_bg("#1c2424") + paper(50, 108, 220, 284, -2, CREAM) + paper(200, 128, 140, 264, 0, "#d2e0d8")
    body += f'<rect x="200" y="128" width="18" height="264" fill="{tint}"/>'
    body += typed_lines(70, 140, 180, 10, 18, skip=2, seed=b[5]) + typed_lines(228, 160, 90, 8, 20, seed=b[6])
    body += stamp(120, 364, "ZEYİL", tint, -8) + clip_pin(58, 116)
    if v == 1:
        body += paper(240, 300, 90, 70, 8, IVORY) + accession(60, 160, cid, n)
    if v == 2:
        body += redactions(70, 250, 3, b)
    return body


def paint_mesruiyet(b, tint, n, name, cid) -> str:
    ribbon = f'<path d="M180 140 v180" stroke="{OX}" stroke-width="10"/><path d="M200 140 v180" stroke="{tint}" stroke-width="10"/>'
    v = b[11] % 3
    body = well_bg("#1c2030") + paper(70, 118, 260, 254, 1, CREAM) + ribbon
    body += stamp(200, 240, "MÜHÜR", tint, 0, 42) + typed_lines(90, 140, 80, 4, 14, seed=b[0])
    if v == 0:
        body += wax(304, 364)
    elif v == 1:
        body += stamp(304, 364, "KANUN", tint, 12, 22)
    else:
        body += newspaper(48, 320, 130, 70, "RESMÎ") + wax(320, 150)
    return body


def paint_ihtar(b, tint, n, name, cid) -> str:
    triangle = f'<polygon points="200,120 320,340 80,340" fill="none" stroke="{OX}" stroke-width="8"/>'
    bang = f'<text x="200" y="280" text-anchor="middle" fill="{OX}" font-family="Georgia,serif" font-size="64" font-weight="700">!</text>'
    v = b[12] % 4
    if v == 0:
        body = well_bg("#2a1614") + triangle + bang + paper(48, 352, 304, 48, 0, CREAM) + redactions(60, 362, 2, b)
    elif v == 1:
        body = well_bg("#241412") + paper(56, 108, 288, 274, -1, CREAM)
        body += redactions(80, 148, 8, b) + stamp(284, 198, "İHTAR", OX, -14, 34) + phone(60, 360)
    elif v == 2:
        body = well_bg("#1c1210") + envelope(80, 138, 240, 100)
        body += '<polygon points="200,170 270,300 130,300" fill="none" stroke="#7a2e28" stroke-width="6"/>'
        body += stamp(200, 364, "ACİL", OX, 0, 28)
    else:
        body = well_bg("#201010") + triangle + paper(48, 110, 140, 90, -6, CREAM)
        body += redactions(60, 130, 4, b) + typewriter(220, 330) + stamp(300, 160, "İHTAR", OX, 16, 26)
    return body


PAINT = {
    "Dosya": paint_dosya,
    "Paraf": paint_paraf,
    "Heyet": paint_heyet,
    "Karargah": paint_karargah,
    "Telex": paint_telex,
    "Muhtira": paint_muhtira,
    "Zeyil": paint_zeyil,
    "Brifing": paint_brifing,
    "Kabine": paint_kabine,
    "Arsiv": paint_arsiv,
    "Tebligat": paint_tebligat,
    "Mesruiyet": paint_mesruiyet,
    "İhtar": paint_ihtar,
    "Ihtar": paint_ihtar,
}


def extra_artifact(b, kind: str) -> str:
    pick = (b[13] + b[14]) % 8
    if kind == "trap":
        return redactions(48, 96, 2, b) if pick % 2 == 0 else stamp(70, 120, "DUR", OX, -20, 18)
    catalog = [
        lambda: phone(48, 360),
        lambda: radio(300, 360),
        lambda: tape_deck(48, 368),
        lambda: lamp(318, 96),
        lambda: clip_pin(330, 100),
        lambda: envelope(250, 360, 90, 48),
        lambda: newspaper(40, 350, 100, 60, "NOT"),
        lambda: wax(60, 110, "M"),
    ]
    return catalog[pick]()


def kind_overlay(kind: str, subtype: str, tint: str, b) -> str:
    parts = []
    if kind == "spell":
        parts.append(paper(48, 350, 120, 48, -2, IVORY, "#6a5a3a", 1))
        parts.append('<text x="56" y="378" fill="#5a4a32" font-family="ui-monospace,monospace" font-size="8">EMİRNAME</text>')
    if kind == "trap":
        parts.append(f'<rect x="28" y="88" width="344" height="10" fill="{OX}" opacity=".55"/>')
    if subtype == "fusion":
        parts.append(stamp(86, 150, "I", tint, -8, 20) + stamp(130, 158, "II", tint, 12, 20))
    elif subtype == "equip":
        parts.append(clip_pin(48, 92))
    elif subtype == "quick":
        parts.append(
            f'<circle cx="60" cy="120" r="14" fill="none" stroke="{BRASS}" stroke-width="2"/>'
            f'<path d="M60 120 L60 110 M60 120 L68 124" stroke="{BRASS}" stroke-width="2"/>'
        )
    elif subtype == "counter":
        parts.append(stamp(320, 130, "RED", OX, 18, 18))
    elif subtype == "continuous":
        parts.append(telex_tape(48, 400, 80, b))
    elif subtype == "field":
        parts.append(map_frag(300, 350, 60, 40, tint))
    return "".join(parts)


def jacket(kind: str, level: int, aux: bool, tint: str):
    if kind == "trap":
        return OX, "#2a1210"
    if kind == "spell":
        return "#6a5a3a", "#1c1812"
    if aux or level >= 7:
        return BRASS, "#141018"
    if level >= 5:
        return tint, "#12141c"
    return tint, NAVY


def card_svg(card: dict) -> str:
    sid = series_key(card.get("series") or "")
    tint = SERIES_INK.get(sid, "#3d5a73")
    kind = card.get("kind") or "unit"
    subtype = card.get("subtype") or "normal"
    klabel = KIND_LABEL.get(kind, "GÖREVLİ")
    cid_raw = card.get("id") or "DRB-000"
    cid = esc(cid_raw)
    name_raw = card.get("name") or ""
    name = esc(name_raw)
    atk, df = card.get("attack"), card.get("defense")
    stats = "—" if kind != "unit" else f"{atk if atk is not None else '—'} / {df if df is not None else '—'}"
    loc = card.get("deckLocation") or "main"
    level = int(card.get("level") or 0)
    aux = loc == "auxiliary"
    b = bits(cid_raw)
    n = int(str(cid_raw).split("-")[-1])
    edge, ground = jacket(kind, level, aux, tint)
    heavy = 5 if aux or level >= 7 else 3 if level >= 5 else 2
    painter = PAINT.get(sid, paint_dosya)
    art = painter(b, tint, n, name_raw, cid_raw)
    art += extra_artifact(b, kind)
    art += kind_overlay(kind, subtype, tint, b)
    art += paraf_flourish(name_raw + cid_raw, 48 + (b[15] % 40), 390, tint if kind != "trap" else OX)
    slip_x = 36 + (b[16] % 18)
    slip_y = 96 + (b[17] % 12)
    art += paper(slip_x, slip_y, 132, 28, -2 + (b[18] % 5), IVORY)
    art += f'<text x="{slip_x + 8}" y="{slip_y + 18}" fill="#3a2a18" font-family="ui-monospace,monospace" font-size="8">{esc(cid_raw)} · {esc(name_raw[:18])}</text>'
    pips = ""
    if level:
        x0 = 200 - min(level, 8) * 8
        pips = "".join(f'<circle cx="{x0 + i * 16}" cy="64" r="4" fill="{BRASS}"/>' for i in range(min(level, 8)))
    ydew = wax(352, 108) if aux else ""
    classified = ""
    if level >= 5 or kind == "trap":
        classified = (
            f'<rect x="28" y="88" width="96" height="16" fill="{OX}"/>'
            f'<text x="76" y="100" text-anchor="middle" fill="#f0e6d0" font-size="9" '
            f'font-family="ui-monospace,monospace">GİZLİ</text>'
        )
    clip = f"well-{cid_raw}"
    tier = "aux" if aux else "high" if level >= 7 else "mid" if level >= 5 else "low"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="400" height="560">
<defs>{grain_def()}<clipPath id="{clip}"><rect x="28" y="88" width="344" height="330"/></clipPath></defs>
<rect width="400" height="560" fill="#0e1014"/>
<rect x="10" y="10" width="380" height="540" fill="{ground}" stroke="{edge}" stroke-width="{heavy}"/>
<rect x="10" y="10" width="380" height="22" fill="{edge}"/>
<text x="22" y="52" fill="{BRASS}" font-family="ui-monospace,monospace" font-size="12" letter-spacing="1.6">{klabel}</text>
<text x="378" y="52" text-anchor="end" fill="#9aa093" font-family="ui-monospace,monospace" font-size="12">{esc(sid.upper())}</text>
<text x="200" y="78" text-anchor="middle" fill="#e8dcc4" font-family="Georgia,serif" font-size="20">{cid}</text>
{pips}
<g clip-path="url(#{clip})" data-series="{esc(sid)}" data-kind="{esc(kind)}" data-subtype="{esc(subtype)}" data-tier="{tier}" data-aux="{1 if aux else 0}">{art}<rect x="28" y="88" width="344" height="330" fill="url(#grain)"/><!--well-end--></g>
{classified}{ydew}
<rect x="28" y="430" width="344" height="36" fill="#121820" opacity=".92"/>
<text x="200" y="454" text-anchor="middle" fill="#e8dcc4" font-family="Georgia,serif" font-size="18">{name}</text>
<rect x="28" y="478" width="344" height="52" fill="#0c1016"/>
<text x="200" y="512" text-anchor="middle" fill="#e8dcc4" font-family="ui-monospace,monospace" font-size="22">{stats}</text>
</svg>
'''


def well_payload(svg: str) -> str:
    start = svg.find("data-series=")
    end = svg.find("<!--well-end-->")
    return svg[start:end] if start >= 0 and end >= 0 else svg


def main() -> None:
    cards = json.loads(SRC.read_text())
    OUT_SVG.mkdir(parents=True, exist_ok=True)
    entries = {}
    sizes = []
    hashes = []
    wells = []
    for c in cards:
        cid = c["id"]
        target = OUT_SVG / f"{cid}.svg"
        svg = card_svg(c)
        target.write_text(svg, encoding="utf-8")
        data = target.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        sizes.append(len(data))
        hashes.append(digest)
        wells.append(hashlib.sha256(well_payload(svg).encode()).hexdigest())
        entries[cid] = {
            "path": f"/games/darbe-h/assets/cards/{cid}.svg",
            "width": 400,
            "height": 560,
            "bytes": len(data),
            "sha256": digest,
        }
    ordered = sorted(sizes)
    manifest = {
        "summary": {
            "coverage": len(cards),
            "totalBytes": sum(sizes),
            "averageBytes": round(sum(sizes) / len(sizes)),
            "p95Bytes": ordered[max(0, int(len(ordered) * 0.95) - 1)],
            "maxBytes": max(sizes),
            "duplicateHashes": len(hashes) - len(set(hashes)),
            "duplicateWells": len(wells) - len(set(wells)),
            "dimensions": [400, 560],
            "kind": "svg",
        },
        "cards": entries,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"wrote {len(cards)} svg unique={len(set(hashes))} wells={len(set(wells))} "
        f"bytes={sum(sizes)} avg={round(sum(sizes)/len(sizes))}"
    )


if __name__ == "__main__":
    main()
