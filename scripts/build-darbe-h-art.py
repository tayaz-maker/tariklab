#!/usr/bin/env python3
"""DARBE-H! illustrated crisis-interior card faces.

Editorial illustration + archival atmosphere. Each card is a lit room/scene
with perspective, lamp pools and object storytelling — not a collage of
rectangles and stamps. IDs, stats and text come from source-cards.json.
No fake historical photographs.
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
WALLS = {
    "Dosya": ("#2a3642", "#1c262e", "#3a2e22"),
    "Paraf": ("#243028", "#18221c", "#3a3424"),
    "Heyet": ("#2c2434", "#1c1824", "#3a3228"),
    "Karargah": ("#1e262e", "#141a22", "#2e261c"),
    "Telex": ("#241e16", "#16120e", "#3a2c1c"),
    "Muhtira": ("#2a1c1c", "#1a1212", "#3a2a22"),
    "Zeyil": ("#1c2626", "#121c1c", "#2a3228"),
    "Brifing": ("#1a2430", "#101820", "#2a2e28"),
    "Kabine": ("#2a2218", "#1a1610", "#3a3224"),
    "Arsiv": ("#22281e", "#161a14", "#3a3224"),
    "Tebligat": ("#241c14", "#16120c", "#3a2e1e"),
    "Mesruiyet": ("#1c2030", "#12161e", "#2e2a22"),
    "İhtar": ("#2a1612", "#1a0e0c", "#3a2418"),
    "Ihtar": ("#2a1612", "#1a0e0c", "#3a2418"),
}


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


def uid_of(cid: str) -> str:
    return cid.replace("-", "")


def poly(pts, fill, stroke=None, sw=1, opacity=None) -> str:
    d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ' stroke="none"'
    op = f' opacity="{opacity}"' if opacity else ""
    return f'<polygon points="{d}" fill="{fill}"{st}{op}/>'


def pathd(d, fill="none", stroke=None, sw=1, cap="round", join="round", opacity=None) -> str:
    st = f' stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}" stroke-linejoin="{join}"' if stroke else ""
    op = f' opacity="{opacity}"' if opacity else ""
    return f'<path d="{d}" fill="{fill}"{st}{op}/>'


def rect(x, y, w, h, fill, stroke=None, sw=1, rx=0, opacity=None) -> str:
    r = f' rx="{rx}"' if rx else ""
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ' stroke="none"'
    op = f' opacity="{opacity}"' if opacity else ""
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}"{r} fill="{fill}"{st}{op}/>'


def circ(cx, cy, r, fill, stroke=None, sw=1, opacity=None) -> str:
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ' stroke="none"'
    op = f' opacity="{opacity}"' if opacity else ""
    return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}"{st}{op}/>'


def txt(x, y, s, fill, size=11, anchor="start", font="Georgia,serif", w="700", extra="") -> str:
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" fill="{fill}" '
        f'font-family="{font}" font-size="{size}" font-weight="{w}"{extra}>{esc(s)}</text>'
    )


def box3(x, y, w, h, d, top, front, side) -> str:
    sx, sy = d * 0.58, -d * 0.34
    front_p = [(x, y - h), (x + w, y - h), (x + w, y), (x, y)]
    topp = [(x, y - h), (x + sx, y - h + sy), (x + w + sx, y - h + sy), (x + w, y - h)]
    sidep = [(x + w, y - h), (x + w + sx, y - h + sy), (x + w + sx, y + sy), (x + w, y)]
    shadow = poly(
        [(x + 6, y + 4), (x + w + 8, y + 4), (x + w + sx + 4, y + sy + 6), (x + sx, y + sy + 6)],
        "#0a0806",
        opacity=0.28,
    )
    return shadow + poly(sidep, side) + poly(front_p, front, "#1a1612", 0.6) + poly(topp, top, "#5a4a32", 0.7)


def chair(x, y, scale=1.0, wood="#4a3828") -> str:
    s = scale
    return (
        f'<g transform="translate({x:.1f} {y:.1f}) scale({s:.2f})">'
        f'<ellipse cx="0" cy="18" rx="22" ry="7" fill="#0a0806" opacity=".3"/>'
        f'{rect(-16, -6, 32, 10, wood, "#1a1612", 0.8, 2)}'
        f'{rect(-14, -40, 6, 36, wood)}{rect(8, -40, 6, 36, wood)}'
        f'{rect(-18, -48, 36, 12, "#3a2a1c", "#1a1612", 0.8, 2)}'
        f'{rect(-12, 4, 5, 18, "#2a1e14")}{rect(8, 4, 5, 18, "#2a1e14")}'
        "</g>"
    )


def lamp_obj(x, y, shade="#c4a574", glow=True) -> str:
    g = circ(x + 5, y + 10, 28, "#f0d9a0", opacity=0.18) if glow else ""
    return (
        g
        + pathd(f"M{x - 18} {y + 36} h46 l-10 -26 h-26z", shade, "#5a4a32", 0.8)
        + rect(x, y + 36, 10, 40, "#4a3a28")
        + circ(x + 5, y + 12, 7, "#efe4c4", opacity=0.7)
        + rect(x - 8, y + 74, 26, 6, "#2a2218")
    )


def typewriter(x, y) -> str:
    keys = "".join(
        rect(x + 10 + i * 10, y + 22, 8, 7, "#d4c4a0", "#3a2a18", 0.5, 1) for i in range(9)
    )
    return (
        box3(x, y + 48, 118, 28, 22, "#3a342c", "#2c2a26", "#1e1c18")
        + rect(x + 12, y + 4, 96, 16, CREAM, "#5a4a32", 0.8)
        + pathd(f"M{x + 22} {y + 16} h76", stroke="#1a1814", sw=5)
        + keys
    )


def phone_obj(x, y) -> str:
    return (
        box3(x, y + 28, 54, 16, 16, "#3a3e38", "#2a2e28", "#1a1e18")
        + pathd(f"M{x + 8} {y + 4} q20 -18 40 0", stroke="#c4a574", sw=5)
        + circ(x + 16, y + 18, 3, "#e4d4b4")
        + circ(x + 38, y + 18, 3, "#e4d4b4")
    )


def radio_obj(x, y) -> str:
    return (
        box3(x, y + 36, 72, 24, 16, "#3a342c", "#2a2620", "#1a1612")
        + circ(x + 22, y + 20, 10, "none", BRASS, 2)
        + rect(x + 40, y + 12, 22, 6, CREAM)
        + pathd(f"M{x + 58} {y + 12} v-18", stroke=BRASS, sw=2)
    )


def tape_deck(x, y) -> str:
    return (
        box3(x, y + 34, 86, 22, 14, "#322c24", "#26221c", "#16120e")
        + circ(x + 24, y + 18, 10, "none", BRASS, 2)
        + circ(x + 58, y + 18, 10, "none", BRASS, 2)
        + pathd(f"M{x + 24} {y + 18} h34", stroke="#e4d4b4", sw=2)
    )


def dossier(x, y, w, h, fill, tab=36, deg=0) -> str:
    inner = (
        pathd(
            f"M{x} {y + 12} h{tab} l7 -12 h{36} l7 12 h{w - tab - 50} v{h} h{-w} z",
            fill,
            "#5c4a32",
            1.2,
        )
        + rect(x + 10, y + 22, w * 0.62, 4, "#5d503e", opacity=0.45)
        + rect(x + 10, y + 32, w * 0.48, 4, "#5d503e", opacity=0.35)
    )
    if not deg:
        return inner
    cx, cy = x + w / 2, y + h / 2
    return f'<g transform="rotate({deg:.1f} {cx:.1f} {cy:.1f})">{inner}</g>'


def paper_sheet(x, y, w, h, deg, fill, lines=0, skip=-1, seed=0) -> str:
    cx, cy = x + w / 2, y + h / 2
    body = rect(x, y, w, h, fill, "#6f5b43", 1.1)
    if lines:
        for i in range(lines):
            if i == skip:
                continue
            ww = w * (0.46 + ((seed + i * 17) % 47) / 100)
            body += pathd(f"M{x + 10:.1f} {y + 16 + i * 11:.1f} h{ww:.1f}", stroke="#5d503e", sw=1.15)
    return f'<g transform="rotate({deg:.1f} {cx:.1f} {cy:.1f})">{body}</g>'


def map_table(x, y, w, h, tint) -> str:
    return (
        box3(x, y + h, w, 10, 18, "#c5cbb0", "#4a3828", "#3a2a1c")
        + pathd(
            f"M{x + 12:.1f} {y + h * 0.55:.1f} c{w * 0.28:.1f} -{h * 0.4:.1f} {w * 0.5:.1f} {h * 0.16:.1f} {w - 22:.1f} -{h * 0.12:.1f}",
            stroke=tint,
            sw=2.2,
        )
        + circ(x + w * 0.38, y + h * 0.36, 4, OX)
    )


def envelope(x, y, w=120, h=68) -> str:
    return (
        rect(x, y, w, h, "#e8dcc0", "#6a5a3a", 1.1)
        + pathd(f"M{x} {y} L{x + w / 2:.1f} {y + 28} L{x + w} {y}", fill="#d8ccb0", stroke="#6a5a3a", sw=1.2)
    )


def wax(cx, cy, letter="YD") -> str:
    return (
        circ(cx, cy, 16, "#6b241f", BRASS, 1.6)
        + circ(cx, cy, 10, "none", "#e8c48a", 0.9)
        + txt(cx, cy + 4, letter, "#e8c48a", 10, "middle")
    )


def stamp_seal(cx, cy, label, tint, deg=-14, r=26) -> str:
    return (
        f'<g transform="rotate({deg} {cx:.1f} {cy:.1f})">'
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="none" stroke="{tint}" stroke-width="3"/>'
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r - 7}" fill="none" stroke="{tint}" stroke-width="1"/>'
        f'{txt(cx, cy + 4, label, tint, 8, "middle")}</g>'
    )


def silhouette(x, y, s=1.0) -> str:
    return (
        f'<g transform="translate({x:.1f} {y:.1f}) scale({s:.2f})" opacity=".85">'
        f'<ellipse cx="0" cy="18" rx="14" ry="5" fill="#0a0806" opacity=".35"/>'
        f'<circle cx="0" cy="-20" r="8" fill="#1a1612"/>'
        f'<path d="M-13 -8 q13 8 26 0 v22 h-26z" fill="#1a1612"/>'
        "</g>"
    )


def shelves(x, y, cols, rows, tint) -> str:
    out = [box3(x, y + rows * 38 + 16, cols * 52 + 16, rows * 38 + 10, 14, "#6a5438", "#4a3a28", "#3a2a1c")]
    for r in range(rows):
        for c in range(cols):
            fill = ["#c8b48a", "#d4c4a0", "#bba678", "#3d5344", "#7a2e28"][(r + c) % 5]
            out.append(rect(x + 8 + c * 52, y + 8 + r * 36, 44, 28, fill, "#2a1c10", 0.8))
    return "".join(out)


def telex_machine(x, y, b) -> str:
    holes = "".join(
        rect(x + 14 + i * 8, y + 8 + (b[i % 8] % 4), 4, 4, "#2a2218") for i in range(12)
    )
    return (
        box3(x, y + 70, 150, 40, 22, "#4a3e32", "#2a241c", "#1a1610")
        + rect(x + 10, y + 4, 128, 18, "#d8c9a4", "#6a5a3a")
        + holes
        + rect(x + 18, y + 36, 110, 10, "#1a1814")
    )


def closed_door(x, y, w, h, tint) -> str:
    return (
        rect(x, y, w, h, "#2a221c", tint, 1.4)
        + rect(x + 6, y + 8, w - 12, h * 0.42, "#1a1612", "#3a3228", 0.8)
        + rect(x + 6, y + h * 0.52, w - 12, h * 0.4, "#1a1612", "#3a3228", 0.8)
        + circ(x + w - 12, y + h * 0.55, 3.5, BRASS)
    )


def scene_defs(uid: str, b: list[int], wall: str, lamp: str) -> str:
    lx = 28 + b[0] % 48
    ly = 18 + b[1] % 36
    warm = ["#f0d9a0", "#e8c48a", "#d4a070", "#f4e2b8"][b[2] % 4]
    return (
        f'<radialGradient id="lamp{uid}" cx="{lx}%" cy="{ly}%" r="62%">'
        f'<stop offset="0" stop-color="{warm}" stop-opacity=".62"/>'
        f'<stop offset=".42" stop-color="{lamp}" stop-opacity=".16"/>'
        f'<stop offset="1" stop-color="#000000" stop-opacity="0"/>'
        "</radialGradient>"
        f'<linearGradient id="floor{uid}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="#3a3228"/><stop offset="1" stop-color="#1a1610"/>'
        "</linearGradient>"
        f'<linearGradient id="wall{uid}" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{wall}"/><stop offset="1" stop-color="#0e1014"/>'
        "</linearGradient>"
        f'<radialGradient id="vig{uid}" cx="50%" cy="42%" r="72%">'
        '<stop offset=".4" stop-color="#000" stop-opacity="0"/>'
        '<stop offset="1" stop-color="#000" stop-opacity=".5"/>'
        "</radialGradient>"
        '<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse">'
        '<path d="M0 6 L6 0" stroke="#2a2218" opacity=".07"/>'
        "</pattern>"
        '<pattern id="grain" width="7" height="7" patternUnits="userSpaceOnUse">'
        '<path d="M0 7 L7 0" stroke="#2a2218" opacity=".05"/>'
        "</pattern>"
    )


def room_shell(uid: str, b: list[int], wall: str, floor: str, ceil: str, camera: int) -> str:
    if camera == 2:
        # corridor
        return (
            rect(28, 88, 344, 330, wall)
            + poly([(28, 418), (168, 210), (232, 210), (372, 418)], floor)
            + poly([(168, 210), (232, 210), (232, 88), (168, 88)], ceil)
            + poly([(28, 88), (168, 88), (168, 210), (28, 418)], wall, opacity=0.85)
            + poly([(372, 88), (232, 88), (232, 210), (372, 418)], "#0e1216", opacity=0.9)
            + closed_door(186, 128, 28, 82, BRASS)
            + rect(28, 88, 344, 330, f"url(#lamp{uid})")
            + rect(28, 88, 344, 330, f"url(#vig{uid})")
        )
    if camera == 1:
        # desk close-up: lots of floor, low walls, still a real interior
        horizon = 168 + b[3] % 36
        desk_y = 330 + b[9] % 28
        return (
            rect(28, 88, 344, horizon - 88, wall)
            + poly([(28, 88), (28, 418), (92, horizon + 24), (92, 108)], "#12161c", opacity=0.72)
            + poly([(372, 88), (372, 418), (308, horizon + 10), (308, 100)], "#0c1014", opacity=0.78)
            + poly([(28, horizon), (372, horizon - 18), (372, 418), (28, 418)], floor)
            + poly([(54, desk_y), (340, desk_y - 16), (352, 410), (42, 418)], "#4a3828")
            + poly([(54, desk_y), (340, desk_y - 16), (328, desk_y - 28), (66, desk_y - 10)], "#6a5438")
            + pathd(f"M28 {horizon} L372 {horizon - 18}", stroke="#5a4a32", sw=1.2)
            + rect(28, 88, 344, 330, f"url(#lamp{uid})")
            + rect(28, 88, 344, 330, f"url(#vig{uid})")
        )
    if camera == 3:
        # looking down a long table
        return (
            rect(28, 88, 344, 330, wall)
            + poly([(48, 200), (352, 188), (390, 418), (10, 418)], floor)
            + poly([(48, 200), (352, 188), (300, 88), (100, 88)], ceil, opacity=0.9)
            + rect(28, 88, 344, 330, f"url(#lamp{uid})")
            + rect(28, 88, 344, 330, f"url(#vig{uid})")
        )
    # 1-point room
    inset = 62 + b[4] % 48
    back_l, back_r = 28 + inset, 372 - inset + (b[5] % 16) - 8
    back_t = 102 + b[6] % 18
    back_b = 208 + b[7] % 40
    return (
        rect(28, 88, 344, 330, f"url(#wall{uid})")
        + poly([(back_l, back_t), (back_r, back_t), (back_r, back_b), (back_l, back_b)], wall)
        + poly([(28, 88), (back_l, back_t), (back_r, back_t), (372, 88)], ceil)
        + poly([(28, 418), (back_l, back_b), (back_r, back_b), (372, 418)], f"url(#floor{uid})")
        + poly([(28, 88), (back_l, back_t), (back_l, back_b), (28, 418)], wall, opacity=0.92)
        + poly([(372, 88), (back_r, back_t), (back_r, back_b), (372, 418)], "#10141a", opacity=0.88)
        + (closed_door((back_l + back_r) / 2 - 14, back_t + 18, 28, back_b - back_t - 28, BRASS) if b[8] % 3 == 0 else "")
        + rect(28, 88, 344, 330, f"url(#lamp{uid})")
        + rect(28, 88, 344, 330, "url(#hatch)")
        + rect(28, 88, 344, 330, f"url(#vig{uid})")
    )


def plate(x, y, label, tint) -> str:
    return rect(x, y, 92, 18, "#1a1612", tint, 1.1) + txt(x + 46, y + 13, label, BRASS, 9, "middle", "ui-monospace,monospace")


def paint_dosya(b, tint, n, name, cid, uid) -> str:
    cam = b[0] % 4
    body = room_shell(uid, b, "#2a3642", "#3a2e22", "#1c262e", cam)
    if cam == 0:
        body += box3(70, 360, 220, 18, 40, "#5a4a32", "#3a2e22", "#2a1e14")
        body += dossier(88, 210, 150, 96, "#c8b48a", 28, -8)
        body += dossier(118, 226, 160, 100, "#d4c4a0", 40, 4)
        body += dossier(96, 248, 170, 110, "#bba678", 22, -2)
        body += paper_sheet(250, 200, 90, 120, 12, CREAM, 6, 2, b[2])
        body += lamp_obj(300, 120, "#c4a574")
        body += plate(48, 100, "DOSYA", tint)
    elif cam == 1:
        body += lamp_obj(60, 96, OX)
        body += dossier(70, 180, 210, 140, "#d4c4a0", 48, -6)
        body += paper_sheet(160, 210, 150, 170, 7, IVORY, 8, 3, b[3])
        body += stamp_seal(268, 268, "GİZLİ", OX, 16, 28)
        body += plate(48, 100, "KAYIT", tint)
    elif cam == 2:
        body += dossier(70, 250, 140, 90, "#c8b48a", 24, -4)
        body += silhouette(300, 300, 1.1)
        body += lamp_obj(48, 200)
        body += plate(48, 100, "DOSYA", tint)
    else:
        body += shelves(48, 140, 4, 3, tint)
        body += dossier(210, 280, 120, 80, "#d4c4a0", 30, 6)
        body += plate(48, 100, "KAYIT", tint)
        body += stamp_seal(300, 200, "DOSYA", tint, -10, 24)
    if n > 180:
        body += wax(330, 360)
    return body


def paint_telex(b, tint, n, name, cid, uid) -> str:
    cam = b[1] % 4
    body = room_shell(uid, b, "#241e16", "#3a2c1c", "#16120e", 1 if cam == 1 else 0 if cam != 2 else 2)
    if cam == 0:
        body += telex_machine(90, 200, b)
        body += typewriter(210, 280)
        body += paper_sheet(48, 250, 120, 70, -6, IVORY, 4, seed=b[5])
        body += plate(48, 100, "TELEX", tint)
        body += stamp_seal(310, 340, "ONAY", tint, 8, 24)
    elif cam == 1:
        body += radio_obj(48, 200)
        body += tape_deck(150, 210)
        body += paper_sheet(70, 280, 240, 90, 2, CREAM, 5, seed=b[6])
        body += plate(48, 100, "TELEX", tint)
    elif cam == 2:
        body += telex_machine(80, 240, b)
        body += phone_obj(250, 250)
        body += plate(48, 100, "ONAY", tint)
    else:
        body += typewriter(70, 260)
        body += telex_machine(200, 180, b)
        body += lamp_obj(300, 110)
        body += plate(48, 100, "TELEX", tint)
    return body


def paint_karargah(b, tint, n, name, cid, uid) -> str:
    cam = b[2] % 4
    body = room_shell(uid, b, "#1e262e", "#2e261c", "#141a22", 3 if cam == 3 else 0)
    body += map_table(60, 240, 240 if cam != 1 else 180, 90, tint)
    if cam == 0:
        body += phone_obj(280, 210)
        body += paper_sheet(90, 300, 100, 60, -6, CREAM, 3, seed=b[4])
        body += paper_sheet(210, 292, 90, 70, 8, "#d2c4a3", 3, seed=b[5])
        body += lamp_obj(48, 110)
        body += plate(48, 100, "KRİZ", tint)
    elif cam == 1:
        body += "".join(silhouette(80 + i * 48, 300, 0.9 + (b[i] % 3) * 0.06) for i in range(5))
        body += radio_obj(48, 180)
        body += plate(48, 100, "KRİZ", tint)
    elif cam == 2:
        body += tape_deck(70, 300)
        body += phone_obj(180, 300)
        body += stamp_seal(300, 180, "KARAR", tint, 18, 26)
        body += plate(48, 100, "KARAR", tint)
    else:
        body += "".join(silhouette(90 + i * 55, 250, 1.0) for i in range(4))
        body += lamp_obj(300, 108)
        body += plate(48, 100, "KRİZ", tint)
    return body


def paint_heyet(b, tint, n, name, cid, uid) -> str:
    cam = b[3] % 3
    body = room_shell(uid, b, "#2c2434", "#3a3228", "#1c1824", 3)
    body += poly(
        [(70, 270), (330, 255), (310, 310), (90, 322)],
        "#4d392d",
        "#aa8b61",
        2,
    )
    body += "".join(chair(86 + i * 46, 248 + (i % 2) * 8, 0.72) for i in range(5))
    if cam == 0:
        body += paper_sheet(176, 250, 48, 32, 8, CREAM)
        body += lamp_obj(48, 110)
        body += plate(48, 100, "HEYET", tint)
    elif cam == 1:
        body += paper_sheet(80, 330, 220, 60, -2, CREAM, 4, seed=b[7])
        body += stamp_seal(300, 340, "TUTANAK", tint, 6, 28)
        body += plate(48, 100, "TUTANAK", tint)
    else:
        body += stamp_seal(300, 180, "OY", tint, 12, 22)
        body += plate(48, 100, "HEYET", tint)
    return body


def paint_kabine(b, tint, n, name, cid, uid) -> str:
    cam = b[4] % 3
    body = room_shell(uid, b, "#2a2218", "#3a3224", "#1a1610", 2 if cam == 2 else 0)
    cols = "".join(box3(70 + i * 90, 280, 36, 140, 12, BRASS, "#d8c9a8", "#6a5a3a") for i in range(3))
    if cam == 0:
        body += cols + paper_sheet(120, 200, 160, 120, 3, CREAM, 6, seed=b[8])
        body += plate(48, 100, "KABİNE", tint)
    elif cam == 1:
        body += box3(48, 360, 300, 18, 36, "#5a4a32", "#3a2e22", "#2a1e14")
        body += "".join(silhouette(90 + i * 55, 250, 1.05) for i in range(4))
        body += stamp_seal(304, 160, "KARAR", tint, -16, 24)
        body += plate(48, 100, "KARAR", tint)
    else:
        body += cols + paper_sheet(90, 260, 170, 100, 2, CREAM, 5, seed=b[9])
        body += plate(48, 100, "BAKAN", tint)
    return body


def paint_paraf(b, tint, n, name, cid, uid) -> str:
    cam = b[5] % 4
    body = room_shell(uid, b, "#243028", "#3a3424", "#18221c", 1 if cam in (0, 3) else 0)
    flourish = paraf_flourish(name, 80 + b[6] % 40, 300 + b[7] % 30, tint)
    if cam == 0:
        body += paper_sheet(58, 150, 270, 210, -2, CREAM, 7, 4, b[1])
        body += flourish + stamp_seal(280, 200, "PARAF", tint, -22, 34)
        body += lamp_obj(48, 100)
        body += plate(48, 100, "PARAF", tint)
    elif cam == 1:
        body += box3(90, 240, 140, 20, 20, "#3a2a18", "#2a1e14", "#1a120e")
        body += stamp_seal(160, 200, "P", tint, 0, 38)
        body += paper_sheet(70, 270, 240, 100, 4, CREAM, 4, seed=b[2])
        body += flourish
        body += plate(48, 100, "ONAY", tint)
    elif cam == 2:
        body += paper_sheet(50, 140, 190, 220, -7, CREAM, 6, seed=b[3])
        body += paper_sheet(170, 180, 170, 180, 9, "#d2c4a3", 5, seed=b[4])
        body += flourish + stamp_seal(250, 220, "ONAY", tint, 14, 30)
        body += plate(48, 100, "PARAF", tint)
    else:
        body += paper_sheet(48, 150, 290, 190, 1, IVORY, 6, 2, b[2])
        body += flourish + wax(310, 180, "P")
        body += plate(48, 100, "PARAF", tint)
    return body


def paint_brifing(b, tint, n, name, cid, uid) -> str:
    cam = b[6] % 3
    body = room_shell(uid, b, "#1a2430", "#2a2e28", "#101820", 2 if cam == 2 else 0)
    easel = (
        pathd("M130 360 L200 140 L270 360", stroke="#6a5a3a", sw=6)
        + rect(154, 148, 92, 70, "#c5cbb0", "#5a4a32")
    )
    if cam == 0:
        body += easel + silhouette(80, 340, 1.2)
        body += paper_sheet(260, 220, 90, 110, 8, CREAM, 5, seed=b[0])
        body += plate(48, 100, "BRİF", tint)
    elif cam == 1:
        body += map_table(48, 160, 280, 110, tint)
        body += pathd("M80 280 L200 150", stroke=OX, sw=3)
        body += paper_sheet(70, 300, 150, 70, -3, CREAM, 4, seed=b[1])
        body += silhouette(290, 340, 1.1)
        body += plate(48, 100, "BRİF", tint)
    else:
        body += easel + lamp_obj(48, 220)
        body += plate(48, 100, "NOT", tint)
        body += stamp_seal(300, 150, "BRİF", tint, 10, 22)
    return body


def paint_arsiv(b, tint, n, name, cid, uid) -> str:
    cam = b[7] % 3
    body = room_shell(uid, b, "#22281e", "#3a3224", "#161a14", 0 if cam != 2 else 2)
    if cam == 0:
        body += shelves(48, 150, 5, 4, tint)
        body += dossier(240, 300, 110, 70, "#d4c4a0", 28, 8)
        body += plate(48, 100, "ARŞİV", tint)
    elif cam == 1:
        body += shelves(40, 130, 3, 5, tint)
        body += paper_sheet(230, 250, 120, 90, 6, CREAM, 4, seed=b[3])
        body += stamp_seal(300, 360, "KAYIT", tint, 0, 24)
        body += plate(48, 100, "KAYIT", tint)
    else:
        body += "".join(
            box3(60 + i * 100, 340, 88, 50, 16, "#8a6a42", "#6a5438", "#3a2a18") for i in range(3)
        )
        body += paper_sheet(80, 150, 150, 80, -4, CREAM, 4, seed=b[4])
        body += plate(48, 100, "ARŞİV", tint)
    return body


def paint_muhtira(b, tint, n, name, cid, uid) -> str:
    body = room_shell(uid, b, "#2a1c1c", "#3a2a22", "#1a1212", 1)
    body += typewriter(48, 300)
    body += paper_sheet(54, 140, 190, 200, -3, CREAM, 9, 1, b[3])
    body += paper_sheet(150, 160, 180, 190, 5, IVORY, 8, seed=b[4])
    if b[8] % 3:
        for i in range(2 + b[8] % 3):
            body += rect(170 + (b[i] % 20), 250 + i * 16, 70 + b[i] % 50, 8, "#1a1814", opacity=0.84)
    body += stamp_seal(304, 170, "MUHTIRA", tint, -16, 28)
    body += plate(48, 100, "MUHTIRA", tint)
    body += lamp_obj(300, 110, OX)
    return body


def paint_tebligat(b, tint, n, name, cid, uid) -> str:
    cam = b[9] % 3
    body = room_shell(uid, b, "#241c14", "#3a2e1e", "#16120c", 1 if cam == 0 else 0)
    if cam == 0:
        body += envelope(90, 180, 210, 110)
        body += wax(196, 230)
        body += paper_sheet(70, 300, 230, 80, -2, CREAM, 4, seed=b[4])
        body += plate(48, 100, "TEBLİĞ", tint)
    elif cam == 1:
        body += box3(80, 300, 90, 70, 20, "#5a4a32", "#4a3828", "#2a1e14")
        body += envelope(180, 190, 150, 86)
        body += plate(48, 100, "SEVK", tint)
        body += stamp_seal(304, 140, "SEVK", tint, -12, 22)
    else:
        body += envelope(60, 160, 150, 84) + envelope(160, 200, 170, 96)
        body += wax(250, 248) + paper_sheet(70, 320, 230, 70, -3, CREAM, 3, seed=b[5])
        body += plate(48, 100, "TEBLİĞ", tint)
    return body


def paint_zeyil(b, tint, n, name, cid, uid) -> str:
    body = room_shell(uid, b, "#1c2626", "#2a3228", "#121c1c", 1)
    body += paper_sheet(50, 140, 200, 230, -2, CREAM, 9, 2, b[5])
    body += paper_sheet(200, 160, 130, 210, 0, "#d2e0d8", 7, seed=b[6])
    body += rect(200, 160, 16, 210, tint)
    body += stamp_seal(120, 360, "ZEYİL", tint, -8, 26)
    body += plate(48, 100, "ZEYİL", tint)
    if b[10] % 3 == 2:
        body += rect(70, 250, 90, 8, "#1a1814", opacity=0.84)
        body += rect(70, 268, 120, 8, "#1a1814", opacity=0.84)
    return body


def paint_mesruiyet(b, tint, n, name, cid, uid) -> str:
    cam = b[11] % 3
    body = room_shell(uid, b, "#1c2030", "#2e2a22", "#12161e", 0)
    body += paper_sheet(70, 150, 250, 210, 1, CREAM, 5, seed=b[0])
    body += pathd("M180 160 v180", stroke=OX, sw=10)
    body += pathd("M200 160 v180", stroke=tint, sw=10)
    body += stamp_seal(200, 250, "MÜHÜR", tint, 0, 40)
    body += plate(48, 100, "MÜHÜR", tint)
    if cam == 0:
        body += wax(310, 360)
    elif cam == 1:
        body += stamp_seal(310, 360, "KANUN", tint, 12, 22)
        body += plate(48, 380, "KANUN", tint)
    else:
        body += wax(320, 160)
        body += paper_sheet(48, 330, 120, 60, -4, IVORY, 3, seed=b[1])
        body += txt(70, 352, "RESMÎ", OX, 10)
    return body


def paint_ihtar(b, tint, n, name, cid, uid) -> str:
    cam = b[12] % 4
    body = room_shell(uid, b, "#2a1612", "#3a2418", "#1a0e0c", 1 if cam != 3 else 2)
    tri = pathd("M200 140 L320 340 L80 340 Z", "none", OX, 8)
    bang = txt(200, 280, "!", OX, 64, "middle")
    if cam == 0:
        body += tri + bang + paper_sheet(48, 350, 300, 44, 0, CREAM, 2, seed=b[0])
        body += plate(48, 100, "İHTAR", OX)
    elif cam == 1:
        body += paper_sheet(56, 140, 280, 220, -1, CREAM, 8, seed=b[1])
        for i in range(6):
            body += rect(80 + (b[i] % 24), 170 + i * 18, 80 + b[i] % 70, 8, "#1a1814", opacity=0.84)
        body += stamp_seal(284, 200, "İHTAR", OX, -14, 32)
        body += phone_obj(60, 360)
        body += plate(48, 100, "İHTAR", OX)
    elif cam == 2:
        body += envelope(80, 170, 230, 96)
        body += pathd("M200 190 L270 310 L130 310 Z", "none", OX, 6)
        body += stamp_seal(200, 360, "ACİL", OX, 0, 28)
        body += plate(48, 100, "ACİL", OX)
    else:
        body += tri + paper_sheet(48, 140, 130, 80, -6, CREAM, 4, seed=b[2])
        body += typewriter(220, 320)
        body += stamp_seal(300, 170, "İHTAR", OX, 16, 26)
        body += plate(48, 100, "İHTAR", OX)
    return body


def paraf_flourish(name: str, x: float, y: float, tint: str) -> str:
    h = hashlib.sha256(name.encode("utf-8")).digest()
    d = [h[i] for i in range(12)]
    x1, y1 = x + 20 + d[0] % 30, y - 20 - d[1] % 40
    x2, y2 = x + 70 + d[2] % 40, y + 10 - d[3] % 30
    x3, y3 = x + 120 + d[4] % 50, y - 8 + d[5] % 24
    x4, y4 = x + 170 + d[6] % 30, y + 18 - d[7] % 20
    return (
        pathd(
            f"M{x:.1f} {y:.1f} C{x1:.1f} {y1:.1f} {x2:.1f} {y2:.1f} {x3:.1f} {y3:.1f} "
            f"S{x4:.1f} {y4:.1f} {x + 200:.1f} {y + (d[8] % 16) - 8:.1f}",
            stroke=tint,
            sw=2.4,
        )
        + pathd(
            f"M{x + 24:.1f} {y + 8:.1f} C{x + 50:.1f} {y - 12:.1f} {x + 90:.1f} {y + 16:.1f} {x + 140:.1f} {y:.1f}",
            stroke=tint,
            sw=1.3,
            opacity=0.7,
        )
    )


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


def extra_prop(b, kind: str) -> str:
    pick = (b[13] + b[14]) % 8
    if kind == "trap":
        return stamp_seal(70, 130, "DUR", OX, -20, 16) if pick % 2 else rect(48, 96, 80, 8, OX, opacity=0.7)
    catalog = [
        lambda: phone_obj(48, 360),
        lambda: radio_obj(290, 350),
        lambda: tape_deck(48, 360),
        lambda: lamp_obj(318, 96),
        lambda: envelope(250, 350, 90, 48),
        lambda: wax(60, 120, "M"),
        lambda: chair(320, 340, 0.7),
        lambda: paper_sheet(40, 350, 90, 50, -6, IVORY, 3, seed=b[15]),
    ]
    return catalog[pick]()


def kind_overlay(kind: str, subtype: str, tint: str, b) -> str:
    parts = []
    if kind == "spell":
        parts.append(paper_sheet(48, 360, 110, 40, -2, IVORY, 0))
        parts.append(txt(56, 384, "EMİRNAME", "#5a4a32", 8, font="ui-monospace,monospace"))
    if kind == "trap":
        parts.append(rect(28, 88, 344, 10, OX, opacity=0.55))
    if subtype == "fusion":
        parts.append(stamp_seal(86, 150, "I", tint, -8, 16) + stamp_seal(124, 158, "II", tint, 12, 16))
    elif subtype == "equip":
        parts.append(pathd("M48 100 v20 q0 7 7 7 q7 0 7 -7 v-16", stroke="#8a7a5a", sw=2.2))
    elif subtype == "quick":
        parts.append(circ(60, 120, 14, "none", BRASS, 2) + pathd("M60 120 L60 110 M60 120 L68 124", stroke=BRASS, sw=2))
    elif subtype == "counter":
        parts.append(stamp_seal(320, 130, "RED", OX, 18, 16))
    elif subtype == "continuous":
        parts.append(rect(48, 400, 80, 12, "#d8c9a4", "#6a5a3a"))
    elif subtype == "field":
        parts.append(map_table(300, 350, 60, 36, tint))
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
    uid = uid_of(cid_raw)
    edge, ground = jacket(kind, level, aux, tint)
    heavy = 5 if aux or level >= 7 else 3 if level >= 5 else 2
    wall, _side, _floor = WALLS.get(sid, ("#2a3642", "#1c262e", "#3a2e22"))
    painter = PAINT.get(sid, paint_dosya)
    art = painter(b, tint, n, name_raw, cid_raw, uid)
    art += extra_prop(b, kind)
    art += kind_overlay(kind, subtype, tint, b)
    art += paraf_flourish(name_raw + cid_raw, 48 + (b[15] % 40), 390, tint if kind != "trap" else OX)
    slip_x = 36 + (b[16] % 18)
    slip_y = 96 + (b[17] % 12)
    art += paper_sheet(slip_x, slip_y, 132, 26, -2 + (b[18] % 5), IVORY, 0)
    art += txt(slip_x + 8, slip_y + 17, f"{cid_raw} · {name_raw[:18]}", "#3a2a18", 8, font="ui-monospace,monospace", w="600")
    art += f'<rect x="28" y="88" width="344" height="330" fill="url(#lamp{uid})" style="mix-blend-mode:soft-light" opacity=".72"/>'
    art += f'<rect x="28" y="88" width="344" height="330" fill="url(#vig{uid})"/>'
    pips = ""
    if level:
        x0 = 200 - min(level, 8) * 8
        pips = "".join(circ(x0 + i * 16, 64, 4, BRASS) for i in range(min(level, 8)))
    ydew = wax(352, 108) if aux else ""
    classified = ""
    if level >= 5 or kind == "trap":
        classified = rect(28, 88, 96, 16, OX) + txt(76, 100, "GİZLİ", "#f0e6d0", 9, "middle", "ui-monospace,monospace")
    clip = f"well-{cid_raw}"
    tier = "aux" if aux else "high" if level >= 7 else "mid" if level >= 5 else "low"
    lamp = OX if kind == "trap" else BRASS
    defs = scene_defs(uid, b, wall, lamp)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="400" height="560">
<defs>{defs}<clipPath id="{clip}"><rect x="28" y="88" width="344" height="330"/></clipPath></defs>
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
